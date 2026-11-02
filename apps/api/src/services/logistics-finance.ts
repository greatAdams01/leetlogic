import { prisma } from "@leetlogic/database";
import { mode, journal } from "./payments.js";
import { getConfig } from "../config.js";
import { AppError } from "../lib/errors.js";
import { audit } from "./audit.js";
import { refreshShippingWallet } from "./recovery-worker.js";
import type { Request } from "express";
/** Pure calculation: never treat unknown/stale provider balances as zero. */
export function shippingFundingRequirement(input: { ready: bigint; committed: bigint; wallet: bigint | null; checkedAt: Date | null; error: boolean; uncertain: boolean; incoming?: bigint }, now = new Date()) {
  const verified = input.wallet !== null && !!input.checkedAt && now.getTime() - input.checkedAt.getTime() <= 300000 && !input.error && !input.uncertain;
  const usable = verified ? (input.wallet! > input.committed ? input.wallet! - input.committed : 0n) : null;
  const need = usable === null ? null : input.ready - usable - (input.incoming ?? 0n);
  return { verified, usableWalletMinor: usable, fundingShortfallMinor: need === null ? null : need > 0n ? need : 0n };
}
export async function logisticsFinance(orderId?: string) {
  const [payments, lines, orders, heart, batches, alerts] = await Promise.all([
    prisma.paymentAttempt.findMany({ where: { mode: mode(), OR: [{ confirmedAt: { not: null } }, { status: { in: ["SUCCEEDED", "REFUNDED"] } }], ...(orderId ? { orderId } : {}) } }),
    prisma.moneyJournalLine.findMany({ where: { journal: { mode: mode(), ...(orderId ? { orderId } : {}) } } }),
    prisma.tradeOrder.findMany({ where: { fundsProvider: "bachs", ...(orderId ? { id: orderId } : {}) }, include: { delivery: { include: { quotes: true, parcels: true } }, farmerProfile: { select: { userId: true } } } }),
    prisma.financeHeartbeat.findUnique({ where: { id: `payment:${mode()}` } }),
    prisma.shippingFundingBatch.findMany({ where: { mode: mode() }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.financeAlert.findMany({ where: { mode: mode(), resolvedAt: null, ...(orderId ? { orderId } : {}) }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  const balances = new Map<string,bigint>();
  for (const line of lines) balances.set(line.account, (balances.get(line.account) ?? 0n) + line.amountMinor);
  const sum = (prefix: string, sign = -1n) => [...balances].filter(([a]) => a.startsWith(prefix)).reduce((n,[,v]) => n + v * sign, 0n);
  let ready = 0n, committed = 0n, uncertain = false;
  const shipments = orders.filter(o => o.delivery && payments.some(p => p.orderId === o.id)).map(o => {
    const d = o.delivery!; const q = d.quotes.find(q => q.id === d.selectedQuoteId);
    const cost = q?.walletMinor ?? q?.amountMinor ?? null;
    const pending = ["PAID","BOOKING_QUEUED","BOOKING_BLOCKED"].includes(d.status) && !d.bookingStartedAt && !d.providerShipmentId;
    const eligible = o.status === "FUNDED" && !o.financialHold && !!q && q.expiresAt > new Date() && d.paidMinor >= q.amountMinor && !d.cancelRequestedAt;
    const unknown = ["BOOKING_UNCERTAIN"].includes(d.status) || !!d.parcels.find(p => p.status === "BOOKING");
    const inProgress = d.status === "BOOKING" && !d.providerShipmentId;
    if (pending && eligible && cost !== null) ready += cost;
    if (inProgress && cost !== null) committed += cost;
    if (unknown || inProgress && !!d.bookingStartedAt) uncertain = true;
    return { orderId: o.id, reference: o.reference, deliveryId: d.id, state: d.status, buyerShippingMinor: d.paidMinor, courierCostMinor: cost, bookingReady: pending && eligible, committed: inProgress, uncertain: unknown, conditionalRecovery: o.status === "CANCELLED" && payments.some(p => p.orderId === o.id && p.status === "EXCEPTION"), quoteExpiresAt: q?.expiresAt ?? null, failureCode: d.failureCode, courier: q?.courier ?? d.courier,
      produceMinor: o.totalMinor, farmerObligationMinor: o.heldMinor, shippingCollectedMinor: payments.filter(p => p.orderId === o.id).reduce((s,p) => s+p.shippingMinor,0n), processingFeesMinor: payments.filter(p=>p.orderId===o.id).reduce((s,p)=>s+p.processingFeeMinor,0n), topupsMinor: payments.filter(p=>p.orderId===o.id&&p.kind==="DELIVERY_TOPUP").reduce((s,p)=>s+p.paidMinor,0n), refundableShippingSurplusMinor: cost !== null && d.paidMinor > cost ? d.paidMinor-cost : 0n };
  });
  const refunds = await prisma.moneyOperation.findMany({ where: { mode: mode(), kind: { in: ["REFUND", "REFUND_TRANSFER", "REFUND_PAYOUT"] }, status: { not: "FAILED" }, ...(orderId ? { orderId } : {}) }, orderBy: { createdAt: "desc" }, select: { status: true, amountMinor: true, paymentId: true, kind: true, feeMinor: true, payload: true } });
  const deadlines = await prisma.fulfillmentDeadline.findMany({ where: { mode: mode(), ...(orderId ? { orderId } : {}) }, orderBy: { refundDueAt: "asc" } });
  const latestRefund = new Map<string, typeof refunds[number]>();
  for (const refund of refunds) if (refund.paymentId && !latestRefund.has(refund.paymentId)) latestRefund.set(refund.paymentId, refund);
  const refundTotal = (states: string[]) => payments.filter(p => p.status !== "REFUNDED" && states.includes(latestRefund.get(p.id)?.status || "")).reduce((total,p) => total+p.paidMinor,0n);
  const operations = await prisma.moneyOperation.findMany({ where: { mode: mode(), kind: "RELEASE", status: "SUCCEEDED", ...(orderId ? { orderId } : {}) }, select: { orderId: true, feeMinor: true } });
  return { mode: mode(), flags: { recovery: getConfig().PAYMENT_RECOVERY_ENABLED, automaticRefunds: getConfig().PAYMENT_AUTO_REFUNDS_ENABLED, funding: getConfig().SHIPPING_FUNDING_ENABLED },
    summary: { verifiedCollectionsMinor: payments.reduce((s,p)=>s+p.paidMinor,0n), processingFeesMinor: payments.reduce((s,p)=>s+p.processingFeeMinor,0n), unallocatedMinor: sum("unallocated:"), farmerAwaitingReleaseMinor: sum("held_produce:"), farmerAvailableMinor: sum("seller_available:"), shippingCollectedMinor: payments.reduce((s,p)=>s+p.shippingMinor,0n), courierCommitmentsMinor: ready+committed, courierChargesMinor: -lines.filter(l=>l.account==="shipping_wallet_asset"&&l.amountMinor<0n).reduce((s,l)=>s+l.amountMinor,0n), earnedCommissionMinor: sum("commission_income"), platformExpensesMinor: sum("shipping_variance_expense",1n)+sum("shipping_refund_expense",1n)+sum("refund_fee_expense",1n)+sum("processing_fee_expense",1n)+sum("processing_fee_collected",1n), refundDueMinor: payments.filter(p=>p.status!=="REFUNDED"&&deadlines.some(d=>d.orderId===p.orderId&&["REFUND_DUE","REFUND_RECONCILIATION"].includes(d.state))).reduce((s,p)=>s+p.paidMinor,0n), refundProcessingMinor: refundTotal(["QUEUED","PROCESSING","PROVIDER_PENDING","UNKNOWN"]), refundCompletedMinor: payments.filter(p=>p.status==="REFUNDED").reduce((s,p)=>s+p.paidMinor,0n), refundBlockedMinor: payments.filter(p=>p.status!=="REFUNDED"&&(latestRefund.get(p.id)?.status==="BLOCKED"||deadlines.some(d=>d.orderId===p.orderId&&d.state==="REFUND_BLOCKED"))).reduce((s,p)=>s+p.paidMinor,0n), externalBusinessBankBalanceMinor: null },
    funding: { ...shippingFundingRequirement({ ready, committed, wallet: heart?.walletMinor ?? null, checkedAt: heart?.walletCheckedAt ?? null, error: !!heart?.walletError, uncertain }), bookingReadyMinor: ready, committedMinor: committed, uncertain, walletMinor: heart?.walletMinor ?? null, checkedAt: heart?.walletCheckedAt ?? null, error: heart?.walletError ?? null, verifiedIncomingFundingMinor: 0n, recordedUnverifiedTransfersMinor: batches.filter(b=>b.state==="TRANSFER_RECORDED").reduce((s,b)=>s+b.amountMinor,0n) },
    heartbeat: { checkedAt: heart?.checkedAt ?? null, stale: !heart || Date.now()-heart.checkedAt.getTime()>60000 },
    shipments: shipments.map(s=>({ ...s, commissionMinor: operations.filter(op=>op.orderId===s.orderId).reduce((n,op)=>n+op.feeMinor,0n), deadline: deadlines.find(d=>d.orderId===s.orderId)??null })), batches: batches.map(b=>({...b,evidence:undefined})), alerts, deadlines,
  };
}
export async function verifyFunding(id: string, req: Request, reason: string, statementReference: string) {
  const wallet = await refreshShippingWallet();
  if (wallet === null) throw new AppError(409, "WALLET_UNVERIFIED", "A fresh provider wallet balance is required.");
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`funding:${mode()}`},0))::text`;
    const b = await tx.shippingFundingBatch.findUniqueOrThrow({ where: { id } });
    if (b.mode !== mode()) throw new AppError(404,"NOT_FOUND","Funding batch not found.");
    if (b.state === "VERIFIED") return b;
    if (b.state !== "TRANSFER_RECORDED" || !b.evidence || !b.transferReference) throw new AppError(409,"FUNDING_EVIDENCE_REQUIRED","Record the transfer and supporting evidence first.");
    // An explicitly recorded statement reconciliation, not an inferred wallet delta or screenshot.
    await journal(tx, `shipping-funding:${b.id}`, [["shipping_wallet_asset", b.amountMinor],["external_business_bank_funding",-b.amountMinor]]);
    const saved = await tx.shippingFundingBatch.update({ where: { id }, data: { state: "VERIFIED", verifiedBy: req.auth!.sub, verifiedAt: new Date(), verificationReason: reason, observedWalletMinor: wallet, evidence: { ...(b.evidence as object), statementReference } } });
    await audit(req,{action:"shipping.funding.verified",entityType:"funding",entityId:id,after:{reason,statementReference,amountMinor:b.amountMinor.toString()}},tx);
    return saved;
  });
}
