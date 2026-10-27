type Attempt = {
  id: string;
  kind: string;
  status: string;
  checkoutUrl?: string | null;
  expiresAt?: string;
  exceptionCode?: string | null;
};
export const pendingPaymentStatuses = ["QUEUED", "PROCESSING", "UNKNOWN", "OPEN"];

/** Display actions follow persisted attempts, never just the current escrow balance. */
export function paymentActions<T extends Attempt>(
  data: {
    items?: T[];
    heldMinor?: string;
    releasedMinor?: string;
    refundedMinor?: string;
    financialHold?: boolean;
    orderStatus?: string;
  },
  topup = false,
) {
  const hasFunds = [data.heldMinor, data.releasedMinor, data.refundedMinor].some(
    (value) => value && value !== "0",
  );
  const kind = topup && hasFunds ? "DELIVERY_TOPUP" : "ORDER";
  const relevant = (data.items || []).filter((item) => item.kind === kind);
  const pending = relevant.find((item) => pendingPaymentStatuses.includes(item.status));
  const succeeded = relevant.some((item) => item.status === "SUCCEEDED");
  const item = pending || relevant[0];
  const locked =
    !!data.financialHold ||
    (!!item && item.status === "EXCEPTION") ||
    (!!data.orderStatus && data.orderStatus !== (kind === "ORDER" ? "AWAITING_PAYMENT" : "FUNDED"));
  return {
    item,
    pending,
    succeeded,
    kind,
    locked,
    canPay: !locked && !pending && !succeeded && (kind !== "ORDER" || !hasFunds),
    canResume:
      !locked &&
      pending?.status === "OPEN" &&
      !!pending.checkoutUrl &&
      (!pending.expiresAt || new Date(pending.expiresAt).getTime() > Date.now()),
  };
}
