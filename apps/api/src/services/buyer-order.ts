import { getConfig } from "../config.js";
import { Prisma } from "@leetlogic/database";
import type { Request } from "express";
import { AppError } from "../lib/errors.js";
import { shippingSnapshot } from "./packaging.js";
import { audit } from "./audit.js";
export async function createBuyerOrder(
  tx: Prisma.TransactionClient,
  req: Request,
  input: { listingId: string; quantity: string },
  reference: string,
) {
  const buyerId = req.auth!.sub;
  const quantity = new Prisma.Decimal(input.quantity);
  if (quantity.lte(0)) throw new AppError(422, "INVALID_QUANTITY", "Enter a positive quantity");
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${reference}, 0))`;
  const prior = await tx.tradeOrder.findUnique({ where: { reference } });
  if (prior) {
    if (prior.listingId !== input.listingId || !prior.quantity.eq(quantity))
      throw new AppError(
        409,
        "IDEMPOTENCY_KEY_REUSED",
        "Start a new order when changing the quantity",
      );
    return prior;
  }
  await tx.$queryRaw`SELECT id FROM listings WHERE id = ${input.listingId}::uuid FOR UPDATE`;
  const listing = await tx.listing.findUnique({
    where: { id: input.listingId },
    include: { farmerProfile: true, unit: true },
  });
  if (
    !listing ||
    listing.deletedAt ||
    listing.packingAssistanceRequested ||
    listing.status !== "ACTIVE" ||
    listing.farmerProfile.verificationStatus !== "APPROVED" ||
    listing.availableQuantity.minus(listing.reservedQuantity).lt(quantity)
  )
    throw new AppError(409, "INVENTORY_UNAVAILABLE", "This quantity is no longer available");
  if (listing.farmerProfile.userId === buyerId)
    throw new AppError(422, "OWN_LISTING", "You cannot buy your own produce");
  if (!listing.unit.allowsDecimal && !quantity.isInteger())
    throw new AppError(422, "WHOLE_UNIT_REQUIRED", "Enter a whole quantity for this selling unit.");
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
      buyerId: buyerId,
      farmerProfileId: listing.farmerProfileId,
      listingId: listing.id,
      quantity,
      packagingSnapshot: shippingSnapshot(listing) as Prisma.InputJsonValue,
      totalMinor: BigInt(total.toFixed(0)),
      feeBasisPoints: settings.platformFeeBasisPoints,
      ...(getConfig().PAYMENTS_ENABLED
        ? { fundsProvider: "bachs", reservationExpiresAt: new Date(Date.now() + 15 * 60000) }
        : {}),
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
}
