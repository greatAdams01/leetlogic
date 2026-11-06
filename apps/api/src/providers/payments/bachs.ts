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
/** Checkout reads embed the submitted charge; redirects and webhook bodies are not receipts. */
export function checkoutChargeId(checkout: any): string | undefined {
  const id =
    checkout.charge?.payment_id ||
    checkout.charge?.charge_id ||
    checkout.charge_id ||
    checkout.payment_id;
  if (id === undefined || id === null) return;
  if (typeof id !== "string" || !/^[\w-]{1,160}$/.test(id))
    throw new Error("PAYMENT_CHARGE_ID_INVALID");
  return id;
}

/** Accept only the exact principal or that principal plus the provider's explicit customer fee. */
export function receiptAmounts(payment: any, principal: bigint) {
  const amount = minor(payment.amount);
  if (payment.fees && payment.fees.currency !== "NGN")
    throw new Error("PAYMENT_FEE_CURRENCY_MISMATCH");
  const fee = payment.fees ? minor(payment.fees.amount) : 0n;
  if (
    amount !== principal &&
    !(payment.merchant_bears_cost === false && amount === principal + fee)
  )
    throw new Error("PAYMENT_CHARGE_MISMATCH");
  const rawPaid = minor(payment.amount_paid || "0");
  // Bachs can report both amount and amount_paid inclusive of the customer-borne fee.
  // Never subtract a guessed fee or accept arbitrary overpayment as order funding.
  const received =
    payment.merchant_bears_cost === false && rawPaid === principal + fee ? principal : rawPaid;
  const status = String(payment.status || "").toLowerCase();
  return {
    fee,
    received,
    success:
      status === "succeeded" &&
      received === principal &&
      minor(payment.amount_remaining || "0") === 0n,
    declined: status === "failed" && received === 0n,
  };
}
/** Price and collection currency must both be NGN; charge currency alone is insufficient. */
export function assertNgnCheckout(checkout: any) {
  if (checkout.currency !== "NGN" || checkout.billing_currency !== "NGN")
    throw new AppError(409, "PAYMENT_CURRENCY_MISMATCH", "This payment page needs a currency review. Please contact support before paying.");
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
  if (kind === "CHECKOUT" && c.PAYMENT_AUTO_REFUNDS_ENABLED && !c.PAYMENTS_REFUNDS_ENABLED) {
    const error = new AppError(
      503,
      "PAYMENTS_UNAVAILABLE",
      "Payments are not available right now. Please try again later.",
    );
    error.diagnostics = {
      provider: "bachs",
      operation: "checkout_configuration",
      reason: "AUTO_REFUNDS_REQUIRE_REFUNDS_ENABLED",
      hint: "PAYMENT_AUTO_REFUNDS_ENABLED requires PAYMENTS_REFUNDS_ENABLED and a funded, verified refund route. Correct the configuration and restart the API/worker.",
    };
    throw error;
  }
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
export function checkoutReturnUrls(attemptId: string) {
  const c = getConfig();
  const origin = new URL(c.PAYMENTS_RETURN_ORIGIN);
  const local =
    origin.hostname === "localhost" ||
    origin.hostname.endsWith(".localhost") ||
    origin.hostname === "[::1]" ||
    /^(127\.|0\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(origin.hostname) ||
    origin.hostname.endsWith(".local");
  // Bachs permits omitted redirects. Use its hosted completion screen for local sandbox tests.
  if (local && c.BACHS_MODE === "sandbox" && c.NODE_ENV !== "production") return {};
  if (local || origin.protocol !== "https:" || origin.username || origin.password)
    throw new AppError(
      503,
      "PAYMENTS_RETURN_URL_INVALID",
      "Payment setup is incomplete. Please try again later.",
    );
  const target = new URL("/payments/return", origin);
  target.searchParams.set("attempt", attemptId);
  return { success_url: target.toString(), cancel_url: target.toString() };
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
          redirect: "error",
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
    if (!response.ok) {
      const error = new AppError(
        response.status >= 500 ? 503 : 422,
        response.status >= 500 ? "PAYMENT_RESULT_UNKNOWN" : "PAYMENT_PROVIDER_REJECTED",
        "We couldn’t complete this payment action. Please try again or contact support.",
      );
      const body = await response.json().catch(() => null);
      // A known provider configuration rejection needs an actionable, durable
      // code. Do not store arbitrary provider response text or customer details.
      if (response.status < 500 && path === "/refunds" &&
          typeof body?.detail === "string" &&
          /settlement currency NGN is not held by this account/i.test(body.detail))
        error.code = "PROVIDER_WALLET_MISMATCH";
      error.diagnostics = {
        provider: "bachs",
        operation: path.split("/")[1] || "request",
        providerStatus: response.status,
        reason:
          typeof body?.error_code === "string" && /^[A-Z_0-9]{1,80}$/i.test(body.error_code)
            ? body.error_code
            : "PROVIDER_REJECTED",
        hint: "Reconcile the original operation before retrying. Provider response text is intentionally omitted.",
      };
      throw error;
    }
    const json = await response.json().catch(() => null);
    if (!json || typeof json !== "object")
      throw new AppError(
        502,
        "PAYMENT_RESULT_UNKNOWN",
        "We’re checking the result. Please don’t start another payment.",
      );
    return json.status === "success" && json.data ? json.data : json;
  }
  async checkout(input: { id: string; amountMinor: bigint; orderId: string; expiresAt?: Date }) {
    paymentReady("CHECKOUT");
    const c = getConfig();
    await this.assertNgnSettlement();
    const redirects = checkoutReturnUrls(input.id);
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
            billing_currency: "NGN",
            customer_bears_fee: true,
            reference: input.id,
            metadata: { order_id: input.orderId, attempt_id: input.id },
            payment_method_types:
              c.BACHS_BANK_REFUNDS_VERIFIED &&
              (!c.PAYMENT_AUTO_REFUNDS_ENABLED ||
                (c.PAYMENTS_TRANSFERS_ENABLED &&
                  c.PAYMENTS_PAYOUTS_ENABLED &&
                  c.BACHS_NGN_PAYOUT_FEE_MINOR !== undefined))
                ? ["NGN_CARD", "NGN_BANK_TRANSFER"]
                : ["NGN_CARD"],
            ...redirects,
            expires_in_minutes: input.expiresAt
              ? Math.max(
                  1,
                  Math.min(15, Math.floor((input.expiresAt.getTime() - Date.now()) / 60000)),
                )
              : 15,
          },
          input.id,
        ),
      );
    return { ...result, checkout_url: hostedUrl(result.checkout_url) };
  }
  checkoutState(id: string) {
    return this.call(`/checkout-sessions/${encodeURIComponent(id)}`);
  }
  async refundByCharge(id: string) {
    try {
      return await this.call(`/refunds/by-charge/${encodeURIComponent(id)}`);
    } catch (error) {
      if (error instanceof AppError && error.diagnostics?.providerStatus === 404) return null;
      throw error;
    }
  }
  payment(id: string) {
    return this.call(`/payments/${encodeURIComponent(id)}`);
  }
  account(id?: string) {
    return this.call(`/accounts/${id ? encodeURIComponent(id) : "me"}`);
  }
  async assertNgnSettlement() {
    const account = await this.account();
    if (account.id !== getConfig().BACHS_ORGANIZATION_ID ||
        !Array.isArray(account.balance_currencies) || !account.balance_currencies.includes("NGN")) {
      const error = new AppError(503, "NGN_SETTLEMENT_REQUIRED", "Secure payments are temporarily unavailable. Please try again later or contact support.");
      error.diagnostics = { provider: "bachs", operation: "ngn-settlement-readiness",
        reason: "NGN_BALANCE_NOT_ENABLED_OR_ACCOUNT_MISMATCH",
        hint: "Enable NGN balances and NGN settlement for NGN checkouts in Bachs withdrawal settings. Do not use a USD-only settlement account." };
      throw error;
    }
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
