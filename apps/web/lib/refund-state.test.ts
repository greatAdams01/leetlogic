import { expect, it } from "vitest";
import { refundState } from "../components/admin/refund-state";
it("distinguishes queued work, provider confirmation, and exceptions", () => {
  for (const status of ["QUEUED", "PROCESSING", "PROVIDER_PENDING"])
    expect(refundState({ status }).label).toBe("Refund processing");
  expect(refundState({ status: "SUCCEEDED" }).label).toBe("Refund completed");
  expect(refundState({ status: "FAILED" }).label).toBe("Refund failed");
  expect(refundState({ status: "UNKNOWN", kind: "REFUND" }).needsHelp).toBe(false);
  expect(
    refundState({ status: "UNKNOWN", failureCode: "REFUND_PROVIDER_REVIEW_REQUIRED" }).needsHelp,
  ).toBe(true);
});
it("never promises automatic discovery of an unsupported bank return with no reference", () => {
  expect(
    refundState({ status: "UNKNOWN", kind: "REFUND_TRANSFER", providerRef: null }),
  ).toMatchObject({ needsHelp: true, label: "Refund needs attention" });
  expect(
    refundState({ status: "UNKNOWN", kind: "REFUND_TRANSFER", providerRef: "original" }).label,
  ).toBe("Checking refund");
});

it("does not call an internal refund transfer a completed bank refund",()=>{
  expect(refundState({kind:"REFUND_TRANSFER",status:"SUCCEEDED"})).toMatchObject({label:"Awaiting refund bank payout",needsHelp:false});
});
