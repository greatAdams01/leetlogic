import { z } from "zod";
import { prisma, Prisma } from "@leetlogic/database";
import {
  deliveryActiveStates, deliveryCalendarDate, deliveryNoProgressMs, deliveryPendingStates,
  deliveryProblemStates, deliveryStaleMs, deliveryVisibility,
} from "@leetlogic/contracts";
import { AppError } from "../lib/errors.js";
import { mode } from "./payments.js";
import { fulfillmentProjection } from "./order-fulfillment-view.js";
import { paymentProgressView } from "./order-payment-view.js";

const queueQuery = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  search: z.string().trim().max(100).default(""),
  status: z.string().max(40).default("ALL"),
  farmer: z.enum(["ALL", "PENDING", "ACCEPTED", "REJECTED", "LEGACY"]).default("ALL"),
  view: z.enum(["ALL", "ATTENTION", "PENDING", "ACTIVE", "DELIVERED", "FAILED", "DELAYED", "STALE"]).default("ALL"),
});
type View = z.infer<typeof queueQuery>["view"];
const orderStatuses = ["AWAITING_PAYMENT", "FUNDED", "DELIVERED", "COMPLETED", "REFUNDED", "CANCELLED"];
const dispatchStatuses = [...deliveryPendingStates, ...deliveryActiveStates, "DELIVERED", "CANCELLED", "RETURNED"];
const deliveryState = Prisma.sql`COALESCE(d.status, CASE WHEN s.status = 'ASSIGNED' THEN 'MANUAL_ASSIGNED' ELSE s.status END, 'UNARRANGED')`;
const packageCount = Prisma.sql`CASE WHEN jsonb_typeof(d.package->'packageCount') = 'number'
  AND (d.package->>'packageCount')::numeric > 0 AND (d.package->>'packageCount')::numeric = TRUNC((d.package->>'packageCount')::numeric)
  THEN (d.package->>'packageCount')::numeric ELSE 1 END`;
const joins = Prisma.sql`FROM trade_orders o
  LEFT JOIN deliveries d ON d."orderId" = o.id
  LEFT JOIN shipments s ON s."orderId" = o.id
  JOIN listings l ON l.id = o."listingId"
  JOIN users b ON b.id = o."buyerId"
  LEFT JOIN user_profiles bp ON bp.user_id = b.id
  JOIN farmer_profiles f ON f.id = o."farmerProfileId"
  JOIN users fu ON fu.id = f.user_id
  LEFT JOIN user_profiles fp ON fp.user_id = fu.id`;
const ongoing = Prisma.sql`o.status NOT IN ('CANCELLED', 'REFUNDED', 'COMPLETED')`;
const progressAt = Prisma.sql`COALESCE((SELECT MAX(e."createdAt") FROM delivery_events e
  WHERE e."deliveryId" = d.id AND e.status IN ('BOOKED', 'MANUAL_ASSIGNED', 'FARMER_DISPATCHED', 'PICKED_UP', 'IN_TRANSIT', 'FAILED_ATTEMPT')),
  d."bookingStartedAt", d."createdAt", s."updatedAt")`;

