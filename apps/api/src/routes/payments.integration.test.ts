import { approveRecovery, confirmRecoveryFarmer, quoteRecovery, acceptRecovery } from "../services/payment-recovery.js";
import { processDeadline, scanFulfillmentDeadlines } from "../services/recovery-worker.js";
import { logisticsFinance, verifyFunding } from "../services/logistics-finance.js";
import { assertFulfillmentOpen, refundDeadline } from "../services/fulfillment-deadline.js";
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
import { runMoneyOperation, runPaymentJobs, reconcileUncertainRefunds } from "../services/payment-worker.js";
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
    for (const code of ["orders.read", "orders.manage", "payments.manage", "payments.read"]) {
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
    Object.assign(getConfig(), { PAYMENTS_TRANSFERS_ENABLED: true, PAYMENT_RECOVERY_ENABLED: false, PAYMENT_AUTO_REFUNDS_ENABLED: false, SHIPPING_FUNDING_ENABLED: false });
    vi.spyOn(bachs, "assertNgnSettlement").mockResolvedValue();
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
  async function checkout(orderId: string, kind = "ORDER") {
    const a = await startCheckout(orderId, buyer, kind);
    const op = await prisma.moneyOperation.findFirstOrThrow({
      where: { paymentId: a.id, kind: "CHECKOUT" },
    });
    vi.spyOn(bachs, "checkout").mockResolvedValue({
      checkout_id: `cs_${a.id}`,
      checkout_url: `https://checkout.bachs.io/${a.id}`,
      expires_at: new Date(Date.now() + 600000).toISOString(),
    });
    vi.spyOn(bachs, "checkoutState").mockResolvedValue({ checkout_id: `cs_${a.id}`, reference: a.id, currency: "NGN", billing_currency: "NGN", status: "open" });
    await runMoneyOperation(op.id);
    return prisma.paymentAttempt.findUniqueOrThrow({ where: { id: a.id } });
  }
  function mockReceipt(a: any, overrides: any = {}) {
    vi.spyOn(bachs, "checkoutState").mockResolvedValue({
      currency: "NGN", billing_currency: "NGN",
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
    expect((await prisma.delivery.findUniqueOrThrow({ where: { id: d.id } })).status).toBe("PICKUP_PREPARING");
    const readyPath = `/v1/orders/${o.id}/delivery/ready`;
    expect((await request(app).post(readyPath).set("Authorization", `Bearer ${token}`).send({})).status).toBe(403);
    expect((await request(app).post(`/v1/orders/${o.id}/delivery/confirm`).set("Authorization", `Bearer ${token}`).send({})).status).toBe(409);
    const sellerToken = (await createSession({ subject: "CUSTOMER", principalId: seller, deviceId: randomUUID() })).accessToken;
    for (let repeat = 0; repeat < 2; repeat++)
      expect((await request(app).post(readyPath).set("Authorization", `Bearer ${sellerToken}`).send({})).status).toBe(200);
    expect(await prisma.deliveryEvent.count({ where: { deliveryId: d.id, status: "READY_FOR_PICKUP" } })).toBe(1);
    expect(await prisma.deliveryNotification.count({ where: { event: { deliveryId: d.id, status: "READY_FOR_PICKUP" } } })).toBe(2);
    expect((await prisma.delivery.findUniqueOrThrow({ where: { id: d.id } })).status).toBe("PICKUP_READY");
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
  it("records farmer readiness without replacing courier tracking or paid status", async () => {
    const { o, d } = await order();
    const sellerToken = (await createSession({ subject: "CUSTOMER", principalId: seller, deviceId: randomUUID() })).accessToken;
    const path = `/v1/orders/${o.id}/delivery/ready`;
    const auth = { Authorization: `Bearer ${sellerToken}` };
    // An unpaid order is neither visible nor actionable for the farmer.
    expect((await request(app).post(path).set(auth).send({})).status).toBe(404);
    const a = await checkout(o.id);
    mockReceipt(a);
    await reconcilePayment(a.id);
    await prisma.delivery.update({ where: { id: d.id }, data: { status: "BOOKED", providerShipmentId: `fixture-${d.id}` } });
    for (let duplicate = 0; duplicate < 2; duplicate++)
      expect((await request(app).post(path).set(auth).send({})).status).toBe(200);
    expect((await prisma.delivery.findUniqueOrThrow({ where: { id: d.id } })).status).toBe("BOOKED");
    expect((await prisma.tradeOrder.findUniqueOrThrow({ where: { id: o.id } })).status).toBe("FUNDED");
    expect(await prisma.deliveryEvent.count({ where: { deliveryId: d.id, status: "READY_FOR_PICKUP" } })).toBe(1);
    await prisma.delivery.update({ where: { id: d.id }, data: { status: "IN_TRANSIT" } });
    expect((await request(app).post(path).set(auth).send({})).status).toBe(200);
    expect((await prisma.delivery.findUniqueOrThrow({ where: { id: d.id } })).status).toBe("IN_TRANSIT");
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
    vi.spyOn(bachs, "checkoutState").mockImplementation(async id => ({ checkout_id:id, reference:id.slice(3), currency:"NGN", billing_currency:"NGN", status:"open" }));
    const first = await request(app).post(`/v1/orders/${o.id}/checkout`).set(auth).send({});
    expect(first.status).toBe(200);
    expect(first.body.amountMinor).toBe("705000");
    const again = await request(app).post(`/v1/orders/${o.id}/checkout`).set(auth).send({});
    expect(again.body.id).toBe(first.body.id);
    expect(write).toHaveBeenCalledTimes(1);
    const attempt = await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: first.body.id } });
    vi.spyOn(bachs, "checkoutState").mockResolvedValue({
      currency: "NGN", billing_currency: "NGN",
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
      currency: "NGN", billing_currency: "NGN",
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
      currency: "NGN", billing_currency: "NGN",
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
    expect(await prisma.deliveryEvent.count({where:{deliveryId:d.id,status:"PAYMENT_REFUNDED"}})).toBe(1);
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
      currency: "NGN", billing_currency: "NGN",
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
    vi.spyOn(bachs, "checkoutState").mockImplementation(async id => ({ checkout_id:id, reference:id.slice(3), currency:"NGN", billing_currency:"NGN", status:"open" }));
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
    const farmerToken = (await createSession({ subject: "CUSTOMER", principalId: seller, deviceId: randomUUID() })).accessToken;
    const farmerAuth = { Authorization: `Bearer ${farmerToken}` };
    expect((await request(app).post(`/v1/orders/${orderId}/delivery/decision`).set(farmerAuth).send({ accept: true })).status).toBe(200);
    expect((await request(app).post(`/v1/orders/${orderId}/delivery/ready`).set(farmerAuth).send({})).status).toBe(200);
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
    vi.spyOn(mediaStorage, "storeMedia").mockResolvedValue(`receipt/${randomUUID()}`);
    expect((await request(app).post(`/v1/orders/${orderId}/delivery/receipt-photo`).set(buyerAuth).set("Content-Type", "image/jpeg").send(Buffer.from([255,216,255,...Array(20).fill(0)]))).status).toBe(201);
    expect(
      (await request(app).post(`/v1/orders/${orderId}/delivery/confirm`).set(buyerAuth).send({ acknowledged: true }))
        .status,
    ).toBe(200);
    expect((await prisma.tradeOrder.findUniqueOrThrow({ where: { id: orderId } })).status).toBe(
      "DELIVERED",
    );
  });
  const staffReq = () => ({ ...systemRequest(), auth: { sub: verifyAccessToken(staff,"admin").sub, subject:"admin" }, body: { reason:"Reviewed recovery integration evidence" } }) as any;
  const buyerReq = () => ({ ...systemRequest(), auth: { sub: buyer, subject:"customer" } }) as any;
  async function recoverable() {
    Object.assign(getConfig(), { PAYMENT_RECOVERY_ENABLED:true, PAYMENT_AUTO_REFUNDS_ENABLED:true, SHIPPING_FUNDING_ENABLED:true });
    getConfig().DELIVERY_ALLOWED_CATEGORIES = (await prisma.listing.findUniqueOrThrow({where:{id:listing}})).categoryId;
    const fixture=await order();const a=await checkout(fixture.o.id);
    await prisma.tradeOrder.update({where:{id:fixture.o.id},data:{status:"CANCELLED"}});
    mockReceipt(a);await reconcilePayment(a.id);
    const r=await prisma.paymentRecovery.findUniqueOrThrow({where:{paymentId:a.id}});
    return {...fixture,a,r};
  }
  async function preparedRecovery(price=1000n) {
    const f=await recoverable();
    await confirmRecoveryFarmer(f.r.id,{pickupDate:new Date(Date.now()+86400000).toISOString().slice(0,10),preparationMinutes:30,notes:"Farmer confirmed stock on phone",phoneConfirmation:true},staffReq());
    vi.spyOn(shippingProvider,"quotes").mockResolvedValue([{requestToken:`recovery-${f.o.id}`,serviceCode:"pickup",courierId:"courier",courier:"Fixture courier",amountMinor:price,walletMinor:price}]);
    const proposal=await quoteRecovery(f.r.id,staffReq());const snapshot=proposal.snapshot as any;
    await acceptRecovery(f.r.id,proposal.version,snapshot.options[0].id,true,buyerReq());
    return {...f,proposal};
  }
  it("restores an exception receipt once after farmer and buyer consent and secures booking",async()=>{
    const f=await preparedRecovery();const key=randomUUID();
    await Promise.all([approveRecovery(f.r.id,f.proposal.version,key,staffReq()),approveRecovery(f.r.id,f.proposal.version,key,staffReq())]);
    expect(await prisma.escrowEntry.count({where:{orderId:f.o.id,kind:"FUND"}})).toBe(1);
    expect(await prisma.paidOrderNotification.count({where:{orderId:f.o.id}})).toBe(1);
    expect((await prisma.paymentAttempt.findUniqueOrThrow({where:{id:f.a.id}})).quoteId).toBe(f.a.quoteId);
    vi.spyOn(shippingProvider,"book").mockImplementation(async()=>({id:`book-${f.o.id}`,status:"pending",courier:"Fixture courier",shippingMinor:1000n}));
    await runDeliveryJobs();
    expect((await prisma.fulfillmentDeadline.findUniqueOrThrow({where:{orderId:f.o.id}})).state).toBe("SECURED");
    expect((await prisma.paymentRecovery.findUniqueOrThrow({where:{id:f.r.id}})).state).toBe("FULFILLMENT_STARTED");
  });
  it("keeps higher quotes awaiting verified top-up and lower quotes as refundable surplus",async()=>{
    const higher=await preparedRecovery(1500n);await approveRecovery(higher.r.id,higher.proposal.version,randomUUID(),staffReq());
    expect((await prisma.delivery.findUniqueOrThrow({where:{id:higher.d.id}})).status).toBe("TOPUP_REQUIRED");
    expect((await prisma.paymentAttempt.findUniqueOrThrow({where:{id:higher.a.id}})).shippingMinor).toBe(1000n);
    const lower=await preparedRecovery(800n);await approveRecovery(lower.r.id,lower.proposal.version,randomUUID(),staffReq());
    const finance=await logisticsFinance(lower.o.id);
    expect(finance.shipments[0]!.refundableShippingSurplusMinor).toBe(200n);
    expect(finance.summary.earnedCommissionMinor).toBe(0n);
  });
  it("invalidates old buyer consent when a proposal is requoted",async()=>{
    const f=await preparedRecovery();await quoteRecovery(f.r.id,staffReq());
    await expect(approveRecovery(f.r.id,f.proposal.version,randomUUID(),staffReq())).rejects.toThrow();
    expect(await prisma.escrowEntry.count({where:{orderId:f.o.id,kind:"FUND"}})).toBe(0);
  });
  it("returns an unattended verified payment through one durable refund operation",async()=>{
    const f=await recoverable();
    const due=new Date(Date.now()-1000);await prisma.fulfillmentDeadline.update({where:{orderId:f.o.id},data:{confirmedAt:new Date(due.getTime()-7200000),refundDueAt:due}});
    await Promise.all([processDeadline(f.o.id),processDeadline(f.o.id)]);
    const ops=await prisma.moneyOperation.findMany({where:{paymentId:f.a.id,kind:"REFUND"}});expect(ops).toHaveLength(1);expect(ops[0]!.amountMinor).toBe(11000n);
    await expect(prisma.$transaction(tx=>assertFulfillmentOpen(tx,f.o.id))).rejects.toThrow();
    vi.spyOn(bachs,"balances").mockResolvedValue({balances:[{currency:"NGN",available_balance:"100000.00"}]});
    vi.spyOn(bachs,"payment").mockResolvedValue({payment_id:`ch_${f.a.id}`,checkout_id:f.a.checkoutId,currency:"NGN",is_refundable:true});
    vi.spyOn(bachs,"call").mockImplementation(async(path,body:any)=>{
      if(path!=="/refunds")throw Error("Unexpected external call");
      expect(body.amount).toBe("110.00");expect(body.fee_bearer).toBe("org");expect(body.idempotency_key).toBe(ops[0]!.id);
      return {refund_id:`refund-${f.a.id}`,charge_id:`ch_${f.a.id}`,reference:body.reference,status:"success",requested_amount:body.amount};
    });
    await runMoneyOperation(ops[0]!.id);await processDeadline(f.o.id);
    expect((await prisma.fulfillmentDeadline.findUniqueOrThrow({where:{orderId:f.o.id}})).state).toBe("REFUNDED");
    expect((await prisma.paymentAttempt.findUniqueOrThrow({where:{id:f.a.id}})).status).toBe("REFUNDED");
  });
  it("returns the full automatic bank-refund principal and expenses the payout fee", async () => {
    const f = await recoverable();
    Object.assign(getConfig(), { BACHS_BANK_REFUNDS_VERIFIED: true, BACHS_NGN_PAYOUT_FEE_MINOR: "100" });
    await prisma.paymentAttempt.update({ where: { id: f.a.id }, data: { method: "NGN_BANK_TRANSFER" } });
    const account = await prisma.financialAccount.upsert({ where: { userId_mode: { userId: buyer, mode: "sandbox" } }, create: { userId: buyer, mode: "sandbox", providerAccountId: `acct_${buyer}`, status: "READY", capabilities: ["transfers", "payouts"] }, update: {} });
    const bank = await prisma.bankDestination.create({ data: { userId: buyer, mode: "sandbox", providerId: `bank_${randomUUID()}`, bankCode: "001", bankName: "Test bank", accountName: "Buyer", accountLastFour: "7890", fingerprint: randomUUID(), usable: true } });
    await prisma.fulfillmentDeadline.update({ where: { orderId: f.o.id }, data: { refundDueAt: new Date(Date.now() - 1) } });
    await processDeadline(f.o.id);
    const op = await prisma.moneyOperation.findFirstOrThrow({ where: { paymentId: f.a.id, kind: "REFUND_TRANSFER" } });
    expect((await logisticsFinance(f.o.id)).summary.refundProcessingMinor).toBe(11000n);
    vi.spyOn(bachs, "account").mockResolvedValue({ id: account.providerAccountId, parent_organization_id: "org_fixture", enabled_capabilities: ["transfers", "payouts"] });
    vi.spyOn(bachs, "balances").mockResolvedValue([{ currency: "NGN", available_balance: "100000.00" }]);
    vi.spyOn(bachs, "payment").mockResolvedValue({ payment_id: `ch_${f.a.id}`, checkout_id: f.a.checkoutId, currency: "NGN", payment_method_details: { bank_transfer: { sender_account_number: "1234567890", sender_bank_code: "001" } } });
    vi.spyOn(bachs, "destination").mockResolvedValue({ id: bank.providerId, currency: "NGN", is_usable: true, account_number: "1234567890", bank_code: "001" });
    vi.spyOn(bachs, "call").mockImplementation(async (path, body: any) => {
      if (path === "/transfers") {
        expect(body.amount).toBe("111.00");
        return { id: `tr_${op.id}`, status: "paid", currency: "NGN", amount: body.amount, destination: account.providerAccountId };
      }
      if (path === "/payouts") {
        expect(body.amount).toBe("110.00");
        return { id: `po_${op.id}`, status: "completed", currency: "NGN", amount: body.amount, fee: "1.00", total_debited: "111.00", reference: body.reference, destination: body.destination };
      }
      throw new Error("Unexpected provider call");
    });
    await runMoneyOperation(op.id);
    const payout = await prisma.moneyOperation.findFirstOrThrow({ where: { paymentId: f.a.id, kind: "REFUND_PAYOUT" } });
    expect(payout.amountMinor).toBe(11000n);
    await runMoneyOperation(payout.id);
    expect(await prisma.moneyOperation.findUniqueOrThrow({ where: { id: payout.id } })).toMatchObject({ status: "SUCCEEDED", failureCode: null });
    expect((await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: f.a.id } })).status).toBe("REFUNDED");
    const fee = await prisma.moneyJournalLine.aggregate({ where: { account: "refund_fee_expense", journal: { orderId: f.o.id } }, _sum: { amountMinor: true } });
    expect(fee._sum.amountMinor).toBe(100n);
    expect((await logisticsFinance(f.o.id)).summary.refundCompletedMinor).toBe(11000n);
    expect((await logisticsFinance(f.o.id)).summary.refundProcessingMinor).toBe(0n);
    getConfig().BACHS_BANK_REFUNDS_VERIFIED = false;
  });
  it("does not let staff approval race past an expired deadline",async()=>{
    const f=await preparedRecovery();await prisma.fulfillmentDeadline.update({where:{orderId:f.o.id},data:{refundDueAt:new Date(Date.now()-1)}});
    await Promise.allSettled([approveRecovery(f.r.id,f.proposal.version,randomUUID(),staffReq()),processDeadline(f.o.id)]);
    expect(await prisma.escrowEntry.count({where:{orderId:f.o.id,kind:"FUND"}})).toBe(0);
    expect(await prisma.moneyOperation.count({where:{paymentId:f.a.id,kind:"REFUND"}})).toBe(1);
    expect((await prisma.paymentRecovery.findUniqueOrThrow({where:{id:f.r.id}})).reservationActive).toBe(false);
  });
  it("retains uncertainty instead of refunding a possibly purchased label",async()=>{
    const f=await preparedRecovery();await approveRecovery(f.r.id,f.proposal.version,randomUUID(),staffReq());
    await prisma.delivery.update({where:{id:f.d.id},data:{status:"BOOKING_UNCERTAIN",bookingStartedAt:new Date()}});
    await prisma.fulfillmentDeadline.update({where:{orderId:f.o.id},data:{refundDueAt:new Date(Date.now()-1)}});
    await processDeadline(f.o.id);
    expect((await prisma.fulfillmentDeadline.findUniqueOrThrow({where:{orderId:f.o.id}})).state).toBe("REFUND_RECONCILIATION");
    expect(await prisma.moneyOperation.count({where:{paymentId:f.a.id,kind:"REFUND"}})).toBe(0);
    expect((await logisticsFinance(f.o.id)).funding.fundingShortfallMinor).toBeNull();
  });
  it("requires owner confirmation and denies foreign recovery reads",async()=>{
    const f=await recoverable();
    expect((await request(app).get(`/v1/orders/recoveries/${f.r.id}`).set("Authorization",`Bearer ${outsider}`)).status).toBe(404);
    const response=await request(app).post(`/v1/orders/recoveries/${f.r.id}/farmer`).set("Authorization",`Bearer ${token}`).send({pickupDate:new Date().toISOString().slice(0,10),preparationMinutes:30,notes:"Not the farmer"});
    expect(response.status).toBe(403);
    const view=await request(app).get(`/v1/orders/recoveries/${f.r.id}`).set("Authorization",`Bearer ${token}`);
    expect(view.status).toBe(200);expect(view.body.payment.paymentConfirmed).toBe(true);expect(view.body.payment.chargeId).toBeUndefined();
  });
  it("records wallet transfers without pretending funds moved and verifies exactly one journal",async()=>{
    const f=await preparedRecovery();await approveRecovery(f.r.id,f.proposal.version,randomUUID(),staffReq());
    const staffId=verifyAccessToken(staff,"admin").sub;
    const batch=await prisma.shippingFundingBatch.create({data:{mode:"sandbox",amountMinor:5000n,sourceLabel:"Business bank",destination:"Shipbubble account",shipmentIds:[f.d.id],initiatedBy:staffId,state:"TRANSFER_RECORDED",transferReference:randomUUID(),evidence:{statementReference:"Bank statement transaction 123"}}});
    expect(await prisma.moneyJournal.count({where:{reference:`shipping-funding:${batch.id}`}})).toBe(0);
    const before=await logisticsFinance(f.o.id);expect(before.funding.recordedUnverifiedTransfersMinor).toBe(5000n);
    await Promise.all([verifyFunding(batch.id,staffReq(),"Reconciled account statement in full","statement-entry-123"),verifyFunding(batch.id,staffReq(),"Reconciled account statement in full","statement-entry-123")]);
    expect(await prisma.moneyJournal.count({where:{reference:`shipping-funding:${batch.id}`}})).toBe(1);
    const after=await logisticsFinance();expect(after.funding.verifiedIncomingFundingMinor).toBe(0n);
    expect(after.summary.earnedCommissionMinor).toBeGreaterThanOrEqual(0n);
  });
  it("releases expired recovery stock once and persists warning alerts without duplicates",async()=>{
    const f=await recoverable();await confirmRecoveryFarmer(f.r.id,{pickupDate:new Date().toISOString().slice(0,10),preparationMinutes:20,notes:"Stock confirmed",phoneConfirmation:true},staffReq());
    const before=await prisma.listing.findUniqueOrThrow({where:{id:listing}});
    await prisma.paymentRecovery.update({where:{id:f.r.id},data:{reservationUntil:new Date(Date.now()-1)}});
    const confirmedAt=new Date(Date.now()-95*60000);await prisma.fulfillmentDeadline.update({where:{orderId:f.o.id},data:{confirmedAt,refundDueAt:refundDeadline(confirmedAt)}});
    await scanFulfillmentDeadlines();await scanFulfillmentDeadlines();
    const after=await prisma.listing.findUniqueOrThrow({where:{id:listing}});expect(before.reservedQuantity.minus(after.reservedQuantity).toString()).toBe("1");
    expect(await prisma.financeAlert.count({where:{orderId:f.o.id,code:"RECOVERY_DEADLINE_90"}})).toBe(1);
  });

  it("paginates finance history, preserves exact money and redacts provider operation payloads", async () => {
    const {o}=await order();
    await prisma.moneyOperation.createMany({data:Array.from({length:21},()=>({ownerId:buyer,orderId:o.id,mode:"sandbox",kind:"PAYOUT",status:"BLOCKED",amountMinor:125051n,feeMinor:100n,mutationKey:randomUUID(),requestHash:randomUUID(),payload:{privateEvidence:"never expose"},encryptedPayload:"secret"}))});
    await prisma.moneyOperation.create({data:{ownerId:buyer,orderId:o.id,mode:"live",kind:"PAYOUT",status:"BLOCKED",amountMinor:999n,mutationKey:randomUUID(),requestHash:randomUUID(),payload:{}}});
    const path=`/v1/admin/money/records?type=operations&orderId=${o.id}&kind=PAYOUT&status=BLOCKED&search=${o.reference}`;
    const first=await request(app).get(path).set("Authorization",`Bearer ${staff}`);
    expect(first.status).toBe(200);expect(first.body.total).toBe(21);expect(first.body.items).toHaveLength(20);
    expect(first.body.items[0].amountMinor).toBe("125051");expect(first.body.items[0].orderReference).toBe(o.reference);
    expect(JSON.stringify(first.body)).not.toContain("never expose");expect(first.body.items[0].encryptedPayload).toBeUndefined();
    const second=await request(app).get(`${path}&page=2`).set("Authorization",`Bearer ${staff}`);
    expect(second.body.items).toHaveLength(1);expect(first.body.items.map((r:any)=>r.id)).not.toContain(second.body.items[0].id);
    const detail=await request(app).get(`/v1/admin/money/records/operations/${first.body.items[0].id}`).set("Authorization",`Bearer ${staff}`);
    expect(detail.body.orderReference).toBe(o.reference);expect(detail.body.payload).toBeUndefined();
    expect((await request(app).get(path).set("Authorization",`Bearer ${token}`)).status).toBe(401);
    expect((await request(app).get(`${path}&from=2026-11-03&to=2026-11-01`).set("Authorization",`Bearer ${staff}`)).status).toBe(422);
  });
  it("reports verified collections separately from earned commission and scopes an order overview",async()=>{
    const {o}=await order();const a=await checkout(o.id);mockReceipt(a);await reconcilePayment(a.id);
    const result=await request(app).get(`/v1/admin/money/summary?orderId=${o.id}`).set("Authorization",`Bearer ${staff}`);
    expect(result.status).toBe(200);expect(result.body.mode).toBe("sandbox");expect(result.body.collectionsMinor).toBe("11000");expect(result.body.commissionMinor).toBe("0");expect(result.body.farmerHeldMinor).toBe("10000");
    expect(result.body.daily.reduce((n:bigint,r:any)=>n+BigInt(r.amountMinor),0n)).toBe(11000n);
    const ledger=await request(app).get(`/v1/admin/money/ledger?orderId=${o.id}`).set("Authorization",`Bearer ${staff}`);
    expect(ledger.status).toBe(200);expect(ledger.body.items).toHaveLength(1);expect(ledger.body.items[0].balanced).toBe(true);expect(ledger.body.items[0].fundedMinor).toBe("10000");
    expect(result.body.orderStates[0]._sum.heldMinor).toBe("10000");
  });

  it("keeps buyer pickup contact private until a verified receipt is allocated", async () => {
    const {o}=await order();
    await request(app).post(`/v1/orders/${o.id}/delivery/collection`).set(customerAuth()).send({});
    const phone=(await prisma.user.findUniqueOrThrow({where:{id:seller}})).phoneE164;
    const path=`/v1/orders/${o.id}/delivery`;
    const before=await request(app).get(path).set(customerAuth());
    expect(before.status).toBe(200);expect(before.headers["cache-control"]).toBe("private, no-store");expect(before.body.order.pickupContactAvailable).toBe(false);
    expect(before.body.order.suggestedPickup.phone).toBe("");expect(before.body.order.suggestedPickup.email).toBe("");
    expect(before.body.delivery.pickup.phone).toBe("");expect(JSON.stringify(before.body)).not.toContain(phone);
    const admin=await request(app).get(`/v1/admin/delivery-orders/${o.id}/delivery`).set(staffAuth());
    expect(admin.status).toBe(200);expect(admin.body.order.suggestedPickup.phone).toBe(phone);
    await prisma.tradeOrder.update({where:{id:o.id},data:{status:"FUNDED"}});
    expect((await request(app).get(path).set(customerAuth())).body.order.pickupContactAvailable).toBe(false);
    await prisma.tradeOrder.update({where:{id:o.id},data:{status:"AWAITING_PAYMENT"}});
    const a=await checkout(o.id);
    expect((await request(app).get(path).set(customerAuth())).body.order.pickupContactAvailable).toBe(false);
    mockReceipt(a,{amount:"100.00",amount_paid:"101.00"});await reconcilePayment(a.id);
    const after=await request(app).get(path).set(customerAuth());
    expect(after.body.order.pickupContactAvailable).toBe(true);expect(after.body.order.suggestedPickup.phone).toBe(phone);expect(after.body.delivery.pickup.phone).toBe(phone);
  });
  it("does not disclose farmer contact for a successful but unallocated recovery receipt",async()=>{
    const f=await recoverable();const result=await request(app).get(`/v1/orders/${f.o.id}/delivery`).set(customerAuth());
    expect(result.status).toBe(200);expect(result.body.order.pickupContactAvailable).toBe(false);expect(result.body.delivery.pickup.phone).toBe("");
    expect(result.body.order.suggestedPickup.email).toBe("");
    const cancelled=await request(app).post(`/v1/marketplace/orders/${f.o.id}/cancel`).set(customerAuth()).send({});
    expect(cancelled.status).toBe(200);expect(cancelled.body.order.delivery).toBeUndefined();
    expect(JSON.stringify(cancelled.body)).not.toContain((await prisma.user.findUniqueOrThrow({where:{id:seller}})).phoneE164);
  });

  it("returns an actionable expiry instead of retrying a cancelled checkout",async()=>{
    const {o}=await order();
    await prisma.tradeOrder.update({where:{id:o.id},data:{status:"CANCELLED",reservationExpiresAt:new Date(Date.now()-1000)}});
    const response=await request(app).post(`/v1/orders/${o.id}/checkout`).set(customerAuth()).send({});
    expect(response.status).toBe(409);expect(response.body.error.code).toBe("ORDER_EXPIRED");
    expect(await prisma.paymentAttempt.count({where:{orderId:o.id}})).toBe(0);
    const delivery=await request(app).get(`/v1/orders/${o.id}/delivery`).set(customerAuth());
    expect(delivery.body.order.checkoutErrorCode).toBe("ORDER_EXPIRED");
    expect(delivery.body.order.checkoutReady).toBe(false);
  });

  it("delivers readable recovery context to both participants and persists per-user read state",async()=>{
    const f=await recoverable();const sellerToken=(await createSession({subject:"CUSTOMER",principalId:seller,deviceId:randomUUID()})).accessToken;
    const sellerAuth={Authorization:`Bearer ${sellerToken}`};
    const buyerInbox=await request(app).get("/v1/orders/notifications?view=buyer").set(customerAuth());
    const entry=buyerInbox.body.items.find((n:any)=>n.orderId===f.o.id&&n.messageKey==="status.RECOVERY_REQUIRED");
    expect(entry.orderReference).toBe(f.o.reference);expect(entry.produceTitle).toBeDefined();expect(entry.readAt).toBeNull();expect(buyerInbox.body.unreadCount).toBeGreaterThan(0);
    const farmerInbox=await request(app).get("/v1/orders/notifications?view=seller").set(sellerAuth);
    const farmerEntry=farmerInbox.body.items.find((n:any)=>n.orderId===f.o.id&&n.messageKey==="status.RECOVERY_REQUIRED");expect(farmerEntry).toBeDefined();
    await request(app).post("/v1/orders/notifications/read").set(customerAuth()).send({ids:[entry.id,farmerEntry.id]});
    expect((await prisma.deliveryNotification.findUniqueOrThrow({where:{id:entry.id}})).readAt).not.toBeNull();
    expect((await prisma.deliveryNotification.findUniqueOrThrow({where:{id:farmerEntry.id}})).readAt).toBeNull();
    const future=new Date(Date.now()+60000).toISOString();expect((await request(app).post("/v1/orders/notifications/read").set(customerAuth()).send({through:future})).status).toBe(422);
    await request(app).post("/v1/orders/notifications/read").set(customerAuth()).send({through:buyerInbox.body.readThrough});
    const confirmation=await request(app).post(`/v1/orders/recoveries/${f.r.id}/farmer`).set(sellerAuth).send({pickupDate:new Date(Date.now()+86400000).toISOString().slice(0,10),preparationMinutes:30,notes:"Stock is packed and available"});
    expect(confirmation.status).toBe(200);expect(confirmation.body.experience.canFarmerConfirm).toBe(false);
    expect(await prisma.deliveryNotification.count({where:{orderId:f.o.id,messageKey:"status.RECOVERY_FARMER_CONFIRMED"}})).toBe(2);
    expect((await request(app).get("/v1/orders/notifications").set(customerAuth())).body.unreadCount).toBeGreaterThan(0);
  });
  it("provides explicit overdue actions and one support case without reopening recovery",async()=>{
    const f=await recoverable();await prisma.fulfillmentDeadline.update({where:{orderId:f.o.id},data:{state:"REFUND_BLOCKED",refundDueAt:new Date(Date.now()-1000)}});
    const sellerToken=(await createSession({subject:"CUSTOMER",principalId:seller,deviceId:randomUUID()})).accessToken;
    const sellerView=await request(app).get(`/v1/orders/recoveries/${f.r.id}`).set({Authorization:`Bearer ${sellerToken}`});
    expect(sellerView.body.experience).toMatchObject({phase:"REFUND_BLOCKED",canFarmerConfirm:false,canRequestRefund:false});
    expect(sellerView.body.payment.amountMinor).toBeUndefined();expect(sellerView.body.packing).toBeDefined();expect(sellerView.body.pickup.address).toBeDefined();
    const path=`/v1/orders/recoveries/${f.r.id}/support`,body={message:"Please help resolve the paid order and refund",sourceLocale:"en"};
    const [first,second]=await Promise.all([request(app).post(path).set(customerAuth()).send(body),request(app).post(path).set(customerAuth()).send(body)]);
    expect(first.status).toBe(201);expect(second.body.id).toBe(first.body.id);
    expect((await request(app).post(path).set({Authorization:`Bearer ${outsider}`}).send(body)).status).toBe(404);
    const buyerView=await request(app).get(`/v1/orders/recoveries/${f.r.id}`).set(customerAuth());
    expect(buyerView.body.support.status).toBe("OPEN");expect(buyerView.body.pickup).toBeNull();
    const staffId=verifyAccessToken(staff,"admin").sub;
    await prisma.supportMessage.create({data:{ticketId:first.body.id,authorId:staffId,body:"Private reconciliation evidence",internal:true}});
    expect((await request(app).get(`/v1/orders/recoveries/${f.r.id}`).set(customerAuth())).body.support.reply).toBeNull();
    await prisma.supportMessage.create({data:{ticketId:first.body.id,authorId:staffId,body:"Your refund is being reviewed.",internal:false}});
    await prisma.supportTicket.update({where:{id:first.body.id},data:{status:"RESOLVED"}});
    const resolved=await request(app).get(`/v1/orders/recoveries/${f.r.id}`).set(customerAuth());
    expect(resolved.body.support.status).toBe("RESOLVED");expect(resolved.body.support.reply).toBe("Your refund is being reviewed.");
    expect(JSON.stringify(resolved.body)).not.toContain("Private reconciliation evidence");
    expect((await prisma.fulfillmentDeadline.findUniqueOrThrow({where:{orderId:f.o.id}})).state).toBe("REFUND_BLOCKED");
  });

  it("blocks repeated deadline refunds after rejection and retries an uncertain original with the same id", async () => {
    const f = await recoverable();
    await prisma.fulfillmentDeadline.update({where:{orderId:f.o.id},data:{refundDueAt:new Date(Date.now()-1000)}});
    await processDeadline(f.o.id);
    const op = await prisma.moneyOperation.findFirstOrThrow({where:{paymentId:f.a.id,kind:"REFUND"}});
    await prisma.moneyOperation.update({where:{id:op.id},data:{status:"FAILED",failureCode:"PAYMENT_PROVIDER_REJECTED"}});
    await processDeadline(f.o.id); await processDeadline(f.o.id);
    expect(await prisma.moneyOperation.count({where:{paymentId:f.a.id,kind:"REFUND"}})).toBe(1);
    expect((await prisma.fulfillmentDeadline.findUniqueOrThrow({where:{orderId:f.o.id}})).state).toBe("REFUND_BLOCKED");
    await prisma.moneyOperation.update({where:{id:op.id},data:{status:"UNKNOWN"}});
    const lookup = vi.spyOn(bachs,"refundByCharge").mockResolvedValue(null);
    const path = `/v1/admin/money/operations/${op.id}/retry-refund`;
    const [a,b] = await Promise.all([request(app).post(path).set(staffAuth()).send({reason:"Provider lookup found no original refund"}),request(app).post(path).set(staffAuth()).send({reason:"Provider lookup found no original refund"})]);
    expect([a.status,b.status].sort()).toEqual([202,409]);
    expect(lookup).toHaveBeenCalled();
    expect(await prisma.moneyOperation.count({where:{paymentId:f.a.id,kind:"REFUND"}})).toBe(1);
    expect((await prisma.moneyOperation.findUniqueOrThrow({where:{id:op.id}})).status).toBe("QUEUED");
  });
  it("locates an uncertain refund without resubmission and confirms only the matching provider receipt", async () => {
    const f = await recoverable();
    await prisma.fulfillmentDeadline.update({where:{orderId:f.o.id},data:{refundDueAt:new Date(Date.now()-1000)}});
    await processDeadline(f.o.id);
    const op = await prisma.moneyOperation.findFirstOrThrow({where:{paymentId:f.a.id,kind:"REFUND"}});
    await prisma.moneyOperation.update({where:{id:op.id},data:{status:"UNKNOWN"}});
    const lookup = vi.spyOn(bachs,"refundByCharge").mockResolvedValue({refund_id:`rf-${op.id}`,charge_id:`ch_${f.a.id}`,reference:"wrong",status:"processing",requested_amount:"110.00"});
    const path=`/v1/admin/money/operations/${op.id}/reconcile`;
    expect((await request(app).post(path).set(staffAuth()).send({reason:"Locate and reconcile original refund"})).status).toBe(409);
    lookup.mockResolvedValue({refund_id:`rf-${op.id}`,charge_id:`ch_${f.a.id}`,reference:op.id,status:"success",requested_amount:"110.00"});
    expect((await request(app).post(path).set(staffAuth()).send({reason:"Locate and reconcile original refund"})).status).toBe(202);
    expect((await prisma.paymentAttempt.findUniqueOrThrow({where:{id:f.a.id}})).status).toBe("REFUNDED");
    expect(await prisma.moneyOperation.count({where:{paymentId:f.a.id,kind:"REFUND"}})).toBe(1);
  });

  it("snapshots configured recovery time and does not extend an existing payment deadline", async () => {
    const settings = await prisma.marketplaceSettings.upsert({where:{id:"marketplace"},create:{},update:{}});
    try {
      await prisma.marketplaceSettings.update({where:{id:"marketplace"},data:{paymentRecoveryTimeoutMinutes:45}});
      const first = await recoverable();
      const recorded = await prisma.fulfillmentDeadline.findUniqueOrThrow({where:{orderId:first.o.id}});
      expect(recorded.refundDueAt.getTime()-recorded.confirmedAt.getTime()).toBe(45*60000);
      await prisma.marketplaceSettings.update({where:{id:"marketplace"},data:{paymentRecoveryTimeoutMinutes:180}});
      await reconcilePayment(first.a.id);
      expect((await prisma.fulfillmentDeadline.findUniqueOrThrow({where:{orderId:first.o.id}})).refundDueAt).toEqual(recorded.refundDueAt);
      const second = await recoverable();
      const latest = await prisma.fulfillmentDeadline.findUniqueOrThrow({where:{orderId:second.o.id}});
      expect(latest.refundDueAt.getTime()-latest.confirmedAt.getTime()).toBe(180*60000);
      const response=await request(app).get(`/v1/admin/money?paymentId=${first.a.id}`).set(staffAuth());
      expect(response.status).toBe(200);
      expect(response.body.operations.every((op:any)=>op.paymentId===first.a.id)).toBe(true);
    } finally {
      await prisma.marketplaceSettings.update({where:{id:"marketplace"},data:{paymentRecoveryTimeoutMinutes:settings.paymentRecoveryTimeoutMinutes}});
    }
  });

  it("scales warning alerts to the recorded recovery duration without duplicating them", async () => {
    const f = await recoverable(), now = Date.now();
    await prisma.fulfillmentDeadline.update({where:{orderId:f.o.id},data:{confirmedAt:new Date(now-25*60000),refundDueAt:new Date(now+5*60000)}});
    await processDeadline(f.o.id); await processDeadline(f.o.id);
    expect(await prisma.financeAlert.count({where:{orderId:f.o.id,code:"RECOVERY_DEADLINE_15"}})).toBe(1);
    expect(await prisma.financeAlert.count({where:{orderId:f.o.id,code:"RECOVERY_DEADLINE_23"}})).toBe(1);
    expect(await prisma.financeAlert.count({where:{orderId:f.o.id,code:"RECOVERY_DEADLINE_28"}})).toBe(0);
    expect(await prisma.moneyOperation.count({where:{paymentId:f.a.id,kind:"REFUND"}})).toBe(0);
  });

  it("opens one authorized recovery record directly without relying on a queue page", async () => {
    const f=await recoverable();
    const response=await request(app).get(`/v1/admin/money/recoveries/${f.r.id}`).set(staffAuth());
    expect(response.status).toBe(200);
    expect(response.body.id).toBe(f.r.id);
    expect(response.body.deadline.paymentId).toBe(f.a.id);
    expect((await request(app).get(`/v1/admin/money/recoveries/${f.r.id}`).set(customerAuth())).status).not.toBe(200);
    await prisma.paymentRecovery.update({where:{id:f.r.id},data:{mode:"live"}});
    expect((await request(app).get(`/v1/admin/money/recoveries/${f.r.id}`).set(staffAuth())).status).toBe(404);
  });

  async function uncertainRefund() {
    const f=await recoverable();
    await prisma.fulfillmentDeadline.update({where:{orderId:f.o.id},data:{refundDueAt:new Date(Date.now()-1000)}});
    await processDeadline(f.o.id);
    const op=await prisma.moneyOperation.findFirstOrThrow({where:{paymentId:f.a.id,kind:"REFUND"}});
    await prisma.moneyOperation.update({where:{id:op.id},data:{status:"UNKNOWN",attempts:1,nextRunAt:new Date(0)}});
    return {...f,op};
  }
  it("automatically confirms an uncertain refund from the provider without staff or another submission",async()=>{
    const f=await uncertainRefund();
    vi.spyOn(bachs,"refundByCharge").mockImplementation(async charge => charge===`ch_${f.a.id}` ? {refund_id:`rf_${f.op.id}`,reference:f.op.id,charge_id:charge,status:"success",requested_amount:"110.00"} : null);
    await reconcileUncertainRefunds();
    expect((await prisma.moneyOperation.findUniqueOrThrow({where:{id:f.op.id}})).status).toBe("SUCCEEDED");
    expect((await prisma.paymentAttempt.findUniqueOrThrow({where:{id:f.a.id}})).status).toBe("REFUNDED");
    expect(await prisma.moneyOperation.count({where:{paymentId:f.a.id,kind:"REFUND"}})).toBe(1);
  });
  it("automatically retries a missing refund with its original id and never turns an outage into a retry",async()=>{
    const f=await uncertainRefund();
    const lookup=vi.spyOn(bachs,"refundByCharge").mockRejectedValue(new AppError(503,"PAYMENT_RESULT_UNKNOWN","Provider timeout"));
    await reconcileUncertainRefunds();
    expect((await prisma.moneyOperation.findUniqueOrThrow({where:{id:f.op.id}})).status).toBe("UNKNOWN");
    await prisma.moneyOperation.update({where:{id:f.op.id},data:{nextRunAt:new Date(0)}});
    lookup.mockResolvedValue(null);
    await Promise.all([reconcileUncertainRefunds(),reconcileUncertainRefunds()]);
    expect((await prisma.moneyOperation.findUniqueOrThrow({where:{id:f.op.id}})).status).toBe("QUEUED");
    expect(await prisma.moneyOperation.count({where:{paymentId:f.a.id,kind:"REFUND"}})).toBe(1);
  });
  it("stops automatic resubmission after three attempts, alerts staff and still accepts a later verified refund",async()=>{
    const f=await uncertainRefund();
    await prisma.moneyOperation.update({where:{id:f.op.id},data:{attempts:3}});
    const lookup=vi.spyOn(bachs,"refundByCharge").mockResolvedValue(null);
    await reconcileUncertainRefunds();
    const current=await prisma.moneyOperation.findUniqueOrThrow({where:{id:f.op.id}});
    expect(current.status).toBe("UNKNOWN");expect(current.failureCode).toBe("REFUND_PROVIDER_REVIEW_REQUIRED");
    expect(await prisma.financeAlert.count({where:{orderId:f.o.id,code:"REFUND_PROVIDER_REVIEW_REQUIRED"}})).toBe(1);
    await prisma.moneyOperation.update({where:{id:f.op.id},data:{nextRunAt:new Date(0)}});
    lookup.mockImplementation(async charge => charge===`ch_${f.a.id}` ? {refund_id:`rf_${f.op.id}`,reference:f.op.id,charge_id:charge,status:"success",requested_amount:"110.00"} : null);
    await reconcileUncertainRefunds();
    expect((await prisma.paymentAttempt.findUniqueOrThrow({where:{id:f.a.id}})).status).toBe("REFUNDED");
  });
  it("defaults an order refund to its verified delivery principal without staff entering kobo",async()=>{
    const f=await order(), a=await checkout(f.o.id);mockReceipt(a);await reconcilePayment(a.id);
    await prisma.delivery.update({where:{id:f.d.id},data:{status:"BOOKING_BLOCKED"}});
    const refundReq=req();refundReq.auth.sub=buyer;delete refundReq.body.shippingRefundMinor;
    const ops=await requestRefund(f.o.id,refundReq);
    expect(ops.reduce((sum,op)=>sum+op.amountMinor,0n)).toBe(11000n);
    const response=await request(app).post(`/v1/admin/money/orders/${f.o.id}/refund`).set(staffAuth()).send({reason:"Refund original produce and eligible delivery"});
    expect(response.status).toBe(202);expect(response.body[0].id).toBe(ops[0]!.id);
  });

  it("records one farmer dispatch and buyer receipt without forging courier delivery or releasing funds",async()=>{
    const f=await order(),a=await checkout(f.o.id);mockReceipt(a);await reconcilePayment(a.id);
    const sellerToken=(await createSession({subject:"CUSTOMER",principalId:seller,deviceId:randomUUID()})).accessToken,auth={Authorization:`Bearer ${sellerToken}`};
    const base=`/v1/orders/${f.o.id}/delivery`;
    await prisma.delivery.update({where:{id:f.d.id},data:{status:"BOOKED",providerShipmentId:`ship-${f.d.id}`}});
    expect((await request(app).post(`${base}/dispatch`).set(auth).send({})).status).toBe(409);
    await request(app).post(`${base}/ready`).set(auth).send({});
    const originalPackage=(await prisma.delivery.findUniqueOrThrow({where:{id:f.d.id}})).package as any;
    await prisma.delivery.update({where:{id:f.d.id},data:{package:{...originalPackage,packageCount:2}}});
    expect((await request(app).post(`${base}/dispatch`).set(auth).send({})).status).toBe(409);
    await prisma.delivery.update({where:{id:f.d.id},data:{package:originalPackage}});
    expect((await request(app).post(`${base}/dispatch`).set(customerAuth()).send({})).status).toBe(403);
    const [first,duplicate]=await Promise.all([request(app).post(`${base}/dispatch`).set(auth).send({}),request(app).post(`${base}/dispatch`).set(auth).send({})]);
    expect(first.status).toBe(200);expect(duplicate.status).toBe(200);
    expect(await prisma.deliveryEvent.count({where:{deliveryId:f.d.id,status:"FARMER_DISPATCHED"}})).toBe(1);
    expect(await prisma.deliveryNotification.count({where:{event:{deliveryId:f.d.id,status:"FARMER_DISPATCHED"}}})).toBe(2);
    expect((await prisma.delivery.findUniqueOrThrow({where:{id:f.d.id}})).status).toBe("BOOKED");
    const view=(await request(app).get(base).set(customerAuth())).body;
    expect(view.progress).toMatchObject({status:"Dispatched",canConfirm:false});
    expect((await request(app).post(`${base}/confirm`).set(customerAuth()).send({})).status).toBe(409);
    await prisma.delivery.update({where:{id:f.d.id},data:{status:"DELIVERED"}});
    await prisma.tradeOrder.update({where:{id:f.o.id},data:{financialHold:true}});
    expect((await request(app).post(`${base}/confirm`).set(customerAuth()).send({})).status).toBe(409);
    await prisma.tradeOrder.update({where:{id:f.o.id},data:{financialHold:false}});
    const [one,two]=await Promise.all([request(app).post(`${base}/confirm`).set(customerAuth()).send({}),request(app).post(`${base}/confirm`).set(customerAuth()).send({})]);
    expect(one.status).toBe(200);expect(two.status).toBe(200);
    expect(await prisma.deliveryEvent.count({where:{deliveryId:f.d.id,status:"BUYER_RECEIPT_CONFIRMED"}})).toBe(1);
    expect(await prisma.deliveryNotification.count({where:{event:{deliveryId:f.d.id,status:"BUYER_RECEIPT_CONFIRMED"}}})).toBe(2);
    expect((await request(app).get(base).set(customerAuth())).body.progress).toMatchObject({status:"Completed",canConfirm:false});
    const list=(await request(app).get("/v1/orders").set(customerAuth())).body.items.find((item:any)=>item.id===f.o.id);expect(list.fulfillmentStatus).toBe("Completed");
    expect((await prisma.tradeOrder.findUniqueOrThrow({where:{id:f.o.id}})).heldMinor).toBe(10000n);
  });

  it("lets the farmer prepare and report handoff for an existing staff-verified manual assignment",async()=>{
    const f=await order(),a=await checkout(f.o.id);mockReceipt(a);await reconcilePayment(a.id);
    await prisma.delivery.update({where:{id:f.d.id},data:{status:"MANUAL_REVIEW",providerShipmentId:null}});
    const assigned=await request(app).post(`/v1/admin/delivery-orders/${f.o.id}/delivery/manual-dispatch`).set(staffAuth()).send({carrier:"Verified local carrier",trackingRef:randomUUID(),reason:"Verified courier assignment and pickup agreement"});
    expect(assigned.status).toBe(200);
    const farmerToken=(await createSession({subject:"CUSTOMER",principalId:seller,deviceId:randomUUID()})).accessToken,auth={Authorization:`Bearer ${farmerToken}`};
    expect((await request(app).post(`/v1/orders/${f.o.id}/delivery/ready`).set(auth).send({})).status).toBe(200);
    expect((await request(app).post(`/v1/orders/${f.o.id}/delivery/dispatch`).set(auth).send({})).status).toBe(200);
    expect((await prisma.delivery.findUniqueOrThrow({where:{id:f.d.id}})).status).toBe("MANUAL_ASSIGNED");
    expect((await request(app).get(`/v1/orders/${f.o.id}/delivery`).set(customerAuth())).body.progress.status).toBe("Dispatched");
  });

  it("automatically queues one protected release for a photographed buyer confirmation and waits for disputes", async () => {
    const { o, d } = await order();
    await prisma.tradeOrder.update({ where: { id: o.id }, data: { journeyVersion: 2, farmerDecision: "PENDING" } });
    const payment = await checkout(o.id); mockReceipt(payment); await reconcilePayment(payment.id);
    expect((await prisma.delivery.findUniqueOrThrow({ where: { id: d.id } })).status).toBe("PAID");
    await expect(requestRelease(o.id, req())).rejects.toMatchObject({ code: "RELEASE_BLOCKED" });
    await prisma.tradeOrder.update({ where: { id: o.id }, data: { farmerDecision: "ACCEPTED", handedOverAt: new Date() } });
    await prisma.delivery.update({ where: { id: d.id }, data: { status: "DELIVERED", providerShipmentId: `fixture-${o.id}` } });
    expect(await prisma.moneyOperation.count({ where: { orderId: o.id, kind: "RELEASE" } })).toBe(0);
    vi.spyOn(mediaStorage, "storeMedia").mockResolvedValue(`receipt/${randomUUID()}`);
    const upload = await request(app).post(`/v1/orders/${o.id}/delivery/receipt-photo`).set("Authorization", `Bearer ${token}`).set("Content-Type", "image/jpeg").send(Buffer.from([255,216,255,...Array(20).fill(0)]));
    expect(upload.status).toBe(201);
    getConfig().PAYMENTS_TRANSFERS_ENABLED = false;
    const confirm = await request(app).post(`/v1/orders/${o.id}/delivery/confirm`).set("Authorization", `Bearer ${token}`).send({ acknowledged: true });
    expect(confirm.status).toBe(200);
    const paused = await request(app).get(`/v1/orders/${o.id}/payments`).set("Authorization", `Bearer ${token}`);
    expect(paused.body.progress).toMatchObject({ stage: "PAUSED", tone: "warning" });
    getConfig().PAYMENTS_TRANSFERS_ENABLED = true;
    await prisma.paymentAttempt.update({ where: { id: payment.id }, data: { mode: "live" } });
    await expect(requestRelease(o.id, req())).rejects.toMatchObject({ code: "RELEASE_BLOCKED" });
    await runPaymentJobs();
    expect(await prisma.moneyOperation.count({ where: { orderId: o.id, kind: "RELEASE" } })).toBe(0);
    await prisma.paymentAttempt.update({ where: { id: payment.id }, data: { mode: "sandbox" } });
    getConfig().PAYMENTS_TRANSFERS_ENABLED = true;
    const ticket = await prisma.supportTicket.create({ data: { orderId: o.id, userId: buyer, kind: "DISPUTE", subject: "QUALITY" } });
    await runPaymentJobs();
    expect(await prisma.moneyOperation.count({ where: { orderId: o.id, kind: "RELEASE" } })).toBe(0);
    await prisma.supportTicket.update({ where: { id: ticket.id }, data: { status: "RESOLVED" } });
    vi.spyOn(bachs, "account").mockResolvedValue({ id: `acct_${seller}`, parent_organization_id: "org_fixture", enabled_capabilities: ["transfers", "payouts"] });
    vi.spyOn(bachs, "balances").mockResolvedValue([{ currency: "NGN", available_balance: "100000.00" }]);
    vi.spyOn(bachs, "call").mockImplementation(async (path, body: any) => {
      if (path === "/transfers") return { id: `journey-transfer-${o.id}`, status: "paid", currency: "NGN", amount: body.amount, destination: `acct_${seller}` };
      throw new Error("Unexpected provider request");
    });
    await runPaymentJobs(); await runPaymentJobs();
    const saved = await prisma.tradeOrder.findUniqueOrThrow({ where: { id: o.id } });
    expect(saved.status).toBe("COMPLETED"); expect(saved.heldMinor).toBe(0n); expect(saved.releasedMinor).toBe(10000n);
    expect(await prisma.moneyOperation.count({ where: { orderId: o.id, kind: "RELEASE" } })).toBe(1);
    expect(await prisma.escrowEntry.count({ where: { orderId: o.id, kind: "RELEASE" } })).toBe(1);
    expect(await prisma.deliveryEvent.count({ where: { deliveryId: d.id, status: "PAYMENT_RELEASED" } })).toBe(1);
  });

  it("queues a photographed legacy receipt immediately without staff approval and without duplicate release", async () => {
    const { o, d } = await order(); const payment = await checkout(o.id); mockReceipt(payment); await reconcilePayment(payment.id);
    await prisma.delivery.update({ where: { id: d.id }, data: { status: "DELIVERED", providerShipmentId: `legacy-${o.id}` } });
    vi.spyOn(mediaStorage, "storeMedia").mockResolvedValue(`receipt/${randomUUID()}`);
    const headers = { Authorization: `Bearer ${token}` };
    expect((await request(app).post(`/v1/orders/${o.id}/delivery/receipt-photo`).set(headers).set("Content-Type", "image/jpeg").send(Buffer.from([255,216,255,...Array(20).fill(0)]))).status).toBe(201);
    for (let retry = 0; retry < 2; retry++) expect((await request(app).post(`/v1/orders/${o.id}/delivery/confirm`).set(headers).send({ acknowledged: true })).status).toBe(200);
    const operations = await prisma.moneyOperation.findMany({ where: { orderId: o.id, kind: "RELEASE" } });
    expect(operations).toHaveLength(1); expect(operations[0]!.status).toBe("QUEUED");
    expect((await prisma.tradeOrder.findUniqueOrThrow({ where: { id: o.id } })).heldMinor).toBe(10000n);
    const view = await request(app).get(`/v1/orders/${o.id}/payments`).set(headers);
    expect(view.body.progress).toMatchObject({ stage: "PROCESSING", escrow: "Held in escrow", transfer: "Queued", earnings: "Not credited" });
  });

  it("resumes a balance-blocked release through admin without creating another transfer", async () => {
    const f = await funded();
    await prisma.tradeOrder.update({where:{id:f.o.id},data:{status:"DELIVERED",deliveryConfirmedAt:new Date()}});
    await prisma.delivery.update({where:{id:f.d.id},data:{status:"DELIVERED"}});
    vi.spyOn(bachs,"account").mockResolvedValue({id:`acct_${seller}`,parent_organization_id:"org_fixture",enabled_capabilities:["transfers","payouts"]});
    const balance = vi.spyOn(bachs,"balances").mockResolvedValue([{currency:"NGN",available_balance:"0.00"}]);
    const op = await requestRelease(f.o.id,req());
    balance.mockRejectedValueOnce(new AppError(503,"PAYMENT_RESULT_UNKNOWN","Balance lookup timed out"));
    await runMoneyOperation(op.id);
    expect(await prisma.moneyOperation.findUniqueOrThrow({where:{id:op.id}})).toMatchObject({status:"BLOCKED",failureCode:"PAYMENT_PREFLIGHT_UNAVAILABLE",providerRef:null});
    expect((await requestRelease(f.o.id,req())).id).toBe(op.id);
    await runMoneyOperation(op.id);
    expect(await prisma.moneyOperation.findUniqueOrThrow({where:{id:op.id}})).toMatchObject({status:"BLOCKED",failureCode:"PROVIDER_BALANCE_LOW",providerRef:null});
    expect(await prisma.financeAlert.count({where:{key:`sandbox:settlement:${op.id}`,resolvedAt:null}})).toBe(1);
    const responses = await Promise.all([0,1].map(()=>request(app).post(`/v1/admin/money/orders/${f.o.id}/release`).set(staffAuth()).send({reason:"Sandbox balance restored and eligibility reviewed"})));
    expect(responses.map(r=>r.status)).toEqual([202,202]);
    expect(responses.map(r=>r.body.id)).toEqual([op.id,op.id]);
    balance.mockResolvedValue([{currency:"NGN",available_balance:"100000.00"}]);
    const write = vi.spyOn(bachs,"call").mockImplementation(async(path,body:any)=> {
      if(path!=="/transfers") throw new Error("Unexpected write");
      return {id:`tr_${op.id}`,status:"paid",currency:"NGN",amount:body.amount,destination:`acct_${seller}`};
    });
    await Promise.all([runMoneyOperation(op.id),runMoneyOperation(op.id)]);
    expect(write).toHaveBeenCalledTimes(1);
    expect(await prisma.tradeOrder.findUniqueOrThrow({where:{id:f.o.id}})).toMatchObject({heldMinor:0n,status:"COMPLETED"});
    expect(await prisma.escrowEntry.count({where:{orderId:f.o.id,kind:"RELEASE"}})).toBe(1);
    expect(await prisma.financeAlert.count({where:{key:`sandbox:settlement:${op.id}`,resolvedAt:null}})).toBe(0);
  });
  it("keeps an unknown release on reconciliation and refuses to resume a disputed release", async()=>{
    const f=await funded();
    await prisma.tradeOrder.update({where:{id:f.o.id},data:{status:"DELIVERED",deliveryConfirmedAt:new Date()}});
    await prisma.delivery.update({where:{id:f.d.id},data:{status:"DELIVERED"}});
    const op=await requestRelease(f.o.id,req());
    await prisma.moneyOperation.update({where:{id:op.id},data:{status:"UNKNOWN"}});
    expect((await requestRelease(f.o.id,req())).status).toBe("UNKNOWN");
    const response=await request(app).post(`/v1/admin/money/operations/${op.id}/reconcile`).set(staffAuth()).send({reason:"Check uncertain original transfer before retrying"});
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("PROVIDER_REFERENCE_REQUIRED");
    await prisma.moneyOperation.update({where:{id:op.id},data:{status:"BLOCKED"}});
    await prisma.tradeOrder.update({where:{id:f.o.id},data:{financialHold:true}});
    await expect(requestRelease(f.o.id,req())).rejects.toMatchObject({code:"RELEASE_BLOCKED"});
    expect(await prisma.moneyOperation.findUniqueOrThrow({where:{id:op.id}})).toMatchObject({status:"BLOCKED"});
  });

  it("never makes a rejected reconciliation read eligible for a duplicate release",async()=>{
    const f=await funded();
    await prisma.tradeOrder.update({where:{id:f.o.id},data:{status:"DELIVERED",deliveryConfirmedAt:new Date()}});
    await prisma.delivery.update({where:{id:f.d.id},data:{status:"DELIVERED"}});
    const op=await requestRelease(f.o.id,req());
    await prisma.moneyOperation.update({where:{id:op.id},data:{status:"PROVIDER_PENDING",providerRef:"tr_read_unavailable"}});
    vi.spyOn(bachs,"account").mockResolvedValue({id:`acct_${seller}`,parent_organization_id:"org_fixture",enabled_capabilities:["transfers","payouts"]});
    vi.spyOn(bachs,"operation").mockRejectedValue(new AppError(422,"PAYMENT_PROVIDER_REJECTED","Provider cannot retrieve original transfer"));
    const write=vi.spyOn(bachs,"call");
    await runMoneyOperation(op.id);
    expect(await prisma.moneyOperation.findUniqueOrThrow({where:{id:op.id}})).toMatchObject({status:"PROVIDER_PENDING",providerRef:"tr_read_unavailable"});
    expect((await requestRelease(f.o.id,req())).id).toBe(op.id);
    expect(write).not.toHaveBeenCalled();
    expect(await prisma.moneyOperation.count({where:{orderId:f.o.id,kind:"RELEASE"}})).toBe(1);
    vi.mocked(bachs.operation).mockImplementationOnce(async()=>{
      await prisma.moneyOperation.update({where:{id:op.id},data:{status:"SUCCEEDED",leaseUntil:null}});
      throw new AppError(503,"PAYMENT_RESULT_UNKNOWN","A concurrent provider lookup timed out");
    });
    await runMoneyOperation(op.id);
    expect(await prisma.moneyOperation.findUniqueOrThrow({where:{id:op.id}})).toMatchObject({status:"SUCCEEDED",leaseUntil:null});
  });

  it("resumes an admin refund with its original identity and confirms one refund and notification",async()=>{
    const f=await funded();
    await prisma.delivery.update({where:{id:f.d.id},data:{status:"BOOKING_BLOCKED"}});
    const refundReq=req();refundReq.auth.sub=buyer;
    const op=(await requestRefund(f.o.id,refundReq))[0]!;
    vi.spyOn(bachs,"payment").mockResolvedValue({payment_id:`ch_${f.a.id}`,checkout_id:f.a.checkoutId,currency:"NGN",is_refundable:true});
    const balance=vi.spyOn(bachs,"balances").mockResolvedValue([{currency:"NGN",available_balance:"0.00"}]);
    await runMoneyOperation(op.id);
    expect(await prisma.moneyOperation.findUniqueOrThrow({where:{id:op.id}})).toMatchObject({status:"BLOCKED",failureCode:"PROVIDER_BALANCE_LOW"});
    const response=await request(app).post(`/v1/admin/money/orders/${f.o.id}/refund`).set(staffAuth()).send({reason:"Refund funding is ready and original request reviewed"});
    expect(response.status).toBe(202);expect(response.body[0].id).toBe(op.id);
    balance.mockResolvedValue([{currency:"NGN",available_balance:"100000.00"}]);
    const write=vi.spyOn(bachs,"call").mockResolvedValue({refund_id:`rf_${op.id}`,status:"success",requested_amount:"110.00",refunded_amount:"110.00",charge_id:`ch_${f.a.id}`,reference:op.id});
    await Promise.all([runMoneyOperation(op.id),runMoneyOperation(op.id)]);
    expect(write).toHaveBeenCalledTimes(1);
    expect(await prisma.tradeOrder.findUniqueOrThrow({where:{id:f.o.id}})).toMatchObject({heldMinor:0n,refundedMinor:10000n,status:"REFUNDED"});
    expect(await prisma.escrowEntry.count({where:{orderId:f.o.id,kind:"REFUND"}})).toBe(1);
    expect(await prisma.deliveryNotification.count({where:{orderId:f.o.id,event:{status:"PAYMENT_REFUNDED"}}})).toBe(2);
  });

  it.each(["ORDER", "DELIVERY_TOPUP"])("does not create a %s payment attempt when NGN settlement is disabled",async(kind)=>{
    const f=await order();
    vi.mocked(bachs.assertNgnSettlement).mockRejectedValue(new AppError(503,"NGN_SETTLEMENT_REQUIRED","Secure payments are temporarily unavailable"));
    await expect(startCheckout(f.o.id,buyer,kind)).rejects.toMatchObject({code:"NGN_SETTLEMENT_REQUIRED"});
    expect(await prisma.paymentAttempt.count({where:{orderId:f.o.id}})).toBe(0);
  });
  it("rejects a USD-priced session even when its charge was collected in NGN",async()=>{
    const f=await order();const a=await checkout(f.o.id);mockReceipt(a);
    vi.mocked(bachs.checkoutState).mockResolvedValue({checkout_id:a.checkoutId,reference:a.id,currency:"USD",billing_currency:"NGN",status:"completed",charge_id:`ch_${a.id}`});
    await expect(reconcilePayment(a.id)).rejects.toMatchObject({code:"PAYMENT_CONFIRMATION_PENDING"});
    expect(await prisma.paymentAttempt.findUniqueOrThrow({where:{id:a.id}})).toMatchObject({confirmedAt:null,checkErrorCode:"PAYMENT_CURRENCY_MISMATCH"});
    expect(await prisma.tradeOrder.findUniqueOrThrow({where:{id:f.o.id}})).toMatchObject({heldMinor:0n,status:"AWAITING_PAYMENT"});
  });
  it("withholds saved payment links when the account or session currency is unsafe",async()=>{
    const f=await order();const a=await checkout(f.o.id);
    vi.mocked(bachs.checkoutState).mockResolvedValue({checkout_id:a.checkoutId,reference:a.id,currency:"NGN",billing_currency:"USD",status:"open"});
    const read=()=>request(app).get(`/v1/financial/payments/${a.id}`).set(customerAuth());
    expect((await read()).body.checkoutUrl).toBeNull();
    vi.mocked(bachs.checkoutState).mockResolvedValue({checkout_id:a.checkoutId,reference:a.id,currency:"NGN",billing_currency:"NGN",status:"open"});
    vi.mocked(bachs.assertNgnSettlement).mockRejectedValue(new AppError(503,"NGN_SETTLEMENT_REQUIRED","Secure payments are temporarily unavailable"));
    const response=await request(app).get(`/v1/orders/${f.o.id}/payments`).set(customerAuth());
    expect(response.status).toBe(200);
    expect(response.body.items[0].checkoutUrl).toBeNull();
  });

  describe("paid delivery quote renewal", () => {
    const renewalOrders: string[] = [];
    afterEach(async () => {
      vi.useRealTimers();
      await prisma.delivery.updateMany({ where: { orderId: { in: renewalOrders.splice(0) } }, data: {
        nextSyncAt: new Date("2099-01-01T00:00:00Z"),
      } });
    });
    async function paidRenewal(quantity = 1, waitingForFarmer = false) {
      const fixture = await order(quantity);
      renewalOrders.push(fixture.o.id);
      if (waitingForFarmer)
        await prisma.tradeOrder.update({ where: { id: fixture.o.id }, data: { journeyVersion: 2, farmerDecision: "PENDING" } });
      const a = await checkout(fixture.o.id);
      mockReceipt(a);
      await reconcilePayment(a.id);
      return { ...fixture, a };
    }
    function freshRate(f: Awaited<ReturnType<typeof paidRenewal>>, prefix = "renewed") {
      const parts = splitParts(f.q.requestToken);
      if (!parts) return { ...rate(f.q), requestToken: `${prefix}-${f.d.id}` };
      return combineParcelRates(parts.map((part, index) => [{
        requestToken: `${prefix}-${f.d.id}-${index}`, serviceCode: part.serviceCode,
        courierId: part.courierId, courier: f.q.courier,
        amountMinor: BigInt(part.amountMinor), walletMinor: BigInt(part.walletMinor),
      }]))[0]!;
    }
    function mockBooking(f: Awaited<ReturnType<typeof paidRenewal>>) {
      let index = 0;
      vi.mocked(shippingProvider.book).mockImplementation(async () => ({
        id: `SB-renewed-${f.d.id}-${index++}`, status: "pending", courier: f.q.courier,
        shippingMinor: f.q.amountMinor / BigInt((f.d.package as any).packageCount),
      }));
    }
    async function expire(f: Awaited<ReturnType<typeof paidRenewal>>) {
      await prisma.deliveryQuote.update({ where: { id: f.q.id }, data: { expiresAt: new Date(0) } });
    }
    async function expectPaymentPreserved(f: Awaited<ReturnType<typeof paidRenewal>>) {
      expect(await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: f.a.id } })).toMatchObject({
        status: "SUCCEEDED", quoteId: f.q.id, amountMinor: f.a.amountMinor,
        shippingMinor: f.a.shippingMinor, paidMinor: f.a.amountMinor, exceptionCode: null,
      });
      expect(await prisma.paymentAttempt.count({ where: { orderId: f.o.id } })).toBe(1);
      expect(await prisma.escrowEntry.count({ where: { orderId: f.o.id, kind: "FUND" } })).toBe(1);
      expect(await prisma.moneyJournal.count({ where: { orderId: f.o.id, reference: `funded:${f.a.id}` } })).toBe(1);
      expect(await prisma.moneyOperation.count({ where: { orderId: f.o.id, kind: { not: "CHECKOUT" } } })).toBe(0);
    }
    it.each([30, 180])("books once after a %i-minute farmer delay without restarting payment or its deadline", async minutes => {
      const f = await paidRenewal(1, true);
      const confirmedAt = new Date(Date.now() - minutes * 60000);
      const refundDueAt = refundDeadline(confirmedAt, Math.max(120, minutes + 60));
      await prisma.paymentAttempt.update({ where: { id: f.a.id }, data: { confirmedAt } });
      await prisma.deliveryQuote.update({ where: { id: f.q.id }, data: {
        createdAt: new Date(confirmedAt.getTime() - 120000),
        expiresAt: new Date(confirmedAt.getTime() + 13 * 60000),
      } });
      getConfig().PAYMENT_AUTO_REFUNDS_ENABLED = true;
      await prisma.fulfillmentDeadline.create({ data: {
        orderId: f.o.id, paymentId: f.a.id, mode: "sandbox", confirmedAt, refundDueAt,
      } });
      vi.mocked(shippingProvider.quotes).mockResolvedValue([freshRate(f)]);
      mockBooking(f);
      await runDeliveryJobs();
      expect(shippingProvider.quotes).not.toHaveBeenCalled();
      expect(shippingProvider.book).not.toHaveBeenCalled();
      const sellerToken = (await createSession({ subject: "CUSTOMER", principalId: seller, deviceId: randomUUID() })).accessToken;
      const auth = { Authorization: `Bearer ${sellerToken}` }, base = `/v1/orders/${f.o.id}/delivery`;
      const decisions = await Promise.all([0, 1].map(() => request(app).post(`${base}/decision`).set(auth).send({ accept: true })));
      expect(decisions.map(response => response.status)).toEqual([200, 200]);
      await runDeliveryJobs();
      expect(shippingProvider.quotes).not.toHaveBeenCalled();
      const ready = await Promise.all([0, 1].map(() => request(app).post(`${base}/ready`).set(auth).send({})));
      expect(ready.map(response => response.status)).toEqual([200, 200]);
      expect((await request(app).get(base).set(customerAuth())).body.progress).toMatchObject({
        status: "Awaiting courier booking", canDispatch: false, canConfirm: false,
      });
      await Promise.all([runDeliveryJobs(), runDeliveryJobs()]);
      await runDeliveryJobs();
      const d = await prisma.delivery.findUniqueOrThrow({ where: { id: f.d.id } });
      expect(d).toMatchObject({ status: "BOOKED", paidMinor: f.q.amountMinor, shippingMinor: f.q.amountMinor, failureCode: null });
      expect(d.selectedQuoteId).not.toBe(f.q.id);
      expect(shippingProvider.quotes).toHaveBeenCalledTimes(1);
      expect(shippingProvider.quotes).toHaveBeenCalledWith(expect.objectContaining({
        pickup: f.d.pickup, destination: f.d.destination, parcel: f.d.package, valueMinor: f.o.totalMinor,
      }));
      expect(shippingProvider.book).toHaveBeenCalledExactlyOnceWith({
        courierId: f.q.courierId, serviceCode: f.q.serviceCode, requestToken: freshRate(f).requestToken,
      });
      expect(await prisma.deliveryEvent.count({ where: { deliveryId: f.d.id, status: "ORDER_ACCEPTED" } })).toBe(1);
      expect(await prisma.deliveryEvent.count({ where: { deliveryId: f.d.id, status: "READY_FOR_PICKUP" } })).toBe(1);
      expect(await prisma.deliveryEvent.count({ where: { deliveryId: f.d.id, status: "QUOTE_REFRESHED" } })).toBe(1);
      expect(await prisma.shipment.count({ where: { orderId: f.o.id } })).toBe(1);
      expect(await prisma.moneyJournal.count({ where: { orderId: f.o.id, reference: { startsWith: "shipping-cost:" } } })).toBe(1);
      expect(await prisma.fulfillmentDeadline.findUniqueOrThrow({ where: { orderId: f.o.id } })).toMatchObject({ state: "SECURED", confirmedAt, refundDueAt });
      await reconcilePayment(f.a.id);
      await expectPaymentPreserved(f);
    });
    it("renews a quote that expires after it was queued, including a previously blocked expired delivery", async () => {
      const f = await paidRenewal();
      await expire(f);
      await prisma.delivery.update({ where: { id: f.d.id }, data: {
        status: "BOOKING_BLOCKED", failureCode: "QUOTE_EXPIRED", nextSyncAt: new Date(),
      } });
      vi.mocked(shippingProvider.quotes).mockResolvedValue([freshRate(f)]);
      mockBooking(f);
      await runDeliveryJobs();
      expect((await prisma.delivery.findUniqueOrThrow({ where: { id: f.d.id } })).status).toBe("BOOKED");
      expect(shippingProvider.quotes).toHaveBeenCalledTimes(1);
      expect(shippingProvider.book).toHaveBeenCalledTimes(1);
      await expectPaymentPreserved(f);
    });
    it.each(["DELIVERY_PROVIDER_UNAVAILABLE", "SHIPBUBBLE_RESPONSE_INVALID"])("retries a safe %s rate failure with backoff and no additional charge", async code => {
      const f = await paidRenewal();
      await expire(f);
      vi.mocked(shippingProvider.quotes)
        .mockRejectedValueOnce(new AppError(503, code, "Rate request failed"))
        .mockResolvedValueOnce([freshRate(f)]);
      mockBooking(f);
      await runDeliveryJobs();
      expect(await prisma.delivery.findUniqueOrThrow({ where: { id: f.d.id } })).toMatchObject({
        status: "BOOKING_BLOCKED", failureCode: code, bookingStartedAt: null, providerShipmentId: null,
      });
      expect(shippingProvider.book).not.toHaveBeenCalled();
      await runDeliveryJobs();
      expect(shippingProvider.quotes).toHaveBeenCalledTimes(1);
      await prisma.delivery.update({ where: { id: f.d.id }, data: { nextSyncAt: new Date() } });
      await runDeliveryJobs();
      expect(shippingProvider.quotes).toHaveBeenCalledTimes(2);
      expect(shippingProvider.book).toHaveBeenCalledTimes(1);
      expect((await prisma.delivery.findUniqueOrThrow({ where: { id: f.d.id } })).status).toBe("BOOKED");
      await expectPaymentPreserved(f);
    });
    it.each(["increase", "decrease", "wallet cost"])("holds a renewed %s for explicit reconciliation without repricing, buying, refunding or topping up", async change => {
      const f = await paidRenewal();
      await expire(f);
      const observed = { ...freshRate(f), amountMinor: change === "increase" ? 1500n : change === "decrease" ? 900n : 1000n };
      observed.walletMinor = change === "wallet cost" ? 1200n : observed.amountMinor;
      vi.mocked(shippingProvider.quotes).mockResolvedValue([observed]);
      await runDeliveryJobs();
      await runDeliveryJobs();
      expect(shippingProvider.quotes).toHaveBeenCalledTimes(1);
      expect(shippingProvider.book).not.toHaveBeenCalled();
      expect(await prisma.delivery.findUniqueOrThrow({ where: { id: f.d.id } })).toMatchObject({
        status: "BOOKING_BLOCKED", failureCode: "DELIVERY_PRICE_CHANGED", selectedQuoteId: f.q.id,
        shippingMinor: f.q.amountMinor, paidMinor: f.q.amountMinor, providerShipmentId: null, bookingStartedAt: null,
      });
      expect(await prisma.deliveryQuote.findFirstOrThrow({ where: { deliveryId: f.d.id, id: { not: f.q.id } } })).toMatchObject({
        amountMinor: observed.amountMinor, walletMinor: observed.walletMinor,
      });
      const view = (await request(app).get(`/v1/orders/${f.o.id}/delivery`).set(customerAuth())).body;
      expect(view.progress).toMatchObject({ status: "Courier booking needs attention", canDispatch: false, canConfirm: false });
      expect(view.progress.next).toContain("You will not be charged automatically");
      expect((await request(app).get(`/v1/orders/${f.o.id}/payments`).set(customerAuth())).body.checkoutReady).toBe(false);
      expect((await request(app).post(`/v1/orders/${f.o.id}/delivery/book`).set(customerAuth()).send({})).body.error.code).toBe("DELIVERY_PRICE_CHANGED");
      expect((await prisma.tradeOrder.findUniqueOrThrow({ where: { id: f.o.id } })).financialHold).toBe(false);
      await expectPaymentPreserved(f);
    });
    it("waits for the selected service rather than substituting a cheaper courier", async () => {
      const f = await paidRenewal();
      await expire(f);
      vi.mocked(shippingProvider.quotes)
        .mockResolvedValueOnce([{ ...freshRate(f), courierId: "different-courier", amountMinor: 500n, walletMinor: 500n }])
        .mockResolvedValueOnce([freshRate(f)]);
      mockBooking(f);
      await runDeliveryJobs();
      expect(await prisma.delivery.findUniqueOrThrow({ where: { id: f.d.id } })).toMatchObject({
        status: "BOOKING_BLOCKED", failureCode: "NO_DELIVERY_OPTIONS", selectedQuoteId: f.q.id,
      });
      expect(shippingProvider.book).not.toHaveBeenCalled();
      await prisma.delivery.update({ where: { id: f.d.id }, data: { nextSyncAt: new Date() } });
      await runDeliveryJobs();
      expect(shippingProvider.book).toHaveBeenCalledTimes(1);
      expect(vi.mocked(shippingProvider.book).mock.calls[0]![0].courierId).toBe(f.q.courierId);
      await expectPaymentPreserved(f);
    });
    it.each(["financial hold", "destination", "selection", "quote fee", "quote wallet cost", "quote token", "refund", "deadline"])("rejects a renewal response after a concurrent %s change", async change => {
      const f = await paidRenewal();
      await expire(f);
      if (change === "deadline") {
        getConfig().PAYMENT_AUTO_REFUNDS_ENABLED = true;
        await prisma.fulfillmentDeadline.create({ data: {
          orderId: f.o.id, paymentId: f.a.id, mode: "sandbox", confirmedAt: new Date(), refundDueAt: new Date(Date.now() + 60000),
        } });
      }
      const entered = deferred<void>(), delayed = deferred<ReturnType<typeof freshRate>[]>();
      vi.mocked(shippingProvider.quotes).mockImplementationOnce(async () => { entered.resolve(); return delayed.promise; });
      const job = runDeliveryJobs();
      await entered.promise;
      if (change === "financial hold") await prisma.tradeOrder.update({ where: { id: f.o.id }, data: { financialHold: true } });
      if (change === "destination") await prisma.delivery.update({ where: { id: f.d.id }, data: { destination: { ...(f.d.destination as object), address: "A changed delivery address in Lagos" } } });
      if (change === "selection") await prisma.delivery.update({ where: { id: f.d.id }, data: { selectedQuoteId: null } });
      if (change === "quote fee") await prisma.deliveryQuote.update({ where: { id: f.q.id }, data: { amountMinor: 1500n } });
      if (change === "quote wallet cost") await prisma.deliveryQuote.update({ where: { id: f.q.id }, data: { walletMinor: 1500n } });
      if (change === "quote token") await prisma.deliveryQuote.update({ where: { id: f.q.id }, data: { requestToken: "concurrently-changed-token" } });
      if (change === "refund") {
        const refund = req(); refund.body.shippingRefundMinor = "1000";
        expect(await requestRefund(f.o.id, refund)).toHaveLength(1);
      }
      if (change === "deadline") await prisma.fulfillmentDeadline.update({ where: { orderId: f.o.id }, data: { refundDueAt: new Date(0) } });
      delayed.resolve([freshRate(f)]);
      await job;
      expect(shippingProvider.book).not.toHaveBeenCalled();
      expect(await prisma.deliveryQuote.count({ where: { deliveryId: f.d.id } })).toBe(1);
      expect(await prisma.delivery.findUniqueOrThrow({ where: { id: f.d.id } })).toMatchObject({
        status: "BOOKING_BLOCKED", bookingStartedAt: null, providerShipmentId: null, paidMinor: f.q.amountMinor,
      });
      expect((await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: f.a.id } })).status).toBe("SUCCEEDED");
    });
    it("does not let a crashed renewal's late response overwrite the replacement worker's booking", async () => {
      const f = await paidRenewal();
      await expire(f);
      const entered = deferred<void>(), delayed = deferred<ReturnType<typeof freshRate>[]>();
      vi.mocked(shippingProvider.quotes)
        .mockImplementationOnce(async () => { entered.resolve(); return delayed.promise; })
        .mockResolvedValueOnce([freshRate(f, "latest")]);
      mockBooking(f);
      const first = runDeliveryJobs();
      await entered.promise;
      await prisma.delivery.update({ where: { id: f.d.id }, data: { leaseUntil: new Date(0) } });
      await runDeliveryJobs();
      delayed.resolve([freshRate(f, "obsolete")]);
      await first;
      const d = await prisma.delivery.findUniqueOrThrow({ where: { id: f.d.id } });
      expect(d.status).toBe("BOOKED");
      expect((await prisma.deliveryQuote.findUniqueOrThrow({ where: { id: d.selectedQuoteId! } })).requestToken).toBe(freshRate(f, "latest").requestToken);
      expect(await prisma.deliveryQuote.count({ where: { deliveryId: f.d.id } })).toBe(2);
      expect(shippingProvider.book).toHaveBeenCalledTimes(1);
      await expectPaymentPreserved(f);
    });
    it("retries expiry during the wallet read only before the label-purchase boundary", async () => {
      const f = await paidRenewal();
      const started = Date.now();
      await prisma.deliveryQuote.update({ where: { id: f.q.id }, data: { expiresAt: new Date(started + 90000) } });
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(started);
      vi.mocked(shippingProvider.wallet).mockImplementationOnce(async () => {
        vi.setSystemTime(started + 100000);
        return 1000000n;
      });
      vi.mocked(shippingProvider.quotes).mockResolvedValue([freshRate(f)]);
      mockBooking(f);
      await runDeliveryJobs();
      expect(await prisma.delivery.findUniqueOrThrow({ where: { id: f.d.id } })).toMatchObject({
        status: "BOOKING_BLOCKED", failureCode: "QUOTE_EXPIRED", bookingStartedAt: null,
      });
      expect(shippingProvider.book).not.toHaveBeenCalled();
      vi.setSystemTime(started + 100000 + 5 * 60000);
      await runDeliveryJobs();
      expect(shippingProvider.quotes).toHaveBeenCalledTimes(1);
      expect(shippingProvider.book).toHaveBeenCalledTimes(1);
      await expectPaymentPreserved(f);
    });
    it("renews every unpurchased split parcel and books each fresh token once", async () => {
      const f = await paidRenewal(3);
      await expire(f);
      vi.mocked(shippingProvider.quotes).mockResolvedValue([freshRate(f)]);
      mockBooking(f);
      await runDeliveryJobs();
      await runDeliveryJobs();
      const d = await prisma.delivery.findUniqueOrThrow({ where: { id: f.d.id } });
      expect(d).toMatchObject({ status: "BOOKED", providerShipmentId: `split:${f.d.id}`, paidMinor: 3000n, shippingMinor: 3000n });
      const expected = splitParts(freshRate(f).requestToken)!;
      expect(vi.mocked(shippingProvider.book).mock.calls.map(([quote]) => quote.requestToken)).toEqual(expected.map(part => part.requestToken));
      const parcels = await prisma.deliveryParcel.findMany({ where: { deliveryId: f.d.id } });
      expect(parcels).toHaveLength(3);
      expect(parcels.every(parcel => parcel.quoteId === d.selectedQuoteId && parcel.providerShipmentId)).toBe(true);
      expect(await prisma.moneyJournal.count({ where: { orderId: f.o.id, reference: { startsWith: "shipping-cost:" } } })).toBe(1);
      await expectPaymentPreserved(f);
    });
    it("preserves a partial split purchase after renewal without rebuying labels or replacing its remaining plan", async () => {
      const f = await paidRenewal(3);
      await expire(f);
      vi.mocked(shippingProvider.quotes).mockResolvedValue([freshRate(f)]);
      vi.mocked(shippingProvider.book)
        .mockResolvedValueOnce({ id: `SB-partial-${f.d.id}`, status: "pending", courier: f.q.courier, shippingMinor: 1000n })
        .mockRejectedValueOnce(new AppError(503, "DELIVERY_PROVIDER_UNAVAILABLE", "The second label response was lost"));
      await runDeliveryJobs();
      await prisma.delivery.update({ where: { id: f.d.id }, data: { nextSyncAt: new Date() } });
      await runDeliveryJobs();
      const parcels = await prisma.deliveryParcel.findMany({ where: { deliveryId: f.d.id }, orderBy: { parcelIndex: "asc" } });
      expect(parcels.map(parcel => parcel.status)).toEqual(["BOOKED", "BOOKING_UNCERTAIN", "PENDING"]);
      expect(parcels.map(parcel => parcel.requestToken)).toEqual(splitParts(freshRate(f).requestToken)!.map(part => part.requestToken));
      expect(await prisma.delivery.findUniqueOrThrow({ where: { id: f.d.id } })).toMatchObject({
        status: "BOOKING_UNCERTAIN", failureCode: "BOOKING_RESULT_UNKNOWN", providerShipmentId: `split:${f.d.id}`,
      });
      expect(shippingProvider.quotes).toHaveBeenCalledTimes(1);
      expect(shippingProvider.book).toHaveBeenCalledTimes(2);
      expect(await prisma.shipment.count({ where: { orderId: f.o.id } })).toBe(0);
      await expectPaymentPreserved(f);
    });
    it("recovers a temporary wallet failure after renewal without another quote or payment", async () => {
      const f = await paidRenewal();
      await expire(f);
      vi.mocked(shippingProvider.quotes).mockResolvedValue([freshRate(f)]);
      vi.mocked(shippingProvider.wallet).mockRejectedValueOnce(new AppError(503, "DELIVERY_PROVIDER_UNAVAILABLE", "Wallet read failed"));
      mockBooking(f);
      await runDeliveryJobs();
      expect(await prisma.delivery.findUniqueOrThrow({ where: { id: f.d.id } })).toMatchObject({
        status: "BOOKING_BLOCKED", failureCode: "SHIPPING_WALLET_UNAVAILABLE", providerShipmentId: null, bookingStartedAt: null,
      });
      expect(shippingProvider.book).not.toHaveBeenCalled();
      await prisma.delivery.update({ where: { id: f.d.id }, data: { nextSyncAt: new Date() } });
      await runDeliveryJobs();
      expect(shippingProvider.quotes).toHaveBeenCalledTimes(1);
      expect(shippingProvider.book).toHaveBeenCalledTimes(1);
      await expectPaymentPreserved(f);
    });
    it.each(["quote fee", "provider cost", "quote token", "quote expiry"])(
      "rechecks a renewed %s changed during the wallet read before purchasing any label", async change => {
        const f = await paidRenewal();
        await expire(f);
        vi.mocked(shippingProvider.quotes).mockResolvedValue([freshRate(f)]);
        vi.mocked(shippingProvider.wallet).mockImplementationOnce(async () => {
          const d = await prisma.delivery.findUniqueOrThrow({ where: { id: f.d.id } });
          const fields = change === "quote fee" ? { amountMinor: 1500n }
            : change === "provider cost" ? { walletMinor: 1500n }
              : change === "quote token" ? { requestToken: "concurrently-changed-token" }
                : { expiresAt: new Date(0) };
          await prisma.deliveryQuote.update({ where: { id: d.selectedQuoteId! }, data: fields });
          return 1000000n;
        });
        mockBooking(f);
        await runDeliveryJobs();
        expect(await prisma.delivery.findUniqueOrThrow({ where: { id: f.d.id } })).toMatchObject({
          status: "BOOKING_BLOCKED", failureCode: change === "quote expiry" ? "QUOTE_EXPIRED" : "STALE_DELIVERY_QUOTE",
          paidMinor: f.q.amountMinor, shippingMinor: f.q.amountMinor, bookingStartedAt: null, providerShipmentId: null,
        });
        expect(shippingProvider.book).not.toHaveBeenCalled();
        await expectPaymentPreserved(f);
      },
    );
    it("retains the existing explicit shortfall checkout after a renewed price increase is held", async () => {
      const f = await paidRenewal();
      await expire(f);
      const increased = { ...freshRate(f), amountMinor: 1500n, walletMinor: 1500n };
      vi.mocked(shippingProvider.quotes).mockResolvedValue([increased]);
      await runDeliveryJobs();
      await expectPaymentPreserved(f);
      expect(shippingProvider.book).not.toHaveBeenCalled();
      expect((await request(app).post(`/v1/orders/${f.o.id}/delivery/refresh-quote`).set(customerAuth()).send({})).status).toBe(200);
      const topup = await checkout(f.o.id, "DELIVERY_TOPUP");
      expect(topup).toMatchObject({ amountMinor: 500n, produceMinor: 0n, shippingMinor: 500n });
      mockReceipt(topup);
      await reconcilePayment(topup.id);
      vi.mocked(shippingProvider.book).mockResolvedValue({
        id: `SB-topup-${f.d.id}`, status: "pending", courier: f.q.courier, shippingMinor: 1500n,
      });
      await runDeliveryJobs();
      await reconcilePayment(f.a.id);
      await reconcilePayment(topup.id);
      await runDeliveryJobs();
      expect(shippingProvider.book).toHaveBeenCalledTimes(1);
      expect(await prisma.delivery.findUniqueOrThrow({ where: { id: f.d.id } })).toMatchObject({
        status: "BOOKED", paidMinor: 1500n, shippingMinor: 1500n, failureCode: null,
      });
      expect(await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: f.a.id } })).toMatchObject({
        status: "SUCCEEDED", quoteId: f.q.id, amountMinor: f.a.amountMinor, shippingMinor: 1000n,
      });
      expect(await prisma.paymentAttempt.count({ where: { orderId: f.o.id } })).toBe(2);
      expect(await prisma.escrowEntry.count({ where: { orderId: f.o.id, kind: "FUND" } })).toBe(1);
      expect(await prisma.moneyOperation.count({ where: { orderId: f.o.id, kind: { not: "CHECKOUT" } } })).toBe(0);
    });
    it("never requotes or repeats an ambiguous label purchase after successful renewal", async () => {
      const f = await paidRenewal();
      await expire(f);
      vi.mocked(shippingProvider.quotes).mockResolvedValue([freshRate(f)]);
      vi.mocked(shippingProvider.book).mockRejectedValue(new AppError(503, "DELIVERY_PROVIDER_UNAVAILABLE", "Label response was lost"));
      await runDeliveryJobs();
      await prisma.delivery.update({ where: { id: f.d.id }, data: { nextSyncAt: new Date() } });
      await runDeliveryJobs();
      expect(await prisma.delivery.findUniqueOrThrow({ where: { id: f.d.id } })).toMatchObject({
        status: "BOOKING_UNCERTAIN", failureCode: "BOOKING_RESULT_UNKNOWN", providerShipmentId: null,
      });
      expect((await request(app).post(`/v1/orders/${f.o.id}/delivery/book`).set(customerAuth()).send({})).status).toBe(202);
      await runDeliveryJobs();
      expect(shippingProvider.quotes).toHaveBeenCalledTimes(1);
      expect(shippingProvider.book).toHaveBeenCalledTimes(1);
      expect(await prisma.shipment.count({ where: { orderId: f.o.id } })).toBe(0);
      await expectPaymentPreserved(f);
    });
    it("does not renew past the existing fulfillment/refund cutoff", async () => {
      const f = await paidRenewal();
      await expire(f);
      getConfig().PAYMENT_AUTO_REFUNDS_ENABLED = true;
      await prisma.fulfillmentDeadline.create({ data: {
        orderId: f.o.id, paymentId: f.a.id, mode: "sandbox", confirmedAt: new Date(Date.now() - 3 * 3600000), refundDueAt: new Date(0),
      } });
      await runDeliveryJobs();
      expect(shippingProvider.quotes).not.toHaveBeenCalled();
      expect(shippingProvider.book).not.toHaveBeenCalled();
      expect(await prisma.delivery.findUniqueOrThrow({ where: { id: f.d.id } })).toMatchObject({
        status: "BOOKING_BLOCKED", failureCode: "FULFILLMENT_REFUND_DUE", bookingStartedAt: null,
      });
      await expectPaymentPreserved(f);
    });
    it("does not silently reschedule a past pickup date when renewing an expired quote", async () => {
      const f = await paidRenewal();
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(Date.now() + 2 * 86400000);
      await runDeliveryJobs();
      expect(await prisma.delivery.findUniqueOrThrow({ where: { id: f.d.id } })).toMatchObject({
        status: "BOOKING_BLOCKED", failureCode: "INVALID_PICKUP_DATE", providerShipmentId: null, bookingStartedAt: null,
      });
      expect(shippingProvider.quotes).not.toHaveBeenCalled();
      expect(shippingProvider.book).not.toHaveBeenCalled();
      await expectPaymentPreserved(f);
    });
    it("rotates a full page of waiting farmers so a later ready order can be booked", async () => {
      for (let index = 0; index < 11; index++) await paidRenewal(1, true);
      const ready = await paidRenewal();
      await prisma.delivery.update({ where: { id: ready.d.id }, data: { status: "PAID" } });
      mockBooking(ready);
      await runDeliveryJobs();
      await runDeliveryJobs();
      expect((await prisma.delivery.findUniqueOrThrow({ where: { id: ready.d.id } })).status).toBe("BOOKED");
      expect(shippingProvider.book).toHaveBeenCalledTimes(1);
      expect(shippingProvider.quotes).not.toHaveBeenCalled();
      expect(await prisma.deliveryEvent.count({ where: { delivery: { orderId: { in: renewalOrders.slice(0, 11) } }, status: "BOOKING_BLOCKED" } })).toBe(0);
      await expectPaymentPreserved(ready);
    });
  });
});
