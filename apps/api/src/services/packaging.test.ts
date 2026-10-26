import { describe, expect, it } from "vitest";
import { packageSuggestion, handlingAllowed } from "./packaging.js";
const pack = {
  unitsPerPackage: 1,
  weightKg: 25,
  length: 50,
  width: 40,
  height: 30,
  handling: "PERISHABLE",
  notes: "Keep upright",
};
describe("order packing estimates", () => {
  it("derives counts and conservative packed weight without inventing combined dimensions", () => {
    expect(packageSuggestion(pack, "1")).toMatchObject({
      packageCount: 1,
      weightKg: 25,
      length: 50,
      width: 40,
      height: 30,
    });
    expect(packageSuggestion(pack, "2.5")).toMatchObject({
      packageCount: 3,
      weightKg: 75,
      length: null,
      width: null,
      height: null,
      needsPackedDimensions: true,
    });
    expect(packageSuggestion({ ...pack, unitsPerPackage: 10, weightKg: 10.5 }, "25")).toMatchObject(
      { packageCount: 3, weightKg: 31.5 },
    );
  });
  it("uses exact decimal quantities and leaves legacy or invalid data unspecified", () => {
    expect(
      packageSuggestion({ ...pack, unitsPerPackage: 0.01, weightKg: 0.01 }, "0.07"),
    ).toMatchObject({ packageCount: 7, weightKg: 0.07 });
    expect(packageSuggestion(null, "1")).toBeNull();
    expect(packageSuggestion({ ...pack, weightKg: -1 }, "1")).toBeNull();
  });
  it("allows stronger handling while preventing removal of farmer requirements", () => {
    expect(handlingAllowed(pack, "STANDARD")).toBe(false);
    expect(handlingAllowed(pack, "COLD_CHAIN")).toBe(true);
    expect(handlingAllowed({ ...pack, handling: "COLD_CHAIN" }, "PERISHABLE")).toBe(false);
    expect(handlingAllowed({ ...pack, handling: "STANDARD" }, "BULK")).toBe(true);
  });
});
