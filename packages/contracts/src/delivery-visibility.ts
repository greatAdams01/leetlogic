/** Presentation only. Courier updates never authorize buyer receipt or payment release. */
export const deliveryStatusCopy = (status: string, dispatched = false) => {
  const copy: Record<string, { label: string; title: string; body: string }> = {
    PENDING: { label: "Awaiting courier booking", title: "Awaiting courier booking", body: "No courier booking is confirmed for this package yet." },
    QUOTE_REQUIRED: { label: "Delivery details needed", title: "Choose how to receive your produce", body: "Confirm your delivery details before requesting a courier." },
    PAYMENT_PENDING: { label: "Awaiting delivery payment", title: "Delivery payment pending", body: "A courier booking is not confirmed yet." },
    PAID: { label: "Awaiting courier booking", title: "Awaiting courier booking", body: "Payment is confirmed. The farmer must accept and prepare the goods before courier booking." },
    TOPUP_REQUIRED: { label: "Delivery top-up required", title: "Delivery top-up required", body: "Review the additional delivery amount. You will not be charged automatically." },
    BOOKING_QUEUED: { label: "Booking your courier", title: "Booking your courier", body: "We are arranging collection. No courier booking is confirmed yet." },
    BOOKING: { label: "Booking your courier", title: "Booking your courier", body: "We are arranging collection. No courier booking is confirmed yet." },
    BOOKING_BLOCKED: { label: "Courier booking needs attention", title: "Courier booking needs attention", body: "Payment remains confirmed. Booking needs attention before dispatch can continue." },
    BOOKING_UNCERTAIN: { label: "Booking needs reconciliation", title: "Checking the courier booking", body: "The booking result is not yet confirmed. Staff must check the existing booking; do not pay or book again." },
    MANUAL_REVIEW: { label: "Manual delivery needs review", title: "Delivery is being reviewed", body: "Staff are checking a suitable delivery arrangement." },
    MANUAL_ASSIGNED: dispatched
      ? { label: "Dispatched", title: "Farmer handed your goods to the courier", body: "The farmer has recorded handover. Waiting for the courier’s pickup or transit update." }
      : { label: "Courier assigned", title: "Courier assigned for collection", body: "Collection is arranged. Waiting for a recorded pickup update." },
    ASSIGNED: { label: "Courier assigned", title: "Courier assigned for collection", body: "Collection is arranged. Waiting for a recorded pickup update." },
    BOOKED: dispatched
      ? { label: "Dispatched", title: "Farmer handed your goods to the courier", body: "The farmer has recorded handover. Waiting for the courier’s pickup or transit update." }
      : { label: "Courier booked", title: "Courier booked for collection", body: "Your delivery is booked. Waiting for the courier to collect your produce." },
    PICKED_UP: { label: "Picked Up", title: "Your goods have been picked up", body: "The courier has reported pickup. Next: transit updates, then delivery and your receipt confirmation." },
    IN_TRANSIT: { label: "In Transit", title: "Your goods are on the way", body: "The courier has reported that your produce is in transit. Confirm receipt only after every package arrives." },
    DELIVERED: { label: "Delivered", title: "Your goods have been delivered", body: "Delivery is reported. Inspect every package, then confirm receipt or report a problem." },
    FAILED_ATTEMPT: { label: "Delivery attempt failed", title: "Delivery needs attention", body: "A delivery attempt failed. Contact support; do not confirm receipt before every package arrives." },
    RETURNING: { label: "Returning to farmer", title: "Your delivery is returning", body: "The courier has reported a return. Contact support for the next steps; do not confirm receipt." },
    RETURNED: { label: "Returned to farmer", title: "Your delivery was returned", body: "The courier has reported that the goods were returned. Follow the order’s support and payment updates." },
    CANCELLED: { label: "Delivery cancelled", title: "Your delivery was cancelled", body: "This delivery is cancelled. Follow the order’s support and payment updates." },
  };
  return copy[status] || { label: "Waiting for a delivery update", title: "Waiting for a delivery update", body: "No confirmed courier progress is available yet." };
};

