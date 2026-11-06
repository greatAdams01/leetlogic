import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  api: vi.fn(),
  go: vi.fn(),
  back: vi.fn(),
  returnTo: vi.fn(),
  load: vi.fn(),
  setUser: vi.fn(),
  locate: vi.fn(),
  capture: vi.fn(),
  animate: vi.fn(),
  platform: { OS: "ios" },
  reload: vi.fn(),
  user: null as any,
  data: null as any,
  query: undefined as string | undefined,
  quoteBody: null as any,
}));
vi.mock("react-native", () => ({
  View: "View",
  Pressable: "Pressable",
  Modal: "Modal",
  ScrollView: "ScrollView",
  KeyboardAvoidingView: "KeyboardAvoidingView",
  Keyboard: { dismiss: vi.fn() },
  Platform: h.platform,
  StyleSheet: { create: (v: any) => v, absoluteFill: {} },
  Linking: { openURL: vi.fn() },
}));
vi.mock("../components/ui", () => ({
  Page: ({ children, footer, header, ...props }: any) =>
    React.createElement("Page", props, header, children, footer),
  Button: "Button",
  Card: "Card",
  Field: "Field",
  Label: "Label",
  Heading: "Heading",
  Notice: "Notice",
  Icon: "Icon",
  s: {},
  colors: {},
}));
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 20 }),
}));
vi.mock("react-native-maps", async () => {
  const { forwardRef, useImperativeHandle, createElement } = await import("react");
  return { default: forwardRef((props, ref) => {
    useImperativeHandle(ref, () => ({ animateToRegion: h.animate }));
    return createElement("MapView", props);
  }) };
});
vi.mock("../components/Select", () => ({ Select: "Select" }));
vi.mock("../components/order-payment", () => ({ OrderPayment: "OrderPayment" }));
vi.mock("../components/order-disputes", () => ({ OrderDisputes: "OrderDisputes" }));
vi.mock("../components/receipt-confirmation", () => ({
  ReceiptConfirmation: "ReceiptConfirmation",
}));
vi.mock("./produce-photo", () => ({ choosePhoto: vi.fn(), photoBody: vi.fn() }));
vi.mock("../localization", () => ({ LocalizedText: "Text", useUI: () => (text: string) => text }));
vi.mock("./api", () => ({ api: h.api, uuid: () => "save-key" }));
vi.mock("./device-location", async () => ({
  describePosition: h.locate,
  captureFarmPosition: h.capture,
  savedFarmPoint: (await import("./farm-location")).savedFarmPoint,
}));
vi.mock("../state", () => ({
  useApp: () => ({
    user: h.user,
    route: { id: "order", query: h.query },
    loadUser: h.load,
    setUser: h.setUser,
    go: h.go,
    returnTo: h.returnTo,
    back: h.back,
    error: (e: Error) => e.message,
    ui: (s: string) => s,
    unit: (s: string) => s,
    status: (s: string) => s,
    date: (s: string) => s,
    t: (s: string) => s,
  }),
  useResource: () => ({ data: h.data, loading: false, error: "", reload: h.reload }),
}));
import { addressInputSchema } from "../../../../packages/contracts/src/addresses";
import { Delivery, Quotes } from "../screens/delivery";
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let tree: ReactTestRenderer;
const address = { line1: "25 Market Road", city: "Ikeja", state: "Lagos", lga: "Ikeja" };
const point = { latitude: 6.6, longitude: 3.3 };
const button = (title: string) =>
  tree.root.findAllByType("Button" as any).find((n) => n.props.title === title)!;
const field = (label: string) =>
  tree.root.findAllByType("Field" as any).find((n) => n.props.label === label)!;
