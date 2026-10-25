import { describe, expect, it } from "vitest";
import { farmLocation } from "./farm-location";
const address = { label: "", state: "Lagos", lga: "Ikeja", city: "Ikeja", line1: "12 Farm Road" };
describe("default farm pickup", () => {
  it("uses the verified primary farm ahead of older flags or buyer delivery addresses", () => {
    const delivery = { ...address, id: "delivery" };
    const oldFarm = { ...address, id: "old", isDefaultFarm: true };
    const farm = { ...address, id: "farm" };
    expect(farmLocation([delivery, oldFarm, farm], "farm")).toBe(farm);
  });
  it("uses a saved farm flag for older profiles but never guesses a buyer address", () => {
    const farm = { ...address, id: "farm", isDefaultFarm: true };
    expect(farmLocation([farm])).toBe(farm);
    expect(farmLocation([{ ...address, id: "delivery" }])).toBeUndefined();
    expect(farmLocation([], "missing")).toBeUndefined();
  });
});
