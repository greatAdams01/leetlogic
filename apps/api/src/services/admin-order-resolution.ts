import { paymentReady } from "../providers/payments/bachs.js";
import { canResumeResolutionOperations } from "./order-resolution-policy.js";
import type { Request } from "express";
import { z } from "zod";
import { AppError } from "../lib/errors.js";
import { adminMutationSchema, mutateAdminOrder } from "./admin-order-management.js";
import { assertNoActiveCheckout } from "./delivery-quote.js";
import { deliveryEvent } from "./delivery.js";
import { mode, requestRelease, requestRefund } from "./payments.js";
import { settleManualBalance } from "./manual-escrow.js";

export const resolutionSchema = adminMutationSchema.extend({
  outcome: z.enum(["COMPLETED", "CANCELLED"]),
  financialAction: z.enum(["RELEASE", "REFUND", "HOLD", "NONE"]),
  evidence: z.string().trim().min(10).max(500),
  confirmed: z.literal(true),
  // Delivery fees need explicit review: courier costs already incurred cannot be refunded twice.
  shippingRefundMinor: z.string().regex(/^(0|[1-9]\d{0,17})$/).default("0"),
  destinationId: z.string().uuid().optional(),
}).strict().superRefine((body, ctx) => {
  if (body.financialAction === "RELEASE" && body.outcome !== "COMPLETED" || body.financialAction === "REFUND" && body.outcome !== "CANCELLED")
    ctx.addIssue({ code: "custom", message: "Release requires completion; refund requires cancellation." });
  if (body.financialAction !== "REFUND" && body.shippingRefundMinor !== "0")
    ctx.addIssue({ code: "custom", message: "Delivery refunds require the refund outcome." });
});