function queueViews(now: Date, currentMode: string): Record<View, Prisma.Sql> {
  const today = deliveryCalendarDate(now), staleBefore = new Date(now.getTime() - deliveryStaleMs), progressBefore = new Date(now.getTime() - deliveryNoProgressMs);
  const failed = Prisma.sql`(${deliveryState} IN (${Prisma.join(["FAILED_ATTEMPT", "RETURNING", "RETURNED", "CANCELLED"])}) OR EXISTS (
    SELECT 1 FROM delivery_parcels p WHERE p."deliveryId" = d.id AND p.status IN ('FAILED_ATTEMPT', 'RETURNING', 'RETURNED', 'CANCELLED')))`;
  const stale = Prisma.sql`(${ongoing} AND d."providerShipmentId" IS NOT NULL AND d.status IN (${Prisma.join(deliveryActiveStates)})
    AND (d."failureCode" = 'TRACKING_UNAVAILABLE' OR COALESCE(d."lastSyncedAt", d."bookingStartedAt", d."createdAt") <= ${staleBefore}))`;
  const delayed = Prisma.sql`(${ongoing} AND ${deliveryState} IN ('BOOKED', 'MANUAL_ASSIGNED', 'PICKED_UP', 'IN_TRANSIT') AND (
    (${deliveryState} IN ('BOOKED', 'MANUAL_ASSIGNED') AND d.package->>'pickupDate' ~ '^\\d{4}-\\d{2}-\\d{2}$' AND d.package->>'pickupDate' < ${today})
    OR (${progressAt} <= ${progressBefore} AND (d.package->>'pickupDate' IS NULL OR d.package->>'pickupDate' <= ${today} OR ${deliveryState} IN ('PICKED_UP', 'IN_TRANSIT')))))`;
  const incomplete = Prisma.sql`(d.status = 'DELIVERED' AND (d."providerShipmentId" LIKE 'split:%' OR (d."providerShipmentId" IS NOT NULL AND ${packageCount} > 1) OR EXISTS (SELECT 1 FROM delivery_parcels p WHERE p."deliveryId" = d.id)) AND (
    d."selectedQuoteId" IS NULL OR ${packageCount} <= 1 OR (SELECT COUNT(*) FROM delivery_parcels p WHERE p."deliveryId" = d.id) <> ${packageCount}
    OR EXISTS (SELECT 1 FROM delivery_parcels p WHERE p."deliveryId" = d.id AND (p.status <> 'DELIVERED' OR p."providerShipmentId" IS NULL OR p."quoteId" IS DISTINCT FROM d."selectedQuoteId" OR p."parcelIndex" < 0 OR p."parcelIndex" >= ${packageCount}))))`;
  const attention = Prisma.sql`(o.financial_hold OR ${deliveryState} IN (${Prisma.join(deliveryProblemStates)})
    OR d."failureCode" IS NOT NULL OR ${stale} OR ${delayed}
    OR (o.farmer_decision = 'REJECTED' AND o.status IN ('FUNDED', 'DELIVERED'))
    OR (d.status = 'BOOKING' AND d."leaseUntil" <= ${now})
    OR EXISTS (SELECT 1 FROM support_tickets t WHERE t."orderId" = o.id AND t.kind = 'DISPUTE' AND t.status <> 'RESOLVED')
    OR EXISTS (SELECT 1 FROM delivery_parcels p WHERE p."deliveryId" = d.id AND (p."failureCode" IS NOT NULL OR p.status IN ('FAILED_ATTEMPT', 'RETURNING', 'RETURNED', 'CANCELLED', 'BOOKING_UNCERTAIN')))
    OR ${incomplete}
    OR EXISTS (SELECT 1 FROM money_operations m WHERE m."orderId" = o.id AND m.mode = ${currentMode}
      AND m.kind IN ('RELEASE', 'REFUND', 'REFUND_TRANSFER', 'REFUND_PAYOUT') AND m.status IN ('FAILED', 'BLOCKED', 'UNKNOWN'))
    OR EXISTS (SELECT 1 FROM payment_attempts p WHERE p."orderId" = o.id AND p.mode = ${currentMode} AND p.status IN ('EXCEPTION', 'BLOCKED'))
    OR EXISTS (SELECT 1 FROM fulfillment_deadlines fd WHERE fd."orderId" = o.id AND fd.mode = ${currentMode} AND fd.state <> 'SECURED' AND fd.state <> 'REFUNDED'
      AND (fd.state <> 'ACTIVE' OR fd."refundDueAt" <= ${now})))`;
  return {
    ALL: Prisma.sql`TRUE`, ATTENTION: attention, STALE: stale, DELAYED: delayed, FAILED: failed,
    PENDING: Prisma.sql`(${ongoing} AND ${deliveryState} IN (${Prisma.join(deliveryPendingStates)}))`,
    ACTIVE: Prisma.sql`(${ongoing} AND ${deliveryState} IN (${Prisma.join(deliveryActiveStates)}))`,
    DELIVERED: Prisma.sql`(${deliveryState} = 'DELIVERED' AND NOT COALESCE(${incomplete}, FALSE))`,
  };
}

