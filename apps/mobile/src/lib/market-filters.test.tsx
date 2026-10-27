import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  paths: [] as string[],
  dismiss: vi.fn(),
  go: vi.fn(),
  route: { name: "search" } as { name: string; query?: string; id?: string },
  setArea: null as any,
  categories: {
    items: [
      { id: "veg", slug: "vegetables", translations: [{ locale: "en", name: "Vegetables" }] },
    ],
  },
  reloadCategories: vi.fn(),
  reloadListings: vi.fn(),
  foreground: null as any,
}));
vi.mock("react-native", () => ({
  View: "View",
  Keyboard: { dismiss: h.dismiss },
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  useWindowDimensions: () => ({ width: 400, height: 800 }),
  AppState: {
    addEventListener: (_: string, fn: unknown) => {
      h.foreground = fn;
      return { remove() {} };
    },
  },
}));
vi.mock("../components/buyer-location", () => ({
  useBuyerLocation: () => {
    const [area, setArea] = React.useState({ state: "", lga: "" });
    h.setArea = setArea;
    return { area, busy: false };
  },
}));
vi.mock("../components/app-sheet", () => ({
  AppSheet: ({ visible, children, onShow, onClose, scroll }: any) =>
    visible ? React.createElement("Sheet", { onShow, onClose, scroll }, children) : null,
}));
vi.mock("../components/Select", () => ({ Select: "Select" }));
vi.mock("../components/listing-gallery", () => ({ ListingGallery: "ListingGallery" }));
vi.mock("../components/listing-photo", () => ({ ListingPhoto: "ListingPhoto" }));
vi.mock("../localization", () => ({ LocalizedText: "Text" }));
vi.mock("../components/ui", () => ({
  Page: "Page",
  Heading: "Heading",
  Label: "Label",
  Field: "Field",
  Button: "Button",
  Card: "Card",
  Icon: "Icon",
  Notice: "Notice",
  s: {},
  colors: {},
}));
vi.mock("./api", () => ({ api: vi.fn(), uuid: () => "key" }));
vi.mock("../state", () => ({
  useApp: () => ({
    user: null,
    role: "BUYER",
    route: h.route,
    go: h.go,
    locale: "en",
    ui: (s: string) => s,
  }),
  useResource: (path: string) => {
    h.paths.push(path);
    return path.includes("categories")
      ? { data: h.categories, reload: h.reloadCategories }
      : { data: { items: [] }, loading: false, reload: h.reloadListings };
  },
}));
import { Market } from "../screens/market";
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let tree: ReactTestRenderer;
beforeEach(() => {
  vi.clearAllMocks();
  h.paths = [];
  h.route = { name: "search" };
  h.categories = {
    items: [
      { id: "veg", slug: "vegetables", translations: [{ locale: "en", name: "Vegetables" }] },
    ],
  };
});
afterEach(async () => {
  await act(async () => tree?.unmount());
});
it("combines buyer area and produce category filters in the public request", async () => {
  await act(async () => {
    tree = create(<Market />);
  });
  await act(async () => h.setArea({ state: "Lagos", lga: "Ikeja" }));
  await act(async () =>
    tree.root
      .findAllByType("Pressable" as any)
      .find((node) => node.props.accessibilityLabel === "Vegetables")!
      .props.onPress(),
  );
  expect(h.paths).toContain("/marketplace/listings?search=&categoryId=veg&state=Lagos&lga=Ikeja");
});
it("refreshes on foreground and clears a filter when admin deactivates its category", async () => {
  await act(async () => {
    tree = create(<Market />);
  });
  await act(async () =>
    tree.root
      .findAllByType("Pressable" as any)
      .find((node) => node.props.accessibilityLabel === "Vegetables")!
      .props.onPress(),
  );
  await act(async () => h.foreground("active"));
  expect(h.reloadCategories).toHaveBeenCalledTimes(1);
  expect(h.reloadListings).toHaveBeenCalledTimes(1);
  h.categories = { items: [] };
  h.paths = [];
  h.route = { name: "search" };
  await act(async () => tree.update(<Market />));
  const requests = h.paths.filter((path) => path.startsWith("/marketplace/listings"));
  expect(requests.at(-1)).toBe("/marketplace/listings?search=");
});

