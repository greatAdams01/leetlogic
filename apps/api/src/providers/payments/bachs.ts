import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { isHostedPaymentUrl } from "@leetlogic/contracts";
import { getConfig } from "../../config.js";
import { AppError } from "../../lib/errors.js";
export function minor(value: string): bigint {
  if (!/^\d{1,16}(\.\d{1,2})?$/.test(value))
    throw new AppError(
      502,
      "PAYMENT_AMOUNT_INVALID",
      "We couldn’t confirm this payment amount. Please contact support.",
    );
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, "0"));
}
export function decimal(value: bigint): string {
  if (value < 0n) throw new Error("NEGATIVE_MONEY");
  return `${value / 100n}.${String(value % 100n).padStart(2, "0")}`;
}
export function paymentReady(kind = "CHECKOUT") {
  const c = getConfig();
  const enabled =
    kind === "RELEASE" || kind === "REFUND_TRANSFER"
      ? c.PAYMENTS_TRANSFERS_ENABLED
      : kind === "PAYOUT" || kind === "REFUND_PAYOUT"
        ? c.PAYMENTS_PAYOUTS_ENABLED
        : kind === "REFUND"
          ? c.PAYMENTS_REFUNDS_ENABLED
          : true;
  if (
    !c.PAYMENTS_ENABLED ||
    !c.BACHS_API_KEY ||
    !c.BACHS_ORGANIZATION_ID ||
    !c.BACHS_WEBHOOK_SECRET ||
    !enabled ||
    (kind.startsWith("REFUND") && !c.PAYMENTS_REFUNDS_ENABLED) ||
    (c.NODE_ENV === "production" && c.BACHS_MODE !== "live")
  )
    throw new AppError(
      503,
      "PAYMENTS_UNAVAILABLE",
      "Payments are not available right now. Please try again later.",
    );
  if (
    c.BACHS_MODE === "live" &&
    (!c.BACHS_PLATFORM_APPROVED ||
      !c.PAYMENTS_LIVE_MONEY ||
      (kind === "CHECKOUT" && !c.PAYMENTS_LIVE_COLLECTIONS))
  )
    throw new AppError(
      503,
      "PAYMENTS_UNAVAILABLE",
      "Payments are not available right now. Please try again later.",
    );
  if (
    (c.BACHS_MODE === "sandbox" && c.BACHS_API_KEY.startsWith("sk_live_")) ||
    (c.BACHS_MODE === "live" && c.BACHS_API_KEY.startsWith("sk_sandbox_"))
  )
    throw new AppError(
      503,
      "PAYMENTS_UNAVAILABLE",
      "Payments are not available right now. Please try again later.",
    );
  return c;
}
export function verifyBachs(
  raw: Buffer,
  headers: { v2?: string; timestamp?: string; signature?: string },
  secrets: string[],
  now = Date.now(),
) {
  let timestamp = headers.timestamp || "";
  let signatures = [headers.signature || ""];
  if (headers.v2) {
    const parts = headers.v2.split(",").map((x) => x.trim().split("="));
    timestamp = parts.find(([key]) => key === "t")?.[1] || "";
    signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value || "");
  }
  if (!/^\d{10,12}$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > 300)
    return false;
  return secrets.filter(Boolean).some((secret) => {
    const expected = createHmac("sha256", secret)
      .update(timestamp + ".")
      .update(raw)
      .digest();
    return signatures.some(
      (sig) => /^[a-f\d]{64}$/i.test(sig) && timingSafeEqual(Buffer.from(sig, "hex"), expected),
    );
  });
}
export function hostedUrl(value: string, type: "checkout" | "onboarding" = "checkout") {
  if (!isHostedPaymentUrl(value, type, getConfig().BACHS_MODE)) {
    const error = new AppError(
      502,
      "PAYMENT_PROVIDER_RESPONSE",
      "We couldn’t open the secure payment page. Please try again.",
    );
    error.diagnostics = {
      provider: "bachs",
      operation: `${type}-link`,
      reason: "UNEXPECTED_HOSTED_URL",
      hint: "Check the hosted origin and payment mode. Do not log the private link.",
    };
    throw error;
  }
  return value;
}
export class Bachs {
  constructor(private readonly request: typeof fetch = fetch) {}
  async call(path: string, body?: unknown, key?: string, account?: string): Promise<any> {
    const c = getConfig();
    if (!c.BACHS_API_KEY)
      throw new AppError(
        503,
        "PAYMENTS_UNAVAILABLE",
        "Payments are not available right now. Please try again later.",
      );
    let response: Response;
    try {
      response = await this.request(
        `${c.BACHS_MODE === "sandbox" ? "https://sandbox-api.bachs.io" : "https://api.bachs.io"}/v1${path}`,
        {
          method: body === undefined ? "GET" : "POST",
          headers: {
            Authorization: `Bearer ${c.BACHS_API_KEY}`,
            "Content-Type": "application/json",
            ...(key ? { "Idempotency-Key": key } : {}),
            ...(account ? { "X-Account-Id": account } : {}),
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          signal: AbortSignal.timeout(15000),
        },
      );
    } catch {
      throw new AppError(
        503,
        "PAYMENT_RESULT_UNKNOWN",
        "We’re checking the result. Please don’t start another payment.",
      );
    }
    if (!response.ok)
      throw new AppError(
        response.status >= 500 ? 503 : 422,
        response.status >= 500 ? "PAYMENT_RESULT_UNKNOWN" : "PAYMENT_PROVIDER_REJECTED",
        "We couldn’t complete this payment action. Please try again or contact support.",
      );
    const json = await response.json().catch(() => null);
    if (!json || typeof json !== "object")
      throw new AppError(
        502,
        "PAYMENT_RESULT_UNKNOWN",
        "We’re checking the result. Please don’t start another payment.",
      );
    return json.status === "success" && json.data ? json.data : json;
  }
  async checkout(input: { id: string; amountMinor: bigint; orderId: string }) {
    paymentReady("CHECKOUT");
    const c = getConfig();
    const base = new URL("/payments/return", c.PAYMENTS_RETURN_ORIGIN).toString();
    const result = z
      .object({
        checkout_id: z.string(),
        checkout_url: z.string(),
        expires_at: z.string().datetime(),
      })
      .passthrough()
      .parse(
        await this.call(
          "/checkout-sessions",
          {
            pricing: {
              currency: "NGN",
              amount: decimal(input.amountMinor),
              name: "LeetLogic order",
            },
            customer_bears_fee: true,
            reference: input.id,
            metadata: { order_id: input.orderId, attempt_id: input.id },
            payment_method_types: c.BACHS_BANK_REFUNDS_VERIFIED
              ? ["NGN_CARD", "NGN_BANK_TRANSFER"]
              : ["NGN_CARD"],
            success_url: `${base}?attempt=${input.id}`,
            cancel_url: `${base}?attempt=${input.id}`,
          },
          input.id,
        ),
      );
    return { ...result, checkout_url: hostedUrl(result.checkout_url) };
  }
  checkoutState(id: string) {
    return this.call(`/checkout-sessions/${encodeURIComponent(id)}`);
  }
  payment(id: string) {
    return this.call(`/payments/${encodeURIComponent(id)}`);
  }
  account(id?: string) {
    return this.call(`/accounts/${id ? encodeURIComponent(id) : "me"}`);
  }
  async accountLink(accountId: string, key: string) {
    paymentReady("ONBOARD");
    const url = new URL("/payments/return", getConfig().PAYMENTS_RETURN_ORIGIN).toString();
    const data = await this.call(
      `/accounts/${encodeURIComponent(accountId)}/account-links`,
      { type: "onboarding", refresh_url: url, return_url: url },
      key,
    );
    return hostedUrl(z.string().parse(data.url), "onboarding");
  }
  balances(account?: string) {
    return this.call("/balances", undefined, undefined, account);
  }
  banks() {
    return this.call("/reference/banks?country=NG");
  }
  destination(id: string, account: string) {
    return this.call(
      `/payouts/destinations/${encodeURIComponent(id)}`,
      undefined,
      undefined,
      account,
    );
  }
  operation(kind: string, id: string, account?: string) {
    const path =
      kind === "RELEASE" || kind === "REFUND_TRANSFER"
        ? "transfers"
        : kind === "REFUND"
          ? "refunds"
          : "payouts";
    return this.call(`/${path}/${encodeURIComponent(id)}`, undefined, undefined, account);
  }
}
export const bachs = new Bachs();
