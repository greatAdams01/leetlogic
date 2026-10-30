import { createBuyerOrder } from "../services/buyer-order.js";
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
export const publicListing = {
  id: true,
  title: true,
  description: true,
  sourceLocale: true,
  unitCode: true,
  unit: { select: { name: true, allowsDecimal: true } },
  unitPriceMinor: true,
  availableQuantity: true,
  reservedQuantity: true,
  status: true,
  categoryId: true,
  shippingScope: true,
  packaging: true,
  salePackaging: true,
  packingAssistanceRequested: true,
  farmerProfile: { select: { farmName: true, verificationStatus: true } },
  locationAddress: { select: { state: true, city: true, lga: true } },
  media: {
    where: { status: "READY" as const, type: "IMAGE" as const },
    select: { objectKey: true },
    orderBy: { displayOrder: "asc" as const },
    take: 5,
  },
} satisfies Prisma.ListingSelect;
marketplaceRouter.get("/categories", async (_req, res) =>
  res.json({
    items: await prisma.category
      .findMany({
        where: { isActive: true },
        include: {
          translations: true,
          _count: {
            select: {
              listings: {
                where: {
                  status: "ACTIVE",
                  packingAssistanceRequested: false,
                  deletedAt: null,
                  farmerProfile: { verificationStatus: "APPROVED" },
                },
              },
            },
          },
          listings: {
            where: {
              status: "ACTIVE",
              packingAssistanceRequested: false,
              deletedAt: null,
              farmerProfile: { verificationStatus: "APPROVED" },
            },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              title: true,
              media: {
                where: { type: "IMAGE", status: "READY" },
                select: { objectKey: true },
                orderBy: { displayOrder: "asc" },
                take: 1,
              },
            },
          },
        },
        orderBy: [{ sortOrder: "asc" }, { slug: "asc" }],
      })
      .then((items) =>
        items.map(({ _count, listings, ...item }) => ({
          ...item,
          listingCount: _count.listings,
          cover: listings[0] || null,
        })),
      ),
  }),
);
marketplaceRouter.get("/listings", async (req, res) => {
  const q = z
    .object({
      search: z.string().max(100).optional(),
      categoryId: uuid.optional(),
      state: z.string().trim().min(1).max(100).optional(),
      lga: z.string().trim().min(1).max(100).optional(),
      latitude: z.coerce.number().finite().min(-90).max(90).optional(),
      longitude: z.coerce.number().finite().min(-180).max(180).optional(),
      radiusKm: z.coerce.number().min(1).max(500).default(50),
      maxPriceMinor: z
        .string()
        .regex(/^\d{1,12}$/)
        .optional(),
    })
    .refine((q) => !q.lga || !!q.state, {
      message: "Choose a state before a local government",
      path: ["state"],
    })
    .refine((q) => (q.latitude === undefined) === (q.longitude === undefined), {
      message: "Provide both latitude and longitude",
      path: ["latitude"],
    })
    .parse(req.query);
  if (q.latitude !== undefined && q.longitude !== undefined) {
    res.set("Cache-Control", "no-store");
    const ranked = await prisma.$queryRaw<{ id: string; distanceKm: number }[]>(Prisma.sql`
      SELECT id, distance AS "distanceKm" FROM (
        SELECT l.id, l.created_at,
          6371.0 * 2 * ASIN(SQRT(LEAST(1.0, GREATEST(0.0,
            POWER(SIN(RADIANS(a.latitude::float8 - ${q.latitude}) / 2), 2) +
            COS(RADIANS(${q.latitude}::float8)) * COS(RADIANS(a.latitude::float8)) *
            POWER(SIN(RADIANS(a.longitude::float8 - ${q.longitude}) / 2), 2)
          )))) AS distance
        FROM listings l JOIN addresses a ON a.id = l.location_address_id
        JOIN farmer_profiles f ON f.id = l.farmer_profile_id
        WHERE l.status = 'ACTIVE' AND l.packing_assistance_requested = false AND l.deleted_at IS NULL AND f.verification_status = 'APPROVED'
          AND a.deleted_at IS NULL AND a.latitude IS NOT NULL AND a.longitude IS NOT NULL
          AND a.latitude BETWEEN -90 AND 90 AND a.longitude BETWEEN -180 AND 180
          ${q.maxPriceMinor ? Prisma.sql`AND l.unit_price_minor <= ${BigInt(q.maxPriceMinor)}` : Prisma.empty}
          ${q.categoryId ? Prisma.sql`AND l.category_id = ${q.categoryId}::uuid` : Prisma.empty}
          ${q.state ? Prisma.sql`AND LOWER(a.state) = LOWER(${q.state})` : Prisma.empty}
          ${q.lga ? Prisma.sql`AND LOWER(a.lga) = LOWER(${q.lga})` : Prisma.empty}
          ${q.search ? Prisma.sql`AND (l.title ILIKE ${"%" + q.search + "%"} OR a.state ILIKE ${"%" + q.search + "%"} OR f.farm_name ILIKE ${"%" + q.search + "%"})` : Prisma.empty}
      ) nearby WHERE distance <= ${q.radiusKm}
      ORDER BY distance ASC, created_at DESC, id ASC LIMIT 50
    `);
    const records = await prisma.listing.findMany({
      where: {
        id: { in: ranked.map((row) => row.id) },
        status: "ACTIVE",
        packingAssistanceRequested: false,
        deletedAt: null,
        farmerProfile: { verificationStatus: "APPROVED" },
      },
      select: publicListing,
    });
    const byId = new Map(records.map((item) => [item.id, item]));
    res.json(
      serialize({
        items: ranked.flatMap((row) => {
          const item = byId.get(row.id);
          return item ? [{ ...item, distanceKm: Math.round(row.distanceKm * 10) / 10 }] : [];
        }),
      }),
    );
    return;
  }
  const items = await prisma.listing.findMany({
    where: {
      status: "ACTIVE",
      packingAssistanceRequested: false,
      deletedAt: null,
      farmerProfile: { verificationStatus: "APPROVED" },
      ...(q.categoryId ? { categoryId: q.categoryId } : {}),
      ...(q.maxPriceMinor ? { unitPriceMinor: { lte: BigInt(q.maxPriceMinor) } } : {}),
      ...(q.state
        ? {
            locationAddress: {
              state: { equals: q.state, mode: "insensitive" as const },
              ...(q.lga ? { lga: { equals: q.lga, mode: "insensitive" as const } } : {}),
            },
          }
        : {}),
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
      packingAssistanceRequested: false,
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
// Inventory controls apply only to already moderated listings owned by this farmer.
marketplaceRouter.patch("/my-listings/:id/inventory", async (req, res) => {
  const id = uuid.parse(req.params.id);
  const body = z
    .object({
      availableQuantity: z
        .string()
        .regex(/^\d{1,9}(\.\d{1,3})?$/)
        .optional(),
      status: z.enum(["ACTIVE", "PAUSED"]).optional(),
    })
    .strict()
    .refine((value) => value.availableQuantity !== undefined || value.status !== undefined)
    .parse(req.body);
  const item = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM listings WHERE id = ${id}::uuid FOR UPDATE`;
    const current = await tx.listing.findFirst({
      where: { id, farmerProfile: { userId: req.auth!.sub }, deletedAt: null },
      include: { farmerProfile: true },
    });
    if (!current)
      throw new AppError(404, "LISTING_NOT_FOUND", "This listing is no longer available.");
    if (current.farmerProfile.verificationStatus !== "APPROVED")
      throw new AppError(
        403,
        "VERIFIED_FARMER_REQUIRED",
        "Your seller profile must be approved before changing produce for sale.",
      );
    if (!["ACTIVE", "PAUSED", "SOLD_OUT"].includes(current.status))
      throw new AppError(
        409,
        "LISTING_NOT_EDITABLE",
        "This listing must complete review before you can change its stock.",
      );
    const stock =
      body.availableQuantity === undefined
        ? current.availableQuantity
        : new Prisma.Decimal(body.availableQuantity);
    if (stock.lt(current.reservedQuantity))
      throw new AppError(
        409,
        "STOCK_RESERVED",
        "Stock cannot be less than the quantity already reserved for orders.",
      );
    if (body.status === "ACTIVE" && stock.lte(current.reservedQuantity))
      throw new AppError(
        409,
        "STOCK_EMPTY",
        "Add available stock before making this listing active.",
      );
    const difference = stock.minus(current.availableQuantity);
    const status =
      body.status ||
      (current.status === "SOLD_OUT" && stock.gt(current.reservedQuantity)
        ? "ACTIVE"
        : current.status);
    if (status === "ACTIVE" && current.packingAssistanceRequested)
      throw new AppError(
        409,
        "PACKING_ASSISTANCE_PENDING",
        "Our team must complete package measurements before this listing can be active.",
      );
    const updated = await tx.listing.update({
      where: { id },
      data: { availableQuantity: stock, status },
      select: publicListing,
    });
    if (!difference.isZero())
      await tx.inventoryMovement.create({
        data: {
          listingId: id,
          type: "ADJUSTMENT",
          quantity: difference,
          referenceType: "seller",
          referenceId: req.auth!.sub,
        },
      });
    await audit(
      req,
      {
        action: "listing.seller.inventory",
        entityType: "listing",
        entityId: id,
        before: { status: current.status, availableQuantity: current.availableQuantity.toString() },
        after: { status, availableQuantity: stock.toString() },
      },
      tx,
    );
    return updated;
  });
  res.json(serialize({ item }));
});
marketplaceRouter.post("/orders", async (req, res) => {
  const body = z
    .object({ listingId: uuid, quantity: z.string().regex(/^\d{1,9}(\.\d{1,3})?$/) })
    .parse(req.body);
  const key = uuid.parse(req.header("Idempotency-Key"));
  const reference = `LL-M-${createHash("sha256").update(`${req.auth!.sub}:${key}`).digest("hex").slice(0, 40)}`;
  const quantity = new Prisma.Decimal(body.quantity);
  if (quantity.lte(0)) throw new AppError(422, "INVALID_QUANTITY", "Enter a positive quantity");
  const order = await prisma.$transaction(async (tx) => {
    return createBuyerOrder(tx, req, body, reference);
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
      await deliveryEvent(
        tx,
        order.delivery.id,
        "CANCELLED",
        "CUSTOMER",
        `${order.delivery.id}:customer-cancel`,
        req.auth!.sub,
      );
    }
    const cancelled = await tx.tradeOrder.update({ where: { id }, data: { status: "CANCELLED" } });
    await audit(req, { action: "order.customer.cancelled", entityType: "order", entityId: id }, tx);
    return cancelled;
  });
  res.json(serialize({ order: item }));
});
