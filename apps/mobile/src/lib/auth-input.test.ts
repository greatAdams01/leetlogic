import { describe, expect, it } from "vitest";
import { maskedPhone, otpDigits, resendSeconds } from "./auth-input";
import { normalizeNigerianPhone } from "../../../../packages/contracts/src/phone";
describe("phone verification input", () => {
  it("retains the three supported Nigerian formats with a fixed country badge", () => {
    for (const phone of ["08012345678", "8012345678", "+2348012345678"])
      expect(normalizeNigerianPhone(phone)).toBe("+2348012345678");
  });
  it("handles paste, leading zeroes, deletion and six-digit limits without losing code digits", () => {
    expect(otpDigits("012 345")).toBe("012345");
    expect(otpDigits("01-23-45")).toBe("012345");
    expect(otpDigits("123456789")).toBe("123456");
    expect(otpDigits("01234")).toBe("01234");
    expect(otpDigits("")).toBe("");
  });
  it("masks the destination rather than exposing the full number", () => {
    expect(maskedPhone("+2348012345678")).toBe("+23480****");
    expect(maskedPhone("+2348012345678")).not.toContain("8012345");
    expect(maskedPhone("08012345678")).toBe("080****");
    expect(maskedPhone("")).toBe("****");
  });
  it("recomputes the countdown after backgrounding instead of extending the resend lock", () => {
    expect(resendSeconds(60_000, 0)).toBe(60);
    expect(resendSeconds(60_000, 18_001)).toBe(42);
    expect(resendSeconds(60_000, 120_000)).toBe(0);
  });
});
