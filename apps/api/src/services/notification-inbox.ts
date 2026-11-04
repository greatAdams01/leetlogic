import { prisma, type Prisma } from "@leetlogic/database";
import { getConfig } from "../config.js";
import { recoveryEnabled } from "./fulfillment-deadline.js";
export async function notificationInbox(userId: string, seller: boolean) {
  const readThrough = new Date();
  const recoveryOrders =
    seller && recoveryEnabled()
      ? await prisma.paymentRecovery.findMany({
          where: { mode: getConfig().BACHS_MODE },
          select: { orderId: true },
        })
      : [];
  const deliveryWhere: Prisma.DeliveryNotificationWhereInput = {
    userId,
    event: {
      delivery: {
        order: seller
          ? {
              farmerProfile: { userId },
              OR: [
                {
                  ledger: { some: { kind: "FUND" } },
                  status: { notIn: ["AWAITING_PAYMENT", "CANCELLED"] },
                },
                { id: { in: recoveryOrders.map((r) => r.orderId) } },
              ],
            }
          : { buyerId: userId },
      },
    },
  };
  const paidWhere: Prisma.PaidOrderNotificationWhereInput = {
    userId,
    order: {
      farmerProfile: { userId },
      ledger: { some: { kind: "FUND" } },
      status: { notIn: ["AWAITING_PAYMENT", "CANCELLED"] },
    },
  };
  const [delivery, paid, approved, deliveryUnread, paidUnread, listingUnread] = await Promise.all([
    prisma.deliveryNotification.findMany({
      where: deliveryWhere,
      select: {
        id: true,
        orderId: true,
        messageKey: true,
        createdAt: true,
        readAt: true,
        event: {
          select: {
            status: true,
            delivery: {
              select: {
                order: { select: { reference: true, listing: { select: { title: true } } } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    seller
      ? prisma.paidOrderNotification.findMany({
          where: paidWhere,
          select: {
            id: true,
            orderId: true,
            createdAt: true,
            readAt: true,
            order: { select: { reference: true, listing: { select: { title: true } } } },
          },
          orderBy: { createdAt: "desc" },
          take: 50,
        })
      : [],
    seller
      ? prisma.listingApprovalNotification.findMany({
          where: { userId },
          select: { id: true, listingId: true, title: true, createdAt: true, readAt: true },
          orderBy: { createdAt: "desc" },
          take: 50,
        })
      : [],
    prisma.deliveryNotification.count({ where: { ...deliveryWhere, readAt: null } }),
    seller ? prisma.paidOrderNotification.count({ where: { ...paidWhere, readAt: null } }) : 0,
    seller ? prisma.listingApprovalNotification.count({ where: { userId, readAt: null } }) : 0,
  ]);
  const items = [
    ...delivery.map(({ event, ...n }) => ({
      ...n,
      status: event.status,
      orderReference: event.delivery.order.reference,
      produceTitle: event.delivery.order.listing.title,
    })),
    ...paid.map(({ order, ...n }) => ({
      ...n,
      messageKey: "order.paid",
      status: "PAYMENT_CONFIRMED",
      orderReference: order.reference,
      produceTitle: order.listing.title,
    })),
    ...approved.map((n) => ({
      ...n,
      messageKey: "listing.approved",
      status: "APPROVED",
      produceTitle: n.title,
    })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 50);
  return { items, readThrough, unreadCount: deliveryUnread + paidUnread + listingUnread };
}
export async function readNotifications(userId: string, ids?: string[], through?: Date) {
  const scope = ids ? { id: { in: ids } } : { createdAt: { lte: through! } };
  await prisma.$transaction([
    prisma.deliveryNotification.updateMany({
      where: { userId, ...scope, readAt: null },
      data: { readAt: new Date() },
    }),
    prisma.paidOrderNotification.updateMany({
      where: { userId, ...scope, readAt: null },
      data: { readAt: new Date() },
    }),
    prisma.listingApprovalNotification.updateMany({
      where: { userId, ...scope, readAt: null },
      data: { readAt: new Date() },
    }),
  ]);
}
