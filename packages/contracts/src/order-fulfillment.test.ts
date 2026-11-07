import { expect, it } from "vitest";
import { orderFulfillment } from "./order-fulfillment.js";
const base = {
  paid: true,
  confirmed: false,
  blocked: false,
  buyer: false,
  farmer: true,
  status: "BOOKED",
  ready: false,
  dispatched: false,
  booked: true,
  receiptReady: false,
  collection: false,
};
it("requires readiness and a complete booking before farmer dispatch", () => {
  expect(orderFulfillment(base).canReady).toBe(true);
  expect(orderFulfillment(base).canDispatch).toBe(false);
  expect(orderFulfillment({ ...base, ready: true }).canDispatch).toBe(true);
  expect(orderFulfillment({ ...base, ready: true, status: "MANUAL_ASSIGNED" }).canDispatch).toBe(
    true,
  );
  for (const patch of [
    { booked: false },
    { blocked: true },
    { dispatched: true },
    { collection: true },
    { paid: false },
  ])
    expect(orderFulfillment({ ...base, ready: true, ...patch }).canDispatch).toBe(false);
});
it("never treats a courier delivery or farmer dispatch as buyer confirmation", () => {
  const view = orderFulfillment({
    ...base,
    buyer: true,
    farmer: false,
    status: "DELIVERED",
    ready: true,
    dispatched: true,
    receiptReady: true,
  });
  expect(view).toMatchObject({
    confirmed: false,
    status: "Delivered",
    canConfirm: true,
  });
  expect(
    orderFulfillment({
      ...base,
      buyer: true,
      farmer: false,
      status: "DELIVERED",
      confirmed: true,
      receiptReady: true,
    }),
  ).toMatchObject({ status: "Completed", canConfirm: false, canReady: false, canDispatch: false });
});
it("supports buyer pickup and keeps disputed orders in review", () => {
  expect(
    orderFulfillment({
      ...base,
      collection: true,
      status: "PICKUP_READY",
      buyer: true,
      farmer: false,
      ready: true,
      receiptReady: true,
    }),
  ).toMatchObject({ method: "Pickup", canConfirm: true });
  expect(orderFulfillment({ ...base, review: true, blocked: true, confirmed: true })).toMatchObject(
    { status: "Needs review", canConfirm: false, canDispatch: false },
  );
});

it("keeps closed orders out of fulfillment actions and does not call them unpaid", () => {
  expect(orderFulfillment({ ...base, orderStatus: "CANCELLED" })).toMatchObject({
    status: "Cancelled",
    canReady: false,
    canDispatch: false,
    canConfirm: false,
  });
});
it.each([
  ["PAID", "Awaiting courier booking"],
  ["BOOKING_QUEUED", "Booking your courier"],
  ["BOOKING", "Booking your courier"],
  ["BOOKING_BLOCKED", "Courier booking needs attention"],
  ["TOPUP_REQUIRED", "Delivery top-up required"],
])("reports paid %s honestly without authorizing dispatch or receipt", (status, label) => {
  const view = orderFulfillment({ ...base, status, ready: true, booked: false });
  expect(view).toMatchObject({ status: label, canDispatch: false, canConfirm: false, confirmed: false });
  expect(view.next).not.toContain("Follow courier tracking");
});
it("explains that a renewed price needs review and cannot charge the buyer automatically", () => {
  const view = orderFulfillment({
    ...base, buyer: true, farmer: false, status: "BOOKING_BLOCKED", bookingFailureCode: "DELIVERY_PRICE_CHANGED", ready: true, booked: false,
  });
  expect(view.next).toContain("You will not be charged automatically");
  expect(view.next).toContain("review the new quote");
});
it("asks the farmer to wait for buyer price review rather than to pay the delivery shortfall", () => {
  const view = orderFulfillment({ ...base, status: "TOPUP_REQUIRED", ready: true, booked: false });
  expect(view.next).toContain("Waiting for the buyer");
  expect(view.next).not.toContain("Review and pay");
});
it("shows legacy shipment stages without enabling new farmer or buyer actions", () => {
  for (const status of ["MANUAL_ASSIGNED", "PICKED_UP", "IN_TRANSIT", "DELIVERED"]) {
    const view = orderFulfillment({ ...base, status, buyer: true, ready: true, legacyShipment: true });
    expect(view).toMatchObject({ canAccept: false, canReady: false, canDispatch: false, canHandover: false, canConfirm: false, confirmed: false });
    expect(view.next).toContain("legacy receipt or settlement review");
    if (status === "DELIVERED") expect(view.status).toBe("Delivered");
  }
});
