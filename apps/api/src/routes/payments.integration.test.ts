import { AppError } from "../lib/errors.js";
import * as mediaStorage from "../services/storage/private-media.js";
import { randomUUID, createHmac } from "node:crypto";
import { beforeAll, beforeEach, afterAll, afterEach, describe, it, expect, vi } from "vitest";
import request from "supertest";
import { prisma, type Prisma } from "@leetlogic/database";
import { getConfig } from "../config.js";
import { bachs } from "../providers/payments/bachs.js";
import { createApp } from "../app.js";
import { createSession } from "../services/sessions.js";
import { signAccessToken, verifyAccessToken } from "../lib/tokens.js";
import { combineParcelRates, splitParts } from "../providers/shipping/shipbubble.js";
import {
  startCheckout,
  reconcilePayment,
  requestRelease,
  requestWithdrawal,
  requestRefund,
  availableEarnings,
  journal,
  systemRequest,
} from "../services/payments.js";
import { runMoneyOperation, runPaymentJobs } from "../services/payment-worker.js";
import { redis } from "../lib/redis.js";
import { applyTracking, runDeliveryJobs, shippingProvider } from "../services/delivery.js";
import { deliveryInputHash, deriveDeliveryInput, savedPickup, shippingOrderInclude } from "../services/delivery-quote.js";
import { shippingSnapshot } from "../services/packaging.js";
const suite = process.env.PAYMENTS_INTEGRATION === "1" ? describe : describe.skip;
suite("provider-backed payment safeguards", () => {
  const app = createApp();
  let buyer: string,
    seller: string,
    farmer: string,
    listing: string,
    token: string,
    staff: string,
    outsider: string,
    destination: string;
  const req = () =>
    ({
      ...systemRequest(),
      auth: { sub: seller },
      body: { reason: "Reviewed and approved by test operator" },
    }) as any;
  beforeAll(async () => {
    const url = new URL(getConfig().DATABASE_URL);
    const schema = url.searchParams.get("schema") || "";
    if (!schema.startsWith("leetlogic_payments_integration_") || new URL(getConfig().REDIS_URL).pathname !== "/13")
      throw new Error("Use the isolated payment integration runner.");
    redis().options.keyPrefix = `${schema}:`;
    Object.assign(getConfig(), {
      PAYMENTS_ENABLED: true,
      BACHS_MODE: "sandbox",
      BACHS_API_KEY: "fixture",
      BACHS_WEBHOOK_SECRET: "fixture-secret",
      BACHS_ORGANIZATION_ID: "org_fixture",
      PAYMENTS_TRANSFERS_ENABLED: true,
      PAYMENTS_PAYOUTS_ENABLED: true,
      PAYMENTS_REFUNDS_ENABLED: true,
      BACHS_NGN_PAYOUT_FEE_MINOR: "100",
      DELIVERY_ENABLED: true,
      SHIPBUBBLE_API_KEY: "fixture",
      SHIPBUBBLE_MODE: "test",
      SHIPBUBBLE_TEST_KEY_CONFIRMED: true,
      SHIPBUBBLE_CATEGORY_ID: 24032950,
      DELIVERY_MAX_WEIGHT_KG: 1000,
    });
    const users = await Promise.all(
      [0, 1, 2].map((i) =>
        prisma.user.create({
          data: {
            phoneE164: `+234${i + 7}${Date.now().toString().slice(-9)}`,
            capabilities: { create: { capability: i === 1 ? "SELLER" : "BUYER" } },
            profile: { create: { displayName: "Payment test", fullName: "Payment test", email: "fixture@example.test" } },
          },
        }),
      ),
    );
    buyer = users[0]!.id;
    seller = users[1]!.id;
    token = (
      await createSession({ subject: "CUSTOMER", principalId: buyer, deviceId: randomUUID() })
    ).accessToken;
    outsider = (
      await createSession({
        subject: "CUSTOMER",
        principalId: users[2]!.id,
        deviceId: randomUUID(),
      })
    ).accessToken;
    const role = await prisma.adminRole.create({
      data: { code: `PAYMENTS_${randomUUID()}`, name: "Payment integration" },
    });
    for (const code of ["orders.read", "orders.manage", "payments.manage"]) {
      const permission = await prisma.permission.upsert({
        where: { code }, create: { code, description: code }, update: {},
      });
      await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id } });
    }
    const admin = await prisma.adminAccount.create({
      data: {
        email: `payments-${randomUUID()}@example.test`, fullName: "Payment operator", status: "ACTIVE",
        roles: { create: { roleId: role.id } },
      },
    });
    const adminToken = (await createSession({ subject: "ADMIN", principalId: admin.id, deviceId: randomUUID() })).accessToken;
    staff = signAccessToken({ ...verifyAccessToken(adminToken, "admin"), stepUpAt: Math.floor(Date.now() / 1000) });
    farmer = (
      await prisma.farmerProfile.create({
        data: {
          userId: seller,
          farmName: "Payment fixture",
          farmType: "CROP",
          verificationStatus: "APPROVED",
        },
      })
    ).id;
    const address = await prisma.address.create({
      data: { userId: seller, state: "Lagos", city: "Lagos", lga: "Ikeja", line1: "12 Test road" },
    });
    const category = await prisma.category.create({ data: { slug: `payments-${randomUUID()}` } });
    getConfig().DELIVERY_ALLOWED_CATEGORIES = category.id;
    await prisma.unit.upsert({
      where: { code: "KG" },
      create: { code: "KG", name: "Kilogram", allowsDecimal: true },
      update: {},
    });
    listing = (
      await prisma.listing.create({
        data: {
          farmerProfileId: farmer,
          categoryId: category.id,
          unitCode: "KG",
          locationAddressId: address.id,
          title: "Dry beans",
          description: "Parcel beans",
          unitPriceMinor: 10000n,
          availableQuantity: "1000",
          reservedQuantity: "100",
          shippingScope: "NATIONWIDE",
          packaging: { unitsPerPackage: 1, weightKg: 1.1, length: 20, width: 15, height: 10, handling: "STANDARD", notes: "Keep dry" },
          status: "ACTIVE",
        },
      })
    ).id;
    await prisma.financialAccount.create({
      data: {
        userId: seller,
        mode: "sandbox",
        providerAccountId: `acct_${seller}`,
        status: "READY",
        capabilities: ["transfers", "payouts"],
      },
    });
    destination = (
      await prisma.bankDestination.create({
        data: {
          userId: seller,
          mode: "sandbox",
          providerId: `bank_${seller}`,
          bankCode: "001",
          bankName: "Test bank",
          accountName: "Test farmer",
          accountLastFour: "7890",
          fingerprint: randomUUID(),
          usable: true,
        },
      })
    ).id;
  });
  beforeEach(() => {
    // Workers scan the schema. No test may accidentally call either real provider.
    vi.spyOn(bachs, "call").mockRejectedValue(new Error("Unexpected payment provider call"));
    vi.spyOn(shippingProvider, "quotes").mockRejectedValue(new Error("Unexpected rate request"));
    vi.spyOn(shippingProvider, "wallet").mockResolvedValue(1000000n);
    vi.spyOn(shippingProvider, "book").mockRejectedValue(new Error("Unexpected carrier booking"));
    vi.spyOn(shippingProvider, "track").mockImplementation(async (id) => ({ id, status: "pending", courier: "Fixture courier" }));
    vi.spyOn(shippingProvider, "cancel").mockResolvedValue();
  });
  afterEach(async () => {
    await prisma.delivery.updateMany({
      where: { order: { buyerId: buyer, farmerProfileId: farmer }, status: "BOOKING_QUEUED" },
      data: { status: "BOOKING_BLOCKED" },
    });
    vi.restoreAllMocks();
  });
  afterAll(async () => {
    await prisma.$disconnect();
    await redis().quit();
  });
  async function order(quantity = 1, productId = listing) {
    const product = await prisma.listing.findUniqueOrThrow({ where: { id: productId } });
    const o = await prisma.tradeOrder.create({
      data: {
        reference: `PAY-${randomUUID()}`,
        buyerId: buyer,
        farmerProfileId: product.farmerProfileId,
        listingId: productId,
        quantity: String(quantity),
        totalMinor: product.unitPriceMinor * BigInt(quantity),
        feeBasisPoints: 600,
        packagingSnapshot: shippingSnapshot(product) as Prisma.InputJsonValue,
      },
      include: shippingOrderInclude,
    });
    const contact = { name: "Fixture contact", phone: "+2348012345678", email: "fixture@example.test", address: "20 Buyer Street, Lagos, Ikeja", state: "Lagos", country: "NG" as const };
    const input = deriveDeliveryInput(o, {
      pickup: { ...contact, ...savedPickup(o) },
      destination: contact,
      pickupDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    });
    const service = (index: number) => ({
      requestToken: `token-${o.id}-${index}`, serviceCode: "pickup", courierId: "courier", courier: "Fixture courier",
      amountMinor: 1000n, walletMinor: 1000n,
    });
    const rate = input.parcel.packageCount === 1 ? service(0) : combineParcelRates(
      Array.from({ length: input.parcel.packageCount }, (_, index) => [service(index)]),
    )[0]!;
    const d = await prisma.delivery.create({
      data: { orderId: o.id, status: "PAYMENT_PENDING", shippingMinor: rate.amountMinor, courier: rate.courier, pickup: input.pickup, destination: input.destination, package: input.parcel },
    });
    const q = await prisma.deliveryQuote.create({
      data: {
        deliveryId: d.id,
        ...rate,
        inputHash: deliveryInputHash(o, input),
        expiresAt: new Date(Date.now() + 600000),
      },
    });
    await prisma.delivery.update({ where: { id: d.id }, data: { selectedQuoteId: q.id } });
    return { o, d, q };
  }
  async function checkout(orderId: string) {
    const a = await startCheckout(orderId, buyer);
    const op = await prisma.moneyOperation.findFirstOrThrow({
      where: { paymentId: a.id, kind: "CHECKOUT" },
    });
    vi.spyOn(bachs, "checkout").mockResolvedValue({
      checkout_id: `cs_${a.id}`,
      checkout_url: `https://checkout.bachs.io/${a.id}`,
      expires_at: new Date(Date.now() + 600000).toISOString(),
    });
    await runMoneyOperation(op.id);
    return prisma.paymentAttempt.findUniqueOrThrow({ where: { id: a.id } });
  }
  function mockReceipt(a: any, overrides: any = {}) {
    vi.spyOn(bachs, "checkoutState").mockResolvedValue({
      checkout_id: a.checkoutId,
      reference: a.id,
      charge_id: `ch_${a.id}`,
      status: "completed",
    });
    vi.spyOn(bachs, "payment").mockResolvedValue({
      payment_id: `ch_${a.id}`,
      checkout_id: a.checkoutId,
      currency: "NGN",
      amount: `${a.amountMinor / 100n}.${String(a.amountMinor % 100n).padStart(2, "0")}`,
      amount_paid: `${(a.amountMinor + 100n) / 100n}.${String((a.amountMinor + 100n) % 100n).padStart(2, "0")}`,
      amount_remaining: "0.00",
      fees: { amount: "1.00", currency: "NGN" },
      merchant_bears_cost: false,
      method: "NGN_CARD",
      status: "succeeded",
      ...overrides,
    });
  }
  async function funded(quantity = 1) {
    const fixture = await order(quantity);
    const a = await checkout(fixture.o.id);
    mockReceipt(a);
    await reconcilePayment(a.id);
    return { ...fixture, a };
  }
  async function recordParcels(fixture: Awaited<ReturnType<typeof order>>, count: number) {
    const parts = splitParts(fixture.q.requestToken)!;
    await prisma.delivery.update({ where: { id: fixture.d.id }, data: {
      status: "BOOKING_UNCERTAIN", providerShipmentId: `split:${fixture.d.id}`, bookingStartedAt: new Date(),
    } });
    for (const [parcelIndex, part] of parts.entries())
      await prisma.deliveryParcel.create({ data: {
        deliveryId: fixture.d.id, quoteId: fixture.q.id, parcelIndex, ...part,
        amountMinor: BigInt(part.amountMinor), walletMinor: BigInt(part.walletMinor),
        status: parcelIndex < count ? "BOOKED" : "BOOKING_UNCERTAIN",
        providerShipmentId: parcelIndex < count ? `SB-${fixture.d.id}-${parcelIndex}` : null,
        actualMinor: parcelIndex < count ? BigInt(part.walletMinor) : null,
      } });
    return prisma.deliveryParcel.findMany({ where: { deliveryId: fixture.d.id }, orderBy: { parcelIndex: "asc" } });
  }
  const customerAuth = () => ({ Authorization: `Bearer ${token}` });
  const staffAuth = () => ({ Authorization: `Bearer ${staff}` });
  const deferred = <T,>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((done) => { resolve = done; });
    return { promise, resolve };
  };
  const rate = (q: Awaited<ReturnType<typeof order>>["q"], amountMinor = q.amountMinor) => ({
    requestToken: q.requestToken, courierId: q.courierId!, serviceCode: q.serviceCode,
    courier: q.courier, amountMinor, walletMinor: amountMinor,
  });
  it("collects produce-only payment for pickup and lets only the buyer confirm receipt", async () => {
    const { o, d } = await order();
    expect(
      (
        await request(app)
          .post(`/v1/orders/${o.id}/delivery/collection`)
          .set("Authorization", `Bearer ${outsider}`)
          .send({})
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .post(`/v1/orders/${o.id}/delivery/collection`)
          .set("Authorization", `Bearer ${token}`)
          .send({})
      ).status,
    ).toBe(200);
    const selected = await prisma.delivery.findUniqueOrThrow({ where: { id: d.id } });
    expect(selected.status).toBe("PICKUP_PENDING");
    expect(selected.shippingMinor).toBe(0n);
    expect(selected.selectedQuoteId).toBeNull();
    const a = await checkout(o.id);
    expect(a.amountMinor).toBe(10000n);
    expect(a.shippingMinor).toBe(0n);
    expect(a.quoteId).toBeNull();
    expect(
      (
        await request(app)
          .post(`/v1/orders/${o.id}/delivery/confirm`)
          .set("Authorization", `Bearer ${token}`)
          .send({})
      ).status,
    ).toBe(409);
    mockReceipt(a, { amount: "100.00", amount_paid: "101.00" });
    await reconcilePayment(a.id);
    expect((await prisma.delivery.findUniqueOrThrow({ where: { id: d.id } })).status).toBe(
      "PICKUP_READY",
    );
    expect(
      (
        await request(app)
          .post(`/v1/orders/${o.id}/delivery/collection`)
          .set("Authorization", `Bearer ${token}`)
          .send({})
      ).status,
    ).toBe(409);
    expect(
      (
        await request(app)
          .post(`/v1/orders/${o.id}/delivery/confirm`)
          .set("Authorization", `Bearer ${token}`)
          .send({})
      ).status,
    ).toBe(200);
    expect(
      (await prisma.tradeOrder.findUniqueOrThrow({ where: { id: o.id } })).deliveryConfirmedAt,
    ).not.toBeNull();
  });
  it("ranks courier quotes, initializes one checkout, checks pending payment and funds escrow exactly once", async () => {
    const { o, d, q } = await order();
    await prisma.deliveryQuote.update({
      where: { id: q.id },
      data: { amountMinor: 1125000n, eta: "Within 1 - 4 working days" },
    });
    const fast = await prisma.deliveryQuote.create({
      data: {
        deliveryId: d.id,
        requestToken: "fast",
        serviceCode: "pickup",
        courierId: "fast",
        courier: "Value courier",
        quality: { rating: 4.7, votes: 80, trackingLevel: 8 },
        amountMinor: 695000n,
        walletMinor: 695000n,
        eta: "Within 25 hrs",
        inputHash: q.inputHash,
        expiresAt: new Date(Date.now() + 600000),
      },
    });
    const auth = { Authorization: `Bearer ${token}` };
    const detail = await request(app).get(`/v1/orders/${o.id}/delivery`).set(auth);
    expect(detail.body.delivery.quotes[0]).toMatchObject({
      id: fast.id,
      recommended: true,
      quality: { rating: 4.7, votes: 80, trackingLevel: 8 },
    });
    expect(
      (
        await request(app)
          .post(`/v1/orders/${o.id}/delivery/select`)
          .set(auth)
          .send({ quoteId: fast.id })
      ).status,
    ).toBe(200);
    const write = vi.spyOn(bachs, "checkout").mockImplementation(async ({ id }) => ({
      checkout_id: `cs_${id}`,
      checkout_url: `https://sandbox-checkout.bachs.io/c/${id}`,
      expires_at: new Date(Date.now() + 600000).toISOString(),
    }));
    const first = await request(app).post(`/v1/orders/${o.id}/checkout`).set(auth).send({});
    expect(first.status).toBe(200);
    expect(first.body.amountMinor).toBe("705000");
    const again = await request(app).post(`/v1/orders/${o.id}/checkout`).set(auth).send({});
    expect(again.body.id).toBe(first.body.id);
    expect(write).toHaveBeenCalledTimes(1);
    const attempt = await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: first.body.id } });
    vi.spyOn(bachs, "checkoutState").mockResolvedValue({
      checkout_id: attempt.checkoutId,
      reference: attempt.id,
      status: "open",
    });
    await request(app).post(`/v1/orders/${o.id}/payments/${attempt.id}/refresh`).set(auth).send({});
    expect((await prisma.tradeOrder.findUniqueOrThrow({ where: { id: o.id } })).heldMinor).toBe(0n);
    mockReceipt(attempt, { amount: "7050.00", amount_paid: "7051.00" });
    expect(
      (
        await request(app)
          .post(`/v1/orders/${o.id}/payments/${attempt.id}/refresh`)
          .set(auth)
          .send({})
      ).body.status,
    ).toBe("SUCCEEDED");
    await reconcilePayment(attempt.id);
    expect(await prisma.tradeOrder.findUniqueOrThrow({ where: { id: o.id } })).toMatchObject({
      status: "FUNDED",
      heldMinor: 10000n,
    });
    expect((await prisma.delivery.findUniqueOrThrow({ where: { id: d.id } })).paidMinor).toBe(
      695000n,
    );
    expect(await prisma.escrowEntry.count({ where: { orderId: o.id, kind: "FUND" } })).toBe(1);
    expect((await request(app).post(`/v1/orders/${o.id}/checkout`).set(auth).send({})).status).toBe(
      409,
    );
  });
  it("reuses an open checkout after a declined card and confirms a later successful retry once", async () => {
    const { o } = await order();
    const attempt = await checkout(o.id);
    mockReceipt(attempt, { status: "failed", amount_paid: "0.00", amount_remaining: "110.00" });
    vi.spyOn(bachs, "checkoutState").mockResolvedValue({
      checkout_id: attempt.checkoutId,
      reference: attempt.id,
      charge_id: `ch_${attempt.id}`,
      status: "open",
    });
    await reconcilePayment(attempt.id);
    const declined = await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(declined).toMatchObject({
      status: "OPEN",
      paidMinor: 0n,
      chargeId: null,
      exceptionCode: "PAYMENT_ATTEMPT_FAILED",
    });
    // Recover the same state for an older record that was previously saved as FAILED.
    await prisma.paymentAttempt.update({
      where: { id: attempt.id },
      data: { status: "FAILED", chargeId: `ch_${attempt.id}` },
    });
    expect((await startCheckout(o.id, buyer)).id).toBe(attempt.id);
    const retryId = `retry_${attempt.id}`;
    mockReceipt(attempt, { payment_id: retryId });
    vi.spyOn(bachs, "checkoutState").mockResolvedValue({
      checkout_id: attempt.checkoutId,
      reference: attempt.id,
      charge_id: retryId,
      status: "completed",
    });
    await reconcilePayment(attempt.id);
    await reconcilePayment(attempt.id);
    expect(await prisma.paymentAttempt.count({ where: { orderId: o.id, kind: "ORDER" } })).toBe(1);
    expect(await prisma.escrowEntry.count({ where: { orderId: o.id, kind: "FUND" } })).toBe(1);
    expect(await prisma.tradeOrder.findUniqueOrThrow({ where: { id: o.id } })).toMatchObject({
      status: "FUNDED",
      heldMinor: 10000n,
    });
  });
  it("returns a visible error when checkout initialization is definitely rejected", async () => {
    const { o } = await order();
    vi.spyOn(bachs, "checkout").mockRejectedValue(
      new AppError(422, "PAYMENT_PROVIDER_REJECTED", "Rejected"),
    );
    const response = await request(app)
      .post(`/v1/orders/${o.id}/checkout`)
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("PAYMENT_PROVIDER_REJECTED");
    expect((await prisma.tradeOrder.findUniqueOrThrow({ where: { id: o.id } })).heldMinor).toBe(0n);
  });
  it("deduplicates concurrent checkout and restricts payment access", async () => {
    const { o } = await order();
    const attempts = await Promise.all([startCheckout(o.id, buyer), startCheckout(o.id, buyer)]);
    expect(attempts[0]!.id).toBe(attempts[1]!.id);
    expect(
      (
        await request(app)
          .get(`/v1/orders/${o.id}/payments`)
          .set("Authorization", `Bearer ${outsider}`)
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .get(`/v1/orders/${o.id}/payments`)
          .set("Authorization", `Bearer ${token}`)
      ).status,
    ).toBe(200);
  });
  it("does not fund expired quotes or unsupported manual delivery", async () => {
    const { o, q } = await order();
    await prisma.deliveryQuote.update({
      where: { id: q.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await expect(startCheckout(o.id, buyer)).rejects.toMatchObject({ code: "QUOTE_EXPIRED" });
  });
  it("funds produce and shipping once, requires buyer receipt and blocks disputed release", async () => {
    const { o, d } = await order(),
      a = await checkout(o.id);
    mockReceipt(a);
    await reconcilePayment(a.id);
    await reconcilePayment(a.id);
    const funded = await prisma.tradeOrder.findUniqueOrThrow({ where: { id: o.id } });
    expect(funded.heldMinor).toBe(10000n);
    const paidNotices = await prisma.paidOrderNotification.findMany({ where: { orderId: o.id } });
    expect(paidNotices).toHaveLength(1);
    expect(paidNotices[0]!.userId).toBe(
      (await prisma.farmerProfile.findUniqueOrThrow({ where: { id: o.farmerProfileId } })).userId,
    );
    expect((await prisma.delivery.findUniqueOrThrow({ where: { id: d.id } })).paidMinor).toBe(
      1000n,
    );
    expect(await prisma.escrowEntry.count({ where: { orderId: o.id, kind: "FUND" } })).toBe(1);
    await expect(requestRelease(o.id, req())).rejects.toMatchObject({ code: "RELEASE_BLOCKED" });
    await prisma.tradeOrder.update({
      where: { id: o.id },
      data: { deliveryConfirmedAt: new Date(), status: "DELIVERED" },
    });
    const heldBefore = (
      await request(app).get("/v1/orders/escrow-summary").set("Authorization", `Bearer ${token}`)
    ).body.heldMinor;
    expect(BigInt(heldBefore)).toBeGreaterThanOrEqual(10000n);
    const baseDispatch = (
      await request(app).get("/v1/orders/escrow-summary").set("Authorization", `Bearer ${token}`)
    ).body.activeDispatch;
    await prisma.delivery.update({ where: { id: d.id }, data: { status: "IN_TRANSIT" } });
    expect(
      (await request(app).get("/v1/orders/escrow-summary").set("Authorization", `Bearer ${token}`))
        .body.activeDispatch,
    ).toBe(baseDispatch + 1);
    const outsiderSummary = await request(app)
      .get("/v1/orders/escrow-summary")
      .set("Authorization", `Bearer ${outsider}`);
    expect(outsiderSummary.body).toMatchObject({ heldMinor: "0", activeDispatch: 0 });
    await prisma.delivery.update({ where: { id: d.id }, data: { status: "DELIVERED" } });

    expect(
      (
        await request(app)
          .get(`/v1/orders/${o.id}/disputes`)
          .set("Authorization", `Bearer ${outsider}`)
      ).status,
    ).toBe(404);
    const responses = await Promise.all(
      [0, 1].map(() =>
        request(app)
          .post(`/v1/orders/${o.id}/disputes`)
          .set("Authorization", `Bearer ${token}`)
          .send({ reason: "QUALITY", description: "The produce arrived damaged." }),
      ),
    );
    expect(responses.map((r) => r.status)).toEqual([201, 201]);
    expect(responses[0]!.body.item.id).toBe(responses[1]!.body.item.id);
    const ticket = responses[0]!.body.item;
    await prisma.supportMessage.create({
      data: { ticketId: ticket.id, authorId: seller, body: "Private staff note", internal: true },
    });
    const visible = await request(app)
      .get(`/v1/orders/${o.id}/disputes`)
      .set("Authorization", `Bearer ${token}`);
    expect(visible.body.items[0].messages.map((m: any) => m.body)).toEqual([
      "The produce arrived damaged.",
    ]);
    vi.spyOn(mediaStorage, "storeMedia").mockResolvedValue(`disputes/${randomUUID()}`);
    vi.spyOn(mediaStorage, "readMedia").mockResolvedValue(
      Buffer.from([255, 216, 255, ...Array(20).fill(0)]),
    );
    const upload = await request(app)
      .post(`/v1/orders/${o.id}/disputes/${ticket.id}/evidence`)
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "image/jpeg")
      .send(Buffer.from([255, 216, 255, ...Array(20).fill(0)]));
    expect(upload.status).toBe(201);
    const photoUrl = `/v1/orders/${o.id}/disputes/${ticket.id}/evidence/${upload.body.item.id}`;
    expect((await request(app).get(photoUrl).set("Authorization", `Bearer ${token}`)).status).toBe(
      200,
    );
    expect(
      (await request(app).get(photoUrl).set("Authorization", `Bearer ${outsider}`)).status,
    ).toBe(404);
    expect((await request(app).get(photoUrl)).status).toBe(401);
    expect(
      (
        await request(app)
          .post(`/v1/orders/${o.id}/disputes`)
          .set("Authorization", `Bearer ${outsider}`)
          .send({ reason: "QUALITY", description: "Not my order cannot access." })
      ).status,
    ).toBe(404);
    await expect(requestRelease(o.id, req())).rejects.toMatchObject({ code: "RELEASE_BLOCKED" });
    await prisma.supportTicket.update({ where: { id: ticket.id }, data: { status: "RESOLVED" } });
    vi.spyOn(bachs, "account").mockResolvedValue({
      id: `acct_${seller}`,
      parent_organization_id: "org_fixture",
      enabled_capabilities: ["transfers", "payouts"],
    });
    vi.spyOn(bachs, "balances").mockResolvedValue([
      { currency: "NGN", available_balance: "100000.00" },
    ]);
    const release = await requestRelease(o.id, req());
    const tooLate = await request(app)
      .post(`/v1/orders/${o.id}/disputes`)
      .set("Authorization", `Bearer ${token}`)
      .send({ reason: "OTHER", description: "A settlement is in progress." });
    expect(tooLate.status).toBe(409);
    expect(tooLate.body.error.code).toBe("SETTLEMENT_STARTED");
    vi.spyOn(bachs, "call").mockImplementation(async (path, body: any) => {
      if (path === "/transfers")
        return {
          id: `tr_${release.id}`,
          status: "paid",
          currency: "NGN",
          amount: body.amount,
          destination: `acct_${seller}`,
        };
      throw new Error("Unexpected provider call");
    });
    await runMoneyOperation(release.id);
    await runMoneyOperation(release.id);
    expect((await prisma.tradeOrder.findUniqueOrThrow({ where: { id: o.id } })).status).toBe(
      "COMPLETED",
    );
    expect(
      BigInt(
        (
          await request(app)
            .get("/v1/orders/escrow-summary")
            .set("Authorization", `Bearer ${token}`)
        ).body.heldMinor,
      ),
    ).toBe(BigInt(heldBefore) - 10000n);
    expect((await availableEarnings(seller)).balanceMinor).toBe(9400n);
    const withdrawals = await Promise.all([
      requestWithdrawal(seller, destination, 1000n, randomUUID()),
      requestWithdrawal(seller, destination, 1000n, randomUUID()),
    ]);
    expect(withdrawals[0]!.id).toBe(withdrawals[1]!.id);
    expect(withdrawals[0]!.status).toBe("REQUESTED");
    expect((await availableEarnings(seller)).reservedMinor).toBe(1100n);
    const withdrawal = withdrawals[0]!;
    await prisma.moneyOperation.update({
      where: { id: withdrawal.id },
      data: { status: "QUEUED" },
    });
    vi.spyOn(bachs, "destination").mockResolvedValue({
      id: `bank_${seller}`,
      currency: "NGN",
      account_number: "1234567890",
      is_usable: true,
    });
    vi.spyOn(bachs, "call").mockImplementation(async (path, body: any) => {
      if (path === "/payouts")
        return {
          id: `po_${withdrawal.id}`,
          status: "completed",
          currency: "NGN",
          amount: body.amount,
          fee: "1.00",
          total_debited: "11.00",
          reference: withdrawal.id,
          destination: `bank_${seller}`,
        };
      throw new Error("Unexpected provider call");
    });
    await runMoneyOperation(withdrawal.id);
    expect(
      (await prisma.moneyOperation.findUniqueOrThrow({ where: { id: withdrawal.id } })).status,
    ).toBe("SUCCEEDED");
    expect((await availableEarnings(seller)).availableMinor).toBe(8300n);
  });
  it("records extra charges separately and does not fund twice", async () => {
    const { o } = await order(),
      a = await checkout(o.id);
    mockReceipt(a);
    await reconcilePayment(a.id);
    vi.spyOn(bachs, "payment").mockResolvedValue({
      payment_id: `extra_${a.id}`,
      checkout_id: a.checkoutId,
      currency: "NGN",
      amount: "110.00",
      amount_paid: "110.00",
      merchant_bears_cost: false,
      method: "NGN_CARD",
      status: "succeeded",
    });
    await reconcilePayment(a.id, `extra_${a.id}`);
    await reconcilePayment(a.id, `extra_${a.id}`);
    expect(await prisma.paymentAttempt.count({ where: { orderId: o.id, kind: "EXCESS" } })).toBe(1);
    expect((await prisma.tradeOrder.findUniqueOrThrow({ where: { id: o.id } })).heldMinor).toBe(
      10000n,
    );
    expect((await prisma.tradeOrder.findUniqueOrThrow({ where: { id: o.id } })).financialHold).toBe(
      true,
    );
  });
  it("waits for confirmed refunds and retains processing fees only once", async () => {
    const { o, d } = await order(),
      a = await checkout(o.id);
    mockReceipt(a);
    await reconcilePayment(a.id);
    await prisma.delivery.update({ where: { id: d.id }, data: { status: "BOOKING_BLOCKED" } });
    const refundReq = req();
    refundReq.auth.sub = buyer;
    refundReq.body.shippingRefundMinor = "1000";
    const ops = await requestRefund(o.id, refundReq),
      op = ops[0]!;
    vi.spyOn(bachs, "payment").mockResolvedValue({
      payment_id: `ch_${a.id}`,
      checkout_id: a.checkoutId,
      currency: "NGN",
      is_refundable: true,
    });
    vi.spyOn(bachs, "balances").mockResolvedValue([
      { currency: "NGN", available_balance: "10000.00" },
    ]);
    const refund = {
      id: `rf_${op.id}`,
      status: "processing",
      currency: "NGN",
      requested_amount: "110.00",
      charge_id: `ch_${a.id}`,
      reference: op.id,
    };
    const write = vi.spyOn(bachs, "call").mockResolvedValue(refund);
    await runMoneyOperation(op.id);
    expect((await prisma.tradeOrder.findUniqueOrThrow({ where: { id: o.id } })).heldMinor).toBe(
      10000n,
    );
    expect((await prisma.moneyOperation.findUniqueOrThrow({ where: { id: op.id } })).status).toBe(
      "PROVIDER_PENDING",
    );
    vi.spyOn(bachs, "operation").mockResolvedValue({ ...refund, status: "success" });
    await runMoneyOperation(op.id);
    await runMoneyOperation(op.id);
    expect(write).toHaveBeenCalledTimes(1);
    expect((await prisma.tradeOrder.findUniqueOrThrow({ where: { id: o.id } })).refundedMinor).toBe(
      10000n,
    );
    expect((await prisma.delivery.findUniqueOrThrow({ where: { id: d.id } })).paidMinor).toBe(0n);
    expect(
      (await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: a.id } })).processingFeeMinor,
    ).toBe(100n);
  });
  it("completes bank refunds only after the original payer receives the payout", async () => {
    getConfig().BACHS_BANK_REFUNDS_VERIFIED = true;
    const buyerAccount = await prisma.financialAccount.upsert({
      where: { userId_mode: { userId: buyer, mode: "sandbox" } },
      create: {
        userId: buyer,
        mode: "sandbox",
        providerAccountId: `acct_${buyer}`,
        status: "READY",
        capabilities: ["transfers", "payouts"],
      },
      update: {},
    });
    const bank = await prisma.bankDestination.create({
      data: {
        userId: buyer,
        mode: "sandbox",
        providerId: `bank_${randomUUID()}`,
        bankCode: "001",
        bankName: "Test bank",
        accountName: "Buyer",
        accountLastFour: "7890",
        fingerprint: randomUUID(),
        usable: true,
      },
    });
    const { o, d } = await order(),
       a = await checkout(o.id);
    mockReceipt(a, { method: "NGN_BANK_TRANSFER" });
    await reconcilePayment(a.id);
    await prisma.delivery.update({ where: { id: d.id }, data: { status: "BOOKING_BLOCKED" } });
    const refundReq = req();
    refundReq.auth.sub = buyer;
    refundReq.body.shippingRefundMinor = "1000";
    refundReq.body.destinationId = bank.id;
    const op = (await requestRefund(o.id, refundReq))[0]!;
    vi.spyOn(bachs, "account").mockResolvedValue({
      id: buyerAccount.providerAccountId,
      parent_organization_id: "org_fixture",
      enabled_capabilities: ["transfers", "payouts"],
    });
    vi.spyOn(bachs, "payment").mockResolvedValue({
      payment_id: `ch_${a.id}`,
      checkout_id: a.checkoutId,
      currency: "NGN",
      payment_method_details: {
        bank_transfer: { sender_account_number: "1234567890", sender_bank_code: "001" },
      },
    });
    vi.spyOn(bachs, "balances").mockResolvedValue([
      { currency: "NGN", available_balance: "1000.00" },
    ]);
    vi.spyOn(bachs, "destination").mockResolvedValue({
      id: bank.providerId,
      currency: "NGN",
      is_usable: true,
      account_number: "1234567890",
      bank_code: "001",
    });
    vi.spyOn(bachs, "call").mockImplementation(async (path, body: any) => {
      if (path === "/transfers")
        return {
          id: `tr_${op.id}`,
          status: "paid",
          currency: "NGN",
          amount: body.amount,
          destination: buyerAccount.providerAccountId,
        };
      if (path === "/payouts")
        return {
          id: `po_${op.id}`,
          status: "completed",
          currency: "NGN",
          amount: body.amount,
          fee: "1.00",
          total_debited: "110.00",
          reference: body.reference,
          destination: bank.providerId,
        };
      throw new Error("Unexpected provider call");
    });
    await runMoneyOperation(op.id);
    expect((await prisma.tradeOrder.findUniqueOrThrow({ where: { id: o.id } })).refundedMinor).toBe(
      0n,
    );
    const payout = await prisma.moneyOperation.findFirstOrThrow({
      where: { orderId: o.id, kind: "REFUND_PAYOUT" },
    });
    expect(payout.amountMinor).toBe(10900n);
    expect(payout.feeMinor).toBe(100n);
    await runMoneyOperation(payout.id);
    expect((await prisma.tradeOrder.findUniqueOrThrow({ where: { id: o.id } })).refundedMinor).toBe(
      10000n,
    );
    getConfig().BACHS_BANK_REFUNDS_VERIFIED = false;
  });
  it("funds only a refreshed shipping shortfall and preserves quote-decrease credit", async () => {
    const { o, d, q } = await order(),
      a = await checkout(o.id);
    mockReceipt(a);
    await reconcilePayment(a.id);
    await prisma.deliveryQuote.update({
      where: { id: q.id },
      data: { amountMinor: 1500n, walletMinor: 1500n },
    });
    await prisma.delivery.update({
      where: { id: d.id },
      data: { shippingMinor: 1500n, status: "TOPUP_REQUIRED" },
    });
    const topup = await startCheckout(o.id, buyer, "DELIVERY_TOPUP");
    expect(topup.amountMinor).toBe(500n);
    expect(topup.produceMinor).toBe(0n);
    await prisma.paymentAttempt.update({
      where: { id: topup.id },
      data: { checkoutId: `cs_${topup.id}` },
    });
    vi.spyOn(bachs, "checkoutState").mockResolvedValue({
      checkout_id: `cs_${topup.id}`,
      reference: topup.id,
      charge_id: `ch_${topup.id}`,
    });
    vi.spyOn(bachs, "payment").mockResolvedValue({
      payment_id: `ch_${topup.id}`,
      checkout_id: `cs_${topup.id}`,
      currency: "NGN",
      amount: "5.00",
      amount_paid: "5.00",
      amount_remaining: "0.00",
      merchant_bears_cost: false,
      method: "NGN_CARD",
      status: "succeeded",
    });
    await reconcilePayment(topup.id);
    expect((await prisma.delivery.findUniqueOrThrow({ where: { id: d.id } })).paidMinor).toBe(
      1500n,
    );
    await prisma.delivery.update({ where: { id: d.id }, data: { shippingMinor: 1200n } });
    expect((await prisma.delivery.findUniqueOrThrow({ where: { id: d.id } })).paidMinor).toBe(
      1500n,
    );
  });
  it("holds underpayments and late payments without funding or booking", async () => {
    const { o } = await order(),
      a = await checkout(o.id);
    mockReceipt(a, { amount_paid: "50.00", amount_remaining: "60.00", status: "underpaid" });
    await reconcilePayment(a.id);
    expect((await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: a.id } })).status).toBe(
      "EXCEPTION",
    );
    expect((await prisma.tradeOrder.findUniqueOrThrow({ where: { id: o.id } })).financialHold).toBe(
      true,
    );
    expect((await prisma.tradeOrder.findUniqueOrThrow({ where: { id: o.id } })).heldMinor).toBe(0n);
    const late = await order(),
      p = await checkout(late.o.id);
    mockReceipt(p);
    await prisma.tradeOrder.update({
      where: { id: late.o.id },
      data: { reservationExpiresAt: new Date(Date.now() - 1000) },
    });
    await reconcilePayment(p.id);
    expect((await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: p.id } })).status).toBe(
      "EXCEPTION",
    );
  });
  it("keeps an uncertain checkout write from being repeated", async () => {
    const { o } = await order(),
      a = await startCheckout(o.id, buyer),
      op = await prisma.moneyOperation.findFirstOrThrow({ where: { paymentId: a.id } });
    const write = vi.spyOn(bachs, "checkout").mockRejectedValue(new Error("network timeout"));
    await runMoneyOperation(op.id);
    await runMoneyOperation(op.id);
    expect(write).toHaveBeenCalledTimes(1);
    expect((await prisma.moneyOperation.findUniqueOrThrow({ where: { id: op.id } })).status).toBe(
      "UNKNOWN",
    );
  });
  it("preserves final refunded status when a delayed success arrives", async () => {
    const { o } = await order(),
      a = await checkout(o.id);
    mockReceipt(a);
    await reconcilePayment(a.id);
    await prisma.paymentAttempt.update({ where: { id: a.id }, data: { status: "REFUNDED" } });
    const before = await prisma.moneyJournal.count({ where: { orderId: o.id } });
    await reconcilePayment(a.id);
    expect((await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: a.id } })).status).toBe(
      "REFUNDED",
    );
    expect(await prisma.moneyJournal.count({ where: { orderId: o.id } })).toBe(before);
  });
  it("stores signed webhook triggers once and rejects tampering", async () => {
    const raw = JSON.stringify({
        id: `evt_${randomUUID()}`,
        type: "ignored.event",
        organization_id: "org_fixture",
        data: { id: "object" },
      }),
      t = String(Math.floor(Date.now() / 1000));
    const sig = createHmac("sha256", "fixture-secret").update(`${t}.${raw}`).digest("hex");
    const send = (body: string) =>
      request(app)
        .post("/v1/webhooks/bachs")
        .set("Content-Type", "application/json")
        .set("X-Bachs-Signature-V2", `t=${t},v1=${sig}`)
        .send(body);
    expect((await send(raw)).status).toBe(202);
    expect((await send(raw)).status).toBe(202);
    expect((await send(raw + " ")).status).toBe(400);
  });
  it("expires unfunded reservations and enforces balanced append-only journals", async () => {
    // More held orders than the worker batch size must not starve eligible expirations.
    const heldPrefix = `HELD-${randomUUID()}`;
    await prisma.tradeOrder.createMany({
      data: Array.from({ length: 21 }, (_, index) => ({
        reference: `${heldPrefix}-${index}`,
        buyerId: buyer,
        farmerProfileId: farmer,
        listingId: listing,
        quantity: "1",
        totalMinor: 10000n,
        fundsProvider: "bachs",
        financialHold: true,
        reservationExpiresAt: new Date(0),
      })),
    });
    const { o } = await order();
    await prisma.tradeOrder.update({
      where: { id: o.id },
      data: { fundsProvider: "bachs", reservationExpiresAt: new Date(Date.now() - 1000) },
    });
    // No queued fixture operations should make provider calls in this expiry test.
    await prisma.moneyOperation.updateMany({
      where: { mode: "sandbox", status: "QUEUED" },
      data: { status: "BLOCKED" },
    });
    await prisma.paymentAttempt.updateMany({
      where: { mode: "sandbox", status: { in: ["OPEN", "EXCEPTION", "UNKNOWN"] } },
      data: { checkoutId: null },
    });
    await runPaymentJobs();
    expect((await prisma.tradeOrder.findUniqueOrThrow({ where: { id: o.id } })).status).toBe(
      "CANCELLED",
    );
    expect(
      await prisma.tradeOrder.count({
        where: {
          reference: { startsWith: heldPrefix },
          status: "AWAITING_PAYMENT",
          financialHold: true,
        },
      }),
    ).toBe(21);
    const ref = `test:${randomUUID()}`;
    await prisma.$transaction((tx) =>
      journal(tx, ref, [
        ["test_cash", 1n],
        ["test_liability", -1n],
      ]),
    );
    const entry = await prisma.moneyJournal.findUniqueOrThrow({ where: { reference: ref } });
    await expect(
      prisma.moneyJournal.update({ where: { id: entry.id }, data: { reference: "changed" } }),
    ).rejects.toThrow();
    await expect(
      prisma.$transaction((tx) =>
        tx.moneyJournal.create({
          data: {
            reference: randomUUID(),
            mode: "sandbox",
            lines: {
              create: [
                { account: "broken", amountMinor: 1n },
                { account: "other", amountMinor: 1n },
              ],
            },
          },
        }),
      ),
    ).rejects.toThrow();
  });
  it("exposes only owned masked bank verification results", async () => {
    const sellerToken = (
      await createSession({ subject: "CUSTOMER", principalId: seller, deviceId: randomUUID() })
    ).accessToken;
    const bank = await prisma.bankDestination.findUniqueOrThrow({ where: { id: destination } });
    const op = await prisma.moneyOperation.create({
      data: {
        ownerId: seller,
        mode: "sandbox",
        kind: "DESTINATION",
        status: "SUCCEEDED",
        mutationKey: randomUUID(),
        requestHash: "a".repeat(64),
        providerRef: bank.providerId,
        payload: {},
        encryptedPayload: "private-bank-input",
      },
    });
    const path = `/v1/financial/banks/operations/${op.id}`;
    expect(
      (
        await request(app)
          .get(path)
          .set({ Authorization: `Bearer ${outsider}` })
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .get(path)
          .set({ Authorization: `Bearer ${token}` })
      ).status,
    ).toBe(404);
    const result = await request(app)
      .get(path)
      .set({ Authorization: `Bearer ${sellerToken}` });
    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      status: "SUCCEEDED",
      destination: {
        id: bank.id,
        bankName: bank.bankName,
        accountName: bank.accountName,
        accountLastFour: bank.accountLastFour,
        usable: true,
      },
    });
    expect(JSON.stringify(result.body)).not.toContain("private-bank-input");
    await prisma.moneyOperation.update({ where: { id: op.id }, data: { kind: "PAYOUT" } });
    expect(
      (
        await request(app)
          .get(path)
          .set({ Authorization: `Bearer ${sellerToken}` })
      ).status,
    ).toBe(404);
  });
  it("verifies a bank through the existing provider operation without exposing its full number", async () => {
    const sellerToken = (
      await createSession({ subject: "CUSTOMER", principalId: seller, deviceId: randomUUID() })
    ).accessToken;
    vi.spyOn(bachs, "account").mockResolvedValue({
      id: `acct_${seller}`,
      parent_organization_id: "org_fixture",
      enabled_capabilities: ["transfers", "payouts"],
    });
    vi.spyOn(bachs, "banks").mockResolvedValue([{ code: "001", name: "Test bank" }]);
    vi.spyOn(bachs, "call").mockResolvedValue({
      id: `new_bank_${randomUUID()}`,
      currency: "NGN",
      account_name: "Example Farmer",
      account_number: "1234567891",
      bank_code: "001",
      is_usable: true,
    });
    const result = await request(app)
      .post("/v1/financial/banks")
      .set({ Authorization: `Bearer ${sellerToken}` })
      .send({ bankCode: "001", accountNumber: "1234567891" });
    expect(result.status).toBe(202);
    const saved = await request(app)
      .get(`/v1/financial/banks/operations/${result.body.id}`)
      .set({ Authorization: `Bearer ${sellerToken}` });
    expect(saved.status).toBe(200);
    expect(saved.body.status).toBe("SUCCEEDED");
    expect(saved.body.destination.accountName).toBe("Example Farmer");
    expect(saved.body.destination.bankName).toBe("Test bank");
    await prisma.bankDestination.updateMany({
      where: { userId: seller, accountLastFour: "7891" },
      data: { bankName: "Bank" },
    });
    const summary = await request(app)
      .get("/v1/financial")
      .set({ Authorization: `Bearer ${sellerToken}` });
    expect(summary.status).toBe(200);
    expect(
      summary.body.destinations.find((bank: any) => bank.accountLastFour === "7891").bankName,
    ).toBe("Test bank");
    expect(saved.body.destination.accountLastFour).toBe("7891");
    expect(JSON.stringify(saved.body)).not.toContain("1234567891");
    expect(
      (
        await request(app)
          .post("/v1/financial/banks")
          .set({ Authorization: `Bearer ${sellerToken}` })
          .send({ bankCode: "001", accountNumber: "123456789" })
      ).status,
    ).toBe(422);
  });
  it("resumes a ready payment account without creating another account or onboarding link", async () => {
    const sellerToken = (
      await createSession({ subject: "CUSTOMER", principalId: seller, deviceId: randomUUID() })
    ).accessToken;
    vi.spyOn(bachs, "account").mockResolvedValue({
      id: `acct_${seller}`,
      parent_organization_id: "org_fixture",
      enabled_capabilities: ["transfers", "payouts"],
    });
    const write = vi
      .spyOn(bachs, "call")
      .mockRejectedValue(new Error("Unexpected account creation"));
    const link = vi
      .spyOn(bachs, "accountLink")
      .mockRejectedValue(new Error("A ready account needs no link"));
    const resumed = await request(app)
      .post("/v1/financial/onboarding/link")
      .set({ Authorization: `Bearer ${sellerToken}` })
      .send({});
    expect(resumed.status).toBe(200);
    expect(resumed.body).toEqual({ ready: true, url: null });
    const setup = await request(app)
      .post("/v1/financial/onboarding")
      .set({ Authorization: `Bearer ${sellerToken}` })
      .send({
        firstName: "Test",
        lastName: "Farmer",
        email: "farmer@example.test",
        entityType: "individual",
        displayName: "Test Farm",
      });
    expect(setup.status).toBe(200);
    expect(setup.body).toEqual({ ready: true, url: null });
    expect(write).not.toHaveBeenCalled();
    expect(link).not.toHaveBeenCalled();
    expect(
      await prisma.financialAccount.count({ where: { userId: seller, mode: "sandbox" } }),
    ).toBe(1);
  });
  it.each(["destination", "quantity", "packing", "selected fee", "snapshot", "split plan"])(
    "blocks checkout reuse, hosted links and payment allocation after stale %s", async (changed) => {
      const fixture = await order(changed === "split plan" ? 2 : 1);
      const a = await checkout(fixture.o.id);
      if (changed === "destination")
        await prisma.delivery.update({ where: { id: fixture.d.id }, data: { destination: { ...(fixture.d.destination as object), address: "Changed destination road Lagos" } } });
      if (changed === "quantity")
        await prisma.tradeOrder.update({ where: { id: fixture.o.id }, data: { quantity: "2" } });
      if (changed === "packing")
        await prisma.delivery.update({ where: { id: fixture.d.id }, data: { package: { ...(fixture.d.package as object), weightKg: 0.1 } } });
      if (changed === "selected fee")
        await prisma.delivery.update({ where: { id: fixture.d.id }, data: { shippingMinor: 900n } });
      if (changed === "snapshot") {
        const snapshot = fixture.o.packagingSnapshot as any;
        await prisma.tradeOrder.update({ where: { id: fixture.o.id }, data: { packagingSnapshot: { ...snapshot, packaging: { ...snapshot.packaging, weightKg: 2 } } } });
      }
      if (changed === "split plan")
        await prisma.deliveryQuote.update({ where: { id: fixture.q.id }, data: { requestToken: "split:not-json" } });
      await expect(startCheckout(fixture.o.id, buyer)).rejects.toMatchObject({ code: "STALE_DELIVERY_QUOTE" });
      const read = await request(app).get(`/v1/orders/${fixture.o.id}/payments`).set(customerAuth());
      expect(read.body).toMatchObject({ checkoutReady: false, payableMinor: null, checkoutErrorCode: "STALE_DELIVERY_QUOTE" });
      expect(read.body.items[0].checkoutUrl).toBeNull();
      expect((await request(app).get(`/v1/financial/payments/${a.id}`).set(customerAuth())).body.checkoutUrl).toBeNull();
      mockReceipt(a);
      await reconcilePayment(a.id);
      expect(await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: a.id } })).toMatchObject({ status: "EXCEPTION", exceptionCode: "STALE_DELIVERY_QUOTE" });
      expect(await prisma.tradeOrder.findUniqueOrThrow({ where: { id: fixture.o.id } })).toMatchObject({ heldMinor: 0n, financialHold: true });
      expect(await prisma.escrowEntry.count({ where: { orderId: fixture.o.id, kind: "FUND" } })).toBe(0);
    },
  );
  it("invalidates the previous choice before a changed-address quotation fails", async () => {
    const { o, d, q } = await order();
    vi.mocked(shippingProvider.quotes).mockRejectedValue(new AppError(502, "QUOTES_UNAVAILABLE", "Provider unavailable"));
    const response = await request(app).post(`/v1/orders/${o.id}/delivery/quotes`).set(customerAuth()).send({
      pickup: d.pickup, destination: { ...(d.destination as object), address: "New buyer destination Lagos" }, parcel: d.package,
    });
    expect(response.status).toBe(502);
    expect(await prisma.delivery.findUniqueOrThrow({ where: { id: d.id } })).toMatchObject({
      status: "QUOTE_REQUIRED", selectedQuoteId: null, shippingMinor: 0n, failureCode: "QUOTES_UNAVAILABLE",
      destination: { address: "New buyer destination Lagos" },
    });
    expect((await request(app).post(`/v1/orders/${o.id}/delivery/select`).set(customerAuth()).send({ quoteId: q.id })).status).toBe(409);
    await expect(startCheckout(o.id, buyer)).rejects.toMatchObject({ code: "QUOTE_EXPIRED" });
  });
  it("keeps the latest quotation when provider responses arrive out of order", async () => {
    const { o, d, q } = await order();
    const entered = deferred<void>(), delayed = deferred<ReturnType<typeof rate>[]>();
    vi.mocked(shippingProvider.quotes)
      .mockImplementationOnce(async () => { entered.resolve(); return delayed.promise; })
      .mockResolvedValueOnce([{ ...rate(q, 1800n), requestToken: "latest-token" }]);
    const send = (address: string) => request(app).post(`/v1/orders/${o.id}/delivery/quotes`).set(customerAuth()).send({
      pickup: d.pickup, destination: { ...(d.destination as object), address }, parcel: d.package,
    });
    const first = send("First buyer destination Lagos").then((response) => response);
    await entered.promise;
    const second = await send("Latest buyer destination Lagos");
    delayed.resolve([{ ...rate(q), requestToken: "obsolete-token" }]);
    expect(second.status).toBe(200);
    expect((await first).status).toBe(409);
    expect(await prisma.delivery.findUniqueOrThrow({ where: { id: d.id } })).toMatchObject({ destination: { address: "Latest buyer destination Lagos" }, selectedQuoteId: null, shippingMinor: 0n });
    expect(await prisma.deliveryQuote.count({ where: { deliveryId: d.id, expiresAt: { gt: new Date() } } })).toBe(1);
    expect((await request(app).post(`/v1/orders/${o.id}/delivery/select`).set(customerAuth()).send({ quoteId: second.body.items[0].id })).status).toBe(200);
    expect((await startCheckout(o.id, buyer)).amountMinor).toBe(11800n);
  });
  it("rebuilds legacy buyer-entered measurements during refresh rather than reusing them", async () => {
    const { o, d, q } = await order();
    await prisma.deliveryQuote.update({ where: { id: q.id }, data: { inputHash: "legacy-request-hash" } });
    await prisma.delivery.update({ where: { id: d.id }, data: { package: { ...(d.package as object), weightKg: 0.1, length: 1, packageCount: 5 } } });
    vi.mocked(shippingProvider.quotes).mockResolvedValue([rate(q, 1600n)]);
    const response = await request(app).post(`/v1/orders/${o.id}/delivery/refresh-quote`).set(customerAuth()).send({});
    expect(response.status).toBe(200);
    expect(shippingProvider.quotes).toHaveBeenLastCalledWith(expect.objectContaining({ parcel: expect.objectContaining({ weightKg: 1.1, packageCount: 1, length: 20, width: 15, height: 10 }) }));
    expect(await prisma.delivery.findUniqueOrThrow({ where: { id: d.id } })).toMatchObject({ status: "PAYMENT_PENDING", shippingMinor: 1600n, package: { weightKg: 1.1, packageCount: 1 } });
    expect((await startCheckout(o.id, buyer)).amountMinor).toBe(11600n);
  });
  it.each(["oversized", "cold chain", "special handling", "missing packing"])("does not quote or initialize payment for %s", async (kind) => {
    const { o, d } = await order();
    const snapshot = o.packagingSnapshot as any;
    const packaging = kind === "missing packing" ? null : {
      ...snapshot.packaging,
      ...(kind === "oversized" ? { length: 250 } : {}),
      ...(kind === "cold chain" ? { handling: "COLD_CHAIN" } : {}),
      ...(kind === "special handling" ? { specialHandling: ["FRAGILE"] } : {}),
    };
    await prisma.tradeOrder.update({ where: { id: o.id }, data: { packagingSnapshot: { ...snapshot, packaging } } });
    const response = await request(app).post(`/v1/orders/${o.id}/delivery/quotes`).set(customerAuth()).send({ pickup: d.pickup, destination: d.destination, parcel: d.package });
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe(kind === "missing packing" ? "PACKING_REQUIRED" : kind === "oversized" ? "SHIPMENT_TOO_LARGE" : "SHIPMENT_HANDLING_UNSUPPORTED");
    expect(shippingProvider.quotes).not.toHaveBeenCalled();
    expect((await request(app).get(`/v1/orders/${o.id}/payments`).set(customerAuth())).body.checkoutReady).toBe(false);
    expect((await prisma.delivery.findUniqueOrThrow({ where: { id: d.id } })).status).not.toBe("MANUAL_REVIEW");
    expect(await prisma.paymentAttempt.count({ where: { orderId: o.id } })).toBe(0);
  });
  it("blocks stale shipment inputs before a queued hosted-checkout write", async () => {
    const { o, d } = await order();
    const a = await startCheckout(o.id, buyer);
    const op = await prisma.moneyOperation.findFirstOrThrow({ where: { paymentId: a.id, kind: "CHECKOUT" } });
    const write = vi.spyOn(bachs, "checkout");
    await prisma.delivery.update({ where: { id: d.id }, data: { package: { ...(d.package as object), weightKg: 0.1 } } });
    await runMoneyOperation(op.id);
    expect(write).not.toHaveBeenCalled();
    expect(await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: a.id } })).toMatchObject({ status: "BLOCKED", exceptionCode: "STALE_DELIVERY_QUOTE", checkoutUrl: null });
  });
  it("suppresses a hosted link when delivery changes during initialization", async () => {
    const { o, d } = await order();
    const a = await startCheckout(o.id, buyer);
    const op = await prisma.moneyOperation.findFirstOrThrow({ where: { paymentId: a.id, kind: "CHECKOUT" } });
    vi.spyOn(bachs, "checkout").mockImplementation(async () => {
      await prisma.delivery.update({ where: { id: d.id }, data: { shippingMinor: 900n } });
      return { checkout_id: `cs_${a.id}`, checkout_url: `https://checkout.bachs.io/${a.id}`, expires_at: a.expiresAt.toISOString() };
    });
    await runMoneyOperation(op.id);
    expect(await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: a.id } })).toMatchObject({ status: "BLOCKED", exceptionCode: "STALE_DELIVERY_QUOTE" });
    expect((await request(app).get(`/v1/orders/${o.id}/payments`).set(customerAuth())).body.items[0].checkoutUrl).toBeNull();
  });
  it("does not reopen checkout if a webhook confirms payment before initialization finishes", async () => {
    const { o } = await order();
    const a = await startCheckout(o.id, buyer);
    const op = await prisma.moneyOperation.findFirstOrThrow({ where: { paymentId: a.id, kind: "CHECKOUT" } });
    vi.spyOn(bachs, "checkout").mockImplementation(async () => {
      const checkoutId = `cs_${a.id}`;
      await prisma.paymentAttempt.update({ where: { id: a.id }, data: { checkoutId } });
      mockReceipt({ ...a, checkoutId });
      await reconcilePayment(a.id);
      return { checkout_id: checkoutId, checkout_url: `https://checkout.bachs.io/${a.id}`, expires_at: a.expiresAt.toISOString() };
    });
    await runMoneyOperation(op.id);
    expect((await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: a.id } })).status).toBe("SUCCEEDED");
    expect(await prisma.escrowEntry.count({ where: { orderId: o.id, kind: "FUND" } })).toBe(1);
  });
  it("rejects incomplete or inconsistent split prices before payment", async () => {
    for (const change of ["duplicate token", "wrong courier", "wrong total", "missing parcel"]) {
      const { o, d, q } = await order(3);
      const parts = splitParts(q.requestToken)!;
      if (change === "duplicate token") parts[1]!.requestToken = parts[0]!.requestToken;
      if (change === "wrong courier") parts[1]!.courierId = "other-courier";
      if (change === "wrong total") parts[1]!.amountMinor = "999";
      if (change === "missing parcel") parts.pop();
      await prisma.deliveryQuote.update({ where: { id: q.id }, data: { requestToken: `split:${JSON.stringify(parts)}` } });
      await expect(startCheckout(o.id, buyer)).rejects.toMatchObject({ code: "STALE_DELIVERY_QUOTE" });
      const detail = await request(app).get(`/v1/orders/${o.id}/delivery`).set(customerAuth());
      expect(detail.body.order.checkoutReady).toBe(false);
      expect(detail.body.delivery.quotes[0].available).toBe(false);
      expect(await prisma.paymentAttempt.count({ where: { orderId: o.id } })).toBe(0);
      expect((await prisma.delivery.findUniqueOrThrow({ where: { id: d.id } })).paidMinor).toBe(0n);
    }
  });
  it("finalizes completely recorded expired split bookings exactly once without purchasing labels", async () => {
    const fixture = await funded(2);
    await recordParcels(fixture, 2);
    await prisma.deliveryQuote.update({ where: { id: fixture.q.id }, data: { expiresAt: new Date(0) } });
    await runDeliveryJobs();
    await runDeliveryJobs();
    expect(shippingProvider.book).not.toHaveBeenCalled();
    expect(await prisma.delivery.findUniqueOrThrow({ where: { id: fixture.d.id } })).toMatchObject({ status: "BOOKED", failureCode: null });
    expect(await prisma.shipment.count({ where: { orderId: fixture.o.id } })).toBe(1);
    expect(await prisma.moneyJournal.count({ where: { orderId: fixture.o.id, reference: { startsWith: "shipping-cost:" } } })).toBe(1);
    expect((await prisma.tradeOrder.findUniqueOrThrow({ where: { id: fixture.o.id } })).financialHold).toBe(false);
  });
  it.each(["courier", "cost"])("holds split bookings with a parcel %s mismatch without repurchasing labels", async (changed) => {
    const fixture = await funded(2);
    let index = 0;
    vi.mocked(shippingProvider.book).mockImplementation(async () => {
      const parcelIndex = index++;
      return {
        id: `SB-review-${fixture.d.id}-${parcelIndex}`,
        status: "pending",
        courier: changed === "courier" && parcelIndex === 1 ? "Unexpected courier" : fixture.q.courier,
        shippingMinor: changed === "cost" ? parcelIndex === 0 ? 900n : 1100n : 1000n,
      };
    });
    await runDeliveryJobs();
    await runDeliveryJobs();
    expect(shippingProvider.book).toHaveBeenCalledTimes(2);
    expect(await prisma.delivery.findUniqueOrThrow({ where: { id: fixture.d.id } })).toMatchObject({ status: "BOOKED", failureCode: "SHIPPING_COST_REVIEW_REQUIRED" });
    expect((await prisma.tradeOrder.findUniqueOrThrow({ where: { id: fixture.o.id } })).financialHold).toBe(true);
    const parcels = await prisma.deliveryParcel.findMany({ where: { deliveryId: fixture.d.id }, orderBy: { parcelIndex: "asc" } });
    expect(parcels.every((parcel) => parcel.providerShipmentId && parcel.status === "BOOKED")).toBe(true);
    expect(parcels.reduce((sum, parcel) => sum + parcel.actualMinor!, 0n)).toBe(fixture.q.walletMinor);
    if (changed === "courier") expect(parcels[1]!.failureCode).toBe("SHIPMENT_MISMATCH");
    expect(await prisma.moneyJournal.count({ where: { orderId: fixture.o.id, reference: { startsWith: "shipping-cost:" } } })).toBe(1);
    await expect(requestRelease(fixture.o.id, req())).rejects.toMatchObject({ code: "RELEASE_BLOCKED" });
  });
  it("links the final expired split parcel idempotently and rejects shipment reuse across orders", async () => {
    const fixture = await funded(2), parcels = await recordParcels(fixture, 1);
    await prisma.deliveryQuote.update({ where: { id: fixture.q.id }, data: { expiresAt: new Date(0) } });
    const providerShipmentId = `SB-link-${randomUUID()}`;
    vi.mocked(shippingProvider.track).mockResolvedValue({
      id: providerShipmentId, status: "pending", courier: fixture.q.courier, shippingMinor: 1000n,
      pickupAddress: (fixture.d.pickup as any).address, destinationAddress: (fixture.d.destination as any).address,
    });
    const link = (orderId: string, parcelId: string) => request(app).post(`/v1/admin/delivery-orders/${orderId}/delivery/parcels/${parcelId}/link`).set(staffAuth()).send({ providerShipmentId, reason: "Verified original provider label and parcel route" });
    expect((await link(fixture.o.id, parcels[1]!.id)).status).toBe(200);
    expect((await link(fixture.o.id, parcels[1]!.id)).status).toBe(200);
    expect(shippingProvider.track).toHaveBeenCalledTimes(1);
    expect((await prisma.delivery.findUniqueOrThrow({ where: { id: fixture.d.id } })).status).toBe("BOOKED");
    expect(await prisma.moneyJournal.count({ where: { orderId: fixture.o.id, reference: { startsWith: "shipping-cost:" } } })).toBe(1);
    const other = await funded(2), otherParcels = await recordParcels(other, 0);
    const reused = await link(other.o.id, otherParcels[0]!.id);
    expect(reused.status).toBe(409);
    expect(reused.body.error.code).toBe("SHIPMENT_MISMATCH");
    expect((await prisma.deliveryParcel.findUniqueOrThrow({ where: { id: otherParcels[0]!.id } })).providerShipmentId).toBeNull();
  });
  it("accounts for an expired single-label staff recovery without replaying or charging twice", async () => {
    const fixture = await funded();
    await prisma.delivery.update({ where: { id: fixture.d.id }, data: { status: "BOOKING_UNCERTAIN", bookingStartedAt: new Date() } });
    await prisma.deliveryQuote.update({ where: { id: fixture.q.id }, data: { expiresAt: new Date(0) } });
    const providerShipmentId = `SB-single-${randomUUID()}`;
    vi.mocked(shippingProvider.track).mockResolvedValue({
      id: providerShipmentId, status: "pending", courier: fixture.q.courier, shippingMinor: 1000n,
      pickupAddress: (fixture.d.pickup as any).address, destinationAddress: (fixture.d.destination as any).address,
    });
    const link = () => request(app).post(`/v1/admin/delivery-orders/${fixture.o.id}/delivery/link`).set(staffAuth()).send({ providerShipmentId, reason: "Verified original booking rather than repeating purchase" });
    expect((await link()).status).toBe(200);
    expect((await link()).status).toBe(200);
    expect(shippingProvider.track).toHaveBeenCalledTimes(1);
    expect(await prisma.moneyJournal.count({ where: { orderId: fixture.o.id, reference: { startsWith: "shipping-cost:" } } })).toBe(1);
    expect(shippingProvider.book).not.toHaveBeenCalled();
  });
  it("rechecks financial holds between parcel purchases", async () => {
    const fixture = await funded(2);
    vi.mocked(shippingProvider.book).mockImplementation(async () => {
      await prisma.tradeOrder.update({ where: { id: fixture.o.id }, data: { financialHold: true } });
      return { id: `SB-held-${randomUUID()}`, status: "pending", courier: fixture.q.courier, shippingMinor: 1000n };
    });
    await runDeliveryJobs();
    await runDeliveryJobs();
    expect(shippingProvider.book).toHaveBeenCalledTimes(1);
    const parcels = await prisma.deliveryParcel.findMany({ where: { deliveryId: fixture.d.id }, orderBy: { parcelIndex: "asc" } });
    expect(parcels.map((parcel) => parcel.status)).toEqual(["BOOKED", "PENDING"]);
    expect((await prisma.delivery.findUniqueOrThrow({ where: { id: fixture.d.id } })).status).toBe("BOOKING_UNCERTAIN");
  });
  it("does not accept parent delivery or cancellation status for an incomplete split", async () => {
    const fixture = await funded(2), parcels = await recordParcels(fixture, 2);
    await prisma.deliveryParcel.update({ where: { id: parcels[0]!.id }, data: { status: "DELIVERED" } });
    await prisma.delivery.update({ where: { id: fixture.d.id }, data: { status: "DELIVERED" } });
    expect((await request(app).post(`/v1/orders/${fixture.o.id}/delivery/confirm`).set(customerAuth()).send({})).status).toBe(409);
    await prisma.tradeOrder.update({ where: { id: fixture.o.id }, data: { status: "DELIVERED", deliveryConfirmedAt: new Date() } });
    await expect(requestRelease(fixture.o.id, req())).rejects.toMatchObject({ code: "RELEASE_BLOCKED" });
    await prisma.delivery.update({ where: { id: fixture.d.id }, data: { status: "CANCELLED" } });
    const refund = req(); refund.body.shippingRefundMinor = "0";
    await expect(requestRefund(fixture.o.id, refund)).rejects.toMatchObject({ code: "DELIVERY_ACTIVE" });
  });
  it("cancels known labels of an uncertain split once without pretending every parcel was cancelled", async () => {
    const fixture = await funded(2), parcels = await recordParcels(fixture, 1);
    vi.mocked(shippingProvider.track).mockImplementation(async (id) => ({ id, status: "cancelled", courier: fixture.q.courier }));
    expect((await request(app).post(`/v1/admin/delivery-orders/${fixture.o.id}/delivery/cancel`).set(staffAuth()).send({ reason: "Cancel known labels while locating the uncertain parcel" })).status).toBe(202);
    await runDeliveryJobs();
    await prisma.delivery.update({ where: { id: fixture.d.id }, data: { nextSyncAt: new Date() } });
    await runDeliveryJobs();
    expect(shippingProvider.cancel).toHaveBeenCalledTimes(1);
    expect(shippingProvider.book).not.toHaveBeenCalled();
    expect((await prisma.deliveryParcel.findUniqueOrThrow({ where: { id: parcels[0]!.id } })).status).toBe("CANCELLED");
    expect((await prisma.delivery.findUniqueOrThrow({ where: { id: fixture.d.id } })).status).toBe("BOOKING_UNCERTAIN");
    const refund = req(); refund.body.shippingRefundMinor = "0";
    await expect(requestRefund(fixture.o.id, refund)).rejects.toMatchObject({ code: "DELIVERY_ACTIVE" });
  });
  it("continues split cancellation after a failed parcel read and reconciles without another cancellation write", async () => {
    const fixture = await funded(2), parcels = await recordParcels(fixture, 2);
    vi.mocked(shippingProvider.track).mockImplementation(async (id) => {
      if (id === parcels[0]!.providerShipmentId) throw new Error("Tracking response lost");
      return { id, status: "cancelled", courier: fixture.q.courier };
    });
    expect((await request(app).post(`/v1/admin/delivery-orders/${fixture.o.id}/delivery/cancel`).set(staffAuth()).send({ reason: "Cancel every recorded label despite a delayed tracking response" })).status).toBe(202);
    await runDeliveryJobs();
    expect(vi.mocked(shippingProvider.cancel).mock.calls.map(([id]) => id)).toEqual(parcels.map((parcel) => parcel.providerShipmentId));
    expect((await prisma.deliveryParcel.findUniqueOrThrow({ where: { id: parcels[1]!.id } })).status).toBe("CANCELLED");
    expect((await prisma.delivery.findUniqueOrThrow({ where: { id: fixture.d.id } })).status).not.toBe("CANCELLED");
    vi.mocked(shippingProvider.track).mockImplementation(async (id) => ({ id, status: "cancelled", courier: fixture.q.courier }));
    await prisma.delivery.update({ where: { id: fixture.d.id }, data: { nextSyncAt: new Date() } });
    await runDeliveryJobs();
    expect(shippingProvider.cancel).toHaveBeenCalledTimes(2);
    expect((await prisma.delivery.findUniqueOrThrow({ where: { id: fixture.d.id } })).status).toBe("CANCELLED");
  });
  it("keeps shipping cost review visible when ordinary tracking succeeds", async () => {
    const fixture = await funded();
    const providerShipmentId = `SB-cost-${randomUUID()}`;
    await prisma.delivery.update({ where: { id: fixture.d.id }, data: { status: "BOOKED", providerShipmentId, bookingStartedAt: new Date(), failureCode: "SHIPPING_COST_REVIEW_REQUIRED" } });
    await prisma.tradeOrder.update({ where: { id: fixture.o.id }, data: { financialHold: true } });
    await applyTracking(fixture.d.id, { id: providerShipmentId, status: "in_transit", courier: fixture.q.courier });
    expect((await prisma.delivery.findUniqueOrThrow({ where: { id: fixture.d.id } })).failureCode).toBe("SHIPPING_COST_REVIEW_REQUIRED");
    expect((await prisma.tradeOrder.findUniqueOrThrow({ where: { id: fixture.o.id } })).financialHold).toBe(true);
  });
  it("blocks refresh completion, checkout and booking after a refund starts", async () => {
    const fixture = await funded();
    await prisma.delivery.update({ where: { id: fixture.d.id }, data: { status: "BOOKING_BLOCKED" } });
    const entered = deferred<void>(), delayed = deferred<ReturnType<typeof rate>[]>();
    vi.mocked(shippingProvider.quotes).mockImplementation(async () => { entered.resolve(); return delayed.promise; });
    const refresh = request(app).post(`/v1/orders/${fixture.o.id}/delivery/refresh-quote`).set(customerAuth()).send({}).then((response) => response);
    await entered.promise;
    const refund = req(); refund.body.shippingRefundMinor = "1000";
    expect(await requestRefund(fixture.o.id, refund)).toHaveLength(1);
    delayed.resolve([rate(fixture.q, 1500n)]);
    const response = await refresh;
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("PAYMENT_LOCKED");
    expect((await request(app).post(`/v1/orders/${fixture.o.id}/delivery/book`).set(customerAuth()).send({})).status).toBe(409);
    await prisma.delivery.update({ where: { id: fixture.d.id }, data: { status: "TOPUP_REQUIRED", shippingMinor: 1500n } });
    await expect(startCheckout(fixture.o.id, buyer, "DELIVERY_TOPUP")).rejects.toMatchObject({ code: "PAYMENT_LOCKED" });
    expect((await request(app).get(`/v1/orders/${fixture.o.id}/payments`).set(customerAuth())).body.checkoutReady).toBe(false);
  });
  it("rechecks delivery immediately before a refund write", async () => {
    const fixture = await funded();
    await prisma.delivery.update({ where: { id: fixture.d.id }, data: { status: "BOOKING_BLOCKED" } });
    const refund = req(); refund.body.shippingRefundMinor = "1000";
    const op = (await requestRefund(fixture.o.id, refund))[0]!;
    await prisma.delivery.update({ where: { id: fixture.d.id }, data: { bookingStartedAt: new Date(), status: "BOOKING_BLOCKED" } });
    vi.mocked(bachs.payment).mockResolvedValue({ payment_id: `ch_${fixture.a.id}`, checkout_id: fixture.a.checkoutId, currency: "NGN", is_refundable: true });
    vi.spyOn(bachs, "balances").mockResolvedValue([{ currency: "NGN", available_balance: "10000.00" }]);
    await runMoneyOperation(op.id);
    expect(bachs.call).not.toHaveBeenCalled();
    expect(await prisma.moneyOperation.findUniqueOrThrow({ where: { id: op.id } })).toMatchObject({ status: "BLOCKED", failureCode: "DELIVERY_ACTIVE" });
    expect((await prisma.tradeOrder.findUniqueOrThrow({ where: { id: fixture.o.id } })).refundedMinor).toBe(0n);
  });
  it("keeps mixed products and sellers on separate packing, pickup, quotation and payment contexts", async () => {
    const source = await prisma.listing.findUniqueOrThrow({ where: { id: listing } });
    const otherUser = await prisma.user.create({ data: {
      phoneE164: `+2346${Date.now().toString().slice(-9)}`, capabilities: { create: { capability: "SELLER" } },
      profile: { create: { fullName: "Oil farmer", email: "oil@example.test" } },
    } });
    const otherFarmer = await prisma.farmerProfile.create({ data: { userId: otherUser.id, farmName: "Oil farm", farmType: "CROP", verificationStatus: "APPROVED" } });
    const otherAddress = await prisma.address.create({ data: { userId: otherUser.id, state: "Lagos", city: "Lagos", lga: "Epe", line1: "50 Oil Farm Road" } });
    const oilCategory = await prisma.category.create({ data: { slug: `oils-${randomUUID()}` } });
    await prisma.unit.upsert({ where: { code: "CONTAINER" }, create: { code: "CONTAINER", name: "Container", allowsDecimal: false }, update: {} });
    const oil = await prisma.listing.create({ data: {
      farmerProfileId: otherFarmer.id, categoryId: oilCategory.id, locationAddressId: otherAddress.id,
      unitCode: "CONTAINER", title: "Palm oil", unitPriceMinor: 25000n, availableQuantity: "10", status: "ACTIVE", shippingScope: "NATIONWIDE",
      salePackaging: { type: "CONTAINER", size: 20, measure: "LITRE" },
      packaging: { unitsPerPackage: 1, weightKg: 22, length: 40, width: 30, height: 50, handling: "STANDARD", notes: "Sealed container" },
    } });
    await prisma.financialAccount.create({ data: { userId: otherUser.id, mode: "sandbox", providerAccountId: `acct_${otherUser.id}`, status: "READY", capabilities: ["transfers", "payouts"] } });
    await prisma.bankDestination.create({ data: { userId: otherUser.id, mode: "sandbox", providerId: `bank_${otherUser.id}`, bankCode: "001", bankName: "Test bank", accountName: "Oil farmer", accountLastFour: "7890", fingerprint: randomUUID(), usable: true } });
    const prior = getConfig().DELIVERY_ALLOWED_CATEGORIES;
    getConfig().DELIVERY_ALLOWED_CATEGORIES = `${source.categoryId},${oilCategory.id}`;
    try {
      const items = [{ listingId: listing, quantity: "2", unitPriceMinor: source.unitPriceMinor.toString() }, { listingId: oil.id, quantity: "1", unitPriceMinor: "25000" }];
      for (const { listingId, ...item } of items)
        expect((await request(app).put(`/v1/shopping/cart/${listingId}`).set(customerAuth()).send(item)).status).toBe(200);
      const cart = await request(app).post("/v1/shopping/cart/checkout").set(customerAuth()).set("Idempotency-Key", randomUUID()).send({ items });
      expect(cart.status).toBe(201);
      expect(cart.body.orders).toHaveLength(2);
      const orders = await prisma.tradeOrder.findMany({ where: { id: { in: cart.body.orders.map((item: any) => item.id) } }, orderBy: { totalMinor: "asc" } });
      expect(new Set(orders.map((item) => item.farmerProfileId)).size).toBe(2);
      vi.mocked(shippingProvider.quotes).mockImplementation(async (input) => {
        const count = input.parcel.packageCount ?? 1;
        const services = Array.from({ length: count }, (_, index) => [{
          requestToken: `mixed-${input.name}-${index}`, serviceCode: "pickup", courierId: "courier", courier: "Fixture courier", amountMinor: 1000n, walletMinor: 1000n,
        }]);
        return count === 1 ? services[0]! : combineParcelRates(services);
      });
      const attempts = [];
      for (const item of orders) {
        const detail = await request(app).get(`/v1/orders/${item.id}/delivery`).set(customerAuth());
        const isOil = item.listingId === oil.id;
        expect(detail.body.order.packageSuggestion).toMatchObject({ weightKg: isOil ? 22 : 2.2, packageCount: isOil ? 1 : 2 });
        expect(detail.body.order.suggestedPickup.address).toContain(isOil ? "50 Oil Farm Road" : "12 Test road");
        const quotes = await request(app).post(`/v1/orders/${item.id}/delivery/quotes`).set(customerAuth()).send({
          pickup: detail.body.order.suggestedPickup,
          destination: { name: "Buyer", phone: "+2348012345678", email: "buyer@example.test", address: "20 Buyer Street Lagos", state: "Lagos", country: "NG" },
          parcel: { pickupDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10) },
        });
        expect(quotes.status).toBe(200);
        expect((await request(app).post(`/v1/orders/${item.id}/delivery/select`).set(customerAuth()).send({ quoteId: quotes.body.items[0].id })).status).toBe(200);
        attempts.push(await startCheckout(item.id, buyer));
      }
      expect(attempts.map((item) => item.amountMinor)).toEqual([22000n, 26000n]);
      expect(new Set(attempts.map((item) => item.quoteId)).size).toBe(2);
    } finally {
      getConfig().DELIVERY_ALLOWED_CATEGORIES = prior;
    }
  });
  it("creates a 50 kg bag listing, checks out two bags, pays the full split fee and confirms all parcels", async () => {
    const { shippingProvider, runDeliveryJobs } = await import("../services/delivery.js");
    const { combineParcelRates } = await import("../providers/shipping/shipbubble.js");
    const category = await prisma.category.upsert({
      where: { slug: "grains" },
      create: { slug: "grains" },
      update: { isActive: true },
    });
    await prisma.unit.upsert({
      where: { code: "BAG" },
      create: { code: "BAG", name: "Bag", allowsDecimal: false },
      update: {},
    });
    const address = await prisma.address.findFirstOrThrow({ where: { userId: seller } });
    const sellerToken = (
      await createSession({ subject: "CUSTOMER", principalId: seller, deviceId: randomUUID() })
    ).accessToken;
    const sellerAuth = { Authorization: `Bearer ${sellerToken}` },
      buyerAuth = { Authorization: `Bearer ${token}` };
    const photo = await prisma.producePhoto.create({
      data: {
        userId: seller,
        mimeType: "image/jpeg",
        checksum: "b".repeat(64),
        storageKey: `test/${randomUUID()}`,
      },
    });
    const packaging = {
      unitsPerPackage: 1,
      weightKg: 50.5,
      length: 80,
      width: 50,
      height: 25,
      handling: "STANDARD",
      notes: "Keep dry",
    };
    const draft = await request(app)
      .post("/v1/listing-drafts")
      .set(sellerAuth)
      .send({
        title: "Rice",
        description: "Dry rice in 50 kg bags",
        sourceLocale: "en",
        categoryId: category.id,
        unitCode: "BAG",
        quantity: "10",
        unitPriceMinor: "500000",
        addressId: address.id,
        salePackaging: { type: "BAG", size: 50, measure: "KG" },
        packaging,
        photoIds: [photo.id],
      });
    expect(draft.status).toBe(201);
    const submitted = await request(app)
      .post(`/v1/listing-drafts/${draft.body.id}/submit`)
      .set(sellerAuth)
      .send({ confirmed: true });
    expect(submitted.status).toBe(201);
    const listingId = submitted.body.listing.id;
    // Moderation decision is a fixture; all seller and buyer actions use the real routes.
    await prisma.listing.update({ where: { id: listingId }, data: { status: "ACTIVE" } });
    expect(
      (
        await request(app)
          .put(`/v1/shopping/cart/${listingId}`)
          .set(buyerAuth)
          .send({ quantity: "2", unitPriceMinor: "500000" })
      ).status,
    ).toBe(200);
    const cart = await request(app)
      .post("/v1/shopping/cart/checkout")
      .set(buyerAuth)
      .set("Idempotency-Key", randomUUID())
      .send({ items: [{ listingId, quantity: "2", unitPriceMinor: "500000" }] });
    expect(cart.status).toBe(201);
    const orderId = cart.body.orders[0].id;
    expect(
      (
        await request(app)
          .patch(`/v1/marketplace/my-listings/${listingId}/packaging`)
          .set(sellerAuth)
          .send({ packaging: { ...packaging, weightKg: 51 } })
      ).status,
    ).toBe(200);
    const detail = await request(app).get(`/v1/orders/${orderId}/delivery`).set(buyerAuth);
    expect(detail.body.order.packageSuggestion).toMatchObject({
      packageCount: 2,
      weightKg: 101,
      volumeM3: 0.2,
    });
    Object.assign(getConfig(), {
      DELIVERY_ENABLED: true,
      SHIPBUBBLE_API_KEY: "fixture",
      SHIPBUBBLE_TEST_KEY_CONFIRMED: true,
      SHIPBUBBLE_MODE: "test",
      SHIPBUBBLE_CATEGORY_ID: 24032950,
      DELIVERY_ALLOWED_CATEGORIES: category.id,
      DELIVERY_MAX_WEIGHT_KG: 1000,
    });
    const service = (requestToken: string, amountMinor: bigint) => ({
      requestToken,
      amountMinor,
      walletMinor: amountMinor,
      courierId: "van-service",
      serviceCode: "van-service",
      courier: "Test courier",
      eta: "1 day",
    });
    const firstToken = `part-a-${randomUUID()}`, secondToken = `part-b-${randomUUID()}`;
    const quoteCall = vi
      .spyOn(shippingProvider, "quotes")
      .mockResolvedValue(
        combineParcelRates([[service(firstToken, 1200n)], [service(secondToken, 1800n)]]),
      );
    const contact = {
      name: "Customer",
      phone: "+2348012345678",
      email: "fixture@example.test",
      address: "12 Test road Lagos",
      state: "Lagos",
      country: "NG",
    };
    const quotes = await request(app)
      .post(`/v1/orders/${orderId}/delivery/quotes`)
      .set(buyerAuth)
      .send({
        pickup: { ...detail.body.order.suggestedPickup, email: contact.email },
        destination: contact,
        parcel: {
          weightKg: 1,
          packageCount: 1,
          length: 1,
          width: 1,
          height: 1,
          handling: "STANDARD",
          pickupDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        },
      });
    expect(quotes.status).toBe(200);
    expect(quoteCall).toHaveBeenLastCalledWith(
      expect.objectContaining({
        parcel: expect.objectContaining({
          weightKg: 101,
          packageCount: 2,
          length: 80,
          width: 50,
          height: 25,
        }),
      }),
    );
    expect(quotes.body.items[0].amountMinor).toBe("3000");
    expect(JSON.stringify(quotes.body)).not.toContain("part-a");
    expect(
      (
        await request(app)
          .post(`/v1/orders/${orderId}/delivery/select`)
          .set(buyerAuth)
          .send({ quoteId: quotes.body.items[0].id })
      ).status,
    ).toBe(200);
    await prisma.bankDestination.update({ where: { id: destination }, data: { usable: true } });
    const write = vi
      .spyOn(bachs, "checkout")
      .mockImplementation(async ({ id }) => ({
        checkout_id: `cs_${id}`,
        checkout_url: `https://sandbox-checkout.bachs.io/c/${id}`,
        expires_at: new Date(Date.now() + 600000).toISOString(),
      }));
    const checkoutResult = await request(app)
      .post(`/v1/orders/${orderId}/checkout`)
      .set(buyerAuth)
      .send({});
    expect(checkoutResult.status).toBe(200);
    expect(checkoutResult.body.amountMinor).toBe("1003000");
    expect(write).toHaveBeenCalledWith(expect.objectContaining({ amountMinor: 1003000n }));
    const payment = await prisma.paymentAttempt.findUniqueOrThrow({
      where: { id: checkoutResult.body.id },
    });
    mockReceipt(payment, { amount: "10030.00", amount_paid: "10031.00" });
    await reconcilePayment(payment.id);
    await reconcilePayment(payment.id);
    expect(await prisma.escrowEntry.count({ where: { orderId, kind: "FUND" } })).toBe(1);
    vi.spyOn(shippingProvider, "wallet").mockResolvedValue(100000n);
    const book = vi
      .spyOn(shippingProvider, "book")
      .mockImplementation(async (part) => ({
        id: `SB-${part.requestToken}`,
        status: "pending",
        courier: "Test courier",
        shippingMinor: part.requestToken === firstToken ? 1200n : 1800n,
      }));
    await runDeliveryJobs();
    expect(book).toHaveBeenCalledTimes(2);
    const delivery = await prisma.delivery.findUniqueOrThrow({
      where: { orderId },
      include: { parcels: true },
    });
    expect(delivery.status).toBe("BOOKED");
    expect(delivery.parcels).toHaveLength(2);
    expect(delivery.paidMinor).toBe(3000n);
    expect(
      (await prisma.tradeOrder.findUniqueOrThrow({ where: { id: orderId } })).financialHold,
    ).toBe(false);
    await prisma.delivery.update({
      where: { id: delivery.id },
      data: { status: "BOOKING_UNCERTAIN" },
    });
    await runDeliveryJobs();
    expect(book).toHaveBeenCalledTimes(2);
    expect((await prisma.delivery.findUniqueOrThrow({ where: { id: delivery.id } })).status).toBe(
      "BOOKED",
    );
    const { trackSplitDelivery } = await import("../services/split-delivery.js");
    const { applyTracking } = await import("../services/delivery.js");
    vi.spyOn(shippingProvider, "track").mockImplementation(async (id) => ({
      id,
      status: "delivered",
      courier: "Test courier",
    }));
    await applyTracking(delivery.id, await trackSplitDelivery(shippingProvider, delivery.id));
    expect(
      (await request(app).post(`/v1/orders/${orderId}/delivery/confirm`).set(buyerAuth).send({}))
        .status,
    ).toBe(200);
    expect((await prisma.tradeOrder.findUniqueOrThrow({ where: { id: orderId } })).status).toBe(
      "DELIVERED",
    );
  });
});
