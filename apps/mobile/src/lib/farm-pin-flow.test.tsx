import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ capture: vi.fn(), confirm: vi.fn() }));
vi.mock("react-native", () => ({ Modal: "Modal", View: "View" }));
vi.mock("react-native-maps", () => ({ default: "MapView", Marker: "Marker" }));
vi.mock("./device-location", () => ({ captureFarmPosition: h.capture }));
vi.mock("../state", () => ({
  useApp: () => ({ error: (e: Error) => e.message, ui: (text: string) => text }),
}));
vi.mock("../components/ui", async () => {
  const { createElement } = await import("react");
  return Object.fromEntries(
    ["Button", "Card", "Heading", "Label", "Notice", "Page"].map((name) => [
      name,
      ({ children, footer, ...props }: { children?: React.ReactNode; footer?: React.ReactNode }) =>
        createElement(name, props, children, footer),
    ]),
  );
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
    expect(renderer.root.findByType("Marker" as never).props.coordinate.latitude).toBe(6.52);
    await act(async () => button("Confirm location pin").props.onPress());
    expect(h.confirm).toHaveBeenCalledWith({ latitude: 6.52, longitude: 3.37 });
    expect(renderer.root.findAllByType("Modal" as never)).toHaveLength(0);
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
    await act(async () => button("Cancel").props.onPress());
    expect(h.confirm).not.toHaveBeenCalled();
    expect(h.capture).not.toHaveBeenCalled();
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
