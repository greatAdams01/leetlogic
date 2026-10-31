import { packagingSchema, type Packaging } from "../../../../packages/contracts/src/packaging";
export type PackingFields = {
  unitsPerPackage: string;
  weightKg: string;
  length: string;
  width: string;
  height: string;
  handling: Packaging["handling"];
  notes: string;
  specialHandling?: Packaging["specialHandling"];
  pickupInstructions?: string;
};
export const emptyPacking: PackingFields = {
  unitsPerPackage: "",
  weightKg: "",
  length: "",
  width: "",
  height: "",
  handling: "STANDARD",
  notes: "",
};
export function packingFields(value?: Partial<Packaging | PackingFields>): PackingFields {
  return {
    ...emptyPacking,
    ...value,
    unitsPerPackage: String(value?.unitsPerPackage ?? ""),
    weightKg: String(value?.weightKg ?? ""),
    length: String(value?.length ?? ""),
    width: String(value?.width ?? ""),
    height: String(value?.height ?? ""),
  };
}
export function packingValue(value: PackingFields) {
  return packagingSchema.parse({
    ...value,
    unitsPerPackage: Number(value.unitsPerPackage),
    weightKg: Number(value.weightKg),
    length: Number(value.length),
    width: Number(value.width),
    height: Number(value.height),
  });
}
export function packingError(value?: PackingFields) {
  if (
    !value ||
    [value.unitsPerPackage, value.weightKg, value.length, value.width, value.height].some(
      (x) => !/^\d+(\.\d+)?$/.test(x),
    )
  )
    return "Enter the units, packed weight and dimensions for one package.";
  try {
    packingValue(value);
  } catch {
    return "Use positive measurements: dimensions up to 1,000 cm and weight up to 1,000,000 kg.";
  }
  return "";
}
export function estimatedPacking(value: unknown, quantity: string) {
  const parsed = packagingSchema.safeParse(value);
  if (!parsed.success || !/^\d+(\.\d{1,3})?$/.test(quantity) || Number(quantity) <= 0) return null;
  const count = Math.ceil(
    Math.round(Number(quantity) * 1000) / Math.round(parsed.data.unitsPerPackage * 1000),
  );
  return { count, weightKg: Math.ceil(count * parsed.data.weightKg * 1000) / 1000 };
}
export function produceTotal(quantity: string, priceMinor: string) {
  if (!/^\d{1,9}(\.\d{1,3})?$/.test(quantity) || Number(quantity) <= 0) return null;
  const [whole, fraction = ""] = quantity.split(".");
  const scaled = BigInt(whole!) * 1000n + BigInt(fraction.padEnd(3, "0"));
  const total = scaled * BigInt(priceMinor);
  return total % 1000n === 0n ? (total / 1000n).toString() : null;
}
