import { describe, expect, it } from "vitest";
import { deliveryEventLabel, deliveryEventSource, deliveryVisibility, deliveryStatusCopy, farmerDeliveryStatusCopy, providerTimestamp, safeTrackingUrl } from "./delivery-visibility.js";
const now = new Date("2026-11-06T12:00:00Z");
const event = (status: string, time = now.toISOString(), details?: unknown) => ({ id: `${status}:${time}`, status, createdAt: time, source: "shipbubble", details });
const base = { status: "BOOKED", providerShipmentId: "SB-one", courier: "Courier", createdAt: now.toISOString(), lastSyncedAt: now.toISOString() };
describe("shared delivery visibility", () => {
  it("distinguishes farmer handover, carrier pickup, transit and delivered goods", () => {
    const handover = deliveryVisibility({ ...base, events: [event("FARMER_DISPATCHED")] }, now);
    expect(handover.title).toBe("Farmer handed your goods to the courier");
    expect(handover.body).toContain("Waiting for the courier");
    expect(handover.milestones.find(m => m.status === "PICKED_UP")?.reported).toBe(false);
    for (const status of ["PICKED_UP", "IN_TRANSIT", "DELIVERED"]) {
      const view = deliveryVisibility({ ...base, status }, now);
      expect(view.label).toBe(deliveryStatusCopy(status).label);
      expect(view.receiptConfirmedAt).toBeNull();
      expect(view.liveTracking).toBe(false);
    }
  });
  it("does not invent missing rider details, location, ETA or milestone timestamps", () => {
    const view = deliveryVisibility({ ...base, status: "IN_TRANSIT" }, now);
    expect(view.assignments[0]?.rider).toBeNull();
    expect(view.milestones.map(m => m.recordedAt)).toEqual([null, null, null, null]);
    expect(view).not.toHaveProperty("latitude");
    expect(view).not.toHaveProperty("eta");
  });
  it("shows only current, shipment-scoped courier and rider contacts and clears removed assignments", () => {
    const events = [
      event("PROVIDER_CONTACT_UPDATED", "2026-11-06T09:00:00Z", { providerShipmentId: "other", rider: { name: "Wrong rider" } }),
      event("PROVIDER_CONTACT_UPDATED", "2026-11-06T10:00:00Z", { providerShipmentId: "SB-one", rider: { name: "Ada", phone: "+2348012345678" }, courier: { name: "Courier", phone: "08000000000" } }),
    ];
    expect(deliveryVisibility({ ...base, events }, now).assignments[0]).toMatchObject({ rider: { name: "Ada", phone: "+2348012345678" } });
    events.push(event("PROVIDER_CONTACT_UPDATED", "2026-11-06T11:00:00Z", { providerShipmentId: "SB-one", rider: null }));
    expect(deliveryVisibility({ ...base, events }, now).assignments[0]?.rider).toBeNull();
  });
  it("keeps provider timestamps separate from app recording time without guessing a time zone", () => {
    expect(providerTimestamp("2026-11-06 10:00:00")).toEqual({ raw: "2026-11-06 10:00:00", at: null });
    expect(providerTimestamp("2026-11-06T10:00:00+01:00").at).toBe("2026-11-06T09:00:00.000Z");
    const view = deliveryVisibility({ ...base, events: [event("PROVIDER_UPDATE", now.toISOString(), {
      providerShipmentId: "SB-one", providerStatus: "Picked Up", normalizedStatus: "PICKED_UP", providerTime: "2026-11-06 10:00:00",
    })] }, now);
    expect(view.timeline[0]).toMatchObject({ status: "PICKED_UP", providerTime: "2026-11-06 10:00:00", occurredAt: null, recordedAt: now.toISOString() });
  });
  it("separates stale tracking from possible delivery delay and respects future pickup dates", () => {
    const stale = deliveryVisibility({ ...base, lastSyncedAt: "2026-11-06T10:00:00Z" }, now);
    expect(stale.warnings.map(w => w.code)).toEqual(["TRACKING_STALE"]);
    const old = { ...base, createdAt: "2026-11-04T10:00:00Z", package: { pickupDate: "2026-11-07" } };
    expect(deliveryVisibility(old, now).warnings).toEqual([]);
    expect(deliveryVisibility({ ...old, package: { pickupDate: "2026-11-05" } }, now).warnings.map(w => w.code)).toEqual(["POSSIBLE_DELAY"]);
    expect(deliveryVisibility({ ...old, status: "IN_TRANSIT" }, now).warnings.map(w => w.code)).toEqual(["POSSIBLE_DELAY"]);
    expect(deliveryVisibility({ ...old, status: "DELIVERED" }, now).warnings).toEqual([]);
    expect(deliveryVisibility({ ...old, orderStatus: "REFUNDED" }, now).warnings).toEqual([]);
  });
  it("does not claim full split delivery from a stale parent or hide a failed package", () => {
    const parcels = [0, 1].map(parcelIndex => ({ id: String(parcelIndex), parcelIndex, status: parcelIndex ? "FAILED_ATTEMPT" : "DELIVERED", quoteId: "q", providerShipmentId: `SB-${parcelIndex}` }));
    const view = deliveryVisibility({ ...base, status: "DELIVERED", providerShipmentId: "split:d", selectedQuoteId: "q", package: { packageCount: 2 }, parcels }, now);
    expect(view.label).toBe("Delivery completion needs review");
    expect(view.deliveredPackages).toBe(1);
    expect(view.milestones.find(m => m.status === "DELIVERED")?.reported).toBe(false);
    expect(view.warnings.map(w => w.code)).toContain("PARCEL_REVIEW");
    for (const invalid of [[], [parcels[0]!], [parcels[0]!, { ...parcels[1]!, status: "DELIVERED", quoteId: "old" }]])
      expect(deliveryVisibility({ ...base, status: "DELIVERED", providerShipmentId: "split:d", selectedQuoteId: "q", package: { packageCount: 2 }, parcels: invalid }, now).label).toBe("Delivery completion needs review");
    expect(deliveryVisibility({ ...base, status: "DELIVERED", providerShipmentId: "split:d", selectedQuoteId: "q", package: { packageCount: 2 }, parcels: parcels.map(p => ({ ...p, status: "DELIVERED" })) }, now).label).toBe("Delivered");
  });
  it("accepts only valid HTTPS tracking links without embedded credentials", () => {
    for (const url of ["http://example.test", "javascript:alert(1)", "https://", "https://user:secret@example.test", "https:// example.test"])
      expect(safeTrackingUrl(url)).toBeNull();
    expect(safeTrackingUrl("https://example.test/track")).toBe("https://example.test/track");
  });
  it("uses the actual farmer decision and handover event names and their recorded source", () => {
    expect(deliveryEventLabel("ORDER_ACCEPTED")).toBe("Farmer accepted the order");
    expect(deliveryEventLabel("ORDER_REJECTED")).toBe("Farmer declined the order");
    expect(deliveryEventLabel("BUYER_COLLECTED")).toBe("Farmer handed goods to buyer");
    expect(deliveryEventSource("farmer")).toBe("Farmer");
    expect(deliveryEventSource("buyer")).toBe("Buyer");
    expect(deliveryEventSource("admin")).toBe("Staff");
  });
  it("does not hide failure or return guidance after farmer handover", () => {
    for (const status of ["FAILED_ATTEMPT", "RETURNING", "RETURNED", "CANCELLED"])
      expect(farmerDeliveryStatusCopy(status, true).body).toBe(deliveryStatusCopy(status).body);
  });
  it("preserves manual tracking references as text and uses assignment timestamps without inventing rider data", () => {
    const view = deliveryVisibility({ status: "MANUAL_ASSIGNED", courier: "Local carrier", trackingRef: " LOCAL-123 ",
      events: [event("MANUAL_ASSIGNED", "2026-11-06T10:00:00Z")], receiptSource: "legacy-staff" }, now);
    expect(view).toMatchObject({ provider: "Manual dispatch", trackingRef: "LOCAL-123", liveTracking: false, receiptSource: "legacy-staff" });
    expect(view.assignments[0]).toMatchObject({ trackingRef: "LOCAL-123", providerShipmentId: null, rider: null, trackingUrl: null });
    expect(view.milestones[0]).toMatchObject({ label: "Courier assigned", reported: true, recordedAt: "2026-11-06T10:00:00.000Z" });
    expect(deliveryVisibility({ status: "IN_TRANSIT", courier: "Local carrier", trackingRef: "LOCAL-123", selectedQuoteId: "old-quote" }, now).provider).toBe("Manual dispatch");
    expect(deliveryVisibility({ ...base, selectedQuoteId: "q", providerShipmentId: null, status: "PAID" }, now).provider).toBe("Shipbubble");
  });
  it("keeps completed buyer receipt separate from courier delivery and stops asking for repeat confirmation", () => {
    const view = deliveryVisibility({ ...base, status: "DELIVERED", receiptConfirmedAt: now }, now);
    expect(view.label).toBe("Delivered");
    expect(view.receiptConfirmedAt).toBe(now.toISOString());
    expect(view.body).toContain("Receipt confirmation is recorded");
    expect(view.body).not.toContain("then confirm");
  });
  it("does not turn a contact change or historical provider backfill into recent delivery progress", () => {
    const view = deliveryVisibility({ ...base, status: "IN_TRANSIT", createdAt: "2026-11-03T10:00:00Z", events: [
      event("IN_TRANSIT", "2026-11-04T10:00:00Z"),
      event("PROVIDER_CONTACT_UPDATED"),
      event("PROVIDER_UPDATE", now.toISOString(), { normalizedStatus: "PICKED_UP", providerTime: "2026-11-03T10:00:00Z" }),
    ] }, now);
    expect(view.lastProgressAt).toBe("2026-11-04T10:00:00.000Z");
    expect(view.warnings.map(w => w.code)).toContain("POSSIBLE_DELAY");
  });
});

