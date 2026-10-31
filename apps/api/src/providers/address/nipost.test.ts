import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ config: { NIPOST_API_KEY: "nipost_test_fixture", NODE_ENV: "test" } }));
vi.mock("../../config.js", () => ({ getConfig: () => h.config }));
import { Nipost } from "./nipost.js";

const postcode = "FC-02-A09-DB-09";
const response = (data: unknown) => new Response(JSON.stringify({ data }), { status: 200 });
describe("documented NIPOST NDAPS gateway", () => {
  const fetcher = vi.fn<typeof fetch>();
  const provider = new Nipost(fetcher);
  beforeEach(() => {
    fetcher.mockReset();
    Object.assign(h.config, { NIPOST_API_KEY: "nipost_test_fixture", NODE_ENV: "test" });
  });
  afterEach(() => vi.restoreAllMocks());
  it("uses backend authentication and maps only documented L2 fields, never geometry", async () => {
    fetcher.mockResolvedValue(response({
      postcode, valid: true, status: "active",
      administrative_address: { state_name: "FCT", lga_name: "Bwari", locality_name: "Kubwa" },
      recent_house_address: { recent: "12 Community Road" },
      point_geometry: { coordinates: [7.4, 9.08] }, secret: "provider-private",
    }));
    expect(await provider.lookup("fc02a09db09")).toEqual({
      postcode, valid: true, mode: "TEST", level: 2, addressDetailsAvailable: true,
      fields: { state: "Federal Capital Territory", lga: "Bwari", city: "Kubwa", line1: "12 Community Road" },
    });
    expect(fetcher).toHaveBeenCalledWith(`https://api.postcode.gov.ng/v1/lookup?code=${postcode}&level=2`, expect.objectContaining({
      headers: { "X-API-Key": "nipost_test_fixture", Accept: "application/json" }, redirect: "error",
    }));
  });
  it.each([[403, "POSTCODE_ACCESS_REQUIRED"], [402, "POSTCODE_CREDITS_REQUIRED"]])("falls back from HTTP %s to validity-only L1", async (status, limitation) => {
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: "level_not_granted" } }), { status: Number(status) }));
    fetcher.mockResolvedValueOnce(response({ postcode, valid: true, administrative_address: { lga_name: "Unrequested detail" }, recent_house_address: { recent: "Unrequested street" } }));
    expect(await provider.lookup(postcode)).toEqual({ postcode, valid: true, mode: "TEST", level: 1, fields: { state: "Federal Capital Territory" }, addressDetailsAvailable: false, limitation });
    expect(fetcher.mock.calls[1]![0]).toContain("&level=1");
  });
  it("does not turn capped or empty L2 data into address verification", async () => {
    fetcher.mockResolvedValue(response({ postcode, valid: true, administrative_address: { state_name: null, lga_name: null, locality_name: null }, recent_house_address: { recent: null } }));
    const result = await provider.lookup(postcode);
    expect(result.level).toBe(1);
    expect(result.addressDetailsAvailable).toBe(false);
    expect(result.fields).toEqual({ state: "Federal Capital Territory" });
  });
  it("reports unassigned postcodes as invalid without inferred address fields", async () => {
    fetcher.mockResolvedValue(response({ postcode, valid: false, status: "not_found" }));
    expect(await provider.lookup(postcode)).toMatchObject({ valid: false, fields: {}, addressDetailsAvailable: false });
  });
  it.each(["902101", "FC-00-A09-DB-09", "FC-02-A09-DB-00", "ZZ-02-A09-DB-09"])("rejects malformed/unrecognized code %s before network access", async (code) => {
    await expect(provider.lookup(code)).rejects.toMatchObject({ code: "POSTCODE_INVALID_FORMAT" });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([
    { postcode: "LA-02-A09-DB-09", valid: true },
    { postcode, valid: true, status: "restricted" },
    { postcode, valid: "true" },
    { postcode, valid: true, administrative_address: { state_name: "Lagos" } },
  ])("rejects inconsistent or corrupt lookup identities: %j", async (data) => {
    fetcher.mockResolvedValue(response(data));
    await expect(provider.lookup(postcode)).rejects.toMatchObject({ code: "POSTCODE_PROVIDER_RESPONSE_INVALID" });
  });
  it.each(["", "nipost_pk_test_fixture", "not-a-secret-key"])("rejects unsuitable server credentials without transmitting them", async (key) => {
    h.config.NIPOST_API_KEY = key;
    await expect(provider.lookup(postcode)).rejects.toMatchObject({ code: "POSTCODE_SERVICE_CONFIGURATION" });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("requires a live key in production and honestly labels live results", async () => {
    h.config.NODE_ENV = "production";
    await expect(provider.lookup(postcode)).rejects.toMatchObject({ code: "POSTCODE_SERVICE_CONFIGURATION" });
    h.config.NIPOST_API_KEY = "nipost_live_fixture";
    fetcher.mockResolvedValue(response({ postcode, valid: true }));
    expect((await provider.lookup(postcode)).mode).toBe("LIVE");
  });
  it.each([[401, "POSTCODE_SERVICE_CONFIGURATION"], [429, "POSTCODE_RATE_LIMITED"], [500, "POSTCODE_SERVICE_UNAVAILABLE"]])("keeps HTTP %s failures safe and actionable", async (status, code) => {
    fetcher.mockResolvedValue(new Response(JSON.stringify({ error: { code: "provider_error", message: "nipost_test_secret-private-address" } }), { status: Number(status), headers: { "Retry-After": "30" } }));
    const error = await provider.lookup(postcode).catch((error: unknown) => error) as Error;
    expect(error).toMatchObject({ status: 503, code });
    expect(error.message).toContain("manually");
    expect(error.message).not.toContain("secret-private-address");
    expect(fetcher).toHaveBeenCalledOnce();
    if (status === 429) expect(error).toMatchObject({ retryAfterSeconds: 30 });
  });
  it("handles connection timeouts and malformed successful responses without manual-address blocking", async () => {
    fetcher.mockRejectedValueOnce(new DOMException("timed out", "TimeoutError"));
    await expect(provider.lookup(postcode)).rejects.toMatchObject({ code: "POSTCODE_SERVICE_UNAVAILABLE" });
    fetcher.mockResolvedValueOnce(new Response("not JSON", { status: 200 }));
    await expect(provider.lookup(postcode)).rejects.toMatchObject({ code: "POSTCODE_PROVIDER_RESPONSE_INVALID" });
  });
  it("uses segment-aware autocomplete and caps suggestions, not fabricated full addresses", async () => {
    fetcher.mockResolvedValue(response({ segment: "lga", suggestions: Array.from({ length: 25 }, (_, index) => ({ code: String(index + 1).padStart(2, "0"), label: `LGA ${index + 1}` })) }));
    const result = await provider.search("FC-0");
    expect(fetcher.mock.calls[0]![0]).toBe("https://api.postcode.gov.ng/v1/search/autocomplete?q=FC-0");
    expect(result.suggestions).toHaveLength(20);
    expect(result.segment).toBe("lga");
    await expect(provider.search("12 Main Road, Abuja")).rejects.toThrow();
  });
  it("returns a nearby building only as a candidate within the documented 25m request radius", async () => {
    fetcher.mockResolvedValue(response({ found: true, unit: { postcode, distance_m: 12, confidence: "medium", address: "Not confirmed", point_geometry: [7.4, 9.08] } }));
    expect(await provider.reverse({ latitude: 9.08, longitude: 7.4 })).toEqual({ found: true, candidate: { postcode, distanceM: 12, confidence: "medium" } });
    expect(fetcher.mock.calls[0]![0]).toContain("/v1/search/reverse?lat=9.08&lng=7.4&max_distance_m=25");
    fetcher.mockResolvedValueOnce(response({ found: false }));
    expect(await provider.reverse({ latitude: 9.08, longitude: 7.4 })).toEqual({ found: false });
    fetcher.mockResolvedValueOnce(response({ found: true, unit: { postcode, distance_m: 26, confidence: "low" } }));
    await expect(provider.reverse({ latitude: 9.08, longitude: 7.4 })).rejects.toMatchObject({ code: "POSTCODE_PROVIDER_RESPONSE_INVALID" });
  });
});
