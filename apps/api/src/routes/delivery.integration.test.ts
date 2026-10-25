import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { prisma } from "@leetlogic/database";
import { createApp } from "../app.js";
import { createSession } from "../services/sessions.js";
import { getConfig } from "../config.js";
import { redis } from "../lib/redis.js";
import { signAccessToken, verifyAccessToken } from "../lib/tokens.js";
import { applyTracking, runDeliveryJobs, shippingProvider } from "../services/delivery.js";
import { translateResource } from "../services/translation.js";
const suite = process.env.DELIVERY_INTEGRATION === "1" ? describe : describe.skip;
suite("delivery and language database workflows", () => {
  const app = createApp();
  const providerId = `SB-${randomUUID()}`;
  let buyer: string,
    seller: string,
    outsider: string,
    staff: string,
    orderId: string,
    listingId: string,
    farmerId: string,
    categoryId: string,
    addressId: string,
    deliveryId: string,
    quoteId: string;
  const contact = {
    name: "Example Farmer",
    phone: "+2348012345678",
    email: "farmer@example.test",
    address: "12 Example Road Lagos",
    state: "Lagos",
    country: "NG",
  };
  const input = {
    pickup: contact,
    destination: { ...contact, address: "15 Buyer Road Lagos" },
    parcel: {
      weightKg: 3,
      length: 10,
      width: 10,
      height: 10,
      pickupDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      handling: "STANDARD",
    },
  };
  beforeAll(async () => {
    const c = getConfig();
    const month = new Date().toISOString().slice(0, 7);
    await prisma.translationUsage.upsert({
      where: { month },
      create: { month },
      update: { characters: 0 },
    });
    c.DELIVERY_ENABLED = true;
    c.SHIPBUBBLE_API_KEY = "fixture";
    c.SHIPBUBBLE_TEST_KEY_CONFIRMED = true;
    c.TRANSLATION_ENABLED = true;
    c.AZURE_TRANSLATOR_KEY = "fixture";
    c.AZURE_TRANSLATOR_REGION = "fixture";
    const users = await Promise.all(
      ["buyer", "farmer", "outsider"].map((label, i) =>
        prisma.user.create({
          data: {
            phoneE164: `+234${i + 7}${Date.now().toString().slice(-9)}`,
            profile: { create: { displayName: label } },
          },
        }),
      ),
    );
    const buyerUser = users[0]!,
      sellerUser = users[1]!,
      outsiderUser = users[2]!;
    buyer = (
      await createSession({
        subject: "CUSTOMER",
        principalId: buyerUser.id,
        deviceId: randomUUID(),
      })
    ).accessToken;
    seller = (
      await createSession({
        subject: "CUSTOMER",
        principalId: sellerUser.id,
        deviceId: randomUUID(),
      })
    ).accessToken;
    outsider = (
      await createSession({
        subject: "CUSTOMER",
        principalId: outsiderUser.id,
        deviceId: randomUUID(),
      })
    ).accessToken;
    farmerId = (
      await prisma.farmerProfile.create({
        data: {
          userId: sellerUser.id,
          farmName: "Delivery Test Farm",
          farmType: "CROP",
          verificationStatus: "APPROVED",
        },
      })
    ).id;
    addressId = (
      await prisma.address.create({
        data: {
          userId: sellerUser.id,
          state: "Lagos",
          city: "Lagos",
          lga: "Ikeja",
          line1: contact.address,
        },
      })
    ).id;
    categoryId = (await prisma.category.create({ data: { slug: `delivery-${randomUUID()}` } })).id;
    await prisma.unit.upsert({
      where: { code: "KG" },
      create: { code: "KG", name: "Kilogram", allowsDecimal: true },
      update: {},
    });
    listingId = (
      await prisma.listing.create({
        data: {
          farmerProfileId: farmerId,
          categoryId,
          unitCode: "KG",
          locationAddressId: addressId,
          title: "Dry beans",
          description: "20 kg for ₦2,000",
          unitPriceMinor: 10000n,
          availableQuantity: "20",
          reservedQuantity: "1",
          shippingScope: "NATIONWIDE",
          status: "ACTIVE",
        },
      })
    ).id;
    orderId = (
      await prisma.tradeOrder.create({
        data: {
          reference: `TEST-${randomUUID()}`,
          buyerId: buyerUser.id,
          farmerProfileId: farmerId,
          listingId,
          quantity: "1",
          totalMinor: 10000n,
        },
      })
    ).id;
    const role = await prisma.adminRole.create({
      data: { code: `DELIVERY_${randomUUID()}`, name: "Delivery integration" },
    });
    for (const code of ["orders.read", "orders.manage", "payments.manage", "catalog.manage"]) {
      const p = await prisma.permission.upsert({
        where: { code },
        create: { code, description: code },
        update: {},
      });
      await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: p.id } });
    }
    const admin = await prisma.adminAccount.create({
      data: {
        email: `delivery-${randomUUID()}@example.test`,
        fullName: "Test Operator",
        status: "ACTIVE",
        roles: { create: { roleId: role.id } },
      },
    });
    const token = (
      await createSession({ subject: "ADMIN", principalId: admin.id, deviceId: randomUUID() })
    ).accessToken;
    staff = signAccessToken({
      ...verifyAccessToken(token, "admin"),
      stepUpAt: Math.floor(Date.now() / 1000),
    });
    c.DELIVERY_ALLOWED_CATEGORIES = categoryId;
    c.DELIVERY_ALLOWED_STATES = "Lagos";
  });
  afterAll(async () => {
    vi.restoreAllMocks();
    await redis().quit();
    await prisma.$disconnect();
  });
  const customer = () => ({ Authorization: `Bearer ${buyer}` });
  const admin = () => ({ Authorization: `Bearer ${staff}` });
  it("restricts order access to buyer, farmer and permitted staff", async () => {
    expect((await request(app).get(`/v1/orders/${orderId}/delivery`)).status).toBe(401);
    expect(
      (
        await request(app)
          .get(`/v1/orders/${orderId}/delivery`)
          .set({ Authorization: `Bearer ${outsider}` })
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .get(`/v1/orders/${orderId}/delivery`)
          .set({ Authorization: `Bearer ${seller}` })
      ).status,
    ).toBe(200);
  });
  it("defaults to the farm and lets only its farmer change an unpaid order pickup", async () => {
    const farmer = await prisma.farmerProfile.update({
      where: { id: farmerId },
      data: { primaryAddressId: addressId },
    });
    const sourceOrder = await prisma.tradeOrder.findUniqueOrThrow({ where: { id: orderId } });
    const order = await prisma.tradeOrder.create({
      data: {
        reference: `PICKUP-${randomUUID()}`,
        buyerId: sourceOrder.buyerId,
        farmerProfileId: farmerId,
        listingId,
        quantity: "1",
        totalMinor: 10000n,
      },
    });
    const path = `/v1/orders/${order.id}/delivery`;
    const sellerAuth = { Authorization: `Bearer ${seller}` };
    const catalogue = await request(app).get("/v1/listing-drafts/catalogue").set(sellerAuth);
    expect(catalogue.body.primaryAddressId).toBe(addressId);
    expect((await request(app).get(path).set(customer())).body.order.suggestedPickup.address).toBe(
      contact.address,
    );
    const alternate = await prisma.address.create({
      data: {
        userId: farmer.userId,
        state: "Lagos",
        city: "Ikeja",
        lga: "Ikeja",
        line1: "25 Collection Centre Road",
        label: "Collection centre",
      },
    });
    expect(
      (await request(app).post(`${path}/pickup`).set(customer()).send({ addressId: alternate.id }))
        .status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .post(`${path}/pickup`)
          .set({ Authorization: `Bearer ${outsider}` })
          .send({ addressId: alternate.id })
      ).status,
    ).toBe(404);
    expect(
      (await request(app).post(`${path}/pickup`).set(sellerAuth).send({ addressId: randomUUID() }))
        .status,
    ).toBe(422);
    expect(
      (await request(app).post(`${path}/pickup`).set(sellerAuth).send({ addressId: alternate.id }))
        .status,
    ).toBe(200);
    const detail = await request(app).get(path).set(customer());
    expect(detail.body.order.suggestedPickup.address).toContain(alternate.line1);
    expect(
      (await prisma.listing.findUniqueOrThrow({ where: { id: listingId } })).locationAddressId,
    ).toBe(addressId);
    const quotes = vi.spyOn(shippingProvider, "quotes").mockResolvedValue([
      {
        courierId: "test",
        courier: "Test courier",
        amountMinor: 500n,
        walletMinor: 500n,
        requestToken: "pickup-fixture",
        serviceCode: "pickup-fixture",
        eta: "1 day",
      },
    ]);
    expect((await request(app).post(`${path}/quotes`).set(customer()).send(input)).status).toBe(
      422,
    );
    const valid = {
      ...input,
      pickup: { ...contact, address: detail.body.order.suggestedPickup.address },
    };
    const quoted = await request(app).post(`${path}/quotes`).set(customer()).send(valid);
    expect(quoted.status).toBe(200);
    const oldQuote = quoted.body.items[0].id;
    expect(
      (await request(app).post(`${path}/pickup`).set(sellerAuth).send({ addressId })).status,
    ).toBe(200);
    expect(
      (await request(app).post(`${path}/select`).set(customer()).send({ quoteId: oldQuote }))
        .status,
    ).toBe(409);
    expect(
      await prisma.deliveryQuote.count({ where: { deliveryId: detail.body.delivery.id } }),
    ).toBe(0);
    await prisma.tradeOrder.update({ where: { id: order.id }, data: { status: "FUNDED" } });
    expect(
      (await request(app).post(`${path}/pickup`).set(sellerAuth).send({ addressId: alternate.id }))
        .status,
    ).toBe(409);
    quotes.mockRestore();
  });
  it("stores only the signed-in farmer’s valid map pin and keeps it out of public listings", async () => {
    const sellerAuth = { Authorization: `Bearer ${seller}` };
    const point = { latitude: 6.524379, longitude: 3.379206 };
    expect(
      (await request(app).patch("/v1/me/farm-location").set(sellerAuth).send(point)).status,
    ).toBe(200);
    const saved = await prisma.address.findUniqueOrThrow({ where: { id: addressId } });
    expect(Number(saved.latitude)).toBe(point.latitude);
    expect(Number(saved.longitude)).toBe(point.longitude);
    expect(
      (
        await request(app)
          .patch("/v1/me/farm-location")
          .set({ Authorization: `Bearer ${outsider}` })
          .send(point)
      ).status,
    ).toBe(422);
    expect(
      (
        await request(app)
          .patch("/v1/me/farm-location")
          .set(sellerAuth)
          .send({ ...point, latitude: 91 })
      ).status,
    ).toBe(422);
    expect(
      (
        await request(app)
          .patch("/v1/me/farm-location")
          .set(sellerAuth)
          .send({ ...point, addressId })
      ).status,
    ).toBe(422);
    const order = await request(app).get(`/v1/orders/${orderId}/delivery`).set(customer());
    expect(order.body.order.suggestedPickup.latitude).toBe(point.latitude);
    const publicListing = await request(app).get(`/v1/marketplace/listings/${listingId}`);
    expect(publicListing.status).toBe(200);
    expect(publicListing.body.item.locationAddress).not.toHaveProperty("latitude");
    expect(publicListing.body.item.locationAddress).not.toHaveProperty("longitude");
  });
  it("routes special handling to manual review and serves real quotes without provider tokens", async () => {
    const quotes = vi.spyOn(shippingProvider, "quotes").mockResolvedValue([
      {
        courierId: "test-courier",
        walletMinor: 1000n,
        requestToken: "provider-secret",
        serviceCode: "courier",
        courier: "Courier",
        amountMinor: 1000n,
        eta: "Tomorrow",
      },
    ]);
    const manual = await request(app)
      .post(`/v1/orders/${orderId}/delivery/quotes`)
      .set(customer())
      .send({ ...input, parcel: { ...input.parcel, handling: "COLD_CHAIN" } });
    expect(manual.status).toBe(202);
    expect(quotes).not.toHaveBeenCalled();
    const result = await request(app)
      .post(`/v1/orders/${orderId}/delivery/quotes`)
      .set(customer())
      .send(input);
    expect(result.status).toBe(200);
    expect(result.body.items[0].requestToken).toBeUndefined();
    quoteId = result.body.items[0].id;
    deliveryId = (await prisma.delivery.findUniqueOrThrow({ where: { orderId } })).id;
    expect(
      (
        await request(app)
          .post(`/v1/orders/${orderId}/delivery/select`)
          .set({ Authorization: `Bearer ${seller}` })
          .send({ quoteId })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .post(`/v1/orders/${orderId}/delivery/select`)
          .set(customer())
          .send({ quoteId })
      ).status,
    ).toBe(200);
  });
  it("rejects expired quotes and matches shipping payment without changing produce escrow", async () => {
    await prisma.deliveryQuote.update({ where: { id: quoteId }, data: { expiresAt: new Date(0) } });
    expect(
      (
        await request(app)
          .post(`/v1/orders/${orderId}/delivery/select`)
          .set(customer())
          .send({ quoteId })
      ).status,
    ).toBe(409);
    await prisma.deliveryQuote.update({
      where: { id: quoteId },
      data: { expiresAt: new Date(Date.now() + 600000) },
    });
    expect(
      (
        await request(app)
          .post(`/v1/admin/delivery-orders/${orderId}/delivery/payment`)
          .set(admin())
          .send({ amountMinor: "900", reference: randomUUID() })
      ).status,
    ).toBe(409);
    expect(
      (
        await request(app)
          .post(`/v1/admin/delivery-orders/${orderId}/delivery/payment`)
          .set(admin())
          .send({ amountMinor: "1000", reference: randomUUID() })
      ).status,
    ).toBe(200);
    expect((await prisma.tradeOrder.findUniqueOrThrow({ where: { id: orderId } })).heldMinor).toBe(
      0n,
    );
    expect(
      (await request(app).post(`/v1/orders/${orderId}/delivery/book`).set(customer()).send({}))
        .status,
    ).toBe(409);
  });
  it("does not repeat an uncertain booking, including after a worker restart", async () => {
    // The schema can contain earlier runs' shipments. Worker-wide reconciliation
    // must never contact the real carrier while this booking fixture runs.
    vi.spyOn(shippingProvider, "wallet").mockResolvedValue(1000000n);
    const backgroundTrack = vi
      .spyOn(shippingProvider, "track")
      .mockRejectedValue(new Error("Fixture tracking unavailable"));
    const backgroundCancel = vi
      .spyOn(shippingProvider, "cancel")
      .mockRejectedValue(new Error("Fixture cancellation unavailable"));
    try {
      await prisma.tradeOrder.update({
        where: { id: orderId },
        data: { status: "FUNDED", heldMinor: 10000n },
      });
      const book = vi
        .spyOn(shippingProvider, "book")
        .mockRejectedValue(new Error("provider timeout"));
      expect(
        (await request(app).post(`/v1/orders/${orderId}/delivery/book`).set(customer()).send({}))
          .status,
      ).toBe(202);
      await runDeliveryJobs();
      await runDeliveryJobs();
      expect(book).toHaveBeenCalledTimes(1);
      const refund = await request(app)
        .post(`/v1/admin/orders/${orderId}/escrow`)
        .set(admin())
        .send({
          kind: "REFUND",
          amountMinor: "10000",
          reason: "Attempt while delivery remains uncertain",
          mutationKey: randomUUID(),
        });
      expect(refund.status).toBe(409);
      expect(refund.body.error.code).toBe("DELIVERY_ACTIVE");
      expect((await prisma.delivery.findUniqueOrThrow({ where: { id: deliveryId } })).status).toBe(
        "BOOKING_UNCERTAIN",
      );
      await request(app).post(`/v1/orders/${orderId}/delivery/book`).set(customer()).send({});
      await runDeliveryJobs();
      expect(book).toHaveBeenCalledTimes(1);
      await prisma.delivery.update({
        where: { id: deliveryId },
        data: { status: "BOOKING", leaseUntil: new Date(0) },
      });
      await runDeliveryJobs();
      expect(book).toHaveBeenCalledTimes(1);
    } finally {
      backgroundTrack.mockRestore();
      backgroundCancel.mockRestore();
    }
  });
  it("uses authenticated tracking after webhooks; carrier delivery does not confirm recipient or release escrow", async () => {
    const track = vi.spyOn(shippingProvider, "track").mockResolvedValue({
      id: providerId,
      status: "in_transit",
      courier: "Courier",
      pickupAddress: input.pickup.address,
      destinationAddress: input.destination.address,
      shippingMinor: 1000n,
    });
    expect(
      (
        await request(app)
          .post(`/v1/admin/delivery-orders/${orderId}/delivery/link`)
          .set(admin())
          .send({
            providerShipmentId: providerId,
            reason: "Addresses and amount match the provider booking",
          })
      ).status,
    ).toBe(200);
    await request(app)
      .post("/v1/webhooks/shipbubble")
      .send({ order_id: providerId, status: "completed" });
    expect((await prisma.delivery.findUniqueOrThrow({ where: { id: deliveryId } })).status).toBe(
      "BOOKED",
    );
    await applyTracking(deliveryId, { id: providerId, status: "completed", courier: "Courier" });
    await applyTracking(deliveryId, { id: providerId, status: "picked_up", courier: "Courier" });
    expect((await prisma.delivery.findUniqueOrThrow({ where: { id: deliveryId } })).status).toBe(
      "DELIVERED",
    );
    expect(
      (await prisma.tradeOrder.findUniqueOrThrow({ where: { id: orderId } })).deliveryConfirmedAt,
    ).toBeNull();
    expect(
      (
        await request(app)
          .post(`/v1/orders/${orderId}/delivery/confirm`)
          .set({ Authorization: `Bearer ${seller}` })
          .send({})
      ).status,
    ).toBe(409);
    expect(
      (await request(app).post(`/v1/orders/${orderId}/delivery/confirm`).set(customer()).send({}))
        .status,
    ).toBe(200);
    expect((await prisma.tradeOrder.findUniqueOrThrow({ where: { id: orderId } })).heldMinor).toBe(
      10000n,
    );
    track.mockRestore();
  });
  it("caches translations, invalidates changed sources and enforces monthly quota", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, options) => {
      const sent = JSON.parse(options!.body as string)[0].Text;
      return Response.json([{ translations: [{ text: `Igbo: ${sent}` }] }]);
    });
    const input = {
      resourceType: "listings",
      resourceId: listingId,
      sourceLocale: "en",
      targetLocale: "ig",
      text: "20 kg for ₦2,000",
    };
    const first = await translateResource(input);
    expect(first.translated).toBe(true);
    expect(first.text).toContain("₦2,000");
    await translateResource(input);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await translateResource({ ...input, text: "30 kg for ₦3,000" });
    expect(fetcher).toHaveBeenCalledTimes(2);
    const concurrent = await Promise.all([
      translateResource({ ...input, text: "Concurrent source" }),
      translateResource({ ...input, text: "Concurrent source" }),
    ]);
    expect(concurrent.some((x) => x.translated)).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(3);
    const month = new Date().toISOString().slice(0, 7);
    await prisma.translationUsage.update({
      where: { month },
      data: { characters: getConfig().TRANSLATION_MONTHLY_CAP },
    });
    expect((await translateResource({ ...input, text: "new text" })).reason).toBe(
      "TRANSLATION_QUOTA_REACHED",
    );
    expect(fetcher).toHaveBeenCalledTimes(3);
    fetcher.mockRestore();
  });
  it("keeps private support messages private and persists language preferences", async () => {
    await prisma.language.upsert({
      where: { code: "ig" },
      create: { code: "ig", name: "Igbo", nativeName: "Igbo", sortOrder: 3, isEnabled: true },
      update: { isEnabled: true },
    });
    expect(
      (await request(app).patch("/v1/me/locale").set(customer()).send({ locale: "ig" })).status,
    ).toBe(200);
    const ticket = await prisma.supportTicket.create({
      data: { subject: "Private", userId: verifyAccessToken(buyer, "customer").sub, orderId },
    });
    const message = await prisma.supportMessage.create({
      data: {
        ticketId: ticket.id,
        authorId: verifyAccessToken(staff, "admin").sub,
        body: "Private note",
        internal: true,
      },
    });
    expect(
      (await request(app).get(`/v1/translations/messages/${message.id}?locale=ig`).set(customer()))
        .status,
    ).toBe(404);
    await prisma.supportMessage.update({ where: { id: message.id }, data: { internal: false } });
    expect(
      (
        await request(app)
          .get(`/v1/translations/messages/${message.id}?locale=ig`)
          .set({ Authorization: `Bearer ${outsider}` })
      ).status,
    ).toBe(404);
  });
  it("handles manual dispatch, delivery evidence and immutable tracking events", async () => {
    const order = await prisma.tradeOrder.create({
      data: {
        reference: `MANUAL-${randomUUID()}`,
        buyerId: verifyAccessToken(buyer, "customer").sub,
        farmerProfileId: farmerId,
        listingId,
        quantity: "1",
        totalMinor: 10000n,
        heldMinor: 10000n,
        status: "FUNDED",
        delivery: { create: { status: "MANUAL_REVIEW" } },
      },
      include: { delivery: true },
    });
    const base = `/v1/admin/delivery-orders/${order.id}/delivery`;
    expect(
      (
        await request(app).post(`${base}/manual-dispatch`).set(admin()).send({
          carrier: "Local carrier",
          trackingRef: randomUUID(),
          reason: "Confirmed manual produce transport arrangement",
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .post(`${base}/manual-status`)
          .set(admin())
          .send({ status: "DELIVERED", evidence: "Recipient confirmed arrival" })
      ).status,
    ).toBe(409);
    expect(
      (
        await request(app)
          .post(`${base}/manual-status`)
          .set(admin())
          .send({ status: "IN_TRANSIT", evidence: "Carrier confirmed pickup and departure" })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .post(`${base}/manual-status`)
          .set(admin())
          .send({ status: "DELIVERED", evidence: "Carrier reported package arrived" })
      ).status,
    ).toBe(200);
    expect(
      (await prisma.tradeOrder.findUniqueOrThrow({ where: { id: order.id } })).deliveryConfirmedAt,
    ).toBeNull();
    const event = await prisma.deliveryEvent.findFirstOrThrow({
      where: { deliveryId: order.delivery!.id },
    });
    await expect(
      prisma.deliveryEvent.update({ where: { id: event.id }, data: { status: "CANCELLED" } }),
    ).rejects.toThrow();
    expect(await prisma.deliveryNotification.count({ where: { eventId: event.id } })).toBe(2);
  });
  it("cancels once and reconciles without implying an external refund", async () => {
    const providerShipmentId = `SB-CANCEL-${randomUUID()}`;
    const order = await prisma.tradeOrder.create({
      data: {
        reference: `CANCEL-${randomUUID()}`,
        buyerId: verifyAccessToken(buyer, "customer").sub,
        farmerProfileId: farmerId,
        listingId,
        quantity: "1",
        totalMinor: 10000n,
        heldMinor: 10000n,
        status: "FUNDED",
        delivery: {
          create: { status: "BOOKED", providerShipmentId, shippingMinor: 1000n, paidMinor: 1000n },
        },
      },
      include: { delivery: true },
    });
    const cancel = vi.spyOn(shippingProvider, "cancel").mockResolvedValue();
    const track = vi.spyOn(shippingProvider, "track").mockImplementation(async (id) => ({
      id,
      status: id === providerShipmentId ? "cancelled" : "completed",
      courier: "Courier",
    }));
    const result = await request(app)
      .post(`/v1/admin/delivery-orders/${order.id}/delivery/cancel`)
      .set(admin())
      .send({ reason: "Buyer asked to cancel before pickup" });
    expect(result.status).toBe(202);
    expect(result.body.message).toContain("no external refund");
    await runDeliveryJobs();
    await runDeliveryJobs();
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(
      (await prisma.delivery.findUniqueOrThrow({ where: { id: order.delivery!.id } })).status,
    ).toBe("CANCELLED");
    expect(
      (await prisma.tradeOrder.findUniqueOrThrow({ where: { id: order.id } })).refundedMinor,
    ).toBe(0n);
    cancel.mockRestore();
    track.mockRestore();
  });
  it("moves legacy product categories into broad groups without losing listings or drafts", async () => {
    const { seedCatalogue } = await import(
      new URL("../../../../packages/database/prisma/seed-catalogue.ts", import.meta.url).href
    );
    const old = await prisma.category.upsert({
      where: { slug: "tomatoes" },
      create: { slug: "tomatoes" },
      update: { isActive: true },
    });
    const draft = await prisma.listingDraft.create({
      data: {
        userId: verifyAccessToken(seller, "customer").sub,
        fields: { categoryId: old.id, title: "My tomatoes", quantity: "3" },
      },
    });
    await prisma.listing.update({ where: { id: listingId }, data: { categoryId: old.id } });
    try {
      await seedCatalogue(prisma);
      await seedCatalogue(prisma);
      const target = await prisma.category.findUniqueOrThrow({ where: { slug: "vegetables" } });
      expect(
        (await prisma.listing.findUniqueOrThrow({ where: { id: listingId } })).categoryId,
      ).toBe(target.id);
      expect(
        (await prisma.listingDraft.findUniqueOrThrow({ where: { id: draft.id } })).fields,
      ).toEqual({ categoryId: target.id, title: "My tomatoes", quantity: "3" });
      const catalogue = await request(app)
        .get("/v1/listing-drafts/catalogue")
        .set({ Authorization: `Bearer ${seller}` });
      expect(catalogue.body.categoryAliases[old.id]).toBe(target.id);
      expect(
        catalogue.body.categories.some((item: { slug: string }) => item.slug === "tomatoes"),
      ).toBe(false);
      expect(
        catalogue.body.categories.filter((item: { slug: string }) => item.slug === "vegetables"),
      ).toHaveLength(1);
      const publicCategories = await request(app).get("/v1/marketplace/categories");
      expect(publicCategories.body.items.some((item: { id: string }) => item.id === old.id)).toBe(
        false,
      );
    } finally {
      await prisma.listing.update({ where: { id: listingId }, data: { categoryId } });
    }
  });
  it("keeps voice gated and requires explicit confirmation for owned typed drafts", async () => {
    expect(
      (
        await request(app)
          .get("/v1/listing-drafts/capabilities")
          .set({ Authorization: `Bearer ${seller}` })
      ).body.voice.enabled,
    ).toBe(false);
    const photo = await prisma.producePhoto.create({
      data: {
        userId: verifyAccessToken(seller, "customer").sub,
        mimeType: "image/jpeg",
        checksum: "a".repeat(64),
        storageKey: `test/${randomUUID()}`,
      },
    });
    const result = await request(app)
      .post("/v1/listing-drafts")
      .set({ Authorization: `Bearer ${seller}` })
      .send({
        title: "Beans",
        description: "Dry beans",
        quantity: "2",
        unitCode: "KG",
        unitPriceMinor: "2500",
        categoryId,
        addressId,
        sourceLocale: "ig",
        photoId: photo.id,
      });
    expect(result.status).toBe(201);
    expect(
      (
        await request(app)
          .post(`/v1/listing-drafts/${result.body.id}/submit`)
          .set({ Authorization: `Bearer ${seller}` })
          .send({ confirmed: false })
      ).status,
    ).toBe(422);
    expect(
      (
        await request(app)
          .post(`/v1/listing-drafts/${result.body.id}/submit`)
          .set(customer())
          .send({ confirmed: true })
      ).status,
    ).toBe(404);
    const submit = await request(app)
      .post(`/v1/listing-drafts/${result.body.id}/submit`)
      .set({ Authorization: `Bearer ${seller}` })
      .send({ confirmed: true });
    expect(submit.status).toBe(201);
    expect(submit.body.listing.status).toBe("PENDING_REVIEW");
    expect(
      (
        await request(app)
          .post(`/v1/listing-drafts/${result.body.id}/submit`)
          .set({ Authorization: `Bearer ${seller}` })
          .send({ confirmed: true })
      ).body.listing.id,
    ).toBe(submit.body.listing.id);
  });
  it("keeps photo ownership, cover order, whole-unit quantities and moderation authoritative", async () => {
    const sellerAuth = { Authorization: `Bearer ${seller}` };
    await prisma.unit.upsert({
      where: { code: "BASKET" },
      create: { code: "BASKET", name: "Basket", allowsDecimal: false },
      update: { allowsDecimal: false },
    });
    const photos = await Promise.all(
      Array.from({ length: 4 }, () =>
        prisma.producePhoto.create({
          data: {
            userId: verifyAccessToken(seller, "customer").sub,
            mimeType: "image/jpeg",
            checksum: "c".repeat(64),
            storageKey: `test/${randomUUID()}`,
          },
        }),
      ),
    );
    const foreign = await prisma.producePhoto.create({
      data: {
        userId: verifyAccessToken(outsider, "customer").sub,
        mimeType: "image/jpeg",
        checksum: "d".repeat(64),
        storageKey: `test/${randomUUID()}`,
      },
    });
    const fields = {
      title: "Fresh tomatoes",
      description: "Harvested this morning",
      sourceLocale: "en",
      categoryId,
      unitCode: "BASKET",
      quantity: "1.5",
      unitPriceMinor: "800000",
      addressId,
      shippingScope: "LOCAL",
      photoIds: photos.map((photo) => photo.id).reverse(),
    };
    const draft = await request(app).post("/v1/listing-drafts").set(sellerAuth).send(fields);
    const path = `/v1/listing-drafts/${draft.body.id}`;
    const submit = () =>
      request(app).post(`${path}/submit`).set(sellerAuth).send({ confirmed: true });
    expect((await submit()).body.error.code).toBe("WHOLE_UNIT_REQUIRED");
    await request(app)
      .patch(path)
      .set(sellerAuth)
      .send({ ...fields, quantity: "2", photoIds: [] });
    expect((await submit()).body.error.code).toBe("LISTING_PHOTO_REQUIRED");
    await request(app)
      .patch(path)
      .set(sellerAuth)
      .send({ ...fields, quantity: "2", photoIds: [foreign.id] });
    expect((await submit()).body.error.code).toBe("INVALID_PHOTO");
    expect(
      (
        await request(app)
          .patch(path)
          .set(sellerAuth)
          .send({ ...fields, photoIds: [...fields.photoIds, foreign.id] })
      ).status,
    ).toBe(422);
    expect(
      (
        await request(app)
          .patch(path)
          .set(sellerAuth)
          .send({ ...fields, photoIds: [photos[0]!.id, photos[0]!.id] })
      ).status,
    ).toBe(422);
    await request(app)
      .patch(path)
      .set(sellerAuth)
      .send({ ...fields, quantity: "2" });
    const result = await submit();
    expect(result.status).toBe(201);
    expect(result.body.listing.status).toBe("PENDING_REVIEW");
    expect(result.body.listing.shippingScope).toBe("LOCAL");
    const media = await prisma.listingMedia.findMany({
      where: { listingId: result.body.listing.id },
      orderBy: { displayOrder: "asc" },
    });
    expect(media.map((item) => item.objectKey)).toEqual(
      fields.photoIds.map((id) => `produce/${id}`),
    );
    expect((await submit()).body.listing.id).toBe(result.body.listing.id);
    expect(await prisma.listingMedia.count({ where: { listingId: result.body.listing.id } })).toBe(
      4,
    );
  });
  it("does not quote cross-state delivery for a local-only listing", async () => {
    await prisma.listing.update({ where: { id: listingId }, data: { shippingScope: "LOCAL" } });
    const order = await prisma.tradeOrder.create({
      data: {
        reference: `LOCAL-${randomUUID()}`,
        buyerId: verifyAccessToken(buyer, "customer").sub,
        farmerProfileId: farmerId,
        listingId,
        quantity: "1",
        totalMinor: 10000n,
      },
    });
    const result = await request(app)
      .post(`/v1/orders/${order.id}/delivery/quotes`)
      .set(customer())
      .send({ ...input, destination: { ...input.destination, state: "Ebonyi" } });
    expect(result.status).toBe(422);
    expect(result.body.error.code).toBe("DELIVERY_SCOPE_UNSUPPORTED");
    await prisma.listing.update({
      where: { id: listingId },
      data: { shippingScope: "NATIONWIDE" },
    });
  });
  it("exposes only public listing fields and requires customer authentication to order", async () => {
    const listing = await request(app).get(`/v1/marketplace/listings/${listingId}`);
    expect(listing.status).toBe(200);
    expect(listing.body.item.locationAddress.line1).toBeUndefined();
    expect(listing.body.item.farmerProfile.userId).toBeUndefined();
    expect((await request(app).get("/v1/marketplace/categories")).status).toBe(200);
    expect(
      (await request(app).post("/v1/marketplace/orders").send({ listingId, quantity: "1" })).status,
    ).toBe(401);
  });
  it("atomically reserves customer orders and replays concurrent duplicate submissions", async () => {
    const before = await prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
    const key = randomUUID();
    const create = () =>
      request(app)
        .post("/v1/marketplace/orders")
        .set(customer())
        .set("Idempotency-Key", key)
        .send({ listingId, quantity: "2" });
    const [first, second] = await Promise.all([create(), create()]);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body.order.id).toBe(second.body.order.id);
    expect(first.body.order.totalMinor).toBe("20000");
    const after = await prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
    expect(after.reservedQuantity.minus(before.reservedQuantity).toString()).toBe("2");
    expect(
      (
        await request(app)
          .post("/v1/marketplace/orders")
          .set(customer())
          .set("Idempotency-Key", key)
          .send({ listingId, quantity: "3" })
      ).status,
    ).toBe(409);
    expect(
      (
        await request(app)
          .post("/v1/marketplace/orders")
          .set(customer())
          .set("Idempotency-Key", randomUUID())
          .send({ listingId, quantity: "99999" })
      ).status,
    ).toBe(409);
    expect(
      (
        await request(app)
          .post("/v1/marketplace/orders")
          .set({ Authorization: `Bearer ${seller}` })
          .set("Idempotency-Key", randomUUID())
          .send({ listingId, quantity: "1" })
      ).status,
    ).toBe(422);
  });
  it("cancels only owned unpaid customer orders and releases inventory once", async () => {
    const created = await request(app)
      .post("/v1/marketplace/orders")
      .set(customer())
      .set("Idempotency-Key", randomUUID())
      .send({ listingId, quantity: "1" });
    expect(created.status).toBe(201);
    const id = created.body.order.id;
    const before = await prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
    expect(
      (
        await request(app)
          .post(`/v1/marketplace/orders/${id}/cancel`)
          .set({ Authorization: `Bearer ${outsider}` })
      ).status,
    ).toBe(404);
    for (let i = 0; i < 2; i++)
      expect(
        (await request(app).post(`/v1/marketplace/orders/${id}/cancel`).set(customer())).status,
      ).toBe(200);
    const after = await prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
    expect(before.reservedQuantity.minus(after.reservedQuantity).toString()).toBe("1");
  });
  it("saves Nigerian addresses against the signed-in customer only", async () => {
    const saved = await request(app)
      .post("/v1/me/addresses")
      .set(customer())
      .send({
        label: "Home",
        state: "Lagos",
        lga: "Ikeja",
        city: "Lagos",
        line1: "24 Example Road",
        userId: verifyAccessToken(seller, "customer").sub,
        countryCode: "US",
      });
    expect(saved.status).toBe(201);
    expect(saved.body.address.countryCode).toBe("NG");
    expect(saved.body.address.userId).toBe(verifyAccessToken(buyer, "customer").sub);
    expect(
      (
        await request(app)
          .get("/v1/marketplace/my-listings")
          .set({ Authorization: `Bearer ${outsider}` })
      ).body.items,
    ).toHaveLength(0);
  });
  it("keeps seller sales separate from the same user's purchases", async () => {
    const sellerUserId = verifyAccessToken(seller, "customer").sub;
    const buyerUserId = verifyAccessToken(buyer, "customer").sub;
    const anotherFarm = await prisma.farmerProfile.create({
      data: {
        userId: buyerUserId,
        farmName: "Other farm",
        farmType: "CROP",
        verificationStatus: "APPROVED",
      },
    });
    const anotherListing = await prisma.listing.create({
      data: {
        farmerProfileId: anotherFarm.id,
        categoryId,
        unitCode: "KG",
        locationAddressId: addressId,
        title: "Other produce",
        unitPriceMinor: 100n,
        availableQuantity: "5",
        shippingScope: "NATIONWIDE",
        status: "ACTIVE",
      },
    });
    const purchase = await prisma.tradeOrder.create({
      data: {
        reference: `PURCHASE-${randomUUID()}`,
        buyerId: sellerUserId,
        farmerProfileId: anotherFarm.id,
        listingId: anotherListing.id,
        quantity: "1",
        totalMinor: 100n,
      },
    });
    const sales = await request(app)
      .get("/v1/orders?view=seller")
      .set({ Authorization: `Bearer ${seller}` });
    expect(sales.status).toBe(200);
    expect(sales.body.items.length).toBeGreaterThan(0);
    expect(sales.body.items.some((item: { id: string }) => item.id === purchase.id)).toBe(false);
    const purchases = await request(app)
      .get("/v1/orders?view=buyer")
      .set({ Authorization: `Bearer ${seller}` });
    expect(purchases.status).toBe(200);
    expect(purchases.body.items.map((item: { id: string }) => item.id)).toContain(purchase.id);
    expect(
      (
        await request(app)
          .get("/v1/orders?view=seller")
          .set({ Authorization: `Bearer ${outsider}` })
      ).body.items,
    ).toEqual([]);
  });
  it("lists, edits and deletes only owned unsubmitted drafts", async () => {
    const photo = await prisma.producePhoto.create({
      data: {
        userId: verifyAccessToken(seller, "customer").sub,
        mimeType: "image/jpeg",
        checksum: "b".repeat(64),
        storageKey: `test/${randomUUID()}`,
      },
    });
    const fields = {
      photoIds: [photo.id],
      title: "Saved beans",
      description: "",
      sourceLocale: "en",
      categoryId,
      unitCode: "KG",
      quantity: "2",
      unitPriceMinor: "10000",
      addressId,
    };
    const created = await request(app)
      .post("/v1/listing-drafts")
      .set({ Authorization: `Bearer ${seller}` })
      .send(fields);
    expect(created.status).toBe(201);
    const path = `/v1/listing-drafts/${created.body.id}`;
    expect(
      (
        await request(app)
          .get("/v1/listing-drafts")
          .set({ Authorization: `Bearer ${seller}` })
      ).body.items.map((item: { id: string }) => item.id),
    ).toContain(created.body.id);
    expect(
      (
        await request(app)
          .patch(path)
          .set({ Authorization: `Bearer ${outsider}` })
          .send(fields)
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .delete(path)
          .set({ Authorization: `Bearer ${outsider}` })
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .patch(path)
          .set({ Authorization: `Bearer ${seller}` })
          .send({ ...fields, title: "Updated beans" })
      ).status,
    ).toBe(200);
    const submitted = await request(app)
      .post(`${path}/submit`)
      .set({ Authorization: `Bearer ${seller}` })
      .send({ confirmed: true });
    expect(submitted.status).toBe(201);
    expect(
      (
        await request(app)
          .delete(path)
          .set({ Authorization: `Bearer ${seller}` })
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .patch(path)
          .set({ Authorization: `Bearer ${seller}` })
          .send(fields)
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .get("/v1/listing-drafts")
          .set({ Authorization: `Bearer ${seller}` })
      ).body.items.map((item: { id: string }) => item.id),
    ).not.toContain(created.body.id);
    const another = await request(app)
      .post("/v1/listing-drafts")
      .set({ Authorization: `Bearer ${seller}` })
      .send(fields);
    expect(
      (
        await request(app)
          .delete(`/v1/listing-drafts/${another.body.id}`)
          .set({ Authorization: `Bearer ${seller}` })
      ).status,
    ).toBe(204);
  });
  it("protects reserved stock and moderation while allowing audited restock and pause", async () => {
    const item = await prisma.listing.create({
      data: {
        farmerProfileId: farmerId,
        categoryId,
        unitCode: "KG",
        locationAddressId: addressId,
        title: "Stock controls",
        unitPriceMinor: 100n,
        availableQuantity: "5",
        reservedQuantity: "3",
        shippingScope: "NATIONWIDE",
        status: "ACTIVE",
      },
    });
    const path = `/v1/marketplace/my-listings/${item.id}/inventory`;
    const change = (token: string, body: object) =>
      request(app)
        .patch(path)
        .set({ Authorization: `Bearer ${token}` })
        .send(body);
    expect((await change(outsider, { availableQuantity: "10" })).status).toBe(404);
    expect((await change(seller, { availableQuantity: "2" })).body.error.code).toBe(
      "STOCK_RESERVED",
    );
    for (let attempt = 0; attempt < 2; attempt++)
      expect((await change(seller, { availableQuantity: "10" })).status).toBe(200);
    expect(
      (
        await prisma.listing.findUniqueOrThrow({ where: { id: item.id } })
      ).availableQuantity.toString(),
    ).toBe("10");
    expect(await prisma.inventoryMovement.count({ where: { listingId: item.id } })).toBe(1);
    expect((await change(seller, { status: "PAUSED" })).body.item.status).toBe("PAUSED");
    expect(
      (await change(seller, { availableQuantity: "3", status: "ACTIVE" })).body.error.code,
    ).toBe("STOCK_EMPTY");
    await prisma.listing.update({ where: { id: item.id }, data: { status: "PENDING_REVIEW" } });
    expect((await change(seller, { status: "ACTIVE" })).body.error.code).toBe(
      "LISTING_NOT_EDITABLE",
    );
    expect(
      await prisma.auditLog.count({
        where: { entityId: item.id, action: "listing.seller.inventory" },
      }),
    ).toBeGreaterThan(0);
  });
});
