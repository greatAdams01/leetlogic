import { bookSplitDelivery, recordedSplitBooking, trackSplitDelivery } from "./split-delivery.js";
import { prisma, type Delivery, type DeliveryQuote, type Prisma, type TradeOrder } from "@leetlogic/database";
import { createHash } from "node:crypto";
import { Shipbubble, type TrackedShipment } from "../providers/shipping/shipbubble.js";
import { canAdvanceDelivery, normalizeDeliveryStatus } from "./delivery-policy.js";
import { getConfig } from "../config.js";
import { logger } from "../lib/logger.js";
import { AppError } from "../lib/errors.js";
import { assertCurrentDeliveryQuote, shippingOrderInclude } from "./delivery-quote.js";
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

/** Call while holding the order lock, before any new provider booking. */
export async function assertNoDeliverySettlement(tx: Prisma.TransactionClient, orderId: string) {
  if (await hasDeliverySettlement(orderId, tx))
    throw new AppError(409, "PAYMENT_LOCKED", "This order cannot accept a payment right now.");
}
export async function hasDeliverySettlement(orderId: string, tx: Prisma.TransactionClient = prisma) {
  return !!(await tx.moneyOperation.count({ where: {
    orderId,
    kind: { in: ["RELEASE", "REFUND", "REFUND_TRANSFER", "REFUND_PAYOUT"] },
    status: { not: "FAILED" },
  } }));
}

