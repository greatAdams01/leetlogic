import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  change: vi.fn(),
  id: null as string | null,
  locate: vi.fn(),
  foreground: null as any,
}));
vi.mock("react-native", () => ({
  View: "View",
  AppState: {
    addEventListener: (_: string, fn: unknown) => {
      h.foreground = fn;
      return { remove() {} };
    },
  },
}));
vi.mock("./device-location", () => ({ captureFarmPosition: h.locate }));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem: h.get, setItem: h.set },
}));
vi.mock("../state", () => ({
  useApp: () => ({
    user: h.id ? { id: h.id } : null,
    error: (e: Error) => e.message,
    ui: (s: string) => s,
  }),
}));
vi.mock("../components/Select", () => ({ Select: "Select" }));
vi.mock("../components/ui", () => ({
  Card: "Card",
  Label: "Label",
  Button: "Button",
  Notice: "Notice",
  colors: {},
}));
import {
  BuyerLocation as LocationControls,
  BuyerLocationProvider,
  useBuyerLocation,
} from "../components/buyer-location";
function BuyerLocation(props: { onChange: (area: any) => void }) {
  return (
    <BuyerLocationProvider key={h.id || "guest"} enabled>
      <LocationControls {...props} />
    </BuyerLocationProvider>
  );
}
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let tree: ReactTestRenderer;
beforeEach(() => {
  vi.clearAllMocks();
  h.id = null;
  h.locate.mockRejectedValue(new Error("Location access was not allowed."));
  h.get.mockResolvedValue(null);
  h.set.mockResolvedValue(undefined);
});
afterEach(async () => {
  await act(async () => tree?.unmount());
});
it("lets guests filter by state and local government and resets the LGA when state changes", async () => {
  await act(async () => {
    tree = create(<BuyerLocation onChange={h.change} />);
  });
  expect(h.get).toHaveBeenCalledWith("buyer-area:guest");
  await act(async () => tree.root.findByType("Select" as any).props.onChange("Lagos"));
  const lga = () => tree.root.findAllByType("Select" as any)[1]!;
  expect(lga().props.options).toContain("Ikeja");
  await act(async () => lga().props.onChange("Ikeja"));
  expect(h.change).toHaveBeenLastCalledWith({ state: "Lagos", lga: "Ikeja" });
  await act(async () => tree.root.findAllByType("Select" as any)[0]!.props.onChange("Abia"));
  expect(h.change).toHaveBeenLastCalledWith({ state: "Abia", lga: "" });
  expect(h.set).toHaveBeenLastCalledWith(
    "buyer-area:guest",
    JSON.stringify({ state: "Abia", lga: "" }),
  );
});
it("restores valid account preferences and discards a local government from another state", async () => {
  h.id = "buyer-a";
  h.get.mockResolvedValue(JSON.stringify({ state: "Lagos", lga: "Umuahia North" }));
  await act(async () => {
    tree = create(<BuyerLocation onChange={h.change} />);
  });
  expect(h.get).toHaveBeenCalledWith("buyer-area:buyer-a");
  expect(h.change).toHaveBeenLastCalledWith({ state: "Lagos", lga: "" });
  h.id = "buyer-b";
  h.get.mockResolvedValue(null);
  await act(async () => tree.update(<BuyerLocation onChange={h.change} />));
  expect(h.change).toHaveBeenLastCalledWith({ state: "", lga: "" });
});
it("keeps all-Nigeria browsing available when saved preferences are corrupt", async () => {
  h.get.mockResolvedValue("invalid json");
  await act(async () => {
    tree = create(<BuyerLocation onChange={h.change} />);
  });
  expect(h.change).toHaveBeenLastCalledWith({ state: "", lga: "" });
  expect(tree.root.findByType("Select" as any).props.disabled).toBe(false);
});

it("uses a fresh device fix by default and persists no precise coordinates", async () => {
  h.locate.mockResolvedValue({ point: { latitude: 6.52, longitude: 3.37 }, accuracy: 10 });
  await act(async () => {
    tree = create(<BuyerLocation onChange={h.change} />);
  });
  expect(h.locate).toHaveBeenCalledWith("buyer");
  expect(h.change).toHaveBeenLastCalledWith({
    state: "",
    lga: "",
    latitude: 6.52,
    longitude: 3.37,
    radiusKm: 50,
  });
  expect(h.set).toHaveBeenLastCalledWith(
    "buyer-area:guest",
    JSON.stringify({ mode: "device", radiusKm: 50 }),
  );
  h.locate.mockResolvedValue({ point: { latitude: 6.53, longitude: 3.38 }, accuracy: 10 });
  await act(async () => h.foreground("active"));
  expect(h.change).toHaveBeenLastCalledWith({
    state: "",
    lga: "",
    latitude: 6.53,
    longitude: 3.38,
    radiusKm: 50,
  });
});
it("lets a manual choice win over a pending GPS response", async () => {
  h.get.mockResolvedValue(JSON.stringify({ state: "Lagos", lga: "Ikeja" }));
  let resolve!: (value: unknown) => void;
  h.locate.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  await act(async () => {
    tree = create(<BuyerLocation onChange={h.change} />);
  });
  await act(async () =>
    tree.root
      .findAllByType("Button" as any)
      .find((n) => n.props.title === "Use my current location")!
      .props.onPress(),
  );
  await act(async () => tree.root.findAllByType("Select" as any)[0]!.props.onChange("Abia"));
  await act(async () => resolve({ point: { latitude: 6.52, longitude: 3.37 }, accuracy: 10 }));
  expect(h.change).toHaveBeenLastCalledWith({ state: "Abia", lga: "" });
});

it("keeps the active location when controls are left and reopened", async () => {
  h.locate.mockResolvedValue({ point: { latitude: 6.52, longitude: 3.37 }, accuracy: 10 });
  let current!: ReturnType<typeof useBuyerLocation>;
  function Probe() {
    current = useBuyerLocation();
    return null;
  }
  const content = (show: boolean) => (
    <BuyerLocationProvider enabled>
      <Probe />
      {show && <LocationControls />}
    </BuyerLocationProvider>
  );
  await act(async () => {
    tree = create(content(true));
  });
  await act(async () => tree.update(content(false)));
  expect(current.area.latitude).toBe(6.52);
  await act(async () => current.choose({ state: "Lagos", lga: "Ikeja" }));
  await act(async () => tree.update(content(true)));
  expect(current.area).toEqual({ state: "Lagos", lga: "Ikeja" });
  expect(h.locate).toHaveBeenCalledTimes(1);
});
