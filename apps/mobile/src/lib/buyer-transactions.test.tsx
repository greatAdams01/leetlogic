import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  data: { items: [], canOpen: true } as any,
  api: vi.fn(),
  reload: vi.fn(),
  choose: vi.fn(),
  photoBody: vi.fn(),
  user: { id: "buyer" } as any,
  resource: vi.fn(),
  foreground: null as any,
}));
vi.mock("react-native", () => ({
  Image: "Image",
  View: "View",
  Pressable: "Pressable",
  AppState: {
    addEventListener: (_: string, fn: any) => {
      h.foreground = fn;
      return { remove() {} };
    },
  },
}));
vi.mock("expo-file-system", () => ({ File: class {}, Paths: {} }));
vi.mock("expo-crypto", () => ({ randomUUID: () => "photo" }));
vi.mock("../components/ui", () => ({
  Button: "Button",
  Icon: "Icon",
  Card: "Card",
  Field: "Field",
  Heading: "Heading",
  Label: "Label",
  Notice: "Notice",
  colors: {},
}));
vi.mock("../components/Select", () => ({ Select: "Select" }));
vi.mock("../components/app-sheet", () => ({
  AppSheet: ({ visible, children, footer }: any) =>
    visible ? React.createElement("Sheet", {}, children, footer) : null,
}));
vi.mock("./api", () => ({ api: h.api }));
vi.mock("./produce-photo", () => ({ choosePhoto: h.choose, photoBody: h.photoBody }));
vi.mock("../state", () => ({
  useApp: () => ({
    user: h.user,
    locale: "en",
    ui: (s: string) => s,
    error: (e: Error) => e.message,
    go: vi.fn(),
  }),
  useResource: (path: string, enabled = true) => {
    h.resource(path, enabled);
    return { data: h.data, reload: h.reload, loading: false };
  },
}));
import { OrderDisputes } from "../components/order-disputes";
import { BuyerEscrow } from "../components/buyer-escrow";
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let tree: ReactTestRenderer;
const button = (title: string) =>
  tree.root.findAllByType("Button" as any).find((node) => node.props.title === title)!;
beforeEach(() => {
  vi.clearAllMocks();
  h.data = { items: [], canOpen: true };
  h.user = { id: "buyer" };
});
afterEach(async () => {
  await act(async () => tree?.unmount());
});
it("submits a reason and description once and keeps server failures in the open modal", async () => {
  await act(async () => {
    tree = create(<OrderDisputes orderId="order" />);
  });
  await act(async () => button("Open Dispute").props.onPress());
  await act(async () =>
    tree.root.findByType("Field" as any).props.onChangeText("Produce arrived damaged."),
  );
  let reject!: (e: Error) => void;
  h.api.mockReturnValueOnce(
    new Promise((_, no) => {
      reject = no;
    }),
  );
  let submission: Promise<void>;
  await act(async () => {
    submission = button("Submit dispute").props.onPress();
    button("Submit dispute").props.onPress();
  });
  expect(h.api).toHaveBeenCalledTimes(1);
  expect(h.api).toHaveBeenCalledWith("/orders/order/disputes", {
    method: "POST",
    body: { reason: "NOT_RECEIVED", description: "Produce arrived damaged.", sourceLocale: "en" },
  });
  expect(button("Submit dispute").props.loading).toBe(true);
  await act(async () => {
    reject(new Error("Payment settlement has already started."));
    await submission!;
  });
  expect(
    tree.root.findAllByType("Notice" as any).some((node) => node.props.text.includes("settlement")),
  ).toBe(true);
  expect(tree.root.findAllByType("Sheet" as any)).toHaveLength(1);
});
it("shows active status, attaches evidence and refreshes without opening a duplicate dispute", async () => {
  h.data = {
    canOpen: true,
    items: [
      { id: "ticket", subject: "QUALITY", status: "IN_PROGRESS", messages: [], evidence: [] },
    ],
  };
  h.choose.mockResolvedValue({ uri: "file:///photo.jpg", mimeType: "image/jpeg" });
  h.photoBody.mockResolvedValue({ bytes: new Uint8Array([1]), contentType: "image/jpeg" });
  h.api.mockResolvedValue({});
  await act(async () => {
    tree = create(<OrderDisputes orderId="order" />);
  });
  expect(button("Open Dispute")).toBeUndefined();
  await act(async () => button("Add evidence photo").props.onPress());
  expect(h.api).toHaveBeenCalledWith(
    "/orders/order/disputes/ticket/evidence",
    expect.objectContaining({ method: "POST", binary: expect.anything() }),
  );
  expect(h.reload).toHaveBeenCalled();
});
it("shows actual held funds and refreshes after returning from a payment", async () => {
  h.data = { heldMinor: "125050", orderCount: 2 };
  await act(async () => {
    tree = create(<BuyerEscrow />);
  });
  expect(JSON.stringify(tree.toJSON())).toContain("1,250.50");
  await act(async () => h.foreground("active"));
  expect(h.reload).toHaveBeenCalledTimes(1);
});
it("does not request a balance for a guest or offer a dispute on an unfunded order", async () => {
  h.user = null;
  await act(async () => {
    tree = create(<BuyerEscrow />);
  });
  expect(h.resource).toHaveBeenCalledWith("/orders/escrow-summary", false);
  expect(tree.toJSON()).toBeNull();
  h.data = { items: [], canOpen: false };
  await act(async () => tree.update(<OrderDisputes orderId="order" />));
  expect(button("Open Dispute")).toBeUndefined();
});
