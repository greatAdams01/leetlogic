import { rankDeliveryQuotes, courierQuality } from "../services/delivery-ranking.js";
import { deliveryQuoteConfiguration } from "../services/delivery-configuration.js";
import { packageSuggestion, orderShipping } from "../services/packaging.js";
import { randomUUID } from "node:crypto";
import {
  assertCurrentDeliveryQuote,
  assertNoActiveCheckout,
  assertDeliveryInput,
  checkoutSummary,
  deliveryInputHash,
  deriveDeliveryInput,
  savedPickup,
  savedAddressLocation,
  shippingOrderInclude,
  storedDeliveryInput,
} from "../services/delivery-quote.js";
import { lockDeliveryRequestAddresses } from "../services/addresses.js";
import { Router, type Request } from "express";
import { z } from "zod";
import { prisma, type Prisma } from "@leetlogic/database";
import { requireAuth, requirePermission, requireRecentStepUp } from "../middleware/auth.js";
import { AppError } from "../lib/errors.js";
import { getConfig } from "../config.js";
import { canAdvanceDelivery, deliveryReceiptReady } from "../services/delivery-policy.js";
import { audit } from "../services/audit.js";
import { contactSchema } from "../providers/shipping/shipbubble.js";
import { assertNoDeliverySettlement, deliveryEvent, finalizeDeliveryBooking, hasDeliverySettlement, hashInput, serialize, shippingProvider } from "../services/delivery.js";
import { recordedSplitBooking, splitPlanMatches } from "../services/split-delivery.js";
import { splitParts, type TrackedShipment } from "../providers/shipping/shipbubble.js";
const uuid = z.string().uuid();
const quoteBody = z.object({
  pickup: contactSchema,
  destination: contactSchema,
  // Retain the old request shape, but never validate or trust buyer-entered measurements.
  parcel: z.object({ pickupDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
});
const unlockedCheckout = assertNoActiveCheckout;
function safeQuote(q: any) {
  return {
    id: q.id,
    courier: q.courier,
    amountMinor: q.amountMinor,
    eta: q.eta,
    expiresAt: q.expiresAt,
    quality: courierQuality(q.quality),
    recommended: !!q.recommended,
    recommendationReason: q.recommendationReason || null,
    available: q.available !== false,
  };
}
export const customerDeliveryRouter = Router();
export const staffDeliveryRouter = Router();
export const deliveryWebhookRouter = Router();
customerDeliveryRouter.use(requireAuth("customer"));
staffDeliveryRouter.use(requireAuth("admin"), requirePermission("orders.read"));
async function orderAccess(req: Request) {
  const orderId = uuid.parse(req.params.id);
  const order = await prisma.tradeOrder.findUnique({
    where: { id: orderId },
    include: {
      ...shippingOrderInclude,
      shipment: true,
      delivery: {
        include: {
          quotes: { orderBy: { createdAt: "desc" }, take: 30 },
          events: { orderBy: { createdAt: "asc" } },
        },
      },
    },
  });
  if (
    !order ||
    (req.auth!.subject !== "admin" &&
      order.buyerId !== req.auth!.sub &&
      order.farmerProfile.userId !== req.auth!.sub)
  )
    throw new AppError(404, "ORDER_NOT_FOUND", "Order not found");
  if (
    req.auth!.subject !== "admin" &&
    order.buyerId !== req.auth!.sub &&
    (["AWAITING_PAYMENT", "CANCELLED"].includes(order.status) ||
      !(await prisma.escrowEntry.count({ where: { orderId: order.id, kind: "FUND" } })))
  )
    throw new AppError(404, "ORDER_NOT_FOUND", "Order not found");
  return { ...order, settlementStarted: await hasDeliverySettlement(order.id) };
}
customerDeliveryRouter.post("/push-device", async (req, res) => {
  const { token } = z
    .object({
      token: z
        .string()
        .max(255)
        .regex(/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/),
    })
    .parse(req.body);
  const session = await prisma.session.findUniqueOrThrow({ where: { id: req.auth!.sessionId } });
  await prisma.mobilePushDevice.upsert({
    where: { token },
    create: { token, userId: req.auth!.sub, sessionFamilyId: session.tokenFamilyId },
    update: { userId: req.auth!.sub, sessionFamilyId: session.tokenFamilyId },
  });
  res.status(204).end();
});
customerDeliveryRouter.delete("/push-device", async (req, res) => {
  const { token } = z.object({ token: z.string().max(255) }).parse(req.body);
  await prisma.mobilePushDevice.deleteMany({ where: { token, userId: req.auth!.sub } });
  res.status(204).end();
});
customerDeliveryRouter.get("/notifications", async (req, res) => {
  const { view: requestedView } = z
    .object({ view: z.enum(["buyer", "seller"]).optional() })
    .parse(req.query);
  const view = req.auth!.capabilities!.includes("SELLER") ? "seller" : "buyer";
  if (requestedView && requestedView !== view)
    throw new AppError(
      403,
      "ROLE_FORBIDDEN",
      "This dashboard is not available for your account role.",
    );
  const items = await prisma.deliveryNotification.findMany({
    where: {
      userId: req.auth!.sub,
      event: {
        delivery: {
          order:
            view === "seller"
              ? {
                  farmerProfile: { userId: req.auth!.sub },
                  ledger: { some: { kind: "FUND" } },
                  status: { notIn: ["AWAITING_PAYMENT", "CANCELLED"] },
                }
              : { buyerId: req.auth!.sub },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const paid =
    view === "seller"
      ? await prisma.paidOrderNotification.findMany({
          where: {
            userId: req.auth!.sub,
            order: {
              farmerProfile: { userId: req.auth!.sub },
              ledger: { some: { kind: "FUND" } },
              status: { notIn: ["AWAITING_PAYMENT", "CANCELLED"] },
            },
          },
          select: { id: true, orderId: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 50,
        })
      : [];
  const approved =
    view === "seller"
      ? await prisma.listingApprovalNotification.findMany({
          where: { userId: req.auth!.sub },
          select: { id: true, listingId: true, title: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 50,
        })
      : [];
  res.json({
    items: [
      ...items,
      ...paid.map((i) => ({ ...i, messageKey: "order.paid" })),
      ...approved.map((i) => ({ ...i, messageKey: "listing.approved" })),
    ]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 50),
  });
});
customerDeliveryRouter.get("/", async (req, res) => {
  const { view: requestedView } = z
    .object({ view: z.enum(["buyer", "seller"]).optional() })
    .parse(req.query);
  const view = req.auth!.capabilities!.includes("SELLER") ? "seller" : "buyer";
  if (requestedView && requestedView !== view)
    throw new AppError(
      403,
      "ROLE_FORBIDDEN",
      "This dashboard is not available for your account role.",
    );
  const items = await prisma.tradeOrder.findMany({
    where:
      view === "seller"
        ? {
            farmerProfile: { userId: req.auth!.sub },
            ledger: { some: { kind: "FUND" } },
            status: { notIn: ["AWAITING_PAYMENT", "CANCELLED"] },
          }
        : view === "buyer"
          ? { buyerId: req.auth!.sub }
          : {
              OR: [
                { buyerId: req.auth!.sub },
                {
                  farmerProfile: { userId: req.auth!.sub },
                  ledger: { some: { kind: "FUND" } },
                  status: { notIn: ["AWAITING_PAYMENT", "CANCELLED"] },
                },
              ],
            },
    select: {
      id: true,
      reference: true,
      status: true,
      totalMinor: true,
      reservationExpiresAt: true,
      quantity: true,
      listing: { select: { title: true, unitCode: true, salePackaging: true } },
      delivery: { select: { status: true, shippingMinor: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json(serialize({ items }));
});
// Buyer collection uses no courier quote or shipping charge.
customerDeliveryRouter.post("/:id/delivery/collection", async (req, res) => {
  const order = await orderAccess(req);
  if (order.buyerId !== req.auth!.sub)
    throw new AppError(403, "BUYER_REQUIRED", "Only the buyer can choose pickup.");
  await prisma.$transaction(async (tx) => {
    await lockDeliveryRequestAddresses(tx, order);
    await tx.$queryRaw`SELECT id FROM trade_orders WHERE id=${order.id}::uuid FOR UPDATE`;
    await unlockedCheckout(tx, order.id);
    const current = await tx.tradeOrder.findUniqueOrThrow({
      where: { id: order.id },
      include: { ...shippingOrderInclude, delivery: true, shipment: true },
    });
    if (
      current.status !== "AWAITING_PAYMENT" || current.financialHold ||
      current.shipment ||
      current.delivery?.bookingStartedAt ||
      current.delivery?.paidMinor
    )
      throw new AppError(
        409,
        "DELIVERY_LOCKED",
        "Fulfilment cannot change after payment or dispatch.",
      );
    const buyer = await tx.user.findUniqueOrThrow({
      where: { id: req.auth!.sub },
      include: { profile: true },
    });
    const pickup = {
       ...savedPickup(current),
       name: current.farmerProfile.farmName,
       phone: current.farmerProfile.user.phoneE164,
      country: "NG",
    };
    const destination = {
      name: buyer.profile?.fullName || "Buyer",
      phone: buyer.phoneE164,
      email: buyer.profile?.email || "",
      address: pickup.address,
      state: pickup.state,
      country: "NG",
    };
    await tx.delivery.upsert({
      where: { orderId: order.id },
      create: { orderId: order.id, status: "PICKUP_PENDING", pickup, destination },
      update: {
        status: "PICKUP_PENDING",
        pickup,
        destination,
        selectedQuoteId: null,
        shippingMinor: 0n,
        courier: null,
        failureCode: null,
        ...(current.delivery?.package && typeof current.delivery.package === "object" && !Array.isArray(current.delivery.package)
          ? { package: { ...current.delivery.package, quoteRequestId: randomUUID() } } : {}),
      },
    });
    await audit(
      req,
      { action: "delivery.collection.selected", entityType: "order", entityId: order.id },
      tx,
    );
  });
  res.json({ selected: true });
});
// Only the farmer can change where their produce is collected, before checkout.
customerDeliveryRouter.post("/:id/delivery/pickup", async (req, res) => {
  const order = await orderAccess(req);
  if (order.farmerProfile.userId !== req.auth!.sub)
    throw new AppError(403, "FARMER_REQUIRED", "Only the farmer can change the pickup address.");
  const { addressId } = z.object({ addressId: uuid }).strict().parse(req.body);
  const address = await prisma.address.findFirst({
    where: { id: addressId, userId: req.auth!.sub, deletedAt: null, countryCode: "NG" },
  });
  if (!address) throw new AppError(422, "INVALID_ADDRESS", "Choose one of your saved addresses.");
  await prisma.$transaction(async (tx) => {
    await lockDeliveryRequestAddresses(tx, order, undefined, addressId);
    await tx.$queryRaw`SELECT id FROM trade_orders WHERE id = ${order.id}::uuid FOR UPDATE`;
    await unlockedCheckout(tx, order.id);
    const current = await tx.tradeOrder.findUniqueOrThrow({
      where: { id: order.id },
      include: { delivery: true, shipment: true },
    });
    if (current.status !== "AWAITING_PAYMENT" || current.financialHold || current.shipment || current.delivery?.paidMinor || current.delivery?.bookingStartedAt)
      throw new AppError(409, "DELIVERY_LOCKED", "Pickup cannot change after payment or dispatch.");
    const confirmedAddress = await tx.address.findFirst({ where: { id: addressId, userId: req.auth!.sub, countryCode: "NG", deletedAt: null } });
    if (!confirmedAddress) throw new AppError(422, "INVALID_ADDRESS", "Choose one of your saved addresses.");
    const pickup = {
      name: order.farmerProfile.user.profile?.fullName || order.farmerProfile.farmName,
      phone: order.farmerProfile.user.phoneE164,
      email: order.farmerProfile.user.profile?.email || "",
      ...savedAddressLocation(confirmedAddress),
      country: "NG",
    };
    const delivery = await tx.delivery.upsert({
      where: { orderId: order.id },
      create: { orderId: order.id, pickup },
      update: {
        pickup,
        selectedQuoteId: null,
        shippingMinor: 0n,
        courier: null,
        failureCode: null,
        status: "QUOTE_REQUIRED",
        ...(current.delivery?.package && typeof current.delivery.package === "object" && !Array.isArray(current.delivery.package)
          ? { package: { ...current.delivery.package, quoteRequestId: randomUUID() } } : {}),
      },
    });
    await tx.deliveryQuote.deleteMany({ where: { deliveryId: delivery.id } });
    await deliveryEvent(
      tx,
      delivery.id,
      "QUOTE_REQUIRED",
      "customer",
      `${delivery.id}:pickup:${hashInput(pickup)}:${Date.now()}`,
      req.auth!.sub,
    );
    await audit(
      req,
      { action: "delivery.pickup.updated", entityType: "order", entityId: order.id },
      tx,
    );
  });
  res.json({ saved: true });
});
for (const router of [customerDeliveryRouter, staffDeliveryRouter]) {
  router.get("/:id/delivery", async (req, res) => {
    const order = await orderAccess(req);
    const delivery = order.delivery;
    const checkout = checkoutSummary(order);
    const checkoutActive = !!(await prisma.paymentAttempt.count({
      where: { orderId: order.id, OR: [
        { status: { in: ["QUEUED", "PROCESSING", "UNKNOWN", "OPEN"] } },
        { status: "BLOCKED", checkoutId: { not: null } },
      ] },
    }));
    const quotes = delivery?.quotes.map((quote) => {
      let available = false;
      try {
        assertCurrentDeliveryQuote(order, delivery, quote, { selected: false });
        available = true;
      } catch { /* Historical or incompatible quotes remain visible, but cannot be selected. */ }
      return { ...quote, available };
    }) || [];
    res.json(
      serialize({
        order: {
          id: order.id,
          reference: order.reference,
          status: order.status,
          title: order.listing.title,
          description: order.listing.description,
          listingId: order.listing.id,
          totalMinor: order.totalMinor,
          ...checkout,
          checkoutActive,
          quantity: order.quantity,
          unitCode: order.listing.unitCode,
          salePackaging: orderShipping(order.packagingSnapshot, order.listing).salePackaging,
          packageSuggestion: packageSuggestion(
            order.packagingSnapshot ?? order.listing.packaging,
            order.quantity,
          ),
          isBuyer: order.buyerId === req.auth!.sub,
          suggestedPickup: {
            name: order.farmerProfile.user.profile?.fullName || order.farmerProfile.farmName,
            phone: order.farmerProfile.user.phoneE164,
            email: order.farmerProfile.user.profile?.email || "",
            ...savedPickup(order),
          },
        },
        delivery: delivery
          ? {
              ...delivery,
              quotes: rankDeliveryQuotes(quotes).map(safeQuote),
              parcels: await prisma.deliveryParcel.findMany({
                where: { deliveryId: delivery.id },
                orderBy: { parcelIndex: "asc" },
                select: { id: true, parcelIndex: true, status: true, trackingUrl: true },
              }),
            }
          : null,
      }),
    );
  });
  router.post("/:id/delivery/quotes", async (req, res) => {
    const order = await orderAccess(req);
    const destinationId = uuid.safeParse(req.body?.destination?.addressId);
    const c = getConfig();
    if (req.auth!.subject === "customer" && order.buyerId !== req.auth!.sub)
      throw new AppError(403, "BUYER_REQUIRED", "Only the buyer can choose delivery");
    if (req.auth!.subject === "admin" && !req.auth!.permissions?.includes("orders.manage"))
      throw new AppError(403, "FORBIDDEN", "Order management permission required");
    if (order.status !== "AWAITING_PAYMENT" || order.shipment || order.delivery?.paidMinor)
      throw new AppError(
        409,
        "DELIVERY_LOCKED",
        "Delivery details cannot be changed after payment or dispatch",
      );
    if (!c.DELIVERY_ENABLED)
      throw new AppError(503, "DELIVERY_UNAVAILABLE", "Delivery quotes are not available yet");
    deliveryQuoteConfiguration(c);
    // Invalidate the previous choice BEFORE the provider call. A failed address/date change
    // must not leave the old shipment payable. A revision also prevents late responses winning.
    const prepared = await prisma.$transaction(async (tx) => {
      await lockDeliveryRequestAddresses(tx, order, destinationId.success ? destinationId.data : undefined);
      await tx.$queryRaw`SELECT id FROM trade_orders WHERE id = ${order.id}::uuid FOR UPDATE`;
      await unlockedCheckout(tx, order.id);
      const current = await tx.tradeOrder.findUniqueOrThrow({
        where: { id: order.id },
        include: { ...shippingOrderInclude, delivery: true, shipment: true },
      });
      if (current.status !== "AWAITING_PAYMENT" || current.financialHold || current.shipment || current.delivery?.paidMinor || current.delivery?.bookingStartedAt)
        throw new AppError(409, "DELIVERY_LOCKED", "Order changed; refresh and retry");
      const quoteRequestId = randomUUID();
      // Invalid edits must also retire the old fee; return the validation error after committing.
      if (current.delivery) {
        await tx.deliveryQuote.updateMany({ where: { deliveryId: current.delivery.id }, data: { expiresAt: new Date() } });
        await tx.delivery.update({ where: { id: current.delivery.id }, data: {
          status: "QUOTE_REQUIRED", selectedQuoteId: null, shippingMinor: 0n, courier: null, failureCode: null,
          ...(current.delivery.package && typeof current.delivery.package === "object" && !Array.isArray(current.delivery.package)
            ? { package: { ...current.delivery.package, quoteRequestId } } : {}),
        } });
      }
      let input;
      try {
        const body = quoteBody.parse(req.body);
        input = deriveDeliveryInput(current, { ...body, pickupDate: body.parcel.pickupDate });
      } catch (error) {
        if (current.delivery) await tx.delivery.update({ where: { id: current.delivery.id }, data: { failureCode: error instanceof AppError ? error.code : "VALIDATION_ERROR" } });
        return { error };
      }
      const suggested = packageSuggestion(current.packagingSnapshot ?? current.listing.packaging, current.quantity)!;
      const fields = {
        pickup: input.pickup,
        destination: input.destination,
        package: { ...input.parcel, volumeM3: suggested.volumeM3, specialHandling: suggested.specialHandling, quoteRequestId },
        status: "QUOTE_REQUIRED",
        selectedQuoteId: null,
        shippingMinor: 0n,
        courier: null,
        failureCode: null,
      };
      const d = await tx.delivery.upsert({
        where: { orderId: order.id },
        create: { orderId: order.id, ...fields },
        update: fields,
      });
      await tx.deliveryQuote.updateMany({
        where: { deliveryId: d.id },
        data: { expiresAt: new Date() },
      });
      return { current, d, input, inputHash: deliveryInputHash(current, input), quoteRequestId, expiresAt: new Date(Date.now() + 15 * 60000) };
    });
    if ("error" in prepared) throw prepared.error;
    let rates;
    try {
      assertDeliveryInput(prepared.current, prepared.input);
      rates = await shippingProvider.quotes({ ...prepared.input, name: prepared.current.listing.title, valueMinor: prepared.current.totalMinor });
      if (!rates.length)
        throw new AppError(409, "NO_DELIVERY_OPTIONS", "No delivery service is available for this shipment and date. Try another date or choose pickup.");
    } catch (error) {
      await prisma.delivery.updateMany({
        where: { id: prepared.d.id, package: { path: ["quoteRequestId"], equals: prepared.quoteRequestId }, status: "QUOTE_REQUIRED", selectedQuoteId: null },
        data: { failureCode: error instanceof AppError ? error.code : "QUOTES_UNAVAILABLE" },
      });
      throw error;
    }
    const items = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM trade_orders WHERE id = ${order.id}::uuid FOR UPDATE`;
      await unlockedCheckout(tx, order.id);
      const current = await tx.tradeOrder.findUniqueOrThrow({ where: { id: order.id }, include: { ...shippingOrderInclude, delivery: true, shipment: true } });
      const d = current.delivery;
      if (current.status !== "AWAITING_PAYMENT" || current.financialHold || current.shipment || !d || d.paidMinor || d.bookingStartedAt ||
        (d.package as { quoteRequestId?: string } | null)?.quoteRequestId !== prepared.quoteRequestId)
        throw new AppError(409, "STALE_DELIVERY_QUOTE", "Delivery details changed. Review a fresh delivery quote before paying.");
      const stored = storedDeliveryInput(d);
      const derived = deriveDeliveryInput(current, { ...stored, pickupDate: stored.parcel.pickupDate });
      if (deliveryInputHash(current, stored) !== prepared.inputHash || deliveryInputHash(current, derived) !== prepared.inputHash)
        throw new AppError(409, "STALE_DELIVERY_QUOTE", "Delivery details changed. Review a fresh delivery quote before paying.");
      const result = [];
      for (const rate of rates) {
        const quote = await tx.deliveryQuote.create({
            data: {
              deliveryId: d.id,
              ...rate,
              inputHash: prepared.inputHash,
               expiresAt: prepared.expiresAt,
            },
          });
        assertCurrentDeliveryQuote(current, d, quote, { selected: false });
        result.push({ ...quote, available: true });
      }
      await deliveryEvent(
        tx,
        d.id,
        "QUOTE_REQUIRED",
        "system",
        `${d.id}:quoted:${prepared.quoteRequestId}`,
      );
      await audit(req, { action: "delivery.quoted", entityType: "order", entityId: order.id }, tx);
      return result;
    });
    res.json(serialize({ items: rankDeliveryQuotes(items).map(safeQuote) }));
  });
  router.post("/:id/delivery/select", async (req, res) => {
    const order = await orderAccess(req);
    const { quoteId } = z.object({ quoteId: uuid }).parse(req.body);
    if (req.auth!.subject === "customer" && order.buyerId !== req.auth!.sub)
      throw new AppError(403, "BUYER_REQUIRED", "Only the buyer can choose delivery");
    if (req.auth!.subject === "admin" && !req.auth!.permissions?.includes("orders.manage"))
      throw new AppError(403, "FORBIDDEN", "Order management permission required");
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM trade_orders WHERE id = ${order.id}::uuid FOR UPDATE`;
      await unlockedCheckout(tx, order.id);
      const current = await tx.tradeOrder.findUniqueOrThrow({ where: { id: order.id }, include: { ...shippingOrderInclude, shipment: true } });
      const d = await tx.delivery.findUnique({ where: { orderId: order.id } });
      const candidate = await tx.deliveryQuote.findUnique({ where: { id: quoteId } });
      if (
        current.status !== "AWAITING_PAYMENT" || current.financialHold ||
        current.shipment || !d || d.paidMinor || d.bookingStartedAt
      )
        throw new AppError(409, "QUOTE_EXPIRED", "Request a fresh delivery quote before payment");
      const quote = assertCurrentDeliveryQuote(current, d, candidate, { selected: false });
      await tx.delivery.update({
        where: { id: d.id },
        data: {
          selectedQuoteId: quote.id,
          shippingMinor: quote.amountMinor,
          courier: quote.courier,
          status: "PAYMENT_PENDING",
        },
      });
      await deliveryEvent(
        tx,
        d.id,
        "PAYMENT_PENDING",
        "customer",
        `${d.id}:selected:${quote.id}`,
        req.auth!.sub,
      );
      await audit(
        req,
        { action: "delivery.selected", entityType: "order", entityId: order.id },
        tx,
      );
    });
    res.json({ selected: true });
  });
  router.post("/:id/delivery/refresh-quote", async (req, res) => {
    const order = await orderAccess(req);
    if (req.auth!.subject === "customer" && order.buyerId !== req.auth!.sub)
      throw new AppError(403, "BUYER_REQUIRED", "Only the buyer can refresh delivery");
    if (req.auth!.subject === "admin" && !req.auth!.permissions?.includes("orders.manage"))
      throw new AppError(403, "FORBIDDEN", "Order management permission required");
    const d = order.delivery;
    if (
      !d ||
      !d.selectedQuoteId ||
      d.providerShipmentId ||
      d.bookingStartedAt ||
      !["AWAITING_PAYMENT", "FUNDED"].includes(order.status)
    )
      throw new AppError(409, "DELIVERY_LOCKED", "Delivery quote cannot be refreshed");
    const prepared = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM trade_orders WHERE id = ${order.id}::uuid FOR UPDATE`;
      await unlockedCheckout(tx, order.id);
      const currentOrder = await tx.tradeOrder.findUniqueOrThrow({ where: { id: order.id }, include: { ...shippingOrderInclude, delivery: true, shipment: true } });
      const current = currentOrder.delivery;
      await assertNoDeliverySettlement(tx, order.id);
      if (!current || current.selectedQuoteId !== d.selectedQuoteId || current.bookingStartedAt || current.providerShipmentId ||
        current.paidMinor !== d.paidMinor || currentOrder.status !== order.status || currentOrder.shipment || currentOrder.financialHold)
        throw new AppError(409, "STALE_RECORD", "Delivery changed; refresh and retry");
      const selected = await tx.deliveryQuote.findUnique({ where: { id: current.selectedQuoteId! } });
      if (!selected || selected.deliveryId !== current.id)
        throw new AppError(409, "QUOTE_EXPIRED", "Request a fresh delivery quote before payment");
      const saved = storedDeliveryInput(current);
      const input = deriveDeliveryInput(currentOrder, { ...saved, pickupDate: saved.parcel.pickupDate });
      const suggested = packageSuggestion(currentOrder.packagingSnapshot ?? currentOrder.listing.packaging, currentOrder.quantity)!;
      const quoteRequestId = randomUUID();
      await tx.deliveryQuote.updateMany({ where: { deliveryId: d.id }, data: { expiresAt: new Date() } });
      await tx.delivery.update({ where: { id: d.id }, data: {
        pickup: input.pickup,
        destination: input.destination,
        package: { ...input.parcel, volumeM3: suggested.volumeM3, specialHandling: suggested.specialHandling, quoteRequestId },
        status: order.status === "FUNDED" ? "BOOKING_BLOCKED" : "QUOTE_REQUIRED",
        failureCode: null,
      } });
      return { currentOrder, input, selected, inputHash: deliveryInputHash(currentOrder, input), quoteRequestId, expiresAt: new Date(Date.now() + 15 * 60000) };
    });
    let rate;
    try {
      assertDeliveryInput(prepared.currentOrder, prepared.input);
      const rates = await shippingProvider.quotes({ ...prepared.input, name: prepared.currentOrder.listing.title, valueMinor: prepared.currentOrder.totalMinor });
      rate = rates.find((item) => item.serviceCode === prepared.selected.serviceCode && item.courierId === prepared.selected.courierId);
      if (!rate)
        throw new AppError(409, "NO_DELIVERY_OPTIONS", "No delivery service is available for this shipment and date. Try another date or choose pickup.");
      if (d.paidMinor > 0n && d.paidMinor !== rate.amountMinor && order.fundsProvider !== "bachs")
        throw new AppError(409, "DELIVERY_PRICE_CHANGED", "Courier availability or paid delivery price changed. Contact staff to reconcile payment before booking.");
    } catch (error) {
      await prisma.delivery.updateMany({
        where: { id: d.id, package: { path: ["quoteRequestId"], equals: prepared.quoteRequestId } },
        data: { failureCode: error instanceof AppError ? error.code : "QUOTES_UNAVAILABLE" },
      });
      throw error;
    }
    const refreshedRate = rate;
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM trade_orders WHERE id = ${order.id}::uuid FOR UPDATE`;
      await unlockedCheckout(tx, order.id);
      const currentOrder = await tx.tradeOrder.findUniqueOrThrow({ where: { id: order.id }, include: { ...shippingOrderInclude, delivery: true, shipment: true } });
      const current = currentOrder.delivery;
      await assertNoDeliverySettlement(tx, order.id);
      if (!current || current.selectedQuoteId !== d.selectedQuoteId || current.bookingStartedAt || current.providerShipmentId ||
        current.paidMinor !== d.paidMinor || currentOrder.status !== order.status || currentOrder.shipment || currentOrder.financialHold ||
        (current.package as { quoteRequestId?: string } | null)?.quoteRequestId !== prepared.quoteRequestId)
        throw new AppError(409, "STALE_RECORD", "Delivery changed; refresh and retry");
      const quote = await tx.deliveryQuote.create({
        data: {
          deliveryId: d.id,
          ...refreshedRate,
          inputHash: prepared.inputHash,
          expiresAt: prepared.expiresAt,
        },
      });
      assertCurrentDeliveryQuote(currentOrder, current, quote, { selected: false });
      await tx.delivery.update({
        where: { id: d.id },
        data: {
          selectedQuoteId: quote.id,
          shippingMinor: refreshedRate.amountMinor,
          courier: refreshedRate.courier,
          status:
            order.status === "FUNDED"
              ? d.paidMinor < refreshedRate.amountMinor
                ? "TOPUP_REQUIRED"
                : "PAID"
              : "PAYMENT_PENDING",
          failureCode: null,
        },
      });
      await audit(
        req,
        { action: "delivery.quote.refreshed", entityType: "delivery", entityId: d.id },
        tx,
      );
    });
    await queueBooking(order.id).catch(() => {});
    res.json({ refreshed: true });
  });
  router.post("/:id/delivery/book", async (req, res) => {
    const order = await orderAccess(req);
    if (req.auth!.subject === "customer" && order.buyerId !== req.auth!.sub)
      throw new AppError(403, "BUYER_REQUIRED", "Only the buyer can book delivery");
    if (req.auth!.subject === "admin" && !req.auth!.permissions?.includes("orders.manage"))
      throw new AppError(403, "FORBIDDEN", "Order management permission required");
    await queueBooking(order.id);
    res.status(202).json({ queued: true });
  });
}
staffDeliveryRouter.post(
  "/:id/delivery/payment",
  requirePermission("payments.manage"),
  requireRecentStepUp,
  async (req, res) => {
    const order = await orderAccess(req);
    if (order.fundsProvider === "bachs")
      throw new AppError(
        409,
        "PROVIDER_PAYMENT_REQUIRED",
        "Delivery payment is confirmed by the payment provider.",
      );
    const body = z
      .object({
        amountMinor: z.string().regex(/^\d{1,12}$/),
        reference: z.string().trim().min(3).max(160),
      })
      .parse(req.body);
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM trade_orders WHERE id = ${order.id}::uuid FOR UPDATE`;
      await unlockedCheckout(tx, order.id);
      const d = await tx.delivery.findUniqueOrThrow({ where: { orderId: order.id } });
      const currentOrder = await tx.tradeOrder.findUniqueOrThrow({ where: { id: order.id }, include: shippingOrderInclude });
      if (d.paymentRef === body.reference && d.paidMinor === BigInt(body.amountMinor)) return;
      const quote = d.selectedQuoteId
        ? await tx.deliveryQuote.findUnique({ where: { id: d.selectedQuoteId } })
        : null;
      if (
        d.paymentRef ||
        !quote ||
        quote.expiresAt <= new Date() ||
        quote.amountMinor !== BigInt(body.amountMinor)
      )
        throw new AppError(
          409,
          "DELIVERY_PAYMENT_INVALID",
          "Payment must match the current selected delivery quote",
        );
      assertCurrentDeliveryQuote(currentOrder, d, quote);
      await tx.delivery.update({
        where: { id: d.id },
        data: { paidMinor: quote.amountMinor, paymentRef: body.reference, status: "PAID" },
      });
      await deliveryEvent(tx, d.id, "PAID", "admin", `${d.id}:paid`, req.auth!.sub);
      await audit(
        req,
        {
          action: "delivery.payment.confirmed",
          entityType: "delivery",
          entityId: d.id,
          after: { amountMinor: body.amountMinor, reference: body.reference },
        },
        tx,
      );
    });
    await queueBooking(order.id).catch(() => {});
    res.json({ confirmed: true });
  },
);
staffDeliveryRouter.post(
  "/:id/delivery/reconcile",
  requirePermission("orders.manage"),
  async (req, res) => {
    const order = await orderAccess(req);
    const d = order.delivery;
    if (!d) throw new AppError(404, "DELIVERY_NOT_FOUND", "Delivery not found");
    if (!d.providerShipmentId)
      throw new AppError(
        409,
        "MANUAL_RECONCILIATION_REQUIRED",
        "Locate the shipment in Shipbubble and link it; do not repeat an uncertain booking",
      );
    await prisma.delivery.update({ where: { id: d.id }, data: { nextSyncAt: new Date() } });
    res.status(202).json({ queued: true });
  },
);
staffDeliveryRouter.post(
  "/:id/delivery/parcels/:parcelId/link",
  requirePermission("orders.manage"),
  requireRecentStepUp,
  async (req, res) => {
    const order = await orderAccess(req),
      d = order.delivery;
    const body = z
      .object({
        providerShipmentId: z.string().min(3).max(160),
        reason: z.string().trim().min(10).max(500),
      })
      .parse(req.body);
    const parcel =
      d &&
      (await prisma.deliveryParcel.findFirst({
        where: { id: uuid.parse(req.params.parcelId), deliveryId: d.id },
      }));
    if (parcel?.providerShipmentId === body.providerShipmentId) {
      res.json({ linked: true });
      return;
    }
    if (
      !d ||
      !parcel ||
      parcel.providerShipmentId ||
      !["BOOKING", "BOOKING_UNCERTAIN"].includes(parcel.status) ||
      d.status !== "BOOKING_UNCERTAIN"
    )
      throw new AppError(
        409,
        "DELIVERY_NOT_LINKABLE",
        "Only uncertain parcel bookings can be linked.",
      );
    const tracked = await shippingProvider.track(body.providerShipmentId);
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM trade_orders WHERE id = ${order.id}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM deliveries WHERE id = ${d.id}::uuid FOR UPDATE`;
      const currentOrder = await tx.tradeOrder.findUniqueOrThrow({
        where: { id: order.id }, include: { ...shippingOrderInclude, delivery: { include: { parcels: true } } },
      });
      const current = currentOrder.delivery;
      const currentParcel = current?.parcels.find((item) => item.id === parcel.id);
      if (currentParcel?.providerShipmentId === tracked.id) return;
      if (!current || current.status !== "BOOKING_UNCERTAIN" || current.providerShipmentId !== `split:${d.id}` ||
        !currentParcel || currentParcel.providerShipmentId || !["BOOKING", "BOOKING_UNCERTAIN"].includes(currentParcel.status))
        throw new AppError(409, "STALE_RECORD", "Parcel changed. Refresh and try again.");
      const quote = current.selectedQuoteId ? await tx.deliveryQuote.findUnique({ where: { id: current.selectedQuoteId } }) : null;
      if (!quote || !splitPlanMatches(quote, current.parcels))
        throw new AppError(409, "STALE_RECORD", "Parcel plan changed. Refresh and try again.");
      verifyLinkedShipment(tracked, body.providerShipmentId, current, currentParcel.walletMinor);
      await assertShipmentUnlinked(tx, tracked.id, current.id, currentParcel.id);
      const changed = await tx.deliveryParcel.updateMany({
        where: {
          id: parcel.id,
          providerShipmentId: null,
          status: { in: ["BOOKING", "BOOKING_UNCERTAIN"] },
        },
        data: {
          providerShipmentId: tracked.id,
          trackingUrl: tracked.trackingUrl,
          actualMinor: tracked.shippingMinor,
          status: "BOOKED",
          failureCode: null,
        },
      });
      if (!changed.count)
        throw new AppError(409, "STALE_RECORD", "Parcel changed. Refresh and try again.");
      const parcels = await tx.deliveryParcel.findMany({ where: { deliveryId: current.id } });
      const recorded = recordedSplitBooking(current.id, quote, parcels);
      if (recorded) {
        // All labels already exist: expiry cannot prevent local finalization or cause rebooking.
        await finalizeDeliveryBooking(tx, currentOrder, current, quote, recorded, "admin", req.auth!.sub);
      } else {
        const uncertain = parcels.some((item) => !item.providerShipmentId && item.status !== "PENDING");
        let resumable = false;
        try {
          await assertNoDeliverySettlement(tx, order.id);
          assertCurrentDeliveryQuote(currentOrder, current, quote, { booking: true });
          resumable = !uncertain && currentOrder.status === "FUNDED" && !currentOrder.financialHold &&
            !current.cancelRequestedAt && current.paidMinor >= quote.amountMinor;
        } catch { /* Keep recorded labels, but never buy another label using stale requirements. */ }
        await tx.delivery.update({
          where: { id: current.id },
          data: {
            status: uncertain ? "BOOKING_UNCERTAIN" : resumable ? "BOOKING_QUEUED" : "BOOKING_BLOCKED",
            failureCode: uncertain ? "BOOKING_RESULT_UNKNOWN" : resumable ? null : "QUOTE_OR_FUNDING_CHANGED",
            leaseUntil: null,
          },
        });
      }
      await audit(
        req,
        {
          action: "delivery.parcel.linked",
          entityType: "deliveryParcel",
          entityId: parcel.id,
          after: body,
        },
        tx,
      );
    });
    res.json({ linked: true });
  },
);
staffDeliveryRouter.post(
  "/:id/delivery/link",
  requirePermission("orders.manage"),
  requireRecentStepUp,
  async (req, res) => {
    const order = await orderAccess(req);
    const d = order.delivery;
    const { providerShipmentId, reason } = z
      .object({
        providerShipmentId: z.string().min(3).max(160),
        reason: z.string().trim().min(10).max(500),
      })
      .parse(req.body);
    if (d?.providerShipmentId === providerShipmentId && !providerShipmentId.startsWith("split:")) {
      res.json({ linked: true });
      return;
    }
    if (!d || d.providerShipmentId || d.status !== "BOOKING_UNCERTAIN")
      throw new AppError(409, "DELIVERY_NOT_LINKABLE", "Only uncertain bookings can be linked");
    const tracked = await shippingProvider.track(providerShipmentId);
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM trade_orders WHERE id = ${order.id}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM deliveries WHERE id = ${d.id}::uuid FOR UPDATE`;
      const currentOrder = await tx.tradeOrder.findUniqueOrThrow({
        where: { id: order.id }, include: { delivery: { include: { parcels: true } } },
      });
      const current = currentOrder.delivery;
      if (current?.providerShipmentId === tracked.id) return;
      if (!current || current.status !== "BOOKING_UNCERTAIN" || current.providerShipmentId)
        throw new AppError(409, "STALE_RECORD", "Delivery changed");
      const quote = current.selectedQuoteId ? await tx.deliveryQuote.findUnique({ where: { id: current.selectedQuoteId } }) : null;
      if (!quote || splitParts(quote.requestToken) || current.parcels.length ||
        (current.package as { packageCount?: number } | null)?.packageCount !== 1 ||
        current.shippingMinor !== quote.amountMinor || current.courier !== quote.courier)
        throw new AppError(409, "DELIVERY_NOT_LINKABLE", "Link each parcel of a split booking separately.");
      verifyLinkedShipment(tracked, providerShipmentId, current, quote.walletMinor ?? quote.amountMinor);
      await assertShipmentUnlinked(tx, tracked.id, current.id);
      await finalizeDeliveryBooking(tx, currentOrder, current, quote, tracked, "admin", req.auth!.sub);
      await audit(
        req,
        {
          action: "delivery.linked",
          entityType: "delivery",
          entityId: d.id,
          after: { providerShipmentId, reason },
        },
        tx,
      );
    });
    res.json({ linked: true });
  },
);
function verifyLinkedShipment(
  tracked: TrackedShipment,
  requestedId: string,
  delivery: { pickup: unknown; destination: unknown; courier: string | null },
  walletMinor: bigint,
) {
  const normalize = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const pickup = contactSchema.parse(delivery.pickup), destination = contactSchema.parse(delivery.destination);
  if (tracked.id !== requestedId || tracked.id.startsWith("split:") || tracked.courier !== delivery.courier ||
    tracked.shippingMinor !== walletMinor || !tracked.pickupAddress || !tracked.destinationAddress ||
    !normalize(tracked.pickupAddress).includes(normalize(pickup.address)) ||
    !normalize(tracked.destinationAddress).includes(normalize(destination.address)))
    throw new AppError(422, "SHIPMENT_MISMATCH", "The provider shipment does not match this parcel and route.");
}
async function assertShipmentUnlinked(tx: Prisma.TransactionClient, providerShipmentId: string, deliveryId: string, parcelId?: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`shipment:${providerShipmentId}`},0))::text`;
  if ((await tx.delivery.count({ where: { providerShipmentId, id: { not: deliveryId } } })) ||
    (await tx.deliveryParcel.count({ where: { providerShipmentId, ...(parcelId ? { id: { not: parcelId } } : {}) } })))
    throw new AppError(409, "SHIPMENT_MISMATCH", "This shipment is already linked to another order or parcel.");
}
staffDeliveryRouter.post(
  "/:id/delivery/cancel",
  requirePermission("orders.manage"),
  requireRecentStepUp,
  async (req, res) => {
    const order = await orderAccess(req);
    const reason = z.string().trim().min(10).max(500).parse(req.body.reason);
    const d = order.delivery;
    if (!d?.providerShipmentId || ["DELIVERED", "CANCELLED", "RETURNED"].includes(d.status))
      throw new AppError(409, "CANNOT_CANCEL", "This shipment cannot be cancelled");
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM trade_orders WHERE id = ${order.id}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM deliveries WHERE id = ${d.id}::uuid FOR UPDATE`;
      await assertNoDeliverySettlement(tx, order.id);
      const current = await tx.delivery.findUniqueOrThrow({ where: { id: d.id } });
      if (!current.providerShipmentId || ["DELIVERED", "CANCELLED", "RETURNED"].includes(current.status))
        throw new AppError(409, "CANNOT_CANCEL", "This shipment cannot be cancelled");
      await tx.delivery.update({
        where: { id: d.id },
        data: { cancelRequestedAt: current.cancelRequestedAt || new Date(), nextSyncAt: new Date() },
      });
      await audit(
        req,
        {
          action: "delivery.cancel.requested",
          entityType: "delivery",
          entityId: d.id,
          after: { reason },
        },
        tx,
      );
    });
    res.status(202).json({
      requested: true,
      message: "Cancellation requested; no external refund has been issued.",
    });
  },
);
customerDeliveryRouter.post("/:id/delivery/confirm", async (req, res) => {
  const order = await orderAccess(req);
  if (
    order.buyerId !== req.auth!.sub ||
    !["DELIVERED", "PICKUP_READY"].includes(order.delivery?.status || "")
  )
    throw new AppError(409, "DELIVERY_NOT_READY", "Only the buyer can confirm a delivered order");
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM trade_orders WHERE id = ${order.id}::uuid FOR UPDATE`;
    await unlockedCheckout(tx, order.id);
    await assertNoDeliverySettlement(tx, order.id);
    const current = await tx.tradeOrder.findUniqueOrThrow({
      where: { id: order.id },
      include: { delivery: { include: { parcels: true } } },
    });
    if (!deliveryReceiptReady(current.delivery))
      throw new AppError(409, "DELIVERY_NOT_READY", "Order is not ready for confirmation");
    if (current.status !== "FUNDED" && current.status !== "DELIVERED")
      throw new AppError(409, "ORDER_NOT_FUNDED", "Order cannot be confirmed");
    await tx.tradeOrder.update({
      where: { id: order.id },
      data: { status: "DELIVERED", deliveryConfirmedAt: new Date() },
    });
    if (current.delivery?.status === "PICKUP_READY")
      await tx.delivery.update({
        where: { id: current.delivery.id },
        data: { status: "DELIVERED" },
      });
    await audit(
      req,
      { action: "delivery.recipient.confirmed", entityType: "order", entityId: order.id },
      tx,
    );
  });
  res.json({ confirmed: true });
});
// Unauthenticated events never change delivery state: only accelerate an authenticated provider read.
deliveryWebhookRouter.post("/shipbubble", async (req, res) => {
  const body = z
    .object({ order_id: z.string().min(1).max(160) })
    .safeParse(req.body?.data ?? req.body);
  if (body.success)
    await prisma.delivery.updateMany({
      where: {
        OR: [
          { providerShipmentId: body.data.order_id },
          { parcels: { some: { providerShipmentId: body.data.order_id } } },
        ],
        nextSyncAt: { gt: new Date(Date.now() + 60000) },
      },
      data: { nextSyncAt: new Date(Date.now() + 60000) },
    });
  res.status(202).json({ accepted: true });
});

staffDeliveryRouter.post(
  "/:id/delivery/manual-dispatch",
  requirePermission("orders.manage"),
  async (req, res) => {
    const order = await orderAccess(req);
    const body = z
      .object({
        carrier: z.string().trim().min(2).max(120),
        trackingRef: z.string().trim().min(2).max(120),
        reason: z.string().trim().min(10).max(500),
      })
      .parse(req.body);
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM trade_orders WHERE id = ${order.id}::uuid FOR UPDATE`;
      await unlockedCheckout(tx, order.id);
      const current = await tx.tradeOrder.findUniqueOrThrow({
        where: { id: order.id },
        include: { delivery: true },
      });
      const d = current.delivery;
      await assertNoDeliverySettlement(tx, order.id);
      if (current.status !== "FUNDED" || current.financialHold || !d || d.status !== "MANUAL_REVIEW" || d.providerShipmentId)
        throw new AppError(
          409,
          "MANUAL_DISPATCH_NOT_READY",
          "Manual dispatch requires a funded order in manual review",
        );
      await tx.shipment.create({
        data: {
          orderId: order.id,
          carrier: body.carrier,
          trackingRef: body.trackingRef,
          evidence: body.reason,
        },
      });
      await tx.delivery.update({
        where: { id: d.id },
        data: { status: "MANUAL_ASSIGNED", courier: body.carrier },
      });
      await deliveryEvent(
        tx,
        d.id,
        "MANUAL_ASSIGNED",
        "admin",
        `${d.id}:manual-assigned`,
        req.auth!.sub,
      );
      await audit(
        req,
        { action: "delivery.manual.assigned", entityType: "delivery", entityId: d.id, after: body },
        tx,
      );
    });
    res.json({ assigned: true });
  },
);
staffDeliveryRouter.post(
  "/:id/delivery/manual-status",
  requirePermission("orders.manage"),
  async (req, res) => {
    const order = await orderAccess(req);
    const body = z
      .object({
        status: z.enum([
          "PICKED_UP",
          "IN_TRANSIT",
          "DELIVERED",
          "FAILED_ATTEMPT",
          "RETURNING",
          "RETURNED",
          "CANCELLED",
        ]),
        evidence: z.string().trim().min(10).max(500),
      })
      .parse(req.body);
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM trade_orders WHERE id = ${order.id}::uuid FOR UPDATE`;
      await unlockedCheckout(tx, order.id);
      const current = await tx.tradeOrder.findUniqueOrThrow({
        where: { id: order.id },
        include: { delivery: true, shipment: true },
      });
      const d = current.delivery;
      if (
        !d ||
        !current.shipment ||
        d.providerShipmentId ||
        !["FUNDED", "DELIVERED"].includes(current.status) ||
        ["MANUAL_REVIEW", "QUOTE_REQUIRED", "PAYMENT_PENDING"].includes(d.status) ||
        !canAdvanceDelivery(d.status, body.status)
      )
        throw new AppError(
          409,
          "INVALID_MANUAL_TRANSITION",
          "Manual shipment cannot move to this status",
        );
      if (body.status === "DELIVERED" && d.status !== "IN_TRANSIT")
        throw new AppError(
          409,
          "INVALID_MANUAL_TRANSITION",
          "Mark the shipment in transit before delivery",
        );
      await tx.delivery.update({ where: { id: d.id }, data: { status: body.status } });
      await tx.shipment.update({
        where: { orderId: order.id },
        data: { status: body.status, evidence: body.evidence },
      });
      await deliveryEvent(
        tx,
        d.id,
        body.status,
        "admin",
        `${d.id}:manual:${body.status}`,
        req.auth!.sub,
      );
      await audit(
        req,
        { action: "delivery.manual.status", entityType: "delivery", entityId: d.id, after: body },
        tx,
      );
    });
    res.json({ updated: true });
  },
);
