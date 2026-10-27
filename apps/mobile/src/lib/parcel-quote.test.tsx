vi.mock("../components/order-disputes", () => ({ OrderDisputes: "OrderDisputes" }));
import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ api: vi.fn(), back: vi.fn(), data: null as any }));
vi.mock("react-native", () => ({
  View: "View",
  Pressable: "Pressable",
  StyleSheet: { create: (styles: any) => styles },
  Linking: { openURL: vi.fn() },
}));
vi.mock("../components/Select", () => ({ Select: "Select" }));
vi.mock("../components/order-payment", () => ({ OrderPayment: "OrderPayment" }));
vi.mock("../localization", () => ({ LocalizedText: "Text" }));
vi.mock("../components/ui", async () => {
  const { createElement } = await import("react");
  return {
    Page: ({ children, footer, ...props }: any) => createElement("Page", props, children, footer),
    Heading: "Heading",
    Label: "Label",
    Field: "Field",
    Button: "Button",
    Card: "Card",
    Notice: "Notice",
    Icon: "Icon",
    s: {},
    colors: {},
  };
});
vi.mock("./api", () => ({ api: h.api }));
vi.mock("../state", () => ({
  useApp: () => ({
    route: { id: "order" },
    user: { addresses: [], profile: {}, phoneE164: "+2348012345678" },
    back: h.back,
    status: (s: string) => s,
    error: (e: Error) => e.message,
    ui: (s: string, params: Record<string, unknown> = {}) =>
      s.replace(/\{(\w+)\}/g, (_, key) => String(params[key])),
  }),
  useResource: () => ({ data: h.data, loading: false, error: "" }),
}));
import { Quotes } from "../screens/delivery";
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let tree: ReactTestRenderer;
const field = (label: string) =>
  tree.root.findAllByType("Field" as any).find((node) => node.props.label === label)!;
const submit = () =>
  tree.root
    .findAllByType("Button" as any)
    .find((node) => node.props.title === "Get delivery quotes")!
    .props.onPress();
beforeEach(() => {
  vi.clearAllMocks();
  h.api.mockResolvedValue({ items: [] });
  h.data = {
    order: {
      id: "order",
      suggestedPickup: {
        name: "Farmer",
        email: "farm@example.test",
        address: "Test farm address Lagos",
        state: "Lagos",
      },
      packageSuggestion: {
        packageCount: 2,
        weightKg: 50,
        length: null,
        width: null,
        height: null,
        handling: "PERISHABLE",
        notes: "Keep upright",
        needsPackedDimensions: true,
        farmer: { notes: "Keep upright" },
      },
    },
    delivery: null,
  };
});
afterEach(async () => {
  await act(async () => tree?.unmount());
});
it("prefills the farmer estimate, requires actual packed dimensions and retains buyer edits", async () => {
  await act(async () => {
    tree = create(<Quotes />);
  });
  expect(field("Final parcel count").props.value).toBe("2");
  expect(field("Total packed weight (kg)").props.value).toBe("50");
  expect(field("Length (cm)").props.value).toBe("");
  await act(async () => submit());
  expect(h.api).not.toHaveBeenCalled();
  for (const [label, value] of [
    ["Length (cm)", "50"],
    ["Width (cm)", "40"],
    ["Height (cm)", "30"],
    ["Total packed weight (kg)", "43"],
    ["Handling instructions", "Keep upright and cool"],
  ])
    await act(async () => field(label!).props.onChangeText(value));
  h.data = { ...h.data };
  await act(async () => tree.update(<Quotes />));
  expect(field("Total packed weight (kg)").props.value).toBe("43");
  await act(async () => submit());
  expect(h.api).toHaveBeenCalledWith(
    "/orders/order/delivery/quotes",
    expect.objectContaining({
      body: expect.objectContaining({
        parcel: expect.objectContaining({
          packageCount: 2,
          weightKg: 43,
          length: 50,
          width: 40,
          height: 30,
          handling: "PERISHABLE",
          notes: "Keep upright and cool",
        }),
      }),
    }),
  );
  expect(h.data.order.packageSuggestion.farmer.notes).toBe("Keep upright");
});
it("restores a saved buyer parcel and prevents removal of mandatory handling", async () => {
  h.data.delivery = {
    package: {
      packageCount: 1,
      weightKg: 32,
      length: 70,
      width: 60,
      height: 50,
      handling: "PERISHABLE",
      notes: "Final packing",
      pickupDate: "2026-12-01",
    },
  };
  await act(async () => {
    tree = create(<Quotes />);
  });
  expect(field("Total packed weight (kg)").props.value).toBe("32");
  expect(field("Handling instructions").props.value).toBe("Final packing");
  const standard = tree.root
    .findAllByType("Pressable" as any)
    .find((node) => node.props.children.props.children === "STANDARD")!;
  expect(standard.props.disabled).toBe(true);
  const cold = tree.root
    .findAllByType("Pressable" as any)
    .find((node) => node.props.children.props.children === "COLD_CHAIN")!;
  expect(cold.props.disabled).toBe(false);
});
