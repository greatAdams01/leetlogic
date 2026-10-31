import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { digitalPostcodeSchema, type AddressInput, type PostcodeLookup } from "@leetlogic/contracts";
import { getConfig } from "../config.js";
import { AppError } from "../lib/errors.js";
import { redis } from "../lib/redis.js";
import { Nipost } from "../providers/address/nipost.js";

export const nipost = new Nipost();
const payloadSchema = z.object({
  purpose: z.literal("ndaps-address-v1"), userId: z.string().uuid(),
  postcode: digitalPostcodeSchema, mode: z.enum(["TEST", "LIVE"]), level: z.union([z.literal(1), z.literal(2)]),
  fields: z.object({ state: z.string().optional(), lga: z.string().optional(), city: z.string().optional(), line1: z.string().optional() }).strict(),
  checkedAt: z.number().int(), expiresAt: z.number().int(),
}).strict();
const sign = (value: string) => createHmac("sha256", getConfig().TOKEN_HASH_SECRET)
  .update("ndaps-address-v1:").update(value).digest("base64url");
export function issuePostcodeVerification(userId: string, lookup: PostcodeLookup) {
  if (!lookup.valid) return lookup;
  const now = Date.now();
  const encoded = Buffer.from(JSON.stringify({
    purpose: "ndaps-address-v1", userId, postcode: lookup.postcode, mode: lookup.mode,
    level: lookup.level, fields: lookup.fields, checkedAt: now, expiresAt: now + 15 * 60000,
  })).toString("base64url");
  return { ...lookup, verificationToken: `${encoded}.${sign(encoded)}` };
}
export const uncheckedPostcode = {
  postcodeVerifiedAt: null, postcodeVerificationLevel: null, postcodeVerificationMode: null,
};
const normalize = (value: string) => value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
/** Accept only a recent server-issued lookup belonging to this customer and these address fields. */
export function confirmedPostcode(userId: string, body: Pick<AddressInput, "postalCode" | "verificationToken" | "state" | "lga" | "city" | "line1">) {
  if (!body.verificationToken) return uncheckedPostcode;
  const invalid = () => new AppError(409, "POSTCODE_VERIFICATION_EXPIRED", "Check the postcode again, or save the address without postcode verification.");
  let payload: z.infer<typeof payloadSchema>;
  try {
    const [encoded, signature, extra] = body.verificationToken.split(".");
    if (!encoded || !signature || extra) throw invalid();
    const expected = Buffer.from(sign(encoded));
    const actual = Buffer.from(signature);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw invalid();
    payload = payloadSchema.parse(JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")));
  } catch { throw invalid(); }
  if (payload.userId !== userId || payload.postcode !== body.postalCode || payload.expiresAt <= Date.now() ||
    payload.checkedAt > Date.now() || payload.expiresAt - payload.checkedAt !== 15 * 60000 ||
    (getConfig().NODE_ENV === "production" && payload.mode !== "LIVE")) throw invalid();
  for (const key of ["state", "lga", "city", "line1"] as const) {
    if (payload.fields[key] && normalize(payload.fields[key]!) !== normalize(body[key]))
      throw new AppError(422, "POSTCODE_ADDRESS_MISMATCH", "The address differs from the checked postcode. Review it, check the postcode again, or use manual address entry.");
  }
  return {
    postcodeVerifiedAt: new Date(payload.checkedAt), postcodeVerificationLevel: payload.level,
    postcodeVerificationMode: payload.mode,
  };
}

const counter = `local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], 60) end
return {count, redis.call('TTL', KEYS[1])}`;
export async function limitPostcodeRequests(userId: string) {
  const [count, ttl] = await redis().eval(counter, 1, `rate:ndaps:${userId}`) as [number, number];
  if (count > 30)
    throw new AppError(429, "POSTCODE_RATE_LIMITED", "Too many postcode checks. Wait a moment and retry, or enter your address manually.", undefined, Math.max(1, ttl));
}
