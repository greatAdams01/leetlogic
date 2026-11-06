import { expect, it } from "vitest";
import { notificationKind, notificationDay } from "./notification-presentation.js";
it("gives orders, money, deliveries, pickups and announcements distinct meanings", () => {
  expect(notificationKind("order.paid")).toBe("Orders");
  expect(notificationKind("status.PAYMENT_RELEASE_PROCESSING")).toBe("Payments");
  expect(notificationKind("status.IN_TRANSIT")).toBe("Delivery");
  expect(notificationKind("status.PICKUP_READY")).toBe("Pickup");
  expect(notificationKind("listing.approved", "listing")).toBe("System");
});
it("groups by the reader's local calendar day", () => {
  expect(notificationDay("2026-11-06T12:00:00Z", new Date("2026-11-06T18:00:00Z"))).toBe("Today");
  expect(notificationDay("2026-11-05T12:00:00Z", new Date("2026-11-06T18:00:00Z"))).toBe("Earlier");
});
