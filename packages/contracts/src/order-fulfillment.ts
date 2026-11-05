export type OrderTab = "details" | "fulfillment" | "payment" | "activity";
export const orderTabs: { id: OrderTab; label: string }[] = [
  { id: "details", label: "Order Details" },
  { id: "fulfillment", label: "Fulfillment" },
  { id: "payment", label: "Payment" },
  { id: "activity", label: "Activity History" },
];
export function orderFulfillment(input: {
  review?: boolean;
  orderStatus?: string;
  paid: boolean;
  confirmed: boolean;
  blocked: boolean;
  buyer: boolean;
  farmer: boolean;
  status: string;
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
  const terminal = ["CANCELLED", "REFUNDED"].includes(input.orderStatus || "");
  const canReady =
    !terminal &&
    farmer &&
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
    paid &&
    !confirmed &&
    !blocked &&
    !collection &&
    ready &&
    !dispatched &&
    booked &&
    ["BOOKED", "MANUAL_ASSIGNED"].includes(status);
  const canConfirm = !terminal && buyer && paid && !confirmed && !blocked && receiptReady;
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
                    : dispatched || ["PICKED_UP", "IN_TRANSIT"].includes(status)
                      ? "The shipment is on its way. Courier tracking will update automatically."
                      : status === "DELIVERED"
                        ? "Waiting for the buyer to confirm receipt."
                        : "Pickup is being arranged. Follow courier tracking for updates.";
  return {
    method: collection ? "Pickup" : "Delivery",
    status: terminal
      ? input.orderStatus === "REFUNDED"
        ? "Refunded"
        : "Cancelled"
      : input.review
        ? "Needs review"
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
