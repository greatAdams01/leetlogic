import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  api: vi.fn(),
  load: vi.fn(),
  saved: vi.fn(),
  next: vi.fn(),
  locate: vi.fn(),
  setUser: vi.fn(),
  uuid: vi.fn(),
  user: {
    id: "buyer",
    profile: { fullName: "New buyer" },
    phoneE164: "+2348000000000",
    addresses: [] as any[],
  },
}));
vi.mock("react-native", () => ({ View: "View" }));
vi.mock("../state", () => ({
  useApp: () => ({ user: h.user, setUser: h.setUser, loadUser: h.load, error: (e: Error) => e.message }),
}));
vi.mock("./api", () => ({ api: h.api, uuid: h.uuid }));
vi.mock("./device-location", async () => ({
  describePosition: h.locate,
  savedFarmPoint: (await import("./farm-location")).savedFarmPoint,
}));
vi.mock("../components/farm-pin", () => ({ FarmPin: "FarmPin" }));
vi.mock("../components/postcode-entry", () => ({ PostcodeEntry: "PostcodeEntry" }));
vi.mock("../components/Select", () => ({ Select: "Select" }));
vi.mock("../components/ui", () => ({
  Button: "Button",
  Card: "Card",
  Field: "Field",
  Label: "Label",
  Notice: "Notice",
}));
vi.mock("../components/app-sheet", () => ({
  AppSheet: ({ visible, children, footer, ...props }: any) =>
    visible ? React.createElement("Sheet", props, children, footer) : null,
}));
import { CheckoutDeliveryAddress } from "../components/checkout-delivery-address";
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let tree: ReactTestRenderer;
const address = {
  id: "home",
  label: "Home",
  line1: "25 Market Street",
  city: "Ikeja",
  state: "Lagos",
  lga: "Ikeja",
  isDefaultDelivery: true,
};
const button = (title: string) =>
  tree.root.findAllByType("Button" as any).find((node) => node.props.title === title)!;
const field = (label: string) =>
  tree.root.findAllByType("Field" as any).find((node) => node.props.label === label)!;