const pressDelivery = async () => {
  await act(async () => tree.root.findAllByType("Pressable" as any)
    .find(n => n.props.accessibilityRole === "button" && n.findAllByType("Label" as any)
      .some(label => label.props.children === "Delivery"))!.props.onPress());
};
const chooseDelivery = async () => {
  await act(async () => {
    tree = create(<Delivery />);
  });
  await pressDelivery();
};
const fillManual = async () => {
  for (const [label, value] of [["Address name", "Home"], ["Full street address", address.line1], ["City / town", address.city]])
    await act(async () => field(label!).props.onChangeText(value));
  for (const [label, value] of [["State", address.state], ["Local government area", address.lga]])
    await act(async () => tree.root.findAllByType("Select" as any)
      .find(node => node.props.label === label)!.props.onChange(value));
};
const dismissSheet = async (id: string) => {
  const modal = tree.root.findAllByType("Modal" as any).find(n => n.props.testID === id);
  if (h.platform.OS === "ios") {
    expect(modal?.props.visible).toBe(false);
    await act(async () => modal!.props.onDismiss());
  } else expect(modal).toBeUndefined();
};
beforeEach(() => {
  vi.clearAllMocks();
  h.api.mockReset();
  h.query = undefined;
  h.platform.OS = "ios";
  h.quoteBody = null;
  h.user = {
    id: "buyer",
    addresses: [],
    profile: { fullName: "Buyer", email: "buyer@example.test" },
    phoneE164: "+2348012345678",
  };
  h.data = {
    order: {
      id: "order",
      isBuyer: true,
      status: "AWAITING_PAYMENT",
      totalMinor: "10000",
      checkoutActive: false,
      suggestedPickup: {
        name: "Farmer",
        phone: "+2348098765432",
        email: "farmer@example.test",
        address: "25 Farmer Road",
        state: "Lagos",
      },
      packageSuggestion: {
        packageCount: 1,
        weightKg: 10,
        length: 20,
        width: 15,
        height: 10,
        handling: "STANDARD",
        farmer: { notes: "" },
      },
    },
    delivery: null,
  };
  h.load.mockImplementation(async () => h.user);
  h.setUser.mockImplementation(value => { h.user = typeof value === "function" ? value(h.user) : value; });
  h.locate.mockResolvedValue(address);
  h.capture.mockResolvedValue({ point, accuracy: 10 });
  h.reload.mockResolvedValue(undefined);
  h.api.mockImplementation(async (path: string, options: any) => {
    if (path === "/me/postcodes/reverse") return { found: false };
    if (path === "/me/postcodes/lookup") {
      expect(options.body).toEqual({ code: "LA-02-A09-DB-09" });
      return { postcode: options.body.code, valid: true, mode: "TEST", level: 2,
        fields: address, addressDetailsAvailable: true, verificationToken: "proof" };
    }
    if (path === "/me/addresses") {
      const input = addressInputSchema.parse(options.body);
      const saved = {
        ...input,
        id: "saved-location",
        latitude: input.coordinates?.latitude,
        longitude: input.coordinates?.longitude,
      };
      h.user = { ...h.user, addresses: [saved] };
      return { address: saved };
    }
    if (path === "/orders/order/delivery/quotes") {
      h.quoteBody = options.body;
      const quote = { id: "rate", courier: "Test carrier", amountMinor: "1000", available: true,
        expiresAt: new Date(Date.now() + 60000).toISOString() };
      h.data = { ...h.data, delivery: { destination: options.body.destination, package: options.body.parcel,
        status: "QUOTE_REQUIRED", shippingMinor: "0", paidMinor: "0", selectedQuoteId: null, quotes: [quote] } };
      return { items: [quote] };
    }
    if (path === "/orders/order/delivery/select") {
      h.data = { ...h.data, order: { ...h.data.order, checkoutReady: true, payableMinor: "11000" },
        delivery: { ...h.data.delivery, selectedQuoteId: options.body.quoteId, shippingMinor: "1000" } };
      return {};
    }
    throw new Error(`Unexpected route: ${path}`);
  });
});
afterEach(async () => {
  await act(async () => tree?.unmount());
});
it.each(["ios", "android"].flatMap(platform => ["map", "manual", "code"].map(method => ({ platform, method }))))(
  "preserves the $method destination on $platform through location, review, carriers and payment summary without requesting a code again",
  async ({ platform, method }) => {
    h.platform.OS = platform;
    await chooseDelivery();
    if (method === "map") {
      await act(async () => button("Use current location").props.onPress());
      expect(h.capture).toHaveBeenCalledOnce();
      expect(button("Continue").props.disabled).toBe(true);
      await act(async () => button("Confirm location pin").props.onPress());
      if (platform === "ios") expect(h.go).not.toHaveBeenCalled();
      await dismissSheet("farm-pin");
      expect(h.go).toHaveBeenLastCalledWith("quotes", "order", "saved-location");
    } else {
      await act(async () => button("Add Address").props.onPress());
      if (method === "code") {
        await act(async () => button("Use a digital code (optional)").props.onPress());
        await act(async () => field("Digital postcode (optional)").props.onChangeText("LA-02-A09-DB-09"));
        await act(async () => button("Check postcode").props.onPress());
        await act(async () => button("Use these postcode details").props.onPress());
      } else {
        for (const [label, value] of [
          ["Address name", "Home"],
          ["Full street address", address.line1],
          ["City / town", address.city],
        ])
          await act(async () => field(label!).props.onChangeText(value));
        for (const [label, value] of [
          ["State", address.state],
          ["Local government area", address.lga],
        ])
          await act(async () =>
            tree.root
              .findAllByType("Select" as any)
              .find((n) => n.props.label === label)!
              .props.onChange(value),
          );
        await act(async () =>
          field("Additional directions (optional)").props.onChangeText("Call at the green gate"),
        );
      }
      await act(async () => button("Save address").props.onPress());
      await dismissSheet("checkout-address");
      await act(async () => button("Continue").props.onPress());
    }
    h.query = h.go.mock.calls.at(-1)![2];
    await act(async () => tree.update(<Quotes />));
    expect(field("Digital postcode (optional)")).toBeUndefined();
    expect(tree.root.findAllByType("Field" as any)).toHaveLength(1); // pickup date only
    expect(JSON.stringify(tree.toJSON())).not.toContain("No digital postcode added");
    expect(button("Continue to delivery options").props.disabled).toBe(false);
    // A background refresh cannot drop the selected saved location or contact.
    h.data = { ...h.data };
    await act(async () => tree.update(<Quotes />));
    await act(async () => button("Continue to delivery options").props.onPress());
    expect(h.quoteBody.destination).toMatchObject({
      addressId: "saved-location",
      address: "25 Market Road, Ikeja, Ikeja",
      state: "Lagos",
      name: "Buyer",
      phone: "+2348012345678",
      email: "buyer@example.test",
    });
    expect(h.quoteBody.destination.postalCode).toBe(method === "code" ? "LA-02-A09-DB-09" : null);
    if (method === "map") expect(h.quoteBody.destination).toMatchObject(point);
    else {
      expect(h.quoteBody.destination.latitude).toBeUndefined();
      expect(h.quoteBody.destination.longitude).toBeUndefined();
    }
    if (method === "manual")
      expect(h.quoteBody.destination.instructions).toBe("Call at the green gate");
    expect(h.returnTo).toHaveBeenCalledWith("delivery", "order", "delivery-carriers");
    expect(h.api.mock.calls.filter(([path]) => path.startsWith("/me/postcodes/"))).toHaveLength(method === "code" ? 1 : 0);
    h.query = "delivery-carriers";
    await act(async () => tree.update(<Delivery />));
    await act(async () => tree.root.findAllByType("Pressable" as any)
      .find(n => n.props.accessibilityRole === "radio")!.props.onPress());
    await act(async () => tree.update(<Delivery />));
    expect(button("Continue").props.disabled).toBe(false);
    await act(async () => button("Continue").props.onPress());
    expect(tree.root.findAllByType("OrderPayment" as any)).toHaveLength(1);
    expect(JSON.stringify(tree.toJSON())).toContain("25 Market Road, Ikeja, Ikeja");
    expect(h.data.delivery.destination).toEqual(h.quoteBody.destination);
  },
);
it.each(["ios", "android"])("retains a partial map draft through Back and manual/code switching on %s", async platform => {
  h.platform.OS = platform;
  h.locate.mockResolvedValue({ city: address.city, state: address.state, lga: address.lga, postalCode: "100001" });
  await chooseDelivery();
  await act(async () => button("Use current location").props.onPress());
  await act(async () => button("Confirm location pin").props.onPress());
  await dismissSheet("farm-pin");
  expect(field("Full street address")).toBeDefined();
  expect(field("City / town")).toBeUndefined();
  expect(button("Save address").props.disabled).toBe(true);
  expect(h.api.mock.calls.filter(([path]) => path === "/me/addresses")).toHaveLength(0);
  await act(async () => field("Full street address").props.onChangeText("25 Ma"));
  await act(async () => button("Use a digital code (optional)").props.onPress());
  await act(async () => field("Digital postcode (optional)").props.onChangeText("unfinished-code"));
  expect(button("Check postcode").props.disabled).toBe(true);
  await act(async () => button("Enter address manually").props.onPress());
  await act(async () => tree.root.findAllByType("Modal" as any)
    .find(node => node.props.testID === "checkout-address")!.props.onRequestClose());
  await dismissSheet("checkout-address");
  await act(async () => tree.root.findAllByType("Pressable" as any)
    .find(node => node.props.accessibilityLabel === "Go back")!.props.onPress());
  expect(JSON.stringify(tree.toJSON())).toContain("Pickup or delivery?");
  await pressDelivery();
  await act(async () => button("Add Address").props.onPress());
  expect(field("Full street address").props.value).toBe("25 Ma");
  await act(async () => field("Full street address").props.onChangeText(address.line1));
  await act(async () => field("Additional directions (optional)").props.onChangeText("Call at the side gate"));
  await act(async () => field("Landmark (optional)").props.onChangeText("Green shop"));
  await act(async () => button("Save address").props.onPress());
  await dismissSheet("checkout-address");
  expect(h.go).toHaveBeenLastCalledWith("quotes", "order", "saved-location");
  h.query = "saved-location";
  await act(async () => tree.update(<Quotes />));
  await act(async () => button("Continue to delivery options").props.onPress());
  expect(h.quoteBody.destination).toMatchObject({
    addressId: "saved-location", address: "25 Market Road, Ikeja, Ikeja", ...point,
    postalCode: "100001", instructions: "Call at the side gate · Landmark: Green shop",
  });
  expect(h.api.mock.calls.filter(([path]) => path.startsWith("/me/postcodes/"))).toHaveLength(1);
});
it.each(["ios", "android"])("allows manual checkout after denied GPS permission on %s", async platform => {
  h.platform.OS = platform;
  h.capture.mockRejectedValue(new Error("Location access was not allowed. Enable location in Settings."));
  await chooseDelivery();
  await act(async () => button("Use current location").props.onPress());
  expect(tree.root.findAllByType("Notice" as any).some(node => node.props.error)).toBe(true);
  expect(button("Add Address").props.disabled).toBe(false);
  await act(async () => button("Add Address").props.onPress());
  await fillManual();
  await act(async () => button("Save address").props.onPress());
  await dismissSheet("checkout-address");
  await act(async () => button("Continue").props.onPress());
  h.query = "saved-location";
  await act(async () => tree.update(<Quotes />));
  await act(async () => button("Continue to delivery options").props.onPress());
  expect(h.quoteBody.destination).toMatchObject({ addressId: "saved-location", address: "25 Market Road, Ikeja, Ikeja", postalCode: null });
  expect(h.quoteBody.destination.latitude).toBeUndefined();
  expect(h.locate).not.toHaveBeenCalled();
  expect(h.api.mock.calls.filter(([path]) => path.startsWith("/me/postcodes/"))).toHaveLength(0);
});
it.each(["ios", "android"])("returns to the selected saved address rather than a different default on %s", async platform => {
  h.platform.OS = platform;
  h.user.addresses = [
    { ...address, id: "default", label: "Home", line1: "25 Different Default Street", isDefaultDelivery: true },
    { id: "office", label: "Office", line1: "42 Office Road", city: "Abuja", lga: "Bwari", state: "Federal Capital Territory",
      latitude: 9.08, longitude: 7.4, postalCode: "FC-02-A09-DB-09", line2: "Use reception" },
  ];
  await chooseDelivery();
  await act(async () => button("Change Address").props.onPress());
  await act(async () => button("Office · 42 Office Road, Abuja").props.onPress());
  if (platform === "ios") expect(h.returnTo).not.toHaveBeenCalled();
  await dismissSheet("checkout-address");
  await act(async () => button("Continue").props.onPress());
  expect(h.returnTo).toHaveBeenLastCalledWith("delivery", "order", "office");
  expect(h.go).toHaveBeenLastCalledWith("quotes", "order", "office");
  h.query = "office";
  await act(async () => tree.update(<Quotes />));
  expect(JSON.stringify(tree.toJSON())).toContain("42 Office Road");
  expect(JSON.stringify(tree.toJSON())).toContain("Use reception");
  await act(async () => tree.root.findByType("Page" as any).props.back());
  expect(h.back).toHaveBeenCalledOnce();
  await act(async () => tree.update(<Delivery />));
  expect(JSON.stringify(tree.toJSON())).toContain("42 Office Road");
  expect(JSON.stringify(tree.toJSON())).not.toContain("25 Different Default Street");
  expect(button("Continue").props.disabled).toBe(false);
  expect(h.api).not.toHaveBeenCalled();
});
it.each(["ios", "android"])("locks checkout actions until a cancelled address sheet closes on %s", async platform => {
  h.platform.OS = platform;
  h.user.addresses = [{ ...address, id: "home", label: "Home", isDefaultDelivery: true }];
  await chooseDelivery();
  expect(button("Continue").props.disabled).toBe(false);
  await act(async () => button("Change Address").props.onPress());
  expect(button("Continue").props.disabled).toBe(true);
  await act(async () => tree.root.findByType("Modal" as any).props.onRequestClose());
  if (platform === "ios") {
    expect(button("Continue").props.disabled).toBe(true);
    expect(button("Use current location").props.disabled).toBe(true);
  }
  await dismissSheet("checkout-address");
  expect(button("Continue").props.disabled).toBe(false);
  expect(button("Use current location").props.disabled).toBe(false);
  expect(h.api).not.toHaveBeenCalled();
  expect(h.go).not.toHaveBeenCalled();
});
