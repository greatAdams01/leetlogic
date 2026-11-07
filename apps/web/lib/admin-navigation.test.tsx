// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SidebarNavigation } from "../components/admin/sidebar-navigation";

afterEach(cleanup);
const permissions = [
  "orders.read",
  "catalog.manage",
  "verification.read",
  "users.read",
  "payments.read",
];
describe("admin sidebar navigation", () => {
  it("opens the active group for nested pages and keeps the other groups collapsed", () => {
    render(
      <SidebarNavigation route="listings/review" permissions={permissions} onNavigate={() => {}} />,
    );
    expect(screen.getByRole("button", { name: "Listings" }).getAttribute("aria-expanded")).toBe(
      "true",
    );
    expect(screen.getByRole("link", { name: "Listings queue" }).getAttribute("aria-current")).toBe(
      "page",
    );
    expect(screen.queryByRole("link", { name: "Withdrawals" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Finance" }));
    expect(screen.getByRole("button", { name: "Listings" }).getAttribute("aria-expanded")).toBe(
      "false",
    );
    expect(screen.getByRole("link", { name: "Withdrawals" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Finance" }));
    expect(screen.queryByRole("link", { name: "Withdrawals" })).toBeNull();
  });
  it("reveals a destination after route changes and when staff permissions arrive", () => {
    const view = render(
      <SidebarNavigation route="verification/buyer" permissions={[]} onNavigate={() => {}} />,
    );
    expect(screen.queryByRole("button", { name: "Verifications" })).toBeNull();
    view.rerender(
      <SidebarNavigation
        route="verification/buyer"
        permissions={permissions}
        onNavigate={() => {}}
      />,
    );
    expect(
      screen.getByRole("link", { name: "Buyer verification" }).getAttribute("aria-current"),
    ).toBe("page");
    expect(
      screen.getByRole("link", { name: "Farmer verification" }).hasAttribute("aria-current"),
    ).toBe(false);
    view.rerender(
      <SidebarNavigation route="logistics" permissions={permissions} onNavigate={() => {}} />,
    );
    expect(
      screen.getByRole("link", { name: "Deliveries" }).getAttribute("aria-current"),
    ).toBe("page");
    expect(screen.queryByRole("link", { name: "Buyer verification" })).toBeNull();
  });
  it("keeps the correct workspace active on dedicated order and delivery pages", () => {
    const view = render(<SidebarNavigation route="orders/11111111-1111-4111-8111-111111111111" permissions={permissions} onNavigate={() => {}} />);
    expect(screen.getByRole("button", { name: "Orders & deliveries" }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("link", { name: "Orders" }).getAttribute("aria-current")).toBe("page");
    view.rerender(<SidebarNavigation route="logistics/11111111-1111-4111-8111-111111111111" permissions={permissions} onNavigate={() => {}} />);
    expect(screen.getByRole("link", { name: "Deliveries" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Orders" }).hasAttribute("aria-current")).toBe(false);
  });
  it("omits inaccessible items and empty sections and reports navigation", () => {
    const navigate = vi.fn();
    render(
      <SidebarNavigation
        route="verification/buyer"
        permissions={["users.read"]}
        onNavigate={navigate}
      />,
    );
    expect(screen.queryByRole("button", { name: "Listings" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Farmer verification" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Dashboard" })).toBeNull();
    const buyer = screen.getByRole("link", { name: "Buyer verification" });
    expect(buyer.getAttribute("href")).toBe("/admin/verification/buyer");
    fireEvent.click(buyer);
    expect(navigate).toHaveBeenCalledOnce();
    const toggle = screen.getByRole("button", { name: "Verifications" });
    expect(document.getElementById(toggle.getAttribute("aria-controls")!)?.contains(buyer)).toBe(
      true,
    );
  });
});
