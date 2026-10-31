import { bankName } from "../services/bank-names.js";
import { decryptSecret } from "../lib/crypto.js";
import { createHash } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { prisma, type PaymentAttempt } from "@leetlogic/database";
import { requireAuth, requirePermission, requireRecentStepUp } from "../middleware/auth.js";
import { AppError } from "../lib/errors.js";
import { getConfig } from "../config.js";
import { bachs, verifyBachs, paymentReady, hostedUrl } from "../providers/payments/bachs.js";
import {
  startCheckout,
  reconcilePayment,
  startAccount,
  addBank,
  paymentAccount,
  refreshAccount,
  availableEarnings,
  requestWithdrawal,
  requestRelease,
  requestRefund,
  mode,
  createOperation,
  accountLock,
} from "../services/payments.js";
import { runMoneyOperation, reconcileBalances } from "../services/payment-worker.js";
import { hasDeliverySettlement, serialize } from "../services/delivery.js";
import { assertPaymentShipment, checkoutSummary, shippingOrderInclude, type CheckoutOrder } from "../services/delivery-quote.js";
import { audit as recordAudit } from "../services/audit.js";
const audit: typeof recordAudit = (req, input, tx) =>
  recordAudit(
    req,
    {
      ...input,
      after: {
        ...(input.after && typeof input.after === "object" ? input.after : {}),
        ...(typeof req.body?.reason === "string" ? { reason: req.body.reason } : {}),
      },
    },
    tx,
  );
import { redis } from "../lib/redis.js";
const uuid = z.string().uuid();
const money = z.string().regex(/^[1-9]\d{0,15}$/);
const reason = z.string().trim().min(10).max(500);
export const paymentsRouter = Router(),
  financialRouter = Router(),
  moneyAdminRouter = Router(),
  bachsWebhookRouter = Router();
