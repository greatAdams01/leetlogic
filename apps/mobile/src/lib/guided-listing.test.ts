import { describe, it, expect } from "vitest";
import {
  spokenNumber,
  voiceCommand,
  interpretAnswer,
  commitAnswer,
  voiceFields,
  listingReadback,
  firstIncompleteVoiceField,
  guidedListingForm,
  guidedProduceChoices,
  type VoiceCatalogue,
} from "./guided-listing";
import { emptyListing, listingDetailsError, listingPayload, restoreListing, type ListingForm } from "./listing-form";
const catalogue: VoiceCatalogue = {
  categories: [
    {
      id: "roots",
      slug: "roots-tubers",
      translations: [{ locale: "en", name: "Roots & Tubers" }],
    },
    { id: "grains", slug: "grains", translations: [{ locale: "en", name: "Grains" }] },
  ],
  units: [
    { code: "PIECE", allowsDecimal: false },
    { code: "KG", allowsDecimal: true },
    { code: "BAG", allowsDecimal: false },
  ],
  addresses: [
    { id: "farm", line1: "Farm road", city: "Enugu", lga: "Enugu North", state: "Enugu" },
  ],
  commissionBasisPoints: 600,
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
    expect(interpretAnswer("unitCode", "bags", emptyListing, catalogue)?.value).toBe("BAG");
  });
  it("carries the selected sale package into size capture, including custom sizes", () => {
    const base = { ...emptyListing, title: "Yam", categoryId: "roots" };
    const packageAnswer = interpretAnswer("salePackaging", "piece", base, catalogue)!;
    const selected = commitAnswer(base, "salePackaging", packageAnswer);
    expect(selected.salePackaging).toMatchObject({ type: "PIECE", size: 1, measure: "PIECE" });
    expect(interpretAnswer("salePackageSize", "one", selected, catalogue)?.spoken).toContain("per individual piece");
    const customAnswer = interpretAnswer("salePackaging", "custom", base, catalogue)!;
    const selectedCustom = commitAnswer(base, "salePackaging", customAnswer);
    const custom = commitAnswer(selectedCustom, "salePackageLabel", interpretAnswer("salePackageLabel", "Family tub", selectedCustom, catalogue)!);
    const measuredCustom = commitAnswer(custom, "salePackageMeasure", interpretAnswer("salePackageMeasure", "kilograms", custom, catalogue)!);
    const size = interpretAnswer("salePackageSize", "2.5", measuredCustom, catalogue)!;
    expect(commitAnswer(measuredCustom, "salePackageSize", size).salePackaging).toMatchObject({
      type: "CUSTOM",
      size: 2.5,
      measure: "KG",
      customLabel: "Family tub",
    });
    expect(interpretAnswer("salePackageSize", "2.5555", measuredCustom, catalogue)).toBeNull();
    expect(commitAnswer({ ...selected, quantity: "12", price: "500" }, "salePackageSize", interpretAnswer("salePackageSize", "one", selected, catalogue)!)).toMatchObject({
      quantity: "",
      price: "",
    });
  });
  it("understands package-aware Nigerian English without mixing stock, size, or price", () => {
    const rice = { ...emptyListing, title: "Rice", categoryId: "grains" };
    const bag = commitAnswer(rice, "salePackaging", interpretAnswer("salePackaging", "bag", rice, catalogue)!);
    expect(interpretAnswer("salePackageSize", "fifty kilograms per bag", bag, catalogue)?.value).toContain('"size":50');
    expect(interpretAnswer("salePackageSize", "each bag contains 50 kg", bag, catalogue)?.value).toContain('"size":50');
    expect(interpretAnswer("salePackageSize", "two and a half kilograms", bag, catalogue)?.value).toContain('"size":2.5');
    expect(interpretAnswer("salePackageSize", "half a tonne", bag, catalogue)?.value).toContain('"size":500');
    const priced = { ...bag, salePackaging: { type: "BAG" as const, size: 50, measure: "KG" as const }, unitCode: "BAG" };
    expect(interpretAnswer("quantity", "twenty bags", priced, catalogue)?.value).toBe("20");
    expect(interpretAnswer("price", "seventy-five thousand naira", priced, catalogue)?.value).toBe("75000");
    expect(interpretAnswer("price", "₦75,000 per bag", priced, catalogue)?.value).toBe("75000");
    expect(interpretAnswer("price", "₦75k per bag", priced, catalogue)?.value).toBe("75000");
    expect(interpretAnswer("quantity", "twenty baskets", priced, catalogue)).toBeNull();
  });
  it("resumes a custom package at its first missing detail instead of reasking its type", () => {
    let form: ListingForm = {
      ...emptyListing,
      title: "Rice",
      description: "Clean dry rice",
      categoryId: "grains",
      unitCode: "PIECE",
    };
    form = commitAnswer(form, "salePackaging", interpretAnswer("salePackaging", "custom", form, catalogue)!);
    expect(firstIncompleteVoiceField(form, catalogue)).toBe("salePackageLabel");
    form = commitAnswer(form, "salePackageLabel", interpretAnswer("salePackageLabel", "Family tub", form, catalogue)!);
    form = { ...form, voiceCursor: "salePackageMeasure" };
    expect(firstIncompleteVoiceField(form, catalogue)).toBe("salePackageMeasure");
    form = commitAnswer(form, "salePackageMeasure", interpretAnswer("salePackageMeasure", "kilograms", form, catalogue)!);
    form = { ...form, voiceCursor: "salePackageSize" };
    expect(firstIncompleteVoiceField(form, catalogue)).toBe("salePackageSize");
    const size = interpretAnswer("salePackageSize", "two and a half kilograms", form, catalogue)!;
    form = commitAnswer(form, "salePackageSize", size);
    expect(firstIncompleteVoiceField(form, catalogue)).toBe("quantity");
    expect(form.salePackaging).toMatchObject({ type: "CUSTOM", customLabel: "Family tub", size: 2.5, measure: "KG" });
  });
  it("produces the same canonical rice listing from voice and typed inputs", () => {
    const categoryCatalogue = { ...catalogue, commissionBasisPoints: 600 };
    let voice = emptyListing;
    const answer = (field: Parameters<typeof interpretAnswer>[0], raw: string) => {
      const parsed = interpretAnswer(field, raw, voice, categoryCatalogue);
      expect(parsed).not.toBeNull();
      voice = commitAnswer(voice, field, parsed!);
    };
    answer("title", "Rice");
    answer("categoryId", "Grains");
    answer("description", "Clean dry rice in 50 kg bags");
    answer("salePackaging", "Bag");
    answer("salePackageSize", "fifty kilograms per bag");
    answer("quantity", "twenty bags");
    answer("price", "₦75,000 per bag");
    answer("addressId", "one");
    answer("shippingScope", "nationwide");
    answer("packing", "help");
    voice = { ...voice, inputMethod: "voice" };
    const typed = {
      ...voice,
      inputMethod: "type" as const,
      title: "Rice",
      categoryId: "grains",
      description: "Clean dry rice in 50 kg bags",
      salePackaging: { type: "BAG" as const, size: 50, measure: "KG" as const },
      unitCode: "BAG",
      quantity: "20",
      price: "75000",
      addressId: "farm",
      shippingScope: "NATIONWIDE" as const,
      packingAssistanceRequested: true,
    };
    expect(voice.salePackaging).toEqual(typed.salePackaging);
    expect(firstIncompleteVoiceField(voice, categoryCatalogue)).toBeNull();
    expect(listingDetailsError(voice, categoryCatalogue.units, "grains")).toBe("");
    const { inputMethod: voiceMethod, ...voicePayload } = listingPayload(voice, "en");
    const { inputMethod: typedMethod, ...typedPayload } = listingPayload(typed, "en");
    expect(voiceMethod).toBe("voice");
    expect(typedMethod).toBe("type");
    expect(voicePayload).toEqual(typedPayload);
    expect(listingReadback(voice, categoryCatalogue)).toContain("Total produce stock: 1,000 kilograms");
    expect(listingReadback(voice, categoryCatalogue)).toContain("Gross stock value before commission: ₦1,500,000.00");
    expect(listingReadback(voice, categoryCatalogue)).toContain("₦4,500.00 (6%)");
    expect(listingReadback(voice, categoryCatalogue)).toContain("₦70,500.00");
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
      quantity: "",
      price: "",
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
    expect(listingReadback({ ...form, price: "1500" }, catalogue)).toContain("₦90.00 (6%)");
    expect(listingReadback({ ...form, price: "1500" }, catalogue)).toContain("₦1,410.00");
  });
});

