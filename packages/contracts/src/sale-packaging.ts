import { z } from "zod";

/** Describes ONE priced selling unit, independently of courier parcel measurements. */
export const salePackagingSchema = z
  .object({
    type: z.enum([
      "BAG",
      "SACK",
      "BASKET",
      "CRATE",
      "CARTON",
      "BUNCH",
      "BUNDLE",
      "PIECE",
      "BOTTLE",
      "CONTAINER",
      "KG",
      "TONNE",
      "LITRE",
      "CUSTOM",
    ]),
    size: z.number().finite().positive().max(1_000_000).multipleOf(0.001),
    measure: z.enum(["KG", "LITRE", "PIECE"]),
    customLabel: z.string().trim().max(80).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.type === "CUSTOM" && !value.customLabel?.trim())
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Describe your custom package.",
        path: ["customLabel"],
      });
    if (value.measure === "PIECE" && !Number.isInteger(value.size))
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a whole number of pieces.",
        path: ["size"],
      });
    const fixed = {
      KG: [1, "KG"],
      TONNE: [1000, "KG"],
      LITRE: [1, "LITRE"],
      PIECE: [1, "PIECE"],
    } as const;
    const expected = fixed[value.type as keyof typeof fixed];
    if (expected && (value.size !== expected[0] || value.measure !== expected[1]))
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Use the correct size for this selling unit.",
      });
  });
export type SalePackaging = z.infer<typeof salePackagingSchema>;
export type PackageOption = {
  value: SalePackaging["type"];
  label: string;
  unitCodes: string[];
  measure: SalePackaging["measure"];
  sizes: number[];
};
const option = (
  value: PackageOption["value"],
  label: string,
  unitCodes: string[],
  measure: PackageOption["measure"],
  sizes: number[],
): PackageOption => ({ value, label, unitCodes, measure, sizes });
const bag = option("BAG", "Bag", ["BAG"], "KG", [10, 25, 50, 100]);
const sack = option("SACK", "Sack", ["SACK", "BAG"], "KG", [25, 50, 100]);
const basket = option("BASKET", "Basket", ["BASKET"], "KG", [5, 10, 20, 25]);
const crate = option("CRATE", "Crate", ["CRATE"], "KG", [5, 10, 20, 25]);
const carton = option("CARTON", "Carton", ["CARTON", "PIECE"], "KG", [5, 10, 20]);
const kg = option("KG", "By kilogram", ["KG"], "KG", [1]);
const tonne = option("TONNE", "By tonne", ["TONNE"], "KG", [1000]);
const piece = option("PIECE", "Individual piece / tuber", ["PIECE"], "PIECE", [1]);
const bundle = option("BUNDLE", "Bundle", ["BUNDLE", "PIECE"], "PIECE", [5, 10, 20, 50]);
const bunch = option("BUNCH", "Bunch", ["BUNCH", "PIECE"], "PIECE", [5, 10, 20]);
const custom = option("CUSTOM", "Other / Custom", ["PIECE"], "KG", []);

export function packagingOptions(categorySlug: string, product = ""): PackageOption[] {
  const slug =
    (
      {
        rice: "grains",
        maize: "grains",
        beans: "legumes",
        yam: "roots-tubers",
        cassava: "roots-tubers",
        "palm-oil": "oils",
        tomatoes: "vegetables",
        plantain: "fruits",
        garri: "processed-produce",
      } as Record<string, string>
    )[categorySlug] || categorySlug;
  let options: PackageOption[];
  switch (slug) {
    case "grains":
    case "legumes":
    case "processed-produce":
      options = [bag, sack, kg, tonne];
      break;
    case "roots-tubers":
      options = /\byams?\b/i.test(product)
        ? [piece, bundle, basket, bag, kg, tonne]
        : [bag, basket, piece, bundle, kg, tonne];
      break;
    case "fruits":
      options = /\b(plantain|banana)s?\b/i.test(product)
        ? [bunch, piece, basket, crate, carton, kg]
        : [basket, crate, carton, bunch, piece, kg];
      break;
    case "vegetables":
      options = /\b(leaf|leaves|spinach|ugu|efo)\b/i.test(product)
        ? [bunch, basket, crate, kg]
        : [basket, crate, carton, bunch, kg];
      break;
    case "oils":
      options = [
        option("BOTTLE", "Bottle", ["BOTTLE", "PIECE"], "LITRE", [0.5, 1, 2, 5]),
        option(
          "CONTAINER",
          "Container / jerrycan",
          ["CONTAINER", "PIECE"],
          "LITRE",
          [5, 10, 20, 25],
        ),
        option("LITRE", "By litre", ["LITRE"], "LITRE", [1]),
      ];
      break;
    default:
      options = [];
  }
  return [...options, custom];
}
export function packageUnitCode(option: PackageOption, units: readonly { code: string }[]) {
  return option.unitCodes.find((code) => units.some((unit) => unit.code === code));
}
export function salePackagingMatches(
  value: SalePackaging,
  categorySlug: string,
  title: string,
  unitCode: string,
) {
  const option = packagingOptions(categorySlug, title).find((item) => item.value === value.type);
  return (
    !!option &&
    option.unitCodes.includes(unitCode) &&
    (value.type === "CUSTOM" || value.measure === option.measure)
  );
}
export function minimumPackedWeight(value: SalePackaging | undefined, unitsPerPackage: number) {
  return value?.measure === "KG" ? value.size * unitsPerPackage : 0;
}
export function saleUnitLabel(
  value?: SalePackaging | null,
  translate: (text: string) => string = (text) => text,
): string {
  if (!value) return "";
  if (value.type === "KG") return "kg";
  if (value.type === "TONNE") return translate("Tonne").toLowerCase();
  if (value.type === "LITRE") return translate("Litre").toLowerCase();
  if (value.type === "PIECE") return translate("Individual piece / tuber").toLowerCase();
  const measure =
    value.measure === "KG"
      ? "kg"
      : value.measure === "LITRE"
        ? "L"
        : translate("Pieces").toLowerCase();
  const label =
    value.type === "CUSTOM"
      ? value.customLabel || translate("Package")
      : translate(value.type[0]! + value.type.slice(1).toLowerCase()).toLowerCase();
  return `${value.size} ${measure} ${label}`;
}
