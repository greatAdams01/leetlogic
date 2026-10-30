import { describe, it, expect } from "vitest";
import {
  spokenNumber,
  voiceCommand,
  interpretAnswer,
  commitAnswer,
  voiceFields,
  listingReadback,
  type VoiceCatalogue,
} from "./guided-listing";
import { emptyListing, listingDetailsError, listingPayload, restoreListing } from "./listing-form";
const catalogue: VoiceCatalogue = {
  categories: [
    {
      id: "roots",
      slug: "roots-tubers",
      translations: [{ locale: "en", name: "Roots & Tubers" }],
    },
  ],
  units: [
    { code: "PIECE", allowsDecimal: false },
    { code: "KG", allowsDecimal: true },
  ],
  addresses: [
    { id: "farm", line1: "Farm road", city: "Enugu", lga: "Enugu North", state: "Enugu" },
  ],
};
describe("English guided listing grammar", () => {
  it.each([
    ["twenty five", "25"],
    ["one hundred and five", "105"],
    ["two thousand five hundred", "2500"],
    ["one million two hundred thousand five", "1200005"],
    ["zero point five", "0.5"],
    ["twelve point zero five", "12.05"],
    ["1,000.50", "1000.50"],
    ["2500", "2500"],
  ])("parses %s exactly", (speech, expected) => expect(spokenNumber(speech)).toBe(expected));
  it.each([
    "one or two",
    "two bags",
    "one and two",
    "twenty thirty",
    "five five",
    "one hundred hundred",
    "1,5",
    "2/3",
    "one point twenty",
    "two million three million",
    "and five",
    "five and",
    "minus one",
    "1e3",
  ])("rejects ambiguous or invalid numeric answer %s", (speech) =>
    expect(spokenNumber(speech)).toBeNull(),
  );
  it("uses exact confirmation commands", () => {
    expect(voiceCommand("Yes.")).toBe("yes");
    expect(voiceCommand("yesterday")).toBeNull();
    expect(voiceCommand("no more than ten")).toBeNull();
    expect(voiceCommand("publish")).toBeNull();
  });
  it("requires a known category and a supported selling unit", () => {
    expect(interpretAnswer("categoryId", "yam", emptyListing, catalogue)).toBeNull();
    expect(interpretAnswer("categoryId", "one", emptyListing, catalogue)?.value).toBe("roots");
    expect(interpretAnswer("categoryId", "roots and tubers", emptyListing, catalogue)?.value).toBe(
      "roots",
    );
    expect(interpretAnswer("unitCode", "tubers", emptyListing, catalogue)?.value).toBe("PIECE");
    expect(interpretAnswer("unitCode", "bags", emptyListing, catalogue)).toBeNull();
  });
  it("rejects fractional pieces, excessive precision and implausible measurements", () => {
    const form = { ...emptyListing, unitCode: "PIECE" };
    expect(interpretAnswer("quantity", "one point five", form, catalogue)).toBeNull();
    expect(interpretAnswer("quantity", "twenty", form, catalogue)?.value).toBe("20");
    expect(interpretAnswer("price", "twelve point zero zero five", form, catalogue)).toBeNull();
    expect(interpretAnswer("length", "one thousand and one", form, catalogue)).toBeNull();
    expect(interpretAnswer("addressId", "two", form, catalogue)).toBeNull();
    expect(interpretAnswer("addressId", "one", form, catalogue)?.spoken).toContain("Farm road");
  });
  it("commits only the specified field and invalidates dependencies when units change", () => {
    const form = {
      ...emptyListing,
      title: "Yam",
      unitCode: "KG",
      quantity: "2",
      price: "150",
      packingAssistanceRequested: true,
    };
    expect(commitAnswer(form, "title", { value: "White yam", spoken: "White yam" })).toMatchObject({
      title: "White yam",
      quantity: "2",
      price: "150",
    });
    expect(commitAnswer(form, "unitCode", { value: "PIECE", spoken: "pieces" })).toMatchObject({
      title: "Yam",
      quantity: "",
      price: "",
      packingAssistanceRequested: false,
      packaging: { unitsPerPackage: "" },
    });
    expect(form.quantity).toBe("2");
  });
  it("supports an explicit packing-help path without dropping other requirements", () => {
    const answer = interpretAnswer("packing", "help", emptyListing, catalogue)!;
    const form = commitAnswer(
      {
        ...emptyListing,
        title: "Yam",
        description: "Fresh white yam",
        categoryId: "roots",
        unitCode: "PIECE",
        quantity: "20",
        price: "500",
        addressId: "farm",
        inputMethod: "voice",
      },
      "packing",
      answer,
    );
    expect(voiceFields(form)).not.toContain("weightKg");
    expect(listingDetailsError(form, catalogue.units)).toBe("");
    expect(listingDetailsError({ ...form, price: "" }, catalogue.units)).not.toBe("");
    expect(listingPayload(form, "ig")).toMatchObject({
      packingAssistanceRequested: true,
      sourceLocale: "en",
      unitPriceMinor: "50000",
    });
    expect(listingPayload(form, "en")).not.toHaveProperty("packaging");
    expect(
      restoreListing(JSON.parse(JSON.stringify({ ...form, voiceCursor: "price" }))),
    ).toMatchObject({
      inputMethod: "voice",
      voiceCursor: "price",
      packingAssistanceRequested: true,
    });
    expect(listingReadback(form, catalogue)).toContain("Only the submit button");
  });
});
