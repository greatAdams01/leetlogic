import { getConfig } from "../config.js";
import { prisma } from "@leetlogic/database";
import { orderPaymentProgress } from "@leetlogic/contracts";
import { mode } from "./payments.js";
import { paymentReady } from "../providers/payments/bachs.js";
type PaymentViewOrder = {
  id: string;
  totalMinor: bigint;
  heldMinor: bigint;
  releasedMinor: bigint;
  refundedMinor: bigint;
  deliveryConfirmedAt: Date | null;
  receiptPhotoKey: string | null;
  financialHold: boolean;
};
export async function orderPaymentView(order: PaymentViewOrder) {
  const [verified, release, disputed] = await Promise.all([
    prisma.paymentAttempt.count({
      where: {
        orderId: order.id,
        mode: mode(),
        kind: "ORDER",
        status: { in: ["SUCCEEDED", "REFUNDED"] },
        confirmedAt: { not: null },
        produceMinor: order.totalMinor,
      },
    }),
    prisma.moneyOperation.findFirst({
      where: { orderId: order.id, mode: mode(), kind: "RELEASE" },
      orderBy: { createdAt: "desc" },
      select: { status: true, failureCode: true, updatedAt: true },
    }),
    prisma.supportTicket.count({
      where: { orderId: order.id, kind: "DISPUTE", status: { not: "RESOLVED" } },
    }),
  ]);
  return paymentProgressView(order, { verified: !!verified, release, disputed: !!disputed });
}

/** Shared projection; queue readers can load the evidence in batches without per-row queries. */
export function paymentProgressView(order: PaymentViewOrder, facts: {
  verified: boolean;
  disputed: boolean;
  release: { status: string; failureCode: string | null } | null;
}) {
  let releaseEnabled = true;
  try {
    paymentReady("RELEASE");
  } catch {
    releaseEnabled = false;
  }
  return orderPaymentProgress({
    verified: facts.verified,
    heldMinor: String(order.heldMinor),
    releasedMinor: String(order.releasedMinor),
    refundedMinor: String(order.refundedMinor),
    receiptConfirmed: !!order.deliveryConfirmedAt,
    hasPhoto: !!order.receiptPhotoKey,
    disputed: order.financialHold || facts.disputed,
    releaseEnabled,
    pauseReason: !getConfig().PAYMENTS_ENABLED
      ? "PAYMENTS_DISABLED"
      : !getConfig().PAYMENTS_TRANSFERS_ENABLED
        ? "TRANSFERS_DISABLED"
        : "PAYMENT_CONFIGURATION",
    release: facts.release,
  });
}
