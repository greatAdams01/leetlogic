import { expect, it } from "vitest";
import {
  emptyPacking,
  packingError,
  packingFields,
  packingValue,
  estimatedPacking,
  produceTotal,
} from "./packaging";
const source = {
  unitsPerPackage: 10,
  weightKg: 10.5,
  length: 40,
  width: 30,
  height: 25,
  handling: "STANDARD" as const,
  notes: "Keep dry",
};
it("requires measurements, restores numeric drafts and sends validated numeric values", () => {
  expect(packingError(emptyPacking)).not.toBe("");
  expect(packingError(packingFields(source))).toBe("");
  expect(packingValue(packingFields(source))).toEqual(source);
  expect(packingError({ ...packingFields(source), length: "1,000" })).not.toBe("");
  expect(packingError({ ...packingFields(source), weightKg: "-1" })).not.toBe("");
});
it("derives conservative weights and exact money for changing order quantities", () => {
  expect(estimatedPacking(source, "25")).toEqual({ count: 3, weightKg: 31.5 });
  expect(estimatedPacking({ ...source, unitsPerPackage: 0.01 }, "0.07")?.count).toBe(7);
  expect(estimatedPacking(null, "1")).toBeNull();
  expect(produceTotal("1.25", "1234")).toBeNull();
  expect(produceTotal("1.25", "8000")).toBe("10000");
  expect(produceTotal("", "8000")).toBeNull();
});