/** Database-filtered queues include unbooked deliveries, every split package and legacy manual shipments. */
export async function readAdminOrderQueue(query: unknown, dispatch = false, now = new Date()) {
  const input = queueQuery.parse(query), currentMode = mode(), views = queueViews(now, currentMode);
  if (input.status !== "ALL" && !(dispatch ? dispatchStatuses : orderStatuses).includes(input.status))
    throw new AppError(422, "INVALID_STATUS", "Status filter is invalid");
  const filters: Prisma.Sql[] = [Prisma.sql`TRUE`];
  if (dispatch) filters.push(Prisma.sql`((d.id IS NOT NULL AND d.status NOT LIKE 'PICKUP_%'
    AND NOT (d.status = 'DELIVERED' AND d."selectedQuoteId" IS NULL AND d."providerShipmentId" IS NULL AND d.courier IS NULL)) OR (d.id IS NULL AND s.id IS NOT NULL))`);
  if (input.status !== "ALL") filters.push(dispatch ? Prisma.sql`${deliveryState} = ${input.status}` : Prisma.sql`o.status = ${input.status}`);
  if (input.farmer !== "ALL") filters.push(Prisma.sql`o.farmer_decision = ${input.farmer}`);
  if (input.search) {
    const needle = `%${input.search.replace(/[\\%_]/g, "\\$&")}%`;
    filters.push(Prisma.sql`(o.reference ILIKE ${needle} OR l.title ILIKE ${needle} OR b.phone_e164 ILIKE ${needle} OR bp.full_name ILIKE ${needle}
      OR f.farm_name ILIKE ${needle} OR fp.full_name ILIKE ${needle} OR fu.phone_e164 ILIKE ${needle}
      OR d.courier ILIKE ${needle} OR d."providerShipmentId" ILIKE ${needle} OR s.carrier ILIKE ${needle} OR s."trackingRef" ILIKE ${needle}
      OR EXISTS (SELECT 1 FROM delivery_parcels p WHERE p."deliveryId" = d.id AND p."providerShipmentId" ILIKE ${needle}))`);
  }
  const base = Prisma.join(filters, " AND "), where = Prisma.sql`${base} AND ${views[input.view]}`;
  const [ids, counts] = await Promise.all([
    prisma.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT o.id ${joins} WHERE ${where} ORDER BY o."createdAt" DESC, o.id DESC LIMIT 25 OFFSET ${(input.page - 1) * 25}`),
    prisma.$queryRaw<{ total: bigint; pending: bigint; active: bigint; attention: bigint; delivered: bigint }[]>(Prisma.sql`SELECT
      COUNT(*) FILTER (WHERE ${views[input.view]}) AS total,
      COUNT(*) FILTER (WHERE ${views.PENDING}) AS pending, COUNT(*) FILTER (WHERE ${views.ACTIVE}) AS active,
      COUNT(*) FILTER (WHERE ${views.ATTENTION}) AS attention, COUNT(*) FILTER (WHERE ${views.DELIVERED}) AS delivered
      ${joins} WHERE ${base}`),
  ]);
  const orderIds = ids.map(row => row.id);
  const [orders, payments, operations, deadlines] = await Promise.all([
    prisma.tradeOrder.findMany({ where: { id: { in: orderIds } }, include: {
      buyer: { select: { id: true, phoneE164: true, profile: { select: { fullName: true, displayName: true } } } },
      farmerProfile: { select: { id: true, farmName: true, user: { select: { id: true, phoneE164: true, profile: { select: { fullName: true, displayName: true } } } } } },
      listing: { select: { id: true, title: true, unitCode: true } }, shipment: true,
      delivery: { include: { events: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] }, parcels: { orderBy: { parcelIndex: "asc" } } } },
      tickets: { where: { kind: "DISPUTE", status: { not: "RESOLVED" } }, select: { id: true, status: true, subject: true } },
      ledger: { where: { kind: "FUND" }, select: { id: true } },
    } }),
    prisma.paymentAttempt.findMany({ where: { orderId: { in: orderIds }, mode: currentMode }, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { orderId: true, kind: true, status: true, confirmedAt: true, produceMinor: true, exceptionCode: true } }),
    prisma.moneyOperation.findMany({ where: { orderId: { in: orderIds }, kind: { in: ["RELEASE", "REFUND", "REFUND_TRANSFER", "REFUND_PAYOUT"] } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { orderId: true, mode: true, kind: true, status: true, failureCode: true, updatedAt: true } }),
    prisma.fulfillmentDeadline.findMany({ where: { orderId: { in: orderIds }, mode: currentMode } }),
  ]);
  const items = orderIds.flatMap(orderId => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return [];
    const d = order.delivery, shipment = order.shipment, ops = operations.filter(o => o.orderId === order.id);
    const release = ops.find(o => o.mode === currentMode && o.kind === "RELEASE") || null;
    const paymentRows = payments.filter(p => p.orderId === order.id);
    const verified = paymentRows.some(p => p.kind === "ORDER" && ["SUCCEEDED", "REFUNDED"].includes(p.status) && !!p.confirmedAt && p.produceMinor === order.totalMinor);
    const deadline = deadlines.find(d => d.orderId === order.id) || null;
    const progress = fulfillmentProjection(order, false, false, {
      parcels: d?.parcels || [], events: d?.events || [], manual: !d || d.status === "MANUAL_ASSIGNED" ? shipment : null,
      disputed: !!order.tickets.length, settlement: ops.some(o => o.status !== "FAILED"),
    });
    const collection = progress.method === "Pickup";
    const tracking = d && !collection ? deliveryVisibility({ ...d, trackingRef: shipment?.trackingRef, orderStatus: order.status, receiptConfirmedAt: order.deliveryConfirmedAt }, now)
      : !d && shipment ? deliveryVisibility({ status: shipment.status === "ASSIGNED" ? "MANUAL_ASSIGNED" : shipment.status,
        courier: shipment.carrier, trackingRef: shipment.trackingRef, createdAt: shipment.createdAt, bookingStartedAt: shipment.updatedAt,
        orderStatus: order.status, receiptConfirmedAt: order.deliveryConfirmedAt, receiptSource: "legacy-staff" }, now) : null;
    const payment = paymentProgressView(order, { verified, release, disputed: !!order.tickets.length });
    const issues = [...(tracking?.warnings || [])];
    if (order.financialHold) issues.push({ code: "FINANCIAL_HOLD", title: "Financial review", body: "Fulfillment and settlement are paused for review." });
    if (order.tickets.length) issues.push({ code: "DISPUTE_OPEN", title: "Open dispute", body: "Investigate the dispute before receipt or settlement." });
    if (order.farmerDecision === "REJECTED" && ["FUNDED", "DELIVERED"].includes(order.status)) issues.push({ code: "FARMER_REJECTED", title: "Farmer declined — refund review", body: "Follow the existing refund workflow before dispatch or settlement." });
    if (ops.some(o => o.mode === currentMode && ["FAILED", "BLOCKED", "UNKNOWN"].includes(o.status))) issues.push({ code: "SETTLEMENT_REVIEW", title: "Settlement needs attention", body: "Use payment reconciliation. Do not create a replacement transfer or refund." });
    if (paymentRows.some(p => ["EXCEPTION", "BLOCKED"].includes(p.status))) issues.push({ code: "PAYMENT_REVIEW", title: "Payment needs reconciliation", body: "Check the recorded payment before requesting another charge." });
    if (deadline && !["SECURED", "REFUNDED"].includes(deadline.state) && (deadline.state !== "ACTIVE" || deadline.refundDueAt <= now)) issues.push({ code: "FULFILLMENT_DEADLINE", title: "Fulfillment deadline needs attention", body: "Follow the existing recovery or refund workflow; the deadline has not been extended." });
    if (d?.status === "BOOKING" && d.leaseUntil && d.leaseUntil <= now) issues.push({ code: "BOOKING_CLAIM_EXPIRED", title: "Booking worker claim expired", body: "Check whether a label purchase was attempted before considering any retry." });
    const manualPayment = order.fundsProvider !== "bachs" && !!order.ledger.length;
    return [{
      id: order.id, reference: order.reference, status: order.status, createdAt: order.createdAt,
      listing: order.listing, quantity: order.quantity, totalMinor: order.totalMinor,
      buyer: { id: order.buyer.id, name: order.buyer.profile?.fullName || order.buyer.profile?.displayName || order.buyer.phoneE164, phone: order.buyer.phoneE164 },
      farmer: { id: order.farmerProfile.id, name: order.farmerProfile.user.profile?.fullName || order.farmerProfile.farmName, farmName: order.farmerProfile.farmName, phone: order.farmerProfile.user.phoneE164,
        decision: order.farmerDecision, decidedAt: order.farmerDecidedAt, rejectionReason: order.rejectionReason },
      fulfillment: { status: progress.status, method: progress.method, next: progress.next, receiptConfirmedAt: order.deliveryConfirmedAt,
        receiptSource: !d && shipment ? "legacy-staff" : "buyer", readyAt: d?.events.find(e => e.status === "READY_FOR_PICKUP")?.createdAt || null,
        dispatchedAt: d?.events.find(e => e.status === "FARMER_DISPATCHED")?.createdAt || null, handedOverAt: order.handedOverAt },
      payment: { ...payment, title: manualPayment ? order.refundedMinor > 0n ? "Manual escrow refunded" : order.releasedMinor > 0n ? "Manual settlement recorded" : "Manual escrow funded" : payment.title,
        source: manualPayment ? "Manual escrow" : order.fundsProvider === "bachs" ? "Bachs" : "No verified funding",
        heldMinor: order.heldMinor, releasedMinor: order.releasedMinor, refundedMinor: order.refundedMinor, release },
      delivery: tracking ? { ...tracking, timeline: undefined, milestones: undefined, id: d?.id || shipment?.id, failureCode: d?.failureCode || null,
        providerShipmentId: d?.providerShipmentId || null, legacyTrackingRef: !d ? shipment?.trackingRef : null,
        pickupState: (d?.pickup as { state?: string } | null)?.state || null, destinationState: (d?.destination as { state?: string } | null)?.state || null } : null,
      issues, disputes: order.tickets, deadline: deadline ? { state: deadline.state, refundDueAt: deadline.refundDueAt, failureCode: deadline.failureCode } : null,
    }];
  });
  const count = counts[0]!;
  return { items, total: Number(count.total), page: input.page, pageSize: 25, observedAt: now.toISOString(),
    counts: { pending: Number(count.pending), active: Number(count.active), attention: Number(count.attention), delivered: Number(count.delivered) } };
}
