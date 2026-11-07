import type { OrderFulfillment } from "./order-fulfillment.js";
import { deliveryProblemStates, deliveryStatusCopy, farmerDeliveryStatusCopy } from "./delivery-visibility.js";
export type JourneyAction = "accept" | "ready" | "dispatch" | "handover" | "confirm" | null;
export function orderJourney(input: {
  buyer: boolean;
  progress?: OrderFulfillment;
  orderStatus: string;
  decision?: string;
  handedOver?: boolean;
  money?: {
    progress?: import("./order-payment-progress.js").OrderPaymentProgress;
    heldMinor: string;
    releasedMinor: string;
    refundedMinor: string;
    refund?: { status: string } | null;
    release?: { status: string } | null;
  };
}) {
  const p = input.progress,
    buyer = input.buyer,
    pickup = p?.method === "Pickup";
  const released = BigInt(input.money?.releasedMinor || "0") > 0n;
  const refunded =
    input.orderStatus === "REFUNDED" || BigInt(input.money?.refundedMinor || "0") > 0n;
  const releaseStatus = input.money?.release?.status;
  const payment = input.money?.progress?.title || (refunded
    ? "Payment refunded"
    : input.decision === "REJECTED"
      ? "Refund pending"
      : released
        ? "Payment released"
        : releaseStatus === "FAILED" || releaseStatus === "BLOCKED"
          ? "Payment needs attention"
          : p?.confirmed
            ? "Payment processing"
            : BigInt(input.money?.heldMinor || "0") > 0n
              ? "Payment protected"
              : "Checking payment");
  let title = buyer ? "Order placed" : "Checking this order",
    body = p?.next || "Checking the latest order update.",
    action: JourneyAction = null,
    label = "",
    receiptPending = false,
    stage = 0;
  const closed =
    ["CANCELLED", "REFUNDED"].includes(input.orderStatus) || input.decision === "REJECTED";
  const review = p?.status === "Needs review";
  if (closed) {
    title = refunded
      ? "Order refunded"
      : input.decision === "REJECTED"
        ? "Order declined"
        : "Order closed";
    body = refunded
      ? "Your refund is confirmed."
      : "No preparation is needed. Follow your refund below.";
  } else if (review) {
    title = "We’re reviewing this order";
    body = "Actions are paused while we resolve the issue.";
  } else if (p?.confirmed) {
    stage = 4;
    title = "Order completed";
    body = released
      ? "Receipt and farmer payment are confirmed."
      : "Receipt confirmed. We’ll update you when payment is released.";
  } else if (p?.awaitingAcceptance || input.decision === "PENDING") {
    title = buyer ? "Waiting for the farmer" : "New Order";
    body = buyer
      ? "Your order is placed. The farmer will check and accept it."
      : "Check the goods and quantity before accepting.";
    if (p?.canAccept && !buyer) {
      action = "accept";
      label = "Accept Order";
    }
  } else if (p?.canConfirm && buyer) {
    stage = 3;
    title = pickup ? "Have you received your goods?" : deliveryStatusCopy("DELIVERED").title;
    body = "Check the quantity and condition before confirming.";
    action = "confirm";
    label = "Confirm Receipt";
  } else if (p?.status === "Delivery completion needs review") {
    title = "Delivery completion needs review";
    body = p.next;
    receiptPending = buyer;
    stage = 3;
  } else if (p?.status === "Courier booking needs attention" && !p.canReady) {
    title = p.status;
    body = p.next;
    stage = 2;
  } else if (p?.deliveryStatus && p.deliveryStatus !== "BOOKING_BLOCKED" && deliveryProblemStates.includes(p.deliveryStatus)) {
    title = deliveryStatusCopy(p.deliveryStatus).title;
    body = p.next;
    stage = 3;
  } else if (
    input.handedOver ||
    p?.handedOver ||
    ["Dispatched", "Picked Up", "In Transit", "Delivered", "Awaiting buyer confirmation"].includes(
      p?.status || "",
    )
  ) {
    stage = 3;
    receiptPending = buyer && p?.method === "Delivery";
    title = buyer
      ? pickup
        ? "Goods collected"
        : deliveryStatusCopy(p?.deliveryStatus || "BOOKED", p?.status === "Dispatched").title
      : pickup ? "Waiting for buyer confirmation" : farmerDeliveryStatusCopy(p?.deliveryStatus || "BOOKED", p?.status === "Dispatched").title;
    body = buyer
      ? pickup ? "Follow delivery updates. Confirm after receiving and inspecting everything." : deliveryStatusCopy(p?.deliveryStatus || "BOOKED", p?.status === "Dispatched").body
      : pickup ? "The buyer will inspect the goods and confirm receipt." : farmerDeliveryStatusCopy(p?.deliveryStatus || "BOOKED", p?.status === "Dispatched").body;
  } else if (p?.canDispatch && !buyer) {
    stage = 2;
    title = "Ready for rider pickup";
    body = "Hand every package to the rider before confirming.";
    action = "dispatch";
    label = "Rider Collected Goods";
  } else if (p?.canHandover && !buyer) {
    stage = 2;
    title = "Ready for buyer pickup";
    body = "Confirm only after giving every package to the buyer.";
    action = "handover";
    label = "Goods Handed to Buyer";
  } else if (p && !(p.canReady && !buyer) && [
    "Courier booking needs attention", "Delivery top-up required", "Booking your courier", "Awaiting courier booking",
  ].includes(p.status)) {
    stage = 2;
    title = p.status;
    body = p.next;
  } else if (p?.status === "Ready for Pickup") {
    stage = 2;
    title = pickup ? "Ready for pickup" : "Ready for rider pickup";
    body = buyer
      ? pickup
        ? "Collect your goods using the pickup details below."
        : "We’re arranging the rider. You’ll see updates here."
      : "Keep the goods packed and ready for collection.";
  } else if (p?.canReady && !buyer) {
    stage = 1;
    title = "Prepare the order";
    body = "Pack the full quantity securely.";
    action = "ready";
    label = pickup ? "Ready for Pickup" : "Ready for Rider Pickup";
  } else if (p && p.status !== "Payment Pending") {
    stage = 1;
    title = buyer ? "Farmer preparing your goods" : "Preparing your order";
    body = buyer ? "We’ll let you know when your goods are ready." : p.next;
  }
  const after =
    action === "accept"
      ? "Next: pack and prepare the goods."
      : action === "ready"
        ? pickup
          ? "Next: buyer collects the goods."
          : "Next: rider collects the goods."
        : action === "dispatch" || action === "handover"
          ? "Next: buyer inspection and confirmation."
          : action === "confirm"
            ? "Next: verified payment release to the farmer."
            : receiptPending
              ? "Available after the courier confirms delivery of every package."
              : "";
  return {
    title,
    body,
    action,
    label,
    receiptPending,
    after,
    stage,
    payment,
    closed,
    review,
    steps: ["Accepted", "Prepared", pickup ? "Pickup" : "Rider pickup", "Received", "Complete"],
  };
}