paymentsRouter.use(requireAuth("customer"));
financialRouter.use(requireAuth("customer"));
moneyAdminRouter.use(requireAuth("admin"), requirePermission("payments.read"));
const safeOperation = (op: any) => ({
  id: op.id,
  kind: op.kind,
  status: op.status,
  amountMinor: op.amountMinor,
  feeMinor: op.feeMinor,
  totalMinor: op.amountMinor + op.feeMinor,
  createdAt: op.createdAt,
});
const safePayment = (item: any) => ({
  id: item.id,
  orderId: item.orderId,
  kind: item.kind,
  status: item.status,
  exceptionCode: item.exceptionCode,
  amountMinor: item.amountMinor,
  produceMinor: item.produceMinor,
  shippingMinor: item.shippingMinor,
  processingFeeMinor: item.processingFeeMinor,
  checkoutUrl: item.checkoutUrl,
  createdAt: item.createdAt,
  expiresAt: item.expiresAt,
});
function safeOrderPayment(order: CheckoutOrder, item: PaymentAttempt, buyer: boolean) {
  let available = false;
  try {
    assertPaymentShipment(order, item);
    available = item.status === "OPEN";
  } catch { /* Keep attempts visible for reconciliation, but never expose a stale payment link. */ }
  return { ...safePayment(item), checkoutUrl: available && buyer ? item.checkoutUrl : null };
}
async function throttle(userId: string, action: string) {
  const key = `money-rate:${action}:${userId}:${Math.floor(Date.now() / 60000)}`;
  const count = await redis().incr(key);
  if (count === 1) await redis().expire(key, 120);
  if (count > 10)
    throw new AppError(429, "RATE_LIMITED", "Please wait a moment before trying again.");
}
async function ownedOrder(orderId: string, userId: string) {
  const order = await prisma.tradeOrder.findUnique({
    where: { id: orderId },
    include: { ...shippingOrderInclude, delivery: { include: { quotes: true } } },
  });
  if (!order || (order.buyerId !== userId && order.farmerProfile.userId !== userId))
    throw new AppError(404, "ORDER_NOT_FOUND", "Order not found");
  return { ...order, settlementStarted: await hasDeliverySettlement(order.id) };
}
paymentsRouter.get("/:id/payments", async (req, res) => {
  const order = await ownedOrder(uuid.parse(req.params.id), req.auth!.sub);
  const items = await prisma.paymentAttempt.findMany({
    where: { orderId: order.id, mode: mode() },
    orderBy: { createdAt: "desc" },
  });
  res.json(
    serialize({
      enabled: getConfig().PAYMENTS_ENABLED,
      ...checkoutSummary(order),
      checkoutActive: items.some((item) => ["QUEUED", "PROCESSING", "UNKNOWN", "OPEN"].includes(item.status) ||
        (item.status === "BLOCKED" && !!item.checkoutId)),
      items: items.map((item) => safeOrderPayment(order, item, order.buyerId === req.auth!.sub)),
      orderStatus: order.status,
      financialHold: order.financialHold,
      heldMinor: order.heldMinor,
      releasedMinor: order.releasedMinor,
      refundedMinor: order.refundedMinor,
      deliveryConfirmedAt: order.deliveryConfirmedAt,
    }),
  );
});
paymentsRouter.post("/:id/checkout", async (req, res) => {
  await throttle(req.auth!.sub, "checkout");
  const { kind } = z
    .object({ kind: z.enum(["ORDER", "DELIVERY_TOPUP"]).default("ORDER") })
    .strict()
    .parse(req.body || {});
  const payment = await startCheckout(uuid.parse(req.params.id), req.auth!.sub, kind);
  const operation = await prisma.moneyOperation.findFirst({
    where: { paymentId: payment.id, kind: "CHECKOUT", mode: mode() },
  });
  if (operation?.status === "QUEUED") await runMoneyOperation(operation.id);
  const updated = await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: payment.id } });
  if (["FAILED", "BLOCKED"].includes(updated.status))
    throw new AppError(
      updated.status === "FAILED" ? 422 : 503,
      updated.exceptionCode || "PAYMENT_PROVIDER_REJECTED",
      "We couldn’t start your payment. Please try again or contact support.",
    );
  const order = await ownedOrder(updated.orderId, req.auth!.sub);
  const result = safeOrderPayment(order, updated, true);
  res.status(result.checkoutUrl ? 200 : 202).json(serialize(result));
});
paymentsRouter.post("/:id/payments/:paymentId/refresh", async (req, res) => {
  await throttle(req.auth!.sub, "refresh");
  const order = await ownedOrder(uuid.parse(req.params.id), req.auth!.sub);
  if (order.buyerId !== req.auth!.sub)
    throw new AppError(403, "BUYER_REQUIRED", "Only the buyer can check this payment.");
  const payment = await prisma.paymentAttempt.findFirst({
    where: { id: uuid.parse(req.params.paymentId), orderId: order.id, mode: mode() },
  });
  if (!payment) throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment not found");
  if (!payment.checkoutId) {
    const operation = await prisma.moneyOperation.findFirst({
      where: { paymentId: payment.id, kind: "CHECKOUT", mode: mode(), status: "QUEUED" },
    });
    if (operation) await runMoneyOperation(operation.id);
  }
  await reconcilePayment(payment.id);
  res.json(
    serialize(
      safeOrderPayment(
        await ownedOrder(order.id, req.auth!.sub),
        await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: payment.id } }),
        true,
      ),
    ),
  );
});
financialRouter.get("/payments/:id", async (req, res) => {
  const payment = await prisma.paymentAttempt.findFirst({
    where: { id: uuid.parse(req.params.id), buyerId: req.auth!.sub, mode: mode() },
  });
  if (!payment) throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment not found");
  res.json(serialize(safeOrderPayment(await ownedOrder(payment.orderId, req.auth!.sub), payment, true)));
});
financialRouter.get("/", async (req, res) => {
  const userId = req.auth!.sub;
  const [account, destinations, operations, earnings, held] = await Promise.all([
    prisma.financialAccount.findUnique({ where: { userId_mode: { userId, mode: mode() } } }),
    prisma.bankDestination.findMany({
      where: { userId, mode: mode() },
      select: {
        id: true,
        bankCode: true,
        bankName: true,
        accountName: true,
        accountLastFour: true,
        usable: true,
      },
    }),
    prisma.moneyOperation.findMany({
      where: { ownerId: userId, mode: mode() },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    availableEarnings(userId),
    prisma.tradeOrder.aggregate({
      where: {
        farmerProfile: { userId },
        fundsProvider: "bachs",
        id: {
          in: (
            await prisma.paymentAttempt.findMany({
              where: { mode: mode(), kind: "ORDER" },
              select: { orderId: true },
            })
          ).map((x) => x.orderId),
        },
      },
      _sum: { heldMinor: true },
    }),
  ]);
  res.json(
    serialize({
      enabled: getConfig().PAYMENTS_ENABLED,
      account: account ? { status: account.status, ready: account.status === "READY" } : null,
      destinations: await Promise.all(
        destinations.map(async ({ bankCode, ...bank }) => ({
          ...bank,
          bankName: await bankName(bankCode, bank.bankName),
        })),
      ),
      operations: operations.map(safeOperation),
      earnings,
      heldMinor: held._sum.heldMinor || 0n,
      payoutFeeMinor: getConfig().BACHS_NGN_PAYOUT_FEE_MINOR || null,
    }),
  );
});
financialRouter.post("/onboarding", async (req, res) => {
  await throttle(req.auth!.sub, "onboarding");
  const input = z
    .object({
      email: z.string().email(),
      firstName: z.string().trim().min(1).max(80),
      lastName: z.string().trim().min(1).max(80),
      entityType: z.enum(["individual", "company"]),
      displayName: z.string().trim().min(2).max(120),
    })
    .strict()
    .parse(req.body);
  const op = await startAccount(req.auth!.sub, input, req);
  if (op.status === "QUEUED") await runMoneyOperation(op.id);
  const account = await prisma.financialAccount.findUnique({
    where: { userId_mode: { userId: req.auth!.sub, mode: mode() } },
  });
  const current = account?.providerAccountId ? await refreshAccount(req.auth!.sub) : null;
  const ready = current?.status === "READY";
  const url =
    current?.providerAccountId && !ready
      ? await bachs.accountLink(current.providerAccountId, `${current.id}:${Date.now()}`)
      : null;
  res.status(ready || url ? 200 : 202).json({ url, ready });
});
financialRouter.post("/onboarding/link", async (req, res) => {
  await throttle(req.auth!.sub, "onboarding");
  paymentReady("ONBOARD");
  const account = await refreshAccount(req.auth!.sub);
  const ready = account.status === "READY";
  res.json({
    ready,
    url: ready
      ? null
      : await bachs.accountLink(account.providerAccountId!, `${account.id}:${Date.now()}`),
  });
});
financialRouter.post("/refresh", async (req, res) => {
  await throttle(req.auth!.sub, "account-refresh");
  paymentReady("ONBOARD");
  const account = await refreshAccount(req.auth!.sub);
  const destinations = await prisma.bankDestination.findMany({
    where: { userId: req.auth!.sub, mode: mode() },
  });
  for (const bank of destinations) {
    const remote = await bachs.destination(bank.providerId, account.providerAccountId!);
    await prisma.bankDestination.update({
      where: { id: bank.id },
      data: {
        usable:
          remote.id === bank.providerId &&
          remote.is_usable === true &&
          remote.account_number?.slice(-4) === bank.accountLastFour,
      },
    });
  }
  res.json({ ready: account.status === "READY" });
});
financialRouter.get("/banks", async (_req, res) => {
  paymentReady("DESTINATION");
  const result = await bachs.banks();
  const rows = Array.isArray(result) ? result : result.banks || result.data || [];
  res.json({ items: z.array(z.object({ code: z.string(), name: z.string() })).parse(rows) });
});
financialRouter.post("/banks", async (req, res) => {
  await throttle(req.auth!.sub, "bank");
  const input = z
    .object({
      bankCode: z.string().regex(/^[\w-]{2,20}$/),
      accountNumber: z.string().regex(/^\d{10}$/),
    })
    .strict()
    .parse(req.body);
  const op = await addBank(req.auth!.sub, input, req);
  if (op.status === "QUEUED") await runMoneyOperation(op.id);
  res.status(202).json({ id: op.id });
});
// Read-only progress for the signed-in customer's bank verification operation.
financialRouter.get("/banks/operations/:id", async (req, res) => {
  const operation = await prisma.moneyOperation.findFirst({
    where: {
      id: uuid.parse(req.params.id),
      ownerId: req.auth!.sub,
      mode: mode(),
      kind: "DESTINATION",
    },
  });
  if (!operation)
    throw new AppError(404, "BANK_NOT_FOUND", "This bank verification could not be found.");
  const destination = operation.providerRef
    ? await prisma.bankDestination.findFirst({
        where: { userId: req.auth!.sub, mode: mode(), providerId: operation.providerRef },
        select: {
          id: true,
          bankName: true,
          bankCode: true,
          accountName: true,
          accountLastFour: true,
          usable: true,
        },
      })
    : null;
  const resolvedDestination = destination
    ? {
        id: destination.id,
        accountName: destination.accountName,
        accountLastFour: destination.accountLastFour,
        usable: destination.usable,
        bankName: await bankName(destination.bankCode, destination.bankName),
      }
    : null;
  res.json({ status: operation.status, destination: resolvedDestination });
});
financialRouter.post("/withdrawals", async (req, res) => {
  const input = z
    .object({
      destinationId: uuid,
      amountMinor: money,
      feeMinor: z.string().regex(/^\d{1,12}$/),
      mutationKey: uuid,
    })
    .strict()
    .parse(req.body);
  if (input.feeMinor !== getConfig().BACHS_NGN_PAYOUT_FEE_MINOR)
    throw new AppError(
      409,
      "PAYOUT_FEE_CHANGED",
      "The withdrawal fee changed. Please review it again.",
    );
  const op = await requestWithdrawal(
    req.auth!.sub,
    input.destinationId,
    BigInt(input.amountMinor),
    input.mutationKey,
  );
  res.status(202).json(serialize(safeOperation(op)));
});
moneyAdminRouter.get("/", async (_req, res) => {
  const [operations, payments, webhooks, reconciliations] = await Promise.all([
    prisma.moneyOperation.findMany({
      where: { mode: mode() },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.paymentAttempt.findMany({
      where: { mode: mode() },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.moneyWebhook.findMany({
      where: { mode: mode(), status: { not: "PROCESSED" } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.moneyReconciliation.findMany({
      where: { mode: mode() },
      orderBy: { createdAt: "desc" },
      take: 7,
    }),
  ]);
  res.json(
    serialize({
      operations: operations.map((op) => ({
        ...op,
        encryptedPayload: undefined,
        payload: undefined,
      })),
      payments,
      webhooks,
      reconciliations,
      readiness: {
        mode: mode(),
        enabled: getConfig().PAYMENTS_ENABLED,
        webhookConfigured: !!getConfig().BACHS_WEBHOOK_SECRET,
        organizationConfigured: !!getConfig().BACHS_ORGANIZATION_ID,
        liveMoney: getConfig().PAYMENTS_LIVE_MONEY,
        bankRefundsVerified: getConfig().BACHS_BANK_REFUNDS_VERIFIED,
      },
    }),
  );
});
moneyAdminRouter.post("/readiness", requirePermission("payments.manage"), async (_req, res) => {
  const account = await bachs.account();
  res.json({
    organizationMatches: account.id === getConfig().BACHS_ORGANIZATION_ID,
    capabilities: account.enabled_capabilities || [],
    currencies: account.balance_currencies || [],
  });
});
moneyAdminRouter.post("/reconcile", requirePermission("payments.manage"), async (req, res) => {
  const result = await reconcileBalances();
  await audit(req, {
    action: "payments.reconciliation",
    entityType: "reconciliation",
    entityId: result.id,
  });
  res.json(serialize(result));
});
moneyAdminRouter.post(
  "/orders/:id/release",
  requirePermission("payments.manage"),
  requireRecentStepUp,
  async (req, res) => {
    z.object({ reason }).strict().parse(req.body);
    res
      .status(202)
      .json(serialize(safeOperation(await requestRelease(uuid.parse(req.params.id), req))));
  },
);
moneyAdminRouter.post(
  "/orders/:id/refund",
  requirePermission("payments.manage"),
  requireRecentStepUp,
  async (req, res) => {
    z.object({
      reason,
      shippingRefundMinor: z.string().regex(/^\d{1,16}$/),
      destinationId: uuid.optional(),
    })
      .strict()
      .parse(req.body);
    res
      .status(202)
      .json(
        serialize(
          await requestRefund(uuid.parse(req.params.id), req).then((ops) => ops.map(safeOperation)),
        ),
      );
  },
);
moneyAdminRouter.post(
  "/orders/:id/resolve-hold",
  requirePermission("payments.manage"),
  requireRecentStepUp,
  async (req, res) => {
    z.object({ reason }).strict().parse(req.body);
    const orderId = uuid.parse(req.params.id);
    const disputes = await prisma.moneyOperation.findMany({
      where: { orderId, mode: mode(), kind: "DISPUTE" },
    });
    for (const dispute of disputes) {
      const remote = await bachs.call(
        `/disputes/${encodeURIComponent((dispute.payload as any).providerDisputeId)}`,
      );
      if (!["won", "closed_won"].includes(remote.status))
        throw new AppError(
          409,
          "DISPUTE_UNRESOLVED",
          "The payment provider has not resolved this dispute in your favour.",
        );
    }
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM trade_orders WHERE id=${orderId}::uuid FOR UPDATE`;
      const order = await tx.tradeOrder.findUniqueOrThrow({ where: { id: orderId } });
      if (order.fundsProvider !== "bachs" || !order.financialHold)
        throw new AppError(409, "STALE_RECORD", "This order is not awaiting a financial review.");
      if (
        (await tx.paymentAttempt.count({
          where: { orderId, mode: mode(), status: "EXCEPTION" },
        })) ||
        (await tx.supportTicket.count({
          where: { orderId, kind: "DISPUTE", status: { not: "RESOLVED" } },
        })) ||
        (await tx.moneyOperation.count({
          where: {
            orderId,
            mode: mode(),
            kind: { not: "DISPUTE" },
            status: { in: ["UNKNOWN", "PROCESSING", "PROVIDER_PENDING"] },
          },
        }))
      )
        throw new AppError(
          409,
          "REVIEW_INCOMPLETE",
          "Reconcile payments and resolve disputes before completing the review.",
        );
      // Disputes created after the authoritative reads must be reviewed separately.
      if (
        await tx.moneyOperation.count({
          where: {
            orderId,
            mode: mode(),
            kind: "DISPUTE",
            id: { notIn: disputes.map((x) => x.id) },
          },
        })
      )
        throw new AppError(409, "STALE_RECORD", "A new dispute needs review.");
      await tx.tradeOrder.update({ where: { id: orderId }, data: { financialHold: false } });
      await tx.moneyOperation.updateMany({
        where: { id: { in: disputes.map((x) => x.id) } },
        data: { status: "RESOLVED" },
      });
      await audit(
        req,
        { action: "payment.hold.resolved", entityType: "order", entityId: orderId },
        tx,
      );
    });
    res.json({ resolved: true });
  },
);
// Exception receipts remain unallocated: refund them without touching order stock or held produce.
moneyAdminRouter.post(
  "/payments/:id/refund",
  requirePermission("payments.manage"),
  requireRecentStepUp,
  async (req, res) => {
    const input = z.object({ reason, destinationId: uuid.optional() }).strict().parse(req.body);
    paymentReady("REFUND");
    const paymentId = uuid.parse(req.params.id);
    const op = await prisma.$transaction(async (tx) => {
      const payment = await tx.paymentAttempt.findUniqueOrThrow({ where: { id: paymentId } });
      await tx.$queryRaw`SELECT id FROM trade_orders WHERE id=${payment.orderId}::uuid FOR UPDATE`;
      if (
        payment.mode !== mode() ||
        payment.status !== "EXCEPTION" ||
        !payment.chargeId ||
        payment.paidMinor <= 0n
      )
        throw new AppError(
          409,
          "REFUND_BLOCKED",
          "This payment must be reconciled before it can be refunded.",
        );
      const previous = await tx.moneyOperation.findFirst({
        where: {
          paymentId,
          kind: { in: ["REFUND", "REFUND_TRANSFER", "REFUND_PAYOUT"] },
          status: { not: "FAILED" },
        },
      });
      if (previous) return previous;
      const bank = payment.method?.toUpperCase().includes("TRANSFER");
      if (bank && !getConfig().BACHS_BANK_REFUNDS_VERIFIED)
        throw new AppError(
          409,
          "BANK_REFUND_UNAVAILABLE",
          "Bank refund setup is not complete. Contact support.",
        );
      const result = await createOperation(tx, {
        ownerId: payment.buyerId,
        actorId: req.auth!.sub,
        orderId: payment.orderId,
        paymentId,
        kind: bank ? "REFUND_TRANSFER" : "REFUND",
        key: `${paymentId}:${await tx.moneyOperation.count({ where: { paymentId, mode: mode(), kind: { in: ["REFUND", "REFUND_TRANSFER"] }, status: "FAILED" } })}`,
        amountMinor: payment.paidMinor,
        payload: {
          exception: true,
          produceMinor: "0",
          shippingMinor: "0",
          reason: input.reason,
          destinationId: input.destinationId || null,
        },
      });
      await audit(
        req,
        {
          action: "payment.exception.refund.requested",
          entityType: "payment",
          entityId: paymentId,
        },
        tx,
      );
      return result;
    });
    res.status(202).json(serialize(safeOperation(op)));
  },
);
moneyAdminRouter.post(
  "/operations/:id/approve",
  requirePermission("payments.manage"),
  requireRecentStepUp,
  async (req, res) => {
    z.object({ reason }).strict().parse(req.body);
    const operationId = uuid.parse(req.params.id);
    await prisma.$transaction(async (tx) => {
      const op = await tx.moneyOperation.findUniqueOrThrow({ where: { id: operationId } });
      await accountLock(tx, op.ownerId);
      if (op.mode !== mode() || op.kind !== "PAYOUT" || op.status !== "REQUESTED")
        throw new AppError(409, "STALE_RECORD", "This withdrawal has already been reviewed.");
      await tx.moneyOperation.update({
        where: { id: op.id },
        data: { actorId: req.auth!.sub, status: "QUEUED", nextRunAt: new Date() },
      });
      await audit(
        req,
        { action: "withdrawal.approved", entityType: "money_operation", entityId: op.id },
        tx,
      );
    });
    res.status(202).json({ queued: true });
  },
);
moneyAdminRouter.post(
  "/operations/:id/reject",
  requirePermission("payments.manage"),
  requireRecentStepUp,
  async (req, res) => {
    z.object({ reason }).strict().parse(req.body);
    const op = await prisma.moneyOperation.findUniqueOrThrow({
      where: { id: uuid.parse(req.params.id) },
    });
    if (op.mode !== mode() || op.kind !== "PAYOUT" || op.status !== "REQUESTED")
      throw new AppError(409, "STALE_RECORD", "This withdrawal has already been reviewed.");
    await prisma.moneyOperation.updateMany({
      where: { id: op.id, status: "REQUESTED" },
      data: { status: "FAILED", failureCode: "STAFF_REJECTED", actorId: req.auth!.sub },
    });
    await audit(req, {
      action: "withdrawal.rejected",
      entityType: "money_operation",
      entityId: op.id,
    });
    res.json({ rejected: true });
  },
);
moneyAdminRouter.post(
  "/operations/:id/reconcile",
  requirePermission("payments.manage"),
  requireRecentStepUp,
  async (req, res) => {
    z.object({ reason }).strict().parse(req.body);
    const op = await prisma.moneyOperation.findUniqueOrThrow({
      where: { id: uuid.parse(req.params.id) },
    });
    if (
      op.mode !== mode() ||
      !["BLOCKED", "UNKNOWN", "PROVIDER_PENDING"].includes(op.status) ||
      op.kind === "DISPUTE"
    )
      throw new AppError(409, "STALE_RECORD", "This operation cannot be retried.");
    if (op.status === "UNKNOWN" && !op.providerRef)
      throw new AppError(
        409,
        "PROVIDER_REFERENCE_REQUIRED",
        "Locate and link the original provider operation before retrying.",
      );
    await prisma.moneyOperation.update({
      where: { id: op.id },
      data: {
        status: op.providerRef ? "PROVIDER_PENDING" : "QUEUED",
        nextRunAt: new Date(),
        leaseUntil: null,
      },
    });
    await audit(req, {
      action: "money.reconciliation.requested",
      entityType: "money_operation",
      entityId: op.id,
    });
    res.status(202).json({ queued: true });
  },
);
moneyAdminRouter.post(
  "/operations/:id/link",
  requirePermission("payments.manage"),
  requireRecentStepUp,
  async (req, res) => {
    const input = z
      .object({ reason, providerRef: z.string().regex(/^[\w-]{3,160}$/) })
      .strict()
      .parse(req.body);
    const op = await prisma.moneyOperation.findUniqueOrThrow({
      where: { id: uuid.parse(req.params.id) },
    });
    if (op.mode !== mode() || op.status !== "UNKNOWN" || op.providerRef || op.kind === "DISPUTE")
      throw new AppError(409, "STALE_RECORD", "This operation cannot be linked automatically.");
    const account = ["PAYOUT", "REFUND_PAYOUT", "DESTINATION"].includes(op.kind)
      ? await paymentAccount(op.ownerId)
      : null;
    const remote =
      op.kind === "CHECKOUT"
        ? await bachs.checkoutState(input.providerRef)
        : op.kind === "ACCOUNT"
          ? await bachs.account(input.providerRef)
          : op.kind === "DESTINATION"
            ? await bachs.destination(input.providerRef, account!.providerAccountId!)
            : await bachs.operation(
                op.kind,
                input.providerRef,
                account?.providerAccountId || undefined,
              );
    const source = op.encryptedPayload ? JSON.parse(decryptSecret(op.encryptedPayload)) : null;
    if (
      op.kind === "ACCOUNT"
        ? !source ||
          remote.id !== input.providerRef ||
          remote.parent_organization_id !== getConfig().BACHS_ORGANIZATION_ID ||
          remote.contact_email !== source.email
        : op.kind === "DESTINATION"
          ? !source ||
            remote.id !== input.providerRef ||
            remote.account_number !== source.accountNumber ||
            remote.bank_code !== source.bankCode ||
            remote.currency !== "NGN"
          : op.kind === "CHECKOUT"
            ? remote.reference !== op.paymentId
            : ["RELEASE", "REFUND_TRANSFER"].includes(op.kind)
              ? remote.description !== `LeetLogic ${op.id}` || remote.transfer_group !== op.orderId
              : remote.reference !== op.id
    )
      throw new AppError(
        409,
        "PAYMENT_REFERENCE_MISMATCH",
        "The provider operation does not match this request.",
      );
    if (op.kind === "CHECKOUT") hostedUrl(remote.checkout_url);
    const changed = await prisma.moneyOperation.updateMany({
      where: { id: op.id, status: "UNKNOWN", providerRef: null },
      data: { providerRef: input.providerRef, status: "PROVIDER_PENDING", nextRunAt: new Date() },
    });
    if (!changed.count)
      throw new AppError(409, "STALE_RECORD", "This operation changed. Refresh and retry.");
    await audit(req, {
      action: "money.reference.linked",
      entityType: "money_operation",
      entityId: op.id,
    });
    res.status(202).json({ queued: true });
  },
);
moneyAdminRouter.post(
  "/operations/:id/refund-bank",
  requirePermission("payments.manage"),
  requireRecentStepUp,
  async (req, res) => {
    const input = z
      .object({ reason, destinationId: uuid, originalPayerVerified: z.literal(true) })
      .strict()
      .parse(req.body);
    const op = await prisma.moneyOperation.findUniqueOrThrow({
      where: { id: uuid.parse(req.params.id) },
    });
    if (
      op.mode !== mode() ||
      op.kind !== "REFUND_TRANSFER" ||
      op.status !== "BLOCKED" ||
      op.providerRef
    )
      throw new AppError(409, "STALE_RECORD", "This refund cannot be changed.");
    const bank = await prisma.bankDestination.findFirst({
      where: { id: input.destinationId, userId: op.ownerId, mode: mode(), usable: true },
    });
    if (!bank) throw new AppError(409, "BANK_NOT_READY", "Choose an approved bank account.");
    await prisma.moneyOperation.update({
      where: { id: op.id },
      data: {
        payload: {
          ...(op.payload as any),
          destinationId: bank.id,
          payerVerifiedAt: new Date().toISOString(),
        },
        status: "QUEUED",
        nextRunAt: new Date(),
      },
    });
    await audit(
      req,
      {
        action: "refund.original_payer.verified",
        entityType: "money_operation",
        entityId: op.id,
        after: { reason: input.reason, destinationId: bank.id },
      },
      undefined,
    );
    res.status(202).json({ queued: true });
  },
);
bachsWebhookRouter.post("/", async (req, res) => {
  const c = getConfig();
  if (
    !c.BACHS_WEBHOOK_SECRET ||
    !Buffer.isBuffer(req.body) ||
    !verifyBachs(
      req.body,
      {
        v2: req.get("x-bachs-signature-v2"),
        timestamp: req.get("x-bachs-timestamp"),
        signature: req.get("x-bachs-signature"),
      },
      c.BACHS_WEBHOOK_SECRET.split(",").map((x) => x.trim()),
    )
  )
    throw new AppError(400, "INVALID_WEBHOOK_SIGNATURE", "Invalid signature");
  let body: unknown;
  try {
    body = JSON.parse(req.body.toString());
  } catch {
    throw new AppError(400, "INVALID_WEBHOOK", "Invalid event");
  }
  const event = z
    .object({
      id: z.string().min(1).max(140),
      type: z.string().min(1).max(100),
      organization_id: z.string(),
      account_id: z.string().optional(),
      account: z.string().optional(),
      data: z.record(z.unknown()),
    })
    .passthrough()
    .parse(body);
  if (
    event.organization_id !== c.BACHS_ORGANIZATION_ID &&
    !(await prisma.financialAccount.count({
      where: { mode: mode(), providerAccountId: event.organization_id },
    }))
  )
    throw new AppError(400, "WEBHOOK_ORGANIZATION_MISMATCH", "Invalid event account");
  const data = event.data;
  const resource = event.type.startsWith("collection.")
    ? data.charge_id
    : event.type.startsWith("checkout.")
      ? data.checkout_id
      : event.type.startsWith("refund.")
        ? data.refund_id
        : event.type.startsWith("payout.")
          ? data.payout_id || data.id
          : event.type.startsWith("transfer.")
            ? data.transfer_id || data.id
            : event.type.startsWith("dispute.")
              ? data.dispute_id || data.id
              : data.account_id || data.id;
  await prisma.moneyWebhook.upsert({
    where: { id: `${mode()}:${event.id}` },
    create: {
      id: `${mode()}:${event.id}`,
      mode: mode(),
      eventType: event.type,
      resourceId: typeof resource === "string" ? resource : null,
      accountId: event.account || event.account_id || event.organization_id,
      bodyHash: createHash("sha256").update(req.body).digest("hex"),
      status: /^(collection|checkout|refund|payout|transfer|dispute|account|capability)\./.test(
        event.type,
      )
        ? "QUEUED"
        : "IGNORED",
    },
    update: {},
  });
  res.status(202).json({ accepted: true });
});