it("identifies administrative closure without treating it as provider or buyer confirmation", () => {
  const view = deliveryVisibility({ ...base, status: "DELIVERED", failureCode: "TRACKING_UNAVAILABLE", events: [{ ...event("ADMIN_RESOLVED", now.toISOString(), { outcome: "COMPLETED" }), source: "admin" }] }, now);
  expect(view.label).toBe("Completed by administrator");
  expect(view.receiptConfirmedAt).toBeNull();
  expect(view.milestones.find(step => step.status === "DELIVERED")?.reported).toBe(false);
  expect(view.warnings).toEqual([]);
});

it("shows an open investigation after a previous closure and preserves courier evidence", () => {
  const view = deliveryVisibility({ ...base, status: "IN_TRANSIT", events: [
    { ...event("ADMIN_RESOLVED", "2026-11-05T12:00:00Z", { outcome: "CANCELLED" }), source: "admin" },
    { ...event("ADMIN_INVESTIGATION", now.toISOString(), { outcome: "UNDER_INVESTIGATION" }), source: "admin" },
  ] }, now);
  expect(view.label).toBe("Under investigation");
  expect(view.body).toContain("investigating");
  expect(view.status).toBe("IN_TRANSIT");
  expect(view.timeline.some(item => item.status === "ADMIN_RESOLVED")).toBe(true);
});
