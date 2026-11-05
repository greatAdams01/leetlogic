import { expect, it } from "vitest";
import { orderFulfillment } from "./order-fulfillment.js";
import { orderJourney } from "./order-journey.js";
const base = {
  paid: true,
  confirmed: false,
  blocked: false,
  buyer: false,
  farmer: true,
  status: "PICKUP_PREPARING",
  ready: false,
  dispatched: false,
  booked: false,
  receiptReady: false,
  collection: true,
  farmerDecision: "PENDING",
  orderStatus: "FUNDED",
};
it("requires farmer acceptance before any preparation or receipt action", () => {
  const p = orderFulfillment(base);
  expect(p).toMatchObject({
    canAccept: true,
    canReady: false,
    canConfirm: false,
    canDispatch: false,
  });
  expect(
    orderJourney({ buyer: false, progress: p, orderStatus: "FUNDED", decision: "PENDING" }).action,
  ).toBe("accept");
  expect(
    orderJourney({
      buyer: true,
      progress: orderFulfillment({ ...base, buyer: true, farmer: false }),
      orderStatus: "FUNDED",
      decision: "PENDING",
    }).action,
  ).toBeNull();
});
it("uses different handover actions for pickup and booked delivery", () => {
  const p = orderFulfillment({
    ...base,
    farmerDecision: "ACCEPTED",
    ready: true,
    status: "PICKUP_READY",
  });
  expect(p.canHandover).toBe(true);
  expect(p.canDispatch).toBe(false);
  expect(orderJourney({ buyer: false, progress: p, orderStatus: "FUNDED" }).action).toBe(
    "handover",
  );
  const d = orderFulfillment({
    ...base,
    farmerDecision: "ACCEPTED",
    collection: false,
    ready: true,
    booked: true,
    status: "BOOKED",
  });
  expect(d.canHandover).toBe(false);
  expect(d.canDispatch).toBe(true);
});
it("keeps receipt completion separate from payment success and payment failure", () => {
  const p = orderFulfillment({ ...base, farmerDecision: "ACCEPTED", confirmed: true });
  const input = {
    buyer: false,
    progress: p,
    orderStatus: "DELIVERED",
    money: {
      heldMinor: "10000",
      releasedMinor: "0",
      refundedMinor: "0",
      release: { status: "QUEUED" },
    },
  };
  expect(orderJourney(input)).toMatchObject({
    title: "Order completed",
    payment: "Payment processing",
    action: null,
  });
  expect(
    orderJourney({ ...input, money: { ...input.money, releasedMinor: "10000" } }).payment,
  ).toBe("Payment released");
  expect(
    orderJourney({ ...input, money: { ...input.money, release: { status: "FAILED" } } }).payment,
  ).toBe("Payment needs attention");
});
it("removes actions when rejected, disputed or cancelled and keeps legacy orders compatible", () => {
  expect(orderFulfillment({ ...base, farmerDecision: "REJECTED" })).toMatchObject({
    canAccept: false,
    canReady: false,
    canConfirm: false,
  });
  expect(orderFulfillment({ ...base, blocked: true }).canAccept).toBe(false);
  expect(orderFulfillment({ ...base, orderStatus: "CANCELLED" }).canAccept).toBe(false);
  expect(orderFulfillment({ ...base, farmerDecision: "LEGACY" }).canReady).toBe(true);
});
