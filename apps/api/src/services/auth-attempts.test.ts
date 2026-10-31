import { beforeEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ eval: vi.fn() }));
vi.mock("../lib/redis.js", () => ({ redis: () => ({ eval: h.eval }) }));
import { limitAuthAttempts } from "./auth-attempts.js";
beforeEach(() => vi.resetAllMocks());
it("checks both IP and phone with atomic counters and expiry", async () => {
  h.eval.mockResolvedValue([1, 3600]);
  await limitAuthAttempts("+2348012345678", "127.0.0.1", "request");
  expect(h.eval).toHaveBeenCalledTimes(2);
  expect(h.eval.mock.calls[0]?.[2]).toMatch(/^rate:auth:request:ip:/);
  expect(h.eval.mock.calls[1]?.[2]).not.toContain("+2348012345678");
  expect(h.eval.mock.calls[0]?.[0]).toContain("EXPIRE");
});
it("returns the remaining window for a throttled IP or phone", async () => {
  h.eval.mockResolvedValueOnce([31, 123]);
  await expect(limitAuthAttempts("phone", "ip", "request")).rejects.toMatchObject({ code: "AUTH_RATE_LIMITED", retryAfterSeconds: 123 });
  h.eval.mockResolvedValueOnce([1, 3600]).mockResolvedValueOnce([21, 51]);
  await expect(limitAuthAttempts("phone", "ip", "verify")).rejects.toMatchObject({ retryAfterSeconds: 51 });
});
