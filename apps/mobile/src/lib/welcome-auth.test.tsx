import React from "react";
import { createRequire } from "node:module";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  role: "SELLER",
  login: vi.fn(),
  register: vi.fn(),
  language: vi.fn(),
}));
vi.mock("react-native", () => ({
  View: "View",
  Pressable: "Pressable",
  Image: "Image",
  ImageBackground: "ImageBackground",
  StyleSheet: { create: (s: unknown) => s },
  ScrollView: "ScrollView",
  Animated: {},
  PanResponder: {},
  useWindowDimensions: () => ({ width: 360, height: 780 }),
}));
vi.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView" }));
vi.mock("expo-linear-gradient", () => ({ LinearGradient: "LinearGradient" }));
vi.mock("@react-native-async-storage/async-storage", () => ({ default: {} }));
vi.mock("../screens/verification-entry", () => ({ Phone: "Phone", Otp: "Otp" }));
vi.mock("../localization", () => ({ LocalizedText: "Text" }));
vi.mock("../components/ui", async () => ({
  Page: ({ children, footer, ...props }: any) =>
    React.createElement("Page", props, children, footer),
  Heading: "Heading",
  Label: "Label",
  Button: "Button",
  Icon: "Icon",
  Notice: "Notice",
  colors: {},
  s: {},
}));
vi.mock("../state", () => ({
  useApp: () => ({
    route: {},
    role: h.role,
    setRole: (r: string) => {
      h.role = r;
    },
    startLogin: h.login,
    selectRole: h.register,
    openLanguage: h.language,
    ui: (s: string) => s,
    error: (e: Error) => e.message,
  }),
}));
const nodeRequire = createRequire(import.meta.url);

nodeRequire.extensions[".png"] = (module: any) => {
  module.exports = 1;
};
const { Role } = await import("../screens/entry");
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let tree: ReactTestRenderer;
afterEach(async () => {
  await act(async () => tree?.unmount());
  vi.clearAllMocks();
});
it("separates welcome and registration actions and retains the role after going back", async () => {
  await act(async () => {
    tree = create(<Role />);
  });
  const buttons = () => tree.root.findAllByType("Button" as any);
  expect(buttons().map((n) => n.props.title)).toEqual([
    "Log In",
    "Create Account",
    "Change language",
  ]);
  await act(async () =>
    buttons()
      .find((n) => n.props.title === "Create Account")!
      .props.onPress(),
  );
  expect(buttons().map((n) => n.props.title)).toEqual(["Create Seller Account"]);
  await act(async () => tree.root.findByType("Page" as any).props.back());
  expect(buttons().map((n) => n.props.title)).toContain("Log In");
  await act(async () =>
    buttons()
      .find((n) => n.props.title === "Create Account")!
      .props.onPress(),
  );
  expect(buttons()[0]!.props.title).toBe("Create Seller Account");
  await act(async () => buttons()[0]!.props.onPress());
  expect(h.register).toHaveBeenCalledWith("SELLER");
  expect(h.login).not.toHaveBeenCalled();
});
it("shows a registration error without bringing back competing welcome actions", async () => {
  h.register.mockRejectedValueOnce(new Error("Try again"));
  await act(async () => {
    tree = create(<Role />);
  });
  await act(async () =>
    tree.root
      .findAllByType("Button" as any)
      .find((n) => n.props.title === "Create Account")!
      .props.onPress(),
  );
  await act(async () => tree.root.findByType("Button" as any).props.onPress());
  expect(tree.root.findByType("Notice" as any).props.text).toBe("Try again");
  expect(tree.root.findAllByType("Button" as any)).toHaveLength(1);
});