export async function resolveAdminOrder(req: Request, orderId: string) {
  if (req.auth?.subject !== "admin" || !req.auth.permissions?.includes("payments.manage"))
    throw new AppError(403, "FORBIDDEN", "Payment management permission is required to resolve an order.");
  const age = req.auth.stepUpAt ? Math.floor(Date.now() / 1000) - req.auth.stepUpAt : Infinity;
  if (age < 0 || age > 300) throw new AppError(403, "STEP_UP_REQUIRED", "Confirm resolution with a recent authenticator code.");
  const body = resolutionSchema.parse(req.body);
  req.body = body;
  return mutateAdminOrder(req, orderId, "order.admin.resolved", body, async (tx, order) => {
    if (body.financialAction === "REFUND" && BigInt(body.shippingRefundMinor) > 0n) {
      const shipping = await tx.moneyJournalLine.aggregate({ where: { account: `held_shipping:${orderId}`, journal: { mode: mode() } }, _sum: { amountMinor: true } });
      if (BigInt(body.shippingRefundMinor) > -(shipping._sum.amountMinor || 0n))
        throw new AppError(409, "SHIPPING_REFUND_UNAVAILABLE", "Only unspent delivery funds can be refunded here. Courier charges already incurred require a separate financial review.");
    }
    if (body.financialAction === "REFUND" && order.fundsProvider === "bachs" && await tx.paymentAttempt.count({ where: { orderId, mode: mode(), status: "SUCCEEDED", method: { contains: "TRANSFER", mode: "insensitive" } } })) {
      const bank = body.destinationId && await tx.bankDestination.findFirst({ where: { id: body.destinationId, userId: order.buyerId, mode: mode(), usable: true } });
      if (!bank) throw new AppError(409, "BUYER_BANK_REQUIRED", "Choose the buyer’s approved original-payer bank account, or hold the payment until it is verified.");
    }
    if (body.financialAction === "REFUND" && order.fundsProvider === "bachs") {
      const verified = await tx.paymentAttempt.findMany({ where: { orderId, mode: mode(), status: "SUCCEEDED", confirmedAt: { not: null } }, select: { produceMinor: true } });
      if (verified.reduce((sum, payment) => sum + payment.produceMinor, 0n) !== order.heldMinor)
        throw new AppError(409, "REFUND_RECONCILIATION_REQUIRED", "Verify the original payment and held balance before refunding, or hold payment for review.");
    }
    const previous = order.adminResolution as { outcome?: string; financialAction?: string } | null;
    // A hold may be revisited after investigation. Never reverse a submitted or completed settlement.
    const money = await tx.moneyOperation.findMany({ where: { orderId, kind: { in: ["RELEASE", "REFUND", "REFUND_TRANSFER", "REFUND_PAYOUT"] }, status: { not: "FAILED" } } });
    if (body.financialAction !== "HOLD") {
      await assertNoActiveCheckout(tx, orderId);
      if (body.financialAction !== "NONE" && order.delivery?.bookingStartedAt && !order.delivery.providerShipmentId)
        throw new AppError(409, "BOOKING_OUTCOME_UNKNOWN", "The courier booking cost is not confirmed. Hold payment while the booking is reconciled.");
      if (money.length && !canResumeResolutionOperations(money, body.financialAction)) throw new AppError(409, "SETTLEMENT_EXISTS", "A settlement already exists. Reconcile it before requesting another financial outcome; you can close the case with funds held for review.");
      if (body.financialAction === "REFUND" && canResumeResolutionOperations(money, "REFUND")) {
        const shipping = money.reduce((sum, operation) => sum + BigInt((operation.payload as { shippingMinor?: string }).shippingMinor || "0"), 0n);
        if (shipping !== BigInt(body.shippingRefundMinor) || money.some(operation => operation.kind === "REFUND_TRANSFER" && (operation.payload as { destinationId?: string }).destinationId !== body.destinationId))
          throw new AppError(409, "REFUND_REQUEST_CHANGED", "Resume the paused refund’s original amount and approved account; its existing payment identity cannot be changed.");
      }
      if (body.financialAction !== "NONE" && (order.heldMinor <= 0n || order.heldMinor !== order.totalMinor || order.releasedMinor > 0n || order.refundedMinor > 0n))
        throw new AppError(409, "SETTLEMENT_RECONCILIATION_REQUIRED", "A full, unsettled held balance is required. Review prior releases and refunds.");
      if (body.financialAction !== "NONE" && await tx.supportTicket.count({ where: { orderId, kind: "DISPUTE", status: { not: "RESOLVED" } } }))
        throw new AppError(409, "DISPUTE_OPEN", "Resolve the dispute first, or close the case with payment held for review.");
      if (body.financialAction === "NONE" && (order.heldMinor > 0n || order.releasedMinor > 0n || order.refundedMinor > 0n || await tx.paymentAttempt.count({ where: { orderId, paidMinor: { gt: 0n } } })))
        throw new AppError(409, "PAYMENT_OUTCOME_REQUIRED", "This order has payment records. Choose hold, release or refund.");
    }
    if (previous?.financialAction === "NONE" && body.financialAction !== "HOLD")
      throw new AppError(409, "ORDER_ALREADY_RESOLVED", "This order already has a final administrative resolution. Its financial outcome cannot be replaced.");
    // Active label purchases cannot be undone locally. Preserve their eventual provider reference,
    // but never claim that administrative closure cancels a booking at the courier.
    const resolution = { id: body.mutationKey, outcome: body.outcome, financialAction: body.financialAction,
      reason: body.reason, evidence: body.evidence, adminId: req.auth!.sub, resolvedAt: new Date().toISOString(),
      previousOrderStatus: order.status, previousDeliveryStatus: order.delivery?.status || order.shipment?.status || null,
      previousFinancialHold: order.financialHold, previousHeldMinor: order.heldMinor.toString(),
      shippingRefundMinor: body.shippingRefundMinor };
    await tx.tradeOrder.update({ where: { id: orderId }, data: {
      adminResolution: resolution, status: body.outcome, financialHold: body.financialAction === "HOLD",
    } });
    const deliveryStatus = body.outcome === "COMPLETED" ? "DELIVERED" : "CANCELLED";
    if (order.delivery) {
      await tx.delivery.update({ where: { id: order.delivery.id }, data: { status: deliveryStatus, leaseUntil: null, failureCode: null } });
      await tx.deliveryParcel.updateMany({ where: { deliveryId: order.delivery.id }, data: { status: deliveryStatus, failureCode: null } });
      await deliveryEvent(tx, order.delivery.id, "ADMIN_RESOLVED", "admin", `${body.mutationKey}:resolution`, req.auth!.sub, { outcome: body.outcome, financialAction: body.financialAction });
    }
    if (order.shipment) await tx.shipment.update({ where: { id: order.shipment.id }, data: { status: deliveryStatus } });
    await tx.fulfillmentDeadline.updateMany({ where: { orderId }, data: { state: "ADMIN_RESOLVED", failureCode: null } });
    let message = "Order closed by administrator. Remaining funds are held for review; already-submitted payments may still complete. No new payout or refund was requested.";
    if (body.financialAction === "NONE") {
      // Only unpaid reservations without an earlier stock disposition are released/sold here.
      if (!await tx.inventoryMovement.count({ where: { referenceType: "order", referenceId: orderId, type: { in: ["SALE", "RELEASE"] } } })) {
        await tx.listing.update({ where: { id: order.listingId }, data: { reservedQuantity: { decrement: order.quantity },
          ...(body.outcome === "COMPLETED" ? { availableQuantity: { decrement: order.quantity } } : {}) } });
        await tx.inventoryMovement.create({ data: { listingId: order.listingId, type: body.outcome === "COMPLETED" ? "SALE" : "RELEASE", quantity: order.quantity, referenceType: "order", referenceId: orderId } });
      }
      message = "Order closed by administrator. No funds were moved.";
    } else if (body.financialAction !== "HOLD") {
      if (order.fundsProvider === "bachs") {
        if (body.financialAction === "RELEASE") await requestRelease(orderId, req, tx, body.mutationKey);
        else await requestRefund(orderId, req, tx, body.mutationKey);
        message = `Order closed by administrator. ${body.financialAction === "RELEASE" ? "Farmer payment" : "Buyer refund"} requested; funds remain pending until the provider confirms the result.`;
      } else {
        if (body.shippingRefundMinor !== "0") throw new AppError(409, "MANUAL_SHIPPING_REFUND_UNSUPPORTED", "Manual escrow settles produce only. Record delivery fee refunds through their existing financial review.");
        const feeMinor = await settleManualBalance(tx, order, body.financialAction);
        await tx.escrowEntry.create({ data: { orderId, kind: body.financialAction, amountMinor: order.heldMinor, feeMinor,
          mutationKey: body.mutationKey, actorId: req.auth!.sub, reason: body.reason } });
        message = "Order closed and the manual escrow settlement recorded. This is an internal record, not a provider-confirmed bank transfer.";
      }
    }
    return { message };
  });
}

