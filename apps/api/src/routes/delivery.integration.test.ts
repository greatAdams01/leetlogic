import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { deleteMedia } from "../services/storage/private-media.js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { prisma, Prisma } from "@leetlogic/database";
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
    c.SHIPBUBBLE_CATEGORY_ID = 24032950;
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
    ).toBe(404);
  });
  it("reports missing pricing configuration without sending the shipment to staff review", async () => {
    const config = getConfig();
    const prior = config.DELIVERY_ALLOWED_STATES;
    const quotes = vi.spyOn(shippingProvider, "quotes");
    try {
      config.DELIVERY_ALLOWED_STATES = " , ";
      const response = await request(app)
        .post(`/v1/orders/${orderId}/delivery/quotes`)
        .set(customer())
        .send(input);
      expect(response.status).toBe(503);
      expect(response.body.error.code).toBe("DELIVERY_CONFIGURATION_REQUIRED");
      expect(JSON.stringify(response.body)).not.toContain("DELIVERY_ALLOWED_STATES");
      expect(quotes).not.toHaveBeenCalled();
      expect(await prisma.delivery.count({ where: { orderId } })).toBe(0);
      expect(await prisma.deliveryEvent.count({ where: { delivery: { orderId } } })).toBe(0);
    } finally {
      config.DELIVERY_ALLOWED_STATES = prior;
      quotes.mockRestore();
    }
  });
  it("keeps the farm pickup visible to the buyer while hiding unpaid checkouts from the farmer", async () => {
    await prisma.farmerProfile.update({
      where: { id: farmerId },
      data: { primaryAddressId: addressId },
    });
    const source = await prisma.tradeOrder.findUniqueOrThrow({ where: { id: orderId } });
    const order = await prisma.tradeOrder.create({
      data: {
        reference: `PICKUP-${randomUUID()}`,
        buyerId: source.buyerId,
        farmerProfileId: farmerId,
        listingId,
        quantity: "1",
        totalMinor: 10000n,
      },
    });
    const path = `/v1/orders/${order.id}/delivery`;
    const sellerAuth = { Authorization: `Bearer ${seller}` };
    const detail = await request(app).get(path).set(customer());
    expect(detail.status).toBe(200);
    expect(detail.body.order.suggestedPickup.address).toBe(`${contact.address}, Lagos, Ikeja`);
    expect((await request(app).get(path).set(sellerAuth)).status).toBe(404);
    expect(
      (await request(app).post(`${path}/pickup`).set(sellerAuth).send({ addressId })).status,
    ).toBe(404);
    expect(
      (await request(app).post(`${path}/pickup`).set(customer()).send({ addressId })).status,
    ).toBe(403);
    await prisma.tradeOrder.update({
      where: { id: order.id },
      data: {
        status: "FUNDED",
        ledger: {
          create: {
            kind: "FUND",
            amountMinor: 10000n,
            actorId: source.buyerId,
            mutationKey: randomUUID(),
            reason: "Confirmed test payment",
          },
        },
      },
    });
    expect((await request(app).get(path).set(sellerAuth)).status).toBe(200);
    expect(
      (await request(app).post(`${path}/pickup`).set(sellerAuth).send({ addressId })).status,
    ).toBe(409);
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
  it("repairs a buyer address saved as pickup and prices canonical farmer pickup with buyer-edited packing", async () => {
    const original = await prisma.tradeOrder.findUniqueOrThrow({ where: { id: orderId } });
    const created = await prisma.tradeOrder.create({
      data: {
        reference: `ADDRESS-${randomUUID()}`,
        buyerId: original.buyerId,
        farmerProfileId: farmerId,
        listingId,
        quantity: "1",
        totalMinor: 10000n,
        feeBasisPoints: 600,
      },
    });
    const path = `/v1/orders/${created.id}/delivery`;
    await prisma.delivery.create({
      data: { orderId: created.id, pickup: input.destination, destination: input.destination },
    });
    const detail = await request(app).get(path).set(customer());
    expect(detail.body.order.suggestedPickup.address).toContain(contact.address);
    expect(detail.body.order.suggestedPickup.address).not.toContain(input.destination.address);
    expect(detail.body.delivery.destination.address).toBe(input.destination.address);
    const quotes = vi.spyOn(shippingProvider, "quotes").mockResolvedValue([
      {
        courierId: "address-test",
        courier: "Address test",
        amountMinor: 800n,
        walletMinor: 800n,
        requestToken: "address-token",
        serviceCode: "pickup",
        eta: "Tomorrow",
      },
    ]);
    try {
      const edited = {
        ...input,
        pickup: detail.body.order.suggestedPickup,
        parcel: {
          ...input.parcel,
          weightKg: 4.5,
          length: 35,
          width: 25,
          height: 20,
          notes: "Keep upright; protect from sunlight",
        },
      };
      // Legacy farmer profiles may not yet contain an email.
      edited.pickup.email ||= contact.email;
      const response = await request(app).post(`${path}/quotes`).set(customer()).send(edited);
      expect(response.status).toBe(200);
      expect(quotes).toHaveBeenLastCalledWith(
        expect.objectContaining({
          pickup: expect.objectContaining({
            address: detail.body.order.suggestedPickup.address,
            phone: detail.body.order.suggestedPickup.phone,
          }),
          destination: expect.objectContaining({ address: input.destination.address }),
          parcel: expect.objectContaining(edited.parcel),
        }),
      );
      const saved = await prisma.delivery.findUniqueOrThrow({ where: { orderId: created.id } });
      expect(saved.pickup).toMatchObject({ address: detail.body.order.suggestedPickup.address });
      expect(saved.destination).toMatchObject({ address: input.destination.address });
      expect(saved.package).toMatchObject(edited.parcel);
    } finally {
      quotes.mockRestore();
    }
  });
  it("snapshots farmer packing, derives order estimates and preserves requirements on buyer edits", async () => {
    const original = await prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
    const packing = {
      unitsPerPackage: 1,
      weightKg: 2,
      length: 40,
      width: 30,
      height: 25,
      handling: "COLD_CHAIN",
      notes: "Keep chilled",
    };
    await prisma.listing.update({ where: { id: listingId }, data: { packaging: packing } });
    try {
      const created = await request(app)
        .post("/v1/marketplace/orders")
        .set(customer())
        .set("Idempotency-Key", randomUUID())
        .send({ listingId, quantity: "1.5" });
      expect(created.status).toBe(201);
      const id = created.body.order.id;
      await prisma.listing.update({
        where: { id: listingId },
        data: { packaging: { ...packing, weightKg: 99, handling: "STANDARD" } },
      });
      const path = `/v1/orders/${id}/delivery`;
      const detail = await request(app).get(path).set(customer());
      expect(detail.body.order.packageSuggestion).toMatchObject({
        packageCount: 2,
        weightKg: 4,
        length: 40,
        width: 30,
        height: 25,
        handling: "COLD_CHAIN",
      });
      expect(
        (
          await request(app)
            .get(path)
            .set({ Authorization: `Bearer ${outsider}` })
        ).status,
      ).toBe(404);
      const invalid = await request(app).post(`${path}/quotes`).set(customer()).send(input);
      expect(invalid.body.error.code).toBe("HANDLING_REQUIRED");
      const delivery = await prisma.delivery.create({ data: { orderId: id } });
      const quote = await prisma.deliveryQuote.create({
        data: {
          deliveryId: delivery.id,
          requestToken: "stale",
          serviceCode: "test",
          courier: "Test",
          amountMinor: 1000n,
          inputHash: "old",
          expiresAt: new Date(Date.now() + 60000),
        },
      });
      await prisma.delivery.update({
        where: { id: delivery.id },
        data: { selectedQuoteId: quote.id, shippingMinor: 1000n },
      });
      const edited = {
        ...input,
        parcel: {
          ...input.parcel,
          packageCount: 2,
          weightKg: 3.5,
          handling: "COLD_CHAIN",
          notes: "Keep chilled and upright",
        },
      };
      expect((await request(app).post(`${path}/quotes`).set(customer()).send(edited)).status).toBe(
        202,
      );
      const saved = await prisma.delivery.findUniqueOrThrow({ where: { id: delivery.id } });
      expect(saved.package).toMatchObject(edited.parcel);
      expect(saved.selectedQuoteId).toBeNull();
      expect(saved.shippingMinor).toBe(0n);
      expect(
        (
          await prisma.deliveryQuote.findUniqueOrThrow({ where: { id: quote.id } })
        ).expiresAt.getTime(),
      ).toBeLessThanOrEqual(Date.now());
      expect(
        (await prisma.tradeOrder.findUniqueOrThrow({ where: { id } })).packagingSnapshot,
      ).toEqual(packing);
      await prisma.tradeOrder.update({ where: { id }, data: { status: "FUNDED" } });
      expect((await request(app).post(`${path}/quotes`).set(customer()).send(edited)).status).toBe(
        409,
      );
    } finally {
      await prisma.listing.update({
        where: { id: listingId },
        data: {
          packaging: original.packaging
            ? (original.packaging as Prisma.InputJsonValue)
            : Prisma.DbNull,
        },
      });
    }
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
    ).toBe(404);
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
        data: {
          status: "FUNDED",
          heldMinor: 10000n,
          ledger: {
            create: {
              kind: "FUND",
              amountMinor: 10000n,
              actorId: verifyAccessToken(buyer, "customer").sub,
              mutationKey: randomUUID(),
              reason: "Confirmed test payment",
            },
          },
        },
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
      pickupAddress: `${input.pickup.address}, Lagos, Ikeja`,
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
  it("persists owned likes and cart items without reserving stock, then checks out atomically and once", async () => {
    const buyerId = verifyAccessToken(buyer, "customer").sub;
    const source = await prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
    const make = () =>
      prisma.listing.create({
        data: {
          farmerProfileId: farmerId,
          categoryId,
          locationAddressId: addressId,
          unitCode: source.unitCode,
          title: "Cart fixture",
          shippingScope: "LOCAL",
          status: "ACTIVE",
          unitPriceMinor: 10000n,
          availableQuantity: 20,
        },
      });
    const first = await make(),
      second = await make();
    const auth = { Authorization: `Bearer ${buyer}` },
      other = { Authorization: `Bearer ${outsider}` };
    expect((await request(app).get("/v1/shopping/cart")).status).toBe(401);
    for (let n = 0; n < 2; n++)
      expect(
        (await request(app).put(`/v1/shopping/likes/${first.id}`).set(auth).send({ liked: true }))
          .status,
      ).toBe(200);
    expect(
      await prisma.likedListing.count({ where: { userId: buyerId, listingId: first.id } }),
    ).toBe(1);
    expect(
      (await request(app).get(`/v1/shopping/listings/${first.id}`).set(other)).body.liked,
    ).toBe(false);
    expect(
      (await request(app).get("/v1/shopping/likes").set(auth)).body.items.some(
        (x: any) => x.listing.id === first.id,
      ),
    ).toBe(true);
    await request(app).put(`/v1/shopping/likes/${first.id}`).set(auth).send({ liked: false });
    expect(
      await prisma.likedListing.count({ where: { userId: buyerId, listingId: first.id } }),
    ).toBe(0);
    await prisma.listing.update({
      where: { id: first.id },
      data: { unitPriceMinor: 999999999999999999n },
    });
    expect(
      (
        await request(app)
          .put(`/v1/shopping/cart/${first.id}`)
          .set(auth)
          .send({ quantity: "20", unitPriceMinor: "999999999999999999" })
      ).body.error.code,
    ).toBe("INVALID_TOTAL");
    await prisma.listing.update({ where: { id: first.id }, data: { unitPriceMinor: 10000n } });
    for (const item of [first, second]) {
      expect(
        (
          await request(app)
            .put(`/v1/shopping/cart/${item.id}`)
            .set(auth)
            .send({ quantity: "2", unitPriceMinor: "10000" })
        ).status,
      ).toBe(200);
      expect(
        (
          await prisma.listing.findUniqueOrThrow({ where: { id: item.id } })
        ).reservedQuantity.toString(),
      ).toBe("0");
    }
    expect((await request(app).get("/v1/shopping/cart").set(other)).body.items).toEqual([]);
    await request(app).delete(`/v1/shopping/cart/${first.id}`).set(other);
    expect(await prisma.cartItem.count({ where: { userId: buyerId, listingId: first.id } })).toBe(
      1,
    );
    expect(
      (
        await request(app)
          .put(`/v1/shopping/cart/${first.id}`)
          .set({ Authorization: `Bearer ${seller}` })
          .send({ quantity: "1", unitPriceMinor: "10000" })
      ).body.error.code,
    ).toBe("OWN_LISTING");
    const body = {
      items: [first, second].map((item) => ({
        listingId: item.id,
        quantity: "2",
        unitPriceMinor: "10000",
      })),
    };
    const key = randomUUID();
    await prisma.listing.update({ where: { id: second.id }, data: { unitPriceMinor: 11000n } });
    expect(
      (
        await request(app)
          .post("/v1/shopping/cart/checkout")
          .set(auth)
          .set("Idempotency-Key", key)
          .send(body)
      ).body.error.code,
    ).toBe("CART_PRICE_CHANGED");
    expect(await prisma.tradeOrder.count({ where: { listingId: first.id } })).toBe(0);
    expect(await prisma.cartItem.count({ where: { userId: buyerId } })).toBe(2);
    await request(app)
      .put(`/v1/shopping/cart/${second.id}`)
      .set(auth)
      .send({ quantity: "2", unitPriceMinor: "11000" });
    body.items[1]!.unitPriceMinor = "11000";
    await prisma.listing.update({ where: { id: second.id }, data: { availableQuantity: 0 } });
    expect(
      (
        await request(app)
          .post("/v1/shopping/cart/checkout")
          .set(auth)
          .set("Idempotency-Key", key)
          .send(body)
      ).body.error.code,
    ).toBe("INVENTORY_UNAVAILABLE");
    expect(
      (
        await prisma.listing.findUniqueOrThrow({ where: { id: first.id } })
      ).reservedQuantity.toString(),
    ).toBe("0");
    expect(await prisma.tradeOrder.count({ where: { listingId: first.id } })).toBe(0);
    await prisma.listing.update({ where: { id: second.id }, data: { availableQuantity: 20 } });
    const results = await Promise.all(
      [0, 1].map(() =>
        request(app)
          .post("/v1/shopping/cart/checkout")
          .set(auth)
          .set("Idempotency-Key", key)
          .send(body),
      ),
    );
    expect(results.map((x) => x.status)).toEqual([201, 201]);
    expect(results[0]!.body).toEqual(results[1]!.body);
    expect(results[0]!.body.orders).toHaveLength(2);
    expect(
      await prisma.tradeOrder.count({ where: { listingId: { in: [first.id, second.id] } } }),
    ).toBe(2);
    expect(await prisma.cartItem.count({ where: { userId: buyerId } })).toBe(0);
    body.items[0]!.quantity = "3";
    expect(
      (
        await request(app)
          .post("/v1/shopping/cart/checkout")
          .set(auth)
          .set("Idempotency-Key", key)
          .send(body)
      ).body.error.code,
    ).toBe("IDEMPOTENCY_KEY_REUSED");
  });
  it("uploads a listing photo as binary and serves it privately only to its owner", async () => {
    const config = getConfig();
    const previousStorage = config.MEDIA_STORAGE;
    config.MEDIA_STORAGE = "local";
    let photoId: string | undefined;
    const uploadServer = app.listen(0, "127.0.0.1");
    await once(uploadServer, "listening");
    try {
      const bytes = await readFile(
        new URL("../../../mobile/assets/figma/listing-tomatoes.png", import.meta.url),
      );
      const bound = uploadServer.address();
      if (!bound || typeof bound === "string") throw new Error("Test listener unavailable");
      const response = await fetch(`http://127.0.0.1:${bound.port}/v1/listing-photos`, {
        method: "POST",
        headers: { Authorization: `Bearer ${seller}`, "Content-Type": "image/jpeg" },
        body: new Uint8Array(bytes),
      });
      const result = await response.json();
      expect(response.status, JSON.stringify(result)).toBe(201);
      photoId = result.id;
      const photo = await prisma.producePhoto.findUniqueOrThrow({ where: { id: photoId } });
      expect(photo.userId).toBe(verifyAccessToken(seller, "customer").sub);
      const own = await request(app)
        .get(`/v1/listing-photos/${photoId}`)
        .set({ Authorization: `Bearer ${seller}` });
      expect(own.status).toBe(200);
      expect(own.body).toEqual(bytes);
      expect(
        (
          await request(app)
            .get(`/v1/listing-photos/${photoId}`)
            .set({ Authorization: `Bearer ${outsider}` })
        ).status,
      ).toBe(404);
      const invalid = await request(app)
        .post("/v1/listing-photos")
        .set({ Authorization: `Bearer ${seller}`, "Content-Type": "image/png" })
        .send(bytes);
      expect(invalid.status).toBe(422);
      expect(invalid.body.error.code).toBe("INVALID_PHOTO");
    } finally {
      await new Promise<void>((resolve, reject) =>
        uploadServer.close((error) => (error ? reject(error) : resolve())),
      );
      config.MEDIA_STORAGE = previousStorage;
      if (photoId) {
        const photo = await prisma.producePhoto.delete({ where: { id: photoId } });
        await deleteMedia(photo.storageKey!);
      }
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
        packaging: {
          unitsPerPackage: 1,
          weightKg: 2,
          length: 40,
          width: 30,
          height: 25,
          handling: "STANDARD",
          notes: "Keep dry",
        },
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
      packaging: {
        unitsPerPackage: 1,
        weightKg: 2,
        length: 40,
        width: 30,
        height: 25,
        handling: "PERISHABLE",
        notes: "Keep upright",
      },
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
      .send({ ...fields, quantity: "2", packaging: undefined });
    expect((await submit()).body.error.code).toBe("PACKING_REQUIRED");
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
    const makeSale = (status: string, funded: boolean) =>
      prisma.tradeOrder.create({
        data: {
          reference: `VISIBILITY-${randomUUID()}`,
          buyerId: buyerUserId,
          farmerProfileId: farmerId,
          listingId,
          quantity: "1",
          totalMinor: 100n,
          status,
          ...(funded
            ? {
                ledger: {
                  create: {
                    kind: "FUND",
                    amountMinor: 100n,
                    mutationKey: randomUUID(),
                    actorId: buyerUserId,
                    reason: "Confirmed test payment",
                  },
                },
              }
            : {}),
        },
      });
    const paidSale = await makeSale("FUNDED", true);
    const notice = await prisma.paidOrderNotification.create({
      data: { orderId: paidSale.id, userId: sellerUserId },
    });
    const inbox = await request(app)
      .get("/v1/orders/notifications?view=seller")
      .set({ Authorization: `Bearer ${seller}` });
    expect(inbox.status).toBe(200);
    expect(inbox.body.items).toContainEqual(
      expect.objectContaining({ id: notice.id, orderId: paidSale.id, messageKey: "order.paid" }),
    );
    for (const token of [buyer, outsider]) {
      const otherInbox = await request(app)
        .get("/v1/orders/notifications?view=seller")
        .set({ Authorization: `Bearer ${token}` });
      expect(otherInbox.body.items.map((item: { id: string }) => item.id)).not.toContain(notice.id);
    }
    const pushToken = `ExpoPushToken[${randomUUID()}]`;
    expect(
      (
        await request(app)
          .post("/v1/orders/push-device")
          .set({ Authorization: `Bearer ${seller}` })
          .send({ token: pushToken, userId: buyerUserId })
      ).status,
    ).toBe(204);
    expect(
      (await prisma.mobilePushDevice.findUniqueOrThrow({ where: { token: pushToken } })).userId,
    ).toBe(sellerUserId);

    const unpaidSale = await makeSale("AWAITING_PAYMENT", false);
    const cancelledSale = await makeSale("CANCELLED", false);
    const unverifiedSale = await makeSale("FUNDED", false);
    const sales = await request(app)
      .get("/v1/orders?view=seller")
      .set({ Authorization: `Bearer ${seller}` });
    expect(sales.status).toBe(200);
    const saleIds = sales.body.items.map((item: { id: string }) => item.id);
    expect(saleIds).toContain(paidSale.id);
    for (const hidden of [unpaidSale, cancelledSale, unverifiedSale]) {
      expect(saleIds).not.toContain(hidden.id);
      const detail = await request(app)
        .get(`/v1/orders/${hidden.id}/delivery`)
        .set({ Authorization: `Bearer ${seller}` });
      expect(detail.status).toBe(404);
    }
    const buyerOrders = await request(app)
      .get("/v1/orders?view=buyer")
      .set({ Authorization: `Bearer ${buyer}` });
    expect(buyerOrders.body.items.map((item: { id: string }) => item.id)).toContain(
      cancelledSale.id,
    );
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
  it("lists only owned active phones and revokes the selected phone's sessions", async () => {
    const userId = verifyAccessToken(seller, "customer").sub;
    const currentId = verifyAccessToken(seller, "customer").sessionId;
    const deviceId = randomUUID();
    const first = await createSession({ subject: "CUSTOMER", principalId: userId, deviceId });
    const second = await createSession({ subject: "CUSTOMER", principalId: userId, deviceId });
    const ids = [first, second].map(
      (session) => verifyAccessToken(session.accessToken, "customer").sessionId,
    );
    const list = await request(app)
      .get("/v1/auth/sessions")
      .set({ Authorization: `Bearer ${seller}` });
    expect(list.status).toBe(200);
    expect(list.body.items.filter((item: { id: string }) => ids.includes(item.id))).toHaveLength(1);
    expect(list.body.items).toContainEqual(
      expect.objectContaining({ id: currentId, current: true }),
    );
    expect(list.body.items.every((item: object) => !("deviceId" in item))).toBe(true);
    const auth = { Authorization: `Bearer ${seller}` };
    expect(
      (
        await request(app)
          .delete(`/v1/auth/sessions/${ids[0]}`)
          .set({ Authorization: `Bearer ${outsider}` })
      ).status,
    ).toBe(404);
    expect((await request(app).delete(`/v1/auth/sessions/${currentId}`).set(auth)).status).toBe(
      409,
    );
    expect((await request(app).delete(`/v1/auth/sessions/${ids[1]}`).set(auth)).status).toBe(204);
    expect(await prisma.session.count({ where: { id: { in: ids }, revokedAt: null } })).toBe(0);
    expect(
      (
        await request(app)
          .get("/v1/auth/sessions")
          .set({ Authorization: `Bearer ${first.accessToken}` })
      ).status,
    ).toBe(401);
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
      packaging: {
        unitsPerPackage: 1,
        weightKg: 2,
        length: 40,
        width: 30,
        height: 25,
        handling: "STANDARD",
        notes: "Keep dry",
      },
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
