// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { en } from "../../../packages/localization/src/customer-messages";

const h = vi.hoisted(() => ({
  api: vi.fn(), locale: vi.fn(), signed: false, role: "BUYER", profileError: null as unknown,
  requestError: null as unknown, verifyError: null as unknown, ordersError: null as unknown,
  profile: null as (() => Promise<unknown>) | null, orders: null as (() => Promise<unknown>) | null,
}));
vi.mock("./customer-api", () => ({ customerApi: h.api }));
vi.mock("../components/language-provider", () => ({
  useLanguage: () => ({ locale: "en", t: (key: string) => en[key as keyof typeof en] || key, setLocale: h.locale }),
}));
vi.mock("../components/customer-addresses", () => ({
  CustomerAddresses: ({ onSaved }: { onSaved: () => Promise<void> }) =>
    <button type="button" onClick={() => void onSaved()}>Reload account fixture</button>,
}));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));
import { CustomerAccount } from "../components/customer-account";

const failure = (code: string, status = 503) => Object.assign(new Error("PRIVATE Prisma details"), { code, status });
const account = () => ({ id: "existing-user", phoneE164: "+2348012345678", preferredLocale: "en", capabilities: [{ capability: h.role }], addresses: [] });
const mount = async () => { await act(async () => { render(<CustomerAccount />); }); };
const click = async (name: string) => { await act(async () => { fireEvent.click(screen.getByRole("button", { name })); }); };
const submit = async (label: string) => { await act(async () => { fireEvent.submit(screen.getByLabelText(label).closest("form")!); }); };
const requestCode = async () => {
  fireEvent.change(screen.getByLabelText("Nigerian phone number"), { target: { value: "08012345678" } });
  await submit("Nigerian phone number");
};
const verifyCode = async () => {
  fireEvent.change(screen.getByLabelText("Verification code"), { target: { value: "123456" } });
  await submit("Verification code");
};
const calls = (path: string) => h.api.mock.calls.filter(([value]) => value === path);

beforeEach(() => {
  vi.resetAllMocks();
  h.signed = false;
  h.role = "BUYER";
  h.profileError = h.requestError = h.verifyError = h.ordersError = null;
  h.profile = h.orders = null;
  h.api.mockImplementation(async (path: string) => {
    if (path === "auth/otp/request") { if (h.requestError) throw h.requestError; return {}; }
    if (path === "auth/otp/verify") {
      if (h.verifyError) throw h.verifyError;
      h.signed = true;
      return { user: { role: "BUYER", preferredLocale: "en" } };
    }
    if (path === "auth/logout") { h.signed = false; return {}; }
    if (path === "me") {
      if (!h.signed) throw failure("AUTH_REQUIRED", 401);
      if (h.profile) return h.profile();
      if (h.profileError) throw h.profileError;
      return { user: account() };
    }
    if (path.startsWith("orders?")) {
      if (h.orders) return h.orders();
      if (h.ordersError) throw h.ordersError;
    }
    return { items: [] };
  });
});
afterEach(cleanup);

