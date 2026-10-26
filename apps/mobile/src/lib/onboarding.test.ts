import { describe, expect, it } from "vitest";
import { restoredAccount, accountRoleKey, signInRole } from "./onboarding";
import type { Customer } from "./domain";
const user = { id: "one", farmerProfile: null } as Customer;
describe("session restoration during seller onboarding", () => {
  it("resumes sellers even before a farm profile has been saved", () => {
    expect(restoredAccount(user, "SELLER")).toEqual({ role: "SELLER", route: "seller" });
  });
  it("resumes unfinished server applications and infers legacy seller accounts", () => {
    for (const verificationStatus of ["NOT_STARTED", "DRAFT", "RESUBMISSION_REQUIRED"])
      expect(
        restoredAccount({ ...user, farmerProfile: { farmName: "Farm", verificationStatus } }, null),
      ).toEqual({ role: "SELLER", route: "seller" });
  });
  it("keeps buyers and submitted sellers in the marketplace without losing seller mode", () => {
    expect(restoredAccount(user, "BUYER")).toEqual({ role: "BUYER", route: "home" });
    for (const verificationStatus of ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED"])
      expect(
        restoredAccount(
          { ...user, farmerProfile: { farmName: "Farm", verificationStatus } },
          "SELLER",
        ),
      ).toEqual({ role: "SELLER", route: "home" });
  });
  it("scopes the role preference to each account", () => {
    expect(accountRoleKey("one")).not.toBe(accountRoleKey("two"));
  });
});

describe("phone sign-in account selection", () => {
  it("requires a new account to choose without inheriting a previous farmer's role", () => {
    expect(signInRole(user, null, null)).toBeNull();
    expect(signInRole({ ...user, id: "another" }, null, null)).toBeNull();
  });
  it("honours an explicit current choice and restores only this account's saved role", () => {
    expect(signInRole(user, "SELLER", "BUYER")).toBe("BUYER");
    expect(signInRole(user, "BUYER", "SELLER")).toBe("SELLER");
    expect(signInRole(user, "BUYER", null)).toBe("BUYER");
    expect(
      signInRole(
        { ...user, farmerProfile: { farmName: "Farm", verificationStatus: "APPROVED" } },
        null,
        null,
      ),
    ).toBe("SELLER");
  });
});
