import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  api: vi.fn(),
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
vi.mock("expo-image-picker", () => ({}));
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
vi.mock("./listing-art", () => ({ listingCategories: {} }));
vi.mock("../localization", () => ({ LocalizedText: "Text" }));
vi.mock("../screens/market", () => ({ ListingPhoto: "ListingPhoto" }));
vi.mock("../components/seller-listing-controls", () => ({ ListingControls: "ListingControls" }));
vi.mock("../components/Select", () => ({ Select: "Select" }));
vi.mock("../components/feedback", () => ({ Confirmation: "Confirmation" }));
vi.mock("../components/app-sheet", () => ({ AppSheet: () => null }));
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
      ["Page", "Label", "Field", "Button", "Card", "Icon", "Notice"].map((n) => [n, host(n)]),
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
  it("keeps details in their own step, validates them and preserves them when going back", async () => {
    await act(async () => {
      renderer = create(<Sell />);
    });
    expect(nodes("Field")).toHaveLength(0);
    expect(button("Continue").props.disabled).toBe(true);
    const category = nodes("Pressable").find((n) => n.props.accessibilityRole === "radio")!;
    await act(async () => category.props.onPress());
    await act(async () => button("Continue").props.onPress());
    expect(nodes("ListingPage")[0]!.props.step).toBe(2);
    await act(async () => button("Continue to photos").props.onPress());
    expect(nodes("ListingPage")[0]!.props.step).toBe(2);
    expect(nodes("Notice").some((n) => n.props.error)).toBe(true);
    await act(async () => nodes("Select")[0]!.props.onChange("KG"));
    for (const [label, value] of [
      ["Product title *", "My tomatoes"],
      ["Description *", "Fresh produce"],
      ["Available quantity *", "2"],
      ["Price per KG · NGN *", "123"],
    ]) {
      await act(async () =>
        nodes("Field")
          .find((n) => n.props.label === label)!
          .props.onChangeText(value),
      );
    }
    await act(async () => button("Continue to photos").props.onPress());
    expect(nodes("ListingPage")[0]!.props.step).toBe(3);
    expect(button("Review listing").props.disabled).toBe(true);
    await act(async () => nodes("ListingPage")[0]!.props.onBack());
    expect(nodes("Field").find((n) => n.props.label === "Product title *")!.props.value).toBe(
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
