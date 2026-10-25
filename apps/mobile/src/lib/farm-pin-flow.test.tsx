import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ capture: vi.fn(), confirm: vi.fn(), animate: vi.fn() }));
vi.mock("react-native", () => ({
  Modal: "Modal",
  View: "View",
  Pressable: "Pressable",
  StyleSheet: { create: (styles: unknown) => styles, absoluteFill: {} },
}));
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 20 }),
}));
vi.mock("../localization", () => ({ LocalizedText: "Text" }));
vi.mock("react-native-maps", async () => {
  const { forwardRef, useImperativeHandle, createElement } = await import("react");
  return {
    default: forwardRef((props, ref) => {
      useImperativeHandle(ref, () => ({ animateToRegion: h.animate }));
      return createElement("MapView", props);
    }),
  };
});
vi.mock("./device-location", () => ({ captureFarmPosition: h.capture }));
vi.mock("../state", () => ({
  useApp: () => ({ error: (e: Error) => e.message, ui: (text: string) => text }),
}));
vi.mock("../components/app-sheet", async () => {
  const { createElement } = await import("react");
  return {
    AppSheet: ({
      children,
      footer,
      visible,
      ...props
    }: {
      children?: React.ReactNode;
      footer?: React.ReactNode;
      visible: boolean;
    }) => (visible ? createElement("AppSheet", props, children, footer) : null),
  };
});
vi.mock("../components/ui", async () => {
  const { createElement } = await import("react");
  return {
    colors: {
      paper: "#fff",
      green: "green",
      white: "#fff",
      muted: "grey",
      line: "#ddd",
      ink: "#111",
    },
    ...Object.fromEntries(
      ["Button", "Card", "Heading", "Label", "Notice", "Page"].map((name) => [
        name,
        ({
          children,
          footer,
          ...props
        }: {
          children?: React.ReactNode;
          footer?: React.ReactNode;
        }) => createElement(name, props, children, footer),
      ]),
    ),
  };
});
import { FarmPin } from "../components/farm-pin";
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;
let renderer: ReactTestRenderer;
const button = (title: string) =>
  renderer.root.findAllByType("Button" as never).find((node) => node.props.title === title)!;
beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(async () => {
  await act(async () => renderer?.unmount());
});
describe("farm map confirmation", () => {
  it("requests no location on mount and saves only after explicit confirmation", async () => {
    h.capture.mockResolvedValue({ point: { latitude: 6.52, longitude: 3.37 }, accuracy: 10 });
    await act(async () => {
      renderer = create(<FarmPin onConfirm={h.confirm} />);
    });
    expect(h.capture).not.toHaveBeenCalled();
    await act(async () => button("Use my current location").props.onPress());
    expect(h.confirm).not.toHaveBeenCalled();
    expect(renderer.root.findByType("MapView" as never).props.initialRegion.latitude).toBe(6.52);
    expect(h.animate).not.toHaveBeenCalled();
    await act(async () => renderer.root.findByType("MapView" as never).props.onMapReady());
    expect(h.animate).toHaveBeenCalledWith(
      expect.objectContaining({ latitude: 6.52, longitude: 3.37 }),
      350,
    );
    await act(async () => button("Confirm location pin").props.onPress());
    expect(h.confirm).toHaveBeenCalledWith({ latitude: 6.52, longitude: 3.37 });
    expect(renderer.root.findAllByType("AppSheet" as never)).toHaveLength(0);
  });
  it("allows manual map selection without saving a default or a cancelled pin", async () => {
    await act(async () => {
      renderer = create(<FarmPin onConfirm={h.confirm} />);
    });
    await act(async () => button("Choose location on map").props.onPress());
    expect(button("Confirm location pin").props.disabled).toBe(true);
    await act(async () =>
      renderer.root
        .findByType("MapView" as never)
        .props.onPress({ nativeEvent: { coordinate: { latitude: 6, longitude: 3 } } }),
    );
    expect(button("Confirm location pin").props.disabled).toBe(false);
    await act(async () => renderer.root.findByType("AppSheet" as never).props.onClose());
    expect(h.confirm).not.toHaveBeenCalled();
    expect(h.capture).not.toHaveBeenCalled();
  });
  it("uses the map centre after a gesture and never saves the initial default region", async () => {
    await act(async () => {
      renderer = create(<FarmPin onConfirm={h.confirm} />);
    });
    await act(async () => button("Choose location on map").props.onPress());
    const map = renderer.root.findByType("MapView" as never);
    await act(async () =>
      map.props.onRegionChangeComplete({ latitude: 9.08, longitude: 8.67 }, {}),
    );
    expect(button("Confirm location pin").props.disabled).toBe(true);
    await act(async () => map.props.onPanDrag());
    expect(button("Confirm location pin").props.disabled).toBe(true);
    await act(async () =>
      map.props.onRegionChangeComplete({ latitude: 6.1111118, longitude: 3.2222228 }, {}),
    );
    expect(button("Confirm location pin").props.disabled).toBe(false);
    await act(async () => button("Confirm location pin").props.onPress());
    expect(h.confirm).toHaveBeenCalledWith({ latitude: 6.111112, longitude: 3.222223 });
  });
  it("recentres an already open map after GPS and ignores results after closing", async () => {
    h.capture.mockResolvedValue({ point: { latitude: 6.52, longitude: 3.37 }, accuracy: 10 });
    await act(async () => {
      renderer = create(<FarmPin onConfirm={h.confirm} />);
    });
    await act(async () => button("Choose location on map").props.onPress());
    await act(async () => renderer.root.findByType("MapView" as never).props.onMapReady());
    await act(async () => button("Use my current location").props.onPress());
    expect(h.animate).toHaveBeenCalledWith(
      expect.objectContaining({ latitude: 6.52, longitude: 3.37 }),
      350,
    );
    let resolve!: (value: unknown) => void;
    h.capture.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    await act(async () => button("Use my current location").props.onPress());
    await act(async () => renderer.root.findByType("AppSheet" as never).props.onClose());
    await act(async () => resolve({ point: { latitude: 7, longitude: 4 }, accuracy: 10 }));
    expect(renderer.root.findAllByType("AppSheet" as never)).toHaveLength(0);
    expect(h.confirm).not.toHaveBeenCalled();
  });
  it("keeps permission failure visible and still offers manual map selection", async () => {
    h.capture.mockRejectedValue(new Error("Location access was not allowed."));
    await act(async () => {
      renderer = create(<FarmPin onConfirm={h.confirm} />);
    });
    await act(async () => button("Use my current location").props.onPress());
    expect(
      renderer.root
        .findAllByType("Notice" as never)
        .some(
          (notice) =>
            notice.props.error && notice.props.text === "Location access was not allowed.",
        ),
    ).toBe(true);
    expect(button("Choose location on map").props.disabled).toBe(false);
  });
});
