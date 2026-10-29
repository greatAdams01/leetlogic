import { writeFileSync } from "node:fs";
import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  check: vi.fn(),
  create: vi.fn(),
  enable: vi.fn(),
  authenticate: vi.fn(),
  notify: vi.fn(),
  reload: vi.fn(),
  api: vi.fn(),
  optedIn: false,
}));
vi.mock("react-native", () => ({
  Platform: { OS: "android" },
  View: "View",
  ActivityIndicator: "ActivityIndicator",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  KeyboardAvoidingView: "KeyboardAvoidingView",
  Modal: ({ visible, children }: any) => (visible ? children : null),
  StyleSheet: { create: (styles: any) => styles },
  AppState: { addEventListener: () => ({ remove() {} }) },
}));
vi.mock("../components/app-sheet", async () => {
  const { createElement } = await import("react");
  return {
    AppSheet: (props: any) =>
      props.visible ? createElement("AppSheet", props, props.children, props.footer) : null,
  };
});
vi.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView" }));
vi.mock("../localization", () => ({ LocalizedText: "Text" }));
vi.mock("./api", () => ({ api: h.api, sessionVersion: () => 0 }));
vi.mock("expo-local-authentication", () => ({
  hasHardwareAsync: async () => true,
  getEnrolledLevelAsync: async () => 3,
  SecurityLevel: { BIOMETRIC_STRONG: 3 },
  AuthenticationType: { FINGERPRINT: 1, FACIAL_RECOGNITION: 2 },
  supportedAuthenticationTypesAsync: async () => [1, 2],
  isEnrolledAsync: async () => true,
  authenticateAsync: h.authenticate,
}));
vi.mock("../components/ui", () => ({
  colors: { paper: "#faf7f0", ink: "#1c1c1c", line: "#e2ddd5", green: "#14532d" },
  ...Object.fromEntries(
    ["Page", "Card", "Label", "Field", "Button", "Notice", "Icon"].map((name) => [name, name]),
  ),
}));
vi.mock("../state", () => ({
  useApp: () => ({
    user: { id: "farmer" },
    ui: (s: string, values: any = {}) => s.replace(/\{(\w+)\}/g, (_, key) => String(values[key])),
    date: (s: string) => s,
    error: (e: Error) => e.message,
    notify: h.notify,
    back: vi.fn(),
  }),
  useResource: () => ({
    loading: false,
    error: "",
    data: {
      items: [
        { id: "current", current: true, createdAt: "2026-10-28" },
        { id: "other", current: false, createdAt: "2026-10-28" },
      ],
    },
    reload: h.reload,
  }),
}));
vi.mock("./farmer-security", () => ({
  readSecurity: async () => ({ biometric: h.optedIn }),
  checkPin: h.check,
  createSecurity: h.create,
  enableBiometric: h.enable,
}));
vi.mock("./connected-devices", () => ({
  useConnectedDevices: () => ({
    loading: false,
    error: "",
    data: {
      items: [
        {
          id: "current",
          current: true,
          deviceName: "Farmer’s iPhone",
          platform: "ios",
          createdAt: "2026-10-28",
          lastUsedAt: "2026-10-29",
        },
        {
          id: "other",
          current: false,
          deviceName: "Farm Android",
          platform: "android",
          createdAt: "2026-10-28",
          lastUsedAt: null,
        },
      ],
    },
    reload: h.reload,
  }),
}));
import { SecuritySettings } from "../screens/security-settings";
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let tree: ReactTestRenderer;
beforeEach(async () => {
  vi.resetAllMocks();
  h.optedIn = false;
  h.check.mockResolvedValue(undefined);
  await act(async () => {
    tree = create(<SecuritySettings />);
  });
  await open("Change PIN");
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
async function open(label: string) {
  const control = tree.root
    .findAllByType("Pressable" as any)
    .find((node) => node.props.accessibilityLabel === label)!;
  await act(async () => control.props.onPress());
}
async function close() {
  await act(async () => tree.root.findByType("AppSheet" as any).props.onClose());
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
  await close();
  await open("Enable biometric unlock");
  await field("Current PIN", "1234");
  h.authenticate.mockResolvedValue({ success: false });
  await act(async () => change().props.onPress());
  expect(h.enable).not.toHaveBeenCalled();
});

it("shows the Figma summary rows with biometric wording and actual session count", async () => {
  await close();
  const text = tree.root.findAllByType("Text" as any).map((node) => node.props.children);
  expect(text).toContain("Biometric");
  expect(text).not.toContain("Fingerprint");
  expect(text).toContain("2 devices logged in");
  expect(tree.root.findAllByType("Field" as any)).toHaveLength(0);
});
it("requires focused device confirmation and the current PIN before revoking another phone", async () => {
  await close();
  await open("Signed-in devices");
  expect(tree.root.findAllByType("Field" as any)).toHaveLength(0);
  expect(tree.root.findAllByType("Button" as any)).toHaveLength(0);
  await open("Sign out Farm Android");
  const confirm = () =>
    tree.root
      .findAllByType("Pressable" as any)
      .find((node) => node.props.accessibilityLabel === "Sign out device")!;
  expect(confirm().props.disabled).toBe(true);
  expect(h.api).not.toHaveBeenCalled();
  await field("Current PIN", "1234");
  await act(async () => confirm().props.onPress());
  expect(h.check).toHaveBeenCalledWith("farmer", "1234");
  expect(h.api).toHaveBeenCalledWith("/auth/sessions/other", { method: "DELETE" });
});

it("keeps every Figma icon in its intended slot at its native dimensions", async () => {
  await act(async () => tree.unmount());
  h.optedIn = true;
  await act(async () => {
    tree = create(<SecuritySettings />);
  });
  const page = tree.root.findByType("Page" as any);
  const icons = tree.root.findAllByType("Icon" as any);
  for (const [name, width, height] of [
    ["settingsShield", 32, 32],
    ["settingsChangePin", 22, 22],
    ["settingsBiometric", 22, 22],
    ["settingsDevices", 22, 22],
    ["settingsSwitchOn", 52, 30],
  ] as const) {
    expect(icons.find((icon) => icon.props.name === name)?.props.nativeSize).toEqual({
      width,
      height,
    });
  }
  expect(page.props.header.props.children[0].props.children.props).toMatchObject({
    name: "settingsBack",
    nativeSize: { width: 22, height: 22 },
  });
  expect(page.props.footer.props.children[0].props).toMatchObject({
    name: "settingsLock",
    nativeSize: { width: 18, height: 18 },
  });
  if (process.env.SECURITY_DESIGN_PREVIEW) {
    const element = (node: any): any =>
      typeof node === "string" || typeof node === "number"
        ? String(node)
        : !node
          ? null
          : {
              type: node.type,
              props: {
                style: node.props.style,
                name: node.props.name,
                nativeSize: node.props.nativeSize,
              },
              children: React.Children.toArray(node.props.children).map(element),
            };
    const clean = (node: any): any =>
      typeof node === "string"
        ? node
        : !node
          ? null
          : {
              type: node.type,
              props: {
                style: node.props.style,
                name: node.props.name,
                nativeSize: node.props.nativeSize,
              },
              children: node.children?.map(clean),
            };
    const body = clean(tree.toJSON());
    writeFileSync(
      process.env.SECURITY_DESIGN_PREVIEW,
      JSON.stringify({
        header: element(page.props.header),
        footer: element(page.props.footer),
        body: body.children,
        contentStyle: page.props.contentStyle,
      }),
    );
  }
});

it("enables biometrics only after both PIN and device authentication succeed", async () => {
  await close();
  await open("Enable biometric unlock");
  await field("Current PIN", "1234");
  h.authenticate.mockResolvedValue({ success: true });
  await act(async () => change().props.onPress());
  expect(h.check).toHaveBeenCalledWith("farmer", "1234");
  expect(h.authenticate).toHaveBeenCalledWith(
    expect.objectContaining({ biometricsSecurityLevel: "strong", disableDeviceFallback: true }),
  );
  expect(h.enable).toHaveBeenCalledWith("farmer", true);
});
it("turns off the saved biometric preference only after verifying the current PIN", async () => {
  await act(async () => tree.unmount());
  h.optedIn = true;
  await act(async () => {
    tree = create(<SecuritySettings />);
  });
  await open("Enable biometric unlock");
  await field("Current PIN", "1234");
  await act(async () => change().props.onPress());
  expect(h.check).toHaveBeenCalledWith("farmer", "1234");
  expect(h.authenticate).not.toHaveBeenCalled();
  expect(h.enable).toHaveBeenCalledWith("farmer", false);
});

it("shows reported device details instead of numbered sample phones", async () => {
  await close();
  await open("Signed-in devices");
  const labels = tree.root.findAllByType("Text" as any).map((node) => node.props.children);
  expect(labels).toContain("Farmer’s iPhone");
  expect(labels).toContain("Farm Android");
  expect(labels).not.toContain("Phone 2");
  expect(labels).toContain("Last active 2026-10-29");
});

it("uses the shared modal shell for every security flow", async () => {
  expect(tree.root.findByType("AppSheet" as any).props).toMatchObject({
    testID: "security-sheet",
    title: "Change PIN",
  });
  await close();
  await open("Enable biometric unlock");
  expect(tree.root.findByType("AppSheet" as any).props.title).toBe("Biometric");
  await close();
  await open("Signed-in devices");
  expect(tree.root.findByType("AppSheet" as any).props.title).toBe("Signed-in devices");
  await open("Sign out Farm Android");
  expect(tree.root.findByType("AppSheet" as any).props.title).toBe("Sign out device");
});
it("identifies the current device and labels real activity without an online claim", async () => {
  await close();
  await open("Signed-in devices");
  const text = tree.root.findAllByType("Text" as any).map((node) => node.props.children);
  expect(text).toContain("This device");
  expect(text).toContain("iOS");
  expect(text).toContain("Android");
  expect(text).toContain("2 signed-in devices");
  expect(text).toContain("Activity not recorded yet");
  const actions = tree.root
    .findAllByType("Pressable" as any)
    .map((node) => node.props.accessibilityLabel);
  expect(actions).not.toContain("Sign out Farmer’s iPhone");
  expect(actions).toContain("Refresh devices");
});
it("can return from device confirmation without signing out or keeping a PIN", async () => {
  await close();
  await open("Signed-in devices");
  await open("Sign out Farm Android");
  await field("Current PIN", "1234");
  await open("Back to devices");
  expect(h.api).not.toHaveBeenCalled();
  expect(tree.root.findAllByType("Field" as any)).toHaveLength(0);
  await open("Sign out Farm Android");
  expect(tree.root.findByType("Field" as any).props.value).toBe("");
});

it("never signs a device out when PIN verification fails", async () => {
  await close();
  await open("Signed-in devices");
  await open("Sign out Farm Android");
  await field("Current PIN", "9999");
  h.check.mockRejectedValue(new Error("Incorrect PIN"));
  await open("Sign out device");
  expect(h.api).not.toHaveBeenCalled();
  expect(tree.root.findByType("AppSheet" as any).props.title).toBe("Sign out device");
  expect(tree.root.findByType("Notice" as any).props.text).toBe("Incorrect PIN");
});
it("keeps the shared sheet busy and prevents dismissal during a device sign-out", async () => {
  let resolve!: () => void;
  h.api.mockReturnValue(
    new Promise<void>((done) => {
      resolve = done;
    }),
  );
  await close();
  await open("Signed-in devices");
  await open("Sign out Farm Android");
  await field("Current PIN", "1234");
  await open("Sign out device");
  expect(tree.root.findByType("AppSheet" as any).props.busy).toBe(true);
  await close();
  expect(tree.root.findByType("AppSheet" as any).props.title).toBe("Sign out device");
  await act(async () => resolve());
  expect(tree.root.findByType("AppSheet" as any).props.title).toBe("Signed-in devices");
});
