import { logger } from "../lib/logger.js";
import { ownedOrderWhere } from "../services/order-search.js";
import { orderPaymentView } from "../services/order-payment-view.js";
import { storeMedia, readMedia, deleteMedia } from "../services/storage/private-media.js";
import { imageType } from "./produce-photos.js";
import { mode, queueReceiptRelease } from "../services/payments.js";
import { deliveryVisibility, orderFulfillment } from "@leetlogic/contracts";
import { fulfillmentView } from "../services/order-fulfillment-view.js";
import { recordParcelStatus, recordProviderTracking, trackedUrl } from "../services/delivery-tracking.js";
import { notificationInbox, readNotifications } from "../services/notification-inbox.js";
import { buyerPickupContactAvailable, pickupContactView } from "../services/pickup-contact.js";
import { financeEnabled, markFulfillmentSecured, readFulfillment, assertFulfillmentOpen } from "../services/fulfillment-deadline.js";
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
import { Router, raw, type Request } from "express";
import { z } from "zod";
import { prisma, type Prisma } from "@leetlogic/database";
import { requireAuth, requirePermission, requireRecentStepUp } from "../middleware/auth.js";
import { AppError } from "../lib/errors.js";
import { getConfig } from "../config.js";
import { canAdvanceManualDelivery, deliveryReceiptReady, deliveryRefundReady } from "../services/delivery-policy.js";
import { audit } from "../services/audit.js";
import { contactSchema } from "../providers/shipping/shipbubble.js";
import { assertNoDeliverySettlement, queueBooking, deliveryEvent, finalizeDeliveryBooking, hasDeliverySettlement, hashInput, serialize, shippingProvider } from "../services/delivery.js";
import { recordedSplitBooking, splitPlanMatches } from "../services/split-delivery.js";
import { splitParts, type TrackedShipment } from "../providers/shipping/shipbubble.js";
import { adminMutationSchema, adminRecordRevision, assertAdminRecordCurrent, correctAdminDelivery, correctionCapabilities, lastOrderHistoryId, mutateAdminOrder } from "../services/admin-order-management.js";
import { readOrderHistory } from "../services/order-record-history.js";
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
          events: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
          parcels: { orderBy: { parcelIndex: "asc" } },
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
  res.set("Cache-Control", "private, no-store");
  res.json(await notificationInbox(req.auth!.sub, view === "seller"));
});
customerDeliveryRouter.post("/notifications/read", async (req,res)=>{
  const input=z.union([z.object({ids:z.array(uuid).min(1).max(150)}).strict(),z.object({through:z.string().datetime()}).strict()]).parse(req.body);
  const through="through" in input?new Date(input.through):undefined;
  if(through && through.getTime()>Date.now())throw new AppError(422,"INVALID_READ_TIME","Refresh your updates before marking them read.");
  await readNotifications(req.auth!.sub,"ids" in input?input.ids:undefined,through);
  res.json({read:true});
});
customerDeliveryRouter.get("/", async (req, res) => {
  const query = z.object({ view: z.enum(["buyer", "seller"]).optional(), q: z.string().trim().max(100).optional(), filter: z.enum(["ALL", "ACTIVE", "COMPLETED", "CANCELLED"]).default("ALL"), limit: z.coerce.number().int().min(1).max(50).default(50), cursor: uuid.optional() }).parse(req.query);
  const requestedView = query.view;
  const view = req.auth!.capabilities!.includes("SELLER") ? "seller" : "buyer";
  if (requestedView && requestedView !== view)
    throw new AppError(
      403,
      "ROLE_FORBIDDEN",
      "This dashboard is not available for your account role.",
    );
  const where = ownedOrderWhere(req.auth!.sub, view === "seller", query);
  if (query.cursor && !(await prisma.tradeOrder.findFirst({ where: { AND: [where, { id: query.cursor }] }, select: { id: true } })))
    throw new AppError(422, "INVALID_CURSOR", "Refresh your orders before loading another page.");
  const rows = await prisma.tradeOrder.findMany({
    where,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      reference: true,
      status: true,
      deliveryConfirmedAt: true,
      financialHold: true,
      farmerDecision: true,
      handedOverAt: true,
      totalMinor: true,
      reservationExpiresAt: true,
      quantity: true,
      farmerProfile: { select: { farmName: true, user: { select: { profile: { select: { fullName: true, displayName: true } } } } } },
      listing: { select: { title: true, unitCode: true, salePackaging: true } },
      delivery: { select: { status: true, shippingMinor: true, events: {where:{status:{in:["READY_FOR_PICKUP","FARMER_DISPATCHED"]}},select:{status:true}} } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: query.limit + 1,
  });
  const hasMore = rows.length > query.limit;
  const items = rows.slice(0, query.limit);
  res.set("Cache-Control", "private, no-store");
  res.json(serialize({hasMore, nextCursor: hasMore ? items.at(-1)!.id : null, items:items.map(item=>({...item, sellerName: item.farmerProfile.user.profile?.fullName || item.farmerProfile.user.profile?.displayName || item.farmerProfile.farmName, farmName: item.farmerProfile.farmName, farmerProfile: undefined, delivery:item.delivery?{status:item.delivery.status,shippingMinor:item.delivery.shippingMinor}:null,fulfillmentStatus:["FUNDED","DELIVERED","COMPLETED"].includes(item.status)?orderFulfillment({farmerDecision:item.farmerDecision,handedOver:!!item.handedOverAt,review:item.financialHold,paid:true,confirmed:!!item.deliveryConfirmedAt,blocked:item.financialHold,buyer:view==="buyer",farmer:view==="seller",status:item.delivery?.status||"",ready:!!item.delivery?.events.some(e=>e.status==="READY_FOR_PICKUP"),dispatched:!!item.delivery?.events.some(e=>e.status==="FARMER_DISPATCHED"),booked:false,receiptReady:false,collection:!!item.delivery?.status.startsWith("PICKUP_")}).status:item.status}))}));
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
customerDeliveryRouter.post("/:id/delivery/dispatch", async (req, res) => {
  const order = await orderAccess(req);
  if (order.farmerProfile.userId !== req.auth!.sub)
    throw new AppError(403, "FARMER_REQUIRED", "Only the farmer can confirm dispatch.");
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM trade_orders WHERE id=${order.id}::uuid FOR UPDATE`;
    const current = await tx.tradeOrder.findUniqueOrThrow({
      where: { id: order.id },
      include: { delivery: true },
    });
    const d = current.delivery,
      key = `${d?.id}:farmer-dispatched`;
    if (d && (await tx.deliveryEvent.findUnique({ where: { dedupeKey: key } }))) return;
    await assertFulfillmentOpen(tx, order.id);
    if (!(await fulfillmentView(current, false, true, tx)).canDispatch)
      throw new AppError(
        409,
        "DELIVERY_NOT_READY",
        "Mark the order ready and wait for a confirmed courier booking before dispatch.",
      );
    await deliveryEvent(tx, d!.id, "FARMER_DISPATCHED", "farmer", key, req.auth!.sub);
    await audit(
      req,
      { action: "delivery.farmer.dispatched", entityType: "order", entityId: order.id },
      tx,
    );
  });
  res.json({ dispatched: true });
});
// Readiness is an order-scoped milestone, separate from provider shipment status.
customerDeliveryRouter.post("/:id/delivery/ready", async (req, res) => {
  const order = await orderAccess(req);
  if (order.farmerProfile.userId !== req.auth!.sub)
    throw new AppError(403, "FARMER_REQUIRED", "Only the farmer can confirm produce readiness.");
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM trade_orders WHERE id=${order.id}::uuid FOR UPDATE`;
    const current = await tx.tradeOrder.findUniqueOrThrow({ where: { id: order.id }, include: { delivery: true } });
    await assertFulfillmentOpen(tx, order.id);
    const d = current.delivery;
    const key = `${d?.id}:ready`;
    if (d && await tx.deliveryEvent.findUnique({ where: { dedupeKey: key } })) return;
    if (!(await fulfillmentView(current,false,true,tx)).canReady || !d ||
      !["PICKUP_PREPARING", "PAID", "BOOKING_QUEUED", "BOOKING", "BOOKING_BLOCKED", "BOOKED", "MANUAL_ASSIGNED"].includes(d.status))
      throw new AppError(409, "DELIVERY_NOT_READY", "This order cannot be marked ready for pickup.");
    if (d.status === "PICKUP_PREPARING")
      await tx.delivery.update({ where: { id: d.id }, data: { status: "PICKUP_READY" } });
    if (d.status === "PICKUP_PREPARING" && financeEnabled()) {
      const deadline = await tx.fulfillmentDeadline.findUnique({ where: { orderId: order.id } });
      if (deadline?.collectionBuyerAt) await markFulfillmentSecured(tx, order.id);
    }
    await deliveryEvent(tx, d.id, "READY_FOR_PICKUP", "farmer", key, req.auth!.sub);
    if (["PAID", "BOOKING_BLOCKED"].includes(d.status))
      // Wake a newly ready order immediately, rather than retaining the farmer-wait backoff.
      await tx.delivery.update({ where: { id: d.id }, data: { nextSyncAt: new Date() } });
    await audit(req, { action: "delivery.produce.ready", entityType: "order", entityId: order.id }, tx);
  });
  res.json({ ready: true });
});

// Farmer decisions and receipt evidence use the same order lock as disputes and money operations.
customerDeliveryRouter.post("/:id/delivery/decision", async (req, res) => {
  const order = await orderAccess(req);
  if (order.farmerProfile.userId !== req.auth!.sub) throw new AppError(403, "FARMER_REQUIRED", "Only the farmer can decide this order.");
  const input = z.object({ accept: z.boolean(), reason: z.string().trim().min(5).max(500).optional() }).strict().parse(req.body);
  if (!input.accept && !input.reason) throw new AppError(422, "REASON_REQUIRED", "Tell the buyer why you cannot fulfill this order.");
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM trade_orders WHERE id=${order.id}::uuid FOR UPDATE`;
    const current = await tx.tradeOrder.findUniqueOrThrow({ where: { id: order.id }, include: { delivery: true } });
    const decision = input.accept ? "ACCEPTED" : "REJECTED";
    if (current.farmerDecision === decision) return;
    if (!(await fulfillmentView(current, false, true, tx)).canAccept || !current.delivery)
      throw new AppError(409, "ORDER_DECISION_CLOSED", "Refresh this order. It can no longer be accepted or declined.");
    await assertFulfillmentOpen(tx, order.id);
    await tx.tradeOrder.update({ where: { id: order.id }, data: { farmerDecision: decision, farmerDecidedAt: new Date(), rejectionReason: input.accept ? null : input.reason } });
    await deliveryEvent(tx, current.delivery.id, input.accept ? "ORDER_ACCEPTED" : "ORDER_REJECTED", "farmer", `${current.delivery.id}:decision`, req.auth!.sub);
    if (!input.accept) {
      await tx.supportTicket.create({ data: { orderId: order.id, userId: order.buyerId, kind: "SUPPORT", subject: "Farmer declined order — refund required", priority: "HIGH", messages: { create: { authorId: req.auth!.sub, body: input.reason! } } } });
      await tx.fulfillmentDeadline.updateMany({ where: { orderId: order.id, state: "ACTIVE" }, data: { state: "REFUND_DUE", nextRunAt: new Date() } });
    }
    await audit(req, { action: input.accept ? "order.farmer.accepted" : "order.farmer.rejected", entityType: "order", entityId: order.id, after: { reason: input.reason } }, tx);
  });
  res.json({ saved: true });
});
customerDeliveryRouter.post("/:id/delivery/handover", async (req, res) => {
  const order = await orderAccess(req);
  if (order.farmerProfile.userId !== req.auth!.sub) throw new AppError(403, "FARMER_REQUIRED", "Only the farmer can record handover.");
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM trade_orders WHERE id=${order.id}::uuid FOR UPDATE`;
    const current = await tx.tradeOrder.findUniqueOrThrow({ where: { id: order.id }, include: { delivery: true } });
    if (current.handedOverAt) return;
    await assertFulfillmentOpen(tx, order.id);
    if (!(await fulfillmentView(current, false, true, tx)).canHandover) throw new AppError(409, "HANDOVER_NOT_READY", "Mark the goods ready before handing them to the buyer.");
    await tx.tradeOrder.update({ where: { id: order.id }, data: { handedOverAt: new Date() } });
    await deliveryEvent(tx, current.delivery!.id, "BUYER_COLLECTED", "farmer", `${current.delivery!.id}:handover`, req.auth!.sub);
    await audit(req, { action: "order.buyer.handover", entityType: "order", entityId: order.id }, tx);
  });
  res.json({ handedOver: true });
});
customerDeliveryRouter.post("/:id/delivery/receipt-photo", raw({ type: ["image/jpeg", "image/png"], limit: "10mb" }), async (req, res) => {
  const order = await orderAccess(req);
  if (order.buyerId !== req.auth!.sub) throw new AppError(403, "BUYER_REQUIRED", "Only the buyer can add a receipt photo.");
  if (!Buffer.isBuffer(req.body) || req.body.length < 16 || imageType(req.body) !== req.get("content-type"))
    throw new AppError(422, "INVALID_PHOTO", "Choose a JPEG or PNG photo smaller than 10 MB.");
  const key = await storeMedia(req.body, req.get("content-type")!, `receipt/${order.id}/${randomUUID()}`);
  let previous: string | null = null;
  try {
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM trade_orders WHERE id=${order.id}::uuid FOR UPDATE`;
      const current = await tx.tradeOrder.findUniqueOrThrow({ where: { id: order.id }, include: { delivery: true } });
      if (!(await fulfillmentView(current, true, false, tx)).canConfirm) throw new AppError(409, "RECEIPT_NOT_READY", "Receipt photos can only be added when the order is ready for confirmation.");
      previous = current.receiptPhotoKey;
      await tx.tradeOrder.update({ where: { id: order.id }, data: { receiptPhotoKey: key, receiptPhotoMime: req.get("content-type")!, receiptPhotoAt: new Date() } });
      await audit(req, { action: "order.receipt.photo.saved", entityType: "order", entityId: order.id }, tx);
    });
  } catch (error) { await deleteMedia(key).catch(() => {}); throw error; }
  if (previous) await deleteMedia(previous).catch(() => {});
  res.status(201).json({ saved: true });
});
for (const router of [customerDeliveryRouter, staffDeliveryRouter]) {
  router.get("/:id/delivery/receipt-photo", async (req, res) => {
    const order = await orderAccess(req);
    if (!order.receiptPhotoKey) throw new AppError(404, "PHOTO_NOT_FOUND", "No receipt photo has been saved.");
    res.set({ "Content-Type": order.receiptPhotoMime || "image/jpeg", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" }).send(await readMedia(order.receiptPhotoKey));
  });
}

for (const router of [customerDeliveryRouter, staffDeliveryRouter]) {
  router.get("/:id/delivery", async (req, res) => {
    res.set("Cache-Control", "private, no-store");
    const order = await orderAccess(req);
    const delivery = order.delivery;
    const parcels = delivery?.parcels || [];
    const checkout = checkoutSummary(order);
    const ownOrStaff = req.auth!.subject === "admin" || order.farmerProfile.userId === req.auth!.sub;
    const pickupContactAvailable = ownOrStaff || await buyerPickupContactAvailable(order);
    const checkoutActive = !!(await prisma.paymentAttempt.count({
      where: { orderId: order.id, OR: [
        { status: { in: ["QUEUED", "PROCESSING", "UNKNOWN", "OPEN"] } },
        { status: "BLOCKED", checkoutId: { not: null } },
        { checkoutId: { not: null }, confirmedAt: null, checkErrorCode: { not: null } },
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
    const isStaff = req.auth!.subject === "admin";
    const [disputes, ledger] = isStaff ? await Promise.all([
      prisma.supportTicket.findMany({ where: { orderId: order.id, kind: "DISPUTE", status: { not: "RESOLVED" } }, select: { id: true, status: true, subject: true } }),
      prisma.escrowEntry.findMany({ where: { orderId: order.id }, orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { id: true, kind: true, amountMinor: true, feeMinor: true, externalRef: true, reason: true, createdAt: true } }),
    ]) : [[], []];
    // Presentation hints use the same parcel/transition policies as the mutation endpoints.
    // Writes still recheck authorization, locks, quotes and balances in their transactions.
    const parcelDelivery = delivery ? { ...delivery, parcels } : null;
    const manualEscrowKinds: string[] = [];
    if (isStaff && order.fundsProvider !== "bachs" && !order.financialHold && !checkoutActive) {
      const fundingQuote = quotes.find(quote => quote.id === delivery?.selectedQuoteId && quote.available && quote.expiresAt > new Date());
      if (order.status === "AWAITING_PAYMENT" && (!delivery || delivery.status === "MANUAL_REVIEW" || fundingQuote)) manualEscrowKinds.push("FUND");
      if (order.heldMinor > 0n && !disputes.length) {
        if (order.deliveryConfirmedAt && (!delivery || deliveryReceiptReady(parcelDelivery))) manualEscrowKinds.push("RELEASE");
        if (deliveryRefundReady(parcelDelivery)) manualEscrowKinds.push("REFUND");
      }
    }
    const staffContext = isStaff ? {
      revision: adminRecordRevision(order, await lastOrderHistoryId(order.id)),
      buyerContact: order.buyerContactSnapshot,
      fulfillmentNotes: order.fulfillmentNotes,
      corrections: correctionCapabilities(order, checkoutActive, order.settlementStarted),
      activity: await readOrderHistory(order.id),
      buyer: { name: order.buyer.profile?.fullName || order.buyer.profile?.displayName || order.buyer.phoneE164, phone: order.buyer.phoneE164 },
      farmer: { name: order.farmerProfile.user.profile?.fullName || order.farmerProfile.farmName, farmName: order.farmerProfile.farmName, phone: order.farmerProfile.user.phoneE164 },
      farmerDecidedAt: order.farmerDecidedAt,
      createdAt: order.createdAt,
      fundsProvider: order.fundsProvider,
      manualFundingRecorded: order.fundsProvider !== "bachs" && ledger.some(entry => entry.kind === "FUND"),
      financialHold: order.financialHold,
      disputes, ledger, manualEscrowKinds,
      manualDeliveryStatuses: delivery && !delivery.providerShipmentId && ["FUNDED", "DELIVERED"].includes(order.status) &&
        !["MANUAL_REVIEW", "QUOTE_REQUIRED", "PAYMENT_PENDING"].includes(delivery.status) && order.shipment
        ? ["PICKED_UP", "IN_TRANSIT", "DELIVERED", "FAILED_ATTEMPT", "RETURNING", "RETURNED", "CANCELLED"].filter(status =>
          canAdvanceManualDelivery(delivery.status, status)) : [],
    } : undefined;
    res.json(
      serialize({
        observedAt: new Date().toISOString(),
        ...(staffContext ? { staffContext } : {}),
        tracking: delivery && !delivery.status.startsWith("PICKUP_") && !(delivery.status === "DELIVERED" && !delivery.selectedQuoteId && !delivery.providerShipmentId && !delivery.courier)
          ? deliveryVisibility({ ...delivery, parcels, trackingRef: order.shipment?.trackingRef, orderStatus: order.status, receiptConfirmedAt: order.deliveryConfirmedAt })
          : !delivery && order.shipment ? deliveryVisibility({
            status: order.shipment.status === "ASSIGNED" ? "MANUAL_ASSIGNED" : order.shipment.status,
            courier: order.shipment.carrier, trackingRef: order.shipment.trackingRef, createdAt: order.shipment.createdAt, bookingStartedAt: order.shipment.updatedAt,
            orderStatus: order.status, receiptConfirmedAt: order.deliveryConfirmedAt, receiptSource: "legacy-staff",
          }) : null,
        legacyShipment: !delivery && order.shipment ? {
          id: order.shipment.id, carrier: order.shipment.carrier, trackingRef: order.shipment.trackingRef,
          status: order.shipment.status, evidence: order.shipment.evidence,
          createdAt: order.shipment.createdAt, updatedAt: order.shipment.updatedAt,
        } : null,
        ...(isStaff ? { manualShipment: order.shipment && !delivery?.providerShipmentId && !delivery?.bookingStartedAt
          ? { id: order.shipment.id, carrier: order.shipment.carrier, trackingRef: order.shipment.trackingRef, status: order.shipment.status, riderAssignment: order.shipment.riderAssignment } : null } : {}),
        money: {
          progress: await orderPaymentView(order),
          heldMinor: order.heldMinor, releasedMinor: order.releasedMinor, refundedMinor: order.refundedMinor,
          release: await prisma.moneyOperation.findFirst({ where: { orderId: order.id, mode: mode(), kind: "RELEASE" }, orderBy: { createdAt: "desc" }, select: { status: true, failureCode: true, updatedAt: true } }),
        },
        fulfillment: await readFulfillment(order.id),
        progress: await fulfillmentView(order,order.buyerId===req.auth!.sub,req.auth!.subject!=="admin"&&order.farmerProfile.userId===req.auth!.sub),
        order: {
          id: order.id,
          journeyVersion: order.journeyVersion,
          farmerDecision: order.farmerDecision,
          rejectionReason: order.rejectionReason,
          handedOverAt: order.handedOverAt,
          receiptPhoto: order.receiptPhotoAt ? { uploadedAt: order.receiptPhotoAt, url: `/orders/${order.id}/delivery/receipt-photo` } : null,
          reference: order.reference,
          status: order.status,
          deliveryConfirmedAt: order.deliveryConfirmedAt,
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
          pickupContactAvailable,
          pickupEmailRequired: !order.farmerProfile.user.profile?.email,
          suggestedPickup: pickupContactView({
            name: order.farmerProfile.user.profile?.fullName || order.farmerProfile.farmName,
            phone: order.farmerProfile.user.phoneE164,
            email: order.farmerProfile.user.profile?.email || "",
            ...savedPickup(order),
          }, pickupContactAvailable),
        },
        delivery: delivery
          ? {
              ...delivery,
              operationsNotes: isStaff ? delivery.operationsNotes : undefined,
              pickup: pickupContactView(delivery.pickup, pickupContactAvailable),
              quotes: rankDeliveryQuotes(quotes).map(safeQuote),
              parcels: parcels.map(({ id, parcelIndex, status, trackingUrl, failureCode, providerShipmentId, quoteId }) => ({
                id, parcelIndex, status, trackingUrl, failureCode, ...(staffContext ? { providerShipmentId, quoteId } : {}),
              })),
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
      await assertAdminRecordCurrent(req, tx, order.id);
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
        // Keep the pickup address integrity checks, while private contact data stays server-side.
        const raw = req.body;
        const body = quoteBody.parse(raw && typeof raw === "object" && raw.pickup && typeof raw.pickup === "object" ? {
          ...raw, pickup: { ...raw.pickup, phone: current.farmerProfile.user.phoneE164,
            email: current.farmerProfile.user.profile?.email || raw.pickup.email },
        } : raw);
        input = deriveDeliveryInput(current, { ...body, pickupDate: body.parcel.pickupDate });
      } catch (error) {
        if (current.delivery) await tx.delivery.update({ where: { id: current.delivery.id }, data: { failureCode: error instanceof AppError ? error.code : "VALIDATION_ERROR" } });
        if (current.delivery) await audit(req, { action: "delivery.quote.invalidated", entityType: "delivery", entityId: current.delivery.id }, tx);
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
      await audit(req, { action: "delivery.quote.requested", entityType: "delivery", entityId: d.id }, tx);
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
      await assertAdminRecordCurrent(req, tx, order.id);
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
        req.auth!.subject === "admin" ? "admin" : "customer",
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
      await assertAdminRecordCurrent(req, tx, order.id);
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
      await audit(req, { action: "delivery.quote.refresh.requested", entityType: "delivery", entityId: d.id }, tx);
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
    await queueBooking(order.id, req.auth!.subject === "admin" ? {
      guard: tx => assertAdminRecordCurrent(req, tx, order.id),
      recorded: tx => audit(req, { action: "delivery.booking.requested", entityType: "order", entityId: order.id }, tx),
    } : undefined);
    res.status(202).json({ queued: true });
  });
}
staffDeliveryRouter.post("/:id/delivery/corrections", requirePermission("orders.manage"), async (req, res) => {
  res.json(await correctAdminDelivery(req, uuid.parse(req.params.id)));
});
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
        ...adminMutationSchema.shape,
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
      await assertAdminRecordCurrent(req, tx, order.id);
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
    const body = adminMutationSchema.strict().parse(req.body);
    const result = await mutateAdminOrder(req, order.id, "delivery.tracking.refresh.requested", body, async (tx, current) => {
      const d = current.delivery;
      if (!d) throw new AppError(404, "DELIVERY_NOT_FOUND", "Delivery not found");
      if (!d.providerShipmentId) throw new AppError(409, "MANUAL_RECONCILIATION_REQUIRED", "Locate the shipment in Shipbubble and link it; do not repeat an uncertain booking");
      await tx.delivery.update({ where: { id: d.id }, data: { nextSyncAt: new Date() } });
      return { queued: true, message: "Tracking refresh queued. The recorded status changes only after a verified provider update." };
    });
    res.status(202).json(result);
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
        ...adminMutationSchema.shape,
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
      await assertAdminRecordCurrent(req, tx, order.id);
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
          trackingUrl: trackedUrl(tracked),
          actualMinor: tracked.shippingMinor,
          status: "BOOKED",
          failureCode: null,
        },
      });
      if (!changed.count)
        throw new AppError(409, "STALE_RECORD", "Parcel changed. Refresh and try again.");
      await recordParcelStatus(tx, current.id, tracked, parcel.parcelIndex, "BOOKED", "booking", "admin", req.auth!.sub);
      await recordProviderTracking(tx, current.id, tracked, parcel.parcelIndex);
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
        ...adminMutationSchema.shape,
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
      await assertAdminRecordCurrent(req, tx, order.id);
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
    const body = adminMutationSchema.strict().parse(req.body);
    const result = await mutateAdminOrder(req, order.id, "delivery.cancel.requested", body, async (tx, record) => {
      await assertNoDeliverySettlement(tx, order.id);
      const current = record.delivery;
      if (!current?.providerShipmentId || ["DELIVERED", "CANCELLED", "RETURNED"].includes(current.status) || current.cancelRequestedAt)
        throw new AppError(409, "CANNOT_CANCEL", "This shipment cannot be cancelled");
      await tx.delivery.update({
        where: { id: current.id },
        data: { cancelRequestedAt: new Date(), nextSyncAt: new Date() },
      });
      return { requested: true, message: "Cancellation requested; wait for courier confirmation. No external refund has been issued." };
    });
    res.status(202).json(result);
  },
);
customerDeliveryRouter.post("/:id/delivery/confirm", async (req, res) => {
  const order = await orderAccess(req);
  if(order.buyerId!==req.auth!.sub)throw new AppError(403,"BUYER_REQUIRED","Only the buyer can confirm receipt.");
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM trade_orders WHERE id = ${order.id}::uuid FOR UPDATE`;
    const current = await tx.tradeOrder.findUniqueOrThrow({
      where: { id: order.id },
      include: { delivery: { include: { parcels: true } } },
    });
    if(current.deliveryConfirmedAt)return;
    if (current.journeyVersion >= 2 && (!current.receiptPhotoKey || req.body?.acknowledged !== true))
      throw new AppError(422, "RECEIPT_EVIDENCE_REQUIRED", "Add a receipt photo and confirm that you inspected all the goods.");
    if (["PENDING", "REJECTED"].includes(current.farmerDecision))
      throw new AppError(409, "FARMER_ACCEPTANCE_REQUIRED", "The farmer must accept this order first.");
    await unlockedCheckout(tx,order.id);
    await assertFulfillmentOpen(tx,order.id);
    await assertNoDeliverySettlement(tx,order.id);
    if(current.financialHold || await tx.supportTicket.count({where:{orderId:order.id,kind:"DISPUTE",status:{not:"RESOLVED"}}}))throw new AppError(409,"ORDER_UNDER_REVIEW","Resolve the order dispute before confirming receipt.");
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
    await deliveryEvent(tx,current.delivery!.id,"BUYER_RECEIPT_CONFIRMED","buyer",`${current.delivery!.id}:receipt`,req.auth!.sub);
    await audit(
      req,
      { action: "delivery.recipient.confirmed", entityType: "order", entityId: order.id },
      tx,
    );
  });
  await queueReceiptRelease(order.id).catch(() => logger.warn({ orderId: order.id, code: "RELEASE_WAKEUP_FAILED" }, "Receipt saved; durable payment worker will retry release")); // Durable worker retries a lost post-commit wakeup.
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
    const body = adminMutationSchema
      .extend({ carrier: z.string().trim().min(2).max(120), trackingRef: z.string().trim().min(2).max(120) })
      .strict()
      .parse(req.body);
    const result = await mutateAdminOrder(req, order.id, "delivery.manual.assigned", body, async (tx, current) => {
      await unlockedCheckout(tx, order.id);
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
    });
    res.json(result);
  },
);
staffDeliveryRouter.post(
  "/:id/delivery/manual-status",
  requirePermission("orders.manage"),
  async (req, res) => {
    const order = await orderAccess(req);
    const body = adminMutationSchema
      .extend({
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
      .strict()
      .parse(req.body);
    if (body.status === "CANCELLED") {
      const age = req.auth!.stepUpAt ? Math.floor(Date.now() / 1000) - req.auth!.stepUpAt : Infinity;
      if (age > 300) throw new AppError(403, "STEP_UP_REQUIRED", "Confirm cancellation with a recent authenticator code.");
    }
    const result = await mutateAdminOrder(req, order.id, "delivery.manual.status", body, async (tx, current) => {
      await unlockedCheckout(tx, order.id);
      await assertNoDeliverySettlement(tx, order.id);
      const d = current.delivery;
      if (
        !d ||
        !current.shipment ||
        d.providerShipmentId ||
        !["FUNDED", "DELIVERED"].includes(current.status) ||
        ["MANUAL_REVIEW", "QUOTE_REQUIRED", "PAYMENT_PENDING"].includes(d.status) ||
        !canAdvanceManualDelivery(d.status, body.status)
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
        `${d.id}:manual:${body.mutationKey}`,
        req.auth!.sub,
        { evidence: body.evidence, reason: body.reason },
      );
    });
    res.json(result);
  },
);
