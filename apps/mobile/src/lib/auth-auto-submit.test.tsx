import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  api: vi.fn(),
  save: vi.fn(),
  load: vi.fn(),
  clear: vi.fn(),
  login: vi.fn(),
  signOut: vi.fn(),
  changeLocale: vi.fn(),
  signed: false,
  query: "",
  generation: 0,
  check: vi.fn(),
  create: vi.fn(),
  finish: vi.fn(),
  unlock: vi.fn(),
  recover: vi.fn(),
  register: vi.fn(),
  intent: "LOGIN",
  mode: "create",
  phone: "08012345678",
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
  hasHardwareAsync: async () => false,
  getEnrolledLevelAsync: async () => 0,
  SecurityLevel: { BIOMETRIC_STRONG: 3 },
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
    authIntent: h.intent,
    route: { id: h.phone, query: h.query },
    locale: "en",
    ui: (s: string) => s,
    t: (s: string) => s,
    error: (e: Error & { code?: string }) => e.message || e.code,
    unlock: h.unlock,
    recoverSecurity: h.recover,
    startRegistration: h.register,
    startLogin: h.login,
    signOut: h.signOut,
    go: vi.fn(),
    finishSignIn: h.finish,
    loadUser: h.load,
    changeLocale: h.changeLocale,
  }),
}));
vi.mock("./api", () => ({
  api: h.api,
  sessionVersion: () => h.generation,
  API_URL: "http://localhost:3000",
  deviceId: async () => "device",
  saveSession: h.save,
  clearSession: h.clear,
  authHeaders: () => h.signed ? { Authorization: "Bearer saved-session" } : {},
}));
vi.mock("./farmer-security", () => ({
  readSecurity: async () => null,
  checkPin: h.check,
  createSecurity: h.create,
  enableBiometric: async () => {},
}));
import { FarmerSecurity } from "../screens/farmer-security";
import { Phone, Otp } from "../screens/verification-entry";
let tree: ReactTestRenderer;
const input = () => tree.root.findByType("TextInput" as any);
beforeEach(() => {
  vi.clearAllMocks();
  h.generation = 0;
  h.mode = "create";
  h.intent = "LOGIN";
  h.phone = "08012345678";
  h.query = "";
  h.signed = false;
  h.api.mockResolvedValue({});
  h.load.mockReset().mockResolvedValue({ id: "farmer", preferredLocale: "en" });
  h.save.mockImplementation(async () => { h.generation++; h.signed = true; });
  h.clear.mockImplementation(async () => { h.generation++; h.signed = false; });
  h.changeLocale.mockResolvedValue(undefined);
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
    body: { phone: "08012345678", deviceId: "device", code: "123456", intent: "LOGIN" },
  });
  expect(h.finish).toHaveBeenCalledTimes(1);
});

it("shows recovery failures on the PIN screen and guards repeated recovery taps", async () => {
  h.mode = "unlock";
  let reject!: (error: Error) => void;
  h.recover.mockReturnValue(
    new Promise((_resolve, fail) => {
      reject = fail;
    }),
  );
  await act(async () => {
    tree = create(<FarmerSecurity />);
  });
  const recovery = () =>
    tree.root.findAllByType("Button" as any).find((n) => n.props.title === "Forgot your PIN?")!;
  await act(async () => {
    recovery().props.onPress();
    recovery().props.onPress();
  });
  expect(h.recover).toHaveBeenCalledTimes(1);
  expect(recovery().props.disabled).toBe(true);
  await act(async () => reject(new Error("SMS unavailable")));
  expect(tree.root.findByType("Notice" as any).props.text).toBe("SMS unavailable");
  expect(recovery().props.disabled).toBe(false);
});

it("prefills the recovery phone in local format when returning from verification", async () => {
  h.phone = "+2348012345678";
  await act(async () => {
    tree = create(<Phone />);
  });
  expect(input().props.value).toBe("8012345678");
  expect(h.api).not.toHaveBeenCalled();
});

it("does not save a late OTP response after the session has changed", async () => {
  let resolve!: (result: object) => void;
  h.api.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  await act(async () => {
    tree = create(<Otp />);
  });
  await act(async () => input().props.onChangeText("123456"));
  h.generation++;
  await act(async () => resolve({ accessToken: "old-session" }));
  expect(h.save).not.toHaveBeenCalled();
  expect(h.finish).not.toHaveBeenCalled();
});

