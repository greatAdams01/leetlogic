// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  params: new URLSearchParams(),
  push: vi.fn(),
  path: "/admin/reconciliation",
  request: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => h.params,
  usePathname: () => h.path,
  useRouter: () => ({ push: h.push }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("../components/admin/money-actions", () => ({
  MoneyActions: () => <p>Authorized record controls</p>,
}));
import { financeRequest } from "../components/admin/finance-ui";
import { MoneyOperations } from "../components/admin/money-operations";
const id = "11111111-1111-4111-8111-111111111111";
const row = {
  id,
  orderId: id,
  orderReference: "ORDER-1042",
  kind: "ORDER",
  amountMinor: "125050",
  paidMinor: "125050",
  status: "SUCCEEDED",
  createdAt: "2026-11-02T12:00:00Z",
  updatedAt: "2026-11-02T13:00:00Z",
  chargeId: "provider-charge",
};
const summary = {
  mode: "sandbox",
  asOf: "2026-11-02T12:00:00Z",
  collectionsMinor: "125050",
  farmerHeldMinor: "100000",
  farmerAvailableMinor: "0",
  unallocatedMinor: "0",
  commissionMinor: "0",
  shippingMinor: "25050",
  processingFeesMinor: "500",
  refundedMinor: "0",
  operationStates: [{ status: "BLOCKED", _count: 2 }],
  daily: [],
};
beforeEach(() => {
  h.params = new URLSearchParams();
  h.path = "/admin/reconciliation";
  h.push.mockReset();
  h.request.mockReset();
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: function () {
      this.setAttribute("open", "");
      this.querySelector("button")?.focus();
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: function () {
      this.removeAttribute("open");
    },
  });
  h.request.mockImplementation(async (input: string) => {
    const path = String(input);
    let data: any = {};
    if (path.includes("/summary")) data = summary;
    else if (path.includes(`/records/payments/${id}`)) data = row;
    else if (path.includes("/records?")) data = { items: [row], total: 41 };
    else if (path.includes("/finance")) data = { enabled: false };
    else if (path.includes("/recoveries")) data = { items: [] };
    else
      data = {
        readiness: { mode: "sandbox", enabled: true, webhookConfigured: true },
        reconciliations: [],
      };
    return { ok: true, json: async () => data };
  });
  vi.stubGlobal("fetch", h.request);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("finance workspace", () => {
  it("presents collections and obligations separately with useful exception shortcuts", async () => {
    render(<MoneyOperations />);
    await screen.findByText("Produce and shipping principal");
    expect(screen.getByText("Earned commission")).toBeTruthy();
    expect(
      screen.getByText("Gross collections are not platform income.", { exact: false }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Blocked operations/ }));
    expect(h.push.mock.calls.at(-1)?.[0]).toContain("finStatus=BLOCKED");
    expect(h.push.mock.calls.at(-1)?.[0]).toContain("finTab=operations");
  });
  it("shows a plain refund status in the queue while the system checks automatically", async () => {
    h.params = new URLSearchParams("finTab=operations");
    const original = h.request.getMockImplementation()!;
    h.request.mockImplementation((input: string) =>
      String(input).includes("/records?")
        ? Promise.resolve({
            ok: true,
            json: async () => ({
              items: [
                {
                  ...row,
                  kind: "REFUND",
                  status: "UNKNOWN",
                  failureCode: "PAYMENT_RESULT_UNKNOWN",
                },
              ],
              total: 1,
            }),
          })
        : original(input),
    );
    render(<MoneyOperations />);
    expect(await screen.findByText("Checking refund")).toBeTruthy();
    expect(screen.queryByText("Payment result unknown")).toBeNull();
  });
  it("opens reviews on a dedicated page and preserves the entire queue state", async () => {
    h.params = new URLSearchParams("finTab=payments&finSearch=ORDER&finStatus=SUCCEEDED&finPage=2");
    render(<MoneyOperations />);
    const trigger = await screen.findByRole("link", { name: "Review ORDER-1042" });
    const href = trigger.getAttribute("href")!;
    expect(href).toContain(`/reconciliation/records/payments/${id}`);
    const target = new URL(href, "https://example.test");
    expect(target.searchParams.get("returnTo")).toBe(`/admin/reconciliation?${h.params}`);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("searches and paginates server records and preserves other filters", async () => {
    h.params = new URLSearchParams("finTab=payments&finStatus=SUCCEEDED&finFrom=2026-11-01");
    render(<MoneyOperations />);
    await screen.findByRole("link", { name: "Review ORDER-1042" });
    expect(
      h.request.mock.calls.some(
        ([url]) =>
          String(url).includes("status=SUCCEEDED") && String(url).includes("from=2026-11-01"),
      ),
    ).toBe(true);
    fireEvent.change(screen.getByLabelText("Search reference"), {
      target: { value: "new-reference" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(h.push.mock.calls.at(-1)?.[0]).toContain("finSearch=new-reference");
    expect(h.push.mock.calls.at(-1)?.[0]).toContain("finStatus=SUCCEEDED");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(h.push.mock.calls.at(-1)?.[0]).toContain("finPage=2");
  });
  it("shows disabled rollouts clearly and blocks unsafe return destinations", async () => {
    h.params = new URLSearchParams("finTab=funding&returnTo=https://malicious.example");
    render(<MoneyOperations orderId={id} />);
    await screen.findByText("Logistics funding is not enabled");
    expect(screen.getByRole("link", { name: /Back to finance records/ }).getAttribute("href")).toBe(
      "/admin/reconciliation",
    );
  });
  it("shows a failed record fetch as an error rather than an empty successful result", async () => {
    h.params = new URLSearchParams("finTab=operations");
    const original = h.request.getMockImplementation()!;
    h.request.mockImplementation((input: string) =>
      String(input).includes("/records?")
        ? Promise.resolve({
            ok: false,
            json: async () => ({ error: { message: "Records temporarily unavailable" } }),
          })
        : original(input),
    );
    render(<MoneyOperations />);
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Records temporarily unavailable",
    );
    expect(screen.queryByText("No records to show")).toBeNull();
  });
});

describe("finance request safety", () => {
  it("refreshes expired authorization before retrying the same operation", async () => {
    h.request
      .mockReset()
      .mockResolvedValueOnce({ status: 401, ok: false, json: async () => ({}) })
      .mockResolvedValueOnce({ status: 200, ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ status: 200, ok: true, json: async () => ({ accepted: true }) });
    expect(
      await financeRequest("money/operations/fixture/approve", {
        reason: "Reviewed original payout",
      }),
    ).toEqual({ accepted: true });
    expect(h.request).toHaveBeenCalledTimes(3);
    expect(h.request.mock.calls[1][0]).toBe("/api/admin/auth/refresh");
    expect(h.request.mock.calls[0]).toEqual(h.request.mock.calls[2]);
  });
  it("never replays an uncertain financial request", async () => {
    h.request.mockReset().mockRejectedValue(new Error("Network timeout"));
    await expect(financeRequest("money/operations/fixture/approve", {})).rejects.toThrow(
      "Network timeout",
    );
    expect(h.request).toHaveBeenCalledOnce();
  });
  it("does not repeat an invalid step-up code", async () => {
    h.request.mockReset().mockResolvedValue({
      status: 401,
      ok: false,
      json: async () => ({ error: { message: "Code invalid" } }),
    });
    await expect(financeRequest("auth/totp/step-up", { code: "000000" })).rejects.toThrow(
      "Code invalid",
    );
    expect(h.request).toHaveBeenCalledOnce();
  });
});