export const farmerDeliveryStatusCopy = (status: string, dispatched = false) => {
  const copy = deliveryStatusCopy(status, dispatched);
  return { ...copy, title: copy.label, body: status === "DELIVERED"
    ? "Delivery is reported. Waiting for the buyer to inspect every package and confirm receipt."
    : status === "IN_TRANSIT"
      ? "The courier has reported that the goods are in transit. Buyer receipt confirmation is still required."
      : status === "PICKED_UP"
        ? "The courier has reported pickup. Follow delivery updates until the buyer receives every package."
         : dispatched && ["BOOKED", "MANUAL_ASSIGNED"].includes(status)
           ? "Farmer handover is recorded. Waiting for the courier’s pickup or transit update." : copy.body };
};

type Stamp = string | Date | null | undefined;
export type DeliveryVisibilityEvent = {
  id: string;
  status: string;
  source: string;
  createdAt: string | Date;
  details?: unknown;
};
export type DeliveryVisibilityParcel = {
  id: string;
  parcelIndex: number;
  status: string;
  quoteId?: string | null;
  providerShipmentId?: string | null;
  trackingUrl?: string | null;
  failureCode?: string | null;
};
export type DeliveryVisibilityInput = {
  status: string;
  courier?: string | null;
  providerShipmentId?: string | null;
  selectedQuoteId?: string | null;
  trackingUrl?: string | null;
  lastSyncedAt?: Stamp;
  trackingRef?: string | null;
  bookingStartedAt?: Stamp;
  createdAt?: Stamp;
  failureCode?: string | null;
  package?: unknown;
  events?: DeliveryVisibilityEvent[];
  parcels?: DeliveryVisibilityParcel[];
  receiptConfirmedAt?: Stamp;
  receiptSource?: "buyer" | "legacy-staff";
  orderStatus?: string;
};
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown, max = 160) => typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
const stamp = (value: Stamp) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};
/** A provider's timezone-less timestamp must not be silently interpreted in the server/device timezone. */
export const providerTimestamp = (value: unknown) => {
  const raw = text(value, 80);
  if (!raw) return { raw: null, at: null };
  const zoned = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw);
  return { raw, at: zoned ? stamp(raw.replace(" ", "T")) : null };
};
export const safeTrackingUrl = (value: unknown) => {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch { return null; }
};
const progressStates = ["BOOKED", "MANUAL_ASSIGNED", "FARMER_DISPATCHED", "PICKED_UP", "IN_TRANSIT", "FAILED_ATTEMPT"];
export const deliveryActiveStates = ["BOOKED", "MANUAL_ASSIGNED", "PICKED_UP", "IN_TRANSIT", "FAILED_ATTEMPT", "RETURNING"];
export const deliveryPendingStates = ["QUOTE_REQUIRED", "PAYMENT_PENDING", "PAID", "TOPUP_REQUIRED", "BOOKING_QUEUED", "BOOKING", "BOOKING_BLOCKED", "BOOKING_UNCERTAIN", "MANUAL_REVIEW"];
export const deliveryProblemStates = ["BOOKING_BLOCKED", "BOOKING_UNCERTAIN", "MANUAL_REVIEW", "FAILED_ATTEMPT", "RETURNING", "RETURNED", "CANCELLED"];
export const deliveryStaleMs = 60 * 60000;
export const deliveryNoProgressMs = 24 * 60 * 60000;
export const deliveryCalendarDate = (now: Date) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit",
}).format(now);
export const deliveryEventLabel = (status: string) => ({
  READY_FOR_PICKUP: "Produce ready for pickup",
  FARMER_DISPATCHED: "Farmer confirmed dispatch",
  FARMER_ACCEPTED: "Farmer accepted the order",
  FARMER_REJECTED: "Farmer declined the order",
  ORDER_ACCEPTED: "Farmer accepted the order",
  ORDER_REJECTED: "Farmer declined the order",
  FARMER_HANDED_OVER: "Farmer handed goods to buyer",
  BUYER_COLLECTED: "Farmer handed goods to buyer",
  BUYER_RECEIPT_CONFIRMED: "Buyer confirmed receipt",
  COURIER_ASSIGNED: "Courier assigned",
  PROVIDER_CONTACT_UPDATED: "Courier contact details updated",
  QUOTE_REFRESHED: "Delivery quote refreshed",
  PAID: "Delivery payment confirmed",
  CANCEL_REQUESTED: "Delivery cancellation requested",
  PAYMENT_RELEASED: "Farmer payment released",
} as Record<string, string>)[status] || deliveryStatusCopy(status).label;

export const deliveryEventSource = (source: string) => ({
  shipbubble: "Shipbubble", admin: "Staff", farmer: "Farmer", buyer: "Buyer", customer: "Customer",
} as Record<string, string>)[source] || "LeetLogic";

