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
    title: "Receipt confirmed",
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
it.each(["PAID", "BOOKING_QUEUED", "BOOKING", "BOOKING_BLOCKED", "TOPUP_REQUIRED"])(
  "keeps missing courier booking visible in the main %s journey", status => {
    const progress = orderFulfillment({
      ...base, collection: false, farmerDecision: "ACCEPTED", status, ready: true,
      bookingFailureCode: "DELIVERY_PRICE_CHANGED",
    });
    for (const buyer of [true, false]) {
      expect(orderJourney({ buyer, progress, orderStatus: "FUNDED" })).toMatchObject({
        title: progress.status, body: progress.next, action: null,
      });
    }
  },
);
it.each(["BOOKED", "PICKED_UP", "IN_TRANSIT", "DELIVERED"])(
  "explains the disabled buyer receipt action while %s still lacks complete delivery evidence", status => {
    const progress = orderFulfillment({
      ...base, buyer: true, farmer: false, collection: false, farmerDecision: "ACCEPTED",
      ready: true, dispatched: true, booked: true, status,
    });
    expect(orderJourney({ buyer: true, progress, orderStatus: "FUNDED" })).toMatchObject({
      action: null, receiptPending: true,
      after: "Available after the courier confirms delivery of every package.",
    });
    expect(orderJourney({ buyer: false, progress, orderStatus: "FUNDED" }).receiptPending).toBe(false);
  },
);
it("enables the existing receipt action only when the server says confirmation is allowed", () => {
  const progress = orderFulfillment({
    ...base, buyer: true, farmer: false, collection: false, farmerDecision: "ACCEPTED",
    ready: true, dispatched: true, booked: true, status: "DELIVERED", receiptReady: true,
  });
  expect(orderJourney({ buyer: true, progress, orderStatus: "FUNDED" })).toMatchObject({
    action: "confirm", label: "Confirm Receipt", receiptPending: false,
  });
  for (const patch of [
    { confirmed: true }, { blocked: true, review: true }, { orderStatus: "CANCELLED" },
    { orderStatus: "REFUNDED" }, { farmerDecision: "REJECTED" }, { paid: false },
  ]) {
    const p = orderFulfillment({
      ...base, buyer: true, farmer: false, collection: false, farmerDecision: "ACCEPTED",
      ready: true, dispatched: true, booked: true, status: "DELIVERED", receiptReady: true, ...patch,
    });
    expect(orderJourney({ buyer: true, progress: p, orderStatus: patch.orderStatus || "FUNDED" })).toMatchObject({
      action: null, receiptPending: false,
    });
  }
});
it("keeps legacy shipment tracking visible without offering the buyer a receipt action", () => {
  const progress = orderFulfillment({ ...base, collection: false, farmerDecision: "LEGACY", legacyShipment: true, status: "IN_TRANSIT" });
  for (const buyer of [true, false]) {
    const journey = orderJourney({ buyer, progress, orderStatus: "FUNDED" });
    expect(journey).toMatchObject({ action: null, receiptPending: false, body: progress.next });
    expect(journey.title).not.toContain("preparing");
  }
});

it("does not call a receipted order completed until settlement completes", () => {
  const p = { confirmed: true } as any;
  expect(orderJourney({ buyer: true, orderStatus: "DELIVERED", progress: p })).toMatchObject({ title: "Receipt confirmed", stage: 3 });
  expect(orderJourney({ buyer: true, orderStatus: "COMPLETED", progress: p })).toMatchObject({ title: "Order completed", stage: 4 });
});

it.each([true, false])("shows admin decisions without inventing receipt confirmation (buyer=%s)", buyer => {
  for (const [outcome, financialAction, status, title] of [
    ["COMPLETED", "RELEASE", "COMPLETED", "Completed by administrator"],
    ["CANCELLED", "REFUND", "CANCELLED", "Cancelled by administrator"],
    ["UNDER_INVESTIGATION", "HOLD", "UNDER_INVESTIGATION", "Under investigation"],
    ["COMPLETED", "NONE", "COMPLETED", "Completed by administrator"],
    ["CANCELLED", "NONE", "CANCELLED", "Cancelled by administrator"],
  ] as const) {
    const progress = orderFulfillment({ ...base, buyer, farmer: !buyer, orderStatus: status,
      adminResolved: financialAction !== "HOLD", adminUnderInvestigation: financialAction === "HOLD" });
    const journey = orderJourney({ buyer, orderStatus: status, progress,
      resolution: { outcome, financialAction, resolvedAt: "2026-11-23T11:24:55.957Z" } });
    expect(journey).toMatchObject({ title, action: null, receiptPending: false, stage: outcome === "COMPLETED" ? 4 : 0 });
    expect(journey.body).toContain(buyer ? "purchase" : "sale");
    expect(progress).toMatchObject({ confirmed: false, canAccept: false, canConfirm: false, canReady: false, canDispatch: false });
  }
  expect(orderJourney({ buyer, orderStatus: "COMPLETED" })).toMatchObject({ title: "Order completed", stage: 4, action: null });
});
