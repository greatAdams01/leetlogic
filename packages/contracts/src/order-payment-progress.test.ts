import { expect, it } from "vitest";
import { orderPaymentProgress } from "./order-payment-progress.js";
it("does not treat an order record or an amount as verified payment", () => {
  expect(
    orderPaymentProgress({
      verified: false,
      heldMinor: "10000",
      receiptConfirmed: true,
      hasPhoto: true,
    }).stage,
  ).toBe("UNVERIFIED");
});
it("distinguishes secured escrow, release pause, transfer processing, and available earnings", () => {
  const base = { verified: true, heldMinor: "10000", hasPhoto: true };
  expect(orderPaymentProgress(base)).toMatchObject({
    stage: "SECURED",
    escrow: "Held in escrow",
    transfer: "Not started",
    earnings: "Not credited",
  });
  expect(
    orderPaymentProgress({ ...base, receiptConfirmed: true, releaseEnabled: false }),
  ).toMatchObject({ stage: "PAUSED", tone: "warning" });
  expect(orderPaymentProgress({ ...base, release: { status: "QUEUED" } })).toMatchObject({
    stage: "PROCESSING",
    transfer: "Queued",
    escrow: "Held in escrow",
  });
  expect(
    orderPaymentProgress({ ...base, releasedMinor: "10000", release: { status: "SUCCEEDED" } }),
  ).toMatchObject({
    stage: "AVAILABLE",
    escrow: "Escrow Released",
    transfer: "Transfer confirmed",
    earnings: "Credited to earnings",
  });
});
it("keeps disputed and failed releases out of success styling", () => {
  expect(orderPaymentProgress({ verified: true, disputed: true }).tone).toBe("warning");
  expect(orderPaymentProgress({ verified: true, release: { status: "FAILED" } })).toMatchObject({
    stage: "ATTENTION",
    tone: "warning",
  });
});
it("does not equate a release amount with a verified transfer or claim zero funds are held", () => {
  expect(orderPaymentProgress({ verified: true, heldMinor: "0" })).toMatchObject({
    stage: "ALLOCATION",
    escrow: "Checking allocation",
  });
  expect(
    orderPaymentProgress({ verified: true, heldMinor: "0", releasedMinor: "10000" }),
  ).toMatchObject({ stage: "REVIEW", tone: "warning", transfer: "Not confirmed" });
  expect(
    orderPaymentProgress({
      verified: true,
      heldMinor: "10000",
      releaseEnabled: false,
      release: { status: "QUEUED" },
    }),
  ).toMatchObject({ stage: "PAUSED", transfer: "Transfer paused", tone: "warning" });
});
