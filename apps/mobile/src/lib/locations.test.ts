import { describe, expect, it } from "vitest";
import { changeState, localGovernments, nigeriaStates } from "./locations";

describe("Nigerian location dropdowns", () => {
  it("includes all states, FCT and 774 distinct local government choices", () => {
    expect(nigeriaStates).toHaveLength(37);
    expect(nigeriaStates).toContain("Federal Capital Territory");
    expect(nigeriaStates.reduce((total, state) => total + localGovernments(state).length, 0)).toBe(
      774,
    );
    for (const state of nigeriaStates) {
      const lgas = localGovernments(state);
      expect(new Set(lgas).size).toBe(lgas.length);
      expect(lgas.length).toBeGreaterThan(0);
    }
    expect(localGovernments("Lagos")).toContain("Ikeja");
    expect(localGovernments("Abia")).toContain("Obi Ngwa");
    expect(localGovernments("Federal Capital Territory")).toHaveLength(6);
    expect(localGovernments("Lagos")).not.toContain("Abuja Municipal");
    expect(localGovernments("unknown")).toEqual([]);
    expect(localGovernments("toString")).toEqual([]);
  });
  it("clears stale LGAs on state change and preserves other entered fields", () => {
    const form = { state: "Lagos", lga: "Ikeja", farmName: "My farm" };
    expect(changeState(form, "Ogun")).toEqual({ state: "Ogun", lga: "", farmName: "My farm" });
    expect(changeState(form, "Lagos")).toEqual(form);
    expect(form.lga).toBe("Ikeja");
  });
});
