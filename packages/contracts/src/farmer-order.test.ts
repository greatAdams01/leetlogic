import { expect, it } from "vitest";
import { orderFulfillment } from "./order-fulfillment.js";
import { farmerOrderGuide } from "./farmer-order.js";
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
it("gives one plain action for preparation and handoff", () => {
  expect(farmerOrderGuide(orderFulfillment(base))).toMatchObject({
    title: "Prepare this order",
    action: "ready",
  });
  expect(farmerOrderGuide(orderFulfillment({ ...base, ready: true }))).toMatchObject({
    title: "Ready for the rider",
    action: "dispatch",
  });
});
it("does not ask farmers to act while waiting for buyer collection or completion", () => {
  expect(
    farmerOrderGuide(
      orderFulfillment({ ...base, ready: true, collection: true, status: "PICKUP_READY" }),
    ),
  ).toMatchObject({ title: "Waiting for the buyer", action: null, method: "Buyer will collect" });
  expect(farmerOrderGuide(orderFulfillment({ ...base, confirmed: true }))).toMatchObject({
    title: "Order finished",
    action: null,
  });
});
it("suppresses actions for closed or blocked orders and never claims a payment balance", () => {
  for (const patch of [
    { blocked: true },
    { review: true, blocked: true },
    { orderStatus: "CANCELLED" },
  ])
    expect(farmerOrderGuide(orderFulfillment({ ...base, ...patch })).action).toBeNull();
  expect(farmerOrderGuide().action).toBeNull();
});
