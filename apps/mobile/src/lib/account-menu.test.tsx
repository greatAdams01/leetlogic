import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ role: "BUYER", go: vi.fn(), load: vi.fn() }));
vi.mock("react-native", () => ({
  View: "View",
  Pressable: "Pressable",
  AppState: { currentState: "active", addEventListener: () => ({ remove() {} }) },
}));
vi.mock("../localization", () => ({ LocalizedText: "Text" }));
vi.mock("../components/ui", () => ({
  Page: "Page",
  Heading: "Heading",
  Label: "Label",
  Field: "Field",
  Button: "Button",
  Card: "Card",
  Notice: "Notice",
  Icon: "Icon",
  s: {},
  colors: {},
}));
vi.mock("../components/farm-pin", () => ({ FarmPin: "FarmPin" }));
vi.mock("../components/Select", () => ({ Select: "Select" }));
vi.mock("../screens/seller", () => ({ Seller: "Seller" }));
vi.mock("./idle", () => ({ whenIdle: () => () => {} }));
vi.mock("./api", () => ({ api: vi.fn() }));
vi.mock("../state", () => ({
  useApp: () => ({
    role: h.role,
    user: {
      phoneE164: "+2348000000000",
      phoneVerifiedAt: "2026-01-01",
      farmerProfile: { verificationStatus: "APPROVED", farmName: "Farm" },
    },
    locale: "en",
    loadUser: h.load,
    go: h.go,
    ui: (s: string) => s,
    t: (s: string) => s,
  }),
  useResource: () => ({}),
}));
import { Profile } from "../screens/account";
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let tree: ReactTestRenderer;
afterEach(async () => {
  await act(async () => tree?.unmount());
});
const labels = () => tree.root.findAllByType("Label" as any).map((node) => node.props.children);
it("keeps farmer earnings and banks out of buyer Menu even for an account with a farmer profile", async () => {
  h.role = "BUYER";
  await act(async () => {
    tree = create(<Profile />);
  });
  expect(labels()).not.toContain("Payments and earnings");
  expect(labels()).not.toContain("Bank accounts");
  expect(labels()).not.toContain("Manage your produce, listings and earnings.");
  expect(labels()).toContain("Shopping location");
  expect(labels()).toContain("Delivery addresses");
  const location = tree.root
    .findAllByType("Label" as any)
    .find((node) => node.props.children === "Shopping location")!;
  await act(async () => location.parent!.parent!.props.onPress());
  expect(h.go).toHaveBeenCalledWith("shoppingLocation");
});
it("retains earnings, banks and farm tools for seller Menu", async () => {
  h.role = "SELLER";
  await act(async () => {
    tree = create(<Profile />);
  });
  expect(labels()).toContain("Payments and earnings");
  expect(labels()).toContain("Bank accounts");
  expect(labels()).toContain("Farm location");
  expect(labels()).not.toContain("Shopping location");
});
