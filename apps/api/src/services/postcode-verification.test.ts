import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PostcodeLookup } from "@leetlogic/contracts";
const h = vi.hoisted(() => ({ config: { TOKEN_HASH_SECRET: "fixture-signing-secret", NODE_ENV: "test" }, eval: vi.fn() }));
vi.mock("../config.js", () => ({ getConfig: () => h.config }));
vi.mock("../lib/redis.js", () => ({ redis: () => ({ eval: h.eval }) }));
import { confirmedPostcode, issuePostcodeVerification, limitPostcodeRequests, uncheckedPostcode } from "./postcode-verification.js";

describe("customer-bound postcode confirmation proofs", () => {
  const userId = randomUUID();
  const lookup: PostcodeLookup = { postcode: "FC-02-A09-DB-09", valid: true, mode: "LIVE", level: 2, fields: { state: "Federal Capital Territory", lga: "Bwari", city: "Kubwa", line1: "12 Community Road" }, addressDetailsAvailable: true };
  const address = { ...lookup.fields, state: "Federal Capital Territory", lga: "Bwari", city: "Kubwa", line1: "12 Community Road", postalCode: lookup.postcode };
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-31T09:00:00Z"));
    h.config.NODE_ENV = "test";
    h.eval.mockReset();
  });
  afterEach(() => vi.useRealTimers());
  const checked = () => ({ ...address, verificationToken: issuePostcodeVerification(userId, lookup).verificationToken! });
  it("signs only valid provider lookups and never requires NIPOST for manual saves", () => {
    expect(issuePostcodeVerification(userId, { ...lookup, valid: false }).verificationToken).toBeUndefined();
    expect(confirmedPostcode(userId, { ...address, verificationToken: null })).toEqual(uncheckedPostcode);
    expect(confirmedPostcode(userId, checked())).toEqual({ postcodeVerifiedAt: new Date(), postcodeVerificationMode: "LIVE", postcodeVerificationLevel: 2 });
  });
  it("rejects replay by another customer, another postcode, or a modified signature", () => {
    const body = checked();
    for (const [owner, candidate] of [[randomUUID(), body], [userId, { ...body, postalCode: "FC-02-A09-DB-10" }], [userId, { ...body, verificationToken: body.verificationToken + "x" }]] as const)
      expect(() => confirmedPostcode(owner, candidate)).toThrow(expect.objectContaining({ code: "POSTCODE_VERIFICATION_EXPIRED" }));
  });
  it("binds every supplied address field but permits harmless case/punctuation formatting", () => {
    const body = checked();
    expect(confirmedPostcode(userId, { ...body, line1: "12 COMMUNITY ROAD." }).postcodeVerificationLevel).toBe(2);
    for (const key of ["state", "lga", "city", "line1"] as const)
      expect(() => confirmedPostcode(userId, { ...body, [key]: "Different address" })).toThrow(expect.objectContaining({ code: "POSTCODE_ADDRESS_MISMATCH" }));
  });
  it("does not claim L1 verified a manually entered street", () => {
    const proof = issuePostcodeVerification(userId, { ...lookup, level: 1, fields: { state: address.state }, addressDetailsAvailable: false });
    expect(confirmedPostcode(userId, { ...address, line1: "An independently confirmed rural address", verificationToken: proof.verificationToken }).postcodeVerificationLevel).toBe(1);
  });
  it("expires at exactly fifteen minutes and rejects TEST confirmation in production", () => {
    const body = checked();
    vi.setSystemTime(Date.now() + 15 * 60000);
    expect(() => confirmedPostcode(userId, body)).toThrow(expect.objectContaining({ code: "POSTCODE_VERIFICATION_EXPIRED" }));
    const sandbox = issuePostcodeVerification(userId, { ...lookup, mode: "TEST" });
    h.config.NODE_ENV = "production";
    expect(() => confirmedPostcode(userId, { ...address, verificationToken: sandbox.verificationToken })).toThrow(expect.objectContaining({ code: "POSTCODE_VERIFICATION_EXPIRED" }));
  });
  it("uses a per-customer Redis quota with an actionable cooldown", async () => {
    h.eval.mockResolvedValueOnce([30, 22]);
    await expect(limitPostcodeRequests(userId)).resolves.toBeUndefined();
    h.eval.mockResolvedValueOnce([31, 22]);
    await expect(limitPostcodeRequests(userId)).rejects.toMatchObject({ status: 429, code: "POSTCODE_RATE_LIMITED", retryAfterSeconds: 22 });
    expect(h.eval).toHaveBeenLastCalledWith(expect.any(String), 1, `rate:ndaps:${userId}`);
  });
});