export function deliveryVisibility(input: DeliveryVisibilityInput, now = new Date()) {
  const events = [...(input.events || [])].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const parcels = [...(input.parcels || [])].sort((a, b) => a.parcelIndex - b.parcelIndex);
  const dispatched = events.some(e => e.status === "FARMER_DISPATCHED");
  const pack = object(input.package);
  const packageCount = typeof pack.packageCount === "number" && Number.isInteger(pack.packageCount) && pack.packageCount > 0 ? pack.packageCount : 1;
  const split = parcels.length > 0 || !!input.providerShipmentId?.startsWith("split:") || (!!input.providerShipmentId && Number(pack.packageCount || 1) > 1);
  const matchingPlan = packageCount > 1 && !!input.selectedQuoteId && parcels.length === packageCount && new Set(parcels.map(p => p.parcelIndex)).size === packageCount &&
    parcels.every(p => !!p.providerShipmentId && p.parcelIndex >= 0 && p.parcelIndex < packageCount && p.quoteId === input.selectedQuoteId);
  const incomplete = split && (!matchingPlan || parcels.some(p => p.status !== "DELIVERED"));
  const receiptConfirmedAt = stamp(input.receiptConfirmedAt);
  const copy = input.status === "DELIVERED" && incomplete
    ? { label: "Delivery completion needs review", title: "Delivery completion needs review", body: "Not every planned package has a matching delivery confirmation. Contact support before confirming receipt." }
    : input.status === "DELIVERED" && receiptConfirmedAt
      ? { ...deliveryStatusCopy(input.status, dispatched), body: "Receipt confirmation is recorded. Follow the payment updates for settlement." }
      : deliveryStatusCopy(input.status, dispatched);
  const lastSyncedAt = stamp(input.lastSyncedAt);
  const latestProgress = events.filter(e => progressStates.includes(e.status)).at(-1);
  const lastProgressAt = stamp(latestProgress?.createdAt || input.bookingStartedAt || input.createdAt);
  const active = deliveryActiveStates.includes(input.status) && !["CANCELLED", "REFUNDED", "COMPLETED"].includes(input.orderStatus || "");
  const stale = active && !!input.providerShipmentId && now.getTime() - new Date(lastSyncedAt || stamp(input.bookingStartedAt || input.createdAt) || now).getTime() >= deliveryStaleMs;
  const rawPickupDate = text(pack.pickupDate, 80);
  const pickupDate = rawPickupDate && /^\d{4}-\d{2}-\d{2}$/.test(rawPickupDate) ? rawPickupDate : null;
  const today = deliveryCalendarDate(now);
  const pickupOverdue = active && ["BOOKED", "MANUAL_ASSIGNED"].includes(input.status) && !!pickupDate && /^\d{4}-\d{2}-\d{2}$/.test(pickupDate) && pickupDate < today;
  const stalled = active && !["FAILED_ATTEMPT", "RETURNING"].includes(input.status) &&
    (!pickupDate || pickupDate <= today || ["PICKED_UP", "IN_TRANSIT"].includes(input.status)) &&
    !!lastProgressAt && now.getTime() - new Date(lastProgressAt).getTime() >= deliveryNoProgressMs;
  const warnings: { code: string; title: string; body: string }[] = [];
  if (active && (input.failureCode === "TRACKING_UNAVAILABLE" || stale)) warnings.push({ code: "TRACKING_STALE", title: "Tracking update delayed", body: "The status shown is the last recorded update, not a live rider location. A delayed tracking update does not prove the delivery is late." });
  if (pickupOverdue || stalled) warnings.push({ code: "POSSIBLE_DELAY", title: "Possible delivery delay", body: pickupOverdue
    ? "The scheduled pickup date has passed without a courier pickup confirmation. Contact support for an update."
    : "No delivery progress has been recorded for 24 hours. Contact support to check the shipment." });
  if (deliveryProblemStates.includes(input.status)) warnings.push({ code: input.status, title: copy.label, body: copy.body });
  if (parcels.some(p => ["FAILED_ATTEMPT", "RETURNING", "RETURNED", "CANCELLED", "BOOKING_UNCERTAIN"].includes(p.status) || !!p.failureCode) || (input.status === "DELIVERED" && incomplete))
    warnings.push({ code: "PARCEL_REVIEW", title: "A package needs attention", body: "Check each package’s progress. A partial delivery is not confirmation of the whole order." });
  if (input.failureCode && !["TRACKING_UNAVAILABLE", "BOOKING_RESULT_UNKNOWN"].includes(input.failureCode) && !warnings.some(w => w.code === input.status))
    warnings.push({ code: "DELIVERY_REVIEW", title: "Delivery needs review", body: "Staff need to check this delivery. Follow the support and payment updates before taking another action." });
  const shipments = split ? parcels.map(p => ({ id: p.providerShipmentId || null, parcelIndex: p.parcelIndex, trackingUrl: p.trackingUrl, status: p.status }))
    : [{ id: input.providerShipmentId || null, parcelIndex: undefined, trackingUrl: input.trackingUrl, status: input.status }];
  const trackingRef = !input.providerShipmentId ? text(input.trackingRef) : null;
  const manual = !input.providerShipmentId && (!!trackingRef || input.status === "MANUAL_ASSIGNED" || (!input.selectedQuoteId && !!input.courier));
  const assignments = shipments.map(shipment => {
    const snapshot = [...events].reverse().find(e => e.status === "PROVIDER_CONTACT_UPDATED" && object(e.details).providerShipmentId === shipment.id);
    const details = object(snapshot?.details), rider = object(details.rider), courier = object(details.courier);
    return {
      providerShipmentId: shipment.id, parcelIndex: shipment.parcelIndex,
      status: shipment.status, trackingUrl: safeTrackingUrl(shipment.trackingUrl),
      trackingRef: split ? null : trackingRef,
      courier: { name: text(courier.name) || input.courier || null, phone: text(courier.phone, 40) },
      rider: text(rider.name) || text(rider.phone, 40) ? { name: text(rider.name), phone: text(rider.phone, 40) } : null,
      reportedAt: stamp(snapshot?.createdAt),
    };
  });
  const timeline = events.filter(e => e.status !== "PROVIDER_CONTACT_UPDATED").map(e => {
    const details = object(e.details), providerTime = providerTimestamp(details.providerTime);
    const status = e.status === "PROVIDER_UPDATE" ? text(details.normalizedStatus) || "PROVIDER_UPDATE" : e.status;
    return {
      id: e.id, status, label: status === "PROVIDER_UPDATE" ? "Provider update" : deliveryEventLabel(status),
      source: e.source, recordedAt: stamp(e.createdAt),
      providerTime: providerTime.raw, occurredAt: providerTime.at,
      providerStatus: e.status === "PROVIDER_UPDATE" ? text(details.providerStatus) : null,
      providerShipmentId: text(details.providerShipmentId),
      parcelIndex: typeof details.parcelIndex === "number" ? details.parcelIndex : null,
    };
  });
  const milestones = ["BOOKED", "PICKED_UP", "IN_TRANSIT", "DELIVERED"].map(status => {
    const event = timeline.find(e => (e.status === status || (status === "BOOKED" && e.status === "MANUAL_ASSIGNED")) && e.parcelIndex === null && (!e.providerShipmentId || e.providerShipmentId === input.providerShipmentId));
    return { status, label: status === "BOOKED" ? manual ? "Courier assigned" : "Booking confirmed" : deliveryStatusCopy(status).label,
      reported: !(status === "DELIVERED" && incomplete) && (!!event || input.status === status || (status === "BOOKED" && input.status === "MANUAL_ASSIGNED")),
      recordedAt: event?.recordedAt || null, occurredAt: event?.occurredAt || null, providerTime: event?.providerTime || null };
  });
  return {
    ...copy, status: input.status, dispatched, liveTracking: false as const,
    provider: manual ? "Manual dispatch" : input.providerShipmentId || input.selectedQuoteId ? "Shipbubble" : null,
    courier: input.courier || null, trackingUrl: safeTrackingUrl(input.trackingUrl),
    trackingRef,
    lastSyncedAt, lastProgressAt, pickupDate,
    receiptConfirmedAt, receiptSource: input.receiptSource || "buyer",
    packageCount, deliveredPackages: split ? new Set(parcels.filter(p => p.status === "DELIVERED" && !!p.providerShipmentId && !!input.selectedQuoteId && p.quoteId === input.selectedQuoteId && p.parcelIndex >= 0 && p.parcelIndex < packageCount).map(p => p.parcelIndex)).size : input.status === "DELIVERED" ? packageCount : 0,
    warnings, assignments, milestones, timeline,
  };
}
export type DeliveryVisibility = ReturnType<typeof deliveryVisibility>;
