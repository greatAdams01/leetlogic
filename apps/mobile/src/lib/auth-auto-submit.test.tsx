import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  api: vi.fn(),
  check: vi.fn(),
  create: vi.fn(),
  finish: vi.fn(),
  unlock: vi.fn(),
  mode: "create",
}));
vi.mock("react-native", () => ({
  View: "View",
  TextInput: "TextInput",
  Pressable: "Pressable",
  Switch: "Switch",
  ScrollView: "ScrollView",
  KeyboardAvoidingView: "KeyboardAvoidingView",
  ActivityIndicator: "ActivityIndicator",
  Platform: { OS: "ios" },
  StyleSheet: { create: (s: any) => s, absoluteFillObject: {} },
  AppState: { addEventListener: () => ({ remove() {} }) },
}));
vi.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView" }));
vi.mock("expo-status-bar", () => ({ StatusBar: () => null }));
vi.mock("expo-local-authentication", () => ({
  supportedAuthenticationTypesAsync: async () => [],
  isEnrolledAsync: async () => false,
  AuthenticationType: { FACIAL_RECOGNITION: 2, FINGERPRINT: 1 },
}));
vi.mock("../components/ui", () => ({
  Button: "Button",
  Icon: "Icon",
  Heading: "Heading",
  Label: "Label",
  Notice: "Notice",
  colors: {},
}));
vi.mock("../localization", () => ({ LocalizedText: "Text" }));
vi.mock("../state", () => ({
  useApp: () => ({
    user: { id: "farmer" },
    security: h.mode,
    route: { id: "08012345678" },
    locale: "en",
    ui: (s: string) => s,
    t: (s: string) => s,
    error: (e: Error) => e.message,
    unlock: h.unlock,
    finishSignIn: h.finish,
    loadUser: async () => ({ id: "farmer" }),
    changeLocale: async () => {},
  }),
}));
vi.mock("./api", () => ({
  api: h.api,
  API_URL: "http://localhost:3000",
  deviceId: async () => "device",
  saveSession: async () => {},
}));
vi.mock("./farmer-security", () => ({
  readSecurity: async () => null,
  checkPin: h.check,
  createSecurity: h.create,
  enableBiometric: async () => {},
}));
import { FarmerSecurity } from "../screens/farmer-security";
import { Otp } from "../screens/verification-entry";
let tree: ReactTestRenderer;
const input = () => tree.root.findByType("TextInput" as any);
beforeEach(() => {
  vi.clearAllMocks();
  h.mode = "create";
  h.api.mockResolvedValue({});
  h.check.mockResolvedValue(undefined);
  h.create.mockResolvedValue(undefined);
});
afterEach(async () => {
  await act(async () => tree?.unmount());
});
it("advances PIN creation and confirmation on the fourth digit without a button tap", async () => {
  await act(async () => {
    tree = create(<FarmerSecurity />);
  });
  await act(async () => input().props.onChangeText("123"));
  expect(h.create).not.toHaveBeenCalled();
  await act(async () => input().props.onChangeText("1234"));
  expect(input().props.value).toBe("");
  expect(h.create).not.toHaveBeenCalled();
  await act(async () => input().props.onChangeText("1234"));
  expect(h.create).toHaveBeenCalledExactlyOnceWith("farmer", "1234");
});
it("checks a completed unlock PIN once and allows correction after a failure", async () => {
  h.mode = "unlock";
  h.check.mockRejectedValueOnce(new Error("Incorrect PIN"));
  await act(async () => {
    tree = create(<FarmerSecurity />);
  });
  await act(async () => {
    const change = input().props.onChangeText;
    change("9999");
    change("9999");
  });
  expect(h.check).toHaveBeenCalledTimes(1);
  expect(h.unlock).not.toHaveBeenCalled();
  expect(input().props.value).toBe("");
  await act(async () => input().props.onChangeText("1234"));
  expect(h.unlock).toHaveBeenCalledTimes(1);
});
it("submits the full pasted or autofilled OTP once, using the latest digits", async () => {
  await act(async () => {
    tree = create(<Otp />);
  });
  await act(async () => input().props.onChangeText("12345"));
  expect(h.api).not.toHaveBeenCalled();
  await act(async () => {
    const change = input().props.onChangeText;
    change("123456");
    change("123456");
  });
  expect(h.api).toHaveBeenCalledExactlyOnceWith("/auth/otp/verify", {
    method: "POST",
    body: { phone: "08012345678", deviceId: "device", code: "123456" },
  });
  expect(h.finish).toHaveBeenCalledTimes(1);
});