const render = async (saved?: any, props: Partial<React.ComponentProps<typeof CheckoutDeliveryAddress>> = {}) => {
  await act(async () => {
    tree = create(
      <CheckoutDeliveryAddress address={saved} onSaved={h.saved} onLocationSaved={h.next} {...props} />,
    );
  });
};
const manualDetails = async () => {
  for (const [label, value] of [
    ["Address name", "Home"],
    ["Full street address", address.line1],
    ["City / town", address.city],
  ]) await act(async () => field(label!).props.onChangeText(value));
  for (const [label, value] of [["State", address.state], ["Local government area", address.lga]])
    await act(async () => tree.root.findAllByType("Select" as any)
      .find(node => node.props.label === label)!.props.onChange(value));
};
const verifyCode = async () => {
  await act(async () => button("Use a digital code (optional)").props.onPress());
  await act(async () => tree.root.findByType("PostcodeEntry" as any).props.onVerified({
    postcode: "LA-02-A09-DB-09", verificationToken: "proof",
    fields: { line1: address.line1, city: address.city, state: address.state, lga: address.lga },
  }));
};
beforeEach(() => {
  vi.clearAllMocks();
  h.api.mockReset();
  h.load.mockReset();
  h.locate.mockReset();
  h.uuid.mockReset();
  h.uuid.mockReturnValue("address-key");
  h.user.id = "buyer";
  h.user.addresses = [];
  h.setUser.mockImplementation(value => { h.user = typeof value === "function" ? value(h.user) : value; });
  h.load.mockResolvedValue(h.user);
  h.api.mockResolvedValue({ address });
  h.locate.mockResolvedValue({
    line1: address.line1,
    city: address.city,
    state: address.state,
    lga: address.lga,
  });
});
afterEach(async () => {
  await act(async () => tree?.unmount());
});
it("guides a first-time buyer without showing the postcode or address form by default", async () => {
  await render();
  expect(button("Add Address")).toBeTruthy();
  expect(button("Change Address")).toBeUndefined();
  expect(button("Enter Code")).toBeUndefined();
  expect(button("Enter Address")).toBeUndefined();
  expect(tree.root.findByType("FarmPin" as any).props.compact).toBe(true);
  expect(tree.root.findAllByType("PostcodeEntry" as any)).toHaveLength(0);
  expect(tree.root.findAllByType("Sheet" as any)).toHaveLength(0);
  expect(tree.root.findAllByType("Notice" as any)[0]!.props.text).toContain("before you continue");
});
it("saves a complete manual address and returns directly to the delivery step", async () => {
  await render();
  await act(async () => button("Add Address").props.onPress());
  expect(button("Save address").props.disabled).toBe(true);
  for (const [label, value] of [
    ["Address name", "Home"],
    ["Full street address", address.line1],
    ["City / town", address.city],
  ])
    await act(async () => field(label!).props.onChangeText(value));
  for (const [label, value] of [
    ["State", "Lagos"],
    ["Local government area", "Ikeja"],
  ])
    await act(async () =>
      tree.root
        .findAllByType("Select" as any)
        .find((node) => node.props.label === label)!
        .props.onChange(value),
    );
  expect(button("Save address").props.disabled).toBe(false);
  const dismissed = tree.root.findByType("Sheet" as any).props.onDismiss;
  await act(async () => button("Save address").props.onPress());
  await act(async () => dismissed());
  expect(h.api).toHaveBeenCalledWith(
    "/me/addresses",
    expect.objectContaining({
      method: "POST",
      key: "address-key",
      body: expect.objectContaining({
        line1: address.line1,
        isDefaultDelivery: true,
        postalCode: null,
      }),
    }),
  );
  expect(h.load).toHaveBeenCalledOnce();
  expect(h.saved).toHaveBeenCalledWith(address);
  expect(tree.root.findAllByType("Sheet" as any)).toHaveLength(0);
});
it("saves a complete map address with the confirmed pin and advances automatically", async () => {
  await render();
  const point = { latitude: 6.6, longitude: 3.3 };
  await act(async () => tree.root.findByType("FarmPin" as any).props.onConfirm(point));
  await act(async () => tree.root.findByType("FarmPin" as any).props.onConfirmationClosed());
  expect(h.saved).toHaveBeenCalledWith(address);
  expect(h.next).toHaveBeenCalledWith(address);
  expect(h.api).toHaveBeenCalledWith(
    "/me/addresses",
    expect.objectContaining({
      body: expect.objectContaining({ coordinates: point, line1: address.line1 }),
    }),
  );
  expect(tree.root.findAllByType("Sheet" as any)).toHaveLength(0);
});
it("requires missing map address details instead of proceeding on coordinates alone", async () => {
  h.locate.mockResolvedValue(null);
  await render();
  await act(async () =>
    tree.root.findByType("FarmPin" as any).props.onConfirm({ latitude: 6.6, longitude: 3.3 }),
  );
  expect(tree.root.findAllByType("Sheet" as any)).toHaveLength(0);
  await act(async () => tree.root.findByType("FarmPin" as any).props.onConfirmationClosed());
  expect(tree.root.findAllByType("Sheet" as any)).toHaveLength(1);
  expect(button("Save address").props.disabled).toBe(true);
  expect(h.api.mock.calls.some(([path]) => path === "/me/addresses")).toBe(false);
  expect(h.saved).not.toHaveBeenCalled();
  expect(h.next).not.toHaveBeenCalled();
});
it("shows a failed save and does not advance checkout", async () => {
  h.api.mockRejectedValue(new Error("Check your connection and try again."));
  await render();
  await act(async () =>
    tree.root.findByType("FarmPin" as any).props.onConfirm({ latitude: 6.6, longitude: 3.3 }),
  );
  expect(h.saved).not.toHaveBeenCalled();
  expect(h.next).not.toHaveBeenCalled();
  expect(button("Add Address")).toBeTruthy();
  expect(
    tree.root.findAllByType("Notice" as any).some((node) => node.props.text.includes("connection")),
  ).toBe(true);
});
it("offers Change Address only for a valid saved address and selects saved alternatives", async () => {
  h.user.addresses = [address];
  await render(address);
  expect(button("Change Address")).toBeTruthy();
  expect(button("Add Address")).toBeUndefined();
  await act(async () => button("Change Address").props.onPress());
  const dismissed = tree.root.findByType("Sheet" as any).props.onDismiss;
  await act(async () => button("Home · 25 Market Street, Ikeja").props.onPress());
  await act(async () => dismissed());
  expect(h.saved).toHaveBeenCalledWith(address);
  expect(h.api.mock.calls.some(([path]) => path === "/me/addresses")).toBe(false);
});
it("does not save a late map result after leaving checkout", async () => {
  let resolve!: (place: unknown) => void;
  h.locate.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  await render();
  let pending!: Promise<void>;
  await act(async () => {
    pending = tree.root
      .findByType("FarmPin" as any)
      .props.onConfirm({ latitude: 6.6, longitude: 3.3 });
  });
  await act(async () => tree.unmount());
  await act(async () => {
    resolve({ line1: address.line1, city: address.city, state: address.state, lga: address.lga });
    await pending;
  });
  expect(h.api.mock.calls.some(([path]) => path === "/me/addresses")).toBe(false);
  expect(h.saved).not.toHaveBeenCalled();
  expect(h.next).not.toHaveBeenCalled();
});
it("asks only for missing map details and preserves the pin when completing them", async () => {
  h.locate.mockResolvedValue({ line1: address.line1, city: address.city, state: address.state });
  await render();
  const point = { latitude: 6.6, longitude: 3.3 };
  await act(async () => tree.root.findByType("FarmPin" as any).props.onConfirm(point));
  await act(async () => tree.root.findByType("FarmPin" as any).props.onConfirmationClosed());
  expect(field("Full street address")).toBeUndefined();
  expect(field("City / town")).toBeUndefined();
  const lga = tree.root
    .findAllByType("Select" as any)
    .find((n) => n.props.label === "Local government area")!;
  await act(async () => lga.props.onChange("Ikeja"));
  const dismissed = tree.root.findByType("Sheet" as any).props.onDismiss;
  await act(async () => button("Save address").props.onPress());
  await act(async () => dismissed());
  expect(h.api).toHaveBeenCalledWith(
    "/me/addresses",
    expect.objectContaining({
      body: expect.objectContaining({
        coordinates: point,
        line1: address.line1,
        city: address.city,
        lga: "Ikeja",
      }),
    }),
  );
  expect(h.next).toHaveBeenCalledWith(address);
});
it("can abandon an unavailable or incomplete code and save the full manual address", async () => {
  await render();
  await act(async () => button("Add Address").props.onPress());
  await act(async () => button("Use a digital code (optional)").props.onPress());
  await act(async () =>
    tree.root.findByType("PostcodeEntry" as any).props.onChange("incomplete-code"),
  );
  await act(async () => tree.root.findByType("PostcodeEntry" as any).props.onManual());
  for (const [label, value] of [
    ["Address name", "Home"],
    ["Full street address", address.line1],
    ["City / town", address.city],
  ])
    await act(async () => field(label!).props.onChangeText(value));
  for (const [label, value] of [
    ["State", "Lagos"],
    ["Local government area", "Ikeja"],
  ])
    await act(async () =>
      tree.root
        .findAllByType("Select" as any)
        .find((n) => n.props.label === label)!
        .props.onChange(value),
    );
  expect(button("Save address").props.disabled).toBe(false);
  await act(async () => button("Save address").props.onPress());
  expect(h.api).toHaveBeenCalledWith(
    "/me/addresses",
    expect.objectContaining({
      body: expect.objectContaining({ postalCode: null, verificationToken: null }),
    }),
  );
});
it("does not advance or unmount the map until its native sheet has closed", async () => {
  await render();
  await act(async () =>
    tree.root.findByType("FarmPin" as any).props.onConfirm({ latitude: 6.6, longitude: 3.3 }),
  );
  expect(h.saved).not.toHaveBeenCalled();
  expect(h.next).not.toHaveBeenCalled();
  await act(async () => tree.root.findByType("FarmPin" as any).props.onConfirmationClosed());
  expect(h.saved).toHaveBeenCalledWith(address);
  expect(h.next).toHaveBeenCalledWith(address);
});
it("keeps a missing street field mounted while the buyer types past its minimum length", async () => {
  h.locate.mockResolvedValue({ city: address.city, state: address.state, lga: address.lga });
  await render();
  await act(async () =>
    tree.root.findByType("FarmPin" as any).props.onConfirm({ latitude: 6.6, longitude: 3.3 }),
  );
  await act(async () => tree.root.findByType("FarmPin" as any).props.onConfirmationClosed());
  await act(async () => field("Full street address").props.onChangeText("25 Ma"));
  expect(field("Full street address")).toBeDefined();
  await act(async () => field("Full street address").props.onChangeText(address.line1));
  expect(field("Full street address").props.value).toBe(address.line1);
});
it("prefills a saved address and its pin when the buyer changes delivery details", async () => {
  await render({ ...address, latitude: 6.6, longitude: 3.3, line2: "Use the green gate" });
  await act(async () => button("Change Address").props.onPress());
  expect(field("Full street address").props.value).toBe(address.line1);
  expect(field("City / town").props.value).toBe(address.city);
  expect(field("Additional directions (optional)").props.value).toBe("Use the green gate");
});
it("retains a successfully saved address even when the account refresh fails", async () => {
  h.load.mockRejectedValue(new Error("Account refresh unavailable"));
  await render();
  await act(async () =>
    tree.root.findByType("FarmPin" as any).props.onConfirm({ latitude: 6.6, longitude: 3.3 }),
  );
  await act(async () => tree.root.findByType("FarmPin" as any).props.onConfirmationClosed());
  expect(h.saved).toHaveBeenCalledWith(address);
  expect(h.next).toHaveBeenCalledWith(address);
  expect(h.api.mock.calls.filter(([path]) => path === "/me/addresses")).toHaveLength(1);
});
it("does not restore the old saved pin after the draft changes state", async () => {
  await render({ ...address, latitude: 6.6, longitude: 3.3 });
  await act(async () => button("Change Address").props.onPress());
  await act(async () => tree.root.findAllByType("Select" as any)
    .find(node => node.props.label === "State")!.props.onChange("Ogun"));
  expect(tree.root.findByType("FarmPin" as any).props.value).toBeUndefined();
});
it("clears an unrelated pin when code details replace the draft address", async () => {
  await render({ ...address, latitude: 6.6, longitude: 3.3 });
  await act(async () => button("Change Address").props.onPress());
  await act(async () => button("Use a digital code (optional)").props.onPress());
  await act(async () => tree.root.findByType("PostcodeEntry" as any).props.onVerified({
    postcode: "OY-02-A09-DB-09", verificationToken: "new-proof",
    fields: { line1: "42 New Market Road", city: "Ibadan", state: "Oyo", lga: "Ibadan North" },
  }));
  expect(tree.root.findByType("FarmPin" as any).props.value).toBeUndefined();
  await act(async () => button("Save address").props.onPress());
  expect(h.api).toHaveBeenCalledWith("/me/addresses", expect.objectContaining({
    body: expect.objectContaining({ coordinates: null, verificationToken: "new-proof" }),
  }));
});
it.each(["POSTCODE_VERIFICATION_EXPIRED", "POSTCODE_ADDRESS_MISMATCH"])(
  "allows an unverified retry after %s without dropping the address or reusing its save key", async code => {
    h.uuid.mockReturnValueOnce("verified-save").mockReturnValueOnce("manual-retry");
    h.api.mockRejectedValueOnce(Object.assign(new Error("Review the postcode or save without verification."), { code }));
    await render();
    await act(async () => button("Add Address").props.onPress());
    await verifyCode();
    await act(async () => field("Additional directions (optional)").props.onChangeText("Use the green gate"));
    await act(async () => button("Save address").props.onPress());
    expect(h.saved).not.toHaveBeenCalled();
    expect(button("Save address").props.disabled).toBe(false);
    const dismissed = tree.root.findByType("Sheet" as any).props.onDismiss;
    await act(async () => button("Save address").props.onPress());
    await act(async () => dismissed());
    expect(h.api.mock.calls[0]![1]).toMatchObject({ key: "verified-save", body: { verificationToken: "proof" } });
    expect(h.api.mock.calls[1]![1]).toMatchObject({ key: "manual-retry", body: {
      line1: address.line1, postalCode: "LA-02-A09-DB-09", verificationToken: null, line2: "Use the green gate",
    } });
    expect(h.saved).toHaveBeenCalledOnce();
  },
);
it("does not restore expired verification when abandoning a second code attempt", async () => {
  await render();
  await act(async () => button("Add Address").props.onPress());
  await verifyCode();
  await act(async () => button("Use a digital code (optional)").props.onPress());
  h.api.mockRejectedValueOnce(Object.assign(new Error("Check again or save without verification."), {
    code: "POSTCODE_VERIFICATION_EXPIRED",
  }));
  await act(async () => button("Save address").props.onPress());
  await act(async () => tree.root.findByType("PostcodeEntry" as any).props.onManual());
  await act(async () => button("Save address").props.onPress());
  expect(h.api.mock.calls.at(-1)![1].body).toMatchObject({ postalCode: "LA-02-A09-DB-09", verificationToken: null });
});
it("does not restore a baseline proof after editing its street during code entry", async () => {
  await render();
  await act(async () => button("Add Address").props.onPress());
  await verifyCode();
  await act(async () => button("Edit resolved details").props.onPress());
  await act(async () => button("Use a digital code (optional)").props.onPress());
  await act(async () => field("Full street address").props.onChangeText("42 Different Market Road"));
  await act(async () => tree.root.findByType("PostcodeEntry" as any).props.onManual());
  await act(async () => button("Save address").props.onPress());
  expect(h.api.mock.calls.at(-1)![1].body).toMatchObject({ line1: "42 Different Market Road", verificationToken: null });
});
it("releases the interaction lock when checkout becomes disabled during saved-address dismissal", async () => {
  const busy = vi.fn();
  h.user.addresses = [address];
  await render(address, { onBusyChange: busy });
  await act(async () => button("Change Address").props.onPress());
  const dismissed = tree.root.findByType("Sheet" as any).props.onDismiss;
  await act(async () => button("Home · 25 Market Street, Ikeja").props.onPress());
  expect(busy).toHaveBeenLastCalledWith(true);
  await act(async () => tree.update(
    <CheckoutDeliveryAddress address={address} onSaved={h.saved} onLocationSaved={h.next} onBusyChange={busy} disabled />,
  ));
  await act(async () => dismissed());
  expect(busy).toHaveBeenLastCalledWith(false);
  expect(h.saved).not.toHaveBeenCalled();
  expect(h.next).not.toHaveBeenCalled();
});
it("does not attach a new partially resolved location to an unrelated manual street", async () => {
  await render();
  await act(async () => button("Add Address").props.onPress());
  await manualDetails();
  const dismissed = tree.root.findByType("Sheet" as any).props.onDismiss;
  await act(async () => tree.root.findByType("Sheet" as any).props.onClose());
  await act(async () => dismissed());
  h.locate.mockResolvedValue({ state: "Ogun", city: "Abeokuta", lga: "Abeokuta North" });
  h.api.mockImplementation(async path => path === "/me/addresses" ? { address } : { found: false });
  const point = { latitude: 7.15, longitude: 3.35 };
  await act(async () => tree.root.findByType("FarmPin" as any).props.onConfirm(point));
  await act(async () => tree.root.findByType("FarmPin" as any).props.onConfirmationClosed());
  expect(h.api.mock.calls.filter(([path]) => path === "/me/addresses")).toHaveLength(0);
  expect(field("Full street address").props.value).toBe("");
  expect(tree.root.findByType("FarmPin" as any).props.value).toEqual(point);
  expect(h.next).not.toHaveBeenCalled();
});
it("starts a clean draft when the active account changes", async () => {
  await render();
  await act(async () => button("Add Address").props.onPress());
  await manualDetails();
  await verifyCode();
  h.user = { ...h.user, id: "another-buyer", addresses: [] };
  await act(async () => tree.update(<CheckoutDeliveryAddress onSaved={h.saved} onLocationSaved={h.next} />));
  await act(async () => button("Add Address").props.onPress());
  expect(field("Full street address").props.value).toBe("");
  expect(button("Save address").props.disabled).toBe(true);
  expect(h.api).not.toHaveBeenCalled();
});
it("keeps verification when only delivery directions and the landmark change", async () => {
  await render();
  await act(async () => button("Add Address").props.onPress());
  await verifyCode();
  await act(async () => field("Additional directions (optional)").props.onChangeText("  Use the side gate  "));
  await act(async () => field("Landmark (optional)").props.onChangeText("  Green shop  "));
  await act(async () => button("Save address").props.onPress());
  expect(h.api).toHaveBeenCalledWith("/me/addresses", expect.objectContaining({ body: expect.objectContaining({
    verificationToken: "proof", line2: "Use the side gate", landmark: "Green shop",
  }) }));
});
it.each([null, {}, { address: { ...address, line1: "" } }, { address: { ...address, id: 42 } }, { address: { ...address, id: " " } }])("does not advance on a malformed address-save response (%j)", async response => {
  h.api.mockResolvedValue(response);
  await render();
  await act(async () => button("Add Address").props.onPress());
  await manualDetails();
  await act(async () => button("Save address").props.onPress());
  expect(h.saved).not.toHaveBeenCalled();
  expect(h.next).not.toHaveBeenCalled();
  expect(h.load).not.toHaveBeenCalled();
  expect(tree.root.findAllByType("Notice" as any).some(node => node.props.error)).toBe(true);
  expect(button("Save address").props.disabled).toBe(false);
});
it("submits one save at a time and retains the idempotency key for a lost-response retry", async () => {
  let fail!: (error: Error) => void;
  h.api.mockImplementationOnce(() => new Promise((_, reject) => { fail = reject; }));
  await render();
  await act(async () => button("Add Address").props.onPress());
  await manualDetails();
  const save = button("Save address").props.onPress;
  await act(async () => { save(); save(); });
  expect(h.api).toHaveBeenCalledOnce();
  expect(button("Saving…").props.disabled).toBe(true);
  await act(async () => fail(new Error("Response lost. Please try again.")));
  await act(async () => button("Save address").props.onPress());
  expect(h.api).toHaveBeenCalledTimes(2);
  expect(h.api.mock.calls[1]![1].key).toBe(h.api.mock.calls[0]![1].key);
  expect(h.uuid).toHaveBeenCalledOnce();
});
it("ignores an address write that completes after switching accounts", async () => {
  let finish!: (response: unknown) => void;
  h.api.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await render();
  await act(async () => button("Add Address").props.onPress());
  await manualDetails();
  await act(async () => button("Save address").props.onPress());
  h.user = { ...h.user, id: "another-buyer", addresses: [] };
  await act(async () => tree.update(<CheckoutDeliveryAddress onSaved={h.saved} onLocationSaved={h.next} />));
  await act(async () => finish({ address }));
  expect(h.load).not.toHaveBeenCalled();
  expect(h.setUser).not.toHaveBeenCalled();
  expect(h.saved).not.toHaveBeenCalled();
  expect(h.next).not.toHaveBeenCalled();
});
it("keeps a failed-save draft and its postal reference when reopening address entry", async () => {
  h.api.mockRejectedValueOnce(new Error("Connection lost"));
  h.locate.mockResolvedValue({ line1: address.line1, city: address.city, state: address.state, lga: address.lga, postalCode: "100001" });
  await render();
  const point = { latitude: 6.6, longitude: 3.3 };
  await act(async () => tree.root.findByType("FarmPin" as any).props.onConfirm(point));
  await act(async () => tree.root.findByType("FarmPin" as any).props.onConfirmationClosed());
  await act(async () => button("Use a digital code (optional)").props.onPress());
  await act(async () => tree.root.findByType("PostcodeEntry" as any).props.onChange("unfinished"));
  await act(async () => tree.root.findByType("PostcodeEntry" as any).props.onManual());
  const dismissed = tree.root.findByType("Sheet" as any).props.onDismiss;
  await act(async () => tree.root.findByType("Sheet" as any).props.onClose());
  await act(async () => dismissed());
  await act(async () => button("Add Address").props.onPress());
  await act(async () => button("Save address").props.onPress());
  expect(h.api.mock.calls.at(-1)![1].body).toMatchObject({ line1: address.line1, coordinates: point, postalCode: "100001", verificationToken: null });
});
