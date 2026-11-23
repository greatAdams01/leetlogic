export type AdminOrderResolution = {
  id: string; outcome: "COMPLETED" | "CANCELLED" | "UNDER_INVESTIGATION"; financialAction: "RELEASE" | "REFUND" | "HOLD" | "NONE";
  reason: string; evidence: string; adminId: string; resolvedAt: string;
  previousOrderStatus: string; previousDeliveryStatus: string | null;
  previousFinancialHold: boolean; previousHeldMinor: string; shippingRefundMinor: string;
};
export type OrderResolutionOptions = { resumeShippingRefundMinor?: string | null; resumeDestinationId?: string | null; bankRefundRequired: boolean; refundDestinations: { id: string; bankName: string; accountName: string; accountLastFour: string }[]; release: boolean; refund: boolean; hold: boolean; none: boolean; refundableShippingMinor: string; blockedReason: string | null };
export const resolutionFinancialLabels = { RELEASE: "Release payment to farmer", REFUND: "Refund buyer", HOLD: "Keep case open and hold funds", NONE: "No payment to move" } as const;

export type CustomerOrderResolution = Pick<AdminOrderResolution, "outcome" | "financialAction" | "resolvedAt">;
/** Internal evidence, reviewer identity and audit notes are not customer-facing fields. */
export function customerOrderResolution(value: unknown): CustomerOrderResolution | null {
  const resolution = value as Partial<AdminOrderResolution> | null;
  if (!resolution || !["COMPLETED", "CANCELLED", "UNDER_INVESTIGATION"].includes(resolution.outcome || "") ||
    !["RELEASE", "REFUND", "HOLD", "NONE"].includes(resolution.financialAction || "") || typeof resolution.resolvedAt !== "string") return null;
  return { outcome: resolution.outcome!, financialAction: resolution.financialAction!, resolvedAt: resolution.resolvedAt };
}

export const customerResolutionFinancialLabels = {
  RELEASE: "Payment release authorized",
  REFUND: "Buyer refund authorized",
  HOLD: "Payment held for investigation",
  NONE: "No payment movement required",
} as const;
