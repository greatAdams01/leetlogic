vi.mock("../components/order-disputes", () => ({ OrderDisputes: "OrderDisputes" }));
import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  api: vi.fn(),
  back: vi.fn(),
  returnTo: vi.fn(),
  query: undefined as string | undefined,
  reload: vi.fn(),
  user: null as any,
  data: null as any,
}));
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
    route: { id: "order", query: h.query },
    user: h.user,
    back: h.back,
    returnTo: h.returnTo,
    status: (s: string) => s,
    unit: (s: string) => s,
    error: (e: Error) => e.message,
    ui: (s: string, params: Record<string, unknown> = {}) =>
      s.replace(/\{(\w+)\}/g, (_, key) => String(params[key])),
  }),
  useResource: () => ({ data: h.data, reload: h.reload, loading: false, error: "" }),
}));
import { Quotes, Delivery } from "../screens/delivery";
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
  h.query = undefined;
  h.api.mockResolvedValue({ items: [] });
  h.user = { addresses: [], profile: {}, phoneE164: "+2348012345678" };
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
  expect(field("Total packed weight (kg)")).toBeUndefined();
  await act(async () =>
    tree.root
      .findAllByType("Button" as any)
      .find((node) => node.props.title === "Edit package details")!
      .props.onPress(),
  );
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

it("offers pickup and delivery only, and opens produce-only pickup payment", async () => {
  h.data = {
    ...h.data,
    order: { ...h.data.order, isBuyer: true, status: "AWAITING_PAYMENT", totalMinor: "10000" },
  };
  await act(async () => {
    tree = create(<Delivery />);
  });
  const headings = () =>
    tree.root.findAllByType("Heading" as any).map((node) => node.props.children);
  expect(headings()).toContain("Pickup or delivery?");
  expect(
    tree.root
      .findAllByType("Label" as any)
      .map((node) => node.props.children)
      .join(" "),
  ).not.toContain("International");
  const choices = tree.root
    .findAllByType("Pressable" as any)
    .filter((node) => node.props.accessibilityRole === "button");
  await act(async () => choices[0]!.props.onPress());
  expect(h.api).toHaveBeenCalledWith("/orders/order/delivery/collection", {
    method: "POST",
    body: {},
  });
  expect(h.reload).toHaveBeenCalledOnce();
  h.data = { ...h.data, delivery: { status: "PICKUP_PENDING", quotes: [], selectedQuoteId: null } };
  await act(async () => tree.update(<Delivery />));
  expect(headings()).toContain("Pickup");
  expect(tree.root.findAllByType("OrderPayment" as any)).toHaveLength(1);
  expect(
    tree.root
      .findAllByType("Label" as any)
      .map((node) => node.props.children)
      .join(" "),
  ).not.toContain("quote expired");
});

