// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ params: new URLSearchParams(), push: vi.fn(), replace: vi.fn(), request: vi.fn() }));
vi.mock("next/navigation", () => ({ useSearchParams: () => h.params, useRouter: () => ({ push: h.push, replace: h.replace }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a> }));
vi.mock("../components/admin/finance-ui", async () => ({ ...(await vi.importActual<any>("../components/admin/finance-ui")), financeRequest: h.request }));
import { OrderOperations } from "../components/admin/order-operations";
import { adminQueueFixture, orderId, staffPermissions } from "./admin-order-fixtures";

beforeEach(() => {
  h.params = new URLSearchParams(); h.push.mockReset(); h.replace.mockReset(); h.request.mockReset();
  h.request.mockResolvedValue(adminQueueFixture());
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("focused order and dispatch queues", () => {
  it("shows purchase information and links to a dedicated order page", async () => {
    h.params = new URLSearchParams("search=tomatoes&page=2");
    const view = render(<OrderOperations permissions={staffPermissions} />);
    const link = await screen.findByRole("link", { name: "View order LL-1042" });
    const url = new URL(link.getAttribute("href")!, "https://admin.invalid");
    expect(url.pathname).toBe(`/admin/orders/${orderId}`);
    expect(url.searchParams.get("returnTo")).toBe("/admin/orders?search=tomatoes&page=2");
    expect(screen.getByRole("columnheader", { name: "Payment" })).toBeTruthy();
    expect(screen.getByText("Bola Buyer")).toBeTruthy();
    expect(screen.getByText("Farmer: Ada’s farm")).toBeTruthy();
    expect(screen.queryByRole("columnheader", { name: /Courier|Rider|Latest updates/ })).toBeNull();
    expect(screen.queryByText("SB-BOOKING-1")).toBeNull();
    expect(view.container.querySelector(".dispatch-review, dialog, .customer-panel")).toBeNull();
    expect(screen.getByRole("button", { name: "All orders 31" })).toBeTruthy();
  });
  it("shows route, courier and rider information without a duplicated payment column", async () => {
    render(<OrderOperations dispatch permissions={staffPermissions} />);
    const link = await screen.findByRole("link", { name: "View delivery LL-1042" });
    expect(new URL(link.getAttribute("href")!, "https://admin.invalid").pathname).toBe(`/admin/logistics/${orderId}`);
    expect(screen.getByText("Benue → Lagos")).toBeTruthy();
    expect(screen.getByText("Rider: Rider Chidi")).toBeTruthy();
    expect(screen.queryByRole("columnheader", { name: "Payment" })).toBeNull();
    expect(screen.queryByLabelText("Farmer response")).toBeNull();
    expect(screen.getByRole("button", { name: "To arrange 7" })).toBeTruthy();
    expect(h.request.mock.calls[0][0]).toMatch(/^dispatch\?/);
  });
  it("resets conflicting filters when opening an order summary count", async () => {
    h.params = new URLSearchParams("search=tomatoes&status=CANCELLED&farmer=REJECTED&view=ATTENTION&page=3");
    render(<OrderOperations permissions={staffPermissions} />);
    await screen.findByText("LL-1042");
    fireEvent.click(screen.getByRole("button", { name: "Awaiting farmer 5" }));
    const url = new URL(h.push.mock.calls.at(-1)![0], "https://admin.invalid");
    expect(Object.fromEntries(url.searchParams)).toEqual({ search: "tomatoes", status: "FUNDED", farmer: "PENDING", view: "ALL", page: "1" });
  });
  it("searches, paginates and clears filters without retaining an inline record id", async () => {
    h.params = new URLSearchParams("status=FUNDED&id=invalid");
    render(<OrderOperations permissions={staffPermissions} />);
    await screen.findByText("LL-1042");
    fireEvent.change(screen.getByLabelText("Search orders"), { target: { value: "Ada" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(h.push.mock.calls.at(-1)![0]).toBe("/admin/orders?search=Ada&status=FUNDED&page=1");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(h.push.mock.calls.at(-1)![0]).toBe("/admin/orders?status=FUNDED&page=2");
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(h.push.mock.calls.at(-1)![0]).toBe("/admin/orders");
    expect(h.replace).not.toHaveBeenCalled();
  });
  it("upgrades an old inline review URL to a dedicated detail page", async () => {
    h.params = new URLSearchParams(`search=tomatoes&id=${orderId}&page=2`);
    render(<OrderOperations dispatch permissions={staffPermissions} />);
    await waitFor(() => expect(h.replace).toHaveBeenCalled());
    const url = new URL(h.replace.mock.calls[0][0], "https://admin.invalid");
    expect(url.pathname).toBe(`/admin/logistics/${orderId}`);
    expect(url.searchParams.get("returnTo")).toBe("/admin/logistics?search=tomatoes&page=2");
  });
  it("keeps a clearly marked last update on a refresh failure but not under different filters", async () => {
    const view = render(<OrderOperations permissions={staffPermissions} />);
    await screen.findByText("LL-1042");
    h.request.mockRejectedValue(new Error("Connection failed. Please retry."));
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Showing the last update");
    expect(screen.getByText("LL-1042")).toBeTruthy();
    h.params = new URLSearchParams("status=CANCELLED");
    view.rerender(<OrderOperations permissions={staffPermissions} />);
    await waitFor(() => expect(screen.queryByText("LL-1042")).toBeNull());
  });
  it("shows a useful empty state and disables pagination past the end", async () => {
    h.request.mockResolvedValue({ ...adminQueueFixture(), total: 0, items: [] });
    render(<OrderOperations dispatch permissions={staffPermissions} />);
    await screen.findByText("No matching deliveries");
    expect((screen.getByRole("button", { name: "Next" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Previous" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Buyer collections are managed in Orders/)).toBeTruthy();
  });
  it("does not request data without order-read permission", async () => {
    render(<OrderOperations permissions={[]} />);
    expect(screen.getByRole("alert").textContent).toContain("permission");
    await act(async () => {});
    expect(h.request).not.toHaveBeenCalled();
  });
  it("limits the attention summary in the list while keeping the full detail link", async () => {
    const queue = adminQueueFixture();
    queue.items[0]!.issues = [{ code: "A", title: "Delivery needs review", body: "Long explanation" }, { code: "B", title: "Tracking delayed", body: "Another explanation" }];
    h.request.mockResolvedValue(queue);
    render(<OrderOperations dispatch permissions={staffPermissions} />);
    const table = await screen.findByRole("table", { name: "Deliveries" });
    expect(within(table).getByText("Delivery needs review").textContent).toContain("+1 more");
    expect(within(table).queryByText("Long explanation")).toBeNull();
    expect(within(table).getByRole("link", { name: "View delivery LL-1042" })).toBeTruthy();
  });
});
