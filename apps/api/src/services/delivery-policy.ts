export const terminalDeliveryStates = ["DELIVERED", "CANCELLED", "RETURNED"];
const rank: Record<string, number> = {
  BOOKED: 0,
  PICKED_UP: 1,
  IN_TRANSIT: 2,
  FAILED_ATTEMPT: 3,
  RETURNING: 4,
  DELIVERED: 5,
  CANCELLED: 5,
  RETURNED: 6,
};
export function normalizeDeliveryStatus(status: string): string | undefined {
  return (
    {
      pending: "BOOKED",
      confirmed: "BOOKED",
      picked_up: "PICKED_UP",
      in_transit: "IN_TRANSIT",
      completed: "DELIVERED",
      delivered: "DELIVERED",
      cancelled: "CANCELLED",
      failed: "FAILED_ATTEMPT",
      failed_delivery: "FAILED_ATTEMPT",
      failed_attempt: "FAILED_ATTEMPT",
      returning: "RETURNING",
      returned: "RETURNED",
    } as Record<string, string>
  )[status.toLowerCase()];
}
export function canAdvanceDelivery(current: string, next: string) {
  if (current === "DELIVERED" && ["RETURNING", "RETURNED"].includes(next)) return true;
  if (current === next || terminalDeliveryStates.includes(current)) return false;
  if (current === "FAILED_ATTEMPT" && next === "IN_TRANSIT") return true;
  return (rank[next] ?? -1) >= (rank[current] ?? -1);
}

type ParcelDelivery = {
  status: string;
  providerShipmentId: string | null;
  selectedQuoteId: string | null;
  package: unknown;
  parcels: { parcelIndex: number; quoteId: string; status: string; providerShipmentId: string | null }[];
};
function completeParcelPlan(delivery: ParcelDelivery) {
  const count = (delivery.package as { packageCount?: number } | null)?.packageCount;
  return Number.isInteger(count) && count! > 1 && delivery.parcels.length === count &&
    !!delivery.selectedQuoteId && new Set(delivery.parcels.map((parcel) => parcel.parcelIndex)).size === count &&
    delivery.parcels.every((parcel) => !!parcel.providerShipmentId && parcel.quoteId === delivery.selectedQuoteId &&
      parcel.parcelIndex >= 0 && parcel.parcelIndex < count!);
}
function requiresParcelPlan(delivery: ParcelDelivery) {
  return delivery.providerShipmentId?.startsWith("split:") ||
    (!!delivery.providerShipmentId && ((delivery.package as { packageCount?: number } | null)?.packageCount || 1) > 1);
}

/** A parent status alone cannot prove receipt of a split shipment. */
export function deliveryReceiptReady(delivery: ParcelDelivery | null) {
  if (!delivery || !["DELIVERED", "PICKUP_READY"].includes(delivery.status)) return false;
  if (!delivery.parcels.length) return !requiresParcelPlan(delivery);
  return delivery.status === "DELIVERED" && completeParcelPlan(delivery) &&
    delivery.parcels.every((parcel) => parcel.status === "DELIVERED");
}

/** A blocked worker is not proof that no label was bought. Require a confirmed terminal result. */
export function deliveryRefundReady(delivery: (ParcelDelivery & { bookingStartedAt: Date | null }) | null) {
  if (!delivery) return true;
  if (["CANCELLED", "RETURNED"].includes(delivery.status)) {
    if (!delivery.parcels.length) return !requiresParcelPlan(delivery);
    return completeParcelPlan(delivery) && delivery.parcels.every((parcel) => ["CANCELLED", "RETURNED"].includes(parcel.status));
  }
  return ["MANUAL_REVIEW", "QUOTE_REQUIRED", "PAYMENT_PENDING", "PAID", "BOOKING_BLOCKED", "PICKUP_READY"].includes(delivery.status) &&
    !delivery.bookingStartedAt && !delivery.providerShipmentId && !delivery.parcels.length;
}
