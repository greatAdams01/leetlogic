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
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
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
