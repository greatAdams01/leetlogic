import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
const config = vi.hoisted(() => ({
  NODE_ENV: "test",
  BACHS_MODE: "sandbox",
  BACHS_API_KEY: "sk_sandbox_fixture",
  BACHS_ORGANIZATION_ID: "org_fixture",
  BACHS_WEBHOOK_SECRET: "fixture",
  PAYMENTS_ENABLED: true,
  PAYMENT_AUTO_REFUNDS_ENABLED: false,
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
import {
  Bachs,
  decimal,
  minor,
  verifyBachs,
  hostedUrl,
  paymentReady,
  checkoutReturnUrls,
  checkoutChargeId,
  receiptAmounts,
  assertNgnCheckout,
} from "./bachs.js";
describe("Bachs payment protocol", () => {
  const fetcher = vi.fn(),
    provider = new Bachs(fetcher as typeof fetch);
  beforeEach(() => {
    fetcher.mockReset();
    vi.spyOn(provider, "account").mockResolvedValue({ id: "org_fixture", balance_currencies: ["NGN", "USD"] });
    config.BACHS_MODE = "sandbox";
    config.PAYMENT_AUTO_REFUNDS_ENABLED = false;
    config.PAYMENTS_REFUNDS_ENABLED = true;
    config.BACHS_BANK_REFUNDS_VERIFIED = false;
    config.PAYMENTS_RETURN_ORIGIN = "https://leetlogic.example";
  });
  it("identifies a provider refund wallet mismatch without exposing its response text", async () => {
    fetcher.mockResolvedValue(new Response(JSON.stringify({error_code:"BAD_REQUEST",detail:"Cannot refund: settlement currency NGN is not held by this account. This indicates a charge/wallet configuration mismatch."}),{status:400}));
    await expect(provider.call("/refunds",{charge_id:"ch_test"},"key_test")).rejects.toMatchObject({code:"PROVIDER_WALLET_MISMATCH",status:422});
  });
  it.each([
    {id:"org_fixture",balance_currencies:["USD"]},
    {id:"org_fixture"},
    {id:"another_org",balance_currencies:["NGN"]},
  ])("blocks checkout before submission when NGN settlement is unavailable: %j", async(account)=>{
    vi.mocked(provider.account).mockResolvedValue(account);
    await expect(provider.checkout({id:"blocked",orderId:"order",amountMinor:10000n})).rejects.toMatchObject({code:"NGN_SETTLEMENT_REQUIRED"});
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("requires both checkout price and billing currency to be NGN",()=>{
    expect(()=>assertNgnCheckout({currency:"NGN",billing_currency:"NGN"})).not.toThrow();
    for(const session of [{currency:"USD",billing_currency:"NGN"},{currency:"NGN",billing_currency:"USD"},{currency:"NGN"}])
      expect(()=>assertNgnCheckout(session)).toThrow(expect.objectContaining({code:"PAYMENT_CURRENCY_MISMATCH"}));
  });
  it("preserves exact kobo and rejects malformed or negative money", () => {
    expect(minor("9999999999999.99")).toBe(999999999999999n);
    expect(decimal(101n)).toBe("1.01");
    for (const bad of ["-1", "1.234", "1e3", "NaN", " 1"]) expect(() => minor(bad)).toThrow();
  });
  it("reads the nested charge used by real Bachs checkout responses", () => {
    expect(checkoutChargeId({ charge: { payment_id: "ch_paid" } })).toBe("ch_paid");
    expect(checkoutChargeId({ charge: null })).toBeUndefined();
    expect(checkoutChargeId({ charge_id: "ch_legacy" })).toBe("ch_legacy");
    expect(() => checkoutChargeId({ charge: { payment_id: "https://private.invalid" } })).toThrow();
  });
  it.each(["principal", "fee-inclusive"])(
    "verifies %s charge amounts without funding fees",
    (format) => {
      const receipt = receiptAmounts(
        {
          amount: format === "principal" ? "94625.00" : "96517.50",
          amount_paid: "96517.50",
          amount_remaining: "0.00",
          status: "succeeded",
          merchant_bears_cost: false,
          fees: { amount: "1892.50", currency: "NGN" },
        },
        9462500n,
      );
      expect(receipt).toEqual({ fee: 189250n, received: 9462500n, success: true, declined: false });
    },
  );
  it("does not relax amount, fee-currency or payment-status checks", () => {
    const receipt = {
      amount: "102.00",
      amount_paid: "102.00",
      amount_remaining: "0.00",
      fees: { amount: "2.00", currency: "NGN" },
      merchant_bears_cost: false,
      status: "succeeded",
    };
    expect(() => receiptAmounts({ ...receipt, amount: "103.00" }, 10000n)).toThrow(
      "PAYMENT_CHARGE_MISMATCH",
    );
    expect(() => receiptAmounts({ ...receipt, merchant_bears_cost: true }, 10000n)).toThrow();
    expect(() =>
      receiptAmounts({ ...receipt, fees: { amount: "2.00", currency: "USD" } }, 10000n),
    ).toThrow();
    expect(receiptAmounts({ ...receipt, status: "pending" }, 10000n).success).toBe(false);
    expect(receiptAmounts({ ...receipt, amount_paid: "103.00" }, 10000n).success).toBe(false);
    expect(receiptAmounts({ ...receipt, amount_remaining: "1.00" }, 10000n).success).toBe(false);
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
      billing_currency: "NGN",
      customer_bears_fee: true,
      payment_method_types: ["NGN_CARD"],
    });
    expect(options.headers["Idempotency-Key"]).toBe("attempt");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("omits unsupported local redirect URLs for sandbox checkout", async () => {
    config.PAYMENTS_RETURN_ORIGIN = "http://localhost:3001";
    fetcher.mockResolvedValue(
      Response.json({
        checkout_id: "cs_local",
        checkout_url: "https://sandbox-checkout.bachs.io/c/local",
        expires_at: "2026-10-28T00:00:00Z",
      }),
    );
    const result = await provider.checkout({ id: "local", orderId: "order", amountMinor: 12345n });
    const body = JSON.parse(fetcher.mock.calls[0]![1].body);
    expect(body.success_url).toBeUndefined();
    expect(body.cancel_url).toBeUndefined();
    expect(result.checkout_url).toBe("https://sandbox-checkout.bachs.io/c/local");
    config.BACHS_MODE = "live";
    expect(() => checkoutReturnUrls("local")).toThrow(
      expect.objectContaining({ code: "PAYMENTS_RETURN_URL_INVALID" }),
    );
    expect(() => hostedUrl("https://sandbox-checkout.bachs.io/c/local")).toThrow();
  });
  it("never retries an uncertain write and never leaks provider errors", async () => {
    fetcher.mockRejectedValue(new Error("secret upstream error"));
    await expect(provider.call("/transfers", { amount: "1.00" }, "key")).rejects.toMatchObject({
      code: "PAYMENT_RESULT_UNKNOWN",
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("accepts the actual sandbox onboarding origin without accepting lookalikes", async () => {
    fetcher.mockResolvedValue(
      Response.json({ url: "https://sandbox-connect.bachs.io/onboarding/private-link" }),
    );
    expect(await provider.accountLink("acct_1", "link-key")).toBe(
      "https://sandbox-connect.bachs.io/onboarding/private-link",
    );
    for (const url of [
      "http://sandbox-connect.bachs.io/a",
      "https://sandbox-connect.bachs.io.evil.test/a",
      "https://user@sandbox-connect.bachs.io/a",
      "https://sandbox-connect.bachs.io:8443/a",
      "not-a-url",
    ])
      expect(() => hostedUrl(url, "onboarding")).toThrow();
    config.BACHS_MODE = "live";
    expect(() => hostedUrl("https://sandbox-connect.bachs.io/a", "onboarding")).toThrow();
    expect(hostedUrl("https://connect.bachs.io/a", "onboarding")).toBe(
      "https://connect.bachs.io/a",
    );
  });
  it("identifies the automatic-refund configuration that blocks checkout", () => {
    config.PAYMENT_AUTO_REFUNDS_ENABLED = true;
    config.PAYMENTS_REFUNDS_ENABLED = false;
    let error: any;
    try {
      paymentReady("CHECKOUT");
    } catch (e) {
      error = e;
    }
    expect(error).toMatchObject({
      status: 503,
      code: "PAYMENTS_UNAVAILABLE",
      diagnostics: { reason: "AUTO_REFUNDS_REQUIRE_REFUNDS_ENABLED" },
    });
    config.PAYMENTS_REFUNDS_ENABLED = true;
    expect(paymentReady("CHECKOUT")).toBe(config);
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
  it("locates refunds by original charge without submitting another refund", async () => {
    fetcher.mockResolvedValue(
      Response.json({ refund_id: "r1", reference: "original", status: "processing" }),
    );
    expect(await provider.refundByCharge("charge/1")).toMatchObject({ refund_id: "r1" });
    expect(fetcher.mock.calls[0]![0]).toContain("/refunds/by-charge/charge%2F1");
    expect(fetcher.mock.calls[0]![1]).toMatchObject({ method: "GET" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("treats only provider 404 as missing, never an outage", async () => {
    fetcher.mockResolvedValueOnce(Response.json({ error_code: "NOT_FOUND" }, { status: 404 }));
    expect(await provider.refundByCharge("charge")).toBeNull();
    fetcher.mockResolvedValueOnce(Response.json({ error_code: "UNAVAILABLE" }, { status: 503 }));
    await expect(provider.refundByCharge("charge")).rejects.toMatchObject({
      code: "PAYMENT_RESULT_UNKNOWN",
    });
  });
});
