// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("../lib/customer-api", () => ({ customerApi: h.api }));
vi.mock("../components/language-provider", () => ({ useLanguage: () => ({ locale: "en" }) }));
vi.mock("../components/customer-recovery", () => ({
  CustomerRecovery: () => <aside>Order assistance</aside>,
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
import { CustomerUpdates } from "../components/customer-updates";
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it("loads farmer updates, filters unread records and preserves assistance with a snapshot read action", async () => {
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  const through = "2026-11-04T18:00:00.000Z";
  h.api.mockImplementation(async (path: string) =>
    path === "me"
      ? { user: { capabilities: [{ capability: "SELLER" }] } }
      : path.startsWith("orders/notifications?")
        ? {
            readThrough: through,
            unreadCount: 1,
            items: [
              {
                id: "a",
                orderId: "one",
                messageKey: "status.RECOVERY_CREATED",
                produceTitle: "Rice",
                readAt: null,
                createdAt: through,
              },
              {
                id: "b",
                orderId: "two",
                messageKey: "status.DELIVERED",
                produceTitle: "Beans",
                readAt: through,
                createdAt: through,
              },
            ],
          }
        : {},
  );
  render(<CustomerUpdates />);
  await screen.findByText("Rice");
  expect(h.api).toHaveBeenCalledWith("orders/notifications?view=seller");
  fireEvent.click(screen.getByRole("button", { name: "Unread" }));
  expect(screen.queryByText("Beans")).toBeNull();
  expect(screen.getByText("Order assistance")).toBeTruthy();
  expect(screen.getByRole("link", { name: /View order/ }).getAttribute("href")).toBe(
    "/orders/one#order-assistance",
  );
  fireEvent.click(screen.getByRole("button", { name: "Mark all as read" }));
  await waitFor(() => expect(h.api).toHaveBeenCalledWith("orders/notifications/read", { through }));
  await screen.findByText("No updates match this filter.");
});
