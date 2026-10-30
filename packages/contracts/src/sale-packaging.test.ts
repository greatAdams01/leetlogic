import { describe, expect, it } from "vitest";
import {
  packagingOptions,
  packageUnitCode,
  salePackagingSchema,
  salePackagingMatches,
  minimumPackedWeight,
  saleUnitLabel,
} from "./sale-packaging.js";

describe("category-aware selling packages", () => {
  it("offers grain sizes, count-based yam bundles and liquid containers without irrelevant types", () => {
    const rice = packagingOptions("grains", "Rice");
    expect(rice.find((option) => option.value === "BAG")?.sizes).toEqual([10, 25, 50, 100]);
    expect(rice.some((option) => option.value === "BOTTLE")).toBe(false);
    const yam = packagingOptions("roots-tubers", "Yam");
    expect(yam[0]?.value).toBe("PIECE");
    expect(yam.find((option) => option.value === "BUNDLE")?.measure).toBe("PIECE");
    expect(packagingOptions("oils").some((option) => option.value === "BASKET")).toBe(false);
    expect(packagingOptions("unknown").map((option) => option.value)).toEqual(["CUSTOM"]);
  });
  it("supports custom sizes, rejects fractional pieces and prevents contradictory fixed units", () => {
    expect(salePackagingSchema.safeParse({ type: "BAG", size: 17.5, measure: "KG" }).success).toBe(
      true,
    );
    expect(
      salePackagingSchema.safeParse({ type: "BUNDLE", size: 2.5, measure: "PIECE" }).success,
    ).toBe(false);
    expect(salePackagingSchema.safeParse({ type: "KG", size: 50, measure: "KG" }).success).toBe(
      false,
    );
    expect(
      salePackagingSchema.safeParse({ type: "CUSTOM", size: 5, measure: "LITRE" }).success,
    ).toBe(false);
  });
  it("keeps the selling basis clear while using compatible catalogue codes", () => {
    expect(saleUnitLabel({ type: "BAG", size: 50, measure: "KG" })).toBe("50 kg bag");
    expect(saleUnitLabel({ type: "BOTTLE", size: 5, measure: "LITRE" })).toBe("5 L bottle");
    const bottle = packagingOptions("oils")[0]!;
    expect(packageUnitCode(bottle, [{ code: "PIECE" }])).toBe("PIECE");
    expect(
      salePackagingMatches(
        { type: "BOTTLE", size: 5, measure: "LITRE" },
        "grains",
        "Rice",
        "PIECE",
      ),
    ).toBe(false);
    expect(
      salePackagingMatches({ type: "BAG", size: 50, measure: "LITRE" }, "grains", "Rice", "BAG"),
    ).toBe(false);
    expect(minimumPackedWeight({ type: "BAG", size: 50, measure: "KG" }, 2)).toBe(100);
  });
});