/** Presentation hints only; every condition is rechecked inside the mutation lock. */
export async function readResolutionOptions(order: { id: string; heldMinor: bigint; totalMinor: bigint; releasedMinor: bigint; refundedMinor: bigint; fundsProvider: string | null; adminResolution: unknown; buyerId: string; delivery?: { bookingStartedAt: Date | null; providerShipmentId: string | null } | null }, includeDestinations = false) {
  const { prisma } = await import("@leetlogic/database");
  const [payments, operations, disputes, shipping, destinations] = await Promise.all([
    prisma.paymentAttempt.findMany({ where: { orderId: order.id }, select: { status: true, checkoutId: true, confirmedAt: true, checkErrorCode: true, paidMinor: true, method: true } }),
    prisma.moneyOperation.findMany({ where: { orderId: order.id, kind: { in: ["RELEASE", "REFUND", "REFUND_TRANSFER", "REFUND_PAYOUT"] }, status: { not: "FAILED" } } }),
    prisma.supportTicket.count({ where: { orderId: order.id, kind: "DISPUTE", status: { not: "RESOLVED" } } }),
    prisma.moneyJournalLine.aggregate({ where: { account: `held_shipping:${order.id}`, journal: { mode: mode() } }, _sum: { amountMinor: true } }),
    includeDestinations ? prisma.bankDestination.findMany({ where: { userId: order.buyerId, mode: mode(), usable: true }, select: { id: true, bankName: true, accountName: true, accountLastFour: true }, orderBy: { createdAt: "asc" } }) : [],
  ]);
  const checkout = payments.some(p => ["QUEUED", "PROCESSING", "UNKNOWN", "OPEN"].includes(p.status) || p.status === "BLOCKED" && !!p.checkoutId || !!p.checkoutId && !p.confirmedAt && !!p.checkErrorCode);
  const prior = order.adminResolution as { financialAction?: string } | null;
  const bookingUnknown = !!order.delivery?.bookingStartedAt && !order.delivery.providerShipmentId;
  let releaseReady = true, refundReady = true;
  if (order.fundsProvider === "bachs") {
    try { paymentReady("RELEASE"); } catch { releaseReady = false; }
    try { paymentReady("REFUND"); } catch { refundReady = false; }
  }
  const eligible = !bookingUnknown && !checkout && !disputes && prior?.financialAction !== "NONE" && order.heldMinor > 0n && order.heldMinor === order.totalMinor && order.releasedMinor === 0n && order.refundedMinor === 0n;
  const none = !checkout && !operations.length && (!prior || prior.financialAction === "HOLD") && order.heldMinor === 0n && order.releasedMinor === 0n && order.refundedMinor === 0n && !payments.some(p => p.paidMinor > 0n);
  const availableShipping = -(shipping._sum.amountMinor || 0n);
  const pausedRefunds = canResumeResolutionOperations(operations, "REFUND") ? operations : [];
  const resumeShippingRefundMinor = pausedRefunds.length ? pausedRefunds.reduce((sum, operation) => sum + BigInt((operation.payload as { shippingMinor?: string }).shippingMinor || "0"), 0n).toString() : null;
  const resumeDestinationId = (pausedRefunds.find(operation => operation.kind === "REFUND_TRANSFER")?.payload as { destinationId?: string } | undefined)?.destinationId || null;
  const bankRefundRequired = order.fundsProvider === "bachs" && payments.some(p => p.status === "SUCCEEDED" && p.method?.toUpperCase().includes("TRANSFER"));
  return { resumeShippingRefundMinor, resumeDestinationId, bankRefundRequired, refundDestinations: destinations, release: releaseReady && eligible && (!operations.length || canResumeResolutionOperations(operations, "RELEASE")), refund: refundReady && eligible && (!operations.length || canResumeResolutionOperations(operations, "REFUND")) && (!bankRefundRequired || !!destinations.length), hold: true, none,
    refundableShippingMinor: order.fundsProvider === "bachs" && availableShipping > 0n ? availableShipping.toString() : "0",
    blockedReason: bookingUnknown ? "The courier booking outcome is still uncertain. Hold payment while its cost is reconciled." : !releaseReady && !refundReady ? "Provider payments are currently unavailable. Close with payment held for review until processing is restored." : bankRefundRequired && !destinations.length ? "The buyer needs an approved original-payer bank account before a bank transfer refund. Hold payment while this is verified." : (eligible && (!operations.length || canResumeResolutionOperations(operations, "RELEASE") || canResumeResolutionOperations(operations, "REFUND"))) || none ? null : operations.length ? "A payout or refund already exists. Reconcile its result before moving funds again." : disputes ? "An unresolved dispute requires payment to remain on hold." : checkout ? "An active or uncertain payment must be reconciled before moving funds." : "A full unsettled balance is required for release or refund. Hold the payment while reviewing the records." };
}
