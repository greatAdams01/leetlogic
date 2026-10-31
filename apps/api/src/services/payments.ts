import { createHash, randomUUID } from "node:crypto";
import { prisma, type Prisma, type MoneyOperation, type PaymentAttempt } from "@leetlogic/database";
import { getConfig } from "../config.js";
import { AppError } from "../lib/errors.js";
import { bachs, minor, paymentReady, checkoutReturnUrls, checkoutChargeId, receiptAmounts } from "../providers/payments/bachs.js";
import { encryptSecret, hashToken } from "../lib/crypto.js";
import { dependencyError } from "../lib/dependency-errors.js";
import { logger } from "../lib/logger.js";
import type { Request } from "express";
import { audit } from "./audit.js";
import { assertCheckoutReady, assertNoActiveCheckout, assertPaymentShipment, shippingOrderInclude } from "./delivery-quote.js";
import { assertNoDeliverySettlement, deliveryEvent, queuePaidDelivery } from "./delivery.js";
import { deliveryReceiptReady, deliveryRefundReady } from "./delivery-policy.js";
export const mode = () => getConfig().BACHS_MODE;
export const fingerprint = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export const liveStatuses = [
  "REQUESTED",
  "QUEUED",
  "PROCESSING",
  "UNKNOWN",
  "PROVIDER_PENDING",
  "BLOCKED",
];
export const systemRequest = (): Request =>
  ({ requestId: randomUUID(), get: () => "payment-worker" }) as unknown as Request;
