import { createHash } from "node:crypto";
import type { Request } from "express";
import { z } from "zod";
import { prisma, Prisma } from "@leetlogic/database";
import { nigeriaStateSchema, postalCodeSchema } from "@leetlogic/contracts";
import { AppError } from "../lib/errors.js";
import { audit } from "./audit.js";
import { assertNoActiveCheckout } from "./delivery-quote.js";
import { assertNoDeliverySettlement } from "./delivery.js";

export const adminMutationSchema = z.object({
  reason: z.string().trim().min(10).max(500),
  expectedRevision: z.string().regex(/^[a-f0-9]{64}$/),
  mutationKey: z.string().uuid(),
});
export const buyerContactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().regex(/^\+?\d{10,15}$/),
  email: z.union([z.string().trim().email().max(254), z.literal("")]),
}).strict();
// An entered correction is a new local snapshot, never an edit to an owned saved address.
// Do not retain an address ID or map pin for a different street.
export const correctedDestinationSchema = buyerContactSchema.extend({
  address: z.string().trim().min(15).max(500),
  state: nigeriaStateSchema,
  country: z.literal("NG"),
  postalCode: postalCodeSchema.optional(),
  instructions: z.string().trim().max(700).optional(),
}).strict();
export const orderCorrectionSchema = adminMutationSchema.extend({
  changes: z.object({
    buyerContact: buyerContactSchema.optional(),
    fulfillmentNotes: z.string().trim().max(700).nullable().optional(),
  }).strict().refine(value => Object.keys(value).length > 0, "Choose a field to correct"),
}).strict();
export const deliveryCorrectionSchema = adminMutationSchema.extend({
  changes: z.object({
    destination: correctedDestinationSchema.optional(),
    operationsNotes: z.string().trim().max(700).nullable().optional(),
    riderAssignment: z.object({
      name: z.string().trim().min(2).max(120),
      phone: z.string().trim().regex(/^\+?\d{10,15}$/),
      reference: z.string().trim().min(3).max(120),
    }).strict().optional(),
  }).strict().refine(value => Object.keys(value).length > 0, "Choose a field to correct"),
  arrangementConfirmed: z.literal(true).optional(),
}).strict();

export const adminRecordInclude = {
  delivery: { include: { parcels: { orderBy: { parcelIndex: "asc" } }, events: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } } },
  shipment: true,
} as const satisfies Prisma.TradeOrderInclude;
export type EditableOrder = Prisma.TradeOrderGetPayload<{ include: typeof adminRecordInclude }>;

const fingerprint = (value: unknown) => createHash("sha256").update(JSON.stringify(value, (_key, item) => {
  if (typeof item === "bigint") return item.toString();
  return item && typeof item === "object" && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item;
})).digest("hex");
const withoutPolling = (value: Record<string, unknown>) => Object.fromEntries(Object.entries(value)
  .filter(([key]) => !["updatedAt", "lastSyncedAt", "nextSyncAt", "leaseUntil", "quotes", "events", "parcels"].includes(key)));

/** Includes immutable history's high-water mark, so changing a value back cannot revive an old revision. */
export function adminRecordRevision(order: Record<string, unknown>, historyId: bigint | string = "0") {
  const { delivery, shipment, buyer: _buyer, farmerProfile: _farmer, listing: _listing, settlementStarted: _settlement, ...fields } = order;
  void _buyer; void _farmer; void _listing; void _settlement;
  const d = delivery as EditableOrder["delivery"];
  return fingerprint({ order: fields, delivery: d ? withoutPolling(d) : null, shipment: shipment || null,
    parcels: d?.parcels?.map(withoutPolling) || [], events: d?.events?.map(event => event.id) || [], historyId: String(historyId) });
}

export async function lastOrderHistoryId(orderId: string, tx: Prisma.TransactionClient = prisma) {
  return (await tx.orderRecordHistory.aggregate({ where: { orderId }, _max: { id: true } }))._max.id || 0n;
}

/** First locked stage of existing provider workflows. Later stages retain their
 * own quote/booking identity checks rather than starting replacement bookings. */
