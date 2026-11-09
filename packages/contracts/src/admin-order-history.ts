export type OrderHistoryEntry = {
  id: string; orderId: string; entityType: string; entityId: string; kind: string; action: string;
  actorType: string; actorId: string | null; actorName: string; reason: string | null;
  before: unknown; after: unknown; occurredAt: string; requestId: string | null;
};
export type OrderHistoryPage = {
  items: OrderHistoryEntry[]; through: string; nextCursor: string | null; hasMore: boolean;
  completeFrom: string | null;
};
export type HistoryChange = { field: string; label: string; before: unknown; after: unknown };

const labels: Record<string, string> = {
  admin_resolution: "Administrative resolution", outcome: "Closure status", financialAction: "Payment instruction", resolvedAt: "Resolution date", adminId: "Administrator", previousOrderStatus: "Previous order status", previousDeliveryStatus: "Previous delivery status", previousFinancialHold: "Previous payment hold", previousHeldMinor: "Previously held funds", shippingRefundMinor: "Delivery fee refund",
  buyer_contact_snapshot: "Buyer contact", buyerContact: "Buyer contact", fulfillment_notes: "Fulfillment notes", fulfillmentNotes: "Fulfillment notes",
  operations_notes: "Delivery notes", operationsNotes: "Delivery notes", rider_assignment: "Manual rider", riderAssignment: "Manual rider",
  pickup: "Pickup", destination: "Drop-off", package: "Packing", courier: "Courier", rider: "Rider",
  name: "Name", phone: "Phone", email: "Email", address: "Address", state: "State", country: "Country",
  postalCode: "Digital postcode", instructions: "Directions", latitude: "Latitude", longitude: "Longitude", addressId: "Saved address reference",
  reference: "Reference", trackingRef: "Tracking reference", providerShipmentId: "Courier booking reference", selectedQuoteId: "Selected quote reference", quoteId: "Quote reference",
  status: "Status", quantity: "Quantity", totalMinor: "Produce total", heldMinor: "Produce funds held", releasedMinor: "Produce funds released", refundedMinor: "Produce refund recorded",
  shippingMinor: "Delivery fee", paidMinor: "Payment recorded", amountMinor: "Amount", feeMinor: "Fee", walletMinor: "Courier cost", actualMinor: "Actual courier cost",
  produceMinor: "Produce amount", processingFeeMinor: "Payment processing fee", feeBasisPoints: "Commission rate (basis points)", evidence: "Supporting evidence",
  farmer_decision: "Farmer response", farmer_decided_at: "Farmer response date", rejection_reason: "Farmer’s reason", handed_over_at: "Goods handed over",
  deliveryConfirmedAt: "Receipt confirmation", bookingStartedAt: "Booking started", cancelRequestedAt: "Cancellation requested", cancelAttemptedAt: "Cancellation sent to courier",
  failureCode: "Review issue", exceptionCode: "Payment review issue", checkErrorCode: "Payment check issue", confirmedAt: "Payment confirmation", externalRef: "External payment reference", paymentRef: "Delivery payment reference",
  trackingUrl: "Provider tracking link", carrier: "Manual courier", pickupDate: "Pickup date", weightKg: "Packed weight (kg)", length: "Length (cm)", width: "Width (cm)", height: "Height (cm)",
  packageCount: "Number of packages", parcelIndex: "Package index", handling: "Handling", specialHandling: "Special handling", notes: "Instructions", pickupInstructions: "Pickup instructions",
  receiptEvidencePresent: "Receipt photo saved", receipt_photo_at: "Receipt photo date", receipt_photo_mime: "Receipt photo format",
  funds_provider: "Payment source", financial_hold: "Financial review hold", reservation_expires_at: "Reservation deadline", journey_version: "Fulfillment rules version",
  kind: "Operation", mode: "Environment", operationReason: "Operation reason", providerStatus: "Courier’s reported status", providerTime: "Courier’s reported time", normalizedStatus: "Recorded delivery status",
  serviceCode: "Courier service reference", courierId: "Courier reference", eta: "Delivery estimate", expiresAt: "Quote or request expiry", checkoutId: "Hosted payment reference", chargeId: "Payment reference",
  providerId: "Provider operation reference", attemptedAt: "Request sent", completedAt: "Completed", quality: "Courier service quality", rating: "Rating", votes: "Ratings received", trackingLevel: "Tracking support",
};
const bookkeeping = new Set(["id", "orderId", "deliveryId", "buyerId", "farmerProfileId", "listingId", "actorId", "ownerId", "paymentId", "requestId", "transaction_id",
  "transactionId", "adminId", "updatedAt", "createdAt", "lastSyncedAt", "nextSyncAt", "leaseUntil", "lastCheckedAt", "nextCheckAt", "checkFailures", "quoteRequestId", "inputHash", "requestHash", "mutationKey", "dedupeKey"]);
const label = (key: string) => labels[key] || key.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ").replace(/^./, letter => letter.toUpperCase());
const canonical = (value: unknown): string => JSON.stringify(value ?? null, (_key, item) => item && typeof item === "object" && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);

/** Presentation only. Full, immutable snapshots stay in the database; never derive financial state here. */
export function historyChanges(before: unknown, after: unknown): HistoryChange[] {
  const changes: HistoryChange[] = [];
  const walk = (old: unknown, next: unknown, path: string[], names: string[]) => {
    if (canonical(old) === canonical(next)) return;
    const oldObject = old && typeof old === "object" && !Array.isArray(old) ? old as Record<string, unknown> : null;
    const nextObject = next && typeof next === "object" && !Array.isArray(next) ? next as Record<string, unknown> : null;
    if (oldObject || nextObject) {
      for (const key of [...new Set([...Object.keys(oldObject || {}), ...Object.keys(nextObject || {})])].sort()) {
        if (!bookkeeping.has(key)) walk(oldObject?.[key], nextObject?.[key], [...path, key], [...names, label(key)]);
      }
    } else changes.push({ field: path.join("."), label: names.join(" · ") || "Details", before: old ?? null, after: next ?? null });
  };
  walk(before, after, [], []);
  return changes;
}
