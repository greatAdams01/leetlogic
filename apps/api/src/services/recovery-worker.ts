import { prisma, type Prisma } from "@leetlogic/database";
import { getConfig } from "../config.js";
import { AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import { audit } from "./audit.js";
import { createOperation, mode, systemRequest, reconcilePayment } from "./payments.js";
import { deliveryEvent, shippingProvider } from "./delivery.js";
import { deliveryRefundReady } from "./delivery-policy.js";
import { deadlinesEnabled, financeEnabled, financeAlert, overdue, trackVerifiedPayment } from "./fulfillment-deadline.js";
import { ensureRecovery, releaseRecoveryStock } from "./payment-recovery.js";
const elapsedBlocked = (at: Date) => Date.now() - at.getTime() > 60000;
const terminal = ["REFUNDED", "SECURED"];
async function notify(tx: Prisma.TransactionClient, orderId: string, state: string) {
  const d = await tx.delivery.findUnique({ where: { orderId } });
  if (d) await deliveryEvent(tx, d.id, state, "system", `${orderId}:deadline:${state}`);
}
export async function scanFulfillmentDeadlines() {
  if (!financeEnabled()) return;
  const heartbeatId = `payment:${mode()}`;
  // Independent of provider balance reconciliation and of money-operation backoff.
  await prisma.financeHeartbeat.upsert({ where: { id: heartbeatId }, create: { id: heartbeatId }, update: { checkedAt: new Date() } });
  const historical = await prisma.paymentAttempt.findMany({ where: { mode: mode(), kind: "ORDER", status: "SUCCEEDED", confirmedAt: null, checkoutId: { not: null }, nextCheckAt: { lte: new Date() } }, orderBy: { nextCheckAt: "asc" }, take: 10 });
  for (const payment of historical) await reconcilePayment(payment.id).catch(() => {});
  const untracked = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT p.id FROM payment_attempts p LEFT JOIN fulfillment_deadlines f ON f."orderId"=p."orderId"
    WHERE p.mode=${mode()} AND p.kind='ORDER' AND p."confirmedAt" IS NOT NULL
    AND p.status IN ('SUCCEEDED','EXCEPTION') AND f."orderId" IS NULL ORDER BY p."createdAt" ASC LIMIT 100`;
  for (const item of untracked) await prisma.$transaction(async tx => {
    const p = await tx.paymentAttempt.findUniqueOrThrow({ where: { id: item.id } });
    await tx.$queryRaw`SELECT id FROM trade_orders WHERE id=${p.orderId}::uuid FOR UPDATE`;
    await trackVerifiedPayment(tx, p, p.confirmedAt!); await ensureRecovery(tx, p.id);
  });
  const expiredReservations = await prisma.paymentRecovery.findMany({ where: { mode: mode(), reservationActive: true, allocatedAt: null, reservationUntil: { lte: new Date() } }, take: 100 });
  for (const r of expiredReservations) await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM trade_orders WHERE id=${r.orderId}::uuid FOR UPDATE`;
    const current = await tx.paymentRecovery.findUniqueOrThrow({ where: { id: r.id } });
    if (current.reservationUntil && current.reservationUntil <= new Date()) await releaseRecoveryStock(tx, r.id);
  });
  const rows = await prisma.fulfillmentDeadline.findMany({ where: { mode: mode(), state: { notIn: terminal }, nextRunAt: { lte: new Date() } }, orderBy: [{ nextRunAt: "asc" }, { refundDueAt: "asc" }], take: 100 });
  for (const row of rows) {
    try { await processDeadline(row.orderId); }
    catch (error) {
      const code = error instanceof AppError ? error.code : "REFUND_REVIEW_REQUIRED";
      await prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM trade_orders WHERE id=${row.orderId}::uuid FOR UPDATE`;
        await tx.fulfillmentDeadline.updateMany({ where: { orderId: row.orderId, state: { notIn: terminal } }, data: { failureCode: code, nextRunAt: new Date(Date.now() + 60000), ...(overdue(row.refundDueAt) && deadlinesEnabled() ? { state: "REFUND_BLOCKED" } : {}) } });
        if (overdue(row.refundDueAt) && deadlinesEnabled()) await notify(tx,row.orderId,"REFUND_BLOCKED");
        await financeAlert(tx, `${row.orderId}:${code}`, mode(), code, row.orderId);
      });
      logger.warn({ orderId: row.orderId, reason: code }, "Fulfillment deadline requires attention");
    }
  }
}
export async function processDeadline(orderId: string) {
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM trade_orders WHERE id=${orderId}::uuid FOR UPDATE`;
    const deadline = await tx.fulfillmentDeadline.findUniqueOrThrow({ where: { orderId } });
    if (terminal.includes(deadline.state)) return;
    const order = await tx.tradeOrder.findUniqueOrThrow({ where: { id: orderId }, include: { delivery: { include: { parcels: true } } } });
    const d = order.delivery;
    await tx.fulfillmentDeadline.update({ where: { orderId }, data: { nextRunAt: new Date(Date.now() + 15000) } });
    const payments = await tx.paymentAttempt.findMany({ where: { orderId, mode: mode(), confirmedAt: { not: null }, paidMinor: { gt: 0n } } });
    await ensureRecovery(tx, deadline.paymentId);
    const recovery = await tx.paymentRecovery.findFirst({ where: { orderId, mode: mode() } });
    const quote = d?.selectedQuoteId ? await tx.deliveryQuote.findUnique({ where: { id: d.selectedQuoteId } }) : null;
    // Historical valid fulfillment can be secured only with a complete booking and no review flags.
    const completeBooking = !!d?.providerShipmentId && ["BOOKED", "PICKED_UP", "IN_TRANSIT", "DELIVERED"].includes(d.status) && !d.failureCode &&
      (!d.providerShipmentId.startsWith("split:") ? !d.parcels.length : d.parcels.length === (d.package as any)?.packageCount && d.parcels.every(p => !!p.providerShipmentId && !p.failureCode));
    const bookedEvent = d ? await tx.deliveryEvent.findFirst({ where: { deliveryId: d.id, status: "BOOKED", createdAt: { lt: deadline.refundDueAt } } }) : null;
    if (deadline.state === "ACTIVE" && !!bookedEvent && completeBooking && (!recovery || !!recovery.allocatedAt) && d!.paidMinor >= (quote?.amountMinor ?? 0n) &&
      // bookingStartedAt proves the purchase was initiated before the cutoff. New bookings mark secured atomically.
      d!.bookingStartedAt && d!.bookingStartedAt < deadline.refundDueAt) {
      await tx.fulfillmentDeadline.update({ where: { orderId }, data: { state: "SECURED", securedAt: new Date() } }); return;
    }
    if (d?.failureCode || recovery || !d || !getConfig().DELIVERY_ENABLED || elapsedBlocked(deadline.confirmedAt)) await financeAlert(tx, `${orderId}:fulfillment-blocked`, mode(), "FULFILLMENT_BLOCKED", orderId);
    const elapsed = Date.now() - deadline.confirmedAt.getTime();
    const duration = deadline.refundDueAt.getTime() - deadline.confirmedAt.getTime();
    for (const fraction of [0.5, 0.75, 11 / 12]) if (elapsed >= duration * fraction) {
      const minute = Math.round(duration * fraction / 60000);
      await financeAlert(tx, `${orderId}:warning:${minute}`, mode(), `RECOVERY_DEADLINE_${minute}`, orderId);
    }
    const requestedRefund = deadline.state !== "ACTIVE";
    if (!deadlinesEnabled() || (!requestedRefund && !overdue(deadline.refundDueAt))) return;
    if (payments.length && payments.every(p => p.status === "REFUNDED")) {
      await tx.fulfillmentDeadline.update({ where: { orderId }, data: { state: "REFUNDED", failureCode: null } });
      await tx.paymentRecovery.updateMany({ where: { orderId }, data: { state: "REFUNDED" } });
      await tx.financeAlert.updateMany({ where: { orderId, resolvedAt: null }, data: { resolvedAt: new Date() } });
      await notify(tx, orderId, "REFUND_COMPLETED"); return;
    }
    await tx.fulfillmentDeadline.update({ where: { orderId }, data: { state: "REFUND_DUE", failureCode: null, nextRunAt: new Date(Date.now() + 15000) } });
    if (recovery && !recovery.allocatedAt) {
      await releaseRecoveryStock(tx, recovery.id);
      await tx.paymentRecovery.update({ where: { id: recovery.id }, data: { state: "REFUND_REQUIRED" } });
    }
    await notify(tx, orderId, "REFUND_DUE");
    if (!deliveryRefundReady(d) && d) {
      const collected = ["PICKED_UP", "IN_TRANSIT", "DELIVERED", "RETURNING"].includes(d.status) || d.parcels.some(p => ["PICKED_UP", "IN_TRANSIT", "DELIVERED"].includes(p.status));
      await tx.delivery.update({ where: { id: d.id }, data: { ...(collected ? {} : { cancelRequestedAt: d.cancelRequestedAt || new Date() }), nextSyncAt: new Date() } });
      const reason = collected ? "REFUND_COLLECTED_SHIPMENT_REVIEW" : "REFUND_SHIPMENT_RECONCILIATION";
      await tx.fulfillmentDeadline.update({ where: { orderId }, data: { state: "REFUND_RECONCILIATION", failureCode: reason } });
      await notify(tx,orderId,"REFUND_RECONCILIATION");
      await financeAlert(tx, `${orderId}:${reason}`, mode(), reason, orderId); return;
    }
    if (order.releasedMinor > 0n || await tx.moneyOperation.count({ where: { orderId, kind: { in: ["RELEASE", "DISPUTE"] }, status: { notIn: ["FAILED", "RESOLVED"] } } }) ||
      await tx.supportTicket.count({ where: { orderId, kind: "DISPUTE", status: { not: "RESOLVED" } } })) throw new AppError(409, "REFUND_FINANCIAL_REVIEW", "A financial review must be resolved before refunding.");
    const c = getConfig();
    if (!c.PAYMENTS_REFUNDS_ENABLED || (mode() === "live" && (!c.PAYMENTS_LIVE_MONEY || !c.BACHS_PLATFORM_APPROVED))) throw new AppError(503, "REFUNDS_DISABLED", "Refund processing is disabled.");
    // Active sessions can produce late receipts. They remain reconcilable; overdue guards prevent new writes.
    const shippingBalance = await tx.moneyJournalLine.aggregate({ where: { account: `held_shipping:${orderId}`, journal: { mode: mode() } }, _sum: { amountMinor: true } });
    // Pending refunds have reserved part of the liability even before their journals post.
    const pendingRefunds = await tx.moneyOperation.findMany({ where: { orderId, kind: { in: ["REFUND", "REFUND_TRANSFER"] }, status: { in: ["QUEUED", "PROCESSING", "PROVIDER_PENDING", "UNKNOWN", "BLOCKED"] } } });
    let shippingBudget = -(shippingBalance._sum.amountMinor ?? 0n);
    for (const operation of pendingRefunds) {
      const payload = operation.payload as any;
      if (payload?.automaticDeadline && !payload.exception) shippingBudget -= BigInt(payload.shippingMinor || "0") - BigInt(payload.shippingFromBusinessMinor || "0");
    }
    if (shippingBudget < 0n) shippingBudget = 0n;
    for (const p of payments) {
      if (p.status === "REFUNDED") continue;
      const previous = await tx.moneyOperation.findFirst({ where: { paymentId: p.id, kind: { in: ["REFUND", "REFUND_TRANSFER", "REFUND_PAYOUT"] }, status: { not: "RESOLVED" } }, orderBy: { createdAt: "desc" } });
      if (previous) {
        if (["FAILED", "BLOCKED", "UNKNOWN"].includes(previous.status)) {
          await tx.fulfillmentDeadline.update({ where: { orderId }, data: { state: "REFUND_BLOCKED", failureCode: previous.failureCode || "REFUND_REVIEW_REQUIRED" } });
          await financeAlert(tx, `${orderId}:refund:${previous.failureCode || previous.status}`, mode(), previous.failureCode || "REFUND_REVIEW_REQUIRED", orderId);
          return;
        }
        continue;
      }
      const allocated = !!(await tx.moneyJournal.findUnique({ where: { reference: `funded:${p.id}` } }));
      const bank = !!p.method?.toUpperCase().includes("TRANSFER");
      let destinationId: string | undefined;
      if (bank) {
        if (!c.BACHS_BANK_REFUNDS_VERIFIED || !c.PAYMENTS_TRANSFERS_ENABLED || !c.PAYMENTS_PAYOUTS_ENABLED) throw new AppError(409, "BANK_REFUND_UNAVAILABLE", "Verified bank refund routing is required.");
        const bankDestination = await tx.bankDestination.findFirst({ where: { userId: p.buyerId, mode: mode(), usable: true }, orderBy: { createdAt: "asc" } });
        if (!bankDestination) throw new AppError(409, "BUYER_BANK_REQUIRED", "A verified original-payer bank is required.");
        destinationId = bankDestination.id;
      }
      const failed = await tx.moneyOperation.count({ where: { paymentId: p.id, kind: { in: ["REFUND", "REFUND_TRANSFER"] }, status: "FAILED" } });
      const shippingCovered = allocated ? (shippingBudget > p.shippingMinor ? p.shippingMinor : shippingBudget) : 0n;
      shippingBudget -= shippingCovered;
      await createOperation(tx, { ownerId: p.buyerId, orderId, paymentId: p.id, kind: bank ? "REFUND_TRANSFER" : "REFUND", key: `automatic:${p.id}:${failed}`, amountMinor: p.paidMinor,
        payload: { automaticDeadline: true, exception: !allocated, produceMinor: allocated ? p.produceMinor.toString() : "0", shippingMinor: allocated ? p.shippingMinor.toString() : "0", shippingFromBusinessMinor: allocated ? (p.shippingMinor - shippingCovered).toString() : "0", destinationId: destinationId ?? null, reason: "Fulfillment not secured before the recorded refund deadline" } });
    }
    await tx.fulfillmentDeadline.update({ where: { orderId }, data: { state: "REFUND_PROCESSING" } });
    await notify(tx, orderId, "REFUND_PROCESSING");
    await audit(systemRequest(), { action: "payment.deadline.refund.queued", entityType: "order", entityId: orderId }, tx);
  });
}
export async function refreshShippingWallet() {
  const id = `payment:${mode()}`;
  try {
    const value = await shippingProvider.wallet();
    await prisma.financeHeartbeat.upsert({ where: { id }, create: { id, walletMinor: value, walletCheckedAt: new Date() }, update: { walletMinor: value, walletCheckedAt: new Date(), walletError: null } });
    return value;
  } catch {
    await prisma.financeHeartbeat.upsert({ where: { id }, create: { id, walletError: "SHIPPING_WALLET_UNAVAILABLE" }, update: { walletError: "SHIPPING_WALLET_UNAVAILABLE" } });
    return null;
  }
}
export function startRecoveryWorker() {
  let running = false, stopped = false;
  const run = async () => {
    if (running || stopped || !financeEnabled()) return;
    running = true;
    try {
      await scanFulfillmentDeadlines();
      const heart = await prisma.financeHeartbeat.findUnique({ where: { id: `payment:${mode()}` } });
      if (!heart?.walletCheckedAt || Date.now() - heart.walletCheckedAt.getTime() >= 60000) await refreshShippingWallet();
    } catch { logger.error({ reason: "RECOVERY_WORKER_FAILED" }, "Recovery worker requires attention"); }
    finally { running = false; }
  };
  const timer = setInterval(() => void run(), 15000); timer.unref(); void run();
  return () => { stopped = true; clearInterval(timer); };
}
