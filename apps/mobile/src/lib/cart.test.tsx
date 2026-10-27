import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  api: vi.fn(),
  reload: vi.fn(),
  go: vi.fn(),
  data: null as any,
  serial: 0,
}));
vi.mock("react-native", () => ({
  View: "View",
  AppState: { addEventListener: () => ({ remove() {} }) },
}));
vi.mock("../components/ui", () => ({
  Page: ({ children, footer }: any) => React.createElement("Page", {}, children, footer),
  Card: "Card",
  Heading: "Heading",
  Label: "Label",
  Button: "Button",
  Field: "Field",
  Notice: "Notice",
  colors: {},
}));
vi.mock("../components/listing-photo", () => ({ ListingPhoto: "ListingPhoto" }));
vi.mock("./api", () => ({ api: h.api, uuid: () => `key-${++h.serial}` }));
vi.mock("../state", () => ({
  useApp: () => ({
    ui: (s: string) => s,
    unit: (s: string) => s,
    error: (e: Error) => e.message,
    go: h.go,
  }),
  useResource: () => ({ data: h.data, reload: h.reload, loading: false }),
}));
import { Cart } from "../screens/cart";
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let tree: ReactTestRenderer;
const button = (title: string) =>
  tree.root.findAllByType("Button" as any).find((node) => node.props.title === title)!;
beforeEach(() => {
  vi.clearAllMocks();
  h.data = {
    items: [
      {
        listingId: "listing",
        quantity: "2",
        unitPriceMinor: "10000",
        listing: {
          id: "listing",
          title: "Tomatoes",
          unitCode: "BASKET",
          unitPriceMinor: "10000",
          media: [],
          status: "ACTIVE",
          farmerProfile: { farmName: "Farm" },
        },
      },
    ],
  };
});
afterEach(async () => {
  await act(async () => tree?.unmount());
});
it("creates orders only on checkout and prevents concurrent submissions", async () => {
  let finish!: (r: any) => void;
  h.api.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  await act(async () => {
    tree = create(<Cart />);
  });
  expect(h.api).not.toHaveBeenCalled();
  await act(async () => {
    button("Continue to delivery").props.onPress();
    button("Continue to delivery").props.onPress();
  });
  expect(h.api).toHaveBeenCalledTimes(1);
  await act(async () => finish({ orders: [{ id: "order" }] }));
  expect(h.go).toHaveBeenCalledWith("delivery", "order");
});
it("retries an uncertain checkout with the same key and snapshot", async () => {
  h.api
    .mockRejectedValueOnce({ status: 0, message: "Connection lost" })
    .mockResolvedValueOnce({ orders: [{ id: "a" }, { id: "b" }] });
  await act(async () => {
    tree = create(<Cart />);
  });
  await act(async () => button("Continue to delivery").props.onPress());
  const original = h.api.mock.calls[0]![1];
  await act(async () => button("Retry checkout").props.onPress());
  expect(h.api.mock.calls[1]![1]).toEqual(original);
  expect(h.go).toHaveBeenCalledWith("orders");
});
it("allows cart correction after a confirmed rejection instead of trapping the buyer in retry", async () => {
  h.api.mockRejectedValueOnce({ status: 409, message: "Price changed" });
  await act(async () => {
    tree = create(<Cart />);
  });
  await act(async () => button("Continue to delivery").props.onPress());
  expect(h.reload).toHaveBeenCalled();
  expect(button("Retry checkout")).toBeUndefined();
  expect(button("Update cart").props.loading).toBe(false);
  expect(
    tree.root.findAllByType("Notice" as any).some((node) => node.props.text === "Price changed"),
  ).toBe(true);
});
