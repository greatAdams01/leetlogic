export type PaymentState = {
  id: string;
  kind: string;
  status: string;
  checkoutUrl?: string | null;
  amountMinor?: string;
  paidMinor?: string;
  expiresAt?: string;
  exceptionCode?: string | null;
  confirmedAt?: string | Date | null;
  paymentConfirmed?: boolean;
  confirmationPending?: boolean;
  verificationDeferred?: boolean;
};
export const pendingPaymentStatuses = ["QUEUED", "PROCESSING", "UNKNOWN", "OPEN"];

/** A verified receipt can be held for fulfilment review without becoming unpaid. */
export function paymentIsConfirmed(payment: Pick<PaymentState, "status" | "confirmedAt" | "paymentConfirmed">) {
  return payment.paymentConfirmed === true || !!payment.confirmedAt || ["SUCCEEDED", "REFUNDED"].includes(payment.status);
}
export function paymentNeedsConfirmation(payment: Pick<PaymentState, "status" | "confirmedAt" | "paymentConfirmed" | "confirmationPending">) {
  return !paymentIsConfirmed(payment) &&
    (payment.confirmationPending ?? pendingPaymentStatuses.includes(payment.status));
}

/** Display actions follow persisted attempts, never just the current escrow balance. */
export function paymentActions<T extends PaymentState>(
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
  const pending = relevant.find((item) => paymentNeedsConfirmation(item) ||
    (!paymentIsConfirmed(item) && data.checkoutActive && item.status === "BLOCKED"));
  const succeeded = relevant.some(paymentIsConfirmed);
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
      !pending?.verificationDeferred &&
      pending?.status === "OPEN" &&
      !!pending.checkoutUrl &&
      pending.amountMinor === data.payableMinor &&
      (!pending.expiresAt || new Date(pending.expiresAt).getTime() > now),
  };
}
