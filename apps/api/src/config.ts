import { z } from "zod";

const encryptionKeySchema = z.string().refine((value) => {
  if (/^[a-f\d]{64}$/i.test(value)) return true;
  try {
    return Buffer.from(value, "base64").length === 32;
  } catch {
    return false;
  }
}, "TOTP_ENCRYPTION_KEY must be either 64 hexadecimal characters or a Base64-encoded 32-byte key");

const schema = z.object({
  LISTING_ASR_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((x) => x === "true"),
  LISTING_ASR_URL: z.string().url().default("http://127.0.0.1:8091"),
  LISTING_ASR_TOKEN: z.string().default(""),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_FORMAT: z.enum(["pretty", "json"]).optional(),
  BACHS_MODE: z.enum(["sandbox", "live"]).default("sandbox"),
  BACHS_API_KEY: z.string().optional(),
  BACHS_WEBHOOK_SECRET: z.string().optional(),
  BACHS_ORGANIZATION_ID: z.string().default(""),
  PAYMENTS_RETURN_ORIGIN: z.string().url().default("http://localhost:3001"),
  BACHS_NGN_PAYOUT_FEE_MINOR: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z
      .string()
      .regex(/^\d{1,12}$/)
      .optional(),
  ),
  PAYMENTS_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((x) => x === "true"),
  PAYMENTS_LIVE_COLLECTIONS: z
    .enum(["true", "false"])
    .default("false")
    .transform((x) => x === "true"),
  PAYMENTS_TRANSFERS_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((x) => x === "true"),
  PAYMENTS_PAYOUTS_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((x) => x === "true"),
  PAYMENTS_REFUNDS_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((x) => x === "true"),
  PAYMENTS_LIVE_MONEY: z
    .enum(["true", "false"])
    .default("false")
    .transform((x) => x === "true"),
  BACHS_PLATFORM_APPROVED: z
    .enum(["true", "false"])
    .default("false")
    .transform((x) => x === "true"),
  BACHS_BANK_REFUNDS_VERIFIED: z
    .enum(["true", "false"])
    .default("false")
    .transform((x) => x === "true"),
  DELIVERY_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((x) => x === "true"),
  DELIVERY_LIVE_BOOKINGS: z
    .enum(["true", "false"])
    .default("false")
    .transform((x) => x === "true"),
  SHIPBUBBLE_API_KEY: z.string().optional(),
  SHIPBUBBLE_TEST_KEY_CONFIRMED: z
    .enum(["true", "false"])
    .default("false")
    .transform((x) => x === "true"),
  SHIPBUBBLE_MODE: z.enum(["test", "live"]).default("test"),
  SHIPBUBBLE_CATEGORY_ID: z.preprocess(
    (x) => (x === "" ? undefined : x),
    z.coerce.number().int().positive().optional(),
  ),
  DELIVERY_ALLOWED_CATEGORIES: z.string().default(""),
  DELIVERY_ALLOWED_STATES: z.string().default(""),
  DELIVERY_MAX_WEIGHT_KG: z.coerce.number().positive().max(100).default(20),
  TRANSLATION_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((x) => x === "true"),
  AZURE_TRANSLATOR_KEY: z.string().optional(),
  AZURE_TRANSLATOR_REGION: z.string().optional(),
  TRANSLATION_MONTHLY_CAP: z.coerce.number().int().positive().max(2000000).default(1900000),
  IDENTITY_PROVIDER: z.enum(["dojah", "manual"]).default("dojah"),
  DOJAH_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((x) => x === "true"),
  DOJAH_MODE: z.enum(["sandbox", "live"]).default("sandbox"),
  DOJAH_LIVE_CHECKS: z
    .enum(["true", "false"])
    .default("false")
    .transform((x) => x === "true"),
  DOJAH_FLOW_POLICY_CONFIRMED: z
    .enum(["true", "false"])
    .default("false")
    .transform((x) => x === "true"),
  DOJAH_APP_ID: z.string().optional(),
  DOJAH_SECRET_KEY: z.string().optional(),
  DOJAH_WIDGET_ID: z.string().optional(),
  DOJAH_WEBHOOK_SECRET: z.string().optional(),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().url(),
  ACCESS_TOKEN_SECRET: z.string().min(32),
  ADMIN_ACCESS_TOKEN_SECRET: z.string().min(32),
  TOKEN_HASH_SECRET: z.string().min(32),
  TOTP_ENCRYPTION_KEY: encryptionKeySchema,
  OTP_PROVIDER: z.enum(["console", "termii"]).default("console"),
  EMAIL_PROVIDER: z.enum(["console", "resend"]).default("console"),
  RESEND_API_KEY: z.string().optional(),
  ADMIN_EMAIL_FROM: z.string().default("LeetLogic <admin@leetlogic.ng>"),
  MEDIA_STORAGE: z.enum(["local", "cloudinary"]).default("local"),
  CLOUDINARY_CLOUD_NAME: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z
      .string()
      .regex(/^[a-zA-Z0-9_-]+$/)
      .optional(),
  ),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  PRIVATE_STORAGE_ROOT: z.string().default(".private-objects"),
  ADMIN_WEB_URL: z.string().url().default("http://localhost:3001"),
  TERMII_API_KEY: z.string().optional(),
  TERMII_SENDER_ID: z.string().default("Leetlogic"),
  AFRICAS_TALKING_API_KEY: z.string().optional(),
  AFRICAS_TALKING_USERNAME: z.string().optional(),
  AFRICAS_TALKING_SENDER_ID: z.string().default("Leetlogic"),
});
export type Config = z.infer<typeof schema>;
let cached: Config | undefined;
export function getConfig(): Config {
  return (cached ??= schema.parse(process.env));
}
