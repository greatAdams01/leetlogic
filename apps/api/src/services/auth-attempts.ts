import { createHash } from "node:crypto";
import { redis } from "../lib/redis.js";
import { AppError } from "../lib/errors.js";
// Check before account lookup, including unknown phones. Device IDs cannot bypass this limit.
const counter = `local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return {count, redis.call('TTL', KEYS[1])}`;
export async function limitAuthAttempts(phone: string, ip: string | undefined, action: "request" | "verify") {
  const client = redis();
  const digest = (value: string) => createHash("sha256").update(value).digest("hex");
  for (const [scope, value, limit] of [["ip", ip || "unknown", action === "request" ? 30 : 60], ["phone", phone, action === "request" ? 8 : 20]] as const) {
    const [count, ttl] = await client.eval(counter, 1, `rate:auth:${action}:${scope}:${digest(value)}`, 3600) as [number, number];
    if (count > limit)
      throw new AppError(429, "AUTH_RATE_LIMITED", "Too many sign-in attempts. Please wait and try again.", undefined, Math.max(1, ttl));
  }
}
