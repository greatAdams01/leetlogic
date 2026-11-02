// @vitest-environment jsdom
import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("./customer-api", () => ({ customerApi: h.api }));
vi.mock("../components/language-provider", () => ({ useLanguage: () => ({ locale: "en" }) }));
vi.mock("next/link", () => ({ default: ({ href, children }: any) => <a href={href}>{children}</a> }));
import { PaymentReturn } from "../components/payment-return";
const attempt = "11111111-1111-4111-8111-111111111111";
const pending = { id: attempt, orderId: "order", status: "OPEN", paymentConfirmed: false };
beforeEach(() => {
  vi.useFakeTimers();
  h.api.mockReset();
  window.history.replaceState({}, "", `/?attempt=${attempt}`);
});
afterEach(() => { cleanup(); vi.useRealTimers(); });
it("keeps confirming delayed payment and stops verification after server confirmation", async () => {
  let confirmed = false;
  h.api.mockImplementation(async (path: string) => path.endsWith("/refresh") && confirmed
    ? { ...pending, status: "SUCCEEDED", paymentConfirmed: true } : pending);
  await act(async () => { render(<PaymentReturn />); });
  expect(screen.getByText("Confirming your payment. Please don’t pay again.")).toBeTruthy();
  confirmed = true;
  await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
  expect(screen.getByText("Completed")).toBeTruthy();
  expect(screen.queryByText("Confirming your payment. Please don’t pay again.")).toBeNull();
  const count = h.api.mock.calls.length;
  await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
  expect(h.api).toHaveBeenCalledTimes(count);
});
it("retries provider outages and cancels scheduled retries on unmount", async () => {
  h.api.mockResolvedValueOnce(pending).mockRejectedValueOnce(new Error("Verification unavailable"));
  const view = await act(async () => render(<PaymentReturn />));
  expect(screen.getByText("Request failed. Please try again.")).toBeTruthy();
  h.api.mockResolvedValue({ ...pending, status: "SUCCEEDED", paymentConfirmed: true });
  await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
  expect(screen.getByText("Completed")).toBeTruthy();
  view.unmount();
  const count = h.api.mock.calls.length;
  await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
  expect(h.api).toHaveBeenCalledTimes(count);
});
