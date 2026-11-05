import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  api: vi.fn(),
  pick: vi.fn(),
  body: vi.fn(),
  alert: vi.fn(),
  refresh: vi.fn(),
  close: vi.fn(),
}));
vi.mock("react-native", () => ({ View: "View", Image: "Image" }));
vi.mock("../state", () => ({
  useApp: () => ({ ui: (s: string) => s, error: (e: Error) => e.message, alert: h.alert }),
}));
vi.mock("./api", () => ({ api: h.api }));
vi.mock("./produce-photo", () => ({ choosePhoto: h.pick, photoBody: h.body }));
vi.mock("../components/ui", () => ({
  Button: "Button",
  Icon: "Icon",
  Label: "Label",
  Notice: "Notice",
}));
vi.mock("../components/app-sheet", () => ({
  AppSheet: ({ children, footer, ...props }: any) =>
    React.createElement("Sheet", props, children, footer),
}));
import { ReceiptConfirmation } from "../components/receipt-confirmation";
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let tree: ReactTestRenderer;
const button = (title: string) =>
  tree.root.findAllByType("Button" as any).find((n) => n.props.title === title)!;
beforeEach(() => {
  vi.resetAllMocks();
  h.pick.mockResolvedValue({ uri: "file://photo.jpg", mimeType: "image/jpeg" });
  h.body.mockResolvedValue({ bytes: new Uint8Array([1, 2, 3]), contentType: "image/jpeg" });
  h.api.mockResolvedValue({});
  h.refresh.mockResolvedValue({});
});
afterEach(async () => {
  await act(async () => tree?.unmount());
});
const mount = async () => {
  await act(async () => {
    tree = create(
      <ReceiptConfirmation orderId="order" visible onClose={h.close} onConfirmed={h.refresh} />,
    );
  });
};
it("requires a photo, previews it, and writes evidence before explicit confirmation", async () => {
  await mount();
  expect(button("Confirm Receipt").props.disabled).toBe(true);
  await act(async () => button("Take photo").props.onPress());
  expect(h.pick).toHaveBeenCalledWith(true);
  expect(tree.root.findByType("Image" as any).props.source.uri).toBe("file://photo.jpg");
  await act(async () => button("Confirm Receipt").props.onPress());
  expect(h.api).not.toHaveBeenCalled();
  const submit = h.alert.mock.calls[0]![2][1].onPress;
  await act(async () => {
    submit();
    submit();
  });
  expect(h.api.mock.calls.map((c) => c[0])).toEqual([
    "/orders/order/delivery/receipt-photo",
    "/orders/order/delivery/confirm",
  ]);
  expect(h.api.mock.calls[1]![1].body).toEqual({ acknowledged: true });
  expect(h.close).toHaveBeenCalledOnce();
});
it("keeps the photo and explains an upload failure without confirming receipt", async () => {
  await mount();
  await act(async () => button("Choose photo").props.onPress());
  h.api.mockRejectedValueOnce(new Error("You are offline"));
  await act(async () => button("Confirm Receipt").props.onPress());
  await act(async () => h.alert.mock.calls[0]![2][1].onPress());
  expect(h.api).toHaveBeenCalledTimes(1);
  expect(h.close).not.toHaveBeenCalled();
  expect(tree.root.findByType("Image" as any)).toBeDefined();
  expect(
    tree.root.findAllByType("Notice" as any).some((n) => n.props.text === "You are offline"),
  ).toBe(true);
});
