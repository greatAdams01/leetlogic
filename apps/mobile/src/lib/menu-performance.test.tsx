import React, { Profiler } from "react";
import { Navigation } from "../components/navigation";
import { Profile } from "../screens/account";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  animations: [] as { useNativeDriver: boolean }[],
  idle: [] as (() => void)[],
  refreshOrders: vi.fn().mockResolvedValue(undefined),
  loadUser: vi.fn().mockResolvedValue(undefined),
  app: {
    role: "SELLER",
    locale: "en",
    route: { name: "home" },
    user: {
      id: "test-account",
      phoneE164: "+2348000000000",
      phoneVerifiedAt: "2026-01-01",
      profile: { fullName: "Test Farmer" },
      farmerProfile: { verificationStatus: "APPROVED", farmName: "Test Farm" },
    },
    reset: vi.fn(),
    go: vi.fn(),
    openLanguage: vi.fn(),
    alert: vi.fn(),
    signOut: vi.fn(),
    ui: (text: string) => text,
    t: (text: string) => text,
    error: (e: unknown) => String(e),
  },
}));
vi.mock("react-native", () => {
  class Value {
    constructor(public value: number) {}
    setValue(value: number) {
      this.value = value;
    }
    stopAnimation() {}
    interpolate() {
      return this;
    }
  }
  const value = (v: number | Value) => (typeof v === "number" ? v : v.value);
  return {
    View: "View",
    Pressable: "Pressable",
    AppState: { currentState: "active", addEventListener: () => ({ remove() {} }) },
    AccessibilityInfo: {
      isReduceMotionEnabled: async () => false,
      addEventListener: () => ({ remove() {} }),
    },
    Easing: { out: (v: unknown) => v, cubic: 0 },
    StyleSheet: { create: (v: unknown) => v },
    Animated: {
      Value,
      View: "AnimatedView",
      add: (a: number | Value, b: number | Value) => value(a) + value(b),
      subtract: (a: number | Value, b: number | Value) => value(a) - value(b),
      divide: (a: number | Value, b: number | Value) => value(a) / value(b),
      timing: (_: unknown, config: { useNativeDriver: boolean }) => {
        h.animations.push(config);
        return { start() {}, stop() {} };
      },
      parallel: () => ({ start() {}, stop() {} }),
    },
  };
});
vi.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView" }));
vi.mock("../state", () => ({
  useApp: () => ({ ...h.app, loadUser: h.loadUser }),
  useResource: () => ({ data: { items: [] }, reload: h.refreshOrders }),
}));
vi.mock("../localization", () => ({ LocalizedText: "Text", useUI: () => (text: string) => text }));
vi.mock("../components/ui", async () => {
  const { createElement } = await import("react");
  const host =
    (name: string) =>
    ({ children, ...props }: { children?: React.ReactNode }) =>
      createElement(name, props, children);
  return {
    Page: host("Page"),
    Heading: host("Heading"),
    Label: host("Label"),
    Field: host("Field"),
    Button: host("Button"),
    Card: host("Card"),
    Notice: host("Notice"),
    Icon: host("Icon"),
    s: {},
    colors: {},
  };
});
vi.mock("../components/Select", () => ({ Select: "Select" }));
vi.mock("../screens/seller", () => ({ Seller: "Seller" }));
vi.mock("./api", () => ({ api: vi.fn() }));
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;
let renderer: ReactTestRenderer | undefined;
beforeEach(() => {
  h.app.route.name = "home";
  h.animations.length = 0;
  h.idle.length = 0;
  vi.clearAllMocks();
  vi.stubGlobal("requestIdleCallback", (work: () => void) => {
    h.idle.push(work);
    return h.idle.length;
  });
  vi.stubGlobal("cancelIdleCallback", vi.fn());
});
afterEach(async () => {
  if (renderer) await act(async () => renderer!.unmount());
  renderer = undefined;
  vi.unstubAllGlobals();
});
describe("Menu responsiveness", () => {
  it("renders Menu actions before refreshing and does not refetch on unrelated rerenders", async () => {
    await act(async () => {
      renderer = create(<Profile />);
    });
    expect(renderer!.root.findAllByType("Pressable" as never).length).toBeGreaterThan(3);
    expect(h.loadUser).not.toHaveBeenCalled();
    await act(async () => {
      h.idle.forEach((work) => work());
    });
    expect(h.loadUser).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 5; i++)
      await act(async () => {
        renderer!.update(<Profile />);
      });
    expect(h.loadUser).toHaveBeenCalledTimes(1);
  });
  it("cancels an initial refresh when a user leaves Menu immediately", async () => {
    await act(async () => {
      renderer = create(<Profile />);
    });
    await act(async () => renderer!.unmount());
    renderer = undefined;
    await act(async () => {
      h.idle.forEach((work) => work());
    });
    expect(h.loadUser).not.toHaveBeenCalled();
  });
  it("uses the native driver throughout repeated Menu transitions without fetching orders per tap", async () => {
    let commits = 0;
    const render = () => (
      <Profiler id="navigation" onRender={() => commits++}>
        <Navigation />
      </Profiler>
    );
    await act(async () => {
      renderer = create(render());
    });
    const bar = renderer!.root
      .findAllByType("View" as never)
      .find((view) => typeof view.props.onLayout === "function")!;
    await act(async () => bar.props.onLayout({ nativeEvent: { layout: { width: 350 } } }));
    h.animations.length = 0;
    for (const name of ["profile", "home", "profile", "orders", "profile"]) {
      h.app.route.name = name;
      await act(async () => {
        renderer!.update(render());
      });
    }
    expect(h.animations.length).toBeGreaterThan(0);
    expect(h.animations.every((animation) => animation.useNativeDriver)).toBe(true);
    expect(h.refreshOrders).not.toHaveBeenCalled();
    expect(commits).toBeLessThan(15);
  });
});
