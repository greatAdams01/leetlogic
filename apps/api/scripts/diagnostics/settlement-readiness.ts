/** Read-only sandbox audit. Never prints credentials or submits provider writes. */
import { prisma } from "@leetlogic/database";
import { getConfig } from "../../src/config.js";
import { bachs } from "../../src/providers/payments/bachs.js";
import { balanceOf } from "../../src/services/payment-worker.js";
const c = getConfig();
if (c.BACHS_MODE !== "sandbox" || !c.BACHS_API_KEY?.startsWith("sk_sandbox_"))
  throw new Error("This diagnostic only permits sandbox reads.");
try {
  const balances = balanceOf(await bachs.balances());
  const operations = await prisma.moneyOperation.findMany({
    where: {
      mode: "sandbox",
      kind: { in: ["RELEASE", "REFUND", "REFUND_TRANSFER", "REFUND_PAYOUT", "PAYOUT"] },
    },
    select: {
      id: true,
      kind: true,
      status: true,
      failureCode: true,
      amountMinor: true,
      providerRef: true,
      paymentId: true,
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const evidence = [];
  const receipts = new Map<string, unknown>();
  for (const op of operations) {
    let remote: unknown = null;
    try {
      if (op.kind === "REFUND" && op.paymentId) {
        const p = await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: op.paymentId } });
        if (p.chargeId) {
          if (!receipts.has(p.id)) {
            const r = await bachs.payment(p.chargeId);
            receipts.set(p.id, {
              status: r.status,
              currency: r.currency,
              refundable: r.is_refundable,
              paymentMatches: r.payment_id === p.chargeId,
            });
          }
          remote = receipts.get(p.id);
        }
      } else if (op.kind === "RELEASE" && op.providerRef) {
        const r = await bachs.operation(op.kind, op.providerRef);
        remote = { status: r.status, currency: r.currency };
      }
    } catch (e: any) {
      remote = { error: e.code || e.name, providerStatus: e.diagnostics?.providerStatus };
    }
    evidence.push({
      ...op,
      amountMinor: undefined,
      providerRef: undefined,
      paymentId: undefined,
      hasProviderReference: !!op.providerRef,
      sufficientAvailableNgn: balances >= op.amountMinor,
      remote,
    });
  }
  console.log(
    JSON.stringify(
      {
        mode: c.BACHS_MODE,
        availableNgnMinor: String(balances),
        enabled: {
          transfers: c.PAYMENTS_TRANSFERS_ENABLED,
          refunds: c.PAYMENTS_REFUNDS_ENABLED,
          payouts: c.PAYMENTS_PAYOUTS_ENABLED,
          bankRefunds: c.BACHS_BANK_REFUNDS_VERIFIED,
        },
        operations: evidence,
      },
      null,
      2,
    ),
  );
} catch (e: any) {
  console.log(
    JSON.stringify({
      error: e.code || e.name,
      providerStatus: e.diagnostics?.providerStatus,
      reason: e.diagnostics?.reason,
    }),
  );
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
