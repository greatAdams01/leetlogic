import { sendOrderUpdateNotifications } from "./order-notifications.js";
import { assertFulfillmentOpen, markFulfillmentSecured } from "./fulfillment-deadline.js";
import { bookSplitDelivery, recordedSplitBooking, trackSplitDelivery } from "./split-delivery.js";
import { prisma, type Delivery, type DeliveryQuote, type Prisma, type TradeOrder } from "@leetlogic/database";
import { createHash, randomUUID } from "node:crypto";
import { Shipbubble, type TrackedShipment } from "../providers/shipping/shipbubble.js";
import { canAdvanceDelivery, normalizeDeliveryStatus } from "./delivery-policy.js";
import { getConfig } from "../config.js";
import { logger } from "../lib/logger.js";
import { AppError } from "../lib/errors.js";
import { assertCurrentDeliveryQuote, assertNoActiveCheckout, shippingOrderInclude, storedDeliveryInput } from "./delivery-quote.js";
import { recordProviderTracking, trackedStatusTime, trackedUrl } from "./delivery-tracking.js";
export const shippingProvider = new Shipbubble();
const bookingRetryMs = 5 * 60000;
// Only failures before the irreversible label purchase are eligible for automatic retry.
const bookingRetryCodes = [
  "QUOTE_EXPIRED", "QUOTE_OR_FUNDING_CHANGED", "QUOTES_UNAVAILABLE", "BOOKING_NOT_READY",
  "BOOKING_DISABLED", "LIVE_BOOKING_DISABLED", "DELIVERY_UNAVAILABLE",
  "SHIPPING_WALLET_UNAVAILABLE", "SHIPPING_WALLET_LOW", "DELIVERY_PROVIDER_UNAVAILABLE",
  "SHIPBUBBLE_RESPONSE_INVALID", "NO_DELIVERY_OPTIONS", "NO_COMPATIBLE_DELIVERY_OPTIONS",
];
export const hashInput = (input: unknown) =>
  createHash("sha256").update(JSON.stringify(input)).digest("hex");
