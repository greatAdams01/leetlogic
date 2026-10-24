import { describe, it, expect } from "vitest";
import { sellerMenuState } from "./seller-menu";
describe("account-aware seller Menu", () => {
  it("offers selling to buyers and resumes incomplete seller accounts", () => {
    expect(sellerMenuState(null, "BUYER")).toBe("buyer");
    expect(sellerMenuState(null, "SELLER")).toBe("incomplete");
    for (const verificationStatus of ["NOT_STARTED", "DRAFT"])
      expect(sellerMenuState({ verificationStatus }, "SELLER")).toBe("incomplete");
  });
  it("uses actual farmer status even if the saved account mode is buyer", () => {
    for (const role of ["SELLER", "BUYER"] as const) {
      expect(sellerMenuState({ verificationStatus: "APPROVED" }, role)).toBe("approved");
      expect(sellerMenuState({ verificationStatus: "REJECTED" }, role)).toBe("rejected");
      expect(sellerMenuState({ verificationStatus: "RESUBMISSION_REQUIRED" }, role)).toBe(
        "changes",
      );
      for (const verificationStatus of ["SUBMITTED", "UNDER_REVIEW"])
        expect(sellerMenuState({ verificationStatus }, role)).toBe("pending");
    }
  });
  it("updates from pending to approved without retaining an approval prompt", () => {
    expect(sellerMenuState({ verificationStatus: "SUBMITTED" }, "SELLER")).toBe("pending");
    expect(sellerMenuState({ verificationStatus: "APPROVED" }, "SELLER")).toBe("approved");
  });
  it("does not guess that an unknown status is approved or incomplete", () => {
    expect(sellerMenuState({ verificationStatus: "UNRECOGNIZED" }, "SELLER")).toBe("unknown");
  });
});
