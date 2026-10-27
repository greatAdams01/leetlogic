import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  open: vi.fn().mockResolvedValue(undefined),
  share: vi.fn().mockResolvedValue({}),
  like: vi.fn(),
}));
vi.mock("react-native", () => ({
  View: "View",
  Pressable: "Pressable",
  Linking: { openURL: h.open },
  Share: { share: h.share },
}));
vi.mock("../components/ui", () => ({
  Button: "Button",
  Icon: "Icon",
  Label: "Label",
  Notice: "Notice",
  colors: {},
}));
vi.mock("../components/app-sheet", () => ({
  AppSheet: ({ visible, children }: any) =>
    visible ? React.createElement("Sheet", {}, children) : null,
}));
vi.mock("./api", () => ({ API_URL: "http://localhost:3000" }));
vi.mock("../state", () => ({ useApp: () => ({ ui: (s: string) => s, unit: (s: string) => s }) }));
import { ProductActions } from "../components/product-actions";
(globalThis as any).__DEV__ = true;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let tree: ReactTestRenderer;
afterEach(async () => {
  await act(async () => tree?.unmount());
  vi.clearAllMocks();
});
const item = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Tomatoes",
  unitPriceMinor: "800000",
  unitCode: "BASKET",
  farmerProfile: { farmName: "Farm" },
} as any;
it("shares product details through WhatsApp only after the buyer chooses it", async () => {
  await act(async () => {
    tree = create(<ProductActions item={item} liked={false} busy={false} onLike={h.like} />);
  });
  expect(h.open).not.toHaveBeenCalled();
  await act(async () =>
    tree.root
      .findAllByType("Pressable" as any)
      .find((node) => node.props.accessibilityLabel === "Share produce")!
      .props.onPress(),
  );
  await act(async () =>
    tree.root
      .findAllByType("Button" as any)
      .find((node) => node.props.title === "Share to WhatsApp")!
      .props.onPress(),
  );
  const link = new URL(h.open.mock.calls[0]![0]);
  expect(link.hostname).toBe("wa.me");
  expect(link.searchParams.get("text")).toContain("Tomatoes\n₦8,000 / BASKET");
  expect(link.searchParams.get("text")).toContain(`/produce/${item.id}`);
  expect(tree.root.findAllByType("Sheet" as any)).toHaveLength(0);
});
it("reflects the saved like and disables interaction during a write", async () => {
  await act(async () => {
    tree = create(<ProductActions item={item} liked={true} busy={true} onLike={h.like} />);
  });
  const heart = tree.root
    .findAllByType("Pressable" as any)
    .find((node) => node.props.accessibilityLabel === "Unlike produce")!;
  expect(heart.props.accessibilityState).toMatchObject({ selected: true, busy: true });
  expect(heart.props.disabled).toBe(true);
});