export function serialize(value: unknown) {
  return JSON.parse(JSON.stringify(value, (key, v) => key === "receiptPhotoKey" ? undefined : (typeof v === "bigint" ? v.toString() : v)));
}
export async function deliveryEvent(
  tx: Prisma.TransactionClient,
  deliveryId: string,
  status: string,
  source: string,
  dedupeKey: string,
  actorId?: string,
  details?: Prisma.InputJsonValue,
) {
  if (await tx.deliveryEvent.findUnique({ where: { dedupeKey } })) return;
  const event = await tx.deliveryEvent.create({
    data: { deliveryId, status, source, dedupeKey, actorId, ...(details === undefined ? {} : { details }) },
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

export async function queueBooking(orderId: string) {
  const c = getConfig();
  if (!c.DELIVERY_ENABLED || (c.SHIPBUBBLE_MODE === "live" && !c.DELIVERY_LIVE_BOOKINGS))
    throw new AppError(503, "BOOKING_DISABLED", "Delivery booking is disabled");
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM trade_orders WHERE id = ${orderId}::uuid FOR UPDATE`;
    const order = await tx.tradeOrder.findUniqueOrThrow({
      where: { id: orderId }, include: { ...shippingOrderInclude, delivery: true },
    });
    const d = order.delivery;
    if (order.farmerDecision === "PENDING" || order.farmerDecision === "REJECTED")
      throw new AppError(409, "FARMER_ACCEPTANCE_REQUIRED", "Wait for the farmer to accept the order.");
    if (!d) throw new AppError(409, "QUOTE_REQUIRED", "Choose delivery first");
    if (order.journeyVersion >= 2 && !(await tx.deliveryEvent.count({ where: { deliveryId: d.id, status: "READY_FOR_PICKUP" } })))
      throw new AppError(409, "FARMER_PREPARATION_REQUIRED", "Wait for the farmer to pack the goods.");
    await assertNoDeliverySettlement(tx, orderId);
    await assertFulfillmentOpen(tx, orderId);
    if (["BOOKING_QUEUED", "BOOKING", "BOOKING_UNCERTAIN", "BOOKED", "PICKED_UP", "IN_TRANSIT", "DELIVERED"].includes(d.status)) return;
    if (d.failureCode === "DELIVERY_PRICE_CHANGED")
      throw new AppError(409, "DELIVERY_PRICE_CHANGED", "Review the renewed delivery quote before continuing. Your payment remains confirmed.");
    const quote = d.selectedQuoteId ? await tx.deliveryQuote.findUnique({ where: { id: d.selectedQuoteId } }) : null;
    if (order.status !== "FUNDED" || order.financialHold || d.providerShipmentId || d.bookingStartedAt || d.cancelRequestedAt || !quote || d.paidMinor < quote.amountMinor)
      throw new AppError(409, "BOOKING_NOT_READY", "Fund the order and confirm payment for a current delivery quote");
    // Checkout expiry is not a farmer-confirmation deadline. The claimed worker must
    // renew an expired rate before purchasing a label; shipment integrity still applies.
    assertCurrentDeliveryQuote(order, d, quote, { booking: true, allowExpired: true });
    await assertNoActiveCheckout(tx, orderId);
    await tx.delivery.update({ where: { id: d.id }, data: { status: "BOOKING_QUEUED", failureCode: null } });
    await deliveryEvent(tx, d.id, "BOOKING_QUEUED", "system", `${d.id}:queued:${quote.id}`);
  });
}

/** Recovery of the durable PAID state is independent of payment confirmation. No provider write here. */
export async function queuePaidDelivery(orderId: string) {
  const d = await prisma.delivery.findFirst({ where: {
    orderId, status: { in: ["PAID", "BOOKING_BLOCKED"] }, selectedQuoteId: { not: null },
    providerShipmentId: null, bookingStartedAt: null,
  } });
  if (!d) return;
  try {
    await queueBooking(orderId);
  } catch (error) {
    const reason = error instanceof AppError ? error.code : "BOOKING_NOT_READY";
    if (["FARMER_ACCEPTANCE_REQUIRED", "FARMER_PREPARATION_REQUIRED"].includes(reason)) {
      // Rotate waiting orders so a page of slow farmer confirmations cannot starve ready orders.
      await prisma.delivery.updateMany({ where: {
        id: d.id, status: { in: ["PAID", "BOOKING_BLOCKED"] }, selectedQuoteId: d.selectedQuoteId, updatedAt: d.updatedAt,
        providerShipmentId: null, bookingStartedAt: null,
      }, data: { nextSyncAt: new Date(Date.now() + 30000) } });
      return;
    }
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM trade_orders WHERE id = ${orderId}::uuid FOR UPDATE`;
      const changed = await tx.delivery.updateMany({ where: {
        id: d.id, status: { in: ["PAID", "BOOKING_BLOCKED"] }, selectedQuoteId: d.selectedQuoteId, updatedAt: d.updatedAt,
        providerShipmentId: null, bookingStartedAt: null,
      }, data: { status: "BOOKING_BLOCKED", failureCode: reason, nextSyncAt: new Date(Date.now() + bookingRetryMs) } });
      if (changed.count) await deliveryEvent(tx, d.id, "BOOKING_BLOCKED", "system", `${d.id}:blocked:${d.selectedQuoteId}:${reason}`);
    });
    logger.warn({ deliveryId: d.id, reason }, "Paid delivery is awaiting booking; payment remains confirmed");
  }
}

function assertUnchangedBookingQuote(current: DeliveryQuote | null, selected: DeliveryQuote) {
  if (!current || current.requestToken !== selected.requestToken ||
    current.inputHash !== selected.inputHash || current.courierId !== selected.courierId ||
    current.serviceCode !== selected.serviceCode || current.courier !== selected.courier ||
    current.amountMinor !== selected.amountMinor || current.walletMinor !== selected.walletMinor)
    throw new AppError(409, "STALE_DELIVERY_QUOTE", "The selected delivery quote changed before booking.");
  return current;
}

