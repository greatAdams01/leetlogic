import { describe, expect, it } from "vitest";
import type { Config } from "../config.js";
import { deliveryQuoteConfiguration } from "./delivery-configuration.js";
const ready = {
  SHIPBUBBLE_API_KEY: "sandbox-fixture",
  SHIPBUBBLE_CATEGORY_ID: 24032950,
  SHIPBUBBLE_MODE: "test",
  SHIPBUBBLE_TEST_KEY_CONFIRMED: true,
  DELIVERY_ALLOWED_CATEGORIES: "category",
} as Config;
describe("delivery quote configuration", () => {
  it.each([
    { SHIPBUBBLE_API_KEY: "" },
    { SHIPBUBBLE_CATEGORY_ID: undefined },
    { SHIPBUBBLE_TEST_KEY_CONFIRMED: false },
    { DELIVERY_ALLOWED_CATEGORIES: " , " },
  ])("rejects incomplete configuration before shipment eligibility: %j", (missing) => {
    expect(() => deliveryQuoteConfiguration({ ...ready, ...missing })).toThrow(
      expect.objectContaining({
        status: 503,
        code: "DELIVERY_CONFIGURATION_REQUIRED",
      }),
    );
  });
  it("normalizes commodity configuration without a geographic allowlist", () => {
    expect(
      deliveryQuoteConfiguration({
        ...ready,
        DELIVERY_ALLOWED_CATEGORIES: " category, , other ",
      }),
    ).toEqual({ categories: ["category", "other"] });
  });
});
