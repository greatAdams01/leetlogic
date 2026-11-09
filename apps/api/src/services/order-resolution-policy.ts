/** Only the operation explicitly authorized by the current, audited resolution can
 * bypass missing fulfillment evidence. Normal receipt and automatic flows cannot. */
export function resolutionAuthorizes(order: { adminResolution?: unknown }, action: "RELEASE" | "REFUND", resolutionId?: string) {
  const decision = order.adminResolution as { id?: string; outcome?: string; financialAction?: string } | null;
  return !!resolutionId && decision?.id === resolutionId && decision.financialAction === action &&
    decision.outcome === (action === "RELEASE" ? "COMPLETED" : "CANCELLED");
}

export function canResumeResolutionOperations(rows: { status: string; kind: string; providerRef: string | null; leaseUntil: Date | null; payload?: unknown }[], action: string) {
  const kinds = action === "RELEASE" ? ["RELEASE"] : action === "REFUND" ? ["REFUND", "REFUND_TRANSFER"] : [];
  return rows.length > 0 && rows.every(row => row.status === "BLOCKED" && !row.providerRef && !row.leaseUntil && kinds.includes(row.kind) && !(row.payload as { automaticDeadline?: boolean; exception?: boolean } | null)?.automaticDeadline && !(row.payload as { exception?: boolean } | null)?.exception);
}
