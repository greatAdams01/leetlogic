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
