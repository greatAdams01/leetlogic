import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FarmForm } from "./verification";
import type { PostcodeLookup } from "../../../../packages/contracts/src/addresses";

const h = vi.hoisted(() => ({ api: vi.fn(), load: vi.fn(), get: vi.fn(), set: vi.fn(), remove: vi.fn() }));
vi.mock("expo-file-system", () => ({ File: class {} }));
vi.mock("expo-image-picker", () => ({}));
vi.mock("expo-secure-store", () => ({ getItemAsync: h.get, setItemAsync: h.set, deleteItemAsync: h.remove }));
vi.mock("@react-native-async-storage/async-storage", () => ({ default: { setItem: vi.fn().mockResolvedValue(undefined) } }));
vi.mock("react-native", () => ({
  Image: "Image", Pressable: "Pressable", View: "View",
  BackHandler: { addEventListener: () => ({ remove() {} }) },
}));
vi.mock("../localization", () => ({ LocalizedText: "Text" }));
vi.mock("../state", () => ({ useApp: () => ({
  user: { id: "seller", addresses: [] }, loadUser: h.load, ui: (text: string) => text,
  error: (error: { code?: string; message?: string }) => error.code || error.message,
  back: vi.fn(), go: vi.fn(), reset: vi.fn(), notify: vi.fn(), status: (status: string) => status,
}) }));
vi.mock("./api", () => ({ api: h.api }));
vi.mock("./produce-photo", () => ({ choosePhoto: vi.fn(), photoBody: vi.fn() }));
vi.mock("../components/farm-pin", () => ({ FarmPin: "FarmPin" }));
vi.mock("../components/dojah-identity", () => ({ DojahIdentity: "DojahIdentity" }));
vi.mock("../components/feedback", () => ({ Confirmation: "Confirmation" }));
vi.mock("../components/Select", () => ({ Select: "Select" }));
vi.mock("../components/postcode-entry", () => ({ PostcodeEntry: "PostcodeEntry" }));
vi.mock("../components/ui", async () => {
  const { createElement } = await import("react");
  return {
    colors: {}, s: {},
    ...Object.fromEntries(["Page", "Heading", "Label", "Field", "Button", "Card", "Notice"].map((name) => [name,
      ({ children, footer, ...props }: { children?: React.ReactNode; footer?: React.ReactNode }) => createElement(name, props, children, footer),
    ])),
  };
});
import { Seller } from "../screens/seller";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const farm: FarmForm = {
  farmName: "Community farm", farmType: "Crop farming", description: "", state: "Lagos", lga: "Ikeja",
  city: "Lagos", line1: "12 Farm Road", postalCode: "LA-01-A03-FK-01", coordinates: { latitude: 6.52, longitude: 3.37 },
};
const lookup: PostcodeLookup = {
  postcode: farm.postalCode!, valid: true, mode: "LIVE", level: 2,
  fields: { state: farm.state, lga: farm.lga, city: farm.city, line1: farm.line1 },
  addressDetailsAvailable: true, verificationToken: "server-issued-proof",
};
let tree: ReactTestRenderer;
const field = (label: string) => tree.root.findAllByType("Field" as never).find((node) => node.props.label === label)!;
const button = (title: string) => tree.root.findAllByType("Button" as never).find((node) => node.props.title === title)!;
const postcode = () => tree.root.findByType("PostcodeEntry" as never);
const saves = () => h.api.mock.calls.filter(([path]) => path === "/me/seller-profile");
const mount = async () => { await act(async () => { tree = create(<Seller />); }); };
const save = async () => { await act(async () => { button("Save and continue").props.onPress(); }); };

beforeEach(() => {
  vi.resetAllMocks();
  h.get.mockResolvedValue(JSON.stringify({ step: "location", form: farm }));
  h.load.mockResolvedValue(undefined);
  h.api.mockImplementation(async (path: string) => path === "/me/seller-profile" ? { farmer: { primaryAddressId: "farm-address" } } : {
    farmer: { ...farm, primaryAddressId: "farm-address" },
    verification: { id: "verification", status: "DRAFT", identityRequired: false, documents: [], evidence: [], reviews: [] },
  });
});
afterEach(async () => { await act(async () => { tree?.unmount(); }); });

describe("seller address confirmation lifecycle", () => {
  it("consumes the postcode proof after saving so returning to the form does not replay an expired proof", async () => {
    await mount();
    await act(async () => { postcode().props.onVerified(lookup); });
    await save();
    expect(saves()[0]![1].body.verificationToken).toBe(lookup.verificationToken);
    await act(async () => { tree.root.findByType("Page" as never).props.back(); });
    await save();
    expect(saves()).toHaveLength(2);
    expect(saves()[1]![1].body.verificationToken).toBeUndefined();
    expect(saves()[1]![1].body.line1).toBe(farm.line1);
    expect(h.set.mock.calls.every(([, value]) => !JSON.parse(value).form.verificationToken)).toBe(true);
  });
  it("keeps a successful save's proof consumed even if the following account refresh fails", async () => {
    h.load.mockRejectedValueOnce(new Error("Refresh failed"));
    await mount();
    await act(async () => { postcode().props.onVerified(lookup); });
    await save();
    expect(field("Full farm address *").props.value).toBe(farm.line1);
    await save();
    expect(saves()[1]![1].body.verificationToken).toBeUndefined();
  });
  it("disables the location form, coalesces saves, and ignores queued edits while a save is pending", async () => {
    let resolve!: (value: unknown) => void;
    h.api.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    await mount();
    await save();
    expect(postcode().props.disabled).toBe(true);
    expect(tree.root.findByType("FarmPin" as never).props.disabled).toBe(true);
    expect(tree.root.findAllByType("Field" as never).every((node) => node.props.editable === false)).toBe(true);
    expect(tree.root.findAllByType("Select" as never).every((node) => node.props.disabled)).toBe(true);
    await act(async () => {
      field("Full farm address *").props.onChangeText("A queued address edit");
      button("Saving…").props.onPress();
      tree.root.findByType("Page" as never).props.back();
    });
    expect(field("Full farm address *").props.value).toBe(farm.line1);
    expect(saves()).toHaveLength(1);
    await act(async () => { resolve({ farmer: { primaryAddressId: "farm-address" } }); });
  });
  it("clears the old LGA and map pin when a validity-only lookup supplies a different state", async () => {
    await mount();
    await act(async () => { postcode().props.onVerified({ ...lookup, postcode: "FC-02-A09-DB-09", level: 1,
      fields: { state: "Federal Capital Territory" }, addressDetailsAvailable: false }); });
    const selects = tree.root.findAllByType("Select" as never);
    expect(selects[0]!.props.value).toBe("Federal Capital Territory");
    expect(selects[1]!.props.value).toBe("");
    expect(tree.root.findByType("FarmPin" as never).props.value).toBeUndefined();
    expect(field("Full farm address *").props.value).toBe(farm.line1);
    expect(button("Save and continue").props.disabled).toBe(true);
  });
});