export async function assertAdminRecordCurrent(req: Request, tx: Prisma.TransactionClient, orderId: string) {
  if (req.auth?.subject !== "admin") return;
  const body = adminMutationSchema.parse(req.body);
  await tx.$queryRaw`SELECT id FROM deliveries WHERE "orderId" = ${orderId}::uuid FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM shipments WHERE "orderId" = ${orderId}::uuid FOR UPDATE`;
  const order = await tx.tradeOrder.findUniqueOrThrow({ where: { id: orderId }, include: adminRecordInclude });
  if (body.expectedRevision !== adminRecordRevision(order, await lastOrderHistoryId(orderId, tx)))
    throw new AppError(409, "STALE_RECORD", "This record changed. Refresh and review your proposed changes again.");
}

export function correctionCapabilities(order: EditableOrder, checkoutActive: boolean, settlementStarted: boolean) {
  const d = order.delivery, s = order.shipment;
  const open = !order.financialHold && !checkoutActive && !settlementStarted;
  const noProvider = !!d && !d.providerShipmentId && !d.bookingStartedAt && !d.cancelRequestedAt && !d.parcels.length;
  const beforePayment = open && noProvider && order.status === "AWAITING_PAYMENT" && !s && !d.paidMinor && !d.paymentRef &&
    ["QUOTE_REQUIRED", "PAYMENT_PENDING", "MANUAL_REVIEW"].includes(d.status);
  const manualBeforeDispatch = open && noProvider && order.status === "FUNDED" && !order.deliveryConfirmedAt &&
    !!s && s.status === "ASSIGNED" && d.status === "MANUAL_ASSIGNED" && !d.paidMinor && !d.selectedQuoteId;
  const rider = open && !!s && ["FUNDED", "DELIVERED"].includes(order.status) && !order.deliveryConfirmedAt &&
    (!d || noProvider && ["MANUAL_ASSIGNED", "PICKED_UP", "IN_TRANSIT", "FAILED_ATTEMPT"].includes(d.status)) &&
    ["ASSIGNED", "PICKED_UP", "IN_TRANSIT", "FAILED_ATTEMPT"].includes(s.status);
  return { orderInformation: true, deliveryNotes: !!d, destination: !!(beforePayment || manualBeforeDispatch),
    riderAssignment: !!rider, destinationRequiresNewQuote: !!(beforePayment && d.status !== "MANUAL_REVIEW"),
    providerControlled: !!d && (!!d.providerShipmentId || !!d.bookingStartedAt || !!d.parcels.length) };
}

/** All local corrections and manual status changes commit with their audit and replay receipt. */
export async function mutateAdminOrder<T extends z.infer<typeof adminMutationSchema>>(
  req: Request, orderId: string, command: string, body: T,
  change: (tx: Prisma.TransactionClient, order: EditableOrder) => Promise<void | Record<string, string | boolean>>,
) {
  if (req.auth?.subject !== "admin" || !req.auth.permissions?.includes("orders.read") || !req.auth.permissions.includes("orders.manage"))
    throw new AppError(403, "FORBIDDEN", "Order management permission is required");
  const scope = `order-admin:${req.auth.sub}`, requestHash = fingerprint({ orderId, command, body });
  return prisma.$transaction(async tx => {
    // Serialize one request key across orders too, without reserving a key outside the transaction.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${scope}:${body.mutationKey}`}, 0))::text`;
    const previous = await tx.idempotencyRecord.findUnique({ where: { scope_idempotencyKey: { scope, idempotencyKey: body.mutationKey } } });
    if (previous) {
      if (previous.requestHash !== requestHash) throw new AppError(409, "IDEMPOTENCY_CONFLICT", "This request identifier was used for different changes. Review a new request.");
      return previous.responseBody;
    }
    await tx.$queryRaw`SELECT id FROM trade_orders WHERE id = ${orderId}::uuid FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM deliveries WHERE "orderId" = ${orderId}::uuid FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM shipments WHERE "orderId" = ${orderId}::uuid FOR UPDATE`;
    const order = await tx.tradeOrder.findUnique({ where: { id: orderId }, include: adminRecordInclude });
    if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found");
    if (body.expectedRevision !== adminRecordRevision(order, await lastOrderHistoryId(orderId, tx)))
      throw new AppError(409, "STALE_RECORD", "This record changed after you opened it. Refresh, compare your proposed changes and review them again.");
    const result = await change(tx, order);
    await audit(req, { action: command, entityType: "order", entityId: orderId, reason: body.reason }, tx);
    const response = { saved: true, message: "Changes saved with their original values, administrator and reason in Activity History.", ...result };
    await tx.idempotencyRecord.create({ data: { scope, idempotencyKey: body.mutationKey, requestHash, resourceId: orderId,
      responseStatus: 200, responseBody: response, completedAt: new Date(), expiresAt: new Date(Date.now() + 365 * 86400000) } });
    return response;
  });
}

