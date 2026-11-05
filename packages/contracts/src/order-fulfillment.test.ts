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
    status: "Awaiting buyer confirmation",
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
