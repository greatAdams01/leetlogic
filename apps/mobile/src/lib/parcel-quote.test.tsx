vi.mock("../components/order-disputes", () => ({ OrderDisputes: "OrderDisputes" }));
import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  api: vi.fn(),
  back: vi.fn(),
  returnTo: vi.fn(),
  go: vi.fn(),
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
    go: h.go,
    status: (s: string) => s,
    unit: (s: string) => s,
    t: (s: string) => s,
    date: (s: string) => s,
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
    .find((node) => node.props.title === "Continue to delivery options")!
    .props.onPress();
beforeEach(() => {
  vi.clearAllMocks();
  h.query = undefined;
  h.api.mockResolvedValue({ items: [] });
  h.reload.mockResolvedValue(undefined);
  h.user = { addresses: [], profile: {}, phoneE164: "+2348012345678" };
  h.data = {
    order: {
      id: "order",
      checkoutReady: false,
      checkoutActive: false,
      payableMinor: null,
      totalWithDeliveryMinor: null,
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
  vi.useRealTimers();
});
it("shows seller measurements without allowing buyers to reduce shipment weight", async () => {
  h.data.order.packageSuggestion = { ...h.data.order.packageSuggestion, length: 50, width: 40, height: 30 };
  await act(async () => { tree = create(<Quotes />); });
  expect(field("Total packed weight (kg)")).toBeUndefined();
  expect(field("Length (cm)")).toBeUndefined();
  h.api.mockResolvedValueOnce({ items: [{ id: "rate" }] });
  await act(async () => submit());
  expect(h.api).toHaveBeenLastCalledWith("/orders/order/delivery/quotes", expect.objectContaining({ body: expect.objectContaining({ parcel: expect.objectContaining({ packageCount: 2, weightKg: 50, length: 50, width: 40, height: 30 }) }) }));
  expect(h.returnTo).toHaveBeenCalledWith("delivery", "order", "delivery-carriers");
});
it("requires missing seller measurements to be completed before quoting", async () => {
  h.data.order.packageSuggestion = null;
  await act(async () => { tree = create(<Quotes />); });
  expect(tree.root.findAllByType("Button" as any).find((node) => node.props.title === "Continue to delivery options")!.props.disabled).toBe(true);
  expect(h.api).not.toHaveBeenCalled();
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
   h.data = { ...h.data, order: { ...h.data.order, checkoutReady: true, payableMinor: "10000", totalWithDeliveryMinor: "10000" }, delivery: { status: "PICKUP_PENDING", shippingMinor: "0", quotes: [], selectedQuoteId: null } };
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

it("reviews distinct farmer and buyer addresses with farmer packing prefilled and uses seller packing for pricing", async () => {
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
          weightKg: 25,
          length: 50,
          width: 40,
          height: 30,
          notes: "Keep upright",
        }),
      }),
    }),
  );
});

it("keeps an empty provider result actionable without sending the buyer to staff confirmation", async () => {
  h.data.order.packageSuggestion = { ...h.data.order.packageSuggestion, length: 50, width: 40, height: 30 };
  h.api.mockResolvedValueOnce({ items: [] });
  await act(async () => { tree = create(<Quotes />); });
  await act(async () => submit());
  expect(h.returnTo).not.toHaveBeenCalled();
  expect(tree.root.findAllByType("Notice" as any).some((node) => node.props.error)).toBe(true);
});
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

const carriers = () => {
  h.data = {
    ...h.data,
    order: { ...h.data.order, isBuyer: true, status: "AWAITING_PAYMENT", totalMinor: "10000", title: "Beans" },
    delivery: {
      status: "QUOTED", selectedQuoteId: null, shippingMinor: "0", destination: { state: "Lagos" },
      quotes: ["first", "second"].map((id) => ({ id, courier: id, amountMinor: "1000", available: true, expiresAt: new Date(Date.now() + 60000).toISOString() })),
    },
  };
};
const radios = () => tree.root.findAllByType("Pressable" as any).filter((node) => node.props.accessibilityRole === "radio");

it("disables expired and unavailable courier cards before any selection request", async () => {
  carriers();
  h.data.delivery.quotes[0].expiresAt = new Date(Date.now() - 1).toISOString();
  h.data.delivery.quotes[1].available = false;
  await act(async () => { tree = create(<Delivery />); });
  expect(radios().every((node) => node.props.disabled)).toBe(true);
  await act(async () => radios().forEach((node) => node.props.onPress()));
  expect(h.api).not.toHaveBeenCalled();
  expect(tree.root.findAllByType("Button" as any).find((node) => node.props.title === "Continue")!.props.disabled).toBe(true);
});