it("sends device coordinates and radius to the nearby search", async () => {
  await act(async () => {
    tree = create(<Market />);
  });
  await act(async () =>
    h.setArea({ state: "", lga: "", latitude: 6.52, longitude: 3.37, radiusKm: 25 }),
  );
  expect(h.paths).toContain(
    "/marketplace/listings?search=&latitude=6.52&longitude=3.37&radiusKm=25",
  );
});

it("uses a compact location indicator that opens shopping location settings", async () => {
  await act(async () => {
    tree = create(<Market />);
  });
  expect(tree.root.findAllByType("BuyerLocation" as any)).toHaveLength(0);
  expect(
    tree.root
      .findAllByType("Pressable" as any)
      .some((node) => node.props.accessibilityLabel === "Change shopping location"),
  ).toBe(true);
});

it("submits search from either the inline icon or the keyboard", async () => {
  await act(async () => {
    tree = create(<Market />);
  });
  await act(async () =>
    tree.root
      .findAllByType("Pressable" as any)
      .find((node) => node.props.accessibilityLabel === "Search produce")!
      .props.onPress(),
  );
  const field = () =>
    tree.root.findAllByType("Field" as any).find((node) => node.props.label === "Search produce")!;
  await act(async () => field().props.onChangeText("fresh yam"));
  await act(async () =>
    tree.root
      .findAllByType("Pressable" as any)
      .find((node) => node.props.accessibilityLabel === "Search")!
      .props.onPress(),
  );
  expect(h.paths.some((path) => path.includes("search=fresh%20yam"))).toBe(true);
  await act(async () =>
    tree.root
      .findAllByType("Pressable" as any)
      .find((node) => node.props.accessibilityLabel === "Search produce")!
      .props.onPress(),
  );
  await act(async () => field().props.onChangeText("tomato"));
  await act(async () => field().props.onSubmitEditing());
  expect(h.paths.some((path) => path.includes("search=tomato"))).toBe(true);
  expect(tree.root.findAllByType("Field" as any)).toHaveLength(0);
  expect(h.dismiss).toHaveBeenCalledTimes(2);
  expect(
    tree.root.findAllByType("Button" as any).some((node) => node.props.title === "Search"),
  ).toBe(false);
});

it("takes Home search to results and focuses text entry only inside the sheet", async () => {
  h.route = { name: "home" };
  await act(async () => {
    tree = create(<Market />);
  });
  expect(tree.root.findAllByType("Field" as any)).toHaveLength(0);
  await act(async () =>
    tree.root
      .findAllByType("Pressable" as any)
      .find((node) => node.props.accessibilityLabel === "Search produce")!
      .props.onPress(),
  );
  const input = tree.root.findByType("Field" as any);
  expect(input.props.autoFocus).toBe(true);
  const focus = vi.fn();
  input.props.inputRef.current = { focus };
  await act(async () => tree.root.findByType("Sheet" as any).props.onShow());
  expect(focus).toHaveBeenCalledTimes(1);
  expect(tree.root.findByType("Sheet" as any).props.scroll).toBe(false);
  await act(async () => input.props.onChangeText("  tomatoes  "));
  expect(h.go).not.toHaveBeenCalled();
  await act(async () => tree.root.findByType("Field" as any).props.onSubmitEditing());
  expect(h.go).toHaveBeenCalledWith("search", undefined, "tomatoes");
  expect(h.dismiss).toHaveBeenCalledTimes(1);
  expect(tree.root.findAllByType("Field" as any)).toHaveLength(0);
});
