import { packagingSchema } from "@leetlogic/contracts";
import { Prisma } from "@leetlogic/database";
export function packageSuggestion(source: unknown, quantity: Prisma.Decimal | string) {
  const parsed = packagingSchema.safeParse(source);
  if (!parsed.success) return null;
  const farmer = parsed.data;
  const count = new Prisma.Decimal(quantity).div(farmer.unitsPerPackage).ceil().toNumber();
  return {
    farmer,
    packageCount: count,
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
  const parsed = packagingSchema.safeParse(source);
  if (!parsed.success) return true;
  const required = parsed.data.handling;
  return (
    required === "STANDARD" ||
    chosen === required ||
    (required === "PERISHABLE" && chosen === "COLD_CHAIN")
  );
}
