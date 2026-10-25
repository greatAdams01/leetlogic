import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ close: vi.fn(), dismiss: vi.fn() }));
vi.mock("react-native", () => ({
  Modal: "Modal",
  View: "View",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  KeyboardAvoidingView: "KeyboardAvoidingView",
  Keyboard: { dismiss: h.dismiss },
  Platform: { OS: "ios" },
  StyleSheet: { create: (styles: unknown) => styles, absoluteFill: {} },
}));
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 20 }),
}));
vi.mock("../localization", () => ({ LocalizedText: "Text", useUI: () => (text: string) => text }));
vi.mock("../components/ui", () => ({
  Heading: "Heading",
  Label: "Label",
  colors: { paper: "white", green: "green", white: "white", ink: "black", line: "grey" },
}));
import { AppSheet } from "../components/app-sheet";
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;
let renderer: ReactTestRenderer;
afterEach(async () => {
  await act(async () => renderer?.unmount());
  vi.clearAllMocks();
});
describe("shared modal sheet", () => {
  it("dismisses consistently from its close button, backdrop, and Android back", async () => {
    await act(async () => {
      renderer = create(
        <AppSheet visible title="Test" onClose={h.close}>
          <span />
        </AppSheet>,
      );
    });
    expect(h.dismiss).toHaveBeenCalledTimes(1);
    h.dismiss.mockClear();
    for (const pressable of renderer.root.findAllByType("Pressable" as never))
      await act(async () => pressable.props.onPress());
    await act(async () => renderer.root.findByType("Modal" as never).props.onRequestClose());
    expect(h.close).toHaveBeenCalledTimes(3);
    expect(h.dismiss).toHaveBeenCalledTimes(3);
  });
  it("blocks all dismissal paths while a save is in progress", async () => {
    await act(async () => {
      renderer = create(
        <AppSheet visible busy title="Test" onClose={h.close}>
          <span />
        </AppSheet>,
      );
    });
    for (const pressable of renderer.root.findAllByType("Pressable" as never)) {
      expect(pressable.props.disabled).toBe(true);
      await act(async () => pressable.props.onPress());
    }
    await act(async () => renderer.root.findByType("Modal" as never).props.onRequestClose());
    expect(h.close).not.toHaveBeenCalled();
  });
  it("keeps actions outside scrolling forms and leaves native map/list gestures unwrapped", async () => {
    await act(async () => {
      renderer = create(
        <AppSheet visible title="Test" onClose={h.close} footer={<button>Save</button>}>
          <span>Form</span>
        </AppSheet>,
      );
    });
    expect(renderer.root.findByType("ScrollView" as never).findAllByType("button")).toHaveLength(0);
    expect(renderer.root.findAllByType("button")).toHaveLength(1);
    await act(async () =>
      renderer.update(
        <AppSheet visible scroll={false} title="Map" onClose={h.close}>
          <span>Map</span>
        </AppSheet>,
      ),
    );
    expect(renderer.root.findAllByType("ScrollView" as never)).toHaveLength(0);
    await act(async () =>
      renderer.update(
        <AppSheet visible={false} title="Map" onClose={h.close}>
          <span />
        </AppSheet>,
      ),
    );
    expect(renderer.root.findAllByType("Modal" as never)).toHaveLength(0);
  });
});
