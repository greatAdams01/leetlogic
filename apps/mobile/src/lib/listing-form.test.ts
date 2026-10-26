import { describe, expect, it } from "vitest";
import {
  emptyListing,
  listingDetailsError,
  listingPayload,
  moveCover,
  restoreListing,
} from "./listing-form";
const units = [
  { code: "KG", allowsDecimal: true },
  { code: "BASKET", allowsDecimal: false },
];
const valid = {
  ...emptyListing,
  packaging: {
    unitsPerPackage: "1",
    weightKg: "2",
    length: "30",
    width: "20",
    height: "20",
    handling: "STANDARD" as const,
    notes: "",
  },
  title: "Fresh tomatoes",
  description: "Freshly harvested",
  categoryId: "tomatoes",
  unitCode: "KG",
  quantity: "1.250",
  price: "12.34",
  addressId: "farm",
  photos: [{ id: "one", uri: "file:///private/photo.jpg" }],
};
describe("listing drafts", () => {
  it("recovers legacy drafts and exact saved minor amounts", () => {
    expect(restoreListing({ photoId: "old", unitPriceMinor: "999999999999" })).toMatchObject({
      price: "9999999999.99",
      photos: [{ id: "old" }],
    });
    expect(
      restoreListing({ photoIds: ["a", "a", "b", "c", "d", "e"] }).photos.map((p) => p.id),
    ).toEqual(["a", "b", "c", "d"]);
  });
  it("does not allow ambiguous quantities, missing required fields or fractional packs", () => {
    expect(listingDetailsError(valid, units)).toBe("");
    for (const form of [
      { ...valid, title: "" },
      { ...valid, description: " " },
      { ...valid, quantity: "1,000" },
      { ...valid, quantity: "1.2345" },
      { ...valid, unitCode: "BASKET" },
      { ...valid, addressId: "" },
      { ...valid, price: "0" },
      { ...valid, unitCode: "UNKNOWN" },
    ])
      expect(listingDetailsError(form, units)).not.toBe("");
    expect(listingDetailsError({ ...valid, unitCode: "BASKET", quantity: "2" }, units)).toBe("");
  });
  it("sends exact money, scope and ordered photo references without private local URIs", () => {
    const payload = listingPayload({ ...valid, shippingScope: "LOCAL" }, "ig");
    expect(payload).toMatchObject({
      unitPriceMinor: "1234",
      quantity: "1.250",
      shippingScope: "LOCAL",
      sourceLocale: "ig",
      photoId: "one",
      photoIds: ["one"],
    });
    expect(JSON.stringify(payload)).not.toContain("file://");
  });
  it("makes a selected cover first without losing or duplicating photos", () => {
    const photos = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(moveCover(photos, "c")).toEqual([{ id: "c" }, { id: "a" }, { id: "b" }]);
    expect(moveCover(photos, "missing")).toBe(photos);
    expect(photos[0]?.id).toBe("a");
  });
});
