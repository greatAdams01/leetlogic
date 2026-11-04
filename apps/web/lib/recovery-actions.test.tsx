// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ api: vi.fn(), record: null as any }));
vi.mock("../lib/customer-api", () => ({ customerApi: h.api }));
vi.mock("../components/language-provider", () => ({ useLanguage: () => ({ locale: "en" }) }));
vi.mock("next/link", () => ({
  default: ({ href, children }: any) => <a href={href}>{children}</a>,
}));
import { CustomerRecovery } from "../components/customer-recovery";
beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  h.record = {
    id: "recovery",
    orderId: "order",
    reference: "LL-12345678",
    title: "Rice",
    quantity: "2",
    isBuyer: false,
    version: 1,
    state: "WAITING_FARMER",
    payment: { paymentConfirmed: true },
    deadline: { state: "ACTIVE", refundDueAt: new Date(Date.now() + 3600000).toISOString() },
  };
  h.api.mockImplementation(async (path: string) =>
    path === "orders/recoveries" ? { items: [h.record] } : {},
  );
});
afterEach(cleanup);
it("offers a waiting farmer explicit stock confirmation", async () => {
  render(<CustomerRecovery orderId="order" />);
  const confirm = await screen.findByRole("button", {
    name: "Confirm stock and pickup availability",
  });
  await act(async () => fireEvent.click(confirm));
  expect(h.api).toHaveBeenCalledWith(
    "orders/recoveries/recovery/farmer",
    expect.objectContaining({ preparationMinutes: 60 }),
  );
});
it("lets the buyer request a refund before a proposal exists", async () => {
  h.record.isBuyer = true;
  h.record.payment.amountMinor = "10000";
  render(<CustomerRecovery orderId="order" />);
  const refund = await screen.findByRole("button", { name: "Request refund" });
  await act(async () => fireEvent.click(refund));
  expect(h.api).toHaveBeenCalledWith("orders/recoveries/recovery/decline", expect.any(Object));
});
it("explains an overdue refund and offers staff help instead of invalid confirmation", async () => {
  h.record.deadline = {
    state: "REFUND_BLOCKED",
    refundDueAt: new Date(Date.now() - 1000).toISOString(),
  };
  render(<CustomerRecovery orderId="order" />);
  const support = await screen.findByRole("button", { name: "Ask staff for help" });
  expect(
    screen.queryByRole("button", { name: "Confirm stock and pickup availability" }),
  ).toBeNull();
  expect(screen.queryByRole("button", { name: "Request refund" })).toBeNull();
  expect(screen.getByText("Refund needs staff attention")).toBeTruthy();
  await act(async () => fireEvent.click(support));
  expect(h.api).toHaveBeenCalledWith("orders/recoveries/recovery/support", expect.any(Object));
});
