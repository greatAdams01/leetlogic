import { describe, expect, it } from "vitest";
import { recoveryExperience, orderUpdateCopy, type RecoveryRecord } from "./order-updates.js";
const now = new Date("2026-11-04T12:00:00Z");
const base: RecoveryRecord = {
  state: "WAITING_FARMER",
  isBuyer: false,
  version: 1,
  deadline: { state: "ACTIVE", refundDueAt: "2026-11-04T13:00:00Z" },
};
describe("actionable order recovery", () => {
  it("lets the farmer confirm and lets a waiting buyer request a refund", () => {
    expect(recoveryExperience(base, now)).toMatchObject({
      canFarmerConfirm: true,
      canBuyerAccept: false,
      canRequestRefund: true,
    });
    expect(recoveryExperience({ ...base, isBuyer: true }, now)).toMatchObject({
      title: "Waiting for farmer confirmation",
      canFarmerConfirm: false,
      canRequestRefund: true,
    });
  });
  it.each([
    "REFUND_DUE",
    "REFUND_PROCESSING",
    "REFUND_BLOCKED",
    "REFUND_RECONCILIATION",
    "REFUNDED",
  ])("closes recovery actions for %s and uses the deadline state", (state) => {
    expect(
      recoveryExperience(
        { ...base, state: "REFUND_REQUIRED", deadline: { ...base.deadline!, state } },
        now,
      ),
    ).toMatchObject({
      phase: state,
      canFarmerConfirm: false,
      canBuyerAccept: false,
      canRequestRefund: false,
    });
  });
  it("closes actions at the cutoff even if the worker has not updated the recovery row", () => {
    const due = { ...base, deadline: { state: "ACTIVE", refundDueAt: now } };
    expect(recoveryExperience(due, now).phase).toBe("REFUND_DUE");
    expect(recoveryExperience(due, now).canFarmerConfirm).toBe(false);
  });
  it("does not let an old deadline regress secured fulfillment", () => {
    expect(
      recoveryExperience(
        { ...base, allocatedAt: now, deadline: { state: "SECURED", refundDueAt: now } },
        now,
      ).title,
    ).toBe("Payment allocated to your order");
  });
  it("offers buyer acceptance only for a live stock reservation and proposal", () => {
    const proposal = {
      ...base,
      isBuyer: true,
      farmerConfirmedAt: now,
      reservationUntil: "2026-11-04T12:30:00Z",
      proposal: { version: 1, expiresAt: "2026-11-04T12:15:00Z" },
    };
    expect(recoveryExperience(proposal, now).canBuyerAccept).toBe(true);
    expect(
      recoveryExperience({ ...proposal, proposal: { ...proposal.proposal, version: 2 } }, now)
        .canBuyerAccept,
    ).toBe(false);
    expect(recoveryExperience({ ...proposal, reservationUntil: now }, now).canBuyerAccept).toBe(
      false,
    );
    expect(
      recoveryExperience(
        { ...proposal, proposal: { ...proposal.proposal, buyerAcceptedAt: now } },
        now,
      ),
    ).toMatchObject({ title: "Waiting for staff approval", canBuyerAccept: false });
  });
  it("gives human descriptions to historical and unknown event keys", () => {
    expect(orderUpdateCopy("status.RECOVERY_REQUIRED", false).title).toBe(
      "Stock confirmation needed",
    );
    expect(orderUpdateCopy("status.REFUND_BLOCKED", true).body).toContain("Staff");
    expect(orderUpdateCopy("status.FUTURE_EVENT", true)).toMatchObject({
      title: "Order information changed",
    });
  });
});
