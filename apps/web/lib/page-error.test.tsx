// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import AdminError from "../app/admin/error";
import ErrorPage from "../app/error";
import { userFacingError } from "./user-facing-error";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("offers a safe retry and staff return path without displaying the runtime trace", () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {}),
    retry = vi.fn();
  const error = new TypeError(
    "Cannot read properties of null (reading 'toLowerCase') at financeLabel (/Users/private/finance-ui.tsx:37:6)",
  );
  const view = render(<AdminError error={error} retry={retry} />);
  expect(screen.getByRole("heading", { name: "We couldn’t open this page" })).toBeTruthy();
  expect(view.container.textContent).not.toMatch(/toLowerCase|financeLabel|TypeError|\/Users/);
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(retry).toHaveBeenCalledOnce();
  expect(screen.getByRole("link", { name: "Back to staff workspace" }).getAttribute("href")).toBe(
    "/admin",
  );
  expect(log).toHaveBeenCalledWith("Page rendering failed", error);
});
it("provides a customer recovery route even for an unexpected technical error", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  render(<ErrorPage error={new Error("SQLSTATE 42P01: missing relation")} retry={vi.fn()} />);
  expect(screen.getByRole("link", { name: "Go to your account" }).getAttribute("href")).toBe(
    "/account",
  );
  expect(screen.getByRole("alert").textContent).not.toContain("SQLSTATE");
});
it("preserves meaningful business guidance while filtering technical errors", () => {
  expect(userFacingError(new Error("Resolve the order dispute before releasing funds."))).toBe(
    "Resolve the order dispute before releasing funds.",
  );
  expect(userFacingError(new TypeError("value.toLowerCase is not a function"))).not.toContain(
    "toLowerCase",
  );
  expect(userFacingError(new Error("ReferenceError: payment is not defined"))).not.toContain(
    "ReferenceError",
  );
  expect(userFacingError(null)).toContain("Please try again");
});
