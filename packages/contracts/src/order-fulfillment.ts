export type OrderTab = "details" | "fulfillment" | "payment" | "activity";
export const orderTabs: { id: OrderTab; label: string }[] = [
  { id: "details", label: "Order Details" },
  { id: "fulfillment", label: "Fulfillment" },
  { id: "payment", label: "Payment" },
  { id: "activity", label: "Activity History" },
];
export function orderFulfillment(input: {
  farmerDecision?: string;
  handedOver?: boolean;
  review?: boolean;
  orderStatus?: string;
  paid: boolean;
  confirmed: boolean;
  blocked: boolean;
  buyer: boolean;
  farmer: boolean;
  status: string;
  bookingFailureCode?: string | null;
  ready: boolean;
  dispatched: boolean;
  booked: boolean;
  receiptReady: boolean;
  collection: boolean;
}) {
  const {
    paid,
    confirmed,
    blocked,
    buyer,
    farmer,
    status,
    ready,
    dispatched,
    booked,
    receiptReady,
    collection,
  } = input;
  const awaitingAcceptance = input.farmerDecision === "PENDING";
  const rejected = input.farmerDecision === "REJECTED";
  const accepted = !awaitingAcceptance && !rejected && !input.review;
  const bookingBlocked = status === "BOOKING_BLOCKED";
  const bookingQueued = ["BOOKING_QUEUED", "BOOKING"].includes(status);
  const awaitingBooking = !collection && ready && !booked && status === "PAID";
  const topup = status === "TOPUP_REQUIRED";
  const bookingNext = topup
    ? buyer
      ? "Payment is confirmed. Review and pay only the additional delivery amount to continue."
      : "Payment is confirmed. Waiting for the buyer to review the additional delivery amount."
    : bookingBlocked
      ? input.bookingFailureCode === "DELIVERY_PRICE_CHANGED"
        ? buyer
          ? "Payment is confirmed. The delivery price changed; review the new quote before booking. You will not be charged automatically."
          : "Payment is confirmed. The delivery price changed; the buyer or staff must review it before booking."
        : "Payment is confirmed. Courier booking needs attention; temporary issues retry automatically."
      : bookingQueued
        ? "Payment is confirmed. We are booking the courier; no booking is confirmed yet."
        : "Produce is ready. Waiting for a confirmed courier booking.";
  const canAccept = farmer && paid && awaitingAcceptance && !blocked && !input.review && !confirmed;
  const canHandover =
    farmer &&
    paid &&
    accepted &&
    collection &&
    status === "PICKUP_READY" &&
    !input.handedOver &&
    !blocked &&
    !confirmed;
  const terminal = ["CANCELLED", "REFUNDED"].includes(input.orderStatus || "");
  const canReady =
    !terminal &&
    farmer &&
    accepted &&
    paid &&
    !confirmed &&
    !blocked &&
    !ready &&
    [
      "PICKUP_PREPARING",
      "PAID",
      "BOOKING_QUEUED",
      "BOOKING",
      "BOOKING_BLOCKED",
      "BOOKED",
      "MANUAL_ASSIGNED",
    ].includes(status);
  const canDispatch =
    !terminal &&
    farmer &&
    accepted &&
    paid &&
    !confirmed &&
    !blocked &&
    !collection &&
    ready &&
    !dispatched &&
    booked &&
    ["BOOKED", "MANUAL_ASSIGNED"].includes(status);
  const canConfirm =
    !terminal && accepted && buyer && paid && !confirmed && !blocked && receiptReady;
  const stage = !paid
    ? -1
    : confirmed
      ? 4
      : collection
        ? status === "PICKUP_READY"
          ? 2
          : 1
        : ["IN_TRANSIT", "DELIVERED"].includes(status)
          ? 3
          : dispatched || status === "PICKED_UP"
            ? 2
            : 1;
  const next = terminal
    ? "This order is closed. Open Payment for refund details."
    : input.review
      ? "This order needs review. Fulfillment actions are paused."
      : rejected
        ? "The farmer could not fulfill this order. Follow the refund update below."
        : awaitingAcceptance
          ? farmer
            ? "Check the produce and quantity, then accept this order."
            : "Your order is placed. Waiting for the farmer to accept."
          : confirmed
            ? "Receipt confirmed. Fulfillment is complete."
            : blocked
              ? "This order needs review. Fulfillment actions are paused."
              : !paid
                ? "Payment must be verified before preparation or collection."
                : canConfirm
                  ? "Confirm only after collecting and inspecting your produce."
                  : canReady
                    ? "Prepare the produce, then mark it ready."
                    : canDispatch
                      ? "Confirm dispatch only after handing all parcels to the courier."
                      : collection
                        ? ready || status === "PICKUP_READY"
                          ? "Produce is ready. The buyer can collect and confirm pickup."
                          : "Waiting for the farmer to prepare the produce."
                        : bookingBlocked || bookingQueued || awaitingBooking || topup
                          ? bookingNext
                          : dispatched || ["PICKED_UP", "IN_TRANSIT"].includes(status)
                            ? "The shipment is on its way. Courier tracking will update automatically."
                            : status === "DELIVERED"
                              ? "Waiting for the buyer to confirm receipt."
                              : "Pickup is being arranged. Follow courier tracking for updates.";
  return {
    canAccept: canAccept && !terminal,
    canReject: canAccept && !terminal,
    canHandover: canHandover && !terminal,
    awaitingAcceptance,
    rejected,
    handedOver: !!input.handedOver,
    method: collection ? "Pickup" : "Delivery",
    status: terminal
      ? input.orderStatus === "REFUNDED"
        ? "Refunded"
        : "Cancelled"
      : input.review
        ? "Needs review"
        : rejected
          ? "Order declined"
          : awaitingAcceptance && paid && !blocked
            ? "New Order"
            : confirmed
              ? "Completed"
              : blocked
                ? "Needs review"
                : !paid
                  ? "Payment Pending"
                  : collection
                    ? status === "PICKUP_READY"
                      ? "Ready for Pickup"
                      : "Preparing for Pickup"
                    : status === "DELIVERED"
                      ? "Awaiting buyer confirmation"
                      : status === "PICKED_UP"
                        ? "Picked Up"
                         : status === "IN_TRANSIT"
                           ? "In Transit"
                           : bookingBlocked
                             ? "Courier booking needs attention"
                             : topup
                               ? "Delivery top-up required"
                               : bookingQueued
                                 ? "Booking your courier"
                                 : awaitingBooking
                                   ? "Awaiting courier booking"
                                   : dispatched
                                     ? "Dispatched"
                                     : ready
                                       ? "Ready for Pickup"
                                       : "Preparing for Pickup",
    stage,
    steps: collection
      ? ["Payment confirmed", "Preparing", "Ready for Pickup", "Collected", "Completed"]
      : ["Payment confirmed", "Preparing", "Dispatched", "In Transit", "Completed"],
    next,
    canReady,
    canDispatch,
    canConfirm,
    confirmed,
  };
}
export type OrderFulfillment = ReturnType<typeof orderFulfillment>;
