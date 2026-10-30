import { describe, expect, it } from "vitest";
import { editAmount, formatMoney, groupAmount } from "./money.js";

describe("display-only money formatting", () => {
  it("groups exact minor amounts and always includes two decimal places", () => {
    expect(formatMoney("15000000")).toBe("₦150,000.00");
    expect(formatMoney("999999999999999999")).toBe("₦9,999,999,999,999,999.99");
    expect(formatMoney("-120050")).toBe("-₦1,200.50");
    expect(formatMoney("0")).toBe("₦0.00");
  });
  it("preserves incomplete decimals during editing and rejects excess precision", () => {
    expect(groupAmount("150000.")).toBe("150,000.");
    expect(editAmount("150000", "150,000.", 7)?.value).toBe("150000.");
    expect(editAmount("150000.0", "150,000.05", 9)?.value).toBe("150000.05");
    expect(editAmount("1.23", "1.234")).toBeNull();
    expect(editAmount("1", "1e3")).toBeNull();
  });
  it("keeps a mid-string caret after insertion, replacement and separator deletion", () => {
    expect(editAmount("150000", "1520,000", 2)).toMatchObject({
      value: "1520000",
      display: "1,520,000",
      selection: 4,
    });
    expect(editAmount("1111", "11,111", 1)).toMatchObject({ value: "11111", selection: 2 });
    expect(editAmount("1234", "1234", 2)).toMatchObject({
      value: "234",
      display: "234",
      selection: 0,
    });
    expect(editAmount("1234", "1234", 1)).toMatchObject({
      value: "134",
      display: "134",
      selection: 1,
    });
    expect(editAmount("1234.50", "1,94.50", 4)).toMatchObject({ value: "194.50", selection: 2 });
  });
});
