// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ call: vi.fn(), params: new URLSearchParams(), record: null as any }));
vi.mock("next/navigation", () => ({ useSearchParams: () => h.params }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("../components/admin/money-actions", () => ({
  MoneyActions: () => <p>Payment actions</p>,
}));
vi.mock("../components/admin/finance-ui", async () => ({
  ...(await vi.importActual<any>("../components/admin/finance-ui")),
  financeRequest: h.call,
}));
import { MoneyRecordReview, financeReturnPath } from "../components/admin/money-record-review";
const id = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  h.params = new URLSearchParams({
    returnTo: "/admin/reconciliation?finTab=payments&finSearch=rice&finPage=3",
  });
  h.record = {
    id,
    kind: "ORDER",
    orderId: id,
    orderReference: "ORDER-42",
    status: "EXCEPTION",
    paidMinor: "11000",
    produceMinor: "10000",
    shippingMinor: "1000",
    processingFeeMinor: "200",
    createdAt: "2026-11-04T13:00:00Z",
  };
  h.call.mockImplementation(async () => h.record);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init: any) =>
      Response.json(
        await h.call(
          String(input).replace("/api/admin/", ""),
          init?.body ? JSON.parse(init.body) : undefined,
        ),
      ),
    ),
  );
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});
it("shows a full-page payment review with context and an exact return to the queue", async () => {
  render(<MoneyRecordReview recordType="payments" recordId={id} manage />);
  await screen.findByText("Payment actions");
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByRole("link", { name: /Back to financial records/ }).getAttribute("href")).toBe(
    "/admin/reconciliation?finTab=payments&finSearch=rice&finPage=3",
  );
  expect(screen.getByText("Technical references").closest("details")?.hasAttribute("open")).toBe(
    false,
  );
  expect(h.call).toHaveBeenCalledWith(`money/records/payments/${id}`);
});
it("rejects external and unrelated return destinations", () => {
  for (const unsafe of [
    "https://evil.test",
    "//evil.test",
    "/admin/users",
    "/admin/reconciliation/../../users",
  ])
    expect(financeReturnPath(unsafe)).toBe("/admin/reconciliation");
  expect(
    financeReturnPath(`/admin/reconciliation/records/payments/${id}?returnTo=queue`),
  ).toContain(`/records/payments/${id}`);
});
it("shows failed loads as errors with a retry instead of empty actions", async () => {
  h.call.mockRejectedValue(new Error("Provider record unavailable"));
  render(<MoneyRecordReview recordType="payments" recordId={id} manage />);
  await screen.findByRole("alert");
  expect(screen.queryByText("Payment actions")).toBeNull();
  expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
});
it("closes recovery controls after expiry and directs staff to the actual refund record", async () => {
  h.record = {
    id,
    orderId: id,
    reference: "ORDER-42",
    state: "WAITING_FARMER",
    payment: { amountMinor: "11000" },
    deadline: { paymentId: id, state: "REFUND_BLOCKED", refundDueAt: "2026-11-01T12:00:00Z" },
  };
  render(<MoneyRecordReview recordType="recoveries" recordId={id} manage />);
  await screen.findByText("Recovery is closed");
  expect(screen.queryByRole("button", { name: "Start refund resolution" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Record farmer confirmation" })).toBeNull();
  expect(
    screen.getByRole("link", { name: /Review payment & refund status/ }).getAttribute("href"),
  ).toContain(`/records/payments/${id}`);
});
it("requires choosing and authorizing refund resolution before changing an active recovery", async () => {
  h.record = {
    id,
    orderId: id,
    reference: "ORDER-42",
    state: "WAITING_FARMER",
    payment: { amountMinor: "11000" },
    deadline: {
      paymentId: id,
      state: "ACTIVE",
      refundDueAt: new Date(Date.now() + 3600000).toISOString(),
    },
  };
  h.call.mockImplementation(async (path: string) => {
    if (path.endsWith("/decline")) {
      h.record = {
        ...h.record,
        state: "REFUND_REQUIRED",
        deadline: { ...h.record.deadline, state: "REFUND_DUE" },
      };
      return { refundDue: true };
    }
    return h.record;
  });
  render(<MoneyRecordReview recordType="recoveries" recordId={id} manage />);
  fireEvent.click(await screen.findByRole("button", { name: "Start refund resolution" }));
  const confirm = screen.getByRole("button", { name: "Confirm refund resolution" });
  expect(confirm.hasAttribute("disabled")).toBe(true);
  expect(h.call.mock.calls.some(([p]) => String(p).endsWith("/decline"))).toBe(false);
  fireEvent.change(screen.getByLabelText("Reason for action"), {
    target: { value: "Farmer cannot supply the original order" },
  });
  fireEvent.change(screen.getByLabelText("Authenticator code"), { target: { value: "123456" } });
  fireEvent.click(confirm);
  await waitFor(() =>
    expect(h.call).toHaveBeenCalledWith(`money/recoveries/${id}/decline`, {
      reason: "Farmer cannot supply the original order",
    }),
  );
  await screen.findByText("Recovery is closed");
});
