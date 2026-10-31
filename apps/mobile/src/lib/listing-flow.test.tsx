import React from "react";
import { emptyListing } from "./listing-form";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  api: vi.fn(),
  choose: vi.fn(),
  photoBody: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
  go: vi.fn(),
  reset: vi.fn(),
  route: {} as { id?: string },
  draft: {} as any,
  catalogue: {
    categories: [
      { id: "tomatoes", slug: "vegetables", translations: [{ locale: "en", name: "Vegetables" }] },
    ],
    units: [{ code: "KG", allowsDecimal: true }],
    addresses: [
      {
        id: "farm",
        line1: "Farm road",
        city: "Ibadan",
        state: "Oyo",
        lga: "Ibadan",
        isDefaultFarm: true,
      },
    ],
    verificationStatus: "APPROVED",
  },
}));
vi.mock("react-native", () => ({
  View: "View",
  Pressable: "Pressable",
  Image: "Image",
  StyleSheet: { create: (s: unknown) => s, absoluteFill: {} },
  BackHandler: { addEventListener: () => ({ remove: vi.fn() }) },
}));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem: h.get, setItem: h.set, removeItem: h.remove },
}));
vi.mock("./produce-photo", () => ({ choosePhoto: h.choose, photoBody: h.photoBody }));
vi.mock("../state", () => ({
  useApp: () => ({
    user: {
      id: "seller",
      farmerProfile: { verificationStatus: "APPROVED" },
      addresses: h.catalogue.addresses,
    },
    route: h.route,
    locale: "en",
    go: h.go,
    reset: h.reset,
    ui: (text: string, params: Record<string, string | number> = {}) =>
      text.replace(/\{(\w+)\}/g, (_, key) => String(params[key])),
    unit: (v: string) => v,
    status: (v: string) => v,
    t: () => "Confirm all fields",
    error: (e: Error) => e.message,
  }),
  useResource: (path: string) => ({
    data: path.includes("catalogue") ? h.catalogue : h.draft,
    loading: false,
    error: "",
  }),
}));
vi.mock("./api", () => ({ api: h.api, API_URL: "http://localhost:3000", authHeaders: () => ({}) }));
vi.mock("./listing-art", () => ({ listingCategories: { vegetables: "Vegetables" } }));
vi.mock("../localization", () => ({ LocalizedText: "Text" }));
vi.mock("../screens/market", () => ({ ListingPhoto: "ListingPhoto" }));
vi.mock("../components/seller-listing-controls", () => ({ ListingControls: "ListingControls" }));
vi.mock("../components/guided-listing", () => ({
  GuidedListing: "GuidedListing",
  ReadListingAloud: "ReadListingAloud",
}));
vi.mock("../components/Select", () => ({ Select: "Select" }));
vi.mock("../components/feedback", () => ({ Confirmation: "Confirmation" }));
vi.mock("../components/app-sheet", async () => {
  const { createElement } = await import("react");
  return {
    AppSheet: ({ visible, children, footer, ...props }: any) =>
      visible ? createElement("AppSheet", props, children, footer) : null,
  };
});
vi.mock("../components/listing-layout", async () => {
  const { createElement } = await import("react");
  return {
    ListingPage: ({ children, footer, ...props }: any) =>
      createElement("ListingPage", props, children, footer),
    ListingProgress: "ListingProgress",
  };
});
vi.mock("../components/ui", async () => {
  const { createElement } = await import("react");
  const host =
    (name: string) =>
    ({ children, ...props }: any) =>
      createElement(name, props, children);
  return {
    ...Object.fromEntries(
      ["Page", "Heading", "Label", "Field", "Button", "Card", "Icon", "Notice"].map((n) => [
        n,
        host(n),
      ]),
    ),
    s: {},
    colors: {},
  };
});
import { Sell, Review } from "../screens/sell";
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let renderer: ReactTestRenderer;
const nodes = (type: string) => renderer.root.findAllByType(type as never);
const button = (title: string) => nodes("Button").find((n) => n.props.title === title)!;
const valid = {
  packaging: {
    unitsPerPackage: "1",
    weightKg: "2",
    length: "30",
    width: "20",
    height: "20",
    handling: "STANDARD" as const,
    notes: "",
  },
  title: "Tomatoes",
  description: "Fresh harvest",
  categoryId: "tomatoes",
  unitCode: "KG",
  quantity: "2",
  unitPriceMinor: "1234",
  addressId: "farm",
  photoIds: ["photo"],
  shippingScope: "LOCAL",
};
beforeEach(() => {
  vi.clearAllMocks();
  h.route = {};
  h.get.mockResolvedValue(null);
  h.set.mockResolvedValue(undefined);
  h.remove.mockResolvedValue(undefined);
  h.api.mockResolvedValue({ id: "draft" });
  h.draft = { id: "draft", fields: valid, listingId: null };
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
});
describe("seller listing wizard", () => {
  it("restores an untouched draft to the method chooser and returns there from categories", async () => {
    h.get.mockResolvedValue(JSON.stringify({ ...emptyListing, step: 1 }));
    await act(async () => {
      renderer = create(<Sell />);
    });
    expect(nodes("ListingPage")[0]!.props.choosingMethod).toBe(true);
    expect(
      nodes("Pressable").filter((node) => node.props.accessibilityRole === "radio"),
    ).toHaveLength(0);
    await act(async () => button("Type my listing").props.onPress());
    expect(nodes("ListingPage")[0]!.props.choosingMethod).toBe(false);
    await act(async () => nodes("ListingPage")[0]!.props.onBack());
    expect(nodes("ListingPage")[0]!.props.choosingMethod).toBe(true);
    await act(async () => button("Use guided voice · English").props.onPress());
    expect(nodes("GuidedListing")[0]!.props.visible).toBe(true);
  });
  it("separates details, packaging and photos and keeps the selling basis explicit", async () => {
    await act(async () => {
      renderer = create(<Sell />);
    });
    expect(nodes("Field")).toHaveLength(0);
    expect(nodes("Button").some((node) => node.props.title === "Continue")).toBe(false);
    await act(async () => button("Type my listing").props.onPress());
    await act(async () =>
      nodes("Pressable")
        .find((node) => node.props.accessibilityRole === "radio")!
        .props.onPress(),
    );
    await act(async () => button("Continue").props.onPress());
    expect(nodes("ListingPage")[0]!.props.step).toBe(2);
    expect(nodes("Field").some((node) => node.props.label === "Units in one package *")).toBe(
      false,
    );
    await act(async () => button("Continue to packaging").props.onPress());
    expect(nodes("ListingPage")[0]!.props.step).toBe(2);
    for (const [label, value] of [
      ["Product title *", "My tomatoes"],
      ["Description *", "Fresh produce"],
    ]) {
      await act(async () =>
        nodes("Field")
          .find((node) => node.props.label === label)!
          .props.onChangeText(value),
      );
    }
    await act(async () => button("Continue to packaging").props.onPress());
    expect(nodes("ListingPage")[0]!.props.step).toBe(3);
    await act(async () =>
      nodes("Select")
        .find((node) => node.props.label === "Packaging type *")!
        .props.onChange("KG"),
    );
    for (const [label, value] of [
      ["Available quantity (kg) *", "2"],
      ["Price per kg · NGN *", "123"],
      ["Additional packaging weight (kg) *", "1"],
      ["Package length (cm) *", "30"],
      ["Package width (cm) *", "20"],
      ["Package height (cm) *", "20"],
    ]) {
      await act(async () =>
        nodes("Field")
          .find((node) => node.props.label === label)!
          .props.onChangeText(value),
      );
    }
    await act(async () => button("Continue to photos").props.onPress());
    expect(nodes("ListingPage")[0]!.props.step).toBe(4);
    expect(button("Review listing").props.disabled).toBe(true);
    await act(async () => nodes("ListingPage")[0]!.props.onBack());
    expect(nodes("ListingPage")[0]!.props.step).toBe(3);
    await act(async () => nodes("ListingPage")[0]!.props.onBack());
    expect(nodes("Field").find((node) => node.props.label === "Product title *")!.props.value).toBe(
      "My tomatoes",
    );
  });
  it("recovers a device draft and saves only ordered references to the server before review", async () => {
    h.get.mockResolvedValue(
      JSON.stringify({
        ...valid,
        price: "12.34",
        photos: [{ id: "photo", uri: "file:///private/photo.jpg" }],
        step: 3,
      }),
    );
    await act(async () => {
      renderer = create(<Sell />);
    });
    await act(async () => button("Review listing").props.onPress());
    expect(h.api).toHaveBeenCalledWith(
      "/listing-drafts",
      expect.objectContaining({
        method: "POST",
        body: expect.objectContaining({
          unitPriceMinor: "1234",
          photoIds: ["photo"],
          shippingScope: "LOCAL",
        }),
      }),
    );
    expect(JSON.stringify(h.api.mock.calls)).not.toContain("file://");
    expect(h.go).toHaveBeenCalledWith("review", "draft");
  });
  it("prices a selected bag, resets the old basis after size/category changes and saves commercial packaging during assistance", async () => {
    const categories = h.catalogue.categories,
      units = h.catalogue.units;
    h.catalogue.categories = [
      { id: "grain", slug: "grains", translations: [{ locale: "en", name: "Grains" }] },
      { id: "oil", slug: "oils", translations: [{ locale: "en", name: "Oils" }] },
    ];
    h.catalogue.units = [
      { code: "BAG", allowsDecimal: false },
      { code: "PIECE", allowsDecimal: false },
      ...units,
    ];
    h.get.mockResolvedValueOnce(
      JSON.stringify({
        ...valid,
        title: "Rice",
        categoryId: "grain",
        inputMethod: "type",
        price: "12.34",
        step: 3,
        flowVersion: 2,
      }),
    );
    try {
      await act(async () => {
        renderer = create(<Sell />);
      });
      const select = (label: string) => nodes("Select").find((node) => node.props.label === label)!;
      await act(async () => select("Packaging type *").props.onChange("BAG"));
      expect(select("Package size *").props.options.map((option: any) => option.value)).toContain(
        "50",
      );
      await act(async () => select("Package size *").props.onChange("50"));
      const change = async (label: string, value: string) =>
        act(async () =>
          nodes("Field")
            .find((node) => node.props.label === label)!
            .props.onChangeText(value),
        );
      await change("Available quantity (50 kg bag) *", "20");
      await change("Price per 50 kg bag · NGN *", "65,000.00");
      await act(async () => select("Package size *").props.onChange("25"));
      expect(nodes("GuidedListing")[0]!.props.form).toMatchObject({ price: "", quantity: "" });
      await act(async () => select("Package size *").props.onChange("50"));
      await change("Available quantity (50 kg bag) *", "20");
      await change("Price per 50 kg bag · NGN *", "65,000.00");
      await act(async () => nodes("Confirmation")[0]!.props.onChange());
      await act(async () => button("Continue to photos").props.onPress());
      expect(nodes("ListingPage")[0]!.props.step).toBe(4);
      await act(async () => button("Review listing").props.onPress());
      expect(h.api).toHaveBeenCalledWith(
        "/listing-drafts",
        expect.objectContaining({
          body: expect.objectContaining({
            unitPriceMinor: "6500000",
            quantity: "20",
            unitCode: "BAG",
            salePackaging: { type: "BAG", size: 50, measure: "KG" },
            packingAssistanceRequested: true,
          }),
        }),
      );
      await act(async () => nodes("ListingPage")[0]!.props.onBack());
      await act(async () => nodes("ListingPage")[0]!.props.onBack());
      await act(async () => nodes("ListingPage")[0]!.props.onBack());
      await act(async () =>
        nodes("Pressable")
          .find((node) => node.props.accessibilityLabel === "Oils")!
          .props.onPress(),
      );
      expect(nodes("GuidedListing")[0]!.props.form).toMatchObject({
        categoryId: "oil",
        price: "",
        quantity: "",
        unitCode: "",
        salePackaging: undefined,
      });
      await act(async () => button("Continue").props.onPress());
      await act(async () => button("Continue to packaging").props.onPress());
      expect(select("Packaging type *").props.options.map((option: any) => option.value)).toContain(
        "BOTTLE",
      );
      expect(
        select("Packaging type *").props.options.map((option: any) => option.value),
      ).not.toContain("BAG");
    } finally {
      h.catalogue.categories = categories;
      h.catalogue.units = units;
    }
  });
  it("adds the uploaded photo only after the binary request succeeds and allows retry after failure", async () => {
    h.get.mockResolvedValue(JSON.stringify({ ...valid, photoIds: [], photos: [], step: 3 }));
    const binary = { bytes: new Uint8Array([255, 216, 255]), contentType: "image/jpeg" };
    h.choose.mockResolvedValue({ uri: "file:///cache/photo.jpg", mimeType: "image/jpeg" });
    h.photoBody.mockResolvedValue(binary);
    h.api.mockRejectedValueOnce(new Error("Upload failed"));
    await act(async () => {
      renderer = create(<Sell />);
    });
    await act(async () =>
      nodes("Pressable")
        .find((n) => n.props.accessibilityLabel === "Add photo")!
        .props.onPress(),
    );
    await act(async () => button("Choose from library").props.onPress());
    expect(button("Review listing").props.disabled).toBe(true);
    expect(nodes("Notice").some((n) => n.props.text === "Upload failed")).toBe(true);
    h.api.mockResolvedValueOnce({ id: "new-photo" });
    await act(async () => button("Choose from library").props.onPress());
    expect(h.api).toHaveBeenLastCalledWith("/listing-photos", { method: "POST", binary });
    expect(nodes("AppSheet")).toHaveLength(0);
    expect(button("Review listing").props.disabled).toBe(false);
    expect(nodes("Image").some((n) => n.props.source.uri === "file:///cache/photo.jpg")).toBe(true);
  });
  it("shows all uploaded images compactly and no voice controls in review", async () => {
    h.route = { id: "draft" };
    h.draft = { ...h.draft, fields: { ...valid, photoIds: ["one", "two", "three", "four"] } };
    await act(async () => {
      renderer = create(<Review />);
    });
    const images = nodes("Image");
    expect(images).toHaveLength(4);
    expect(images.map((n) => n.props.source.uri)).toEqual(
      ["one", "two", "three", "four"].map((id) => `http://localhost:3000/v1/listing-photos/${id}`),
    );
    expect(nodes("ListingVoiceNote")).toHaveLength(0);
    expect(images.slice(1).every((node) => node.props.style.height <= 100)).toBe(true);
  });
  it("offers the voice aid while editing details and blocks continuation during recording", async () => {
    h.route = { id: "draft" };
    h.get.mockResolvedValue(null);
    h.api.mockResolvedValueOnce({ fields: valid, listingId: null });
    await act(async () => {
      renderer = create(<Sell />);
    });
    expect(nodes("ListingPage")[0]!.props.step).toBe(2);
    expect(nodes("GuidedListing")[0]!.props.form.title).toBe("Tomatoes");
    await act(async () => nodes("GuidedListing")[0]!.props.onActivityChange(true));
    expect(button("Continue to packaging").props.disabled).toBe(true);
    expect(nodes("ListingPage")[0]!.props.onBack).toBeUndefined();
    await act(async () => button("Continue to packaging").props.onPress());
    expect(nodes("ListingPage")[0]!.props.step).toBe(2);
    await act(async () => nodes("GuidedListing")[0]!.props.onActivityChange(false));
    expect(button("Continue to packaging").props.disabled).toBe(false);
  });
  it("keeps the voice draft on the device when a new listing reaches review", async () => {
    const voice = JSON.stringify({
      uri: "file:///documents/listing-voice/seller/note.m4a",
      durationMillis: 1000,
      locale: "ig",
    });
    h.get.mockImplementation((key: string) =>
      Promise.resolve(
        key === "listing-draft:seller"
          ? JSON.stringify({ ...valid, step: 3 })
          : key === "listing-voice:seller:new"
            ? voice
            : null,
      ),
    );
    await act(async () => {
      renderer = create(<Sell />);
    });
    await act(async () => button("Review listing").props.onPress());
    expect(h.set).toHaveBeenCalledWith("listing-voice:seller:draft", voice);
    expect(h.remove).toHaveBeenCalledWith("listing-voice:seller:new");
    expect(JSON.stringify(h.api.mock.calls)).not.toContain("file://");
    expect(h.go).toHaveBeenCalledWith("review", "draft");
  });
  it("requires explicit confirmation and displays moderation status after submitting", async () => {
    h.route = { id: "draft" };
    h.api.mockResolvedValue({
      listing: { id: "listing", title: "Tomatoes", status: "PENDING_REVIEW" },
    });
    await act(async () => {
      renderer = create(<Review />);
    });
    expect(button("Submit listing").props.disabled).toBe(true);
    await act(async () => nodes("Confirmation")[0]!.props.onChange());
    expect(button("Submit listing").props.disabled).toBe(false);
    await act(async () => button("Submit listing").props.onPress());
    expect(h.api).toHaveBeenCalledWith("/listing-drafts/draft/submit", {
      method: "POST",
      body: { confirmed: true },
    });
    expect(nodes("ListingPage")[0]!.props.complete).toBe(true);
    expect(JSON.stringify(renderer.toJSON())).toContain("PENDING_REVIEW");
    expect(button("My listings")).toBeDefined();
  });
});

