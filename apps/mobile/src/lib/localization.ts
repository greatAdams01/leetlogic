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
  const error = value as { code?: string; message?: string };
  const message = typeof value === "string" ? value : error?.message || "";
  if (catalogue[message]) return ui(locale, message);
  const code = error?.code || message;
  const codes: Record<string, string> = {
    INVALID_NIGERIAN_PHONE: "Enter a valid Nigerian phone number.",
    AUTH_REQUIRED: "Please sign in again.",
    SESSION_EXPIRED: "Please sign in again.",
    SIGN_IN_REQUIRED: "Please sign in again.",
    OTP_INVALID: "The code is invalid or expired. Request a new code.",
    OTP_EXPIRED: "The code is invalid or expired. Request a new code.",
    INVALID_OTP: "The code is invalid or expired. Request a new code.",
    RATE_LIMITED: "Too many attempts. Please wait and try again.",
    OTP_RATE_LIMITED: "Too many attempts. Please wait and try again.",
    OTP_RESEND_TOO_SOON: "Too many attempts. Please wait and try again.",
    OTP_ATTEMPTS_EXCEEDED: "Too many attempts. Please wait and try again.",
    OTP_DELIVERY_FAILED: "Request failed. Please try again.",
    INVENTORY_UNAVAILABLE: "This produce is no longer available in that quantity.",
    OWN_LISTING: "You cannot buy your own produce.",
    VALIDATION_ERROR: "Check the required fields and try again.",
    INVALID_QUANTITY: "Enter a positive quantity with at most three decimal places.",
    INVALID_TOTAL: "Enter a price in naira with at most two decimal places.",
    DELIVERY_UNAVAILABLE: "Delivery quotes are not available yet.",
    DELIVERY_LOCKED: "Delivery details cannot be changed after payment or dispatch.",
    DELIVERY_PRICE_CHANGED: "Delivery price changed. Staff must review the payment before booking.",
    FORBIDDEN: "You do not have access to this resource.",
    BUYER_REQUIRED: "You do not have access to this resource.",
    ORDER_NOT_FOUND: "This item could not be found.",
    LISTING_NOT_FOUND: "This item could not be found.",
    VERIFIED_FARMER_REQUIRED: "Complete farmer verification before submitting produce.",
    CANCELLATION_REQUIRES_STAFF: "Contact support to cancel a paid or dispatched order.",
  };
  return ui(locale, codes[code] || "Request failed. Please try again.");
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
  const label = code
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (x) => x.toUpperCase());
  return ui(locale, catalogue[label] ? label : "Update");
}
