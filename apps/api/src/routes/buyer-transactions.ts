import { liveStatuses } from "../services/payments.js";
import { Router, raw } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@leetlogic/database";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { AppError } from "../lib/errors.js";
import { serialize } from "../services/delivery.js";
import { audit } from "../services/audit.js";
import { imageType } from "./produce-photos.js";
import { storeMedia, readMedia, deleteMedia } from "../services/storage/private-media.js";
export const buyerTransactionsRouter = Router();
export const disputeEvidenceAdminRouter = Router();
buyerTransactionsRouter.use(requireAuth("customer"));
disputeEvidenceAdminRouter.use(requireAuth("admin"), requirePermission("disputes.manage"));
const id = z.string().uuid();
buyerTransactionsRouter.get("/escrow-summary", async (req, res) => {
  const held = await prisma.tradeOrder.aggregate({
    where: { buyerId: req.auth!.sub, heldMinor: { gt: 0n } },
    _sum: { heldMinor: true },
    _count: true,
  });
  const activeDispatch = await prisma.delivery.count({
    where: {
      order: { buyerId: req.auth!.sub },
      status: { in: ["BOOKED", "PICKED_UP", "IN_TRANSIT", "FAILED_ATTEMPT", "RETURNING"] },
    },
  });
  res.json({
    activeDispatch,
    heldMinor: (held._sum.heldMinor || 0n).toString(),
    orderCount: held._count,
    currency: "NGN",
  });
});
async function ownedOrder(orderId: string, buyerId: string) {
  const order = await prisma.tradeOrder.findFirst({ where: { id: orderId, buyerId } });
  if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found.");
  return order;
}
buyerTransactionsRouter.get("/:id/disputes", async (req, res) => {
  const orderId = id.parse(req.params.id);
  const order = await ownedOrder(orderId, req.auth!.sub);
  const items = await prisma.supportTicket.findMany({
    where: { orderId, kind: "DISPUTE" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      subject: true,
      status: true,
      resolution: true,
      createdAt: true,
      updatedAt: true,
      messages: {
        where: { internal: false },
        select: { id: true, body: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
      evidence: { select: { id: true, createdAt: true } },
    },
  });
  res.json({ items, canOpen: order.heldMinor > 0n });
});
buyerTransactionsRouter.post("/:id/disputes", async (req, res) => {
  const orderId = id.parse(req.params.id);
  const body = z
    .object({
      reason: z.enum(["NOT_RECEIVED", "QUALITY", "WRONG_ITEM", "QUANTITY", "OTHER"]),
      description: z.string().trim().min(10).max(5000),
      sourceLocale: z.enum(["en", "pcm", "ha", "ig", "yo"]).default("en"),
    })
    .strict()
    .parse(req.body);
  const item = await prisma.$transaction(async (tx) => {
    // Release requests acquire this same lock. Never accept a dispute behind an in-flight transfer.
    await tx.$queryRaw`SELECT id FROM trade_orders WHERE id=${orderId}::uuid FOR UPDATE`;
    const order = await tx.tradeOrder.findFirst({ where: { id: orderId, buyerId: req.auth!.sub } });
    if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found.");
    const existing = await tx.supportTicket.findFirst({
      where: { orderId, kind: "DISPUTE", status: { not: "RESOLVED" } },
    });
    if (existing) return existing;
    if (order.heldMinor <= 0n)
      throw new AppError(
        409,
        "NO_HELD_FUNDS",
        "This order has no funds held in escrow. Contact support for help.",
      );
    if (
      await tx.moneyOperation.count({
        where: { orderId, kind: "RELEASE", status: { in: liveStatuses } },
      })
    )
      throw new AppError(
        409,
        "SETTLEMENT_STARTED",
        "Payment settlement has already started. Contact support immediately for help with this order.",
      );
    const ticket = await tx.supportTicket.create({
      data: {
        orderId,
        userId: req.auth!.sub,
        kind: "DISPUTE",
        subject: {
          NOT_RECEIVED: "Order not received",
          QUALITY: "Produce quality",
          WRONG_ITEM: "Wrong produce",
          QUANTITY: "Incorrect quantity",
          OTHER: "Other issue",
        }[body.reason],
        priority: "HIGH",
        messages: {
          create: {
            authorId: req.auth!.sub,
            body: body.description,
            sourceLocale: body.sourceLocale,
          },
        },
      },
    });
    await audit(
      req,
      {
        action: "dispute.opened",
        entityType: "support_ticket",
        entityId: ticket.id,
        after: { orderId, reason: body.reason },
      },
      tx,
    );
    return ticket;
  });
  res.status(201).json(serialize({ item }));
});
buyerTransactionsRouter.post(
  "/:id/disputes/:ticketId/evidence",
  raw({ type: ["image/jpeg", "image/png"], limit: "10mb" }),
  async (req, res) => {
    const orderId = id.parse(req.params.id),
      ticketId = id.parse(req.params.ticketId);
    await ownedOrder(orderId, req.auth!.sub);
    const ticket = await prisma.supportTicket.findFirst({
      where: { id: ticketId, orderId, kind: "DISPUTE", status: { not: "RESOLVED" } },
    });
    if (!ticket)
      throw new AppError(
        409,
        "DISPUTE_CLOSED",
        "Open a dispute before adding evidence. Resolved disputes cannot be changed.",
      );
    if (
      !Buffer.isBuffer(req.body) ||
      req.body.length < 16 ||
      imageType(req.body) !== req.get("content-type")
    )
      throw new AppError(422, "INVALID_PHOTO", "Choose a JPEG or PNG photo.");
    const storageKey = await storeMedia(
      req.body,
      req.get("content-type")!,
      `disputes/${randomUUID()}`,
    );
    try {
      const item = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM support_tickets WHERE id=${ticketId}::uuid FOR UPDATE`;
        const current = await tx.supportTicket.findUniqueOrThrow({ where: { id: ticketId } });
        if (current.status === "RESOLVED")
          throw new AppError(409, "DISPUTE_CLOSED", "This dispute has been resolved.");
        if ((await tx.disputeEvidence.count({ where: { ticketId } })) >= 5)
          throw new AppError(422, "EVIDENCE_LIMIT", "You can add up to five photos to a dispute.");
        return tx.disputeEvidence.create({
          data: { ticketId, storageKey, mimeType: req.get("content-type")! },
          select: { id: true },
        });
      });
      res.status(201).json({ item });
    } catch (error) {
      await deleteMedia(storageKey);
      throw error;
    }
  },
);
async function evidence(evidenceId: string) {
  const item = await prisma.disputeEvidence.findUnique({
    where: { id: evidenceId },
    include: { ticket: { include: { order: true } } },
  });
  if (!item) throw new AppError(404, "PHOTO_NOT_FOUND", "Photo not found.");
  return item;
}
buyerTransactionsRouter.get("/:id/disputes/:ticketId/evidence/:evidenceId", async (req, res) => {
  const item = await evidence(id.parse(req.params.evidenceId));
  if (
    item.ticket.order?.buyerId !== req.auth!.sub ||
    item.ticket.orderId !== req.params.id ||
    item.ticketId !== req.params.ticketId
  )
    throw new AppError(404, "PHOTO_NOT_FOUND", "Photo not found.");
  res
    .set({
      "Content-Type": item.mimeType,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    })
    .send(await readMedia(item.storageKey));
});
disputeEvidenceAdminRouter.get("/:id", async (req, res) => {
  const item = await evidence(id.parse(req.params.id));
  res
    .set({
      "Content-Type": item.mimeType,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    })
    .send(await readMedia(item.storageKey));
});
