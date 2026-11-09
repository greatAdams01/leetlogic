import { randomUUID } from "node:crypto";
import { prisma } from "@leetlogic/database";
import { adminRecordInclude, adminRecordRevision, lastOrderHistoryId } from "../services/admin-order-management.js";

/** Match the detail page's reviewed snapshot, not a fabricated timestamp. */
export async function adminMutation(orderId: string, reason = "Verified operational update in the isolated test fixture") {
  const order = await prisma.tradeOrder.findUniqueOrThrow({ where: { id: orderId }, include: adminRecordInclude });
  return { reason, expectedRevision: adminRecordRevision(order, await lastOrderHistoryId(orderId)), mutationKey: randomUUID() };
}
