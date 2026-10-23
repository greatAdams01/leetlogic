import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { getConfig, type Config } from "../../config.js";
import { AppError } from "../../lib/errors.js";

export const identityConsentVersion = "dojah-identity-v1";
export function dojahConfigurationError(c = getConfig()) {
  if (
    ![c.DOJAH_APP_ID, c.DOJAH_SECRET_KEY, c.DOJAH_WIDGET_ID, c.DOJAH_WEBHOOK_SECRET].every(
      (value) => value?.trim(),
    )
  )
    return new AppError(
      503,
      "IDENTITY_NOT_CONFIGURED",
      "Identity verification setup is incomplete. Please contact support.",
    );
  // Allow sandbox validation before policy confirmation; live checks keep both gates.
  if (
    !c.DOJAH_ENABLED ||
    (c.DOJAH_MODE === "live" && (!c.DOJAH_LIVE_CHECKS || !c.DOJAH_FLOW_POLICY_CONFIRMED))
  )
    return new AppError(
      503,
      "IDENTITY_UNAVAILABLE",
      "Identity verification is not available yet. Please try again later.",
    );
}
export function dojahReady(c = getConfig()) {
  return !dojahConfigurationError(c);
}
export function requireDojah(c = getConfig()) {
  const error = dojahConfigurationError(c);
  if (error) throw error;
  return c;
}
export function dojahLaunchUrl(reference: string, widgetId: string) {
  const url = new URL("https://identity.dojah.io/");
  url.search = new URLSearchParams({ widget_id: widgetId, reference_id: reference }).toString();
  return url.toString();
}
export function validDojahSignature(raw: Buffer, signature: string, secret: string) {
  if (!secret || !/^[a-f\d]{64}$/i.test(signature)) return false;
  return timingSafeEqual(
    Buffer.from(signature, "hex"),
    createHmac("sha256", secret).update(raw).digest(),
  );
}
const step = z.object({ status: z.boolean().optional() }).passthrough();
export const dojahResultSchema = z
  .object({
    reference_id: z.string().uuid(),
    widget_id: z.string().optional(),
    verification_status: z.string(),
    status: z.boolean().optional(),
    data: z.record(step.or(z.unknown())).optional(),
  })
  .passthrough();
export type DojahResult = z.infer<typeof dojahResultSchema>;
export function dojahSummary(result: DojahResult) {
  const passed = (name: string) => step.safeParse(result.data?.[name]).data?.status === true;
  return {
    providerCompleted: result.verification_status === "Completed",
    documentPassed: passed("id"),
    missingRequiredSteps: ["government_data", "selfie", "user_data"].filter(
      (name) => !passed(name),
    ),
  };
}
/** REST responses use entity; widget webhooks use a top-level record. */
export function parseDojahResponse(body: unknown, reference: string) {
  const record = z.record(z.unknown()).safeParse(body);
  const payload =
    record.success && Object.hasOwn(record.data, "entity") ? record.data.entity : body;
  const parsed = dojahResultSchema.safeParse(payload);
  if (!parsed.success || parsed.data.reference_id !== reference)
    throw new AppError(
      502,
      "IDENTITY_INVALID_RESPONSE",
      "The identity provider returned an unexpected result. Please contact support.",
    );
  return parsed.data;
}
export function dojahOutcome(
  result: DojahResult,
): "PENDING" | "VERIFIED" | "FAILED" | "REVIEW" | "ABANDONED" {
  if (result.verification_status === "Failed") return "FAILED";
  if (result.verification_status === "Abandoned") return "ABANDONED";
  if (result.verification_status !== "Completed") return "PENDING";
  // EasyOnboard owns the configured flow and its decision. Step keys vary by
  // widget; absent steps are not failures and must not override overall success.
  if (result.status !== true) return "REVIEW";
  return "VERIFIED";
}
export async function fetchDojahResult(
  reference: string,
  c: Config = requireDojah(),
): Promise<DojahResult | null> {
  requireDojah(c);
  const host = c.DOJAH_MODE === "sandbox" ? "https://sandbox.dojah.io" : "https://api.dojah.io";
  let response: Response;
  try {
    response = await fetch(
      `${host}/api/v1/kyc/verification?${new URLSearchParams({ reference_id: reference })}`,
      {
        headers: { AppId: c.DOJAH_APP_ID!, Authorization: c.DOJAH_SECRET_KEY! },
        signal: AbortSignal.timeout(15000),
      },
    );
  } catch {
    throw new AppError(
      503,
      "IDENTITY_PROVIDER_UNAVAILABLE",
      "The identity provider could not be reached. Please try again later.",
    );
  }
  if (response.status === 404) return null;
  if (!response.ok)
    throw new AppError(
      503,
      "IDENTITY_PROVIDER_UNAVAILABLE",
      "The identity provider could not complete this check. Please try again later.",
    );
  return parseDojahResponse(await response.json().catch(() => null), reference);
}
