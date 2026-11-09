import { expect, it } from "vitest";
import { canResumeResolutionOperations, resolutionAuthorizes } from "./order-resolution-policy.js";

it("requires the current resolution identity and matching financial outcome", () => {
  const order = { adminResolution: { id: "reviewed-request", outcome: "COMPLETED", financialAction: "RELEASE" } };
  expect(resolutionAuthorizes(order, "RELEASE", "reviewed-request")).toBe(true);
  expect(resolutionAuthorizes(order, "RELEASE")).toBe(false);
  expect(resolutionAuthorizes(order, "RELEASE", "older-request")).toBe(false);
  expect(resolutionAuthorizes(order, "REFUND", "reviewed-request")).toBe(false);
  expect(resolutionAuthorizes({ adminResolution: { ...order.adminResolution, outcome: "CANCELLED" } }, "RELEASE", "reviewed-request")).toBe(false);
});

it("resumes only unsubmitted matching instructions, never uncertain or automatic operations", () => {
  const row = { kind: "RELEASE", status: "BLOCKED", providerRef: null, leaseUntil: null, payload: {} };
  expect(canResumeResolutionOperations([row], "RELEASE")).toBe(true);
  for (const status of ["QUEUED", "PROCESSING", "UNKNOWN", "PROVIDER_PENDING", "SUCCEEDED", "FAILED"])
    expect(canResumeResolutionOperations([{ ...row, status }], "RELEASE")).toBe(false);
  expect(canResumeResolutionOperations([{ ...row, providerRef: "submitted" }], "RELEASE")).toBe(false);
  expect(canResumeResolutionOperations([{ ...row, leaseUntil: new Date() }], "RELEASE")).toBe(false);
  expect(canResumeResolutionOperations([row], "REFUND")).toBe(false);
  expect(canResumeResolutionOperations([{ ...row, kind: "REFUND", payload: { automaticDeadline: true } }], "REFUND")).toBe(false);
  expect(canResumeResolutionOperations([{ ...row, kind: "REFUND", payload: { exception: true } }], "REFUND")).toBe(false);
});