/** Renew only an untouched paid shipment, under the booking worker's existing claim. */
async function renewBookingQuote(delivery: Delivery, selected: DeliveryQuote, leaseUntil: Date) {
  const quoteRequestId = randomUUID();
  const check = async (tx: Prisma.TransactionClient, response = false) => {
    await tx.$queryRaw`SELECT id FROM trade_orders WHERE id = ${delivery.orderId}::uuid FOR UPDATE`;
    const order = await tx.tradeOrder.findUniqueOrThrow({
      where: { id: delivery.orderId }, include: { ...shippingOrderInclude, delivery: true },
    });
    const d = order.delivery;
    if (order.status !== "FUNDED" || order.financialHold || ["PENDING", "REJECTED"].includes(order.farmerDecision) ||
      !d || d.status !== "BOOKING" || d.leaseUntil?.getTime() !== leaseUntil.getTime() || leaseUntil <= new Date() ||
      d.providerShipmentId || d.bookingStartedAt || d.cancelRequestedAt || d.selectedQuoteId !== selected.id ||
      d.paidMinor !== delivery.paidMinor || d.paidMinor < selected.amountMinor ||
      (order.fundsProvider === "bachs" && order.heldMinor !== order.totalMinor) ||
      (response && (d.package as { quoteRequestId?: string } | null)?.quoteRequestId !== quoteRequestId))
      throw new AppError(409, "BOOKING_NOT_READY", "Order changed before delivery quote renewal.");
    if (order.journeyVersion >= 2 && !(await tx.deliveryEvent.count({ where: { deliveryId: d.id, status: "READY_FOR_PICKUP" } })))
      throw new AppError(409, "FARMER_PREPARATION_REQUIRED", "Wait for the farmer to pack the goods.");
    if (await tx.deliveryParcel.count({ where: { deliveryId: d.id } }))
      throw new AppError(409, "BOOKING_RESULT_UNKNOWN", "Reconcile the existing parcel plan before renewing delivery.");
    await assertNoDeliverySettlement(tx, order.id);
    await assertFulfillmentOpen(tx, order.id);
    await assertNoActiveCheckout(tx, order.id);
    const currentQuote = assertUnchangedBookingQuote(
      await tx.deliveryQuote.findUnique({ where: { id: selected.id } }), selected,
    );
    // Never rederive a different address, date or packing basis automatically after payment.
    assertCurrentDeliveryQuote(order, d, currentQuote, { booking: true, allowExpired: true });
    return { order, delivery: d };
  };
  const prepared = await prisma.$transaction(async tx => {
    const current = await check(tx);
    await tx.delivery.update({ where: { id: delivery.id }, data: {
      package: { ...(current.delivery.package as Prisma.JsonObject), quoteRequestId },
    } });
    return {
      ...current, input: storedDeliveryInput(current.delivery),
      expiresAt: new Date(Date.now() + 15 * 60000),
    };
  });
  // Rate requests do not buy labels or create payment attempts and can safely be repeated.
  const rates = await shippingProvider.quotes({
    ...prepared.input, name: prepared.order.listing.title, valueMinor: prepared.order.totalMinor,
  });
  const rate = rates.find(item => item.courierId === selected.courierId &&
    item.serviceCode === selected.serviceCode && item.courier === selected.courier);
  if (!rate)
    throw new AppError(409, "NO_DELIVERY_OPTIONS", "The selected courier service is temporarily unavailable. Delivery will retry without changing your payment.");
  return prisma.$transaction(async tx => {
    const current = await check(tx, true);
    const quote = await tx.deliveryQuote.create({ data: {
      deliveryId: delivery.id, ...rate, inputHash: selected.inputHash, expiresAt: prepared.expiresAt,
    } });
    assertCurrentDeliveryQuote(current.order, current.delivery, quote, { selected: false, booking: true });
    const changedPrice = quote.amountMinor !== selected.amountMinor ||
      (quote.walletMinor ?? quote.amountMinor) !== (selected.walletMinor ?? selected.amountMinor);
    if (changedPrice) {
      // Keep the paid/agreed selection and receipt immutable. Save the observed rate for
      // explicit buyer/staff reconciliation, but never purchase, top up or refund here.
      await tx.delivery.update({ where: { id: delivery.id }, data: {
        status: "BOOKING_BLOCKED", failureCode: "DELIVERY_PRICE_CHANGED", leaseUntil: null,
        nextSyncAt: new Date(Date.now() + bookingRetryMs),
      } });
      await deliveryEvent(tx, delivery.id, "BOOKING_BLOCKED", "system", `${delivery.id}:blocked:${selected.id}:DELIVERY_PRICE_CHANGED`);
      logger.warn({ deliveryId: delivery.id, quoteId: selected.id, renewedQuoteId: quote.id }, "Renewed delivery price requires explicit reconciliation; payment remains confirmed");
      return null;
    }
    const renewed = await tx.delivery.update({ where: { id: delivery.id }, data: {
      selectedQuoteId: quote.id, failureCode: null,
    } });
    await deliveryEvent(tx, delivery.id, "QUOTE_REFRESHED", "system", `${delivery.id}:quote-refreshed:${selected.id}`);
    return { order: current.order, delivery: renewed, quote };
  });
}

