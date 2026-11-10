import { prisma, type Prisma, type PaymentAttempt } from "@leetlogic/database";
import { getConfig } from "../config.js";
import { AppError } from "../lib/errors.js";
export const recoveryEnabled = () => getConfig().PAYMENT_RECOVERY_ENABLED;
export const deadlinesEnabled = () => getConfig().PAYMENT_AUTO_REFUNDS_ENABLED;
export const financeEnabled = () => recoveryEnabled() || deadlinesEnabled() || getConfig().SHIPPING_FUNDING_ENABLED;
export const refundDeadline = (at: Date, minutes = 120) => new Date(at.getTime() + minutes * 60000);
export const overdue = (at: Date, now = new Date()) => at <= now;
export async function financeAlert(tx: Prisma.TransactionClient, key: string, mode: string, code: string, orderId?: string) {
  await tx.financeAlert.upsert({ where: { key: `${mode}:${key}` }, create: { key: `${mode}:${key}`, mode, code, orderId }, update: {} });
}
export async function trackVerifiedPayment(tx: Prisma.TransactionClient, p: PaymentAttempt, at: Date) {
  if (!financeEnabled()) return;
  if (p.kind !== "ORDER") {
    if (p.kind === "DELIVERY_TOPUP") await tx.fulfillmentDeadline.updateMany({ where: { orderId: p.orderId, state: { in: ["REFUNDED", "REFUND_PROCESSING", "REFUND_BLOCKED", "REFUND_DUE", "REFUND_RECONCILIATION"] } }, data: { state: "REFUND_DUE", nextRunAt: new Date() } });
    return;
  }
  const settings = await tx.marketplaceSettings.findUnique({ where: { id: "marketplace" }, select: { paymentRecoveryTimeoutMinutes: true } });
  await tx.fulfillmentDeadline.upsert({ where: { orderId: p.orderId }, create: {
    orderId: p.orderId, paymentId: p.id, mode: p.mode, confirmedAt: at, refundDueAt: refundDeadline(at, settings?.paymentRecoveryTimeoutMinutes ?? 120),
  }, update: {} });
}
/** Call under the order row lock before checkout creation and every irreversible label purchase. */
export async function assertFulfillmentOpen(tx: Prisma.TransactionClient, orderId: string) {
  const order = await tx.tradeOrder.findUniqueOrThrow({ where: { id: orderId }, select: { adminResolution: true } });
  if (order.adminResolution) {
    if ((order.adminResolution as { financialAction?: string }).financialAction === "HOLD") throw new AppError(409, "ORDER_UNDER_INVESTIGATION", "This case is under investigation. Fulfillment and payments are paused.");
    throw new AppError(409, "ORDER_RESOLVED", "This order was closed by an administrator. Fulfillment cannot restart.");
  }
  if (!deadlinesEnabled()) return;
  const d = await tx.fulfillmentDeadline.findUnique({ where: { orderId } });
  if (d && (d.state !== "ACTIVE" && d.state !== "SECURED" || d.state === "ACTIVE" && overdue(d.refundDueAt)))
    throw new AppError(409, "FULFILLMENT_REFUND_DUE", "Your payment is confirmed. A refund is due; fulfillment cannot restart.");
}
export async function markFulfillmentSecured(tx: Prisma.TransactionClient, orderId: string) {
  if (!financeEnabled()) return;
  const d = await tx.fulfillmentDeadline.findUnique({ where: { orderId } });
  if (!d) return;
  if (deadlinesEnabled() && (d.state !== "ACTIVE" || overdue(d.refundDueAt))) return;
  await tx.fulfillmentDeadline.update({ where: { orderId }, data: { state: "SECURED", securedAt: new Date() } });
  await tx.financeAlert.updateMany({ where: { orderId, resolvedAt: null }, data: { resolvedAt: new Date() } });
  await tx.paymentRecovery.updateMany({ where: { orderId, allocatedAt: { not: null } }, data: { state: "FULFILLMENT_STARTED" } });
}
export async function readFulfillment(orderId: string) {
  if (!financeEnabled()) return null;
  return prisma.fulfillmentDeadline.findUnique({ where: { orderId } });
}
