import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  check: vi.fn(),
  create: vi.fn(),
  enable: vi.fn(),
  authenticate: vi.fn(),
  notify: vi.fn(),
}));
vi.mock("react-native", () => ({ Platform: { OS: "android" }, Switch: "Switch" }));
vi.mock("expo-local-authentication", () => ({
  AuthenticationType: { FINGERPRINT: 1, FACIAL_RECOGNITION: 2 },
  supportedAuthenticationTypesAsync: async () => [1, 2],
  isEnrolledAsync: async () => true,
  authenticateAsync: h.authenticate,
}));
vi.mock("../components/ui", () =>
  Object.fromEntries(
    ["Page", "Card", "Label", "Field", "Button", "Notice", "Icon"].map((name) => [name, name]),
  ),
);
vi.mock("../state", () => ({
  useApp: () => ({
    user: { id: "farmer" },
    ui: (s: string) => s,
    error: (e: Error) => e.message,
    notify: h.notify,
    back: vi.fn(),
  }),
}));
vi.mock("./farmer-security", () => ({
  readSecurity: async () => ({ biometric: false }),
  checkPin: h.check,
  createSecurity: h.create,
  enableBiometric: h.enable,
}));
import { SecuritySettings } from "../screens/security-settings";
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let tree: ReactTestRenderer;
beforeEach(async () => {
  vi.resetAllMocks();
  h.check.mockResolvedValue(undefined);
  await act(async () => {
    tree = create(<SecuritySettings />);
  });
});
afterEach(async () => {
  await act(async () => tree.unmount());
});
async function field(label: string, value: string) {
  await act(async () =>
    tree.root
      .findAllByType("Field" as any)
      .find((n) => n.props.label === label)!
      .props.onChangeText(value),
  );
}
const change = () => tree.root.findByType("Button" as any);
it("requires matching four-digit PINs before offering a PIN change", async () => {
  await field("Current PIN", "1234");
  await field("New PIN", "5678");
  await field("Confirm new PIN", "5679");
  expect(change().props.disabled).toBe(true);
  await field("Confirm new PIN", "5678");
  expect(change().props.disabled).toBe(false);
});
it("does not change the PIN if current PIN verification fails", async () => {
  await field("Current PIN", "9999");
  await field("New PIN", "5678");
  await field("Confirm new PIN", "5678");
  h.check.mockRejectedValue(new Error("Incorrect PIN"));
  await act(async () => change().props.onPress());
  expect(h.create).not.toHaveBeenCalled();
  expect(tree.root.findByType("Notice" as any).props.text).toBe("Incorrect PIN");
});
it("verifies the old PIN and saves the new one for the signed-in farmer", async () => {
  await field("Current PIN", "1234");
  await field("New PIN", "5678");
  await field("Confirm new PIN", "5678");
  await act(async () => change().props.onPress());
  expect(h.check).toHaveBeenCalledWith("farmer", "1234");
  expect(h.create).toHaveBeenCalledWith("farmer", "5678");
});
it("does not enable biometric unlock when device authentication is cancelled", async () => {
  await field("Current PIN", "1234");
  h.authenticate.mockResolvedValue({ success: false });
  await act(async () => tree.root.findByType("Switch" as any).props.onValueChange(true));
  expect(h.enable).not.toHaveBeenCalled();
});
