import { packagingSchema, salePackagingSchema, minimumPackedWeight } from "@leetlogic/contracts";
import { Prisma } from "@leetlogic/database";
export function packageSuggestion(source: unknown, quantity: Prisma.Decimal | string) {
  const parsed = packagingSchema.safeParse(packingSource(source));
  if (!parsed.success) return null;
  const farmer = parsed.data;
  const frozen =
    source && typeof source === "object" && "version" in source && source.version === 2
      ? (source as ReturnType<typeof shippingSnapshot>)
      : null;
  const sale = salePackagingSchema.safeParse(frozen?.salePackaging);
  const minimum = Math.max(
    frozen?.unitCode === "KG" ? farmer.unitsPerPackage : 0,
    minimumPackedWeight(sale.success ? sale.data : undefined, farmer.unitsPerPackage),
  );
  if (farmer.weightKg < minimum) return null;
  if (!new Prisma.Decimal(quantity).isPositive()) return null;
  const count = new Prisma.Decimal(quantity).div(farmer.unitsPerPackage).ceil().toNumber();
  return {
    farmer,
    packageCount: count,
    volumeM3: new Prisma.Decimal(farmer.length)
      .mul(farmer.width)
      .mul(farmer.height)
      .mul(count)
      .div(1_000_000)
      .toNumber(),
    specialHandling: farmer.specialHandling || [],
    pickupInstructions: farmer.pickupInstructions || "",
    weightKg: new Prisma.Decimal(farmer.weightKg)
      .mul(count)
      .toDecimalPlaces(3, Prisma.Decimal.ROUND_CEIL)
      .toNumber(),
    // Dimensions describe one farmer-packed parcel, never a fictitious combined box.
    length: farmer.length,
    width: farmer.width,
    height: farmer.height,
    handling: farmer.handling,
    notes: farmer.notes,
    needsPackedDimensions: false,
  };
}
export function handlingAllowed(source: unknown, chosen: string) {
  const parsed = packagingSchema.safeParse(packingSource(source));
  if (!parsed.success) return true;
  const required = parsed.data.handling;
  return (
    required === "STANDARD" ||
    chosen === required ||
    (required === "PERISHABLE" && chosen === "COLD_CHAIN")
  );
}

/** A v2 snapshot freezes the selling unit, route scope and packing for the reserved order. */
export function packingSource(source: unknown): unknown {
  if (source && typeof source === "object" && "version" in source && source.version === 2)
    return (source as { packaging?: unknown }).packaging;
  return source;
}
export function shippingSnapshot(listing: {
  packaging: unknown;
  salePackaging?: unknown;
  categoryId: string;
  unitCode: string;
  shippingScope: string;
}) {
  return {
    version: 2,
    packaging: listing.packaging,
    salePackaging: listing.salePackaging ?? null,
    categoryId: listing.categoryId,
    unitCode: listing.unitCode,
    shippingScope: listing.shippingScope,
  };
}
export function orderShipping(
  snapshot: unknown,
  listing: { salePackaging?: unknown; categoryId: string; unitCode: string; shippingScope: string },
) {
  return snapshot && typeof snapshot === "object" && "version" in snapshot && snapshot.version === 2
    ? (snapshot as ReturnType<typeof shippingSnapshot>)
    : listing;
}