it("guides an unknown phone directly to registration and clears guidance when the number changes", async () => {
  h.api.mockRejectedValue(Object.assign(new Error("Create an account"), { code: "ACCOUNT_NOT_FOUND" }));
  await act(async () => { tree = create(<Phone />); });
  const submit = tree.root.findAllByType("Pressable" as any).find((n) => n.props.accessibilityLabel === "Continue")!;
  await act(async () => submit.props.onPress());
  const register = tree.root.findAllByType("Button" as any).find((n) => n.props.title === "Create Account")!;
  expect(register).toBeDefined();
  const continueButtons = () => tree.root.findAllByType("Pressable" as any).filter((n) => n.props.accessibilityLabel === "Continue");
  expect(continueButtons()).toHaveLength(0);
  expect(tree.root.findAllByType("Notice" as any)).toHaveLength(1);
  await act(async () => register.props.onPress());
  expect(h.register).toHaveBeenCalledWith("+2348012345678");
  await act(async () => input().props.onChangeText("08012345679"));
  expect(tree.root.findAllByType("Button" as any).some((n) => n.props.title === "Create Account")).toBe(false);
  expect(tree.root.findAllByType("Notice" as any)).toHaveLength(0);
  expect(continueButtons()).toHaveLength(1);
  h.api.mockResolvedValueOnce({});
  await act(async () => continueButtons()[0]!.props.onPress());
  expect(h.api).toHaveBeenLastCalledWith("/auth/otp/request", expect.objectContaining({ body: expect.objectContaining({ phone: "+2348012345679" }) }));
});
it("allows an expired code to be resent immediately instead of waiting on the old countdown", async () => {
  h.api.mockRejectedValueOnce(Object.assign(new Error("Expired"), { code: "OTP_EXPIRED" }));
  await act(async () => { tree = create(<Otp />); });
  await act(async () => input().props.onChangeText("123456"));
  expect(input().props.value).toBe("");
  const resend = tree.root.findAllByType("Pressable" as any).find((n) => n.props.style && n.props.accessibilityState && n.props.accessibilityRole === "button" && !n.props.accessibilityLabel)!;
  expect(resend.props.disabled).toBe(false);
  h.api.mockResolvedValueOnce({});
  await act(async () => resend.props.onPress());
  expect(h.api).toHaveBeenLastCalledWith("/auth/otp/request", expect.objectContaining({ body: expect.objectContaining({ phone: h.phone, intent: "LOGIN" }) }));
});

it.each(["LOGIN", "REGISTER"])("keeps verification copy specific to %s after an expired code and resend", async (intent) => {
  h.intent = intent;
  h.api.mockRejectedValueOnce(Object.assign(new Error("Expired"), { code: "OTP_EXPIRED" }));
  await act(async () => { tree = create(<Otp />); });
  const title = intent === "LOGIN" ? "Log In" : "Verify Your Account";
  const label = intent === "LOGIN" ? "Log In" : "Verify & Continue";
  const description = intent === "LOGIN"
    ? "Enter the verification code sent to your phone number to log in."
    : "Enter the verification code sent to your phone number to complete your registration.";
  const check = () => {
    expect(tree.root.findAllByType("Text" as any).filter((n) => n.props.children === title).length).toBeGreaterThan(0);
    expect(tree.root.findAllByType("Text" as any).some((n) => n.props.children === description)).toBe(true);
    expect(tree.root.findAllByType("Pressable" as any).some((n) => n.props.accessibilityLabel === label)).toBe(true);
  };
  check();
  await act(async () => input().props.onChangeText("123456"));
  const resend = tree.root.findAllByType("Pressable" as any).find((n) => n.props.accessibilityState && n.props.accessibilityRole === "button" && !n.props.accessibilityLabel)!;
  h.api.mockResolvedValueOnce({});
  await act(async () => resend.props.onPress());
  check();
  expect(h.api).toHaveBeenLastCalledWith("/auth/otp/request", expect.objectContaining({ body: expect.objectContaining({ intent }) }));
});

