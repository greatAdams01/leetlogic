import { isDeepStrictEqual } from "node:util";
import { prisma, type Prisma } from "@leetlogic/database";
import type { Request } from "express";
import { AppError } from "../lib/errors.js";
import { audit } from "./audit.js";
import { allocateVerifiedReceipt, mode, reconcilePayment } from "./payments.js";
import { assertNoDeliverySettlement, deliveryEvent, queuePaidDelivery, shippingProvider } from "./delivery.js";
import { deriveDeliveryInput, deliveryInputHash, shippingOrderInclude, storedDeliveryInput, savedPickup } from "./delivery-quote.js";
import { assertFulfillmentOpen, financeAlert, recoveryEnabled } from "./fulfillment-deadline.js";
const confirmedPickup = (o: any) => ({ ...savedPickup(o), phone: o.farmerProfile.user.phoneE164, name: o.farmerProfile.user.profile?.fullName || o.farmerProfile.farmName, email: o.farmerProfile.user.profile?.email || (o.delivery?.pickup as any)?.email || "" });
const samePickup = (a: unknown, b: unknown) => isDeepStrictEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
const fail = (code = "RECOVERY_CHANGED") => new AppError(409, code, "Recovery details changed or are unavailable. Refresh this case before continuing.");
export async function recoveryOrder(tx: Prisma.TransactionClient, orderId: string) {
  return tx.tradeOrder.findUniqueOrThrow({ where: { id: orderId }, include: { ...shippingOrderInclude, delivery: { include: { quotes: true, parcels: true } }, shipment: true } });
}
async function lock(tx: Prisma.TransactionClient, orderId: string) {
  await tx.$queryRaw`SELECT id FROM trade_orders WHERE id=${orderId}::uuid FOR UPDATE`;
}
export async function ensureRecovery(tx: Prisma.TransactionClient, paymentId: string) {
  if (!recoveryEnabled()) return null;
  const p = await tx.paymentAttempt.findUniqueOrThrow({ where: { id: paymentId } });
  if (p.mode !== mode() || p.kind !== "ORDER" || !p.confirmedAt || p.status !== "EXCEPTION" || p.exceptionCode !== "PAYMENT_ORDER_CHANGED") return null;
  const r = await tx.paymentRecovery.upsert({ where: { paymentId }, create: { paymentId, orderId: p.orderId, mode: p.mode }, update: {} });
  await financeAlert(tx, `recovery:${r.id}`, mode(), "RECOVERY_REQUIRED", p.orderId);
  const d = await tx.delivery.upsert({ where: { orderId: p.orderId }, create: { orderId: p.orderId, status: "RECOVERY_REQUIRED" }, update: {} });
  if (d) await deliveryEvent(tx, d.id, "RECOVERY_REQUIRED", "system", `${r.id}:opened`);
  return r;
}
async function eligible(tx: Prisma.TransactionClient, r: { orderId: string; paymentId: string; allocatedAt: Date | null }) {
  await assertFulfillmentOpen(tx, r.orderId);
  const o = await recoveryOrder(tx, r.orderId);
  const p = await tx.paymentAttempt.findUniqueOrThrow({ where: { id: r.paymentId } });
  if (r.allocatedAt || o.status !== "CANCELLED" || o.heldMinor !== 0n || o.refundedMinor !== 0n || o.releasedMinor !== 0n ||
    o.shipment || !o.delivery || o.delivery.bookingStartedAt || o.delivery.providerShipmentId || o.delivery.parcels.length ||
    p.status !== "EXCEPTION" || p.exceptionCode !== "PAYMENT_ORDER_CHANGED" || !p.confirmedAt || p.paidMinor !== p.amountMinor || p.produceMinor !== o.totalMinor ||
    o.listing.deletedAt || o.listing.status !== "ACTIVE" || o.farmerProfile.verificationStatus !== "APPROVED") throw fail();
  await assertNoDeliverySettlement(tx, o.id);
  if (await tx.escrowEntry.count({ where: { orderId: o.id, kind: "FUND" } }) ||
    await tx.supportTicket.count({ where: { orderId: o.id, kind: "DISPUTE", status: { not: "RESOLVED" } } }) ||
    await tx.moneyOperation.count({ where: { orderId: o.id, kind: "DISPUTE", status: { not: "RESOLVED" } } }) ||
    await tx.paymentAttempt.count({ where: { orderId: o.id, id: { not: p.id }, paidMinor: { gt: 0n } } })) throw fail("RECOVERY_FINANCIAL_REVIEW");
  return { o, p };
}
export async function releaseRecoveryStock(tx: Prisma.TransactionClient, id: string) {
  const r = await tx.paymentRecovery.findUniqueOrThrow({ where: { id } });
  if (!r.reservationActive || r.allocatedAt) return;
  const o = await tx.tradeOrder.findUniqueOrThrow({ where: { id: r.orderId } });
  await tx.$queryRaw`SELECT id FROM listings WHERE id=${o.listingId}::uuid FOR UPDATE`;
  await tx.listing.update({ where: { id: o.listingId }, data: { reservedQuantity: { decrement: o.quantity } } });
  await tx.inventoryMovement.create({ data: { listingId: o.listingId, type: "RELEASE", quantity: o.quantity, referenceType: "recovery", referenceId: r.id } });
  await tx.paymentRecovery.update({ where: { id }, data: { reservationActive: false, reservationUntil: null, farmerConfirmedAt: null, farmerConfirmation: PrismaJsonNull, state: "WAITING_FARMER" } });
}
// Prisma's JSON null sentinel is used to clear confirmation evidence without ambiguous SQL nulls.
import { Prisma as P } from "@leetlogic/database";
const PrismaJsonNull = P.DbNull;
export async function confirmRecoveryFarmer(id: string, input: { pickupDate: string; preparationMinutes: number; notes: string; phoneConfirmation?: boolean }, req: Request) {
  return prisma.$transaction(async tx => {
    const initial = await tx.paymentRecovery.findUniqueOrThrow({ where: { id } }); await lock(tx, initial.orderId);
    let r = await tx.paymentRecovery.findUniqueOrThrow({ where: { id } });
    const { o } = await eligible(tx, r);
    const staff = req.auth!.subject === "admin";
    if ((!staff && req.auth!.sub !== o.farmerProfile.userId) || (staff && !input.phoneConfirmation)) throw new AppError(403, "FARMER_REQUIRED", "Farmer confirmation is required.");
    if (r.reservationActive) await releaseRecoveryStock(tx, r.id);
    await tx.$queryRaw`SELECT id FROM listings WHERE id=${o.listingId}::uuid FOR UPDATE`;
    const listing = await tx.listing.findUniqueOrThrow({ where: { id: o.listingId } });
    if (listing.availableQuantity.minus(listing.reservedQuantity).lt(o.quantity)) throw fail("INVENTORY_UNAVAILABLE");
    const deadline = await tx.fulfillmentDeadline.findUniqueOrThrow({ where: { orderId: o.id } });
    const pickupDate = new Date(`${input.pickupDate}T00:00:00Z`);
    if (!Number.isFinite(pickupDate.getTime()) || pickupDate.toISOString().slice(0,10) !== input.pickupDate || input.pickupDate < new Date().toISOString().slice(0,10)) throw fail("INVALID_PICKUP_DATE");
    const until = new Date(Math.min(Date.now() + 30 * 60000, deadline.refundDueAt.getTime()));
    if (until <= new Date()) throw fail("FULFILLMENT_REFUND_DUE");
    await tx.listing.update({ where: { id: listing.id }, data: { reservedQuantity: { increment: o.quantity } } });
    await tx.inventoryMovement.create({ data: { listingId: listing.id, type: "RESERVE", quantity: o.quantity, referenceType: "recovery", referenceId: id } });
    const confirmation = { pickupDate: input.pickupDate, preparationMinutes: input.preparationMinutes, notes: input.notes, channel: staff ? "STAFF_PHONE" : "FARMER_APP", confirmedBy: req.auth!.sub, pickup: confirmedPickup(o), quantity: o.quantity.toString(), packing: o.packagingSnapshot };
    r = await tx.paymentRecovery.update({ where: { id }, data: { farmerConfirmation: confirmation as any, farmerConfirmedAt: new Date(), reservationActive: true, reservationUntil: until, version: { increment: 1 }, state: "WAITING_BUYER" } });
    await deliveryEvent(tx,o.delivery!.id,"RECOVERY_FARMER_CONFIRMED","farmer",`${r.id}:farmer:${r.version}`,req.auth!.sub);
    await audit(req, { action: "recovery.farmer.confirmed", entityType: "recovery", entityId: id, after: { version: r.version, channel: confirmation.channel } }, tx);
    return r;
  });
}
export async function quoteRecovery(id: string, req: Request) {
  const prepared = await prisma.$transaction(async tx => {
    const r = await tx.paymentRecovery.findUniqueOrThrow({ where: { id } }); await lock(tx, r.orderId);
    const current = await tx.paymentRecovery.findUniqueOrThrow({ where: { id } });
    const { o, p } = await eligible(tx, current);
    if (!current.reservationActive || !current.reservationUntil || current.reservationUntil <= new Date() || !current.farmerConfirmedAt) throw fail("RECOVERY_CONFIRMATION_REQUIRED");
    const confirmation = current.farmerConfirmation as any;
    if (!samePickup(confirmation.pickup, confirmedPickup(o))) throw fail("PICKUP_ADDRESS_MISMATCH");
    const collection = !p.quoteId && p.shippingMinor === 0n;
    const stored = collection ? null : storedDeliveryInput(o.delivery!);
    const input = stored ? deriveDeliveryInput(o, { ...stored, pickupDate: confirmation.pickupDate }) : null;
    // Retire buyer acceptance before any provider call so a concurrent approval cannot use it.
    const r2 = await tx.paymentRecovery.update({ where: { id }, data: { version: { increment: 1 }, state: "WAITING_BUYER" } });
    return { r: r2, o, p, input, expiresAt: new Date(Math.min(current.reservationUntil.getTime(), Date.now() + 15 * 60000)) };
  });
  const rates = prepared.input ? await shippingProvider.quotes({ ...prepared.input, name: prepared.o.listing.title, valueMinor: prepared.o.totalMinor }) : [];
  if (prepared.input && !rates.length) throw fail("NO_DELIVERY_OPTIONS");
  return prisma.$transaction(async tx => {
    await lock(tx, prepared.r.orderId);
    const r = await tx.paymentRecovery.findUniqueOrThrow({ where: { id } }); const { o } = await eligible(tx, r);
    if (r.version !== prepared.r.version || !r.reservationActive || !r.reservationUntil || r.reservationUntil <= new Date()) throw fail();
    if (!samePickup((r.farmerConfirmation as any).pickup, confirmedPickup(o))) throw fail();
    const options = [];
    for (const rate of rates) {
      const q = await tx.deliveryQuote.create({ data: { deliveryId: o.delivery!.id, ...rate, expiresAt: prepared.expiresAt, inputHash: deliveryInputHash(o, prepared.input!) } });
      options.push({ id: q.id, courier: q.courier, shippingMinor: q.amountMinor.toString(), eta: q.eta });
    }
    const snapshot = { quantity: o.quantity.toString(), produceMinor: o.totalMinor.toString(), paidMinor: prepared.p.paidMinor.toString(), originalShippingMinor: prepared.p.shippingMinor.toString(), pickupDate: (r.farmerConfirmation as any).pickupDate, collection: !prepared.input, options, input: prepared.input };
    const proposal = await tx.recoveryProposal.create({ data: { recoveryId: id, version: r.version, snapshot: snapshot as any, expiresAt: prepared.expiresAt, createdBy: req.auth!.sub } });
    await deliveryEvent(tx, o.delivery!.id, "RECOVERY_PROPOSAL", "staff", `${proposal.id}:proposal`, req.auth!.sub);
    await audit(req, { action: "recovery.proposal.created", entityType: "recovery", entityId: id, after: { version: r.version } }, tx);
    return proposal;
  });
}
export async function acceptRecovery(id: string, version: number, quoteId: string | null, accept: boolean, req: Request) {
  return prisma.$transaction(async tx => {
    const initial = await tx.paymentRecovery.findUniqueOrThrow({ where: { id } }); await lock(tx, initial.orderId);
    const r = await tx.paymentRecovery.findUniqueOrThrow({ where: { id } }); const { o } = await eligible(tx, r);
    if (o.buyerId !== req.auth!.sub) throw new AppError(403, "BUYER_REQUIRED", "Only the buyer can accept this recovery.");
    const proposal = await tx.recoveryProposal.findUniqueOrThrow({ where: { recoveryId_version: { recoveryId: id, version } } });
    if (r.version !== version || proposal.expiresAt <= new Date() || !r.reservationActive || !r.reservationUntil || r.reservationUntil <= new Date()) throw fail();
    const snapshot = proposal.snapshot as any;
    if (accept && (snapshot.collection ? quoteId !== null : !snapshot.options.some((q: any) => q.id === quoteId))) throw fail();
    await tx.recoveryProposal.update({ where: { id: proposal.id }, data: accept ? { quoteId, buyerAcceptedAt: new Date(), buyerRejectedAt: null } : { buyerRejectedAt: new Date(), buyerAcceptedAt: null } });
    if (!accept) await releaseRecoveryStock(tx, id);
    await tx.paymentRecovery.update({ where: { id }, data: { state: accept ? "READY_FOR_APPROVAL" : "REFUND_REQUIRED" } });
    if (!accept) await tx.fulfillmentDeadline.update({ where: { orderId: o.id }, data: { state: "REFUND_DUE", nextRunAt: new Date() } });
    await deliveryEvent(tx,o.delivery!.id,accept ? "RECOVERY_BUYER_ACCEPTED" : "RECOVERY_DECLINED","buyer",`${id}:decision:${version}:${accept}`,req.auth!.sub);
    await audit(req, { action: accept ? "recovery.buyer.accepted" : "recovery.buyer.rejected", entityType: "recovery", entityId: id, after: { version, quoteId } }, tx);
  });
}
export async function approveRecovery(id: string, version: number, key: string, req: Request) {
  const initial = await prisma.paymentRecovery.findUniqueOrThrow({ where: { id } });
  if (initial.allocatedAt && initial.approvalKey === key) return initial;
  // Reuses all provider authenticity, reference, amount and currency validation.
  await reconcilePayment(initial.paymentId);
  const result = await prisma.$transaction(async tx => {
    await lock(tx, initial.orderId); const r = await tx.paymentRecovery.findUniqueOrThrow({ where: { id } });
    if (r.allocatedAt && r.approvalKey === key) return r;
    const { o, p } = await eligible(tx, r);
    const proposal = await tx.recoveryProposal.findUniqueOrThrow({ where: { recoveryId_version: { recoveryId: id, version } } });
    const confirmation = r.farmerConfirmation as any;
    if (r.state !== "READY_FOR_APPROVAL" || r.version !== version || !proposal.buyerAcceptedAt || proposal.buyerRejectedAt || proposal.expiresAt <= new Date() ||
      !r.reservationActive || !r.reservationUntil || r.reservationUntil <= new Date() || !samePickup(confirmation.pickup, confirmedPickup(o))) throw fail();
    await tx.$queryRaw`SELECT id FROM listings WHERE id=${o.listingId}::uuid FOR UPDATE`;
    const listing = await tx.listing.findUniqueOrThrow({ where: { id: o.listingId } });
    if (listing.reservedQuantity.lt(o.quantity) || listing.availableQuantity.lt(listing.reservedQuantity)) throw fail("INVENTORY_UNAVAILABLE");
    const snapshot = proposal.snapshot as any;
    let shipping = 0n; let q = null;
    if (!snapshot.collection) {
      q = await tx.deliveryQuote.findUniqueOrThrow({ where: { id: proposal.quoteId! } });
      const input = deriveDeliveryInput(o, { ...snapshot.input, pickupDate: snapshot.pickupDate });
      if (q.deliveryId !== o.delivery!.id || q.expiresAt <= new Date() || q.inputHash !== deliveryInputHash(o, input)) throw fail("STALE_DELIVERY_QUOTE");
      shipping = q.amountMinor;
      await tx.delivery.update({ where: { id: o.delivery!.id }, data: { pickup: input.pickup, destination: input.destination, package: input.parcel, shippingMinor: shipping, selectedQuoteId: q.id, courier: q.courier, status: "PAYMENT_PENDING" } });
    } else await tx.delivery.update({ where: { id: o.delivery!.id }, data: { status: "PICKUP_PENDING", selectedQuoteId: null, shippingMinor: 0n } });
    const updatedOrder = await recoveryOrder(tx, o.id);
    await allocateVerifiedReceipt(tx, p, updatedOrder, p.chargeId!, p.processingFeeMinor);
    await tx.paymentAttempt.update({ where: { id: p.id }, data: { status: "SUCCEEDED", exceptionCode: null } });
    await tx.tradeOrder.update({ where: { id: o.id }, data: { financialHold: false, reservationExpiresAt: null } });
    await tx.delivery.update({ where: { id: o.delivery!.id }, data: { status: snapshot.collection ? "PICKUP_READY" : shipping > p.shippingMinor ? "TOPUP_REQUIRED" : "PAID" } });
    if (snapshot.collection) {
      await tx.fulfillmentDeadline.update({ where: { orderId: o.id }, data: { state: "SECURED", securedAt: new Date(), collectionBuyerAt: proposal.buyerAcceptedAt } });
      await deliveryEvent(tx, o.delivery!.id, "READY_FOR_PICKUP", "farmer", `${o.delivery!.id}:ready`, req.auth!.sub);
    }
    const saved = await tx.paymentRecovery.update({ where: { id }, data: { allocatedAt: new Date(), reservationActive: false, approvalKey: key, state: snapshot.collection ? "FULFILLMENT_STARTED" : shipping > p.shippingMinor ? "AWAITING_TOPUP" : "ALLOCATED" } });
    await tx.financeAlert.updateMany({ where: { orderId: o.id, code: "RECOVERY_REQUIRED" }, data: { resolvedAt: new Date() } });
    await audit(req, { action: "recovery.approved", entityType: "recovery", entityId: id, after: { version, key } }, tx);
    return saved;
  });
  await queuePaidDelivery(result.orderId);
  return result;
}
