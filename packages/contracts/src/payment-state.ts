type Attempt = {
  id: string;
  kind: string;
  status: string;
    checkoutUrl?: string | null;
    amountMinor?: string;
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
    checkoutReady?: boolean;
    checkoutActive?: boolean;
    payableMinor?: string | null;
    quoteExpiresAt?: string | null;
  },
  topup = false,
  now = Date.now(),
) {
  const hasFunds = [data.heldMinor, data.releasedMinor, data.refundedMinor].some(
    (value) => value && value !== "0",
  );
  const kind = topup && hasFunds ? "DELIVERY_TOPUP" : "ORDER";
  const relevant = (data.items || []).filter((item) => item.kind === kind);
  const pending = relevant.find((item) => pendingPaymentStatuses.includes(item.status) ||
    (data.checkoutActive && item.status === "BLOCKED"));
  const succeeded = relevant.some((item) => item.status === "SUCCEEDED");
  const item = pending || relevant[0];
  const locked =
    !!data.financialHold ||
    (!!item && item.status === "EXCEPTION") ||
    (!!data.orderStatus && data.orderStatus !== (kind === "ORDER" ? "AWAITING_PAYMENT" : "FUNDED"));
  const ready = data.checkoutReady === true && !!data.payableMinor && /^[1-9]\d*$/.test(data.payableMinor) &&
    (!data.quoteExpiresAt || new Date(data.quoteExpiresAt).getTime() > now);
  return {
    item,
    pending,
    succeeded,
    kind,
    locked,
    ready,
    canPay: ready && !locked && !pending && !data.checkoutActive && !succeeded && (kind !== "ORDER" || !hasFunds),
    canResume:
      ready &&
      !locked &&
      pending?.status === "OPEN" &&
      !!pending.checkoutUrl &&
      pending.amountMinor === data.payableMinor &&
      (!pending.expiresAt || new Date(pending.expiresAt).getTime() > now),
  };
}
