import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  values: new Map<string, string>(),
  read: vi.fn(),
  hardware: vi.fn(),
  types: vi.fn(),
  enrolled: vi.fn(),
  level: vi.fn(),
  authenticate: vi.fn(),
  unlock: vi.fn(),
  recover: vi.fn(),
  account: "farmer-a",
  generation: 0,
  foreground: new Set<(state: string) => void>(),
}));
vi.mock("react-native", () => ({
  View: "View",
  TextInput: "TextInput",
  Pressable: "Pressable",
  Switch: "Switch",
  ScrollView: "ScrollView",
  Platform: { OS: "android" },
  AppState: {
    addEventListener: (_: string, listener: (state: string) => void) => {
      h.foreground.add(listener);
      return { remove: () => h.foreground.delete(listener) };
    },
  },
}));
vi.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView" }));
vi.mock("expo-status-bar", () => ({ StatusBar: () => null }));
vi.mock("expo-local-authentication", () => ({
  hasHardwareAsync: h.hardware,
  supportedAuthenticationTypesAsync: h.types,
  isEnrolledAsync: h.enrolled,
  getEnrolledLevelAsync: h.level,
  authenticateAsync: h.authenticate,
  AuthenticationType: { FINGERPRINT: 1, FACIAL_RECOGNITION: 2 },
  SecurityLevel: { BIOMETRIC_STRONG: 3 },
}));
vi.mock("expo-secure-store", () => ({
  getItemAsync: h.read,
  setItemAsync: async (key: string, value: string) => {
    h.values.set(key, value);
  },
}));
vi.mock("expo-crypto", () => ({
  randomUUID: () => "salt",
  CryptoDigestAlgorithm: { SHA256: "sha256" },
  digestStringAsync: async (_: string, value: string) => `hashed-${value}`,
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
vi.mock("./api", () => ({ sessionVersion: () => h.generation }));
vi.mock("../state", () => ({
  useApp: () => ({
    user: { id: h.account },
    security: "unlock",
    ui: (s: string) => s,
    error: (e: Error) => e.message,
    unlock: h.unlock,
    recoverSecurity: h.recover,
    signOut: vi.fn(),
  }),
}));
import { FarmerSecurity } from "../screens/farmer-security";
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let tree: ReactTestRenderer | undefined;
const save = (enabled: unknown, id = h.account) =>
  h.values.set(
    `farmer-security.${id}`,
    JSON.stringify({
      salt: "salt",
      hash: "hashed-salt:1234",
      biometric: enabled,
      failures: 0,
      retryAt: 0,
    }),
  );
const titles = () => tree!.root.findAllByType("Button" as any).map((node) => node.props.title);
const button = (title: string) =>
  tree!.root.findAllByType("Button" as any).find((node) => node.props.title === title)!;
async function mount() {
  await act(async () => {
    tree = create(<FarmerSecurity />);
  });
}
async function foreground() {
  await act(async () => {
    h.foreground.forEach((listener) => listener("active"));
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  h.values.clear();
  h.account = "farmer-a";
  h.generation = 0;
  h.foreground.clear();
  h.read.mockImplementation(async (key: string) => h.values.get(key) || null);
  h.hardware.mockResolvedValue(true);
  h.types.mockResolvedValue([1, 2]);
  h.enrolled.mockResolvedValue(true);
  h.level.mockResolvedValue(3);
  h.authenticate.mockResolvedValue({ success: true });
  save(true);
});
afterEach(async () => {
  await act(async () => tree?.unmount());
  tree = undefined;
});
it.each([
  {
    name: "opted in and strong biometrics available",
    enabled: true,
    hardware: true,
    enrolled: true,
    level: 3,
    biometric: true,
  },
  {
    name: "disabled in app despite device enrollment",
    enabled: false,
    hardware: true,
    enrolled: true,
    level: 3,
    biometric: false,
  },
  {
    name: "supported but not enrolled",
    enabled: true,
    hardware: true,
    enrolled: false,
    level: 0,
    biometric: false,
  },
  {
    name: "unsupported device",
    enabled: true,
    hardware: false,
    enrolled: false,
    level: 0,
    biometric: false,
  },
  {
    name: "weak biometrics cannot satisfy the strong policy",
    enabled: true,
    hardware: true,
    enrolled: true,
    level: 2,
    biometric: false,
  },
  {
    name: "invalid persisted preference is not consent",
    enabled: "true",
    hardware: true,
    enrolled: true,
    level: 3,
    biometric: false,
  },
])("chooses actual authentication configuration: $name", async (scenario) => {
  save(scenario.enabled);
  h.hardware.mockResolvedValue(scenario.hardware);
  h.enrolled.mockResolvedValue(scenario.enrolled);
  h.level.mockResolvedValue(scenario.level);
  await mount();
  expect(titles().includes("Use biometric unlock")).toBe(scenario.biometric);
  expect(titles().includes("Sign in with a code instead")).toBe(scenario.biometric);
  expect(titles().includes("Forgot your PIN?")).toBe(!scenario.biometric);
  expect(tree!.root.findByType("TextInput" as any).props.secureTextEntry).toBe(true);
  expect(h.unlock).not.toHaveBeenCalled();
});
it("does not display sign-in options before persisted preferences finish loading", async () => {
  let resolve!: (value: string) => void;
  h.read.mockReturnValueOnce(
    new Promise<string>((done) => {
      resolve = done;
    }),
  );
  await mount();
  expect(titles()).toEqual([]);
  expect(tree!.root.findAllByType("TextInput" as any)).toHaveLength(0);
  await act(async () => resolve(h.values.get("farmer-security.farmer-a")!));
  expect(titles()).toContain("Sign in with a code instead");
});
it("falls back safely when checking the native biometric API throws", async () => {
  h.enrolled.mockRejectedValue(new Error("Unavailable"));
  await mount();
  expect(titles()).not.toContain("Sign in with a code instead");
  await act(async () => tree!.root.findByType("TextInput" as any).props.onChangeText("1234"));
  expect(h.unlock).toHaveBeenCalledTimes(1);
});
it("does not infer app opt-in from enrollment when no account preference is saved", async () => {
  h.values.clear();
  await mount();
  expect(titles()).not.toContain("Sign in with a code instead");
  await act(async () => tree!.root.findByType("TextInput" as any).props.onChangeText("1234"));
  expect(h.unlock).not.toHaveBeenCalled();
});
it.each(["not_available", "lockout", "user_cancel"])(
  "keeps PIN and recovery usable after biometric failure: %s",
  async (error) => {
    h.authenticate.mockResolvedValue({ success: false, error });
    await mount();
    await act(async () => button("Use biometric unlock").props.onPress());
    expect(h.unlock).not.toHaveBeenCalled();
    expect(titles()).not.toContain("Sign in with a code instead");
    expect(titles()).toContain("Forgot your PIN?");
    await foreground();
    expect(titles()).not.toContain("Sign in with a code instead");
    await act(async () => tree!.root.findByType("TextInput" as any).props.onChangeText("1234"));
    expect(h.unlock).toHaveBeenCalledTimes(1);
  },
);
it("uses PIN after a thrown biometric prompt error", async () => {
  h.authenticate.mockRejectedValue(new Error("Native failure"));
  await mount();
  await act(async () => button("Use biometric unlock").props.onPress());
  expect(titles()).toContain("Forgot your PIN?");
  expect(h.unlock).not.toHaveBeenCalled();
});
it("rechecks enrollment and app preferences when returning from device settings", async () => {
  await mount();
  expect(titles()).toContain("Sign in with a code instead");
  h.enrolled.mockResolvedValue(false);
  await foreground();
  expect(titles()).not.toContain("Sign in with a code instead");
  h.enrolled.mockResolvedValue(true);
  save(false);
  await foreground();
  expect(titles()).not.toContain("Sign in with a code instead");
  save(true);
  await foreground();
  expect(titles()).toContain("Sign in with a code instead");
});
it("revalidates app opt-in immediately before launching biometrics", async () => {
  await mount();
  const stale = button("Use biometric unlock").props.onPress;
  save(false);
  await act(async () => stale());
  expect(h.authenticate).not.toHaveBeenCalled();
  expect(h.unlock).not.toHaveBeenCalled();
  expect(titles()).toContain("Forgot your PIN?");
});
it("unlocks only after successful biometric authentication", async () => {
  await mount();
  await act(async () => button("Use biometric unlock").props.onPress());
  expect(h.authenticate).toHaveBeenCalledWith(
    expect.objectContaining({ biometricsSecurityLevel: "strong", disableDeviceFallback: true }),
  );
  expect(h.unlock).toHaveBeenCalledTimes(1);
});
it("does not accept a late biometric success after logout", async () => {
  let resolve!: (value: { success: boolean }) => void;
  h.authenticate.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  await mount();
  let pending!: Promise<void>;
  await act(async () => {
    pending = button("Use biometric unlock").props.onPress();
  });
  h.generation++;
  await act(async () => {
    tree!.unmount();
    tree = undefined;
    resolve({ success: true });
    await pending;
  });
  expect(h.unlock).not.toHaveBeenCalled();
});
it.each([true, false])("restores the persisted app preference on restart: %s", async (enabled) => {
  save(enabled);
  await mount();
  await act(async () => tree!.unmount());
  tree = undefined;
  await mount();
  expect(titles().includes("Sign in with a code instead")).toBe(enabled);
});
it("ignores a late preference result from the previous account", async () => {
  let resolve!: (value: string) => void;
  const oldRecord = h.values.get("farmer-security.farmer-a")!;
  h.read.mockReturnValueOnce(
    new Promise<string>((done) => {
      resolve = done;
    }),
  );
  await mount();
  h.account = "farmer-b";
  save(false);
  await act(async () => tree!.update(<FarmerSecurity />));
  expect(titles()).toContain("Forgot your PIN?");
  await act(async () => resolve(oldRecord));
  expect(titles()).not.toContain("Sign in with a code instead");
});

it("rejects a successful biometric result if app opt-in was removed during the prompt", async () => {
  let resolve!: (value: { success: boolean }) => void;
  h.authenticate.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  await mount();
  let pending!: Promise<void>;
  await act(async () => {
    pending = button("Use biometric unlock").props.onPress();
  });
  save(false);
  await act(async () => {
    resolve({ success: true });
    await pending;
  });
  expect(h.unlock).not.toHaveBeenCalled();
  expect(titles()).toContain("Forgot your PIN?");
});