it("expires a selected carrier while mounted and rejects its saved selection handler", async () => {
  vi.useFakeTimers();
  carriers();
  h.data.order.checkoutReady = true;
  h.data.delivery.selectedQuoteId = "first";
  h.data.delivery.quotes[0].expiresAt = new Date(Date.now() + 1000).toISOString();
  await act(async () => { tree = create(<Delivery />); });
  const press = radios()[0]!.props.onPress;
  expect(tree.root.findAllByType("Button" as any).find((node) => node.props.title === "Continue")!.props.disabled).toBe(false);
  await act(async () => {
    vi.advanceTimersByTime(1001);
  });
  expect(tree.root.findAllByType("Button" as any).find((node) => node.props.title === "Continue")!.props.disabled).toBe(true);
  await act(async () => press());
  expect(h.api).not.toHaveBeenCalled();
});

it("submits only one carrier selection and waits for authoritative server readiness", async () => {
  carriers();
  let resolveSelection!: (value: any) => void;
  h.api.mockImplementationOnce(() => new Promise((resolve) => { resolveSelection = resolve; }));
  await act(async () => { tree = create(<Delivery />); });
  const [first, second] = radios().map((node) => node.props.onPress);
  await act(async () => { first(); second(); });
  expect(h.api).toHaveBeenCalledOnce();
  expect(h.api).toHaveBeenCalledWith("/orders/order/delivery/select", { method: "POST", body: { quoteId: "first" } });
  await act(async () => resolveSelection({ shippingMinor: "1" }));
  expect(h.reload).toHaveBeenCalledOnce();
  expect(tree.root.findAllByType("Button" as any).find((node) => node.props.title === "Continue")!.props.disabled).toBe(true);
  expect(radios().some((node) => node.props.accessibilityState.selected)).toBe(false);
});

it("reloads a saved carrier choice after its response is lost", async () => {
  carriers();
  h.api.mockImplementationOnce(async () => {
    h.data = { ...h.data, order: { ...h.data.order, checkoutReady: true, payableMinor: "11000" }, delivery: { ...h.data.delivery, selectedQuoteId: "first", shippingMinor: "1000" } };
    throw new Error("Response lost");
  });
  h.reload.mockImplementation(async () => { tree.update(<Delivery />); });
  await act(async () => { tree = create(<Delivery />); });
  await act(async () => radios()[0]!.props.onPress());
  expect(h.reload).toHaveBeenCalledOnce();
  expect(radios()[0]!.props.accessibilityState.selected).toBe(true);
  expect(tree.root.findAllByType("Button" as any).find((node) => node.props.title === "Continue")!.props.disabled).toBe(false);
  expect(h.api).toHaveBeenCalledOnce();
});

it("updates server-owned packing on reload without discarding local destination and date edits", async () => {
  h.data.order.packageSuggestion = { ...h.data.order.packageSuggestion, length: 20, width: 15, height: 10 };
  h.data.delivery = { destination: { name: "Buyer", phone: "+2348012345678", email: "buyer@example.test", address: "Old buyer address Lagos", state: "Lagos", country: "NG" } };
  await act(async () => { tree = create(<Quotes />); });
  await act(async () => tree.root.findAllByType("Button" as any).find((node) => node.props.title === "Edit delivery details")!.props.onPress());
  await act(async () => field("Delivery address").props.onChangeText("New buyer address Lagos"));
  const date = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  await act(async () => field("Pickup date · YYYY-MM-DD").props.onChangeText(date));
  h.data = { ...h.data, order: { ...h.data.order, packageSuggestion: { ...h.data.order.packageSuggestion, packageCount: 3, weightKg: 151.5, length: 60 } } };
  await act(async () => tree.update(<Quotes />));
  h.api.mockResolvedValueOnce({ items: [{ id: "new-rate" }] });
  await act(async () => submit());
  expect(h.api).toHaveBeenCalledWith("/orders/order/delivery/quotes", expect.objectContaining({ body: expect.objectContaining({
    destination: expect.objectContaining({ address: "New buyer address Lagos" }),
    parcel: expect.objectContaining({ packageCount: 3, weightKg: 151.5, length: 60, pickupDate: date }),
  }) }));
});

it("guards quote submissions against two presses before the component rerenders", async () => {
  h.data.order.packageSuggestion = { ...h.data.order.packageSuggestion, length: 20, width: 15, height: 10 };
  let resolveQuotes!: (value: any) => void;
  h.api.mockImplementationOnce(() => new Promise((resolve) => { resolveQuotes = resolve; }));
  await act(async () => { tree = create(<Quotes />); });
  const press = tree.root.findAllByType("Button" as any).find((node) => node.props.title === "Continue to delivery options")!.props.onPress;
  await act(async () => {
    const first = press();
    const second = press();
    expect(h.api).toHaveBeenCalledOnce();
    resolveQuotes({ items: [{ id: "rate" }] });
    await Promise.all([first, second]);
  });
  expect(h.returnTo).toHaveBeenCalledOnce();
});