it("retries only the profile after a verified OTP and never reports it as an incorrect code", async () => {
  h.load.mockRejectedValueOnce(Object.assign(new Error("private Prisma details"), { status: 503, code: "DATABASE_SCHEMA_MISMATCH" }));
  await act(async () => { tree = create(<Otp />); });
  await act(async () => input().props.onChangeText("123456"));
  expect(h.save).toHaveBeenCalledOnce();
  expect(h.clear).not.toHaveBeenCalled();
  expect(h.finish).not.toHaveBeenCalled();
  expect(h.load).toHaveBeenCalledWith(false);
  expect(tree.root.findByType("Notice" as any).props.text).toBe("PROFILE_UNAVAILABLE");
  expect(tree.root.findAllByType("TextInput" as any)).toHaveLength(0);
  const retry = tree.root.findAllByType("Pressable" as any).find((node) => node.props.accessibilityLabel === "common.retry")!;
  await act(async () => retry.props.onPress());
  expect(h.api).toHaveBeenCalledOnce();
  expect(h.load).toHaveBeenCalledTimes(2);
  expect(h.finish).toHaveBeenCalledOnce();
});

it("coalesces repeated profile retry taps without repeating OTP verification", async () => {
  h.load.mockRejectedValueOnce({ status: 503 });
  await act(async () => { tree = create(<Otp />); });
  await act(async () => input().props.onChangeText("123456"));
  let resolve!: (user: object) => void;
  h.load.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
  const retry = tree.root.findAllByType("Pressable" as any).find((node) => node.props.accessibilityLabel === "common.retry")!;
  await act(async () => { retry.props.onPress(); retry.props.onPress(); });
  expect(h.load).toHaveBeenCalledTimes(2);
  expect(h.api).toHaveBeenCalledOnce();
  expect(tree.root.findAllByType("Pressable" as any).some((node) => node.props.accessibilityLabel === "Loading your account…")).toBe(true);
  await act(async () => resolve({ id: "farmer" }));
  expect(h.finish).toHaveBeenCalledOnce();
});
it("keeps role-conflict accounts private and shows support guidance without another OTP", async () => {
  h.load.mockRejectedValueOnce({ status: 409, code: "ACCOUNT_ROLE_CONFLICT" });
  await act(async () => { tree = create(<Otp />); });
  await act(async () => input().props.onChangeText("123456"));
  expect(tree.root.findByType("Notice" as any).props.text).toBe("ACCOUNT_ROLE_CONFLICT");
  expect(h.finish).not.toHaveBeenCalled();
  expect(h.clear).not.toHaveBeenCalled();
  expect(h.api).toHaveBeenCalledOnce();
});

it("does not publish a late profile after the secure session changes", async () => {
  let resolve!: (user: object) => void;
  h.load.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
  await act(async () => { tree = create(<Otp />); });
  await act(async () => input().props.onChangeText("123456"));
  h.generation++;
  h.signed = false;
  await act(async () => resolve({ id: "old-account" }));
  expect(h.finish).not.toHaveBeenCalled();
  expect(h.changeLocale).not.toHaveBeenCalled();
});

it("clears a rejected session and restarts login rather than retrying a consumed code", async () => {
  h.load.mockRejectedValueOnce({ status: 401, code: "SESSION_EXPIRED" });
  await act(async () => { tree = create(<Otp />); });
  await act(async () => input().props.onChangeText("123456"));
  expect(h.clear).toHaveBeenCalledOnce();
  expect(h.login).toHaveBeenCalledOnce();
  expect(h.finish).not.toHaveBeenCalled();
  expect(h.api).toHaveBeenCalledOnce();
});

it("resumes a securely saved sign-in after restart without requesting or verifying another OTP", async () => {
  h.query = "resume-sign-in";
  h.signed = true;
  h.load.mockResolvedValue({ id: "farmer", preferredLocale: "ha" });
  await act(async () => { tree = create(<Otp />); });
  expect(tree.root.findAllByType("TextInput" as any)).toHaveLength(0);
  const retry = tree.root.findAllByType("Pressable" as any).find((node) => node.props.accessibilityLabel === "common.retry")!;
  await act(async () => retry.props.onPress());
  expect(h.api).not.toHaveBeenCalled();
  expect(h.save).not.toHaveBeenCalled();
  expect(h.changeLocale).toHaveBeenCalledWith("ha");
  expect(h.finish).toHaveBeenCalledOnce();
});

it("allows a pending sign-in to be explicitly cancelled through secure logout", async () => {
  h.load.mockRejectedValueOnce({ status: 503 });
  await act(async () => { tree = create(<Otp />); });
  await act(async () => input().props.onChangeText("123456"));
  const cancel = tree.root.findAllByType("Button" as any).find((node) => node.props.title === "common.cancel")!;
  await act(async () => cancel.props.onPress());
  expect(h.signOut).toHaveBeenCalledOnce();
});
