import { z } from "zod";
import {
  coordinatesSchema, nigeriaStateCodes, normalizeDigitalPostcode, normalizeNigerianState,
  type PostcodeFields, type PostcodeLookup, type PostcodeReverse, type PostcodeSearch,
} from "@leetlogic/contracts";
import { getConfig } from "../../config.js";
import { AppError } from "../../lib/errors.js";

const gateway = "https://api.postcode.gov.ng";
function failure(status: number, code: string, message: string, operation: string, reason: string, retry?: number) {
  const error = new AppError(status, code, message, undefined, retry);
  error.diagnostics = { provider: "nipost", operation, reason, hint: "Check NIPOST key scopes, granted lookup level, credits and provider health. Manual addresses do not require this service." };
  return error;
}
function parse<S extends z.ZodTypeAny>(schema: S, value: unknown, operation: string): z.infer<S> {
  const result = schema.safeParse(value);
  if (!result.success)
    throw failure(502, "POSTCODE_PROVIDER_RESPONSE_INVALID", "Postcode verification returned an invalid response. Try again or enter your address manually.", operation, "Response did not match the documented API contract");
  return result.data;
}
export class Nipost {
  constructor(private readonly request: typeof fetch = fetch) {}
  private configuration() {
    const c = getConfig();
    const match = c.NIPOST_API_KEY?.match(/^nipost_(test|live)_.+/);
    if (!match || (c.NODE_ENV === "production" && match[1] !== "live"))
      throw failure(503, "POSTCODE_SERVICE_CONFIGURATION", "Postcode verification is not available right now. You can enter your address manually.", "configuration", "A suitable server-side NIPOST key is required");
    return { key: c.NIPOST_API_KEY!, mode: match[1] === "test" ? "TEST" as const : "LIVE" as const };
  }
  private async call(path: string, operation: string): Promise<unknown> {
    const { key } = this.configuration();
    let response: Response;
    try {
      response = await this.request(`${gateway}${path}`, {
        headers: { "X-API-Key": key, Accept: "application/json" },
        redirect: "error", signal: AbortSignal.timeout(8000),
      });
    } catch {
      throw failure(503, "POSTCODE_SERVICE_UNAVAILABLE", "Postcode verification is temporarily unavailable. Retry or enter your address manually.", operation, "Provider request timed out or could not connect", 10);
    }
    if (!response.ok) {
      const codes: Record<number, [string, string]> = {
        401: ["POSTCODE_SERVICE_CONFIGURATION", "Postcode verification is not available right now. You can enter your address manually."],
        403: ["POSTCODE_ACCESS_REQUIRED", "NIPOST address details are not enabled for this account. You can enter the remaining address manually."],
        402: ["POSTCODE_CREDITS_REQUIRED", "NIPOST address details are temporarily unavailable. You can enter the remaining address manually."],
        429: ["POSTCODE_RATE_LIMITED", "Postcode verification is busy. Wait a moment and retry, or enter your address manually."],
      };
      const [code, message] = codes[response.status] || [
        response.status >= 500 ? "POSTCODE_SERVICE_UNAVAILABLE" : "POSTCODE_PROVIDER_ERROR",
        "Postcode verification could not complete the request. Retry or enter your address manually.",
      ];
      const retry = response.status === 429 || response.status >= 500
        ? Math.max(1, Math.min(60, Number(response.headers.get("retry-after")) || 10)) : undefined;
      const body = await response.json().catch(() => null);
      const providerCode = z.object({ error: z.object({ code: z.string().regex(/^[a-z_]{1,60}$/) }) }).safeParse(body);
      const error = failure(503, code, message, operation, `NIPOST returned HTTP ${response.status}${providerCode.success ? ` (${providerCode.data.error.code})` : ""}`, retry);
      error.diagnostics!.providerStatus = response.status;
      throw error;
    }
    const body = await response.json().catch(() => null);
    return parse(z.object({ data: z.unknown().refine((value) => value != null) }), body, operation).data;
  }
  async lookup(value: string): Promise<PostcodeLookup> {
    const postcode = normalizeDigitalPostcode(value);
    if (!postcode) throw new AppError(422, "POSTCODE_INVALID_FORMAT", "Enter a digital postcode such as FC-02-A09-DB-09, or use manual address entry.");
    const { mode } = this.configuration();
    let data: unknown;
    let requestedLevel: 1 | 2 = 2;
    let limitation: PostcodeLookup["limitation"];
    try {
      data = await this.call(`/v1/lookup?code=${encodeURIComponent(postcode)}&level=2`, "lookup-L2");
    } catch (error) {
      if (!(error instanceof AppError) || !["POSTCODE_ACCESS_REQUIRED", "POSTCODE_CREDITS_REQUIRED"].includes(error.code)) throw error;
      limitation = error.code as PostcodeLookup["limitation"];
      requestedLevel = 1;
      data = await this.call(`/v1/lookup?code=${encodeURIComponent(postcode)}&level=1`, "lookup-L1");
    }
    const result = parse(z.object({
      postcode: z.string(), valid: z.boolean(), status: z.string().optional(),
      administrative_address: z.object({
         state_name: z.string().nullish(), lga_name: z.string().trim().min(2).max(80).nullish(),
         locality_name: z.string().trim().min(2).max(100).nullish(),
      }).nullish(),
      recent_house_address: z.object({ recent: z.string().trim().min(5).max(180).optional().catch(undefined) }).nullish(),
    }), data, "lookup");
    if (normalizeDigitalPostcode(result.postcode) !== postcode ||
      (result.valid && ["not_found", "invalid", "restricted"].includes(result.status || "")))
      throw failure(502, "POSTCODE_PROVIDER_RESPONSE_INVALID", "Postcode verification returned an invalid response. Try again or enter your address manually.", "lookup", "Lookup identity or validity is inconsistent");
    const administrative = requestedLevel === 2 ? result.administrative_address : null;
    const house = requestedLevel === 2 ? result.recent_house_address : null;
    const state = administrative?.state_name
      ? normalizeNigerianState(administrative.state_name)
      : nigeriaStateCodes[postcode.slice(0, 2) as keyof typeof nigeriaStateCodes];
    if (result.valid && (!state || state !== nigeriaStateCodes[postcode.slice(0, 2) as keyof typeof nigeriaStateCodes]))
      throw failure(502, "POSTCODE_PROVIDER_RESPONSE_INVALID", "Postcode verification returned an invalid response. Try again or enter your address manually.", "lookup", "Administrative state does not match the postcode");
    const fields: PostcodeFields = result.valid ? {
      state, ...(administrative?.lga_name ? { lga: administrative.lga_name } : {}),
      ...(administrative?.locality_name ? { city: administrative.locality_name } : {}),
      ...(house?.recent ? { line1: house.recent } : {}),
    } : {};
    return {
      postcode, valid: result.valid, mode, level: fields.lga || fields.city || fields.line1 ? 2 : 1,
      fields, addressDetailsAvailable: !!(fields.lga && fields.line1), ...(limitation ? { limitation } : {}),
    };
  }
  async search(query: string): Promise<PostcodeSearch> {
    const q = z.string().trim().min(1).max(40).regex(/^[a-z\d\s-]+$/i).parse(query);
    const result = parse(z.object({
      segment: z.enum(["state", "lga", "district", "area", "unit"]),
      suggestions: z.array(z.object({ code: z.string().min(1).max(40).regex(/^[a-z\d\s-]+$/i), label: z.string().max(180).optional() })).max(1000),
    }), await this.call(`/v1/search/autocomplete?q=${encodeURIComponent(q)}`, "autocomplete"), "autocomplete");
    return { ...result, suggestions: result.suggestions.slice(0, 20) };
  }
  async reverse(point: { latitude: number; longitude: number }): Promise<PostcodeReverse> {
    const coordinates = coordinatesSchema.parse(point);
    const result = parse(z.object({
      found: z.boolean(),
      unit: z.object({ postcode: z.string(), distance_m: z.number().nonnegative().max(25), confidence: z.enum(["high", "medium", "low"]) }).optional(),
    }), await this.call(`/v1/search/reverse?lat=${coordinates.latitude}&lng=${coordinates.longitude}&max_distance_m=25`, "reverse"), "reverse");
    if (!result.found) return { found: false };
    const postcode = result.unit && normalizeDigitalPostcode(result.unit.postcode);
    if (!postcode) throw failure(502, "POSTCODE_PROVIDER_RESPONSE_INVALID", "Postcode verification returned an invalid response. Try again or enter your address manually.", "reverse", "No valid candidate was returned");
    // A nearest building is only a candidate. It is never an automatically verified address or pin.
    return { found: true, candidate: { postcode, distanceM: result.unit!.distance_m, confidence: result.unit!.confidence } };
  }
}
