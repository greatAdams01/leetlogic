import { createHash } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { prisma, Prisma } from "@leetlogic/database";
import { requireAuth } from "../middleware/auth.js";
import { AppError } from "../lib/errors.js";
import { serialize, deliveryEvent } from "../services/delivery.js";
import { audit } from "../services/audit.js";
export const marketplaceRouter = Router();
const uuid = z.string().uuid();
const publicListing = {
  id: true,
  title: true,
  description: true,
  sourceLocale: true,
  unitCode: true,
  unitPriceMinor: true,
  availableQuantity: true,
  reservedQuantity: true,
  status: true,
  categoryId: true,
  shippingScope: true,
  farmerProfile: { select: { farmName: true, verificationStatus: true } },
  locationAddress: { select: { state: true, city: true } },
  media: {
    where: { status: "READY" as const, type: "IMAGE" as const },
    select: { objectKey: true },
    orderBy: { displayOrder: "asc" as const },
    take: 5,
  },
} satisfies Prisma.ListingSelect;
marketplaceRouter.get("/categories", async (_req, res) =>
  res.json({
    items: await prisma.category.findMany({
      include: { translations: true },
      orderBy: { slug: "asc" },
    }),
  }),
);
marketplaceRouter.get("/listings", async (req, res) => {
  const q = z
    .object({ search: z.string().max(100).optional(), categoryId: uuid.optional() })
    .parse(req.query);
  const items = await prisma.listing.findMany({
    where: {
      status: "ACTIVE",
      deletedAt: null,
      farmerProfile: { verificationStatus: "APPROVED" },
      ...(q.categoryId ? { categoryId: q.categoryId } : {}),
      ...(q.search
        ? {
            OR: [
              { title: { contains: q.search, mode: "insensitive" } },
              { locationAddress: { state: { contains: q.search, mode: "insensitive" } } },
              { farmerProfile: { farmName: { contains: q.search, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    select: publicListing,
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json(serialize({ items }));
});
marketplaceRouter.get("/listings/:id", async (req, res) => {
  const item = await prisma.listing.findFirst({
    where: {
      id: uuid.parse(req.params.id),
      status: "ACTIVE",
      deletedAt: null,
      farmerProfile: { verificationStatus: "APPROVED" },
    },
    select: publicListing,
  });
  if (!item) throw new AppError(404, "LISTING_NOT_FOUND", "Listing is no longer available");
  res.json(serialize({ item }));
});
marketplaceRouter.use(requireAuth("customer"));
marketplaceRouter.get("/my-listings", async (req, res) =>
  res.json(
    serialize({
      items: await prisma.listing.findMany({
        where: { farmerProfile: { userId: req.auth!.sub }, deletedAt: null },
        select: publicListing,
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    }),
  ),
);
marketplaceRouter.post("/orders", async (req, res) => {
  const body = z
    .object({ listingId: uuid, quantity: z.string().regex(/^\d{1,9}(\.\d{1,3})?$/) })
    .parse(req.body);
  const key = uuid.parse(req.header("Idempotency-Key"));
  const reference = `LL-M-${createHash("sha256").update(`${req.auth!.sub}:${key}`).digest("hex").slice(0, 40)}`;
  const quantity = new Prisma.Decimal(body.quantity);
  if (quantity.lte(0)) throw new AppError(422, "INVALID_QUANTITY", "Enter a positive quantity");
  const order = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${reference}, 0))`;
    const prior = await tx.tradeOrder.findUnique({ where: { reference } });
    if (prior) {
      if (prior.listingId !== body.listingId || !prior.quantity.eq(quantity))
        throw new AppError(
          409,
          "IDEMPOTENCY_KEY_REUSED",
          "Start a new order when changing the quantity",
        );
      return prior;
    }
    await tx.$queryRaw`SELECT id FROM listings WHERE id = ${body.listingId}::uuid FOR UPDATE`;
    const listing = await tx.listing.findUnique({
      where: { id: body.listingId },
      include: { farmerProfile: true },
    });
    if (
      !listing ||
      listing.deletedAt ||
      listing.status !== "ACTIVE" ||
      listing.farmerProfile.verificationStatus !== "APPROVED" ||
      listing.availableQuantity.minus(listing.reservedQuantity).lt(quantity)
    )
      throw new AppError(409, "INVENTORY_UNAVAILABLE", "This quantity is no longer available");
    if (listing.farmerProfile.userId === req.auth!.sub)
      throw new AppError(422, "OWN_LISTING", "You cannot buy your own produce");
    const total = quantity.mul(listing.unitPriceMinor.toString());
    if (!total.isInteger() || total.gt("9223372036854775807"))
      throw new AppError(422, "INVALID_TOTAL", "Quantity must produce a whole kobo total");
    const settings = await tx.marketplaceSettings.upsert({
      where: { id: "marketplace" },
      create: {},
      update: {},
    });
    const item = await tx.tradeOrder.create({
      data: {
        reference,
        buyerId: req.auth!.sub,
        farmerProfileId: listing.farmerProfileId,
        listingId: listing.id,
        quantity,
        totalMinor: BigInt(total.toFixed(0)),
        feeBasisPoints: settings.platformFeeBasisPoints,
      },
    });
    await tx.listing.update({
      where: { id: listing.id },
      data: { reservedQuantity: { increment: quantity } },
    });
    await tx.inventoryMovement.create({
      data: {
        listingId: listing.id,
        type: "RESERVE",
        quantity,
        referenceType: "order",
        referenceId: item.id,
      },
    });
    await audit(
      req,
      { action: "order.customer.created", entityType: "order", entityId: item.id },
      tx,
    );
    return item;
  });
  res.status(201).json(serialize({ order }));
});

marketplaceRouter.post("/orders/:id/cancel", async (req, res) => {
  const id = uuid.parse(req.params.id);
  const item = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM trade_orders WHERE id = ${id}::uuid FOR UPDATE`;
    const order = await tx.tradeOrder.findUnique({
      where: { id },
      include: { delivery: true, shipment: true },
    });
    if (!order || order.buyerId !== req.auth!.sub)
      throw new AppError(404, "ORDER_NOT_FOUND", "Order not found");
    if (order.status === "CANCELLED") return order;
    if (
      order.status !== "AWAITING_PAYMENT" ||
      order.heldMinor !== 0n ||
      order.shipment ||
      (order.delivery && (order.delivery.paidMinor !== 0n || order.delivery.bookingStartedAt))
    )
      throw new AppError(
        409,
        "CANCELLATION_REQUIRES_STAFF",
        "Contact support to cancel a paid or dispatched order",
      );
    await tx.$queryRaw`SELECT id FROM listings WHERE id = ${order.listingId}::uuid FOR UPDATE`;
    await tx.listing.update({
      where: { id: order.listingId },
      data: { reservedQuantity: { decrement: order.quantity } },
    });
    await tx.inventoryMovement.create({
      data: {
        listingId: order.listingId,
        type: "RELEASE",
        quantity: order.quantity,
        referenceType: "order",
        referenceId: id,
      },
    });
    if (order.delivery) {
      await tx.delivery.update({ where: { id: order.delivery.id }, data: { status: "CANCELLED" } });
      await deliveryEvent(tx, order.delivery.id, "CANCELLED", "CUSTOMER", `${order.delivery.id}:customer-cancel`, req.auth!.sub);
    }
    const cancelled = await tx.tradeOrder.update({ where: { id }, data: { status: "CANCELLED" } });
    await audit(req, { action: "order.customer.cancelled", entityType: "order", entityId: id }, tx);
    return cancelled;
  });
  res.json(serialize({ order: item }));
});
