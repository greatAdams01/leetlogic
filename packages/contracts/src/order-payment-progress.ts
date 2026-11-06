export function orderPaymentProgress(input: {
  verified: boolean;
  heldMinor?: string;
  releasedMinor?: string;
  refundedMinor?: string;
  receiptConfirmed?: boolean;
  hasPhoto?: boolean;
  disputed?: boolean;
  releaseEnabled?: boolean;
  pauseReason?: string;
  release?: { status: string; failureCode?: string | null } | null;
}) {
  let stage = "UNVERIFIED",
    title = "Payment not verified",
    body = "We have not verified a successful payment for this order.",
    tone: "neutral" | "success" | "warning" = "neutral";
  let escrow = "Not secured",
    transfer = "Not started",
    earnings = "Not credited";
  if (input.verified) {
    const held = BigInt(input.heldMinor || "0") > 0n;
    stage = held ? "SECURED" : "ALLOCATION";
    title = held ? "Payment Secured" : "Payment verified";
    body = held
      ? "Payment is held safely until receipt is confirmed."
      : "Payment is verified. We are checking how the funds were allocated.";
    escrow = held ? "Held in escrow" : "Checking allocation";
    if (BigInt(input.refundedMinor || "0") > 0n) {
      stage = "REFUNDED";
      title = "Payment refunded";
      body = "The refund has been confirmed.";
      escrow = "Refunded";
    } else if (BigInt(input.releasedMinor || "0") > 0n && input.release?.status === "SUCCEEDED") {
      stage = "AVAILABLE";
      title = "Funds Available";
      body =
        "The farmer’s transfer is confirmed and credited to earnings. Bank withdrawal is separate.";
      tone = "success";
      escrow = "Escrow Released";
      transfer = "Transfer confirmed";
      earnings = "Credited to earnings";
    } else if (BigInt(input.releasedMinor || "0") > 0n) {
      stage = "REVIEW";
      title = "Verifying payment release";
      body =
        "A release is recorded, but the successful transfer has not been verified. Support must review it.";
      escrow = "Release recorded";
      transfer = "Not confirmed";
      tone = "warning";
    } else if (input.disputed) {
      stage = "REVIEW";
      title = "Payment under review";
      body = "A dispute or financial review must be resolved before payment release.";
      tone = "warning";
    } else if (input.release && ["FAILED", "BLOCKED"].includes(input.release.status)) {
      stage = "ATTENTION";
      title = "Payment release needs attention";
      body = "The transfer could not complete. Support must review the payment; do not pay again.";
      transfer = input.release.status === "FAILED" ? "Transfer failed" : "Transfer paused";
      tone = "warning";
    } else if (input.release?.status === "QUEUED" && input.releaseEnabled === false) {
      stage = "PAUSED";
      title = "Release Pending";
      body =
        "The transfer is queued, but payment processing is disabled or needs configuration. Support must restore processing.";
      transfer = "Transfer paused";
      tone = "warning";
    } else if (input.release) {
      stage = "PROCESSING";
      title = "Transfer Processing";
      body =
        input.release.status === "QUEUED"
          ? "Receipt is saved. The secure transfer is queued for the payment worker."
          : "The provider has not yet confirmed the farmer’s transfer.";
      transfer = input.release.status === "QUEUED" ? "Queued" : "Processing";
    } else if (input.receiptConfirmed) {
      stage = "PENDING";
      title = "Release Pending";
      body = "Receipt is saved. Automatic release is waiting for the payment worker.";
      if (!input.hasPhoto) {
        stage = "REVIEW";
        body =
          "Receipt is saved, but receipt evidence needs staff review before automatic release.";
        tone = "warning";
      } else if (input.releaseEnabled === false) {
        stage = "PAUSED";
        body =
          input.pauseReason === "TRANSFERS_DISABLED" || input.pauseReason === "PAYMENTS_DISABLED"
            ? "Receipt and evidence are saved. Automatic transfers are disabled in platform settings; support must restore payment processing."
            : "Receipt and evidence are saved. Payment configuration needs support attention before the transfer can start.";
        tone = "warning";
      }
    }
  }
  return { stage, title, body, tone, escrow, transfer, earnings, verified: input.verified };
}
export type OrderPaymentProgress = ReturnType<typeof orderPaymentProgress>;
