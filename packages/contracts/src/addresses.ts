import { z } from "zod";
import { coordinatesSchema } from "./coordinates.js";

// National address catalogue, not a delivery coverage allowlist. Source: NIPOST /v1/reference/states.
export const nigeriaStateCodes = {
  AB: "Abia", AD: "Adamawa", AK: "Akwa Ibom", AN: "Anambra", BA: "Bauchi", BE: "Benue",
  BR: "Borno", BY: "Bayelsa", CR: "Cross River", DE: "Delta", EB: "Ebonyi", ED: "Edo",
  EK: "Ekiti", EN: "Enugu", FC: "Federal Capital Territory", GM: "Gombe", IM: "Imo",
  JI: "Jigawa", KD: "Kaduna", KE: "Kebbi", KG: "Kogi", KN: "Kano", KT: "Katsina",
  KW: "Kwara", LA: "Lagos", NA: "Nasarawa", NI: "Niger", OG: "Ogun", ON: "Ondo",
  OS: "Osun", OY: "Oyo", PL: "Plateau", RI: "Rivers", SK: "Sokoto", TA: "Taraba",
  YB: "Yobe", ZA: "Zamfara",
} as const;
export const nigeriaStateNames = Object.values(nigeriaStateCodes);
export function normalizeNigerianState(value: string): string | undefined {
  const normalized = value.trim().toLowerCase().replace(/[().,_-]/g, " ").replace(/\s+/g, " ").trim();
  if (["fct", "f c t", "abuja", "abuja fct", "fct abuja", "federal capital territory", "federal capital territory abuja"].includes(normalized))
    return nigeriaStateCodes.FC;
  return nigeriaStateNames.find((name) => name.toLowerCase() === normalized);
}
export const nigeriaStateSchema = z.string().trim().min(2).max(80)
  .refine((value) => !!normalizeNigerianState(value), "Choose a Nigerian state or the FCT")
  .transform((value) => normalizeNigerianState(value)!);

/** A format check is never proof that NIPOST has assigned this code to a building. */
export function normalizeDigitalPostcode(value: string): string | undefined {
  if (!/^[a-z\d\s-]+$/i.test(value)) return undefined;
  const compact = value.toUpperCase().replace(/[\s-]/g, "");
  if (!/^[A-Z]{2}(0[1-9]|[1-9]\d)[A-Z\d]{3}[A-Z]{2}(0[1-9]|[1-9]\d)$/.test(compact) ||
    !Object.hasOwn(nigeriaStateCodes, compact.slice(0, 2))) return undefined;
  return [compact.slice(0, 2), compact.slice(2, 4), compact.slice(4, 7), compact.slice(7, 9), compact.slice(9)].join("-");
}
export const digitalPostcodeSchema = z.string().trim().max(40)
  .refine((value) => !!normalizeDigitalPostcode(value), "Enter a digital postcode such as FC-02-A09-DB-09")
  .transform((value) => normalizeDigitalPostcode(value)!);
// Keep the older six-digit postal reference usable, but never mark it as NDAPS-verified.
export const postalCodeSchema = z.preprocess((value) => typeof value === "string" && !value.trim() ? null : value,
  z.union([digitalPostcodeSchema, z.string().trim().regex(/^\d{6}$/)]).nullable());
export const addressLocationSchema = z.object({
  state: nigeriaStateSchema,
  lga: z.string().trim().min(2).max(80),
  city: z.string().trim().min(2).max(100),
  line1: z.string().trim().min(5).max(180),
  line2: z.string().trim().max(180).nullable().optional(),
  landmark: z.string().trim().max(180).nullable().optional(),
  postalCode: postalCodeSchema.optional(),
  verificationToken: z.string().min(1).max(4000).nullable().optional(),
  coordinates: coordinatesSchema.nullable().optional(),
});
export const addressInputSchema = addressLocationSchema.extend({
  label: z.string().trim().min(1).max(60),
  isDefaultDelivery: z.boolean().optional(),
}).strict();
export type AddressInput = z.infer<typeof addressInputSchema>;
export type PostcodeFields = Partial<Pick<AddressInput, "state" | "lga" | "city" | "line1">>;
export const postcodeLookupSchema = z.object({
  postcode: digitalPostcodeSchema, valid: z.boolean(), mode: z.enum(["TEST", "LIVE"]),
  level: z.union([z.literal(1), z.literal(2)]),
  fields: addressLocationSchema.pick({ state: true, lga: true, city: true, line1: true }).partial(),
  addressDetailsAvailable: z.boolean(),
  limitation: z.enum(["POSTCODE_ACCESS_REQUIRED", "POSTCODE_CREDITS_REQUIRED"]).optional(),
  verificationToken: z.string().min(1).max(4000).optional(),
});
export type PostcodeLookup = z.infer<typeof postcodeLookupSchema>;
export const postcodeSearchSchema = z.object({
  segment: z.enum(["state", "lga", "district", "area", "unit"]),
  suggestions: z.array(z.object({ code: z.string().min(1).max(40).regex(/^[a-z\d\s-]+$/i), label: z.string().max(180).optional() })).max(20),
});
export type PostcodeSearch = z.infer<typeof postcodeSearchSchema>;
export const postcodeReverseSchema = z.object({
  found: z.boolean(),
  candidate: z.object({ postcode: digitalPostcodeSchema, distanceM: z.number().finite().nonnegative().max(25), confidence: z.enum(["high", "medium", "low"]) }).optional(),
}).refine((result) => result.found === !!result.candidate);
export type PostcodeReverse = z.infer<typeof postcodeReverseSchema>;

export function addressText(address: { line1: string; city: string; lga: string }) {
  return [address.line1, address.city, address.lga].filter(Boolean).join(", ");
}
export function addressInstructions(address: { line2?: string | null; landmark?: string | null }) {
  return [address.line2, address.landmark ? `Landmark: ${address.landmark}` : ""].filter(Boolean).join(" · ");
}

/** Complete only the documented active segment; partial suggestions are not verified postcodes. */
export function postcodeSuggestionQuery(query: string, segment: PostcodeSearch["segment"], code: string) {
  const full = normalizeDigitalPostcode(code);
  if (full) return full;
  const index = ["state", "lga", "district", "area", "unit"].indexOf(segment);
  const compact = query.toUpperCase().replace(/[\s-]/g, "");
  const prefixes = [compact.slice(0, 2), compact.slice(2, 4), compact.slice(4, 7), compact.slice(7, 9)];
  const suggestion = code.toUpperCase().trim();
  if (/[\s-]/.test(suggestion) || suggestion.length > [2, 2, 3, 2, 2][index]!) return suggestion;
  const parts = [...prefixes.slice(0, index), suggestion];
  return parts.join("-") + (index < 4 ? "-" : "");
}

export function postcodeStatus(address: {
  postalCode?: string | null; postcodeVerifiedAt?: string | Date | null;
  postcodeVerificationLevel?: number | null; postcodeVerificationMode?: string | null;
}) {
  if (!address.postalCode) return "No digital postcode added";
  if (!address.postcodeVerifiedAt || !normalizeDigitalPostcode(address.postalCode) ||
    ![1, 2].includes(address.postcodeVerificationLevel || 0) || !["TEST", "LIVE"].includes(address.postcodeVerificationMode || ""))
    return "Postcode not verified — confirm the full address";
  if (address.postcodeVerificationMode === "TEST") return "Sandbox postcode check — not a verified production address";
  return address.postcodeVerificationLevel === 2
    ? "NIPOST postcode and supplied address fields checked"
    : "NIPOST postcode is valid — street address and map pin are not verified";
}
