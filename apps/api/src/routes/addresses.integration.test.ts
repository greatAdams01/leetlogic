import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:http";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { prisma, type Address, type Prisma } from "@leetlogic/database";
import { nigeriaStateNames, type PostcodeLookup } from "@leetlogic/contracts";
import { createApp } from "../app.js";
import { getConfig } from "../config.js";
import { AppError } from "../lib/errors.js";
import { redis } from "../lib/redis.js";
import { createSession } from "../services/sessions.js";
import { issuePostcodeVerification, nipost } from "../services/postcode-verification.js";
import { shippingProvider } from "../services/delivery.js";

const suite = process.env.DELIVERY_INTEGRATION === "1" ? describe : describe.skip;
const lookup: PostcodeLookup = {
  postcode: "LA-01-A03-FK-01", valid: true, mode: "LIVE", level: 2,
  fields: { state: "Lagos", lga: "Ikeja", city: "Lagos", line1: "24 Community Road" },
  addressDetailsAvailable: true,
};
const body = {
  label: "Home", state: "Lagos", lga: "Ikeja", city: "Lagos", line1: "24 Community Road",
  line2: "Side entrance", landmark: "Community hall", postalCode: lookup.postcode,
};
const point = { latitude: 6.52, longitude: 3.37 };
const rate = {
  courierId: "fixture-courier", courier: "Fixture courier", serviceCode: "next-day",
  amountMinor: 1800n, walletMinor: 1500n, requestToken: "fixture-provider-token", eta: "Tomorrow",
};
type Customer = { id: string; auth: { Authorization: string } };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

