import type { OrderFulfillment } from "./order-fulfillment.js";
import { farmerDeliveryStatusCopy } from "./delivery-visibility.js";
/** Farmer-facing guidance changes wording only; the server still authorizes every action. */
export function farmerOrderGuide(progress?: OrderFulfillment) {
  const collection = progress?.method === "Pickup";
  const method = !progress
    ? "Pickup details"
    : collection
      ? "Buyer will collect"
      : "Rider will collect";
  if (!progress)
    return {
      title: "Checking this order",
      body: "Please wait while we check the latest order update.",
      action: null,
      step: 0,
      method,
    } as const;
  if (progress.status === "Cancelled" || progress.status === "Refunded")
    return {
      title: "Order closed",
      body: "Do not prepare this order. Open Money for payment or refund information.",
      action: null,
      step: 0,
      method,
    } as const;
  if (progress.status === "Needs review" || (!progress.canReady && ["Courier booking needs attention", "Delivery top-up required", "Delivery attempt failed", "Returning to farmer", "Returned to farmer", "Delivery cancelled", "Booking needs reconciliation", "Manual delivery needs review", "Delivery completion needs review"].includes(progress.status)))
    return {
      title: "This order needs help",
      body: progress.status === "Needs review" ? "Staff are reviewing this order. Get help before taking another action." : progress.next,
      action: null,
      step: 0,
      method,
    } as const;
  if (progress.confirmed)
    return {
      title: "Order finished",
      body: "The buyer has confirmed receipt. There is nothing more to prepare.",
      action: null,
      step: 3,
      method,
    } as const;
  if (progress.canReady)
    return {
      title: "Prepare this order",
      body: "Pack the produce for this order. Tap the button when everything is ready.",
      action: "ready",
      step: 1,
      method,
    } as const;
  if (progress.canDispatch)
    return {
      title: "Ready for the rider",
      body: "Only tap the button after the rider has collected every package.",
      action: "dispatch",
      step: 2,
      method,
    } as const;
  if (["Ready for Pickup", "Awaiting courier booking", "Booking your courier"].includes(progress.status))
    return {
      title: collection ? "Waiting for the buyer" : "Waiting for the rider",
      body: progress.status !== "Ready for Pickup" ? progress.next : collection
        ? "Keep the produce ready. The buyer will confirm after collection."
        : "Your produce is ready. We are arranging the rider.",
      action: null,
      step: 2,
      method,
    } as const;
  if (
    ["Dispatched", "Picked Up", "In Transit", "Delivered", "Awaiting buyer confirmation"].includes(
      progress.status,
    )
  )
    return {
      title: collection ? "Waiting for buyer confirmation" : farmerDeliveryStatusCopy(progress.deliveryStatus || "BOOKED", progress.status === "Dispatched").title,
      body: collection ? "The produce has left your farm. The buyer will confirm after receiving it." : farmerDeliveryStatusCopy(progress.deliveryStatus || "BOOKED", progress.status === "Dispatched").body,
      action: null,
      step: 2,
      method,
    } as const;
  return {
    title: "Waiting for an update",
    body: "We will show your next action here when the order is ready to continue.",
    action: null,
    step: 0,
    method,
  } as const;
}
