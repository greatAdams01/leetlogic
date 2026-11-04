import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  item: null as any,
  api: vi.fn(),
  reload: vi.fn(),
  go: vi.fn(),
  inbox: { items: [], unreadCount: 0, readThrough: "" } as any,
}));
vi.mock("react-native", () => ({ Pressable: "Pressable", View: "View" }));
vi.mock("../components/ui", () =>
  Object.fromEntries(
    ["Page", "Heading", "Label", "Field", "Button", "Card", "Notice", "Icon"]
      .map((n) => [n, n])
      .concat([["colors", { green: "green" }] as any, ["s", {}] as any]),
  ),
);
vi.mock("./api", () => ({ api: h.api }));
vi.mock("../state", () => ({
  useApp: () => ({
    user: { id: "farmer" },
    role: "SELLER",
    route: { id: "order" },
    go: h.go,
    back: vi.fn(),
    unit: (s: string) => s,
    status: (s: string) => s,
    date: (s: string) => s,
    ui: (s: string) => s,
    error: (e: any) => e.message,
  }),
  useResource: (path: string) => ({
    data: path.includes("notifications") ? h.inbox : { items: [h.item] },
    reload: h.reload,
    loading: false,
    error: "",
  }),
}));
import { PaymentRecovery } from "../components/payment-recovery";
import { Notifications } from "../screens/notifications";
import { NotificationBell } from "../components/notification-bell";
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let tree: ReactTestRenderer;
beforeEach(() => {
  vi.clearAllMocks();
  h.api.mockResolvedValue({});
  h.reload.mockResolvedValue(undefined);
  h.item = {
    id: "recovery",
    orderId: "order",
    reference: "LONG-ORDER-12345678",
    title: "Rice",
    quantity: "2",
    state: "WAITING_FARMER",
    isBuyer: false,
    version: 1,
    payment: { paymentConfirmed: true },
    deadline: { state: "ACTIVE", refundDueAt: new Date(Date.now() + 3600000).toISOString() },
  };
  h.inbox = { items: [], unreadCount: 3, readThrough: new Date().toISOString() };
});
afterEach(async () => {
  await act(async () => tree?.unmount());
});
const button = (title: string) =>
  tree.root.findAllByType("Button" as any).find((n) => n.props.title === title);
it("gives a farmer explicit confirmation and refusal actions", async () => {
  await act(async () => {
    tree = create(<PaymentRecovery orderId="order" />);
  });
  expect(button("Confirm stock and pickup availability")).toBeDefined();
  expect(button("Cannot fulfill this order")).toBeDefined();
  await act(async () => button("Confirm stock and pickup availability")!.props.onPress());
  expect(h.api).toHaveBeenCalledWith(
    "/orders/recoveries/recovery/farmer",
    expect.objectContaining({
      method: "POST",
      body: expect.objectContaining({ preparationMinutes: 60 }),
    }),
  );
});
it("lets the waiting buyer request a refund without a proposal", async () => {
  h.item.isBuyer = true;
  await act(async () => {
    tree = create(<PaymentRecovery orderId="order" />);
  });
  expect(button("Confirm stock and pickup availability")).toBeUndefined();
  await act(async () => button("Request refund")!.props.onPress());
  expect(h.api.mock.calls[0]![0]).toBe("/orders/recoveries/recovery/decline");
});
it("shows a refund explanation and staff escalation after the deadline", async () => {
  h.item.deadline = {
    state: "REFUND_BLOCKED",
    refundDueAt: new Date(Date.now() - 1000).toISOString(),
  };
  await act(async () => {
    tree = create(<PaymentRecovery orderId="order" />);
  });
  expect(button("Confirm stock and pickup availability")).toBeUndefined();
  expect(button("Request refund")).toBeUndefined();
  expect(button("Ask staff for help")).toBeDefined();
  await act(async () => button("Ask staff for help")!.props.onPress());
  expect(h.api.mock.calls[0]![0]).toBe("/orders/recoveries/recovery/support");
});
it("opens the dedicated assistance screen from the dashboard card", async () => {
  await act(async () => {
    tree = create(<PaymentRecovery />);
  });
  expect(button("Confirm stock and pickup availability")).toBeUndefined();
  button("Review order issue")!.props.onPress();
  expect(h.go).toHaveBeenCalledWith("recovery", "order");
});
it("shows the unread badge and opens the inbox", async () => {
  await act(async () => {
    tree = create(<NotificationBell />);
  });
  expect(
    tree.root
      .findAllByType("Label" as any)
      .some((n) => n.children.includes("3") || n.children.includes(3 as any)),
  ).toBe(true);
  tree.root.findByType("Pressable" as any).props.onPress();
  expect(h.go).toHaveBeenCalledWith("notifications");
});

it("renders readable updates with order context and opens the relevant action screen", async () => {
  h.inbox.items = [
    {
      id: "notice",
      orderId: "order",
      produceTitle: "Rice",
      orderReference: "LL-12345678",
      messageKey: "status.RECOVERY_REQUIRED",
      createdAt: new Date().toISOString(),
      readAt: null,
    },
  ];
  await act(async () => {
    tree = create(<Notifications />);
  });
  const update = tree.root.findByType("Pressable" as any);
  expect(update.props.accessibilityLabel).toBe("Stock confirmation needed");
  await act(async () => update.props.onPress());
  expect(h.api).toHaveBeenCalledWith("/orders/notifications/read", {
    method: "POST",
    body: { ids: ["notice"] },
  });
  expect(h.go).toHaveBeenCalledWith("recovery", "order");
});
it("marks all updates read using the server snapshot cutoff", async () => {
  await act(async () => {
    tree = create(<Notifications />);
  });
  await act(async () => button("Mark all as read")!.props.onPress());
  expect(h.api).toHaveBeenCalledWith("/orders/notifications/read", {
    method: "POST",
    body: { through: h.inbox.readThrough },
  });
});
