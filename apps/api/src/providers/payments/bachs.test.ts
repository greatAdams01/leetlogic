import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
const config = vi.hoisted(() => ({
  NODE_ENV: "test",
  BACHS_MODE: "sandbox",
  BACHS_API_KEY: "sk_sandbox_fixture",
  BACHS_ORGANIZATION_ID: "org_fixture",
  BACHS_WEBHOOK_SECRET: "fixture",
  PAYMENTS_ENABLED: true,
  PAYMENTS_TRANSFERS_ENABLED: true,
  PAYMENTS_PAYOUTS_ENABLED: true,
  PAYMENTS_REFUNDS_ENABLED: true,
  PAYMENTS_RETURN_ORIGIN: "https://leetlogic.example",
  BACHS_BANK_REFUNDS_VERIFIED: false,
  PAYMENTS_LIVE_MONEY: false,
  BACHS_PLATFORM_APPROVED: false,
  PAYMENTS_LIVE_COLLECTIONS: false,
}));
vi.mock("../../config.js", () => ({ getConfig: () => config }));
import { Bachs, decimal, minor, verifyBachs, hostedUrl, paymentReady } from "./bachs.js";
describe("Bachs payment protocol", () => {
  const fetcher = vi.fn(),
    provider = new Bachs(fetcher as typeof fetch);
  beforeEach(() => {
    fetcher.mockReset();
    config.BACHS_MODE = "sandbox";
    config.BACHS_BANK_REFUNDS_VERIFIED = false;
  });
  it("preserves exact kobo and rejects malformed or negative money", () => {
    expect(minor("9999999999999.99")).toBe(999999999999999n);
    expect(decimal(101n)).toBe("1.01");
    for (const bad of ["-1", "1.234", "1e3", "NaN", " 1"]) expect(() => minor(bad)).toThrow();
  });
  it("verifies raw bytes, rotation and timestamp freshness", () => {
    const raw = Buffer.from('{"event":"collection.success"}'),
      timestamp = "1792750000";
    const sig = createHmac("sha256", "secret")
      .update(timestamp + ".")
      .update(raw)
      .digest("hex");
    const headers = { v2: `t=${timestamp},v1=${"0".repeat(64)},v1=${sig}` };
    expect(verifyBachs(raw, headers, ["old", "secret"], Number(timestamp) * 1000)).toBe(true);
    expect(
      verifyBachs(Buffer.from(raw.toString() + " "), headers, ["secret"], Number(timestamp) * 1000),
    ).toBe(false);
    expect(verifyBachs(raw, headers, ["secret"], Number(timestamp) * 1000 + 301000)).toBe(false);
  });
  it("creates one hosted checkout from server-owned amounts with customer fees", async () => {
    fetcher.mockResolvedValue(
      Response.json({
        checkout_id: "cs_1",
        checkout_url: "https://checkout.bachs.io/cs_1",
        expires_at: "2026-10-23T23:00:00Z",
      }),
    );
    await provider.checkout({ id: "attempt", orderId: "order", amountMinor: 12345n });
    const [url, options] = fetcher.mock.calls[0]!;
    expect(url).toBe("https://sandbox-api.bachs.io/v1/checkout-sessions");
    expect(JSON.parse(options.body)).toMatchObject({
      reference: "attempt",
      pricing: { currency: "NGN", amount: "123.45" },
      customer_bears_fee: true,
      payment_method_types: ["NGN_CARD"],
    });
    expect(options.headers["Idempotency-Key"]).toBe("attempt");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("never retries an uncertain write and never leaks provider errors", async () => {
    fetcher.mockRejectedValue(new Error("secret upstream error"));
    await expect(provider.call("/transfers", { amount: "1.00" }, "key")).rejects.toMatchObject({
      code: "PAYMENT_RESULT_UNKNOWN",
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("blocks unapproved live money and unsafe hosted redirects", () => {
    config.BACHS_MODE = "live";
    expect(() => paymentReady()).toThrow();
    for (const url of [
      "http://checkout.bachs.io/a",
      "https://checkout.bachs.io.evil.test/a",
      "https://user@checkout.bachs.io/a",
    ])
      expect(() => hostedUrl(url)).toThrow();
  });
});
