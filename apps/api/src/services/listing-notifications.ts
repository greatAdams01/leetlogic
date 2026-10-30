import { prisma } from "@leetlogic/database";
import { logger } from "../lib/logger.js";
import { sendFarmerPush } from "./push-notifications.js";

/** Approval and its durable inbox/outbox entry commit together. Gateway failures retry later. */
export async function sendListingApprovalNotifications() {
  const rows = await prisma.listingApprovalNotification.findMany({
    where: { sentAt: null, nextRunAt: { lte: new Date() }, attempts: { lt: 12 } },
    orderBy: { createdAt: "asc" }, take: 20,
  });
  for (const row of rows) {
    const claimed = await prisma.listingApprovalNotification.updateMany({
      where: { id: row.id, sentAt: null, nextRunAt: { lte: new Date() } },
      data: { nextRunAt: new Date(Date.now() + 120000), attempts: { increment: 1 } },
    });
    if (!claimed.count) continue;
    try {
      const retry = await sendFarmerPush({
        userId: row.userId, title: "Listing approved",
        body: `Your listing “${row.title}” has been approved and is now live.`,
        channelId: "listing-updates",
        data: { kind: "listing-approved", listingId: row.listingId, userId: row.userId },
      });
      if (!retry) await prisma.listingApprovalNotification.update({ where: { id: row.id }, data: { sentAt: new Date() } });
    } catch {
      logger.warn({ notificationId: row.id, attempt: row.attempts + 1 }, "Listing approval push will be retried");
    }
  }
}
