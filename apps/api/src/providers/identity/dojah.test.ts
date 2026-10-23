import { createHmac, randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Config } from "../../config.js";
import {
  dojahLaunchUrl,
  dojahOutcome,
  dojahReady,
  dojahResultSchema,
  fetchDojahResult,
  validDojahSignature,
} from "./dojah.js";
const config = {
  DOJAH_ENABLED: true,
  DOJAH_MODE: "sandbox",
  DOJAH_APP_ID: "test-app",
  DOJAH_SECRET_KEY: "test-key",
  DOJAH_WEBHOOK_SECRET: "subscription-secret",
  DOJAH_WIDGET_ID: "sandbox-widget",
  DOJAH_FLOW_POLICY_CONFIRMED: true,
  DOJAH_LIVE_CHECKS: false,
} as Config;
const passed = () => ({
  reference_id: randomUUID(),
  verification_status: "Completed",
  status: true,
  data: {
    government_data: { status: true },
    user_data: { status: true },
    selfie: { status: true },
  },
});
afterEach(() => vi.unstubAllGlobals());
describe("Dojah identity protocol", () => {
  it("requires explicit setup and a separate switch for live checks", () => {
    expect(dojahReady(config)).toBe(true);
    expect(dojahReady({ ...config, DOJAH_ENABLED: false })).toBe(false);
    expect(dojahReady({ ...config, DOJAH_FLOW_POLICY_CONFIRMED: false })).toBe(false);
    expect(dojahReady({ ...config, DOJAH_WEBHOOK_SECRET: "" })).toBe(false);
    expect(dojahReady({ ...config, DOJAH_MODE: "live" })).toBe(false);
    expect(dojahReady({ ...config, DOJAH_MODE: "live", DOJAH_LIVE_CHECKS: true })).toBe(true);
  });
  it("requires a raw-body HMAC and rejects changed bodies and v2-style shared hashes", () => {
    const raw = Buffer.from('{ "reference_id": "test" }');
    const signature = createHmac("sha256", "secret").update(raw).digest("hex");
    expect(validDojahSignature(raw, signature, "secret")).toBe(true);
    expect(validDojahSignature(Buffer.from('{"reference_id":"test"}'), signature, "secret")).toBe(
      false,
    );
    expect(validDojahSignature(raw, signature, "wrong")).toBe(false);
    for (const value of ["", "abc", "z".repeat(64)])
      expect(validDojahSignature(raw, value, "secret")).toBe(false);
  });
  it("does not equate completion or a document upload with identity verification", () => {
    expect(dojahOutcome(passed())).toBe("VERIFIED");
    expect(dojahOutcome({ ...passed(), status: false })).toBe("REVIEW");
    expect(dojahOutcome({ ...passed(), data: {} })).toBe("REVIEW");
    for (const mandatory of ["government_data", "selfie", "user_data"]) {
      const result = passed();
      delete result.data[mandatory as keyof typeof result.data];
      expect(dojahOutcome(result)).toBe("REVIEW");
    }
    expect(
      dojahOutcome({ ...passed(), data: { ...passed().data, address: { status: false } } }),
    ).toBe("REVIEW");
    expect(dojahOutcome({ ...passed(), verification_status: "Pending" })).toBe("PENDING");
    expect(dojahOutcome({ ...passed(), verification_status: "Failed" })).toBe("FAILED");
    expect(dojahOutcome({ ...passed(), verification_status: "Abandoned" })).toBe("ABANDONED");
  });
  it("launches only on Dojah with an encoded server-generated reference and widget", () => {
    const reference = randomUUID();
    const url = new URL(dojahLaunchUrl(reference, "widget&fake=true"));
    expect(url.origin).toBe("https://identity.dojah.io");
    expect(url.searchParams.get("reference_id")).toBe(reference);
    expect(url.searchParams.get("widget_id")).toBe("widget&fake=true");
    expect(dojahResultSchema.safeParse({ ...passed(), reference_id: "someone-else" }).success).toBe(
      false,
    );
  });
  it("reconciles only through the configured sandbox with server-only credentials", async () => {
    const result = passed();
    const fetcher = vi.fn().mockResolvedValue(Response.json(result));
    vi.stubGlobal("fetch", fetcher);
    expect(await fetchDojahResult(result.reference_id, config)).toEqual(result);
    const [url, options] = fetcher.mock.calls[0]!;
    expect(url).toBe(
      `https://sandbox.dojah.io/api/v1/kyc/verification?reference_id=${result.reference_id}`,
    );
    expect(options.headers).toEqual({ AppId: "test-app", Authorization: "test-key" });
  });
  it("handles missing results, outages, invalid responses and mismatched references safely", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const reference = randomUUID();
    fetcher.mockResolvedValueOnce(new Response(null, { status: 404 }));
    expect(await fetchDojahResult(reference, config)).toBeNull();
    fetcher.mockRejectedValueOnce(new Error("network details with private URL"));
    await expect(fetchDojahResult(reference, config)).rejects.toMatchObject({
      code: "IDENTITY_PROVIDER_UNAVAILABLE",
    });
    fetcher.mockResolvedValueOnce(new Response(null, { status: 402 }));
    await expect(fetchDojahResult(reference, config)).rejects.toMatchObject({
      code: "IDENTITY_PROVIDER_UNAVAILABLE",
    });
    fetcher.mockResolvedValueOnce(Response.json(passed()));
    await expect(fetchDojahResult(reference, config)).rejects.toMatchObject({
      code: "IDENTITY_INVALID_RESPONSE",
    });
    fetcher.mockResolvedValueOnce(new Response("not json"));
    await expect(fetchDojahResult(reference, config)).rejects.toMatchObject({
      code: "IDENTITY_INVALID_RESPONSE",
    });
  });
});
