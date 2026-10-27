import { describe, expect, it } from "vitest";
import { estimatedHours, rankDeliveryQuotes } from "./delivery-ranking.js";
const future = new Date(Date.now() + 600000);
const quote = (id: string, amountMinor: bigint, eta: string | null) => ({
  id,
  courierId: id,
  courier: id,
  amountMinor,
  eta,
  expiresAt: future,
});
describe("courier value ranking", () => {
  it("recommends the cheaper faster real quote regardless of provider or storage order", () => {
    const expensive = quote("Richard Express", 1125000n, "Within 1 - 4 working days");
    const value = quote("Bubble Express", 695000n, "Within 25 hrs");
    for (const input of [
      [expensive, value],
      [value, expensive],
    ]) {
      const ranked = rankDeliveryQuotes(input);
      expect(ranked[0]).toMatchObject({ id: value.id, recommended: true });
      expect(ranked[1]?.recommended).toBe(false);
    }
  });
  it("can prefer a substantially faster option with a small price premium", () => {
    expect(
      rankDeliveryQuotes([quote("slow", 10000n, "4 days"), quote("fast", 11000n, "12 hours")])[0]
        ?.id,
    ).toBe("fast");
  });
  it("never recommends expired or unavailable quotes", () => {
    const expired = { ...quote("expired", 1n, "1 hour"), expiresAt: new Date(0) };
    const unavailable = { ...quote("unavailable", 1n, "1 hour"), courierId: null };
    expect(rankDeliveryQuotes([expired, unavailable]).every((q) => !q.recommended)).toBe(true);
    expect(rankDeliveryQuotes([expired, quote("valid", 100n, "2 days")])[0]?.id).toBe("valid");
  });
  it("handles unknown estimates without inventing speed or ratings", () => {
    expect(estimatedHours("Confirmed after booking")).toBeNull();
    expect(
      rankDeliveryQuotes([quote("unknown", 100n, null), quote("known", 100n, "24 hours")])[0]?.id,
    ).toBe("known");
  });
  it("requires an actual service-quality advantage to recommend a costlier slower courier", () => {
    const cheap = {
      ...quote("cheap", 10000n, "24 hours"),
      quality: { rating: 1, votes: 1000, trackingLevel: 2 },
    };
    const quality = {
      ...quote("quality", 10500n, "25 hours"),
      quality: { rating: 5, votes: 1000, trackingLevel: 10 },
    };
    const ranked = rankDeliveryQuotes([cheap, quality]);
    expect(ranked[0]?.id).toBe("quality");
    expect(ranked[0]?.recommendationReason).toContain("Higher provider-rated service quality");
    expect(
      rankDeliveryQuotes([
        { ...cheap, quality: null },
        { ...quality, quality: null },
      ])[0]?.id,
    ).toBe("cheap");
  });
  it("does not let a single rating outweigh a much cheaper faster quote", () => {
    const cheap = {
      ...quote("cheap", 695000n, "25 hrs"),
      quality: { rating: 3, votes: 10, trackingLevel: 7 },
    };
    const expensive = {
      ...quote("expensive", 1125000n, "4 days"),
      quality: { rating: 5, votes: 1, trackingLevel: 10 },
    };
    expect(rankDeliveryQuotes([expensive, cheap])[0]?.id).toBe("cheap");
  });
  it("uses the upper bound of hour and working-day ranges", () => {
    expect(estimatedHours("Within 25 hrs")).toBe(25);
    expect(estimatedHours("Within 1 - 4 working days")).toBe(96);
    expect(estimatedHours("24 hours")).toBe(24);
  });
});