/** A stale worker must not overwrite a newer claim, manual refresh or completed booking. */
async function deferBooking(delivery: Delivery, leaseUntil: Date, error: unknown) {
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM trade_orders WHERE id = ${delivery.orderId}::uuid FOR UPDATE`;
    const current = await tx.delivery.findUniqueOrThrow({ where: { id: delivery.id } });
    if (current.status !== "BOOKING" || current.leaseUntil?.getTime() !== leaseUntil.getTime()) return;
    const uncertain = !!current.bookingStartedAt;
    const status = uncertain ? "BOOKING_UNCERTAIN" : "BOOKING_BLOCKED";
    const reason = uncertain ? "BOOKING_RESULT_UNKNOWN" : error instanceof AppError ? error.code : "BOOKING_NOT_READY";
    await tx.delivery.update({ where: { id: current.id }, data: {
      status, failureCode: reason, leaseUntil: null, nextSyncAt: new Date(Date.now() + bookingRetryMs),
    } });
    await deliveryEvent(tx, current.id, status, "system", `${current.id}:${status.toLowerCase()}:${current.selectedQuoteId}:${reason}`);
    logger.warn({ deliveryId: current.id, reason }, uncertain
      ? "Delivery booking needs reconciliation; provider purchase will not be repeated"
      : "Paid delivery is awaiting booking; payment remains confirmed");
  });
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
      trackingUrl: trackedUrl(result),
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
  if (!review) await markFulfillmentSecured(tx, order.id);
  if (review) await tx.tradeOrder.update({ where: { id: order.id }, data: { financialHold: true } });
  await deliveryEvent(tx, delivery.id, "BOOKED", source, `${delivery.id}:booked`, actorId);
  await deliveryEvent(tx, delivery.id, "COURIER_ASSIGNED", source, `${delivery.id}:courier-assigned`, actorId);
  if (!result.id.startsWith("split:")) await recordProviderTracking(tx, delivery.id, result);
}
export async function applyTracking(deliveryId: string, tracked: TrackedShipment) {
  await prisma.$transaction(async (tx) => {
    const owner = await tx.delivery.findUniqueOrThrow({ where: { id: deliveryId }, select: { orderId: true } });
    await tx.$queryRaw`SELECT id FROM trade_orders WHERE id = ${owner.orderId}::uuid FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM deliveries WHERE id = ${deliveryId}::uuid FOR UPDATE`;
    const d = await tx.delivery.findUniqueOrThrow({ where: { id: deliveryId } });
    if (d.providerShipmentId !== tracked.id) throw new Error("SHIPMENT_MISMATCH");
    const next = normalizeDeliveryStatus(tracked.status);
    const observedAt = next ? trackedStatusTime(tracked, next) : undefined;
    const advance = next && (canAdvanceDelivery(d.status, next) ||
      (d.providerShipmentId?.startsWith("split:") && tracked.requiresReview && d.status !== next));
    const review = tracked.requiresReview || next === "RETURNING" || next === "RETURNED";
    if (!tracked.id.startsWith("split:")) await recordProviderTracking(tx, d.id, tracked);
    await tx.delivery.update({
      where: { id: d.id },
      data: {
        ...(advance ? { status: next } : {}),
        ...(tracked.trackingUrl ? { trackingUrl: trackedUrl(tracked) } : {}),
        lastSyncedAt: new Date(),
        nextSyncAt: new Date(Date.now() + 15 * 60000),
        leaseUntil: null,
        failureCode: review ? "PARTIAL_DELIVERY_REVIEW_REQUIRED" :
          ["SHIPPING_COST_REVIEW_REQUIRED", "PARTIAL_DELIVERY_REVIEW_REQUIRED"].includes(d.failureCode || "") ? d.failureCode : null,
      },
    });
    if (review) await tx.tradeOrder.update({ where: { id: d.orderId }, data: { financialHold: true } });
    if (next && advance)
      await deliveryEvent(
        tx,
        d.id,
        next,
        "shipbubble",
        `${d.id}:provider:${next}:${hashInput({ observedAt: observedAt || null, previous: d.status, revision: d.updatedAt })}`,
        undefined,
        { providerShipmentId: tracked.id, ...(observedAt ? { providerTime: observedAt } : {}) },
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
  // Funding commits PAID before booking is attempted. Recover a crash or missed post-commit callback.
  const paid = await prisma.delivery.findMany({ where: {
    providerShipmentId: null, bookingStartedAt: null, nextSyncAt: { lte: new Date() },
    OR: [
      { status: "PAID" },
      { status: "BOOKING_BLOCKED", failureCode: { in: bookingRetryCodes } },
    ],
  }, orderBy: { nextSyncAt: "asc" }, take: 10 });
  for (const d of paid) await queuePaidDelivery(d.orderId);
  // Expired pre-purchase claims are safe to recover. An attempted label purchase is not.
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
  for (const queuedDelivery of queued) {
    const leaseUntil = new Date(Date.now() + 600000);
    const claimed = await prisma.delivery.updateMany({
      where: { id: queuedDelivery.id, status: "BOOKING_QUEUED" },
      data: {
        status: "BOOKING",
        leaseUntil,
      },
    });
    if (!claimed.count) continue;
    let d = await prisma.delivery.findUniqueOrThrow({ where: { id: queuedDelivery.id } });
    if (d.status !== "BOOKING" || d.leaseUntil?.getTime() !== leaseUntil.getTime()) continue;
    try {
      let quote = d.selectedQuoteId
        ? await prisma.deliveryQuote.findUnique({ where: { id: d.selectedQuoteId } })
        : null;
      let order = await prisma.tradeOrder.findUniqueOrThrow({ where: { id: d.orderId }, include: shippingOrderInclude });
      const recorded = quote && d.providerShipmentId === `split:${d.id}`
        ? recordedSplitBooking(d.id, quote, await prisma.deliveryParcel.findMany({ where: { deliveryId: d.id } }))
        : null;
      if (recorded) {
        await prisma.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT id FROM trade_orders WHERE id = ${d.orderId}::uuid FOR UPDATE`;
          await tx.$queryRaw`SELECT id FROM deliveries WHERE id = ${d.id}::uuid FOR UPDATE`;
          const current = await tx.tradeOrder.findUniqueOrThrow({ where: { id: d.orderId }, include: { delivery: true } });
          if (!current.delivery || current.delivery.status !== "BOOKING" || current.delivery.selectedQuoteId !== quote!.id || current.delivery.leaseUntil?.getTime() !== leaseUntil.getTime())
            throw new Error("SPLIT_QUOTE_CHANGED");
          const result = recordedSplitBooking(d.id, quote!, await tx.deliveryParcel.findMany({ where: { deliveryId: d.id } }));
          if (!result) throw new Error("SPLIT_QUOTE_CHANGED");
          await finalizeDeliveryBooking(tx, current, current.delivery, quote!, result);
        });
        continue;
      }
      if (
        !quote ||
        d.paidMinor < quote.amountMinor ||
        order.status !== "FUNDED" ||
        order.financialHold || ["PENDING", "REJECTED"].includes(order.farmerDecision)
      ) {
        await deferBooking(d, leaseUntil, new AppError(409, "QUOTE_OR_FUNDING_CHANGED", "Delivery quote or funding changed before booking."));
        continue;
      }
      if (
        (c.SHIPBUBBLE_MODE === "live" && !c.DELIVERY_LIVE_BOOKINGS) ||
        (order.fundsProvider === "bachs" &&
          (c.BACHS_MODE === "live") !== (c.SHIPBUBBLE_MODE === "live"))
      ) {
        await deferBooking(d, leaseUntil, new AppError(503, "LIVE_BOOKING_DISABLED", "Delivery booking is disabled in this environment."));
        continue;
      }
      if (!quote.courierId) {
        await deferBooking(d, leaseUntil, new AppError(409, "QUOTE_REFRESH_REQUIRED", "The saved quote requires review before booking."));
        continue;
      }
      try {
        assertCurrentDeliveryQuote(order, d, quote, { booking: true, allowExpired: true });
      } catch (error) {
        await deferBooking(d, leaseUntil, error);
        continue;
      }
      if (quote.expiresAt.getTime() <= Date.now() + 60000) {
        const renewed = await renewBookingQuote(d, quote, leaseUntil);
        if (!renewed) continue;
        d = renewed.delivery;
        quote = renewed.quote;
        order = renewed.order;
      }
      let wallet: bigint;
      try {
        wallet = await shippingProvider.wallet();
      } catch {
        await deferBooking(d, leaseUntil, new AppError(503, "SHIPPING_WALLET_UNAVAILABLE", "The shipping wallet balance could not be verified."));
        continue;
      }
      if (wallet < (quote.walletMinor ?? quote.amountMinor)) {
        await deferBooking(d, leaseUntil, new AppError(503, "SHIPPING_WALLET_LOW", "The shipping wallet needs funding before booking."));
        continue;
      }
      // Recheck after the wallet read. Mark the irreversible booking boundary, not the worker claim.
      const checkBeforeBooking = async (tx: Prisma.TransactionClient) => {
        await tx.$queryRaw`SELECT id FROM trade_orders WHERE id = ${d.orderId}::uuid FOR UPDATE`;
        const current = await tx.tradeOrder.findUniqueOrThrow({ where: { id: d.orderId }, include: { ...shippingOrderInclude, delivery: true } });
        if (["PENDING", "REJECTED"].includes(current.farmerDecision) || current.status !== "FUNDED" || current.financialHold || !current.delivery || current.delivery.status !== "BOOKING" || current.delivery.leaseUntil?.getTime() !== leaseUntil.getTime() || leaseUntil <= new Date() || current.delivery.cancelRequestedAt || current.delivery.paidMinor < quote!.amountMinor || (current.fundsProvider === "bachs" && current.heldMinor !== current.totalMinor))
          throw new AppError(409, "BOOKING_NOT_READY", "Order changed before booking.");
        if (current.journeyVersion >= 2 && !(await tx.deliveryEvent.count({ where: { deliveryId: d.id, status: "READY_FOR_PICKUP" } })))
          throw new AppError(409, "FARMER_PREPARATION_REQUIRED", "The farmer must mark the goods ready.");
        await assertNoDeliverySettlement(tx, d.orderId);
        await assertFulfillmentOpen(tx, d.orderId);
        await assertNoActiveCheckout(tx, d.orderId);
        const currentQuote = assertUnchangedBookingQuote(
          await tx.deliveryQuote.findUnique({ where: { id: quote!.id } }), quote!,
        );
        assertCurrentDeliveryQuote(current, current.delivery, currentQuote, { booking: true });
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
          courierId: quote.courierId!,
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
      await deferBooking(d, leaseUntil, error);
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
          { cancelRequestedAt: { not: null }, providerShipmentId: { not: null } },
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
  let notifying = false;
  const timer = setInterval(() => {
    // Push gateway latency must never delay booking or tracking reconciliation.
    if (!notifying) {
      notifying = true;
      void sendOrderUpdateNotifications()
        .catch(() => logger.warn("Order notification worker will retry"))
        .finally(() => { notifying = false; });
    }
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
