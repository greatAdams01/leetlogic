import { describe, it, expect } from "vitest";
import { toMinor, money, quantity, safeHttps } from "./domain";
describe("mobile order and listing inputs", () => {
  it("converts naira exactly without floating point rounding", () => {
    expect(toMinor("12.34")).toBe("1234");
    expect(toMinor("9999999999.99")).toBe("999999999999");
    expect(money("123456")).toBe("₦1,234.56");
  });
  it("rejects invalid or silently rounded money", () => {
    for (const input of ["0", "-1", "1.001", "1e3", "NaN", ""])
      expect(() => toMinor(input)).toThrow();
  });
  it("preserves valid decimal quantities and rejects ambiguous input", () => {
    expect(quantity("1.250")).toBe("1.250");
    for (const input of ["0", "1,000", "one", "1.2345", "-3"])
      expect(() => quantity(input)).toThrow();
  });
  it("only opens secure external courier links", () => {
    expect(safeHttps("https://courier.example/track")).toBe(true);
    expect(safeHttps("javascript:alert(1)")).toBe(false);
    expect(safeHttps("file:///etc/passwd")).toBe(false);
  });
});
