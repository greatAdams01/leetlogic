import { z } from "zod";
export { normalizeNigerianPhone } from "./phone.js";

export const localeSchema = z.enum(["en", "pcm", "ig", "ha", "yo"]);
export type Locale = z.infer<typeof localeSchema>;

export const phoneSchema = z.string().regex(/^\+234[789][01]\d{8}$/, "Invalid Nigerian phone number");
export const requestOtpSchema = z.object({ phone: z.string().min(10).max(20), deviceId: z.string().min(8).max(128) });
export const verifyOtpSchema = requestOtpSchema.extend({ code: z.string().regex(/^\d{6}$/) });
export const refreshSchema = z.object({ refreshToken: z.string().min(32) });
export const updateMeSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  displayName: z.string().trim().min(2).max(80).optional(),
  email: z.string().email().nullable().optional(),
});
export const updateLocaleSchema = z.object({ locale: localeSchema });
export const sellerProfileSchema = z.object({
  line1: z.string().trim().min(5).max(180).optional(),
  farmName: z.string().trim().min(2).max(160), farmType: z.string().trim().min(2).max(80),
  description: z.string().trim().max(1000).optional(), state: z.string().trim().min(2).max(80),
  lga: z.string().trim().min(2).max(80), city: z.string().trim().min(2).max(100),
});
export const verificationDocumentSchema = z.object({
  documentType: z.enum(["NIN_SLIP", "VOTER_CARD", "DRIVERS_LICENSE", "PASSPORT"]),
  objectKey: z.string().min(8).max(500),
  mimeType: z.enum(["image/jpeg", "image/png", "application/pdf"]),
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/i),
  referenceLastFour: z.string().regex(/^[A-Za-z0-9]{4}$/).optional(),
});
export const farmEvidenceSchema = z.object({
  objectKey: z.string().min(8).max(500).optional(),
  note: z.string().trim().min(3).max(2000).optional(),
}).refine(value => value.objectKey || value.note, { message: "Provide a farm image, business evidence, or supporting note" });
export const submitVerificationSchema = z.object({ declarationAccepted: z.literal(true) });
export const verificationDecisionSchema = z.object({
  reason: z.string().trim().min(3).max(500), internalNotes: z.string().trim().max(2000).optional(),
});
export const adminInvitationSchema = z.object({
  email: z.string().trim().email().max(254).transform(value => value.toLowerCase()), fullName: z.string().trim().min(2).max(120),
  roleCode: z.enum(["SUPER_ADMIN", "OPERATIONS_MANAGER", "VERIFICATION_OFFICER", "FINANCE_DISPUTES_OFFICER", "SUPPORT_CONTENT_OFFICER"]),
});

export type ErrorEnvelope = { error: { code: string; message: string; fieldErrors?: Record<string, string[]>; requestId: string; retryAfterSeconds?: number } };