/** Booked labels must always receive the same shipment and idempotent local accounting. */
export async function finalizeDeliveryBooking(
  tx: Prisma.TransactionClient,
  order: TradeOrder,
  delivery: Delivery,
  quote: DeliveryQuote,
  result: TrackedShipment,
  source = "shipbubble",
  actorId?: string,
) {
  if (delivery.providerShipmentId && delivery.providerShipmentId !== result.id)
    throw new Error("SHIPMENT_MISMATCH");
  const cost = result.shippingMinor;
  const review = result.requiresReview || result.courier !== quote.courier || order.status !== "FUNDED" || delivery.paidMinor < quote.amountMinor ||
    (order.fundsProvider === "bachs" && (cost === undefined || cost !== (quote.walletMinor ?? quote.amountMinor) ||
      order.status !== "FUNDED" || order.heldMinor !== order.totalMinor));
  await tx.delivery.update({
    where: { id: delivery.id },
    data: {
      providerShipmentId: result.id,
      trackingUrl: result.trackingUrl,
      courier: result.courier,
      status: "BOOKED",
      bookingStartedAt: delivery.bookingStartedAt || new Date(),
      failureCode: review ? "SHIPPING_COST_REVIEW_REQUIRED" : null,
      nextSyncAt: new Date(),
      leaseUntil: null,
    },
  });
  await tx.shipment.upsert({
    where: { orderId: order.id },
    create: { orderId: order.id, carrier: result.courier, trackingRef: result.id, status: "BOOKED" },
    update: { carrier: result.courier, trackingRef: result.id },
  });
  if (order.fundsProvider === "bachs" && cost !== undefined && cost > 0n) {
    const { journal } = await import("./payments.js");
    const covered = cost > delivery.paidMinor ? delivery.paidMinor : cost;
    await journal(tx, `shipping-cost:${delivery.id}:${result.id}`, [
      [`held_shipping:${order.id}`, covered],
      ["shipping_variance_expense", cost - covered],
      ["shipping_wallet_asset", -cost],
    ], order.id);
  }
  if (review) await tx.tradeOrder.update({ where: { id: order.id }, data: { financialHold: true } });
  await deliveryEvent(tx, delivery.id, "BOOKED", source, `${delivery.id}:booked`, actorId);
}
export async function applyTracking(deliveryId: string, tracked: TrackedShipment) {
  await prisma.$transaction(async (tx) => {
    const owner = await tx.delivery.findUniqueOrThrow({ where: { id: deliveryId }, select: { orderId: true } });
    await tx.$queryRaw`SELECT id FROM trade_orders WHERE id = ${owner.orderId}::uuid FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM deliveries WHERE id = ${deliveryId}::uuid FOR UPDATE`;
    const d = await tx.delivery.findUniqueOrThrow({ where: { id: deliveryId } });
    if (d.providerShipmentId !== tracked.id) throw new Error("SHIPMENT_MISMATCH");
    const next = normalizeDeliveryStatus(tracked.status);
    const advance = next && (canAdvanceDelivery(d.status, next) ||
      (d.providerShipmentId?.startsWith("split:") && tracked.requiresReview));
    const review = tracked.requiresReview || next === "RETURNING" || next === "RETURNED";
    await tx.delivery.update({
      where: { id: d.id },
      data: {
        ...(advance ? { status: next } : {}),
        lastSyncedAt: new Date(),
        nextSyncAt: new Date(Date.now() + 15 * 60000),
        leaseUntil: null,
        failureCode: review ? "PARTIAL_DELIVERY_REVIEW_REQUIRED" :
          ["SHIPPING_COST_REVIEW_REQUIRED", "PARTIAL_DELIVERY_REVIEW_REQUIRED"].includes(d.failureCode || "") ? d.failureCode : null,
      },
    });
    if (review) await tx.tradeOrder.update({ where: { id: d.orderId }, data: { financialHold: true } });
    if (next && (advance || d.status === next))
      await deliveryEvent(
        tx,
        d.id,
        next,
        "shipbubble",
        `${d.id}:provider:${next}:${hashInput(tracked.observedAt ?? next)}`,
      );
    // Carrier confirmation alone does not authorize escrow settlement.
    if (advance)
      await tx.shipment.updateMany({
        where: { orderId: d.orderId },
        data: {
          status: next,
          ...(next === "DELIVERED" ? { evidence: "Carrier delivery reported; recipient confirmation pending" } :
            review ? { evidence: "Carrier return or partial delivery reported; settlement review required" } : {}),
        },
      });
  });
}
export async function runDeliveryJobs() {
  const c = getConfig();
  if (!c.DELIVERY_ENABLED || !c.SHIPBUBBLE_API_KEY) return;
  // A crash during a paid booking is ambiguous. Never repeat that provider call automatically.
  await prisma.delivery.updateMany({
    where: { status: "BOOKING", leaseUntil: { lt: new Date() }, bookingStartedAt: null },
    data: { status: "BOOKING_QUEUED", leaseUntil: null },
  });
  await prisma.delivery.updateMany({
    where: { status: "BOOKING", leaseUntil: { lt: new Date() }, bookingStartedAt: { not: null } },
    data: { status: "BOOKING_UNCERTAIN", failureCode: "BOOKING_RESULT_UNKNOWN", leaseUntil: null },
  });
  // A fully recorded split can finish its local accounting after a crash without another provider booking.
  await prisma.delivery.updateMany({
    where: {
      status: "BOOKING_UNCERTAIN",
      providerShipmentId: { startsWith: "split:" },
      parcels: { some: {}, none: { providerShipmentId: null } },
    },
    data: { status: "BOOKING_QUEUED", failureCode: null },
  });
  const queued = await prisma.delivery.findMany({ where: { status: "BOOKING_QUEUED" }, take: 5 });
  for (const d of queued) {
    const claimed = await prisma.delivery.updateMany({
      where: { id: d.id, status: "BOOKING_QUEUED" },
      data: {
        status: "BOOKING",
        leaseUntil: new Date(Date.now() + 600000),
      },
    });
    if (!claimed.count) continue;
    try {
      const quote = d.selectedQuoteId
        ? await prisma.deliveryQuote.findUnique({ where: { id: d.selectedQuoteId } })
        : null;
      const order = await prisma.tradeOrder.findUniqueOrThrow({ where: { id: d.orderId }, include: shippingOrderInclude });
      const recorded = quote && d.providerShipmentId === `split:${d.id}`
        ? recordedSplitBooking(d.id, quote, await prisma.deliveryParcel.findMany({ where: { deliveryId: d.id } }))
        : null;
      if (recorded) {
        await prisma.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT id FROM trade_orders WHERE id = ${d.orderId}::uuid FOR UPDATE`;
          await tx.$queryRaw`SELECT id FROM deliveries WHERE id = ${d.id}::uuid FOR UPDATE`;
          const current = await tx.tradeOrder.findUniqueOrThrow({ where: { id: d.orderId }, include: { delivery: true } });
          if (!current.delivery || current.delivery.status !== "BOOKING" || current.delivery.selectedQuoteId !== quote!.id)
            throw new Error("SPLIT_QUOTE_CHANGED");
          const result = recordedSplitBooking(d.id, quote!, await tx.deliveryParcel.findMany({ where: { deliveryId: d.id } }));
          if (!result) throw new Error("SPLIT_QUOTE_CHANGED");
          await finalizeDeliveryBooking(tx, current, current.delivery, quote!, result);
        });
        continue;
      }
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
      try {
        assertCurrentDeliveryQuote(order, d, quote, { booking: true });
      } catch (error) {
        await prisma.delivery.update({ where: { id: d.id }, data: {
          status: "BOOKING_BLOCKED", failureCode: error instanceof AppError ? error.code : "QUOTE_REFRESH_REQUIRED", leaseUntil: null,
        } });
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
      // Recheck after the wallet read. Mark the irreversible booking boundary, not the worker claim.
      const checkBeforeBooking = async (tx: Prisma.TransactionClient) => {
        await tx.$queryRaw`SELECT id FROM trade_orders WHERE id = ${d.orderId}::uuid FOR UPDATE`;
        const current = await tx.tradeOrder.findUniqueOrThrow({ where: { id: d.orderId }, include: { ...shippingOrderInclude, delivery: true } });
        if (current.status !== "FUNDED" || current.financialHold || !current.delivery || current.delivery.status !== "BOOKING" || current.delivery.cancelRequestedAt || current.delivery.paidMinor < quote.amountMinor)
          throw new AppError(409, "BOOKING_NOT_READY", "Order changed before booking.");
        await assertNoDeliverySettlement(tx, d.orderId);
        assertCurrentDeliveryQuote(current, current.delivery, quote, { booking: true });
      };
      await prisma.$transaction(async (tx) => {
        await checkBeforeBooking(tx);
        if (d.bookingStartedAt && !d.providerShipmentId?.startsWith("split:"))
          throw new AppError(409, "BOOKING_RESULT_UNKNOWN", "Locate the existing booking before continuing.");
        await tx.delivery.update({ where: { id: d.id }, data: { bookingStartedAt: d.bookingStartedAt || new Date() } });
      });
      const result =
        (await bookSplitDelivery(shippingProvider, d.id, quote, checkBeforeBooking)) ??
        (await shippingProvider.book({
          courierId: quote.courierId,
          requestToken: quote.requestToken,
          serviceCode: quote.serviceCode,
        }));
      await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM trade_orders WHERE id = ${d.orderId}::uuid FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM deliveries WHERE id = ${d.id}::uuid FOR UPDATE`;
        const current = await tx.tradeOrder.findUniqueOrThrow({ where: { id: d.orderId }, include: { delivery: true } });
        await finalizeDeliveryBooking(tx, current, current.delivery!, quote, result);
      });
    } catch (error) {
      const current = await prisma.delivery.findUniqueOrThrow({ where: { id: d.id } });
      const uncertain = !!current.bookingStartedAt;
      await prisma.delivery.update({
        where: { id: d.id },
        data: {
          status: uncertain ? "BOOKING_UNCERTAIN" : "BOOKING_BLOCKED",
          failureCode: uncertain ? "BOOKING_RESULT_UNKNOWN" : error instanceof AppError ? error.code : "BOOKING_NOT_READY",
          leaseUntil: null,
        },
      });
      logger.warn({ deliveryId: d.id }, "Delivery booking needs reconciliation");
    }
  }
  const tracking = await prisma.delivery.findMany({
    where: {
      providerShipmentId: { not: null },
      status: {
        notIn: ["CANCELLED", "RETURNED", "BOOKING"],
      },
      nextSyncAt: { lte: new Date() },
      AND: [
        { OR: [
          { status: { notIn: ["BOOKING_UNCERTAIN", "BOOKING_BLOCKED"] } },
          { cancelRequestedAt: { not: null }, providerShipmentId: { startsWith: "split:" } },
        ] },
        { OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }] },
      ],
    },
    take: 20,
  });
  for (const d of tracking) {
    const claimed = await prisma.delivery.updateMany({
      where: { id: d.id, OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }] },
      data: { leaseUntil: new Date(Date.now() + 600000) },
    });
    if (!claimed.count) continue;
    try {
      if (d.providerShipmentId?.startsWith("split:")) {
        await applyTracking(
          d.id,
          await trackSplitDelivery(shippingProvider, d.id, !!d.cancelRequestedAt),
        );
        continue;
      }
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
