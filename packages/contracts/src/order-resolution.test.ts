import { expect, it } from "vitest";
import { customerOrderResolution } from "./order-resolution.js";
it("exposes the decision without internal audit evidence or reviewer identity", () => {
  const summary = { outcome: "COMPLETED", financialAction: "RELEASE", resolvedAt: "2026-11-23T11:24:55.957Z" };
  expect(customerOrderResolution({ ...summary, reason: "Private", evidence: "Private", adminId: "secret", previousHeldMinor: "100" })).toEqual(summary);
  for (const value of [null, {}, { ...summary, outcome: "invalid" }, { ...summary, financialAction: "invalid" }]) expect(customerOrderResolution(value)).toBeNull();
});
