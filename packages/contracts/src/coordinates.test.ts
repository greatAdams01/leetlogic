import { describe, expect, it } from "vitest";
import { coordinatesSchema } from "./coordinates.js";
describe("farm coordinate validation", () => {
  it("requires a finite, complete numeric pair within global bounds", () => {
    expect(coordinatesSchema.parse({ latitude: 6.52, longitude: 3.37 })).toEqual({
      latitude: 6.52,
      longitude: 3.37,
    });
    for (const invalid of [
      { latitude: 6 },
      { latitude: "6", longitude: 3 },
      { latitude: NaN, longitude: 3 },
      { latitude: 91, longitude: 3 },
      { latitude: 6, longitude: -181 },
    ])
      expect(coordinatesSchema.safeParse(invalid).success).toBe(false);
  });
});
