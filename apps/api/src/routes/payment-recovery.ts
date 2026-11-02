import type { Router, Request } from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { prisma } from "@leetlogic/database";
import { getConfig } from "../config.js";
import { AppError } from "../lib/errors.js";
import { requirePermission, requireRecentStepUp } from "../middleware/auth.js";
import { audit } from "../services/audit.js";
import { serialize, deliveryEvent } from "../services/delivery.js";
import { mode } from "../services/payments.js";
import { financeEnabled, recoveryEnabled, assertFulfillmentOpen, markFulfillmentSecured } from "../services/fulfillment-deadline.js";
import { approveRecovery, confirmRecoveryFarmer, quoteRecovery, acceptRecovery, releaseRecoveryStock } from "../services/payment-recovery.js";
import { logisticsFinance, verifyFunding } from "../services/logistics-finance.js";
import { refreshShippingWallet, scanFulfillmentDeadlines } from "../services/recovery-worker.js";
import { readMedia, storeMedia, deleteMedia } from "../services/storage/private-media.js";
const uuid = z.string().uuid(), reason = z.string().trim().min(10).max(500);
const enabled = () => { if (!recoveryEnabled()) throw new AppError(404,"RECOVERY_DISABLED","Recovery is not enabled."); };
const funding = () => { if (!getConfig().SHIPPING_FUNDING_ENABLED) throw new AppError(404,"FUNDING_DISABLED","Funding tracking is not enabled."); };
const farmerBody = z.object({ pickupDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), preparationMinutes: z.number().int().min(0).max(1440), notes: z.string().trim().max(700).default(""), phoneConfirmation: z.boolean().optional(), reason: reason.optional() }).strict();
async function caseView(id: string, req: Request) {
  const r = await prisma.paymentRecovery.findFirst({ where: { id, mode: mode() } });
  if (!r) throw new AppError(404,"NOT_FOUND","Recovery not found.");
  const o = await prisma.tradeOrder.findUniqueOrThrow({ where: { id: r.orderId }, include: { listing: { select: { title: true } }, farmerProfile: { select: { userId: true } } } });
  const staff = req.auth!.subject === "admin", buyer = req.auth!.sub === o.buyerId;
  if (!staff && !buyer && req.auth!.sub !== o.farmerProfile.userId) throw new AppError(404,"NOT_FOUND","Recovery not found.");
  const p = await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: r.paymentId } });
  const proposal = await prisma.recoveryProposal.findUnique({ where: { recoveryId_version: { recoveryId: id, version: r.version } } });
  const snapshot = proposal?.snapshot as any;
  return { id:r.id, orderId:o.id, reference:o.reference, title:o.listing.title, quantity:o.quantity, state:r.state, version:r.version, isBuyer:buyer, farmerConfirmedAt:r.farmerConfirmedAt, farmerConfirmation: staff ? r.farmerConfirmation : r.farmerConfirmedAt ? { pickupDate:(r.farmerConfirmation as any)?.pickupDate,preparationMinutes:(r.farmerConfirmation as any)?.preparationMinutes } : null, reservationUntil:r.reservationUntil, allocatedAt:r.allocatedAt,
    payment: buyer||staff ? { paymentConfirmed:!!p.confirmedAt, amountMinor:p.paidMinor, processingFeeMinor:p.processingFeeMinor } : {paymentConfirmed:!!p.confirmedAt},
    proposal: proposal ? {id:proposal.id,version:proposal.version,quoteId:proposal.quoteId,expiresAt:proposal.expiresAt,buyerAcceptedAt:proposal.buyerAcceptedAt,buyerRejectedAt:proposal.buyerRejectedAt,snapshot:{...snapshot,input:undefined}} : null,
    deadline:await prisma.fulfillmentDeadline.findUnique({where:{orderId:o.id}}) };
}
export function installRecoveryRoutes(customer: Router, admin: Router) {
  customer.get("/recoveries", async(req,res)=>{
    if (!recoveryEnabled()) return res.json({enabled:false,items:[]});
    const owned = await prisma.tradeOrder.findMany({ where:{OR:[{buyerId:req.auth!.sub},{farmerProfile:{userId:req.auth!.sub}}]},select:{id:true} });
    const cases = await prisma.paymentRecovery.findMany({where:{mode:mode(),orderId:{in:owned.map(o=>o.id)}},orderBy:{createdAt:"desc"},take:50});
    res.json(serialize({enabled:true,items:await Promise.all(cases.map(r=>caseView(r.id,req)))}));
  });
  customer.get("/recoveries/:recoveryId",async(req,res)=>{enabled();res.json(serialize(await caseView(uuid.parse(req.params.recoveryId),req)));});
  customer.post("/recoveries/:recoveryId/farmer",async(req,res)=>{
    enabled(); const id=uuid.parse(req.params.recoveryId); await caseView(id,req);
    const input=farmerBody.parse(req.body); if(input.phoneConfirmation) throw new AppError(403,"FORBIDDEN","Phone confirmations must be recorded by staff.");
    await confirmRecoveryFarmer(id,input,req);res.json(serialize(await caseView(id,req)));
  });
  customer.post("/recoveries/:recoveryId/decision",async(req,res)=>{
    enabled(); const id=uuid.parse(req.params.recoveryId);await caseView(id,req);
    const input=z.object({version:z.number().int().positive(),quoteId:uuid.nullable(),accept:z.boolean()}).strict().parse(req.body);
    await acceptRecovery(id,input.version,input.quoteId,input.accept,req);res.json(serialize(await caseView(id,req)));
  });
  const refuse=async(req:Request,res:any)=>{
    enabled(); const id=uuid.parse(req.params.recoveryId);await caseView(id,req);
    const input=z.object({reason}).strict().parse(req.body);
    await prisma.$transaction(async tx=>{
      const initial=await tx.paymentRecovery.findUniqueOrThrow({where:{id}});
      await tx.$queryRaw`SELECT id FROM trade_orders WHERE id=${initial.orderId}::uuid FOR UPDATE`;
      const r=await tx.paymentRecovery.findUniqueOrThrow({where:{id}});
      if(r.allocatedAt)throw new AppError(409,"RECOVERY_ALLOCATED","Use the funded-order refund controls.");
      await releaseRecoveryStock(tx,id);
      await tx.paymentRecovery.update({where:{id},data:{state:"REFUND_REQUIRED"}});
      await tx.fulfillmentDeadline.update({where:{orderId:r.orderId},data:{state:"REFUND_DUE",nextRunAt:new Date()}});
      await audit(req,{action:"recovery.refund.selected",entityType:"recovery",entityId:id,after:{reason:input.reason}},tx);
    });res.json({refundDue:true});
  };
  customer.post("/recoveries/:recoveryId/decline",refuse);
  customer.post("/:id/delivery/collection-confirmation",async(req,res)=>{
    if(!financeEnabled())throw new AppError(404,"NOT_FOUND","Not found.");
    const orderId=uuid.parse(req.params.id);
    await prisma.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM trade_orders WHERE id=${orderId}::uuid FOR UPDATE`;
      const o=await tx.tradeOrder.findUnique({where:{id:orderId},include:{delivery:true}});
      if(!o||o.buyerId!==req.auth!.sub)throw new AppError(404,"NOT_FOUND","Order not found.");
      await assertFulfillmentOpen(tx,orderId);
      if(o.status!=="FUNDED"||!o.delivery||!["PICKUP_PREPARING","PICKUP_READY"].includes(o.delivery.status))throw new AppError(409,"DELIVERY_NOT_READY","Pickup arrangement is not ready.");
      await tx.fulfillmentDeadline.update({where:{orderId},data:{collectionBuyerAt:new Date()}});
      if(o.delivery.status==="PICKUP_READY")await markFulfillmentSecured(tx,orderId);
      await deliveryEvent(tx,o.delivery.id,"PICKUP_ARRANGEMENT_ACCEPTED","buyer",`${orderId}:collection-accepted`,req.auth!.sub);
    });res.json({accepted:true});
  });
  admin.get("/finance",async(req,res)=>{
    if(!financeEnabled())return res.json({enabled:false});
    res.json(serialize({enabled:true,...await logisticsFinance(req.query.orderId ? uuid.parse(req.query.orderId):undefined)}));
  });
  admin.post("/finance/refresh",requirePermission("payments.manage"),async(_req,res)=>{
    if(!financeEnabled())throw new AppError(404,"NOT_FOUND","Finance tracking is disabled.");
    await refreshShippingWallet();res.json(serialize(await logisticsFinance()));
  });
  admin.get("/recoveries",async(req,res)=>{
    if(!recoveryEnabled())return res.json({enabled:false,items:[]});
    const rows=await prisma.paymentRecovery.findMany({where:{mode:mode(),...(req.query.orderId?{orderId:uuid.parse(req.query.orderId)}:{})},orderBy:{createdAt:"desc"},take:100});
    res.json(serialize({enabled:true,items:await Promise.all(rows.map(r=>caseView(r.id,req)))}));
  });
  admin.post("/recoveries/backfill",requirePermission("payments.manage"),requireRecentStepUp,async(req,res)=>{
    enabled();const input=z.object({reason,acknowledgeOverdueRefunds:z.literal(true)}).strict().parse(req.body);
    await scanFulfillmentDeadlines();await audit(req,{action:"recovery.backfill",entityType:"recovery",after:{reason:input.reason}});res.json({scanned:true});
  });
  admin.post("/recoveries/:recoveryId/farmer",requirePermission("payments.manage"),requireRecentStepUp,async(req,res)=>{
    enabled();const id=uuid.parse(req.params.recoveryId);await caseView(id,req);const input=farmerBody.extend({reason,phoneConfirmation:z.literal(true)}).parse(req.body);
    await confirmRecoveryFarmer(id,input,req);res.json(serialize(await caseView(id,req)));
  });
  admin.post("/recoveries/:recoveryId/proposal",requirePermission("payments.manage"),requireRecentStepUp,async(req,res)=>{
    enabled();const id=uuid.parse(req.params.recoveryId);await caseView(id,req);z.object({reason}).strict().parse(req.body);
    await quoteRecovery(id,req);res.json(serialize(await caseView(id,req)));
  });
  admin.post("/recoveries/:recoveryId/approve",requirePermission("payments.manage"),requireRecentStepUp,async(req,res)=>{
    enabled();const id=uuid.parse(req.params.recoveryId);await caseView(id,req);const input=z.object({reason,version:z.number().int().positive(),idempotencyKey:uuid}).strict().parse(req.body);
    await approveRecovery(id,input.version,input.idempotencyKey,req);res.json(serialize(await caseView(id,req)));
  });
  admin.post("/recoveries/:recoveryId/decline",requirePermission("payments.manage"),requireRecentStepUp,refuse);
  admin.post("/funding",requirePermission("payments.manage"),requireRecentStepUp,async(req,res)=>{
    funding();const input=z.object({amountMinor:z.string().regex(/^[1-9]\d{0,15}$/),sourceLabel:z.string().trim().min(2).max(120),destination:z.string().trim().min(3).max(240),shipmentIds:z.array(uuid).min(1).max(100),reason}).strict().parse(req.body);
    const shipments=await prisma.delivery.findMany({where:{id:{in:input.shipmentIds},order:{fundsProvider:"bachs",status:"FUNDED"}}});
    const known=await prisma.paymentAttempt.count({where:{orderId:{in:shipments.map(s=>s.orderId)},mode:mode(),status:"SUCCEEDED"}});
    if(shipments.length!==new Set(input.shipmentIds).size||known<shipments.length)throw new AppError(409,"FUNDING_SHIPMENTS_CHANGED","Choose funded shipments in the current environment.");
    const b=await prisma.shippingFundingBatch.create({data:{mode:mode(),amountMinor:BigInt(input.amountMinor),sourceLabel:input.sourceLabel,destination:input.destination,shipmentIds:input.shipmentIds,initiatedBy:req.auth!.sub}});
    await audit(req,{action:"shipping.funding.planned",entityType:"funding",entityId:b.id,after:{reason:input.reason}});res.status(201).json(serialize(b));
  });
  admin.post("/funding/:id/record",requirePermission("payments.manage"),requireRecentStepUp,async(req,res)=>{
    funding();const id=uuid.parse(req.params.id);const input=z.object({transferReference:z.string().trim().min(3).max(160),statementReference:z.string().trim().min(5).max(500),reason}).strict().parse(req.body);
    await prisma.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM shipping_funding_batches WHERE id=${id}::uuid FOR UPDATE`;
      const b=await tx.shippingFundingBatch.findFirst({where:{id,mode:mode()}});
      if(!b||b.state!=="PLANNED")throw new AppError(409,"FUNDING_CHANGED","This funding batch cannot be changed.");
      await tx.shippingFundingBatch.update({where:{id},data:{state:"TRANSFER_RECORDED",transferReference:input.transferReference,transferKey:`${mode()}:${input.transferReference}`,evidence:{...(b.evidence as any||{}),statementReference:input.statementReference}}});
      await audit(req,{action:"shipping.funding.recorded",entityType:"funding",entityId:id,after:{reason:input.reason}},tx);
    });res.json({recorded:true});
  });
  admin.post("/funding/:id/evidence",requirePermission("payments.manage"),requireRecentStepUp,async(req,res)=>{
    funding();const id=uuid.parse(req.params.id);const input=z.object({base64:z.string().max(700000),mime:z.enum(["application/pdf","image/png","image/jpeg"])}).strict().parse(req.body);
    const b=await prisma.shippingFundingBatch.findFirst({where:{id,mode:mode(),state:{in:["PLANNED","TRANSFER_RECORDED"]}}});
    if(!b)throw new AppError(404,"NOT_FOUND","Funding batch not found.");
    const bytes=Buffer.from(input.base64,"base64");const valid=input.mime==="application/pdf"?bytes.subarray(0,5).toString()==="%PDF-":input.mime==="image/png"?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
    if(!valid||!bytes.length||bytes.length>512000)throw new AppError(422,"INVALID_FILE","Use a PDF, PNG or JPEG up to 500 KB.");
    const key=await storeMedia(bytes,input.mime,`funding/${id}/${randomUUID()}`);
    try { await prisma.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM shipping_funding_batches WHERE id=${id}::uuid FOR UPDATE`;
      const current=await tx.shippingFundingBatch.findUniqueOrThrow({where:{id}});
      if(!["PLANNED","TRANSFER_RECORDED"].includes(current.state))throw new AppError(409,"FUNDING_CHANGED","Funding batch is no longer editable.");
      await tx.shippingFundingBatch.update({where:{id},data:{evidence:{...(current.evidence as any||{}),key,mime:input.mime}}});
      await audit(req,{action:"shipping.funding.evidence",entityType:"funding",entityId:id},tx);
    }); }catch(error){await deleteMedia(key).catch(()=>{});throw error;}res.json({saved:true});
  });
  admin.get("/funding/:id/evidence",async(req,res)=>{
    funding();const b=await prisma.shippingFundingBatch.findFirst({where:{id:uuid.parse(req.params.id),mode:mode()}});const e=b?.evidence as any;
    if(!e?.key)throw new AppError(404,"NOT_FOUND","No private funding evidence.");
    res.set({"Content-Type":e.mime,"Cache-Control":"private, no-store","Content-Security-Policy":"sandbox","X-Content-Type-Options":"nosniff"}).send(await readMedia(e.key));
  });
  admin.post("/funding/:id/verify",requirePermission("payments.manage"),requireRecentStepUp,async(req,res)=>{
    funding();const input=z.object({reason,statementReference:z.string().trim().min(10).max(500),reconciledStatement:z.literal(true)}).strict().parse(req.body);
    res.json(serialize(await verifyFunding(uuid.parse(req.params.id),req,input.reason,input.statementReference)));
  });
  admin.post("/funding/:id/close",requirePermission("payments.manage"),requireRecentStepUp,async(req,res)=>{
    funding();const input=z.object({reason,state:z.enum(["FAILED","CANCELLED"])}).strict().parse(req.body);
    const changed=await prisma.shippingFundingBatch.updateMany({where:{id:uuid.parse(req.params.id),mode:mode(),state:{in:["PLANNED","TRANSFER_RECORDED"]}},data:{state:input.state}});
    if(!changed.count)throw new AppError(409,"FUNDING_CHANGED","Only unverified batches may be closed.");
    await audit(req,{action:"shipping.funding.closed",entityType:"funding",entityId:String(req.params.id),after:input});res.json({closed:true});
  });
}
