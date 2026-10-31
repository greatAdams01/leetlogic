import { describe, expect, it } from "vitest";
import {
  addressInputSchema, addressInstructions, addressText, digitalPostcodeSchema,
  nigeriaStateCodes, nigeriaStateNames, nigeriaStateSchema, normalizeDigitalPostcode,
  normalizeNigerianState, postalCodeSchema, postcodeLookupSchema, postcodeReverseSchema,
  postcodeStatus, postcodeSuggestionQuery,
} from "./addresses.js";

describe("nationwide Nigerian addresses", () => {
  it("accepts all 36 states and the FCT without a delivery coverage allowlist", () => {
    expect(nigeriaStateNames).toHaveLength(37);
    for (const name of nigeriaStateNames) {
      expect(nigeriaStateSchema.parse(` ${name.toLowerCase()} `)).toBe(name);
    }
    for (const alias of ["FCT", "F.C.T.", "Abuja", "Abuja FCT", "Federal Capital Territory (Abuja)"])
      expect(normalizeNigerianState(alias)).toBe(nigeriaStateCodes.FC);
    expect(nigeriaStateSchema.safeParse("Accra").success).toBe(false);
  });
  it("normalizes digital postcodes without claiming that they have been assigned", () => {
    for (const code of Object.keys(nigeriaStateCodes))
      expect(digitalPostcodeSchema.parse(`${code.toLowerCase()}01a03fk01`)).toBe(`${code}-01-A03-FK-01`);
    expect(normalizeDigitalPostcode(" fc 02 a09 db 09 ")).toBe("FC-02-A09-DB-09");
    for (const invalid of ["FC-00-A09-DB-09", "FC-02-A09-DB-00", "ZZ-02-A09-DB-09", "FC-2-A09-DB-9", "FC/02/A09/DB/09", "902101"])
      expect(normalizeDigitalPostcode(invalid)).toBeUndefined();
    expect(postalCodeSchema.parse("902101")).toBe("902101");
    expect(postalCodeSchema.parse(" ")).toBeNull();
  });
  it("preserves manually supplied address directions and rejects forged verification/ownership", () => {
    const manual = {
      label: "Farm gate", line1: "Plot 8, Community Road", city: "Ogbia", lga: "Ogbia", state: "Bayelsa",
      line2: "Call before the wooden bridge", landmark: "Opposite the community hall",
      postalCode: null, coordinates: null,
    };
    expect(addressInputSchema.parse(manual)).toEqual(manual);
    expect(addressText(manual)).toBe("Plot 8, Community Road, Ogbia, Ogbia");
    expect(addressInstructions(manual)).toBe("Call before the wooden bridge · Landmark: Opposite the community hall");
    for (const extra of [{ userId: "another-user" }, { countryCode: "US" }, { postcodeVerifiedAt: new Date() }, { postcodeVerificationMode: "LIVE" }])
      expect(addressInputSchema.safeParse({ ...manual, ...extra }).success).toBe(false);
  });
  it.each([
    ["state", "F", "FC", "FC-"],
    ["lga", "FC-0", "02", "FC-02-"],
    ["district", "FC-02-A", "A09", "FC-02-A09-"],
    ["area", "FC-02-A09-D", "DB", "FC-02-A09-DB-"],
    ["unit", "FC-02-A09-DB-0", "09", "FC-02-A09-DB-09"],
  ] as const)("completes only the active %s segment", (segment, query, code, expected) => {
    expect(postcodeSuggestionQuery(query, segment, code)).toBe(expected);
  });
  it("distinguishes manual, validity-only, field-level and sandbox checks", () => {
    expect(postcodeStatus({})).toBe("No digital postcode added");
    const metadata = { postalCode: "FC-02-A09-DB-09", postcodeVerifiedAt: "2026-10-31", postcodeVerificationLevel: 1, postcodeVerificationMode: "LIVE" };
    expect(postcodeStatus({ postalCode: metadata.postalCode })).toContain("not verified");
    expect(postcodeStatus(metadata)).toContain("street address and map pin are not verified");
    expect(postcodeStatus({ ...metadata, postcodeVerificationLevel: 2 })).toContain("supplied address fields");
    expect(postcodeStatus({ ...metadata, postcodeVerificationMode: "TEST" })).toContain("not a verified production address");
    for (const invalid of [{ postalCode: "902101" }, { postcodeVerificationLevel: 5 }, { postcodeVerificationMode: "unknown" }])
      expect(postcodeStatus({ ...metadata, ...invalid })).toContain("not verified");
  });
  it("validates postcode responses before client-side confirmation", () => {
    expect(postcodeLookupSchema.safeParse({ postcode: "invalid", valid: true }).success).toBe(false);
    expect(postcodeReverseSchema.safeParse({ found: true }).success).toBe(false);
    expect(postcodeReverseSchema.safeParse({ found: false, candidate: { postcode: "FC-02-A09-DB-09", distanceM: 3, confidence: "high" } }).success).toBe(false);
  });
});
