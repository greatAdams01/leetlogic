import { prisma, type Prisma } from "@leetlogic/database";
import { createHash } from "node:crypto";
import { Shipbubble, type TrackedShipment } from "../providers/shipping/shipbubble.js";
import { canAdvanceDelivery, normalizeDeliveryStatus } from "./delivery-policy.js";
import { getConfig } from "../config.js";
import { logger } from "../lib/logger.js";
export const shippingProvider = new Shipbubble();
export const hashInput = (input: unknown) =>
  createHash("sha256").update(JSON.stringify(input)).digest("hex");
export function serialize(value: unknown) {
  return JSON.parse(JSON.stringify(value, (_key, v) => (typeof v === "bigint" ? v.toString() : v)));
}
export async function deliveryEvent(
  tx: Prisma.TransactionClient,
  deliveryId: string,
  status: string,
  source: string,
  dedupeKey: string,
  actorId?: string,
) {
  if (await tx.deliveryEvent.findUnique({ where: { dedupeKey } })) return;
  const event = await tx.deliveryEvent.create({
    data: { deliveryId, status, source, dedupeKey, actorId },
  });
  const delivery = await tx.delivery.findUniqueOrThrow({
    where: { id: deliveryId },
    include: { order: { include: { buyer: true, farmerProfile: { include: { user: true } } } } },
  });
  const recipients = [delivery.order.buyer, delivery.order.farmerProfile.user];
  await tx.deliveryNotification.createMany({
    data: recipients.map((user) => ({
      eventId: event.id,
      userId: user.id,
      orderId: delivery.orderId,
      locale: user.preferredLocale,
      messageKey: `status.${status}`,
    })),
    skipDuplicates: true,
  });
}
export async function applyTracking(deliveryId: string, tracked: TrackedShipment) {
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM deliveries WHERE id = ${deliveryId}::uuid FOR UPDATE`;
    const d = await tx.delivery.findUniqueOrThrow({ where: { id: deliveryId } });
    if (d.providerShipmentId !== tracked.id) throw new Error("SHIPMENT_MISMATCH");
    const next = normalizeDeliveryStatus(tracked.status);
    const advance = next && canAdvanceDelivery(d.status, next);
    await tx.delivery.update({
      where: { id: d.id },
      data: {
        ...(advance ? { status: next } : {}),
        lastSyncedAt: new Date(),
        nextSyncAt: new Date(Date.now() + 15 * 60000),
        leaseUntil: null,
        failureCode: null,
      },
    });
    if (next)
      await deliveryEvent(
        tx,
        d.id,
        next,
        "shipbubble",
        `${d.id}:provider:${next}:${hashInput(tracked.observedAt ?? next)}`,
      );
    // Carrier confirmation alone does not authorize escrow settlement.
    if (advance && next === "DELIVERED")
      await tx.shipment.updateMany({
        where: { orderId: d.orderId },
        data: {
          status: "DELIVERED",
          evidence: "Carrier delivery reported; recipient confirmation pending",
        },
      });
  });
}
export async function runDeliveryJobs() {
  const c = getConfig();
  if (!c.DELIVERY_ENABLED || !c.SHIPBUBBLE_API_KEY) return;
  // A crash during a paid booking is ambiguous. Never repeat that provider call automatically.
  await prisma.delivery.updateMany({
    where: { status: "BOOKING", leaseUntil: { lt: new Date() } },
    data: { status: "BOOKING_UNCERTAIN", failureCode: "BOOKING_RESULT_UNKNOWN", leaseUntil: null },
  });
  const queued = await prisma.delivery.findMany({ where: { status: "BOOKING_QUEUED" }, take: 5 });
  for (const d of queued) {
    const claimed = await prisma.delivery.updateMany({
      where: { id: d.id, status: "BOOKING_QUEUED" },
      data: {
        status: "BOOKING",
        bookingStartedAt: new Date(),
        leaseUntil: new Date(Date.now() + 60000),
      },
    });
    if (!claimed.count) continue;
    try {
      const quote = d.selectedQuoteId
        ? await prisma.deliveryQuote.findUnique({ where: { id: d.selectedQuoteId } })
        : null;
      const order = await prisma.tradeOrder.findUniqueOrThrow({ where: { id: d.orderId } });
      if (
        !quote ||
        quote.expiresAt <= new Date() ||
        d.paidMinor < quote.amountMinor ||
        order.status !== "FUNDED" ||
        order.financialHold
      ) {
        await prisma.delivery.update({
          where: { id: d.id },
          data: {
            status: "BOOKING_BLOCKED",
            failureCode: "QUOTE_OR_FUNDING_CHANGED",
            leaseUntil: null,
          },
        });
        continue;
      }
      if (
        (c.SHIPBUBBLE_MODE === "live" && !c.DELIVERY_LIVE_BOOKINGS) ||
        (order.fundsProvider === "bachs" &&
          (c.BACHS_MODE === "live") !== (c.SHIPBUBBLE_MODE === "live"))
      ) {
        await prisma.delivery.update({
          where: { id: d.id },
          data: {
            status: "BOOKING_BLOCKED",
            failureCode: "LIVE_BOOKING_DISABLED",
            leaseUntil: null,
          },
        });
        continue;
      }
      if (!quote.courierId) {
        await prisma.delivery.update({
          where: { id: d.id },
          data: {
            status: "BOOKING_BLOCKED",
            failureCode: "QUOTE_REFRESH_REQUIRED",
            leaseUntil: null,
          },
        });
        continue;
      }
      let wallet: bigint;
      try {
        wallet = await shippingProvider.wallet();
      } catch {
        await prisma.delivery.update({
          where: { id: d.id },
          data: {
            status: "BOOKING_BLOCKED",
            failureCode: "SHIPPING_WALLET_UNAVAILABLE",
            leaseUntil: null,
          },
        });
        continue;
      }
      if (wallet < (quote.walletMinor ?? quote.amountMinor)) {
        await prisma.delivery.update({
          where: { id: d.id },
          data: { status: "BOOKING_BLOCKED", failureCode: "SHIPPING_WALLET_LOW", leaseUntil: null },
        });
        continue;
      }
      const result = await shippingProvider.book({
        courierId: quote.courierId,
        requestToken: quote.requestToken,
        serviceCode: quote.serviceCode,
      });
      await prisma.$transaction(async (tx) => {
        await tx.delivery.update({
          where: { id: d.id },
          data: {
            providerShipmentId: result.id,
            trackingUrl: result.trackingUrl,
            courier: result.courier,
            status: "BOOKED",
            leaseUntil: null,
          },
        });
        await tx.shipment.upsert({
          where: { orderId: d.orderId },
          create: { orderId: d.orderId, carrier: result.courier, trackingRef: result.id },
          update: { carrier: result.courier, trackingRef: result.id },
        });
        if (order.fundsProvider === "bachs") {
          const cost = result.shippingMinor;
          if (cost !== undefined) {
            const { journal } = await import("./payments.js");
            const covered = cost > d.paidMinor ? d.paidMinor : cost;
            await journal(
              tx,
              `shipping-cost:${d.id}:${result.id}`,
              [
                [`held_shipping:${order.id}`, covered],
                ["shipping_variance_expense", cost - covered],
                ["shipping_wallet_asset", -cost],
              ],
              order.id,
            );
          }
          if (cost === undefined || cost !== (quote.walletMinor ?? quote.amountMinor)) {
            await tx.tradeOrder.update({ where: { id: order.id }, data: { financialHold: true } });
            await tx.delivery.update({
              where: { id: d.id },
              data: { failureCode: "SHIPPING_COST_REVIEW_REQUIRED" },
            });
          }
        }
        await deliveryEvent(tx, d.id, "BOOKED", "shipbubble", `${d.id}:booked`);
      });
    } catch {
      await prisma.delivery.update({
        where: { id: d.id },
        data: {
          status: "BOOKING_UNCERTAIN",
          failureCode: "BOOKING_RESULT_UNKNOWN",
          leaseUntil: null,
        },
      });
      logger.warn({ deliveryId: d.id }, "Delivery booking needs reconciliation");
    }
  }
  const tracking = await prisma.delivery.findMany({
    where: {
      providerShipmentId: { not: null },
      status: { notIn: ["CANCELLED", "RETURNED"] },
      nextSyncAt: { lte: new Date() },
      OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }],
    },
    take: 20,
  });
  for (const d of tracking) {
    const claimed = await prisma.delivery.updateMany({
      where: { id: d.id, OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }] },
      data: { leaseUntil: new Date(Date.now() + 60000) },
    });
    if (!claimed.count) continue;
    try {
      // Cancellation can be reconciled through tracking; never repeat a cancellation after uncertainty.
      if (d.cancelRequestedAt && !d.cancelAttemptedAt) {
        await prisma.delivery.update({
          where: { id: d.id },
          data: { failureCode: "CANCEL_RESULT_UNKNOWN", cancelAttemptedAt: new Date() },
        });
        await shippingProvider.cancel(d.providerShipmentId!);
      }
      await applyTracking(d.id, await shippingProvider.track(d.providerShipmentId!));
    } catch {
      await prisma.delivery.update({
        where: { id: d.id },
        data: {
          leaseUntil: null,
          nextSyncAt: new Date(Date.now() + 15 * 60000),
          failureCode: d.cancelRequestedAt ? "CANCEL_RESULT_UNKNOWN" : "TRACKING_UNAVAILABLE",
        },
      });
      logger.warn({ deliveryId: d.id }, "Delivery tracking delayed");
    }
  }
}
export function startDeliveryWorker() {
  let running = false;
  const timer = setInterval(() => {
    if (running) return;
    running = true;
    runDeliveryJobs()
      .catch(() => logger.error("Delivery worker failed"))
      .finally(() => {
        running = false;
      });
  }, 15000);
  timer.unref();
  return () => clearInterval(timer);
}
