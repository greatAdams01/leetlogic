import rows from "../locales/ui.json";
import { validLocale, type Locale } from "../../../../packages/localization/src/customer-messages";
export { validLocale };
export type { Locale };
export const localeOrder: Locale[] = ["en", "pcm", "ha", "ig", "yo"];
export const catalogue = Object.fromEntries(
  rows.map((row) => [
    row[0]!,
    Object.fromEntries(localeOrder.map((locale, i) => [locale, row[i]!])),
  ]),
) as Record<string, Record<Locale, string>>;
export function ui(locale: Locale, source: string, params: Record<string, string | number> = {}) {
  const normalized = source.replace(/\s+/g, " ").trim();
  const required = normalized.endsWith(" *");
  const base = required ? normalized.slice(0, -2) : normalized;
  const translated = catalogue[base]?.[locale];
  if (translated === undefined) return source;
  const result = translated.replace(/\{(\w+)\}/g, (token, key) =>
    params[key] === undefined ? token : String(params[key]),
  );
  return `${source.match(/^\s*/)?.[0] || ""}${result}${required ? " *" : ""}${source.match(/\s*$/)?.[0] || ""}`;
}
export function localizedError(locale: Locale, value: unknown): string {
  const error = value as {
    code?: string;
    message?: string;
    requestId?: string;
    retryAfterSeconds?: number;
  };
  const message = typeof value === "string" ? value : error?.message || "";
  const code = error?.code || message;
  if (
    ["OTP_RESEND_TOO_SOON", "OTP_RATE_LIMITED", "RATE_LIMITED"].includes(code) &&
    Number.isFinite(error.retryAfterSeconds) &&
    error.retryAfterSeconds! > 0
  )
    return ui(
      locale,
      code === "OTP_RESEND_TOO_SOON"
        ? "A code was already sent. Wait {seconds} seconds before resending."
        : "Too many code requests. Try again in {seconds} seconds.",
      {
        seconds: Math.ceil(error.retryAfterSeconds!),
      },
    );
  const codes: Record<string, string> = {
    INVALID_PHOTO: "We couldn’t prepare this photo. Choose another image and try again.",
    PHOTO_LIMIT:
      "You have too many unused photos. Submit your saved listings before uploading more.",
    MEDIA_NETWORK_ERROR: "The upload service could not be reached. Please try again.",
    MEDIA_CONFIGURATION_ERROR:
      "File uploads are temporarily unavailable. Please contact support if this continues.",
    MEDIA_RATE_LIMITED: "File uploads are busy. Please wait a moment and try again.",
    MEDIA_TIMEOUT: "The file upload took too long. Check your connection and try again.",
    MEDIA_FORMAT_UNSUPPORTED:
      "This file could not be processed. Choose another JPEG, PNG, PDF or MP4 file.",
    FARM_EVIDENCE_REQUIRED: "Upload at least one farm photo or video before continuing.",
    MEDIA_UNAVAILABLE: "We couldn’t upload your file. Please try again.",
    IDENTITY_NOT_CONFIGURED:
      "We can’t start your identity check right now. Please try again later.",
    IDENTITY_UNAVAILABLE: "We can’t start your identity check right now. Please try again later.",
    IDENTITY_PROVIDER_UNAVAILABLE: "We couldn’t check your verification result. Please try again.",
    IDENTITY_INVALID_RESPONSE:
      "We couldn’t confirm your identity check. Please try again or contact support.",
    IDENTITY_REFERENCE_MISMATCH:
      "We couldn’t confirm your identity check. Please try again or contact support.",
    IDENTITY_REQUIRED: "Complete identity verification with Dojah before submitting.",
    IDENTITY_NOT_STARTED: "Start identity verification first.",
    IDENTITY_ENVIRONMENT_MISMATCH:
      "We can’t start your identity check right now. Please try again later.",
    INVALID_NIGERIAN_PHONE:
      "This number is not recognized as a Nigerian mobile number. Check its prefix and digits.",
    NETWORK_ERROR: "Unable to connect. Check your internet connection and try again.",
    REQUEST_TIMEOUT: "This is taking longer than expected. Please try again.",
    INVALID_SERVER_RESPONSE:
      "We couldn’t complete this action. Please try again or contact support if it continues.",
    DEVICE_STORAGE_UNAVAILABLE:
      "Cannot access secure storage on this device. Restart the app and try again.",
    DATABASE_UNAVAILABLE: "We can’t access your account right now. Please try again later.",
    REDIS_UNAVAILABLE: "We can’t verify your code right now. Please try again later.",
    DEPENDENCY_UNAVAILABLE:
      "We couldn’t complete this action. Please try again or contact support if it continues.",
    DATABASE_SCHEMA_MISMATCH:
      "We couldn’t complete this action. Please try again or contact support if it continues.",
    INTERNAL_ERROR:
      "We couldn’t complete this action. Please try again or contact support if it continues.",
    AUTH_REQUIRED: "Please sign in again.",
    SESSION_EXPIRED: "Please sign in again.",
    SIGN_IN_REQUIRED: "Please sign in again.",
    OTP_INVALID: "That verification code is incorrect. Check the code and try again.",
    OTP_EXPIRED: "This verification code has expired. Request a new code.",
    INVALID_OTP: "The code is invalid or expired. Request a new code.",
    RATE_LIMITED: "Too many attempts. Please wait and try again.",
    OTP_RATE_LIMITED: "Too many attempts. Please wait and try again.",
    OTP_RESEND_TOO_SOON: "A code was already requested. Wait before resending.",
    OTP_ATTEMPTS_EXCEEDED: "Too many incorrect codes. Request a new code.",
    OTP_DELIVERY_FAILED: "We couldn’t send your code. Please try again in a moment.",
    INVENTORY_UNAVAILABLE: "This produce is no longer available in that quantity.",
    OWN_LISTING: "You cannot buy your own produce.",
    VALIDATION_ERROR: "Check the required fields and try again.",
    INVALID_QUANTITY: "Enter a positive quantity with at most three decimal places.",
    INVALID_TOTAL: "Enter a price in naira with at most two decimal places.",
    SELLER_PAYMENTS_UNAVAILABLE: "This seller is finishing payment setup. Please try again later.",
    PAYMENT_SETUP_REQUIRED: "Complete your payment account setup before continuing.",
    PAYMENT_ACCOUNT_MISMATCH: "Your payment account needs a support review.",
    ORDER_EXPIRED: "This order expired. Please place a new order.",
    PAYMENT_LOCKED: "This order cannot accept a payment right now.",
    CHECKOUT_ACTIVE: "Delivery details cannot be changed while a payment is being checked.",
    TOPUP_NOT_REQUIRED: "No additional payment is needed.",
    PAYOUT_FEE_CHANGED: "The withdrawal fee changed. Please review it again.",
    PAYMENT_PROVIDER_RESPONSE: "We couldn’t open the secure payment page. Please try again.",
    PAYMENT_PROVIDER_REJECTED:
      "We couldn’t complete this payment action. Please try again or contact support.",
    PAYMENTS_UNAVAILABLE: "Payments are not available right now. Please try again later.",
    PAYMENT_RESULT_UNKNOWN: "We’re checking the result. Please don’t start another payment.",
    QUOTE_EXPIRED: "Refresh your delivery quote before paying.",
    BANK_NOT_READY: "Choose an approved bank account.",
    PAYOUT_FEE_UNAVAILABLE: "Withdrawal fees are being updated. Please try again later.",
    PAYOUT_BLOCKED: "Withdrawals are paused while an order is being reviewed.",
    INSUFFICIENT_BALANCE: "Your available earnings do not cover this withdrawal and its fee.",
    PAYMENT_REVIEW_REQUIRED: "Your payment is being reviewed. Please contact support for help.",
    DELIVERY_UNAVAILABLE: "Delivery quotes are not available yet.",
    DELIVERY_LOCKED: "Delivery details cannot be changed after payment or dispatch.",
    DELIVERY_PRICE_CHANGED: "Delivery price changed. Staff must review the payment before booking.",
    NO_HELD_FUNDS: "This order has no funds held in escrow. Contact support for help.",
    SETTLEMENT_STARTED:
      "Payment settlement has already started. Contact support immediately for help with this order.",
    DISPUTE_CLOSED: "Open a dispute before adding evidence. Resolved disputes cannot be changed.",
    EVIDENCE_LIMIT: "You can add up to five photos to a dispute.",
    FORBIDDEN: "You do not have access to this resource.",
    BUYER_REQUIRED: "You do not have access to this resource.",
    ORDER_NOT_FOUND: "This item could not be found.",
    LISTING_NOT_FOUND: "This item could not be found.",
    VERIFIED_FARMER_REQUIRED: "Complete farmer verification before submitting produce.",
    CANCELLATION_REQUIRES_STAFF: "Contact support to cancel a paid or dispatched order.",
  };
  const description = ui(
    locale,
    codes[code] || (catalogue[message] ? message : "Request failed. Please try again."),
  );
  return description;
}
export function unitLabel(locale: Locale, code: string) {
  const names: Record<string, string> = {
    KG: "Kilogram",
    KILOGRAM: "Kilogram",
    TONNE: "Tonne",
    TON: "Tonne",
    BASKET: "Basket",
    BAG: "Bag",
    CRATE: "Crate",
    PIECE: "Piece",
    LITRE: "Litre",
    LITER: "Litre",
    BUNCH: "Bunch",
  };
  return ui(locale, names[code.toUpperCase()] || code);
}
export function dateLabel(locale: Locale, value: string) {
  return new Date(value).toLocaleString(locale === "pcm" ? "en-NG" : `${locale}-NG`, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function localizedStatus(locale: Locale, code: string) {
  const financial: Record<string, string> = {
    ACCOUNT: "Payment setup",
    DESTINATION: "Bank account",
    CHECKOUT: "Payment",
    PAYOUT: "Withdrawal",
    REFUND: "Refund",
    REFUND_PAYOUT: "Refund",
    REFUND_TRANSFER: "Refund",
    RELEASE: "Earnings release",
    DELIVERY_TOPUP: "Payment",
    ORDER: "Payment",
    REQUESTED: "Waiting for approval",
    QUEUED: "Checking payment",
    PROCESSING: "Checking payment",
    PROVIDER_PENDING: "Checking payment",
    UNKNOWN: "Checking payment",
    OPEN: "Ready to pay",
    BLOCKED: "Needs review",
    EXCEPTION: "Needs review",
    SUCCEEDED: "Completed",
    EXPIRED: "Payment expired",
    FAILED: "Payment could not be completed",
  };
  if (financial[code]) return ui(locale, financial[code]!);
  const label = code
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (x) => x.toUpperCase());
  return ui(locale, catalogue[label] ? label : "Update");
}