export async function correctAdminOrder(req: Request, orderId: string) {
  const body = orderCorrectionSchema.parse(req.body);
  return mutateAdminOrder(req, orderId, "order.information.corrected", body, async (tx, order) => {
    const data: Prisma.TradeOrderUpdateInput = {};
    if (body.changes.buyerContact && fingerprint(body.changes.buyerContact) !== fingerprint(order.buyerContactSnapshot))
      data.buyerContactSnapshot = body.changes.buyerContact;
    if (body.changes.fulfillmentNotes !== undefined && (body.changes.fulfillmentNotes || null) !== order.fulfillmentNotes)
      data.fulfillmentNotes = body.changes.fulfillmentNotes || null;
    if (!Object.keys(data).length) throw new AppError(422, "NO_CHANGES", "No order information has changed.");
    await tx.tradeOrder.update({ where: { id: orderId }, data });
  });
}

export async function correctAdminDelivery(req: Request, orderId: string) {
  const body = deliveryCorrectionSchema.parse(req.body);
  return mutateAdminOrder(req, orderId, "delivery.information.corrected", body, async (tx, order) => {
    const d = order.delivery, s = order.shipment, changes = body.changes;
    if (!d && !s) throw new AppError(404, "DELIVERY_NOT_FOUND", "Arrange delivery before correcting its information.");
    const checkoutActive = await tx.paymentAttempt.count({ where: { orderId, OR: [
      { status: { in: ["QUEUED", "PROCESSING", "UNKNOWN", "OPEN"] } },
      { status: "BLOCKED", checkoutId: { not: null } },
      { checkoutId: { not: null }, confirmedAt: null, checkErrorCode: { not: null } },
    ] } });
    const settlementStarted = await tx.moneyOperation.count({ where: { orderId, kind: { in: ["RELEASE", "REFUND", "REFUND_TRANSFER", "REFUND_PAYOUT"] }, status: { not: "FAILED" } } });
    const allowed = correctionCapabilities(order, !!checkoutActive, !!settlementStarted);
    const data: Prisma.DeliveryUpdateInput = {};
    if (changes.operationsNotes !== undefined) {
      if (!d) throw new AppError(422, "DELIVERY_NOT_FOUND", "This earlier shipment has no delivery notes record.");
      if ((changes.operationsNotes || null) !== d.operationsNotes) data.operationsNotes = changes.operationsNotes || null;
    }
    if (changes.destination) {
      if (!allowed.destination) throw new AppError(409, "DELIVERY_ADDRESS_LOCKED", "The paid or dispatched route cannot be changed locally. Confirm the correction with the courier and use the existing reconciliation or cancellation workflow.");
      if (fingerprint(changes.destination) !== fingerprint(d!.destination)) {
        data.destination = changes.destination;
        if (allowed.destinationRequiresNewQuote) {
          Object.assign(data, { status: "QUOTE_REQUIRED", selectedQuoteId: null, shippingMinor: 0n, courier: null, failureCode: null });
          data.package = { ...((d!.package as Prisma.JsonObject) || {}), quoteRequestId: body.mutationKey };
          await tx.deliveryQuote.updateMany({ where: { deliveryId: d!.id }, data: { expiresAt: new Date() } });
        }
      }
    }
    let riderChanged = false;
    if (changes.riderAssignment) {
      if (!allowed.riderAssignment) throw new AppError(409, "RIDER_REASSIGNMENT_UNSUPPORTED", "Riders for provider bookings must be reassigned by the courier. Local reassignment is available only for an active, confirmed manual shipment.");
      if (!body.arrangementConfirmed) throw new AppError(422, "ARRANGEMENT_CONFIRMATION_REQUIRED", "Confirm that the manual courier has agreed to the rider reassignment.");
      if (fingerprint(changes.riderAssignment) !== fingerprint(s!.riderAssignment)) {
        await assertNoActiveCheckout(tx, orderId);
        await assertNoDeliverySettlement(tx, orderId);
        await tx.shipment.update({ where: { id: s!.id }, data: { riderAssignment: changes.riderAssignment } });
        riderChanged = true;
      }
    }
    if (!Object.keys(data).length && !riderChanged) throw new AppError(422, "NO_CHANGES", "No delivery information has changed.");
    if (Object.keys(data).length) await tx.delivery.update({ where: { id: d!.id }, data });
  });
}
