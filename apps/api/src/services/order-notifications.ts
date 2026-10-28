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
      const devices = await prisma.mobilePushDevice.findMany({ where: { userId: row.userId } });
      let retry = false;
      for (const device of devices) {
        const session = await prisma.session.findFirst({
          where: {
            tokenFamilyId: device.sessionFamilyId,
            userId: row.userId,
            user: { status: "ACTIVE" },
            revokedAt: null,
            replacedById: null,
            expiresAt: { gt: new Date() },
          },
        });
        if (!session) continue;
        const response = await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          signal: AbortSignal.timeout(10000),
          headers: {
            "Content-Type": "application/json",
            ...(process.env.EXPO_ACCESS_TOKEN
              ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` }
              : {}),
          },
          body: JSON.stringify({
            to: device.token,
            title: "New paid order",
            body: "A buyer has paid for your produce. Open LeetLogic to review the order.",
            sound: "default",
            channelId: "paid-orders",
            data: { kind: "paid-order", orderId: row.orderId, userId: row.userId },
          }),
        });
        if (!response.ok) {
          retry = true;
          continue;
        }
        const result = (await response.json()) as {
          data?: { status?: string; details?: { error?: string } };
        };
        if (result.data?.details?.error === "DeviceNotRegistered") {
          await prisma.mobilePushDevice.deleteMany({
            where: { token: device.token, sessionFamilyId: device.sessionFamilyId },
          });
        } else if (result.data?.status !== "ok") retry = true;
      }
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
