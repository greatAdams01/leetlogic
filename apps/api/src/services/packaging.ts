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
    // Multiple packages do not imply a single larger box of known dimensions.
    length: count === 1 ? farmer.length : null,
    width: count === 1 ? farmer.width : null,
    height: count === 1 ? farmer.height : null,
    handling: farmer.handling,
    notes: farmer.notes,
    needsPackedDimensions: count > 1,
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