it.each(["BUYER", "SELLER"])("completes unified login and automatically shows the stored %s dashboard", async (role) => {
  h.role = role;
  await mount();
  await requestCode();
  await verifyCode();
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(role === "SELLER" ? "Seller Dashboard" : "Buyer Dashboard");
  expect(calls("auth/otp/request")).toHaveLength(1);
  expect(calls("auth/otp/verify")).toHaveLength(1);
  expect(calls(`orders?view=${role.toLowerCase()}`)).toHaveLength(1);
  expect(screen.queryByLabelText("Verification code")).toBeNull();
});
it("distinguishes a profile outage from OTP failure and retries /me without another code", async () => {
  await mount();
  await requestCode();
  h.profileError = failure("DATABASE_SCHEMA_MISMATCH");
  await verifyCode();
  expect(screen.getByRole("alert").textContent).toContain("load your account");
  expect(screen.getByRole("alert").textContent).not.toMatch(/incorrect|expired|PRIVATE|Prisma/);
  expect(screen.queryByLabelText("Verification code")).toBeNull();
  expect(screen.queryByLabelText("Nigerian phone number")).toBeNull();
  expect(h.signed).toBe(true);
  expect(calls("auth/logout")).toHaveLength(0);
  h.profileError = null;
  await click("Retry");
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Buyer Dashboard");
  expect(calls("auth/otp/verify")).toHaveLength(1);
  expect(calls("auth/otp/request")).toHaveLength(1);
});
it("restores an existing cookie session after a profile outage without entering the OTP flow", async () => {
  h.signed = true;
  h.profileError = failure("DATABASE_UNAVAILABLE");
  await mount();
  expect(screen.getByRole("button", { name: "Retry" })).toBeDefined();
  h.profileError = null;
  await click("Retry");
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Buyer Dashboard");
  expect(h.api.mock.calls.some(([path]) => path.startsWith("auth/otp/"))).toBe(false);
});
it("still reports an incorrect OTP when verification itself fails", async () => {
  await mount();
  await requestCode();
  h.verifyError = failure("OTP_INVALID", 400);
  await verifyCode();
  expect(screen.getByRole("alert").textContent).toContain("incorrect");
  expect(screen.getByLabelText("Verification code")).toBeDefined();
  expect(calls("me")).toHaveLength(1);
  expect(h.signed).toBe(false);
});
it("does not downgrade a role-conflict account to a buyer dashboard or ask for another code", async () => {
  h.signed = true;
  h.profileError = failure("ACCOUNT_ROLE_CONFLICT", 409);
  await mount();
  expect(screen.getByRole("alert").textContent).toContain("contact support");
  expect(screen.getByRole("heading", { level: 1 }).textContent).not.toContain("Dashboard");
  expect(screen.queryByLabelText("Verification code")).toBeNull();
});
it("hides a previously loaded dashboard when the account's role later needs review", async () => {
  h.signed = true;
  await mount();
  h.profileError = failure("ACCOUNT_ROLE_CONFLICT", 409);
  await click("Reload account fixture");
  expect(screen.getByRole("alert").textContent).toContain("contact support");
  expect(screen.getByRole("heading", { level: 1 }).textContent).not.toContain("Dashboard");
  expect(screen.queryByText(account().phoneE164)).toBeNull();
  expect(screen.queryByLabelText("Verification code")).toBeNull();
  expect(h.signed).toBe(true);
});
it("preserves an existing dashboard during a temporary profile refresh outage", async () => {
  h.signed = true;
  await mount();
  h.profileError = failure("DATABASE_UNAVAILABLE");
  await click("Reload account fixture");
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Buyer Dashboard");
  expect(screen.getByRole("button", { name: "Retry" })).toBeDefined();
  h.profileError = null;
  await click("Retry");
  expect(screen.queryByRole("alert")).toBeNull();
  expect(calls("auth/otp/verify")).toHaveLength(0);
  expect(h.signed).toBe(true);
});
it("does not undo successful login when orders or notifications are temporarily unavailable", async () => {
  await mount();
  await requestCode();
  h.ordersError = failure("DATABASE_UNAVAILABLE");
  await verifyCode();
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Buyer Dashboard");
  expect(screen.queryByLabelText("Verification code")).toBeNull();
  expect(h.signed).toBe(true);
});
it.each([["SESSION_EXPIRED", 401], ["ACCOUNT_UNAVAILABLE", 403]] as const)("hides private account data when orders reject the session with %s", async (code, status) => {
  h.signed = true;
  h.ordersError = failure(code, status);
  await mount();
  expect(screen.getByRole("heading", { level: 1 }).textContent).not.toContain("Dashboard");
  expect(screen.queryByText(account().phoneE164)).toBeNull();
  expect(screen.getByLabelText("Nigerian phone number")).toBeDefined();
  expect(screen.queryByLabelText("Verification code")).toBeNull();
});
it("keeps role-review guidance private when a later order read detects the conflict", async () => {
  h.signed = true;
  h.ordersError = failure("ACCOUNT_ROLE_CONFLICT", 409);
  await mount();
  expect(screen.getByRole("heading", { level: 1 }).textContent).not.toContain("Dashboard");
  expect(screen.getByRole("alert").textContent).toContain("contact support");
  expect(screen.queryByText(account().phoneE164)).toBeNull();
  expect(screen.queryByLabelText("Verification code")).toBeNull();
  expect(h.signed).toBe(true);
});
it("guides unregistered numbers to account creation without attempting OTP verification", async () => {
  await mount();
  h.requestError = failure("ACCOUNT_NOT_FOUND", 404);
  await requestCode();
  expect(screen.getByRole("heading", { name: "No account found" })).toBeDefined();
  expect(screen.queryByLabelText("Verification code")).toBeNull();
  expect(calls("auth/otp/verify")).toHaveLength(0);
});
it("coalesces profile retries and never resubmits the consumed OTP", async () => {
  h.signed = true;
  h.profileError = failure("DATABASE_SCHEMA_MISMATCH");
  await mount();
  let resolve!: (value: object) => void;
  h.profile = () => new Promise((done) => { resolve = done; });
  const retry = screen.getByRole("button", { name: "Retry" });
  await act(async () => { fireEvent.click(retry); fireEvent.click(retry); });
  expect(calls("me")).toHaveLength(2);
  await act(async () => resolve({ user: account() }));
  expect(h.api.mock.calls.some(([path]) => path.startsWith("auth/otp/"))).toBe(false);
});
it("returns rejected sessions to a fresh login instead of displaying a stale profile error", async () => {
  h.signed = true;
  h.profileError = failure("DATABASE_UNAVAILABLE");
  await mount();
  h.profileError = failure("SESSION_EXPIRED", 401);
  await click("Retry");
  expect(screen.getByLabelText("Nigerian phone number")).toBeDefined();
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.queryByLabelText("Verification code")).toBeNull();
});
it("ignores late account data after logout", async () => {
  h.signed = true;
  let resolve!: (value: object) => void;
  h.orders = () => new Promise((done) => { resolve = done; });
  await mount();
  await click("Sign out");
  await act(async () => resolve({ items: [{ id: "private-order", reference: "PRIVATE", listing: { title: "old account" } }] }));
  expect(screen.queryByText(/PRIVATE/)).toBeNull();
  expect(screen.getByLabelText("Nigerian phone number")).toBeDefined();
});
it("lets users explicitly cancel a pending profile sign-in", async () => {
  h.signed = true;
  h.profileError = failure("DATABASE_UNAVAILABLE");
  await mount();
  await click("Cancel");
  expect(h.signed).toBe(false);
  expect(calls("auth/logout")).toHaveLength(1);
  expect(screen.getByLabelText("Nigerian phone number")).toBeDefined();
});
