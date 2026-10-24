import { describe, expect, it } from "vitest";
import { bankVerificationPending, sellerPaymentAction, type FinancialSummary } from "./finance";
const data = (patch: Partial<FinancialSummary> = {}): FinancialSummary => ({
  enabled: true,
  account: { ready: true, status: "READY" },
  destinations: [],
  earnings: { availableMinor: "0", balanceMinor: "0", reservedMinor: "0" },
  heldMinor: "0",
  payoutFeeMinor: "100",
  operations: [],
  ...patch,
});
describe("seller bank and earnings flow", () => {
  it("requires provider setup before offering a bank or withdrawal", () => {
    expect(sellerPaymentAction(data({ account: null })).title).toBe("Set up payments");
    expect(
      sellerPaymentAction(data({ account: { ready: false, status: "ONBOARDING" } })).route,
    ).toBe("finance");
    expect(sellerPaymentAction(null).title).toBe("Payments and earnings");
  });
  it("offers bank setup until a usable bank exists", () => {
    expect(sellerPaymentAction(data())).toEqual({ title: "Add bank account", route: "banks" });
    const bank = {
      id: "bank",
      accountName: "Farmer",
      accountLastFour: "1234",
      bankName: "Bank",
      usable: false,
    };
    expect(sellerPaymentAction(data({ destinations: [bank] })).title).toBe("Add bank account");
    expect(sellerPaymentAction(data({ destinations: [{ ...bank, usable: true }] })).title).toBe(
      "Withdraw",
    );
  });
  it("never presents unavailable payments or unresolved bank verification as successful", () => {
    expect(sellerPaymentAction(data({ enabled: false })).title).toBe("Payments and earnings");
    for (const status of ["QUEUED", "PROCESSING", "PROVIDER_PENDING"])
      expect(bankVerificationPending(status)).toBe(true);
    for (const status of ["SUCCEEDED", "FAILED", "UNKNOWN"])
      expect(bankVerificationPending(status)).toBe(false);
  });
});
