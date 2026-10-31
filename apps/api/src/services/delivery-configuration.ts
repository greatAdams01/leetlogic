import type { Config } from "../config.js";
import { AppError } from "../lib/errors.js";

/** Configuration failures must never be classified as a parcel requiring staff review. */
export function deliveryQuoteConfiguration(config: Config) {
  const list = (value: string) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  const categories = list(config.DELIVERY_ALLOWED_CATEGORIES);
  const missing = [
    !config.SHIPBUBBLE_API_KEY?.trim() && "SHIPBUBBLE_API_KEY",
    !config.SHIPBUBBLE_CATEGORY_ID && "SHIPBUBBLE_CATEGORY_ID",
    config.SHIPBUBBLE_MODE === "test" &&
      !config.SHIPBUBBLE_TEST_KEY_CONFIRMED &&
      "SHIPBUBBLE_TEST_KEY_CONFIRMED",
    !categories.length && "DELIVERY_ALLOWED_CATEGORIES",
  ].filter(Boolean);
  if (missing.length) {
    const error = new AppError(
      503,
      "DELIVERY_CONFIGURATION_REQUIRED",
      "Delivery pricing is temporarily unavailable. Please try again later.",
    );
    error.diagnostics = {
      provider: "shipbubble",
      operation: "quote-configuration",
      reason: `Missing configuration: ${missing.join(", ")}`,
      hint: "Configure the verified key mode, provider package category and supported product categories before requesting quotes. Routes are checked by the provider nationwide.",
    };
    throw error;
  }
  return { categories };
}
