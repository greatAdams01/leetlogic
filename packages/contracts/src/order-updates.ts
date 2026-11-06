export type RecoveryRecord = {
  state: string;
  isBuyer: boolean;
  allocatedAt?: string | Date | null;
  farmerConfirmedAt?: string | Date | null;
  reservationUntil?: string | Date | null;
  version: number;
  deadline?: { state: string; refundDueAt: string | Date; failureCode?: string | null } | null;
  proposal?: {
    version?: number;
    expiresAt: string | Date;
    buyerAcceptedAt?: string | Date | null;
  } | null;
};
export function recoveryExperience(record: RecoveryRecord, now = new Date()) {
  const deadline = record.deadline;
  const due = !!deadline && new Date(deadline.refundDueAt).getTime() <= now.getTime();
  const refundState =
    deadline &&
    [
      "REFUND_DUE",
      "REFUND_PROCESSING",
      "REFUND_BLOCKED",
      "REFUND_RECONCILIATION",
      "REFUNDED",
    ].includes(deadline.state)
      ? deadline.state
      : record.state === "REFUNDED"
        ? "REFUNDED"
        : record.state === "REFUND_REQUIRED" || (due && deadline?.state !== "SECURED")
          ? "REFUND_DUE"
          : null;
  const allocated = !!record.allocatedAt;
  const open = !allocated && !refundState && !due && (!deadline || deadline.state === "ACTIVE");
  const stockValid =
    !!record.farmerConfirmedAt &&
    !!record.reservationUntil &&
    new Date(record.reservationUntil) > now;
  const proposalValid =
    !!record.proposal &&
    (!record.proposal.version || record.proposal.version === record.version) &&
    new Date(record.proposal.expiresAt) > now &&
    stockValid;
  const canFarmerConfirm = open && !record.isBuyer && !stockValid;
  const canBuyerAccept =
    open && record.isBuyer && proposalValid && !record.proposal?.buyerAcceptedAt;
  let title: string, body: string;
  if (refundState) {
    title =
      (
        {
          REFUND_DUE: "Refund due",
          REFUND_PROCESSING: "Refund processing",
          REFUND_BLOCKED: "Refund needs staff attention",
          REFUND_RECONCILIATION: "Checking shipment before refund",
          REFUNDED: "Refund completed",
        } as Record<string, string>
      )[refundState] || "Refund due";
    body = record.isBuyer
      ? refundState === "REFUNDED"
        ? "Your refund is confirmed. Open your payment history for details."
        : refundState === "REFUND_PROCESSING"
          ? "Your refund is being processed. We will update you when the provider confirms it."
          : "Stock confirmation is closed. We are resolving your refund; do not pay again."
      : "This order no longer needs preparation. The buyer’s refund is being handled.";
  } else if (allocated) {
    title = "Payment allocated to your order";
    body = "Open the order to follow preparation, pickup and delivery.";
  } else if (!stockValid) {
    title = record.isBuyer
      ? "Waiting for farmer confirmation"
      : "Confirm your produce is available";
    body = record.isBuyer
      ? "The farmer must confirm the original produce and quantity. You can wait or request a refund."
      : "Check the original produce, quantity and pickup details below. Confirm availability or tell us you cannot fulfill it.";
  } else if (!proposalValid) {
    title = "Preparing an updated proposal";
    body = record.isBuyer
      ? "Staff are checking pickup and delivery. We will notify you when your proposal is ready."
      : "Your stock confirmation is saved. Staff are preparing the buyer’s pickup or delivery proposal.";
  } else if (record.proposal?.buyerAcceptedAt) {
    title = "Waiting for staff approval";
    body =
      "The buyer has accepted. Staff must complete the final checks before fulfillment starts.";
  } else {
    title = record.isBuyer ? "Review your order proposal" : "Waiting for buyer acceptance";
    body = record.isBuyer
      ? "Review the pickup date and any delivery price change before accepting."
      : "Your stock is reserved while the buyer reviews the updated proposal.";
  }
  return {
    title,
    body,
    phase: refundState || record.state,
    canFarmerConfirm,
    canBuyerAccept,
    canRequestRefund: open,
    closed: !open,
    stockValid,
    proposalValid,
  };
}
export function orderUpdateCopy(messageKey: string, buyer: boolean) {
  const state = messageKey.replace(/^status\./, "");
  const recovery: Record<string, [string, string]> = {
    ORDER_ACCEPTED: ["Order accepted", "The farmer is preparing your goods."],
    ORDER_REJECTED: ["Order declined", "The farmer cannot fulfill this order. Follow the refund status in your order."],
    BUYER_COLLECTED: ["Goods handed over", "The buyer should inspect the goods and confirm receipt."],
    PAYMENT_RELEASE_PAUSED: ["Payment release paused", "Receipt is saved. Payment processing needs support attention."],
    PAYMENT_RELEASE_PROCESSING: ["Payment release processing", "Receipt is confirmed. The farmer’s transfer is queued for secure processing."],
    PAYMENT_RELEASE_FAILED: ["Payment needs attention", "The farmer’s payment could not be completed. Support will review it."],
    PAYMENT_RELEASED: ["Payment released", "The farmer’s payment is confirmed. Open the order for details."],
    PAYMENT_REFUNDED: ["Refund confirmed", "The payment provider confirmed a refund for this order. Open the order to review the amount."],
    RECOVERY_REQUIRED: [
      buyer ? "Your payment needs order recovery" : "Stock confirmation needed",
      buyer
        ? "Payment is verified. The farmer must confirm availability before this order can continue."
        : "A buyer’s payment is verified. Open the order to confirm stock and pickup availability.",
    ],
    RECOVERY_FARMER_CONFIRMED: [
      "Farmer availability confirmed",
      "The farmer confirmed stock. Staff are preparing the updated pickup or delivery proposal.",
    ],
    RECOVERY_PROPOSAL: [
      buyer ? "Your proposal is ready" : "Proposal sent to buyer",
      buyer
        ? "Open the order to accept the pickup or delivery proposal, or request a refund."
        : "The buyer can now review the updated proposal. We will update you after their decision.",
    ],
    RECOVERY_BUYER_ACCEPTED: [
      "Buyer accepted the proposal",
      "Staff will complete the final checks before allocating payment and starting fulfillment.",
    ],
    RECOVERY_DECLINED: [
      "Recovery declined — refund due",
      "Fulfillment will not restart. Follow the refund status in the order.",
    ],
    REFUND_DUE: [
      "Refund due",
      "The recovery deadline has passed. Stock confirmation is closed while the refund is arranged.",
    ],
    REFUND_PROCESSING: [
      "Refund processing",
      "We are processing the refund. Provider confirmation is still pending.",
    ],
    REFUND_BLOCKED: [
      "Refund needs staff attention",
      "Staff are resolving a refund issue. Open the order for the latest status.",
    ],
    REFUND_RECONCILIATION: [
      "Checking shipment before refund",
      "Staff must confirm shipment cancellation before the refund can proceed.",
    ],
    REFUND_COMPLETED: ["Refund completed", "The provider has confirmed the buyer’s refund."],
  };
  if (recovery[state]) return { title: recovery[state][0], body: recovery[state][1] };
  if (messageKey === "order.paid")
    return {
      title: "New paid order",
      body: "Payment is allocated. Review the produce and prepare it for pickup.",
    };
  if (messageKey === "listing.approved")
    return {
      title: "Listing approved",
      body: "Your produce listing is approved and available to buyers.",
    };
  const titles: Record<string, string> = {
    PAYMENT_CONFIRMED: "Payment confirmed",
    PAID: "Delivery payment confirmed",
    PREPARING_FOR_PICKUP: "Preparing for pickup",
    PICKUP_PREPARING: "Preparing for pickup",
    PICKUP_READY: "Ready for pickup",
    READY_FOR_PICKUP: "Ready for pickup",
    FARMER_DISPATCHED: "Farmer confirmed dispatch",
    BUYER_RECEIPT_CONFIRMED: "Buyer confirmed receipt",
    BOOKING_QUEUED: "Courier booking queued",
    BOOKING: "Booking your courier",
    BOOKING_UNCERTAIN: "Courier booking needs review",
    BOOKING_BLOCKED: "Courier booking needs attention",
    BOOKED: "Courier booked",
    COURIER_ASSIGNED: "Courier assigned",
    PICKED_UP: "Produce collected",
    IN_TRANSIT: "Shipment in transit",
    DELIVERED: "Order delivered",
    FAILED_ATTEMPT: "Delivery attempt failed",
    RETURNING: "Shipment returning",
    RETURNED: "Shipment returned",
    CANCELLED: "Order cancelled",
    QUOTE_REQUIRED: "Delivery quote required",
    PAYMENT_PENDING: "Payment pending",
    MANUAL_REVIEW: "Delivery needs staff review",
    MANUAL_ASSIGNED: "Courier assigned",
    PICKUP_ARRANGEMENT_ACCEPTED: "Pickup arrangement accepted",
  };
  return {
    title: titles[state] || "Order information changed",
    body: "Open the order to see the latest pickup and delivery details.",
  };
}