it("reviews distinct farmer and buyer addresses with farmer packing prefilled and sends buyer edits for pricing", async () => {
  h.user.addresses = [
    {
      id: "buyer-home",
      isDefaultDelivery: true,
      latitude: "9.08",
      longitude: "7.4",
      line1: "42 Buyer Avenue",
      city: "Abuja",
      lga: "Bwari",
      state: "FCT",
    },
  ];
  h.data.order.packageSuggestion = {
    ...h.data.order.packageSuggestion,
    packageCount: 1,
    weightKg: 25,
    length: 50,
    width: 40,
    height: 30,
    farmer: { length: 50, width: 40, height: 30, notes: "Keep upright" },
  };
  await act(async () => {
    tree = create(<Quotes />);
  });
  const labels = () =>
    tree.root
      .findAllByType("Label" as any)
      .map((node) => node.props.children)
      .flat()
      .join(" ");
  expect(labels()).toContain("Pickup Location");
  expect(labels()).toContain("Test farm address Lagos");
  expect(labels()).toContain("Delivery Destination");
  expect(labels()).toContain("42 Buyer Avenue, Abuja, Bwari");
  expect(labels()).toContain("Keep upright");
  expect(field("Total packed weight (kg)")).toBeUndefined();
  expect(field("Delivery address")).toBeUndefined();
  await act(async () =>
    tree.root
      .findAllByType("Button" as any)
      .find((node) => node.props.title === "Edit package details")!
      .props.onPress(),
  );
  expect(field("Length (cm)").props.value).toBe("50");
  expect(field("Handling instructions").props.value).toBe("Keep upright");
  await act(async () => field("Total packed weight (kg)").props.onChangeText("24"));
  await act(async () => submit());
  expect(h.api).toHaveBeenLastCalledWith(
    "/orders/order/delivery/quotes",
    expect.objectContaining({
      body: expect.objectContaining({
        pickup: expect.objectContaining({ address: "Test farm address Lagos", state: "Lagos" }),
        destination: expect.objectContaining({
          address: "42 Buyer Avenue, Abuja, Bwari",
          state: "FCT",
          latitude: 9.08,
          longitude: 7.4,
        }),
        parcel: expect.objectContaining({
          weightKg: 24,
          length: 50,
          width: 40,
          height: 30,
          notes: "Keep upright",
        }),
      }),
    }),
  );
});

for (const [result, next] of [
  [{ items: [{ id: "rate" }] }, "delivery-carriers"],
  [{ manualReview: true }, "delivery-review"],
  [{ items: [] }, "delivery-review"],
] as const) {
  it(`continues pricing to ${next} instead of returning to step one`, async () => {
    h.data.order.packageSuggestion = {
      ...h.data.order.packageSuggestion,
      length: 50,
      width: 40,
      height: 30,
    };
    h.api.mockResolvedValueOnce(result);
    await act(async () => {
      tree = create(<Quotes />);
    });
    await act(async () => submit());
    expect(h.returnTo).toHaveBeenCalledWith("delivery", "order", next);
    expect(h.back).not.toHaveBeenCalled();
  });
}
it("resumes a manual review result without repeating the pickup or delivery choice", async () => {
  h.query = "delivery-review";
  h.data.order = {
    ...h.data.order,
    isBuyer: true,
    status: "AWAITING_PAYMENT",
    totalMinor: "10000",
  };
  h.data.delivery = {
    status: "MANUAL_REVIEW",
    quotes: [],
    destination: { address: "Buyer home", state: "FCT" },
  };
  await act(async () => {
    tree = create(<Delivery />);
  });
  const headings = tree.root.findAllByType("Heading" as any).map((node) => node.props.children);
  expect(headings).toContain("Delivery review pending");
  expect(headings).not.toContain("Pickup or delivery?");
  expect(tree.root.findAllByType("OrderPayment" as any)).toHaveLength(0);
});

it("clears a saved map pin when the buyer edits the delivery address", async () => {
  h.data.delivery = {
    destination: {
      name: "Buyer",
      phone: "+2348012345678",
      email: "buyer@example.test",
      address: "Old delivery address Abuja",
      state: "FCT",
      country: "NG",
      latitude: 9.08,
      longitude: 7.4,
    },
  };
  h.data.order.packageSuggestion = {
    ...h.data.order.packageSuggestion,
    length: 20,
    width: 10,
    height: 20,
  };
  await act(async () => {
    tree = create(<Quotes />);
  });
  await act(async () =>
    tree.root
      .findAllByType("Button" as any)
      .find((node) => node.props.title === "Edit delivery details")!
      .props.onPress(),
  );
  await act(async () => field("Delivery address").props.onChangeText("New delivery address Abuja"));
  await act(async () => submit());
  const body = h.api.mock.calls.at(-1)![1].body;
  expect(body.destination.address).toBe("New delivery address Abuja");
  expect(body.destination.latitude).toBeUndefined();
  expect(body.destination.longitude).toBeUndefined();
});
