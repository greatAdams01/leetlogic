// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("./customer-api", () => ({ customerApi: h.api }));
vi.mock("../components/language-provider", () => ({ useLanguage: () => ({ locale: "en" }) }));
vi.mock("../components/sale-earnings", () => ({ SaleHistory: () => null }));
vi.mock("next/link", () => ({ default: ({ href, children }: any) => <a href={href}>{children}</a> }));
import { CustomerFinance } from "../components/customer-payments";
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it("shows the review restriction before withdrawal and refreshes after it is resolved", async () => {
  const data = { enabled: true, account: { ready: true }, destinations: [{ id: "bank", bankName: "Bank", accountLastFour: "1234", usable: true }], earnings: { availableMinor: "100000", reservedMinor: "0" }, heldMinor: "0", payoutFeeMinor: "10000", operations: [], withdrawals: { enabled: false, blockers: [{ code: "PAYOUT_BLOCKED", message: "Withdrawals are paused while an order is being reviewed." }] } };
  h.api.mockResolvedValue(data);
  render(<CustomerFinance />);
  await screen.findByText("Withdrawals are paused while an order is being reviewed.");
  expect((screen.getByRole("button", { name: "Request withdrawal" }) as HTMLButtonElement).disabled).toBe(true);
  const calls = h.api.mock.calls.length;
  fireEvent.submit(screen.getByRole("button", { name: "Request withdrawal" }).closest("form")!);
  expect(h.api.mock.calls).toHaveLength(calls);
  h.api.mockResolvedValue({ ...data, withdrawals: { enabled: true, blockers: [] } });
  await act(async () => { window.dispatchEvent(new Event("focus")); });
  expect(screen.queryByText("Withdrawals are paused while an order is being reviewed.")).toBeNull();
  expect((screen.getByRole("button", { name: "Request withdrawal" }) as HTMLButtonElement).disabled).toBe(false);
});
