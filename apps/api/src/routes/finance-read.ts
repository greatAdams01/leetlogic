import type { Router } from "express";
import { z } from "zod";
import { prisma } from "@leetlogic/database";
import { mode } from "../services/payments.js";
import { serialize } from "../services/delivery.js";
import { AppError } from "../lib/errors.js";
const query = z.object({
  type: z.enum(["payments", "operations"]).default("operations"),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  search: z.string().trim().max(160).default(""),
  status: z
    .string()
    .regex(/^[A-Z_]{1,40}$/)
    .default("ALL"),
  kind: z
    .string()
    .regex(/^[A-Z_]{1,40}$/)
    .optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  orderId: z.string().uuid().optional(),
});
const safe = (row: any) => ({ ...row, encryptedPayload: undefined, payload: undefined });
export function installFinanceReadRoutes(router: Router) {
  router.get("/ledger", async (req, res) => {
    const q = z
      .object({
        page: z.coerce.number().int().min(1).max(100000).default(1),
        search: z.string().max(160).default(""),
        source: z.enum(["provider", "legacy"]).default("provider"),
        orderId: z.string().uuid().optional(),
      })
      .parse(req.query);
    const receipts =
      q.source === "provider"
        ? await prisma.paymentAttempt.findMany({
            where: { mode: mode() },
            distinct: ["orderId"],
            select: { orderId: true },
          })
        : [];
    const where = {
      ...(q.orderId ? { id: q.orderId } : {}),
      ...(q.source === "provider"
        ? {
            id: { in: receipts.map((p) => p.orderId), ...(q.orderId ? { equals: q.orderId } : {}) },
          }
        : { OR: [{ fundsProvider: null }, { fundsProvider: { not: "bachs" } }] }),
      ...(q.search ? { reference: { contains: q.search, mode: "insensitive" as const } } : {}),
    };
    const [orders, total] = await Promise.all([
      prisma.tradeOrder.findMany({
        where,
        include: { ledger: true },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (q.page - 1) * 20,
        take: 20,
      }),
      prisma.tradeOrder.count({ where }),
    ]);
    const items = orders.map((o) => {
      const amount = (kind: string) =>
        o.ledger.filter((l) => l.kind === kind).reduce((n, l) => n + l.amountMinor, 0n);
      const funded = amount("FUND"),
        released = amount("RELEASE"),
        refunded = amount("REFUND");
      return {
        id: o.id,
        reference: o.reference,
        heldMinor: o.heldMinor,
        releasedMinor: released,
        refundedMinor: refunded,
        fundedMinor: funded,
        createdAt: o.createdAt,
        balanced:
          funded - released - refunded === o.heldMinor &&
          released === o.releasedMinor &&
          refunded === o.refundedMinor,
      };
    });
    res.json(
      serialize({ items, total, page: q.page, mode: q.source === "provider" ? mode() : "legacy" }),
    );
  });
  router.get("/summary", async (req, res) => {
    const scope = req.query.orderId ? { orderId: z.string().uuid().parse(req.query.orderId) } : {};
    const verified = {
      ...scope,
      mode: mode(),
      paidMinor: { gt: 0n },
      OR: [{ confirmedAt: { not: null } }, { status: { in: ["SUCCEEDED", "REFUNDED"] } }],
    };
    const receiptOrders = await prisma.paymentAttempt.findMany({
      where: { mode: mode(), ...scope },
      distinct: ["orderId"],
      select: { orderId: true },
    });
    const orderScope = { id: { in: receiptOrders.map((p) => p.orderId) } };
    const [payments, states, operations, balances, daily, orderStates, ledgerStates] =
      await Promise.all([
        prisma.paymentAttempt.aggregate({
          where: verified,
          _sum: { paidMinor: true, shippingMinor: true, processingFeeMinor: true },
          _count: true,
        }),
        prisma.paymentAttempt.groupBy({
          by: ["status"],
          where: { ...scope, mode: mode() },
          _count: true,
          _sum: { paidMinor: true },
        }),
        prisma.moneyOperation.groupBy({
          by: ["status"],
          where: { ...scope, mode: mode() },
          _count: true,
          _sum: { amountMinor: true },
        }),
        prisma.moneyJournalLine.groupBy({
          by: ["account"],
          where: { journal: { ...scope, mode: mode() } },
          _sum: { amountMinor: true },
        }),
        prisma.$queryRaw<
          Array<{ day: string; amountMinor: bigint }>
        >`SELECT to_char("confirmedAt" AT TIME ZONE 'Africa/Lagos','YYYY-MM-DD') AS day, SUM("paidMinor")::bigint AS "amountMinor" FROM payment_attempts WHERE mode=${mode()} AND "confirmedAt">=date_trunc('day',NOW() AT TIME ZONE 'Africa/Lagos') AT TIME ZONE 'Africa/Lagos' - INTERVAL '6 days' AND "paidMinor">0 AND (${scope.orderId ?? null}::uuid IS NULL OR "orderId"=${scope.orderId ?? null}::uuid) GROUP BY day ORDER BY day`,
        prisma.tradeOrder.groupBy({
          by: ["status"],
          where: orderScope,
          _count: true,
          _sum: { totalMinor: true, heldMinor: true, releasedMinor: true, refundedMinor: true },
        }),
        prisma.escrowEntry.groupBy({
          by: ["kind"],
          where: { order: orderScope },
          _count: true,
          _sum: { amountMinor: true, feeMinor: true },
        }),
      ]);
    const balance = (prefix: string, sign = -1n) =>
      balances
        .filter((b) => b.account.startsWith(prefix))
        .reduce((sum, b) => sum + (b._sum.amountMinor ?? 0n) * sign, 0n);
    res.json(
      serialize({
        mode: mode(),
        asOf: new Date(),
        collectionsMinor: payments._sum.paidMinor ?? 0n,
        shippingMinor: payments._sum.shippingMinor ?? 0n,
        processingFeesMinor: payments._sum.processingFeeMinor ?? 0n,
        verifiedCount: payments._count,
        unallocatedMinor: balance("unallocated:"),
        farmerHeldMinor: balance("held_produce:"),
        farmerAvailableMinor: balance("seller_available:"),
        commissionMinor: balance("commission_income"),
        refundedMinor: states
          .filter((s) => s.status === "REFUNDED")
          .reduce((n, s) => n + (s._sum.paidMinor ?? 0n), 0n),
        orderStates,
        ledgerStates,
        paymentStates: states,
        operationStates: operations,
        daily,
      }),
    );
  });
  router.get("/records", async (req, res) => {
    const q = query.parse(req.query);
    if (q.from && q.to && q.from > q.to)
      throw new AppError(422, "INVALID_DATE_RANGE", "End date must be on or after start date.");
    const from = q.from ? new Date(`${q.from}T00:00:00+01:00`) : undefined;
    const to = q.to ? new Date(new Date(`${q.to}T00:00:00+01:00`).getTime() + 86400000) : undefined;
    const isPayment = q.type === "payments";
    const delegate = isPayment ? prisma.paymentAttempt : prisma.moneyOperation;
    const orders = q.search
      ? await prisma.tradeOrder.findMany({
          where: { reference: { contains: q.search, mode: "insensitive" } },
          select: { id: true },
          take: 1000,
        })
      : [];
    const id = z.string().uuid().safeParse(q.search);
    const where: any = {
      mode: mode(),
      ...(q.orderId ? { orderId: q.orderId } : {}),
      ...(q.status !== "ALL" ? { status: q.status } : {}),
      ...(q.kind ? { kind: q.kind } : {}),
      ...(from || to
        ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } }
        : {}),
      ...(q.search
        ? {
            OR: [
              ...(id.success ? [{ id: id.data }, { orderId: id.data }] : []),
              { orderId: { in: orders.map((o) => o.id) } },
              {
                [isPayment ? "chargeId" : "providerRef"]: {
                  contains: q.search,
                  mode: "insensitive",
                },
              },
              ...(isPayment ? [{ checkoutId: { contains: q.search, mode: "insensitive" } }] : []),
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      (delegate as any).findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (q.page - 1) * 20,
        take: 20,
      }),
      (delegate as any).count({ where }),
    ]);
    const refs = await prisma.tradeOrder.findMany({
      where: { id: { in: items.map((r: any) => r.orderId).filter(Boolean) } },
      select: { id: true, reference: true },
    });
    res.json(
      serialize({
        items: items.map((r: any) => ({
          ...safe(r),
          orderReference: refs.find((o) => o.id === r.orderId)?.reference,
        })),
        total,
        page: q.page,
        pageSize: 20,
        mode: mode(),
      }),
    );
  });
  router.get("/records/:type/:id", async (req, res) => {
    const type = z.enum(["payments", "operations"]).parse(req.params.type),
      id = z.string().uuid().parse(req.params.id);
    const item = await (
      type === "payments" ? prisma.paymentAttempt : (prisma.moneyOperation as any)
    ).findFirst({ where: { id, mode: mode() } });
    if (!item) throw new AppError(404, "NOT_FOUND", "Finance record not found.");
    const order = item.orderId
      ? await prisma.tradeOrder.findUnique({
          where: { id: item.orderId },
          select: { id: true, reference: true, status: true },
        })
      : null;
    res.json(
      serialize({ ...safe(item), orderReference: order?.reference, orderStatus: order?.status }),
    );
  });
}
