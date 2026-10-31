import { expect, it } from "vitest";
import { combineParcelRates, splitParts, type ShippingRate } from "./shipbubble.js";
const rate = (token: string, amount: bigint, courier = "van"): ShippingRate => ({
  requestToken: token,
  courierId: courier,
  serviceCode: courier,
  courier,
  amountMinor: amount,
  walletMinor: amount,
  eta: "1 day",
});
it("sums every real parcel fee and retains only services offered for the complete shipment", () => {
  const result = combineParcelRates([
    [rate("one", 12345n), rate("bike", 100n, "bike")],
    [rate("two", 19999n)],
  ]);
  expect(result).toHaveLength(1);
  expect(result[0]!.amountMinor).toBe(32344n);
  expect(splitParts(result[0]!.requestToken)).toEqual([
    expect.objectContaining({ requestToken: "one", amountMinor: "12345" }),
    expect.objectContaining({ requestToken: "two", amountMinor: "19999" }),
  ]);
  expect(combineParcelRates([[rate("one", 1n)], []])).toEqual([]);
});
it("leaves ordinary provider tokens untouched and validates stored split plans", () => {
  expect(splitParts("ordinary-token")).toBeNull();
  expect(() => splitParts('split:[{"requestToken":"bad"}]')).toThrow();
});