export async function journal(
  tx: Prisma.TransactionClient,
  reference: string,
  lines: Array<[string, bigint]>,
  orderId?: string,
  operationId?: string,
) {
  const nonzero = lines.filter(([, amount]) => amount !== 0n);
  if (nonzero.length < 2 || nonzero.reduce((sum, [, amount]) => sum + amount, 0n) !== 0n)
    throw new Error("UNBALANCED_JOURNAL");
  const existing = await tx.moneyJournal.findUnique({ where: { reference } });
  if (existing) return;
  await tx.moneyJournal.create({
    data: {
      reference,
      mode: mode(),
      orderId,
      operationId,
      lines: { create: nonzero.map(([account, amountMinor]) => ({ account, amountMinor })) },
    },
  });
}
export const accountLock = (tx: Prisma.TransactionClient, userId: string) =>
  tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`money:${mode()}:${userId}`},0))::text`;
export async function availableEarnings(userId: string, tx: Prisma.TransactionClient = prisma) {
  const ledger = await tx.moneyJournalLine.aggregate({
    where: { account: `seller_available:${userId}`, journal: { mode: mode() } },
    _sum: { amountMinor: true },
  });
  const pending = await tx.moneyOperation.findMany({
    where: { ownerId: userId, mode: mode(), kind: "PAYOUT", status: { in: liveStatuses } },
    select: { amountMinor: true, feeMinor: true },
  });
  const balance = -(ledger._sum.amountMinor || 0n);
  const reserved = pending.reduce((sum, item) => sum + item.amountMinor + item.feeMinor, 0n);
  return { balanceMinor: balance, reservedMinor: reserved, availableMinor: balance - reserved };
}
export async function paymentAccount(userId: string, ready = true) {
  const account = await prisma.financialAccount.findUnique({
    where: { userId_mode: { userId, mode: mode() } },
  });
  if (
    !account?.providerAccountId ||
    (ready &&
      (!account.capabilities.includes("transfers") ||
        !account.capabilities.includes("payouts") ||
        account.status !== "READY"))
  )
    throw new AppError(
      409,
      "PAYMENT_SETUP_REQUIRED",
      "Complete your payment account setup before continuing.",
    );
  return account;
}
export async function refreshAccount(userId: string) {
  const account = await paymentAccount(userId, false);
  const data = await bachs.account(account.providerAccountId!);
  if (
    data.id !== account.providerAccountId ||
    data.parent_organization_id !== getConfig().BACHS_ORGANIZATION_ID
  )
    throw new AppError(
      409,
      "PAYMENT_ACCOUNT_MISMATCH",
      "We couldn’t confirm your payment account. Please contact support.",
    );
  const capabilities = Array.isArray(data.enabled_capabilities)
    ? data.enabled_capabilities.filter((x: unknown) => typeof x === "string")
    : [];
  const ready = capabilities.includes("transfers") && capabilities.includes("payouts");
  return prisma.financialAccount.update({
    where: { id: account.id },
    data: { capabilities, status: ready ? "READY" : "ONBOARDING" },
  });
}
export async function createOperation(
  tx: Prisma.TransactionClient,
  input: {
    ownerId: string;
    actorId?: string;
    orderId?: string;
    paymentId?: string;
    kind: string;
    key: string;
    amountMinor?: bigint;
    feeMinor?: bigint;
    payload: Record<string, any>;
    encryptedPayload?: string;
    status?: string;
  },
) {
  const mutationKey = `${mode()}:${input.ownerId}:${input.kind}:${input.key}`;
  const requestHash = fingerprint({
    orderId: input.orderId,
    paymentId: input.paymentId,
    amount: input.amountMinor?.toString(),
    fee: input.feeMinor?.toString(),
    payload: input.payload,
  });
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${mutationKey},0))::text`;
  const existing = await tx.moneyOperation.findUnique({ where: { mutationKey } });
  if (existing) {
    if (existing.requestHash !== requestHash)
      throw new AppError(
        409,
        "IDEMPOTENCY_CONFLICT",
        "This request changed. Refresh and try again.",
      );
    return existing;
  }
  return tx.moneyOperation.create({
    data: {
      ownerId: input.ownerId,
      actorId: input.actorId,
      orderId: input.orderId,
      paymentId: input.paymentId,
      mode: mode(),
      kind: input.kind,
      mutationKey,
      requestHash,
      amountMinor: input.amountMinor,
      feeMinor: input.feeMinor,
      payload: input.payload,
      encryptedPayload: input.encryptedPayload,
      status: input.status || "QUEUED",
    },
  });
}
export async function startCheckout(orderId: string, buyerId: string, kind = "ORDER") {
  paymentReady("CHECKOUT");
  checkoutReturnUrls("configuration-check");
  // A declined card can leave its hosted session open. Reconcile that session before allowing another.
  const previous = await prisma.paymentAttempt.findFirst({
    where: {
      orderId,
      buyerId,
      mode: mode(),
      kind,
      status: { in: ["FAILED", "BLOCKED"] },
      checkoutId: { not: null },
      paidMinor: 0n,
    },
    orderBy: { createdAt: "desc" },
  });
  if (previous) await reconcilePayment(previous.id);
  const attempt = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM trade_orders WHERE id=${orderId}::uuid FOR UPDATE`;
    const order = await tx.tradeOrder.findUnique({
      where: { id: orderId },
      include: { ...shippingOrderInclude, delivery: { include: { quotes: true } } },
    });
    if (!order || order.buyerId !== buyerId)
      throw new AppError(404, "ORDER_NOT_FOUND", "Order not found");
    await assertNoDeliverySettlement(tx, orderId);
    if (
      order.financialHold ||
      (kind === "ORDER"
        ? order.status !== "AWAITING_PAYMENT" || order.heldMinor !== 0n
        : order.status !== "FUNDED" ||
          !!order.delivery?.providerShipmentId ||
          !!order.delivery?.bookingStartedAt)
    )
      throw new AppError(409, "PAYMENT_LOCKED", "This order cannot accept a payment right now.");
    if (kind === "ORDER" && order.reservationExpiresAt && order.reservationExpiresAt <= new Date())
      throw new AppError(409, "ORDER_EXPIRED", "This order expired. Please place a new order.");
    const active = await tx.paymentAttempt.findFirst({
      where: {
        orderId,
        mode: mode(),
        kind,
        OR: [
          { status: { in: ["QUEUED", "PROCESSING", "UNKNOWN", "OPEN"] } },
          { status: "BLOCKED", checkoutId: { not: null } },
        ],
      },
      orderBy: { createdAt: "desc" },
    });
    if (active) {
      assertPaymentShipment(order, active);
      if (active.status === "BLOCKED")
        throw new AppError(409, "CHECKOUT_ACTIVE", "Finish the current payment before changing delivery details.");
      return active;
    }
    const { payableMinor, produceMinor, shippingMinor, quote } = assertCheckoutReady(order, kind);
    const recipient = await tx.financialAccount.findUnique({
      where: { userId_mode: { userId: order.farmerProfile.userId, mode: mode() } },
    });
    if (
      recipient?.status !== "READY" ||
      !recipient.capabilities.includes("transfers") ||
      !recipient.capabilities.includes("payouts") ||
      !(await tx.bankDestination.count({
        where: { userId: order.farmerProfile.userId, mode: mode(), usable: true },
      }))
    )
      throw new AppError(
        409,
        "SELLER_PAYMENTS_UNAVAILABLE",
        "This seller is finishing payment setup. Please try again later.",
      );
    const expiresAt = new Date(
      Math.min(
        quote?.expiresAt.getTime() ?? Infinity,
        Date.now() + 15 * 60000,
      ),
    );
    const created = await tx.paymentAttempt.create({
      data: {
        orderId,
        buyerId,
        mode: mode(),
        kind,
        amountMinor: payableMinor,
        produceMinor,
        shippingMinor,
        quoteId: quote?.id ?? null,
        expiresAt,
      },
    });
    await tx.tradeOrder.update({
      where: { id: orderId },
      data: {
        fundsProvider: "bachs",
        ...(kind === "ORDER" ? { reservationExpiresAt: expiresAt } : {}),
      },
    });
    await createOperation(tx, {
      ownerId: buyerId,
      orderId,
      paymentId: created.id,
      kind: "CHECKOUT",
      key: created.id,
      amountMinor: created.amountMinor,
      payload: {},
    });
    return created;
  });
  return attempt;
}
/** Only allowlisted reasons are persisted/logged; never provider bodies or private URLs. */
export function paymentCheckReason(error: unknown) {
  const dependency = dependencyError(error);
  if (dependency) return dependency.code;
  if (error instanceof AppError) return error.code;
  return error instanceof Error && /^(PAYMENT|CHECKOUT)_[A-Z_]{1,65}$/.test(error.message)
    ? error.message : "PAYMENT_VERIFICATION_FAILED";
}

/** Shared by webhooks, buyer refresh and background recovery, including expired sessions. */
export async function reconcilePayment(paymentId: string, hintedCharge?: string) {
  const attempt = await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: paymentId } });
  if (attempt.mode !== mode()) throw new Error("PAYMENT_ENVIRONMENT_MISMATCH");
  const checkedAt = new Date();
  const currentCheck = { id: paymentId, OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lte: checkedAt } }] };
  try {
    await confirmPayment(attempt, hintedCharge);
    const current = await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: paymentId } });
    const delay = ["EXPIRED", "FAILED"].includes(current.status) ? 6 * 3600000 : 60000;
    await prisma.paymentAttempt.updateMany({
      where: currentCheck,
      data: { lastCheckedAt: checkedAt, nextCheckAt: new Date(Date.now() + delay), checkFailures: 0, checkErrorCode: null },
    });
  } catch (error) {
    const reason = paymentCheckReason(error);
    const delay = Math.min(15 * 60000, 60000 * 2 ** Math.min(attempt.checkFailures, 4));
    await prisma.paymentAttempt.updateMany({
      where: currentCheck,
      data: { lastCheckedAt: checkedAt, nextCheckAt: new Date(Date.now() + delay), checkFailures: { increment: 1 }, checkErrorCode: reason },
    });
    if (attempt.checkErrorCode !== reason)
      await audit(systemRequest(), { action: "payment.verification.deferred", entityType: "payment", entityId: paymentId, after: { reason } });
    logger.warn({ paymentId, reason, retryInSeconds: delay / 1000 }, "Payment verification will retry");
    if (dependencyError(error)) throw error;
    const pending = new AppError(503, "PAYMENT_CONFIRMATION_PENDING", "We’re confirming your payment. Please don’t pay again.", undefined, delay / 1000);
    pending.diagnostics = { provider: "bachs", operation: "verify-payment", reason, hint: "Inspect the saved verification reason and webhook. Never treat a redirect as a payment receipt." };
    throw pending;
  }
}

/** Never trusts webhook amounts/status; all receipt fields come from account-bound provider reads. */
async function confirmPayment(attempt: PaymentAttempt, hintedCharge?: string) {
  if (!attempt.checkoutId) return;
  if (["SUCCEEDED", "REFUNDED"].includes(attempt.status) && (!hintedCharge || hintedCharge === attempt.chargeId)) return;
  const checkout = await bachs.checkoutState(attempt.checkoutId);
  if (
    checkout.checkout_id !== attempt.checkoutId ||
    (checkout.reference && checkout.reference !== attempt.id) ||
    (checkout.metadata?.attempt_id && checkout.metadata.attempt_id !== attempt.id) ||
    (checkout.metadata?.order_id && checkout.metadata.order_id !== attempt.orderId)
  )
    throw new Error("PAYMENT_CHECKOUT_MISMATCH");
  const checkoutStatus = String(checkout.status || "").toLowerCase();
  const chargeId = hintedCharge || checkoutChargeId(checkout) || attempt.chargeId;
  if (!chargeId) {
    if (["expired", "cancelled"].includes(checkoutStatus))
      await prisma.paymentAttempt.updateMany({
        where: { id: attempt.id, confirmedAt: null, paidMinor: 0n, status: { notIn: ["SUCCEEDED", "REFUNDED", "EXCEPTION"] } },
        data: { status: "EXPIRED" },
      });
    else if (checkoutStatus === "completed") throw new Error("PAYMENT_CHARGE_NOT_AVAILABLE");
    return;
  }
  let replaceUnpaidCharge: string | null = null;
  if (
    attempt.chargeId &&
    chargeId !== attempt.chargeId &&
    attempt.paidMinor === 0n &&
    !["SUCCEEDED", "REFUNDED", "EXCEPTION"].includes(attempt.status)
  ) {
    const prior = await bachs.payment(attempt.chargeId);
    if (
      prior.payment_id === attempt.chargeId &&
      prior.checkout_id === attempt.checkoutId &&
      prior.currency === "NGN" &&
      ["failed", "cancelled"].includes(String(prior.status).toLowerCase()) &&
      minor(prior.amount_paid || "0") === 0n
    )
      replaceUnpaidCharge = attempt.chargeId;
  }
  if (attempt.chargeId && chargeId !== attempt.chargeId && !replaceUnpaidCharge) {
    const extra = await bachs.payment(chargeId);
    if (
      extra.payment_id !== chargeId ||
      extra.checkout_id !== attempt.checkoutId ||
      extra.currency !== "NGN"
    )
      throw new Error("PAYMENT_CHARGE_MISMATCH");
    const { fee: extraFee, received: paid, success: extraConfirmed } = receiptAmounts(extra, attempt.amountMinor);
    if (paid === 0n) return;
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM trade_orders WHERE id=${attempt.orderId}::uuid FOR UPDATE`;
      let receipt = await tx.paymentAttempt.findUnique({ where: { chargeId } });
      if (receipt?.status === "REFUNDED") return;
      if (!receipt)
        receipt = await tx.paymentAttempt.create({
          data: {
            orderId: attempt.orderId,
            buyerId: attempt.buyerId,
            mode: mode(),
            kind: "EXCESS",
            status: "EXCEPTION",
            amountMinor: attempt.amountMinor,
            produceMinor: attempt.amountMinor,
            shippingMinor: 0n,
            chargeId,
            method: extra.method || extra.payment_method,
            processingFeeMinor: extraFee,
            expiresAt: new Date(),
            exceptionCode: "DUPLICATE_CHARGE",
            confirmedAt: extraConfirmed ? new Date() : null,
          },
        });
      if (paid > receipt.paidMinor) {
        await journal(
          tx,
          `received:${mode()}:${chargeId}:${paid}`,
          [
            ["platform_cash", paid - receipt.paidMinor],
            [`unallocated:${receipt.id}`, receipt.paidMinor - paid],
          ],
          attempt.orderId,
        );
        await tx.paymentAttempt.update({ where: { id: receipt.id }, data: { paidMinor: paid } });
      }
      await tx.tradeOrder.update({ where: { id: attempt.orderId }, data: { financialHold: true } });
    });
    return;
  }
  const payment = await bachs.payment(chargeId);
  if (
    payment.payment_id !== chargeId ||
    payment.checkout_id !== attempt.checkoutId ||
    payment.currency !== "NGN" ||
     (payment.reference && payment.reference !== attempt.id) ||
     (payment.meta?.attempt_id && payment.meta.attempt_id !== attempt.id) ||
     (payment.meta?.order_id && payment.meta.order_id !== attempt.orderId)
  )
    throw new Error("PAYMENT_CHARGE_MISMATCH");
  const { fee, received, success, declined } = receiptAmounts(payment, attempt.amountMinor);
  const completed = payment.completed_at || checkout.completed_at;
  const confirmationAt = success && completed ? new Date(completed) : new Date();
  if (success && (!Number.isFinite(confirmationAt.getTime()) || confirmationAt.getTime() > Date.now() + 300000 ||
    confirmationAt.getTime() < attempt.createdAt.getTime() - 300000))
    throw new Error("PAYMENT_COMPLETION_TIME_INVALID");
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM trade_orders WHERE id=${attempt.orderId}::uuid FOR UPDATE`;
    const current = await tx.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    const order = await tx.tradeOrder.findUniqueOrThrow({
      where: { id: attempt.orderId },
      include: { ...shippingOrderInclude, delivery: { include: { quotes: true } } },
    });
    if (["SUCCEEDED", "REFUNDED"].includes(current.status)) return;
    if (
      current.chargeId &&
      current.chargeId !== chargeId &&
      !(replaceUnpaidCharge === current.chargeId && current.paidMinor === 0n)
    )
      throw new Error("PAYMENT_CHARGE_CHANGED");
    if (received < current.paidMinor) throw new Error("PAYMENT_AMOUNT_REGRESSION");
    if (received > current.paidMinor)
      await journal(
        tx,
        `received:${mode()}:${chargeId}:${received}`,
        [
          ["platform_cash", received - current.paidMinor],
          [`unallocated:${attempt.id}`, current.paidMinor - received],
        ],
        order.id,
      );
    const late =
      current.kind === "ORDER" &&
      (order.status !== "AWAITING_PAYMENT" ||
        order.financialHold ||
        (order.reservationExpiresAt && order.reservationExpiresAt <= confirmationAt));
    const topupInvalid =
      current.kind !== "ORDER" &&
      (order.status !== "FUNDED" || order.financialHold || order.delivery?.bookingStartedAt);
    let shipmentError: string | undefined;
    try {
      await assertNoDeliverySettlement(tx, order.id);
      assertPaymentShipment(order, current, success ? confirmationAt : undefined);
    } catch (error) {
      shipmentError = error instanceof AppError ? error.code : "STALE_DELIVERY_QUOTE";
    }
    const exception =
      !success && received > 0n
        ? "PAYMENT_AMOUNT_REVIEW"
        : late || topupInvalid
          ? "PAYMENT_ORDER_CHANGED"
          : received > 0n ? shipmentError : undefined;
    await tx.paymentAttempt.update({
      where: { id: current.id },
      data: {
        chargeId: declined ? null : chargeId,
        paidMinor: received,
        processingFeeMinor: fee,
        ...(success && !current.confirmedAt ? { confirmedAt: confirmationAt } : {}),
        method: payment.method || payment.payment_method,
        status:
          success && !exception
            ? "SUCCEEDED"
            : exception
              ? "EXCEPTION"
               : ["expired", "cancelled"].includes(checkoutStatus) && received === 0n
                 ? "EXPIRED"
               : shipmentError
                 ? "BLOCKED"
               : declined
                 ? ["expired", "cancelled"].includes(checkoutStatus)
                  ? "EXPIRED"
                  : "OPEN"
                : "OPEN",
        exceptionCode: exception || shipmentError || (declined ? "PAYMENT_ATTEMPT_FAILED" : null),
      },
    });
    if (success && !current.confirmedAt) {
      await audit(systemRequest(), {
        action: "payment.provider.confirmed", entityType: "payment", entityId: current.id,
        after: { orderId: order.id, provider: "bachs", currency: "NGN", principalMinor: received.toString(), feeMinor: fee.toString(), completedAt: confirmationAt.toISOString() },
      }, tx);
      if (order.delivery) await deliveryEvent(tx, order.delivery.id, "PAYMENT_CONFIRMED", "bachs", `${order.delivery.id}:payment-confirmed:${current.id}`);
    }
    if (exception) {
      await tx.tradeOrder.update({ where: { id: order.id }, data: { financialHold: true } });
      return;
    }
    if (!success) return;
    if (payment.merchant_bears_cost === true) {
      await tx.tradeOrder.update({ where: { id: order.id }, data: { financialHold: true } });
      await tx.paymentAttempt.update({
        where: { id: current.id },
        data: { status: "EXCEPTION", exceptionCode: "FEE_POLICY_MISMATCH" },
      });
      return;
    }
    await journal(
      tx,
      `funded:${current.id}`,
      [
        [`unallocated:${current.id}`, current.amountMinor],
        [`held_produce:${order.id}`, -current.produceMinor],
        [`held_shipping:${order.id}`, -current.shippingMinor],
        ["processing_fee_expense", fee],
        ["processing_fee_collected", -fee],
      ],
      order.id,
    );
    if (current.kind === "ORDER") {
      await tx.tradeOrder.update({
        where: { id: order.id },
        data: { heldMinor: current.produceMinor, status: "FUNDED" },
      });
      const farmer = await tx.farmerProfile.findUniqueOrThrow({
        where: { id: order.farmerProfileId },
      });
      await tx.paidOrderNotification.upsert({
        where: { orderId: order.id },
        create: { orderId: order.id, userId: farmer.userId },
        update: {},
      });
      await tx.escrowEntry.create({
        data: {
          orderId: order.id,
          kind: "FUND",
          amountMinor: current.produceMinor,
          externalRef: chargeId,
          mutationKey: `bachs:${current.id}`,
          actorId: current.buyerId,
          reason: "Provider-confirmed payment",
        },
      });
    }
    if (order.delivery)
      await tx.delivery.update({
        where: { id: order.delivery.id },
        data: {
          paidMinor: { increment: current.shippingMinor },
          paymentRef: order.delivery.paymentRef || chargeId,
          status: order.delivery.status === "PICKUP_PENDING" ? "PICKUP_READY" : "PAID",
          nextSyncAt: new Date(),
        },
      });
    if (current.kind === "ORDER" && order.delivery)
      await deliveryEvent(tx, order.delivery.id, "PREPARING_FOR_PICKUP", "system", `${order.delivery.id}:preparing`);
    await audit(
      systemRequest(),
      {
        action: "payment.confirmed",
        entityType: "order",
        entityId: order.id,
        after: { paymentId: current.id, amountMinor: current.amountMinor.toString() },
      },
      tx,
    );
  });
  // The persisted PAID state is also picked up by delivery jobs after a crash here.
  await queuePaidDelivery(attempt.orderId);
}
export async function assertRelease(tx: Prisma.TransactionClient, orderId: string) {
  const order = await tx.tradeOrder.findUniqueOrThrow({
    where: { id: orderId },
    include: { farmerProfile: true, delivery: { include: { parcels: true } } },
  });
  if (
    order.fundsProvider !== "bachs" ||
    !["FUNDED", "DELIVERED"].includes(order.status) ||
    order.heldMinor !== order.totalMinor ||
    !order.deliveryConfirmedAt ||
    (order.delivery && !deliveryReceiptReady(order.delivery)) ||
    order.financialHold ||
    (await tx.supportTicket.count({
      where: { orderId, kind: "DISPUTE", status: { not: "RESOLVED" } },
    }))
  )
    throw new AppError(
      409,
      "RELEASE_BLOCKED",
      "Confirm buyer receipt and resolve all disputes before releasing funds.",
    );
  return order;
}
export async function requestRelease(orderId: string, req: Request) {
  paymentReady("RELEASE");
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM trade_orders WHERE id=${orderId}::uuid FOR UPDATE`;
    const prior = await tx.moneyOperation.findFirst({
      where: { mode: mode(), orderId, kind: "RELEASE", status: { not: "FAILED" } },
    });
    if (prior) return prior;
    const order = await assertRelease(tx, orderId);
    if (
      await tx.moneyOperation.count({
        where: {
          orderId,
          kind: { in: ["REFUND", "REFUND_TRANSFER", "REFUND_PAYOUT"] },
          status: { in: liveStatuses },
        },
      })
    )
      throw new AppError(409, "REFUND_PENDING", "A refund is already in progress.");
    const fee = (order.totalMinor * BigInt(order.feeBasisPoints)) / 10000n;
    const operation = await createOperation(tx, {
      ownerId: order.farmerProfile.userId,
      actorId: req.auth!.sub,
      orderId,
      kind: "RELEASE",
      key: `${orderId}:${await tx.moneyOperation.count({ where: { orderId, mode: mode(), kind: "RELEASE", status: "FAILED" } })}`,
      amountMinor: order.heldMinor - fee,
      feeMinor: fee,
      payload: { reason: req.body.reason },
    });
    await audit(
      req,
      { action: "payment.release.requested", entityType: "order", entityId: orderId },
      tx,
    );
    return operation;
  });
}
export async function startAccount(
  userId: string,
  input: {
    email: string;
    firstName: string;
    lastName: string;
    entityType: "individual" | "company";
    displayName: string;
  },
  req: Request,
) {
  paymentReady("ONBOARD");
  void req;
  return prisma.$transaction(async (tx) => {
    await accountLock(tx, userId);
    await tx.financialAccount.upsert({
      where: { userId_mode: { userId, mode: mode() } },
      create: { userId, mode: mode() },
      update: {},
    });
    return createOperation(tx, {
      ownerId: userId,
      kind: "ACCOUNT",
      key: "account",
      payload: {},
      encryptedPayload: encryptSecret(JSON.stringify(input)),
    });
  });
}
export async function addBank(
  userId: string,
  input: { bankCode: string; accountNumber: string },
  req: Request,
) {
  paymentReady("DESTINATION");
  void req;
  await paymentAccount(userId, false);
  const hash = hashToken(`bank:${userId}:${input.bankCode}:${input.accountNumber}`);
  return prisma.$transaction(async (tx) => {
    await accountLock(tx, userId);
    return createOperation(tx, {
      ownerId: userId,
      kind: "DESTINATION",
      key: hash,
      payload: { fingerprint: hash },
      encryptedPayload: encryptSecret(JSON.stringify(input)),
    });
  });
}
export async function requestWithdrawal(
  userId: string,
  destinationId: string,
  amountMinor: bigint,
  key: string,
) {
  paymentReady("PAYOUT");
  const destination = await prisma.bankDestination.findFirst({
    where: { id: destinationId, userId, mode: mode(), usable: true },
  });
  if (!destination) throw new AppError(409, "BANK_NOT_READY", "Choose an approved bank account.");
  const feeValue = getConfig().BACHS_NGN_PAYOUT_FEE_MINOR;
  if (feeValue === undefined)
    throw new AppError(
      503,
      "PAYOUT_FEE_UNAVAILABLE",
      "Withdrawal fees are being updated. Please try again later.",
    );
  const feeMinor = BigInt(feeValue);
  return prisma.$transaction(async (tx) => {
    await accountLock(tx, userId);
    const mutationKey = `${mode()}:${userId}:PAYOUT:${key}`;
    const previous = await tx.moneyOperation.findUnique({ where: { mutationKey } });
    if (previous) {
      if (
        previous.amountMinor !== amountMinor ||
        (previous.payload as any).destinationId !== destinationId
      )
        throw new AppError(409, "IDEMPOTENCY_CONFLICT", "This withdrawal request changed.");
      return previous;
    }
    const duplicate = await tx.moneyOperation.findFirst({
      where: {
        ownerId: userId,
        mode: mode(),
        kind: "PAYOUT",
        amountMinor,
        feeMinor,
        status: { in: liveStatuses },
        payload: { path: ["destinationId"], equals: destinationId },
      },
    });
    if (duplicate) return duplicate;
    const earnings = await availableEarnings(userId, tx);
    if (amountMinor <= 0n || earnings.availableMinor < amountMinor + feeMinor)
      throw new AppError(
        409,
        "INSUFFICIENT_BALANCE",
        "Your available earnings do not cover this withdrawal and its fee.",
      );
    const frozen = await tx.tradeOrder.count({
      where: {
        farmerProfile: { userId },
        fundsProvider: "bachs",
        OR: [
          { financialHold: true },
          { tickets: { some: { kind: "DISPUTE", status: { not: "RESOLVED" } } } },
        ],
      },
    });
    if (frozen)
      throw new AppError(
        409,
        "PAYOUT_BLOCKED",
        "Withdrawals are paused while an order is being reviewed.",
      );
    return createOperation(tx, {
      ownerId: userId,
      kind: "PAYOUT",
      key,
      amountMinor,
      feeMinor,
      payload: { destinationId },
      status: "REQUESTED",
    });
  });
}
export async function requestRefund(orderId: string, req: Request) {
  paymentReady("REFUND");
  const shippingRefundMinor = BigInt(req.body.shippingRefundMinor);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM trade_orders WHERE id=${orderId}::uuid FOR UPDATE`;
    const order = await tx.tradeOrder.findUniqueOrThrow({
      where: { id: orderId },
      include: { delivery: { include: { parcels: true } } },
    });
    const previous = await tx.moneyOperation.findFirst({
      where: {
        mode: mode(),
        orderId,
        kind: { in: ["REFUND", "REFUND_TRANSFER", "REFUND_PAYOUT"] },
        status: { not: "FAILED" },
      },
    });
    if (previous) return [previous];
    if (
      order.fundsProvider !== "bachs" ||
      !["FUNDED", "DELIVERED"].includes(order.status) ||
      order.heldMinor !== order.totalMinor ||
      order.financialHold ||
      (await tx.supportTicket.count({
        where: { orderId, kind: "DISPUTE", status: { not: "RESOLVED" } },
      }))
    )
      throw new AppError(
        409,
        "REFUND_BLOCKED",
        "Resolve the order review before requesting a refund.",
      );
    if (
      await tx.moneyOperation.count({
        where: { orderId, kind: "RELEASE", status: { in: [...liveStatuses, "SUCCEEDED"] } },
      })
    )
      throw new AppError(409, "RELEASE_PENDING", "A release is already in progress.");
    if (!deliveryRefundReady(order.delivery))
      throw new AppError(
        409,
        "DELIVERY_ACTIVE",
        "Cancel or reconcile delivery before refunding this order.",
      );
    await assertNoActiveCheckout(tx, orderId);
    if (shippingRefundMinor < 0n || shippingRefundMinor > (order.delivery?.paidMinor || 0n))
      throw new AppError(422, "INVALID_REFUND", "Check the refundable delivery amount.");
    const payments = await tx.paymentAttempt.findMany({
      where: { orderId, mode: mode(), status: "SUCCEEDED" },
      orderBy: { createdAt: "asc" },
    });
    let shippingRemaining = shippingRefundMinor;
    const operations: MoneyOperation[] = [];
    for (const payment of payments) {
      const shipping =
        shippingRemaining > payment.shippingMinor ? payment.shippingMinor : shippingRemaining;
      shippingRemaining -= shipping;
      const amount = payment.produceMinor + shipping;
      if (!amount) continue;
      const bank = payment.method?.toUpperCase().includes("TRANSFER");
      if (bank && !getConfig().BACHS_BANK_REFUNDS_VERIFIED)
        throw new AppError(
          409,
          "BANK_REFUND_UNAVAILABLE",
          "Bank refund setup is not complete. Contact support.",
        );
      // Customer-borne processing fees were added on top at checkout; returning
      // principal retains those actual fees once, rather than deducting them again.
      const operation = await createOperation(tx, {
        ownerId: order.buyerId,
        actorId: req.auth!.sub,
        orderId,
        paymentId: payment.id,
        kind: bank ? "REFUND_TRANSFER" : "REFUND",
        key: `${payment.id}:${await tx.moneyOperation.count({ where: { paymentId: payment.id, mode: mode(), kind: { in: ["REFUND", "REFUND_TRANSFER"] }, status: "FAILED" } })}`,
        amountMinor: amount,
        payload: {
          shippingMinor: shipping.toString(),
          produceMinor: payment.produceMinor.toString(),
          reason: req.body.reason,
          destinationId: req.body.destinationId || null,
        },
      });
      operations.push(operation);
    }
    if (!operations.length || shippingRemaining > 0n)
      throw new AppError(
        409,
        "REFUND_RECONCILIATION_REQUIRED",
        "Review the original payments before refunding.",
      );
    await audit(
      req,
      {
        action: "payment.refund.requested",
        entityType: "order",
        entityId: orderId,
        after: { shippingRefundMinor: shippingRefundMinor.toString() },
      },
      tx,
    );
    return operations;
  });
}