suite("saved addresses, postcode proofs and delivery races", () => {
  const app = createServer(createApp());
  let buyer: Customer, seller: Customer, outsider: Customer;
  let destination: Address, farm: Address;
  let categoryId: string, farmerId: string, listingId: string, orderId: string;
  const createCustomer = async (capability: "BUYER" | "SELLER"): Promise<Customer> => {
    const digits = (BigInt(`0x${randomUUID().slice(0, 8)}`) % 1000000000n).toString().padStart(9, "0");
    const user = await prisma.user.create({ data: {
      phoneE164: `+2348${digits}`, capabilities: { create: { capability } },
      profile: { create: { fullName: `Fixture ${capability}`, email: `${randomUUID()}@example.test` } },
    } });
    const session = await createSession({ subject: "CUSTOMER", principalId: user.id, deviceId: randomUUID() });
    return { id: user.id, auth: { Authorization: `Bearer ${session.accessToken}` } };
  };
  const check = (customer = buyer) => request(app).post("/v1/me/postcodes/lookup").set(customer.auth).send({ code: lookup.postcode });
  const createAddress = (fields: object = body, customer = buyer, key = randomUUID()) =>
    request(app).post("/v1/me/addresses").set(customer.auth).set("Idempotency-Key", key).send(fields);
  const editDestination = (fields = {}) => request(app).patch(`/v1/me/addresses/${destination.id}`).set(buyer.auth).send({ ...body, ...fields });
  const farmBody = () => ({ label: "Farm", state: farm.state, lga: farm.lga, city: farm.city, line1: farm.line1, postalCode: farm.postalCode });
  const editFarm = (fields = {}) => request(app).patch(`/v1/me/addresses/${farm.id}`).set(seller.auth).send({ ...farmBody(), ...fields });
  const quoteInput = () => ({
    pickup: { name: "Farmer", phone: "+2348012345678", email: "farmer@example.test", addressId: farm.id,
      address: `${farm.line1}, ${farm.city}, ${farm.lga}`, state: farm.state, country: "NG" },
    destination: { name: "Buyer", phone: "+2348098765432", email: "buyer@example.test", addressId: destination.id,
      address: `${destination.line1}, ${destination.city}, ${destination.lga}`, state: destination.state, country: "NG" },
    parcel: { pickupDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10) },
  });
  const quotes = (input: object = quoteInput()) => request(app).post(`/v1/orders/${orderId}/delivery/quotes`).set(buyer.auth).send(input);
  const select = (quoteId: string) => request(app).post(`/v1/orders/${orderId}/delivery/select`).set(buyer.auth).send({ quoteId });
  const selected = async () => {
    const result = await quotes();
    expect(result.status, JSON.stringify(result.body)).toBe(200);
    const quoteId: string = result.body.items[0].id;
    const selection = await select(quoteId);
    expect(selection.status, JSON.stringify(selection.body)).toBe(200);
    return { quoteId, delivery: await prisma.delivery.findUniqueOrThrow({ where: { orderId } }) };
  };
  const verifiedDestination = async () => {
    const checked = await check();
    expect(checked.status).toBe(200);
    const saved = await editDestination({ verificationToken: checked.body.verificationToken });
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    return saved.body.address;
  };

  beforeAll(async () => {
    const schema = new URL(process.env.DATABASE_URL!).searchParams.get("schema");
    if (!/^leetlogic_delivery_integration_[a-f0-9]{12}$/.test(schema || "") || new URL(process.env.REDIS_URL!).pathname !== "/14")
      throw new Error("Use scripts/test-delivery.mjs; never run address fixtures against the application schema.");
    // Reuse a fixture-owned IPv4 listener rather than opening/closing a server for every request.
    app.listen(0, "127.0.0.1");
    await once(app, "listening");
    const c = getConfig();
    c.DELIVERY_ENABLED = true;
    c.DELIVERY_LIVE_BOOKINGS = false;
    c.SHIPBUBBLE_MODE = "test";
    c.SHIPBUBBLE_API_KEY = "fixture";
    c.SHIPBUBBLE_TEST_KEY_CONFIRMED = true;
    c.SHIPBUBBLE_CATEGORY_ID = 24032950;
    c.BACHS_MODE = "sandbox";
    c.PAYMENTS_ENABLED = false;
    c.NIPOST_API_KEY = "";
    categoryId = (await prisma.category.create({ data: { slug: `addresses-${randomUUID()}` } })).id;
    c.DELIVERY_ALLOWED_CATEGORIES = categoryId;
    await prisma.unit.upsert({ where: { code: "KG" }, create: { code: "KG", name: "Kilogram", allowsDecimal: true }, update: {} });
  });
  beforeEach(async () => {
    // An unexpected provider call fails closed; these tests never spend credits or buy labels.
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("External HTTP is prohibited in address integration fixtures"));
    vi.spyOn(nipost, "lookup").mockResolvedValue(lookup);
    vi.spyOn(nipost, "search").mockResolvedValue({ segment: "district", suggestions: [{ code: "A03" }] });
    vi.spyOn(nipost, "reverse").mockResolvedValue({ found: true, candidate: { postcode: lookup.postcode, distanceM: 12, confidence: "medium" } });
    vi.spyOn(shippingProvider, "quotes").mockResolvedValue([rate]);
    [buyer, seller, outsider] = await Promise.all([createCustomer("BUYER"), createCustomer("SELLER"), createCustomer("BUYER")]);
    [destination, farm] = await Promise.all([
      prisma.address.create({ data: { ...body, ...point, userId: buyer.id, isDefaultDelivery: true } }),
      prisma.address.create({ data: { userId: seller.id, label: "Farm", state: "Lagos", lga: "Ikeja", city: "Lagos", line1: "12 Farm Road", ...point, isDefaultFarm: true } }),
    ]);
    farmerId = (await prisma.farmerProfile.create({ data: {
      userId: seller.id, farmName: "Fixture farm", farmType: "Crop farming", primaryAddressId: farm.id, verificationStatus: "APPROVED",
    } })).id;
    listingId = (await prisma.listing.create({ data: {
      farmerProfileId: farmerId, categoryId, unitCode: "KG", locationAddressId: farm.id, title: "Dry beans",
      unitPriceMinor: 10000n, availableQuantity: "20", shippingScope: "NATIONWIDE", status: "ACTIVE",
      packaging: { unitsPerPackage: 1, weightKg: 3, length: 10, width: 10, height: 10, handling: "STANDARD", notes: "" },
    } })).id;
    orderId = (await prisma.tradeOrder.create({ data: {
      reference: `ADDR-${randomUUID()}`, buyerId: buyer.id, farmerProfileId: farmerId, listingId, quantity: "1", totalMinor: 10000n,
    } })).id;
  });
  afterEach(() => { vi.restoreAllMocks(); getConfig().NODE_ENV = "test"; });
  afterAll(async () => {
    if (app.listening) await new Promise<void>((resolve, reject) => app.close((error) => error ? reject(error) : resolve()));
    await redis().quit();
    await prisma.$disconnect();
  });

  it("authenticates postcode reads, disables caching, and never treats suggestions or reverse candidates as proofs", async () => {
    expect((await request(app).post("/v1/me/postcodes/lookup").send({ code: lookup.postcode })).status).toBe(401);
    expect(nipost.lookup).not.toHaveBeenCalled();
    const checked = await check();
    expect(checked.status).toBe(200);
    expect(checked.headers["cache-control"]).toBe("no-store");
    expect(checked.body.verificationToken).toMatch(/^[\w-]+\.[\w-]+$/);
    for (const [action, input] of [["search", { q: "LA-01-A" }], ["reverse", point]] as const) {
      const response = await request(app).post(`/v1/me/postcodes/${action}`).set(buyer.auth).send(input);
      expect(response.status).toBe(200);
      expect(response.headers["cache-control"]).toBe("no-store");
      expect(response.body).not.toHaveProperty("verificationToken");
    }
  });
  it.each([
    { userId: "11111111-1111-4111-8111-111111111111" }, { countryCode: "US" },
    { postcodeVerifiedAt: new Date().toISOString() }, { postcodeVerificationLevel: 5 },
    { postcodeVerificationMode: "LIVE" }, { isDefaultFarm: true }, { ...point },
  ])("rejects client-owned verification, ownership or raw coordinate fields: %j", async (forged) => {
    const response = await createAddress({ ...body, ...forged });
    expect(response.status, JSON.stringify({ responseKeys: Object.keys(response.body), errorCode: response.body.error?.code })).toBe(422);
    expect(await prisma.address.count({ where: { userId: buyer.id } })).toBe(1);
  });
  it("persists a server-issued proof and retains its timestamp and pin on label-only edits", async () => {
    const saved = await verifiedDestination();
    expect(saved).toMatchObject({ postcodeVerificationMode: "LIVE", postcodeVerificationLevel: 2 });
    expect(saved.postcodeVerifiedAt).toBeTruthy();
    expect(saved).not.toHaveProperty("verificationToken");
    const relabeled = await editDestination({ label: "My home" });
    expect(relabeled.status).toBe(200);
    expect(relabeled.body.address.postcodeVerifiedAt).toBe(saved.postcodeVerifiedAt);
    const record = await prisma.address.findUniqueOrThrow({ where: { id: destination.id } });
    expect(Number(record.latitude)).toBe(point.latitude);
    expect(Number(record.longitude)).toBe(point.longitude);
  });
  it("rejects proofs belonging to another customer, another postcode, or a modified signature", async () => {
    const checked = await check();
    for (const [customer, fields] of [
      [outsider, { verificationToken: checked.body.verificationToken }],
      [buyer, { verificationToken: checked.body.verificationToken, postalCode: "LA-01-A03-FK-02" }],
      [buyer, { verificationToken: `${checked.body.verificationToken}x` }],
    ] as const) {
      const saved = await createAddress({ ...body, ...fields }, customer);
      expect(saved.status).toBe(409);
      expect(saved.body.error.code).toBe("POSTCODE_VERIFICATION_EXPIRED");
    }
  });
  it("rejects expired proofs and mismatched L2 street fields, but permits an explicit manual fallback", async () => {
    const clock = vi.spyOn(Date, "now").mockReturnValue(Date.now() - 15 * 60000);
    const expired = issuePostcodeVerification(buyer.id, lookup).verificationToken;
    clock.mockRestore();
    const stale = await createAddress({ ...body, verificationToken: expired });
    expect(stale.status).toBe(409);
    const checked = await check();
    const mismatched = await createAddress({ ...body, line1: "25 Different Road", verificationToken: checked.body.verificationToken });
    expect(mismatched.status).toBe(422);
    expect(mismatched.body.error.code).toBe("POSTCODE_ADDRESS_MISMATCH");
    const manual = await createAddress({ ...body, line1: "25 Different Road", verificationToken: null });
    expect(manual.status).toBe(201);
    expect(manual.body.address.postcodeVerifiedAt).toBeNull();
  });
  it("does not accept a sandbox postcode proof as production verification", async () => {
    const verificationToken = issuePostcodeVerification(buyer.id, { ...lookup, mode: "TEST" }).verificationToken;
    getConfig().NODE_ENV = "production";
    const saved = await createAddress({ ...body, verificationToken });
    expect(saved.status).toBe(409);
    expect(saved.body.error.code).toBe("POSTCODE_VERIFICATION_EXPIRED");
  });
  it("records validity-only L1 checks without requiring provider street fields", async () => {
    vi.mocked(nipost.lookup).mockResolvedValueOnce({ ...lookup, level: 1, fields: { state: "Lagos" }, addressDetailsAvailable: false });
    const checked = await check();
    const saved = await createAddress({ ...body, line1: "Plot 8 Rural Community", verificationToken: checked.body.verificationToken });
    expect(saved.status).toBe(201);
    expect(saved.body.address).toMatchObject({ line1: "Plot 8 Rural Community", postcodeVerificationLevel: 1, postcodeVerificationMode: "LIVE" });
  });
  it("keeps manual and legacy six-digit addresses available during a provider outage or quota cooldown", async () => {
    vi.mocked(nipost.lookup).mockRejectedValueOnce(new AppError(503, "POSTCODE_SERVICE_UNAVAILABLE", "Fixture outage"));
    expect((await check()).status).toBe(503);
    await redis().set(`rate:ndaps:${buyer.id}`, 30, "EX", 60);
    const throttled = await check();
    expect(throttled.status).toBe(429);
    expect(throttled.headers["retry-after"]).toBeTruthy();
    for (const postalCode of [null, "100001"]) {
      const saved = await createAddress({ ...body, postalCode });
      expect(saved.status).toBe(201);
      expect(saved.body.address.postcodeVerifiedAt).toBeNull();
    }
    expect(nipost.lookup).toHaveBeenCalledOnce();
  });
  it("accepts manual addresses in all 36 states and the FCT without checking courier coverage", async () => {
    for (const state of nigeriaStateNames) {
      const saved = await createAddress({ ...body, state, postalCode: null });
      expect(saved.status, state).toBe(201);
      expect(saved.body.address.state).toBe(state);
      expect(saved.body.address.countryCode).toBe("NG");
    }
    expect(nipost.lookup).not.toHaveBeenCalled();
    expect(shippingProvider.quotes).not.toHaveBeenCalled();
  });
  it.each([
    { state: "Ogun" }, { lga: "Alimosho" }, { city: "Badagry" }, { line1: "25 Community Road" },
    { line2: "Back entrance" }, { landmark: "Different hall" }, { postalCode: "LA-01-A03-FK-02" },
    { coordinates: { latitude: 6.53, longitude: 3.38 } },
  ])("clears verification when address fields or the confirmed pin change: %j", async (change) => {
    await verifiedDestination();
    const saved = await editDestination(change);
    expect(saved.status).toBe(200);
    expect(saved.body.address).toMatchObject({ postcodeVerifiedAt: null, postcodeVerificationLevel: null, postcodeVerificationMode: null });
    if (["state", "lga", "city", "line1", "postalCode"].some((key) => key in change)) {
      expect(saved.body.address.latitude).toBeNull();
      expect(saved.body.address.longitude).toBeNull();
    }
  });
  it("never edits another owner's address or a deleted address", async () => {
    expect((await request(app).patch(`/v1/me/addresses/${destination.id}`).set(outsider.auth).send(body)).status).toBe(404);
    await prisma.address.update({ where: { id: destination.id }, data: { deletedAt: new Date() } });
    expect((await editDestination()).status).toBe(404);
  });
  it("coalesces concurrent address creates, scopes keys by customer, and rejects changed retry bodies", async () => {
    const key = randomUUID();
    const results = await Promise.all([createAddress(body, buyer, key), createAddress(body, buyer, key)]);
    expect(results.map((result) => result.status)).toEqual([201, 201]);
    const id: string = results[0]!.body.address.id;
    expect(results[1]!.body.address.id).toBe(id);
    expect(await prisma.address.count({ where: { userId: buyer.id } })).toBe(2);
    expect(await prisma.auditLog.count({ where: { entityId: id, action: "address.created" } })).toBe(1);
    const changed = await createAddress({ ...body, line1: "Another street address" }, buyer, key);
    expect(changed.status).toBe(409);
    expect(changed.body.error.code).toBe("IDEMPOTENCY_KEY_REUSED");
    const other = await createAddress(body, outsider, key);
    expect(other.status).toBe(201);
    expect(other.body.address.id).not.toBe(id);
    expect(other.body.address.userId).toBe(outsider.id);
  });
  it("serializes both create and edit races so a customer has only one primary delivery address", async () => {
    const created = await Promise.all(["First", "Second"].map((label) => createAddress({ ...body, label, isDefaultDelivery: true })));
    expect(created.map((result) => result.status)).toEqual([201, 201]);
    expect(await prisma.address.count({ where: { userId: buyer.id, isDefaultDelivery: true } })).toBe(1);
    const edited = await Promise.all(created.map((result) => request(app).patch(`/v1/me/addresses/${result.body.address.id}`).set(buyer.auth).send({ ...body, isDefaultDelivery: true })));
    expect(edited.map((result) => result.status)).toEqual([200, 200]);
    expect(await prisma.address.count({ where: { userId: buyer.id, isDefaultDelivery: true } })).toBe(1);
  });
  it("uses canonical saved postcodes, directions and pins while leaving buyer contact details editable", async () => {
    const input = quoteInput();
    const response = await quotes({ ...input, destination: {
      ...input.destination, name: "My recipient", postalCode: "LA-01-A03-FK-02", instructions: "Wrong house", latitude: 1, longitude: 1,
    }, pickup: { ...input.pickup, latitude: 1, longitude: 1 } });
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(shippingProvider.quotes).toHaveBeenCalledWith(expect.objectContaining({
      destination: expect.objectContaining({ name: "My recipient", addressId: destination.id, postalCode: body.postalCode,
        address: "24 Community Road, Lagos, Ikeja", instructions: "Side entrance · Landmark: Community hall", ...point }),
      pickup: expect.objectContaining({ addressId: farm.id, address: "12 Farm Road, Lagos, Ikeja", ...point }),
    }));
    expect(JSON.stringify(response.body)).not.toContain(rate.requestToken);
  });
  it("rejects foreign or stale saved destination references before calling the courier", async () => {
    const input = quoteInput();
    const foreign = await quotes({ ...input, destination: { ...input.destination, addressId: farm.id } });
    expect(foreign.status).toBe(422);
    expect(foreign.body.error.code).toBe("DESTINATION_ADDRESS_REQUIRED");
    const stale = await quotes({ ...input, destination: { ...input.destination, address: "A different street address" } });
    expect(stale.status).toBe(422);
    expect(stale.body.error.code).toBe("DESTINATION_ADDRESS_MISMATCH");
    expect(shippingProvider.quotes).not.toHaveBeenCalled();
  });
  it("checks LOCAL scope separately from nationwide provider availability, without staff-review fallback", async () => {
    await editDestination({ state: "Bayelsa", city: "Ogbia", lga: "Ogbia" });
    destination = await prisma.address.findUniqueOrThrow({ where: { id: destination.id } });
    await prisma.listing.update({ where: { id: listingId }, data: { shippingScope: "LOCAL" } });
    const local = await quotes();
    expect(local.status).toBe(422);
    expect(local.body.error.code).toBe("DELIVERY_SCOPE_UNSUPPORTED");
    expect(shippingProvider.quotes).not.toHaveBeenCalled();
    await prisma.listing.update({ where: { id: listingId }, data: { shippingScope: "NATIONWIDE" } });
    vi.mocked(shippingProvider.quotes).mockResolvedValueOnce([]);
    const unavailable = await quotes();
    expect(unavailable.status).toBe(409);
    expect(unavailable.body.error.code).toBe("NO_DELIVERY_OPTIONS");
    expect((await prisma.delivery.findUniqueOrThrow({ where: { orderId } })).status).toBe("QUOTE_REQUIRED");
    expect((await quotes()).status).toBe(200);
  });
  it.each(["destination", "pickup"] as const)("expires quotes and retires the selected fee when the saved %s changes", async (which) => {
    const before = await selected();
    const response = which === "destination" ? await editDestination({ line1: "25 Community Road" }) : await editFarm({ line1: "13 Farm Road" });
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    const saved = await prisma.delivery.findUniqueOrThrow({ where: { orderId } });
    expect(saved).toMatchObject({ status: "QUOTE_REQUIRED", selectedQuoteId: null, shippingMinor: 0n, courier: null, failureCode: "STALE_DELIVERY_QUOTE" });
    expect(saved.package).not.toEqual(before.delivery.package);
    expect((await prisma.deliveryQuote.findUniqueOrThrow({ where: { id: before.quoteId } })).expiresAt.getTime()).toBeLessThanOrEqual(Date.now());
    expect((await select(before.quoteId)).status).toBe(409);
    const detail = await request(app).get(`/v1/orders/${orderId}/delivery`).set(buyer.auth);
    expect(detail.body.order.checkoutReady).toBe(false);
    expect(detail.body.delivery.quotes[0].available).toBe(false);
  });
  it.each(["QUEUED", "PROCESSING", "UNKNOWN", "OPEN", "BLOCKED"])("locks destination and farm pins during a %s checkout, but permits label-only edits", async (status) => {
    const before = await selected();
    await prisma.paymentAttempt.create({ data: {
      orderId, buyerId: buyer.id, mode: "sandbox", status, amountMinor: 11800n, produceMinor: 10000n, shippingMinor: 1800n,
      quoteId: before.quoteId, checkoutId: status === "BLOCKED" ? randomUUID() : null, expiresAt: new Date(Date.now() + 60000),
    } });
    const blocked = await editDestination({ line1: "25 Community Road" });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe("CHECKOUT_ACTIVE");
    const pin = await request(app).patch("/v1/me/farm-location").set(seller.auth).send({ ...point, latitude: 6.53 });
    expect(pin.status).toBe(409);
    expect(pin.body.error.code).toBe("CHECKOUT_ACTIVE");
    const relabeled = await editDestination({ label: "Renamed home" });
    expect(relabeled.status, JSON.stringify({ body: relabeled.body, headers: relabeled.headers })).toBe(200);
    const unchangedPin = await request(app).patch("/v1/me/farm-location").set(seller.auth).send(point);
    expect(unchangedPin.status, JSON.stringify({ body: unchangedPin.body, headers: unchangedPin.headers })).toBe(200);
    expect((await prisma.delivery.findUniqueOrThrow({ where: { orderId } })).selectedQuoteId).toBe(before.quoteId);
  });
  const paidLocks: { name: string; order?: Prisma.TradeOrderUpdateInput; delivery?: Prisma.DeliveryUpdateInput; shipment?: boolean }[] = [
    { name: "funded produce", order: { status: "FUNDED", heldMinor: 10000n } },
    { name: "financial hold", order: { financialHold: true } },
    { name: "paid shipping", delivery: { paidMinor: 1800n } },
    { name: "started booking", delivery: { bookingStartedAt: new Date() } },
    { name: "provider shipment", delivery: { providerShipmentId: `fixture-${randomUUID()}` } },
    { name: "manual shipment", shipment: true },
  ];
  it.each(paidLocks)("does not redirect addresses in use for $name", async (condition) => {
    await selected();
    if (condition.order) await prisma.tradeOrder.update({ where: { id: orderId }, data: condition.order });
    if (condition.delivery) await prisma.delivery.update({ where: { orderId }, data: condition.delivery });
    if (condition.shipment) await prisma.shipment.create({ data: { orderId, carrier: "Fixture carrier", trackingRef: randomUUID() } });
    const edit = await editDestination({ line1: "25 Community Road" });
    expect(edit.status).toBe(409);
    expect(edit.body.error.code).toBe("ADDRESS_IN_USE");
    const pin = await request(app).patch("/v1/me/farm-location").set(seller.auth).send({ ...point, latitude: 6.53 });
    expect(pin.status).toBe(409);
    expect(pin.body.error.code).toBe("ADDRESS_IN_USE");
    expect((await createAddress({ ...body, line1: "New address for future orders" })).status).toBe(201);
    expect((await prisma.address.findUniqueOrThrow({ where: { id: destination.id } })).line1).toBe(body.line1);
  });
  it("releases an address lock after the order is completed", async () => {
    await selected();
    await prisma.tradeOrder.update({ where: { id: orderId }, data: { status: "COMPLETED" } });
    expect((await editDestination({ line1: "25 Community Road" })).status).toBe(200);
    expect((await editFarm({ line1: "13 Farm Road" })).status).toBe(200);
  });
  it("does not lock the listing's farm address when a paid order uses a different saved farmer pickup", async () => {
    await selected();
    const alternate = await createAddress({ ...body, label: "Alternate pickup", line1: "30 Alternate Farm Road" }, seller);
    expect(alternate.status).toBe(201);
    await prisma.delivery.update({ where: { orderId }, data: { pickup: {
      ...quoteInput().pickup, addressId: alternate.body.address.id, address: "30 Alternate Farm Road, Lagos, Ikeja",
    } } });
    await prisma.tradeOrder.update({ where: { id: orderId }, data: { status: "FUNDED", heldMinor: 10000n } });
    expect((await editFarm({ line1: "13 Farm Road" })).status).toBe(200);
    const blocked = await request(app).patch(`/v1/me/addresses/${alternate.body.address.id}`).set(seller.auth).send({ ...body, line1: "31 Alternate Farm Road" });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe("ADDRESS_IN_USE");
  });
  it.each(["destination", "pickup"] as const)("discards a provider response that arrives after its saved %s was edited", async (which) => {
    const started = deferred<void>(), response = deferred<typeof rate[]>();
    vi.mocked(shippingProvider.quotes).mockImplementationOnce(() => { started.resolve(); return response.promise; });
    const inFlight = quotes().then((result) => result);
    await started.promise;
    let late: Awaited<typeof inFlight>;
    try {
      const changed = which === "destination" ? await editDestination({ line1: "25 Community Road" }) : await editFarm({ line1: "13 Farm Road" });
      expect(changed.status, JSON.stringify(changed.body)).toBe(200);
    } finally {
      response.resolve([rate]);
      late = await inFlight;
    }
    expect(late.status).toBe(409);
    expect(late.body.error.code).toBe("STALE_DELIVERY_QUOTE");
    expect(await prisma.deliveryQuote.count({ where: { delivery: { orderId } } })).toBe(0);
    expect((await prisma.delivery.findUniqueOrThrow({ where: { orderId } })).selectedQuoteId).toBeNull();
  });
  it("reuses a saved seller-profile address without requiring the already-consumed postcode proof", async () => {
    await prisma.farmerProfile.update({ where: { id: farmerId }, data: { verificationStatus: "DRAFT" } });
    const proof = issuePostcodeVerification(seller.id, { ...lookup, fields: { state: farm.state, lga: farm.lga, city: farm.city, line1: farm.line1 } });
    const fields = { ...farmBody(), farmName: "Fixture farm", farmType: "Crop farming", postalCode: lookup.postcode, coordinates: point };
    const first = await request(app).post("/v1/me/seller-profile").set(seller.auth).send({ ...fields, verificationToken: proof.verificationToken });
    expect(first.status, JSON.stringify(first.body)).toBe(201);
    const id: string = first.body.farmer.primaryAddressId;
    const verified = await prisma.address.findUniqueOrThrow({ where: { id } });
    expect(verified.postcodeVerificationLevel).toBe(2);
    const renamed = await request(app).post("/v1/me/seller-profile").set(seller.auth).send({ ...fields, farmName: "Renamed farm" });
    expect(renamed.status).toBe(201);
    expect(renamed.body.farmer.primaryAddressId).toBe(id);
    expect((await prisma.address.findUniqueOrThrow({ where: { id } })).postcodeVerifiedAt).toEqual(verified.postcodeVerifiedAt);
  });
});
