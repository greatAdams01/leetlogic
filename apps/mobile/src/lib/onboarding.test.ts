import { describe, expect, it } from "vitest";
import { restoredAccount, accountRoleKey } from "./onboarding";
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
