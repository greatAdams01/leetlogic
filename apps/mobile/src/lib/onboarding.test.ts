import { expect, it } from "vitest";
import { restoredAccount, signInRole } from "./onboarding";
import type { Customer } from "./domain";
const buyer = { capabilities: [{ capability: "BUYER" }], farmerProfile: null } as Customer;
const seller = { capabilities: [{ capability: "SELLER" }], farmerProfile: null } as Customer;
it("ignores local preferences and selected roles on login", () => {
  expect(signInRole(buyer, "SELLER", "SELLER")).toBe("BUYER");
  expect(signInRole(seller, "BUYER", "BUYER")).toBe("SELLER");
});
it("restores unfinished sellers from server data", () => {
  expect(restoredAccount(seller, "BUYER")).toEqual({ role: "SELLER", route: "seller" });
  expect(restoredAccount(buyer, "SELLER")).toEqual({ role: "BUYER", route: "home" });
});
it("blocks missing and conflicting roles", () => {
  expect(() => signInRole({ ...buyer, capabilities: [] }, "BUYER", "BUYER")).toThrow("review");
  expect(() => signInRole({ ...buyer, capabilities: [...buyer.capabilities, ...seller.capabilities] }, null, null)).toThrow("review");
});