describe("guided listing assistance", () => {
  it("uses staff measurements without inventing selling size, quantity or price", () => {
    const draft = guidedListingForm(emptyListing, catalogue);
    expect(draft).toMatchObject({ packingAssistanceRequested: true, addressId: "farm", quantity: "", price: "" });
    expect(draft.salePackaging).toBeUndefined();
    expect(listingDetailsError(draft, catalogue.units, "grains")).not.toBe("");
    expect(emptyListing.packingAssistanceRequested).toBeUndefined();
  });
  it("does not choose between several saved farms", () => {
    expect(guidedListingForm(emptyListing, { ...catalogue, addresses: [...catalogue.addresses, { ...catalogue.addresses[0]!, id: "other" }] }).addressId).toBe("");
  });
  it("preserves complete measured packaging from an existing draft", () => {
    const form = { ...emptyListing, unitCode: "BAG", salePackaging: { type: "BAG" as const, size: 50, measure: "KG" as const }, packaging: { ...emptyListing.packaging!, unitsPerPackage: "1", weightKg: "51", length: "80", width: "50", height: "25" } };
    const draft = guidedListingForm(form, catalogue);
    expect(draft.packaging).toEqual(form.packaging);
    expect(draft.packingAssistanceRequested).toBe(false);
  });
  it("only offers produce with a live matching category", () => {
    expect(guidedProduceChoices(catalogue)).toContainEqual({ title: "Rice", categoryId: "grains" });
    expect(guidedProduceChoices({ ...catalogue, categories: [] })).toEqual([]);
  });
});
