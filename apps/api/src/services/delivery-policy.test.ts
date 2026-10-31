import { describe, expect, it } from "vitest";
import {
  canAdvanceDelivery,
  deliveryReceiptReady,
  deliveryRefundReady,
  normalizeDeliveryStatus,
} from "./delivery-policy.js";
import { protectTokens } from "./translation.js";
import { imageType } from "../routes/produce-photos.js";
describe("delivery state reconciliation", () => {
  it("maps carrier statuses and ignores unknown statuses", () => {
    expect(normalizeDeliveryStatus("completed")).toBe("DELIVERED");
    expect(normalizeDeliveryStatus("picked_up")).toBe("PICKED_UP");
    expect(normalizeDeliveryStatus("unrecognized")).toBeUndefined();
  });
  it("rejects delayed regressions and allows retry and return progress", () => {
    expect(canAdvanceDelivery("IN_TRANSIT", "PICKED_UP")).toBe(false);
    expect(canAdvanceDelivery("DELIVERED", "IN_TRANSIT")).toBe(false);
    expect(canAdvanceDelivery("FAILED_ATTEMPT", "IN_TRANSIT")).toBe(true);
    expect(canAdvanceDelivery("DELIVERED", "RETURNING")).toBe(true);
    expect(canAdvanceDelivery("RETURNED", "IN_TRANSIT")).toBe(false);
  });
});
describe("complete-shipment settlement policy", () => {
  const split = (statuses = ["DELIVERED", "DELIVERED"]) => ({
    status: "DELIVERED",
    selectedQuoteId: "quote",
    providerShipmentId: "split:delivery",
    bookingStartedAt: new Date(),
    package: { packageCount: 2 },
    parcels: statuses.map((status, parcelIndex) => ({
      parcelIndex,
      quoteId: "quote",
      providerShipmentId: `SB-${parcelIndex}`,
      status,
    })),
  });
  it("requires every parcel to arrive, not just a delivered parent", () => {
    expect(deliveryReceiptReady(split())).toBe(true);
    for (const status of ["BOOKED", "IN_TRANSIT", "CANCELLED", "RETURNED"])
      expect(deliveryReceiptReady(split(["DELIVERED", status]))).toBe(false);
    expect(deliveryReceiptReady({ ...split(), status: "IN_TRANSIT" })).toBe(false);
    expect(deliveryReceiptReady(null)).toBe(false);
  });
  it("rejects incomplete, duplicate, out-of-range, or wrong-quote receipt plans", () => {
    const delivery = split();
    for (const parcels of [
      [],
      delivery.parcels.slice(0, 1),
      [...delivery.parcels, delivery.parcels[0]!],
      delivery.parcels.map((parcel) => ({ ...parcel, parcelIndex: 0 })),
      delivery.parcels.map((parcel) => ({ ...parcel, parcelIndex: parcel.parcelIndex + 1 })),
      delivery.parcels.map((parcel) => ({ ...parcel, quoteId: "old-quote" })),
      delivery.parcels.map((parcel) => ({ ...parcel, providerShipmentId: null })),
    ]) expect(deliveryReceiptReady({ ...delivery, parcels })).toBe(false);
    expect(deliveryReceiptReady({ ...delivery, selectedQuoteId: null })).toBe(false);
    expect(deliveryReceiptReady({ ...delivery, package: { packageCount: 3 } })).toBe(false);
  });
  it("preserves pickup and historical manual receipt without inventing parcel bookings", () => {
    const manual = { ...split(), providerShipmentId: null, selectedQuoteId: null, parcels: [] };
    expect(deliveryReceiptReady(manual)).toBe(true);
    expect(deliveryReceiptReady({ ...manual, status: "PICKUP_READY" })).toBe(true);
    expect(deliveryReceiptReady({ ...manual, status: "MANUAL_REVIEW" })).toBe(false);
    expect(deliveryReceiptReady({ ...manual, providerShipmentId: "SB-single" })).toBe(false);
    expect(deliveryReceiptReady({ ...manual, providerShipmentId: "SB-single", package: { packageCount: 1 } })).toBe(true);
  });
  it("allows a refund only after all recorded parcels are cancelled or returned", () => {
    expect(deliveryRefundReady({ ...split(["CANCELLED", "RETURNED"]), status: "RETURNED" })).toBe(true);
    expect(deliveryRefundReady({ ...split(["CANCELLED", "CANCELLED"]), status: "CANCELLED" })).toBe(true);
    for (const status of ["BOOKED", "IN_TRANSIT", "DELIVERED", "BOOKING_UNCERTAIN"])
      expect(deliveryRefundReady({ ...split(["CANCELLED", status]), status: "CANCELLED" })).toBe(false);
    expect(deliveryRefundReady({ ...split(), status: "CANCELLED", parcels: [] })).toBe(false);
    expect(deliveryRefundReady({ ...split(["CANCELLED", "CANCELLED"]), status: "CANCELLED", selectedQuoteId: "other" })).toBe(false);
  });
  it("does not treat a blocked or uncertain booking as proof that no label was purchased", () => {
    const unstarted = { ...split(), status: "BOOKING_BLOCKED", bookingStartedAt: null, providerShipmentId: null, parcels: [] };
    expect(deliveryRefundReady(unstarted)).toBe(true);
    expect(deliveryRefundReady({ ...unstarted, bookingStartedAt: new Date() })).toBe(false);
    expect(deliveryRefundReady({ ...unstarted, providerShipmentId: "SB-known" })).toBe(false);
    expect(deliveryRefundReady({ ...unstarted, parcels: split().parcels })).toBe(false);
    expect(deliveryRefundReady({ ...unstarted, status: "BOOKING_UNCERTAIN" })).toBe(false);
    expect(deliveryRefundReady(null)).toBe(true);
  });
});
describe("translation invariants", () => {
  it("preserves numeric amounts, placeholders and references", () => {
    const input = "{{name}} bought 20 kg for ₦2,000.50; order LL-ABC123";
    const p = protectTokens(input);
    expect(p.restore(p.text)).toBe(input);
    expect(() => p.restore(p.text.replace("LLTOKEN0X", "changed"))).toThrow();
  });
});
describe("produce photo upload", () => {
  it("rejects files with false image types", () => {
    expect(imageType(Buffer.from("<script>alert(1)</script>"))).toBeNull();
    expect(imageType(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe("image/png");
    expect(imageType(Buffer.from([255, 216, 255, 224]))).toBe("image/jpeg");
  });
});
