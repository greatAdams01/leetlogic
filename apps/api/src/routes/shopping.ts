import { Router } from "express";
import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma, Prisma } from "@leetlogic/database";
import { requireAuth } from "../middleware/auth.js";
import { AppError } from "../lib/errors.js";
import { serialize } from "../services/delivery.js";
import { createBuyerOrder } from "../services/buyer-order.js";
import { publicListing } from "./marketplace.js";
export const shoppingRouter = Router();
shoppingRouter.use(requireAuth("customer"));
const id = z.string().uuid(),
  qty = z.string().regex(/^\d{1,9}(\.\d{1,3})?$/),
  price = z.string().regex(/^\d{1,18}$/);
async function cartLock(tx: Prisma.TransactionClient, userId: string) {
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${"cart:" + userId},0))`;
}
shoppingRouter.get("/listings/:id", async (req, res) => {
  const listingId = id.parse(req.params.id),
    key = { userId: req.auth!.sub, listingId };
  const [liked, cart] = await Promise.all([
    prisma.likedListing.findUnique({ where: { userId_listingId: key } }),
    prisma.cartItem.findUnique({ where: { userId_listingId: key } }),
  ]);
  res.json(serialize({ liked: !!liked, cartQuantity: cart?.quantity || null }));
});
shoppingRouter.put("/likes/:id", async (req, res) => {
  const listingId = id.parse(req.params.id),
    { liked } = z.object({ liked: z.boolean() }).strict().parse(req.body),
    key = { userId: req.auth!.sub, listingId };
  if (liked) {
    if (
      !(await prisma.listing.findFirst({
        where: {
          id: listingId,
          status: "ACTIVE",
          deletedAt: null,
          farmerProfile: { verificationStatus: "APPROVED" },
        },
      }))
    )
      throw new AppError(404, "LISTING_NOT_FOUND", "This produce is no longer available.");
    await prisma.likedListing.upsert({ where: { userId_listingId: key }, create: key, update: {} });
  } else await prisma.likedListing.deleteMany({ where: key });
  res.json({ liked });
});
shoppingRouter.get("/likes", async (req, res) =>
  res.json(
    serialize({
      items: await prisma.likedListing.findMany({
        where: {
          userId: req.auth!.sub,
          listing: {
            status: "ACTIVE",
            deletedAt: null,
            farmerProfile: { verificationStatus: "APPROVED" },
          },
        },
        select: { listing: { select: publicListing } },
        orderBy: { createdAt: "desc" },
      }),
    }),
  ),
);
shoppingRouter.get("/cart", async (req, res) =>
  res.json(
    serialize({
      items: await prisma.cartItem.findMany({
        where: { userId: req.auth!.sub },
        select: {
          listingId: true,
          quantity: true,
          unitPriceMinor: true,
          listing: { select: publicListing },
        },
        orderBy: { updatedAt: "asc" },
      }),
    }),
  ),
);
shoppingRouter.put("/cart/:id", async (req, res) => {
  const listingId = id.parse(req.params.id),
    body = z.object({ quantity: qty, unitPriceMinor: price }).strict().parse(req.body);
  const item = await prisma.$transaction(async (tx) => {
    await cartLock(tx, req.auth!.sub);
    await tx.$queryRaw`SELECT id FROM listings WHERE id=${listingId}::uuid FOR UPDATE`;
    const listing = await tx.listing.findFirst({
      where: {
        id: listingId,
        status: "ACTIVE",
        deletedAt: null,
        farmerProfile: { verificationStatus: "APPROVED" },
      },
      include: { unit: true, farmerProfile: true },
    });
    if (!listing)
      throw new AppError(409, "INVENTORY_UNAVAILABLE", "This produce is no longer available.");
    if (listing.farmerProfile.userId === req.auth!.sub)
      throw new AppError(422, "OWN_LISTING", "You cannot buy your own produce.");
    if (listing.unitPriceMinor.toString() !== body.unitPriceMinor)
      throw new AppError(
        409,
        "CART_PRICE_CHANGED",
        "The price changed. Refresh and review your cart.",
      );
    const quantity = new Prisma.Decimal(body.quantity);
    if (quantity.lte(0) || listing.availableQuantity.minus(listing.reservedQuantity).lt(quantity))
      throw new AppError(409, "INVENTORY_UNAVAILABLE", "This quantity is no longer available.");
    if (!listing.unit.allowsDecimal && !quantity.isInteger())
      throw new AppError(
        422,
        "WHOLE_UNIT_REQUIRED",
        "Enter a whole quantity for this selling unit.",
      );
    const total = quantity.mul(listing.unitPriceMinor.toString());
    if (!total.isInteger() || total.gt("9223372036854775807"))
      throw new AppError(
        422,
        "INVALID_TOTAL",
        "Choose a quantity that produces a whole kobo total.",
      );
    if (
      (await tx.cartItem.count({
        where: { userId: req.auth!.sub, listingId: { not: listingId } },
      })) >= 30
    )
      throw new AppError(422, "CART_LIMIT", "Your cart can hold up to 30 produce items.");
    return tx.cartItem.upsert({
      where: { userId_listingId: { userId: req.auth!.sub, listingId } },
      create: {
        userId: req.auth!.sub,
        listingId,
        quantity,
        unitPriceMinor: listing.unitPriceMinor,
      },
      update: { quantity, unitPriceMinor: listing.unitPriceMinor },
    });
  });
  res.json(serialize({ item }));
});
shoppingRouter.delete("/cart/:id", async (req, res) => {
  const listingId = id.parse(req.params.id);
  await prisma.$transaction(async (tx) => {
    await cartLock(tx, req.auth!.sub);
    await tx.cartItem.deleteMany({ where: { userId: req.auth!.sub, listingId } });
  });
  res.status(204).end();
});
shoppingRouter.post("/cart/checkout", async (req, res) => {
  const key = id.parse(req.get("Idempotency-Key"));
  const body = z
    .object({
      items: z
        .array(z.object({ listingId: id, quantity: qty, unitPriceMinor: price }).strict())
        .min(1)
        .max(30),
    })
    .strict()
    .parse(req.body);
  const lines = [...body.items].sort((a, b) => a.listingId.localeCompare(b.listingId));
  if (new Set(lines.map((x) => x.listingId)).size !== lines.length)
    throw new AppError(422, "INVALID_CART", "Remove duplicate cart entries.");
  const hash = createHash("sha256").update(JSON.stringify(lines)).digest("hex"),
    scope = `cart:${req.auth!.sub}`;
  const result = await prisma.$transaction(
    async (tx) => {
      await cartLock(tx, req.auth!.sub);
      const prior = await tx.idempotencyRecord.findUnique({
        where: { scope_idempotencyKey: { scope, idempotencyKey: key } },
      });
      if (prior) {
        if (prior.requestHash !== hash)
          throw new AppError(
            409,
            "IDEMPOTENCY_KEY_REUSED",
            "Your cart changed. Review it before continuing.",
          );
        return prior.responseBody;
      }
      const orders = [];
      for (const line of lines) {
        const cart = await tx.cartItem.findUnique({
          where: { userId_listingId: { userId: req.auth!.sub, listingId: line.listingId } },
        });
        if (
          !cart ||
          !cart.quantity.eq(line.quantity) ||
          cart.unitPriceMinor.toString() !== line.unitPriceMinor
        )
          throw new AppError(
            409,
            "CART_CHANGED",
            "Your cart changed. Refresh and review it before continuing.",
          );
        await tx.$queryRaw`SELECT id FROM listings WHERE id=${line.listingId}::uuid FOR UPDATE`;
        const listing = await tx.listing.findUnique({ where: { id: line.listingId } });
        if (listing?.unitPriceMinor.toString() !== line.unitPriceMinor)
          throw new AppError(
            409,
            "CART_PRICE_CHANGED",
            "The price changed. Refresh and review your cart.",
          );
        const reference = `LL-C-${createHash("sha256").update(`${req.auth!.sub}:${key}:${line.listingId}`).digest("hex").slice(0, 40)}`;
        const order = await createBuyerOrder(tx, req, line, reference);
        orders.push({ id: order.id, reference: order.reference });
        await tx.cartItem.delete({
          where: { userId_listingId: { userId: req.auth!.sub, listingId: line.listingId } },
        });
      }
      const response = { orders };
      await tx.idempotencyRecord.create({
        data: {
          scope,
          idempotencyKey: key,
          requestHash: hash,
          responseBody: response,
          responseStatus: 201,
          completedAt: new Date(),
          expiresAt: new Date(Date.now() + 86400000),
        },
      });
      return response;
    },
    { timeout: 20000 },
  );
  res.status(201).json(result);
});