it("uses the admin catalogue order and supports categories outside the bundled examples", async () => {
  const original = h.catalogue.categories;
  h.catalogue.categories = [
    { id: "new", slug: "seasonal", translations: [{ locale: "en", name: "Seasonal crops" }] },
    ...original,
  ];
  try {
    await act(async () => {
      renderer = create(<Sell />);
    });
    await act(async () => button("Type my listing").props.onPress());
    const radios = nodes("Pressable").filter((node) => node.props.accessibilityRole === "radio");
    expect(radios.map((node) => node.props.accessibilityLabel)).toEqual([
      "Seasonal crops",
      "Vegetables",
    ]);
    await act(async () => radios[0]!.props.onPress());
    expect(button("Continue").props.disabled).toBe(false);
  } finally {
    h.catalogue.categories = original;
  }
});

it("switches from guided voice to typing without losing confirmed draft answers", async () => {
  h.get.mockResolvedValue(
    JSON.stringify({ ...valid, inputMethod: "voice", price: "12.34", step: 2 }),
  );
  await act(async () => {
    renderer = create(<Sell />);
  });
  await act(async () => button("Continue guided voice").props.onPress());
  expect(nodes("GuidedListing")[0]!.props.visible).toBe(true);
  await act(async () => nodes("GuidedListing")[0]!.props.onClose());
  expect(nodes("GuidedListing")[0]!.props.visible).toBe(false);
  expect(nodes("Field").find((node) => node.props.label === "Description *")!.props.value).toBe(
    "Fresh harvest",
  );
  expect(nodes("ListingPage")[0]!.props.step).toBe(2);
});
