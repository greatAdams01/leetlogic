import React from "react";
import { act, create } from "react-test-renderer";
import { expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ api: vi.fn(), active: null as any, changed: vi.fn() }));
vi.mock("react-native", () => ({
  View: "View", Linking: { openURL: vi.fn() },
  AppState: { addEventListener: (_: string, listener: any) => { h.active = listener; return { remove() {} }; } },
}));
vi.mock("../components/ui", () => ({ Button: "Button", Card: "Card", Heading: "Heading", Label: "Label", Notice: "Notice" }));
vi.mock("../state", () => ({ useApp: () => ({ status: (s: string) => s, error: (e: Error) => e.message }) }));
vi.mock("./api", () => ({ api: h.api }));
import { OrderPayment } from "../components/order-payment";
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
it("reconciles pending Bachs payment on return and refreshes the order", async () => {
  const pending = { enabled: true, items: [{ id: "payment", status: "OPEN", amountMinor: "10000" }] };
  h.api.mockResolvedValueOnce(pending).mockResolvedValueOnce(pending).mockResolvedValueOnce({})
    .mockResolvedValueOnce({ ...pending, items: [{ ...pending.items[0], status: "SUCCEEDED" }] });
  let tree: any;
  await act(async () => { tree = create(<OrderPayment orderId="order" isBuyer onChanged={h.changed} />); });
  await act(async () => { h.active("active"); });
  expect(h.api).toHaveBeenCalledWith("/orders/order/payments/payment/refresh", { method: "POST", body: {} });
  expect(h.changed).toHaveBeenCalledOnce();
  expect(tree.root.findAllByType("Label").some((n: any) => n.props.children === "SUCCEEDED")).toBe(true);
  await act(async () => tree.unmount());
});
