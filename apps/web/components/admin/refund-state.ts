export function refundState(op: {
  status: string;
  failureCode?: string | null;
  kind?: string;
  providerRef?: string | null;
}) {
  if (op.kind === "REFUND_TRANSFER" && op.status === "SUCCEEDED")
    return {
      label: "Awaiting refund bank payout",
      body: "Funds moved to the buyer’s provider balance. The separate bank payout must be confirmed before the refund is complete.",
      tone: "neutral",
      needsHelp: false,
    };
  if (op.status === "SUCCEEDED")
    return {
      label: "Refund completed",
      body: "The payment provider confirmed the refund. No further action is needed.",
      tone: "success",
      needsHelp: false,
    };
  if (op.status === "FAILED")
    return {
      label: "Refund failed",
      body: "The provider rejected the refund. The money has not been confirmed returned. Resolve the issue before trying again.",
      tone: "danger",
      needsHelp: true,
    };
  if (op.status === "BLOCKED")
    return {
      label: "Refund needs attention",
      body: "The refund cannot proceed until the issue below is resolved. It has not been confirmed completed.",
      tone: "danger",
      needsHelp: true,
    };
  if (op.status === "UNKNOWN") {
    if (op.kind && op.kind !== "REFUND" && !op.providerRef)
      return {
        label: "Refund needs attention",
        body: "The bank return result needs verification by payment staff. Do not send another transfer until the original result is confirmed.",
        tone: "warning",
        needsHelp: true,
      };
    const needsHelp =
      !!op.failureCode &&
      !["PAYMENT_RESULT_UNKNOWN", "WORKER_INTERRUPTED", "STALE_RECORD"].includes(op.failureCode);
    return {
      label: "Checking refund",
      body: needsHelp
        ? "Automatic checks have not resolved this refund. Payment staff need to review the issue below; checks will continue."
        : "The system is checking with the payment provider automatically. You do not need to submit another refund.",
      tone: needsHelp ? "warning" : "neutral",
      needsHelp,
    };
  }
  return {
    label: "Refund processing",
    body: "The refund request is being processed. The system will update this status when the provider confirms the result. No further approval is needed.",
    tone: "neutral",
    needsHelp: false,
  };
}
