import { describe, expect, it } from "vitest";
import { canAdvanceDelivery, normalizeDeliveryStatus } from "./delivery-policy.js";
import { protectTokens } from "./translation.js";
import { imageType } from "../routes/produce-photos.js";
describe("delivery state reconciliation", () => {
  it("maps carrier statuses and ignores unknown statuses", () => {
    expect(normalizeDeliveryStatus("completed")).toBe("DELIVERED");
    expect(normalizeDeliveryStatus("picked_up")).toBe("PICKED_UP");
    expect(normalizeDeliveryStatus("unrecognized")).toBeUndefined();
  });
  it("rejects delayed regressions and allows retry and return progress", () => {
    expect(canAdvanceDelivery("IN_TRANSIT", "PICKED_UP")).toBe(false);
    expect(canAdvanceDelivery("DELIVERED", "IN_TRANSIT")).toBe(false);
    expect(canAdvanceDelivery("FAILED_ATTEMPT", "IN_TRANSIT")).toBe(true);
    expect(canAdvanceDelivery("DELIVERED", "RETURNING")).toBe(true);
    expect(canAdvanceDelivery("RETURNED", "IN_TRANSIT")).toBe(false);
  });
});
describe("translation invariants", () => {
  it("preserves numeric amounts, placeholders and references", () => {
    const input = "{{name}} bought 20 kg for ₦2,000.50; order LL-ABC123";
    const p = protectTokens(input);
    expect(p.restore(p.text)).toBe(input);
    expect(() => p.restore(p.text.replace("LLTOKEN0X", "changed"))).toThrow();
  });
});
describe("produce photo upload", () => {
  it("rejects files with false image types", () => {
    expect(imageType(Buffer.from("<script>alert(1)</script>"))).toBeNull();
    expect(imageType(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe("image/png");
    expect(imageType(Buffer.from([255, 216, 255, 224]))).toBe("image/jpeg");
  });
});
