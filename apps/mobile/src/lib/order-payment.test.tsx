import React from "react";
import { act, create } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  api: vi.fn(),
  active: null as any,
  changed: vi.fn(),
  open: vi.fn(),
  init: vi.fn(),
  refresh: vi.fn(),
  data: null as any,
}));
vi.mock("react-native", () => ({
  View: "View",
  Linking: { openURL: h.open },
  AppState: {
    addEventListener: (_: string, listener: any) => {
      h.active = listener;
      return { remove() {} };
    },
  },
}));
vi.mock("../components/ui", () => ({
  Button: "Button",
  Card: "Card",
  Heading: "Heading",
  Label: "Label",
  Notice: "Notice",
}));
vi.mock("../state", () => ({
  useApp: () => ({ status: (s: string) => s, error: (e: any) => e.message || e.code }),
}));
vi.mock("./api", () => ({ api: h.api }));
import { OrderPayment } from "../components/order-payment";
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let tree: any;
const pending = (status = "OPEN") => ({
  id: "payment",
  kind: "ORDER",
  status,
  amountMinor: "10000",
  checkoutUrl: status === "OPEN" ? "https://sandbox-checkout.bachs.io/c/existing" : null,
});
const button = (title: string) =>
  tree.root.findAllByType("Button").find((node: any) => node.props.title === title);
const render = async () => {
  await act(async () => {
    tree = create(<OrderPayment orderId="order" isBuyer onChanged={h.changed} />);
  });
};
beforeEach(() => {
  vi.clearAllMocks();
  h.init.mockReset();
  h.refresh.mockReset();
  h.data = {
    enabled: true,
    orderStatus: "AWAITING_PAYMENT",
    heldMinor: "0",
    releasedMinor: "0",
    refundedMinor: "0",
    items: [],
  };
  h.init.mockImplementation(async () => {
    const p = pending();
    h.data.items = [p];
    return p;
  });
  h.refresh.mockResolvedValue({});
  h.api.mockImplementation(async (path: string) => {
    if (path.endsWith("/checkout")) return h.init();
    if (path.endsWith("/refresh")) return h.refresh();
    return { ...h.data, items: [...h.data.items] };
  });
});
afterEach(async () => {
  await act(async () => tree?.unmount());
});
it("starts checkout once, accepts the exact sandbox host and switches to check payment", async () => {
  await render();
  expect(button("Make Payment")).toBeDefined();
  await act(async () => button("Make Payment").props.onPress());
  expect(h.init).toHaveBeenCalledOnce();
  expect(h.open).toHaveBeenCalledWith("https://sandbox-checkout.bachs.io/c/existing");
  expect(button("Make Payment")).toBeUndefined();
  expect(button("Check Payment")).toBeDefined();
  await act(async () => button("Continue payment").props.onPress());
  expect(h.init).toHaveBeenCalledOnce();
  expect(h.open).toHaveBeenCalledTimes(2);
});
it("prevents concurrent initiation even before a re-render", async () => {
  await render();
  const press = button("Make Payment").props.onPress;
  await act(async () => {
    press();
    press();
  });
  expect(h.init).toHaveBeenCalledOnce();
});
it("reconciles pending payment on return and removes payment actions after confirmation", async () => {
  h.data.items = [pending()];
  h.refresh.mockImplementation(async () => {
    h.data.items = [{ ...pending(), status: "SUCCEEDED" }];
    h.data.heldMinor = "10000";
    h.data.orderStatus = "FUNDED";
  });
  await render();
  await act(async () => h.active("active"));
  expect(h.api).toHaveBeenCalledWith("/orders/order/payments/payment/refresh", {
    method: "POST",
    body: {},
  });
  expect(h.changed).toHaveBeenCalledOnce();
  expect(button("Make Payment")).toBeUndefined();
  expect(button("Check Payment")).toBeUndefined();
  expect(
    tree.root.findAllByType("Label").some((n: any) => n.props.children === "Payment confirmed"),
  ).toBe(true);
});
it("keeps unknown initialization on check payment without starting another checkout", async () => {
  h.data.items = [pending("UNKNOWN")];
  await render();
  expect(button("Make Payment")).toBeUndefined();
  expect(button("Continue payment")).toBeUndefined();
  await act(async () => button("Check Payment").props.onPress());
  expect(h.refresh).toHaveBeenCalledOnce();
  expect(h.init).not.toHaveBeenCalled();
});
it("shows queued initialization as check payment even without a hosted URL", async () => {
  h.init.mockImplementation(async () => {
    const p = pending("QUEUED");
    h.data.items = [p];
    return p;
  });
  await render();
  await act(async () => button("Make Payment").props.onPress());
  expect(button("Check Payment")).toBeDefined();
  expect(button("Make Payment")).toBeUndefined();
  expect(h.open).not.toHaveBeenCalled();
});
it("shows a definite gateway rejection and allows a deliberate retry", async () => {
  h.init.mockRejectedValue(new Error("Payment rejected"));
  await render();
  await act(async () => button("Make Payment").props.onPress());
  expect(
    tree.root.findAllByType("Notice").some((n: any) => n.props.text === "Payment rejected"),
  ).toBe(true);
  expect(button("Make Payment")).toBeDefined();
});
it("does not silently hide a failed payment-status load", async () => {
  h.api.mockRejectedValueOnce(new Error("Connection failed"));
  await render();
  expect(
    tree.root.findAllByType("Notice").some((n: any) => n.props.text === "Connection failed"),
  ).toBe(true);
  expect(button("Make Payment")).toBeUndefined();
  expect(button("Check Payment")).toBeDefined();
});

it("keeps a declined card on the same open checkout with check and continue actions", async () => {
  h.data.items = [{ ...pending(), exceptionCode: "PAYMENT_ATTEMPT_FAILED" }];
  await render();
  expect(button("Make Payment")).toBeUndefined();
  expect(button("Check Payment")).toBeDefined();
  expect(button("Continue payment")).toBeDefined();
  expect(
    tree.root.findAllByType("Notice").some((n: any) => n.props.text === "PAYMENT_ATTEMPT_FAILED"),
  ).toBe(true);
});
