import { orderUpdateCopy } from "@leetlogic/contracts";
import { sendFarmerPush } from "./push-notifications.js";
import { logger } from "../lib/logger.js";
import { prisma } from "@leetlogic/database";

/** Durable outbox, created in the same transaction as confirmed order funding. */
export async function sendPaidOrderNotifications() {
  const rows = await prisma.paidOrderNotification.findMany({
    where: { sentAt: null, nextRunAt: { lte: new Date() }, attempts: { lt: 12 } },
    orderBy: { createdAt: "asc" },
    take: 20,
  });
  for (const row of rows) {
    const claimed = await prisma.paidOrderNotification.updateMany({
      where: { id: row.id, sentAt: null, nextRunAt: { lte: new Date() } },
      data: { nextRunAt: new Date(Date.now() + 120000), attempts: { increment: 1 } },
    });
    if (!claimed.count) continue;
    try {
      const retry = await sendFarmerPush({
        userId: row.userId,
        title: "New paid order",
        body: "A buyer has paid for your produce. Open LeetLogic to review the order.",
        channelId: "paid-orders",
        data: { kind: "paid-order", orderId: row.orderId, userId: row.userId },
      });
      // No registered devices: the notification remains available in the inbox.
      if (!retry)
        await prisma.paidOrderNotification.update({
          where: { id: row.id },
          data: { sentAt: new Date() },
        });
    } catch {
      logger.warn(
        { notificationId: row.id, attempt: row.attempts + 1 },
        "Paid-order push will be retried",
      );
      // A failed gateway request must never roll back a payment; retry after the lease.
    }
  }
}

/** Delivery events already create account-scoped inbox records transactionally. */
export async function sendOrderUpdateNotifications() {
  const rows = await prisma.deliveryNotification.findMany({ where: { sentAt: null, attempts: { lt: 12 }, nextRunAt: { lte: new Date() } }, take: 20, orderBy: { createdAt: "asc" }, include: { event: { include: { delivery: { select: { order: { select: { buyerId: true } } } } } } } });
  for (const row of rows) {
    const claim = await prisma.deliveryNotification.updateMany({ where: { id: row.id, sentAt: null, nextRunAt: { lte: new Date() } }, data: { attempts: { increment: 1 }, nextRunAt: new Date(Date.now() + 120000) } });
    if (!claim.count) continue;
    const copy = orderUpdateCopy(row.messageKey, row.userId === row.event.delivery.order.buyerId);
    try {
      const retry = await sendFarmerPush({ userId: row.userId, title: copy.title, body: copy.body, channelId: "paid-orders", data: { kind: "order-update", orderId: row.orderId, userId: row.userId } });
      if (!retry) await prisma.deliveryNotification.update({ where: { id: row.id }, data: { sentAt: new Date() } });
    } catch { logger.warn({ notificationId: row.id }, "Order update push will retry"); }
  }
}
