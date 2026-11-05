import type { OrderFulfillment } from "./order-fulfillment.js";
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
  if (progress.status === "Needs review")
    return {
      title: "This order needs help",
      body: "Staff are reviewing this order. Get help before taking another action.",
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
  if (progress.status === "Ready for Pickup")
    return {
      title: collection ? "Waiting for the buyer" : "Waiting for the rider",
      body: collection
        ? "Keep the produce ready. The buyer will confirm after collection."
        : "Your produce is ready. We are arranging the rider.",
      action: null,
      step: 2,
      method,
    } as const;
  if (
    ["Dispatched", "Picked Up", "In Transit", "Awaiting buyer confirmation"].includes(
      progress.status,
    )
  )
    return {
      title: "Waiting for buyer confirmation",
      body: "The produce has left your farm. The buyer will confirm after receiving it.",
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
