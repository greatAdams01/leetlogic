export type AdminOrderResolution = {
  id: string; outcome: "COMPLETED" | "CANCELLED" | "UNDER_INVESTIGATION"; financialAction: "RELEASE" | "REFUND" | "HOLD" | "NONE";
  reason: string; evidence: string; adminId: string; resolvedAt: string;
  previousOrderStatus: string; previousDeliveryStatus: string | null;
  previousFinancialHold: boolean; previousHeldMinor: string; shippingRefundMinor: string;
};
export type OrderResolutionOptions = { resumeShippingRefundMinor?: string | null; resumeDestinationId?: string | null; bankRefundRequired: boolean; refundDestinations: { id: string; bankName: string; accountName: string; accountLastFour: string }[]; release: boolean; refund: boolean; hold: boolean; none: boolean; refundableShippingMinor: string; blockedReason: string | null };
export const resolutionFinancialLabels = { RELEASE: "Release payment to farmer", REFUND: "Refund buyer", HOLD: "Keep case open and hold funds", NONE: "No payment to move" } as const;
