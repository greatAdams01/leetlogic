// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  call: vi.fn(),
  status: "UNKNOWN",
  fresh: false,
  failureCode: null as string | null,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/reconciliation",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("../components/admin/finance-ui", async () => ({
  ...(await vi.importActual<any>("../components/admin/finance-ui")),
  financeRequest: h.call,
}));
import { MoneyActions } from "../components/admin/money-actions";
beforeEach(() => {
  h.status = "UNKNOWN";
  h.fresh = false;
  h.failureCode = null;
  h.call.mockImplementation(async (path: string) =>
    path.startsWith("money?")
      ? {
          payments: [
            {
              id: "payment",
              status: "EXCEPTION",
              paidMinor: "10000",
              processingFeeMinor: "200",
              method: "CARD",
            },
          ],
          operations: h.fresh
            ? []
            : [
                {
                  id: "refund",
                  paymentId: "payment",
                  kind: "REFUND",
                  status: h.status,
                  failureCode: h.failureCode,
                  amountMinor: "10000",
                  feeMinor: "0",
                  providerRef: null,
                },
              ],
        }
      : {},
  );
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("tracks uncertain refunds automatically without asking staff to reconcile or approve again", async () => {
  render(<MoneyActions paymentId="payment" manage />);
  await screen.findByText("Checking refund");
  expect(screen.queryByText("Payment available to refund")).toBeNull();
  expect(
    screen.getByText(/system is checking with the payment provider automatically/),
  ).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Check original refund status" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Refund payment" })).toBeNull();
  expect(screen.queryByLabelText("Authenticator code")).toBeNull();
});
it("shows provider-confirmed completion without further authorization", async () => {
  h.status = "SUCCEEDED";
  render(<MoneyActions paymentId="payment" manage />);
  await screen.findByText("Refund completed");
  expect(screen.queryByLabelText("Authenticator code")).toBeNull();
});
it("lets staff review and authorize a new refund once", async () => {
  h.fresh = true;
  render(<MoneyActions paymentId="payment" manage />);
  fireEvent.click(await screen.findByRole("button", { name: "Refund payment" }));
  expect(h.call.mock.calls.every(([path]) => String(path).startsWith("money?"))).toBe(true);
  fireEvent.change(screen.getByLabelText("Reason for this action"), {
    target: { value: "Order cannot be fulfilled by the farmer" },
  });
  fireEvent.change(screen.getByLabelText("Authenticator code"), { target: { value: "123456" } });
  fireEvent.click(screen.getByRole("button", { name: "Submit refund request" }));
  await waitFor(() =>
    expect(h.call).toHaveBeenCalledWith("money/payments/payment/refund", {
      reason: "Order cannot be fulfilled by the farmer",
    }),
  );
  expect(h.call.mock.calls.filter(([p]) => p === "money/payments/payment/refund")).toHaveLength(1);
});
it("cancels without sending a refund request", async () => {
  h.fresh = true;
  render(<MoneyActions paymentId="payment" manage />);
  fireEvent.click(await screen.findByRole("button", { name: "Refund payment" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel action" }));
  expect(screen.queryByLabelText("Authenticator code")).toBeNull();
  expect(h.call.mock.calls.every(([path]) => String(path).startsWith("money?"))).toBe(true);
});
it("keeps troubleshooting behind an exception-specific section", async () => {
  h.failureCode = "REFUND_PROVIDER_REVIEW_REQUIRED";
  render(<MoneyActions paymentId="payment" manage />);
  await screen.findByText("Resolve refund issue");
  expect(screen.getByText("Resolve refund issue").closest("details")?.hasAttribute("open")).toBe(
    false,
  );
});

it("shows the amount before approving a full order refund without requiring a kobo entry", async () => {
  h.call.mockImplementation(async (path: string) =>
    path.startsWith("money?")
      ? {
          payments: [
            {
              id: "payment",
              orderId: "order",
              status: "SUCCEEDED",
              produceMinor: "10000",
              shippingMinor: "1000",
            },
          ],
          operations: [],
        }
      : {},
  );
  render(<MoneyActions orderId="order" manage />);
  fireEvent.click(await screen.findByRole("button", { name: "Refund order" }));
  expect(screen.getByText(/Principal under review/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Reason for this action"), {
    target: { value: "Order cannot be fulfilled as agreed" },
  });
  fireEvent.change(screen.getByLabelText("Authenticator code"), { target: { value: "123456" } });
  fireEvent.click(screen.getByRole("button", { name: "Submit refund request" }));
  await waitFor(() =>
    expect(h.call).toHaveBeenCalledWith("money/orders/order/refund", {
      reason: "Order cannot be fulfilled as agreed",
    }),
  );
});
