import { orderFulfillment } from "@leetlogic/contracts";
import { prisma, type Delivery, type DeliveryParcel, type Prisma, type Shipment } from "@leetlogic/database";
import { deliveryReceiptReady } from "./delivery-policy.js";
import { hasDeliverySettlement } from "./delivery.js";

type FulfillmentOrder = {
  id: string;
  status: string;
  farmerDecision: string;
  financialHold: boolean;
  adminResolution?: unknown;
  handedOverAt: Date | null;
  deliveryConfirmedAt: Date | null;
  delivery: Delivery | null;
};
export type FulfillmentFacts = {
  parcels: DeliveryParcel[];
  events: { status: string }[];
  manual: Pick<Shipment, "carrier" | "trackingRef" | "status"> | null;
  disputed: boolean;
  settlement: boolean;
};

/** The same authorization projection is used by buyer, farmer and staff read models. */
export function fulfillmentProjection(order: FulfillmentOrder, buyer: boolean, farmer: boolean, facts: FulfillmentFacts) {
  const d = order.delivery, { parcels, events, manual } = facts;
  const legacyShipment = !d && !!manual;
  const count = (d?.package as { packageCount?: number } | null)?.packageCount || 1;
  const booked = !!(manual && manual.carrier === d?.courier && manual.trackingRef && manual.status === "ASSIGNED") ||
    !!d?.providerShipmentId &&
    (count === 1 || (parcels.length === count && new Set(parcels.map(p => p.parcelIndex)).size === count && parcels.every(p => !!p.providerShipmentId && p.quoteId === d.selectedQuoteId && p.parcelIndex >= 0 && p.parcelIndex < count)));
  const disputed = order.financialHold || facts.disputed;
  const blocked = disputed || facts.settlement || ["CANCELLED", "RETURNING", "RETURNED", "BOOKING_UNCERTAIN"].includes(d?.status || "");
  return orderFulfillment({
    farmerDecision: order.farmerDecision,
    handedOver: !!order.handedOverAt,
    review: disputed,
    orderStatus: order.status,
    adminResolved: !!order.adminResolution,
    paid: ["FUNDED", "DELIVERED", "COMPLETED"].includes(order.status),
    confirmed: !!order.deliveryConfirmedAt,
    blocked,
    buyer, farmer,
    status: d?.status || (manual?.status === "ASSIGNED" ? "MANUAL_ASSIGNED" : manual?.status) || "",
    bookingFailureCode: d?.failureCode,
    ready: events.some(e => e.status === "READY_FOR_PICKUP"),
    dispatched: events.some(e => e.status === "FARMER_DISPATCHED"),
    booked,
    receiptReady: deliveryReceiptReady(d ? { ...d, parcels } : null),
    collection: !!d?.status.startsWith("PICKUP_") ||
      (d?.status === "DELIVERED" && !d.selectedQuoteId && !d.providerShipmentId && !d.courier),
    legacyShipment,
  });
}

export async function fulfillmentView(order: FulfillmentOrder, buyer: boolean, farmer: boolean, tx: Prisma.TransactionClient = prisma) {
  const d = order.delivery;
  const [parcels, events, manual, disputed, settlement] = await Promise.all([
    d ? tx.deliveryParcel.findMany({ where: { deliveryId: d.id } }) : [],
    d ? tx.deliveryEvent.findMany({ where: { deliveryId: d.id }, select: { status: true } }) : [],
    !d || d.status === "MANUAL_ASSIGNED" ? tx.shipment.findUnique({ where: { orderId: order.id } }) : null,
    tx.supportTicket.count({ where: { orderId: order.id, kind: "DISPUTE", status: { not: "RESOLVED" } } }),
    hasDeliverySettlement(order.id, tx),
  ]);
  return fulfillmentProjection(order, buyer, farmer, { parcels, events, manual, disputed: !!disputed, settlement });
}
