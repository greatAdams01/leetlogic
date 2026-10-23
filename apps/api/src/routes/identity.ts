import { Router } from "express";
import { z } from "zod";
import { prisma } from "@leetlogic/database";
import { getConfig } from "../config.js";
import { requireAuth } from "../middleware/auth.js";
import { AppError } from "../lib/errors.js";
import { audit } from "../services/audit.js";
import {
  applyIdentityResult,
  identityPassed,
  latestIdentity,
  publicIdentity,
} from "../services/identity.js";
import {
  dojahConfigurationError,
  dojahLaunchUrl,
  dojahReady,
  dojahResultSchema,
  fetchDojahResult,
  identityConsentVersion,
  requireDojah,
  validDojahSignature,
} from "../providers/identity/dojah.js";

export const identityRouter = Router();
identityRouter.use(requireAuth("customer"));
async function ownedCase(userId: string) {
  const farmer = await prisma.farmerProfile.findUnique({ where: { userId } });
  if (!farmer) throw new AppError(404, "SELLER_PROFILE_REQUIRED", "Create a seller profile first");
  const item = await prisma.verificationCase.findFirst({
    where: { farmerProfileId: farmer.id },
    orderBy: { createdAt: "desc" },
  });
  if (!item) throw new AppError(404, "VERIFICATION_NOT_FOUND", "Verification case was not found");
  return item;
}
identityRouter.get("/", async (req, res) => {
  const item = await ownedCase(req.auth!.sub);
  const check = await latestIdentity(item.id);
  res.json({
    provider: "dojah",
    required: item.identityRequired || getConfig().IDENTITY_PROVIDER === "dojah",
    available: dojahReady(),
    unavailableCode: dojahConfigurationError()?.code || null,
    consentVersion: identityConsentVersion,
    check: publicIdentity(check),
    passed: identityPassed(check),
  });
});
identityRouter.post("/start", async (req, res) => {
  z.object({ consent: z.literal(true), consentVersion: z.literal(identityConsentVersion) })
    .strict()
    .parse(req.body);
  const c = requireDojah();
  const owned = await ownedCase(req.auth!.sub);
  const check = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM verification_cases WHERE id = ${owned.id}::uuid FOR UPDATE`;
    const item = await tx.verificationCase.findUniqueOrThrow({ where: { id: owned.id } });
    if (!["DRAFT", "RESUBMISSION_REQUIRED"].includes(item.status))
      throw new AppError(
        409,
        "VERIFICATION_LOCKED",
        "Your application cannot be edited in its current state",
      );
    const latest = await latestIdentity(item.id, tx);
    if (
      latest &&
      latest.mode === c.DOJAH_MODE &&
      latest.widgetId === c.DOJAH_WIDGET_ID &&
      (latest.status === "VERIFIED" ||
        (latest.status === "PENDING" && latest.expiresAt > new Date()))
    )
      return latest;
    const recent = await tx.identityCheck.count({
      where: { verificationCaseId: item.id, createdAt: { gte: new Date(Date.now() - 86400000) } },
    });
    if (recent >= 3)
      throw new AppError(429, "RATE_LIMITED", "Too many attempts. Please wait and try again.");
    if (latest?.status === "PENDING")
      await tx.identityCheck.update({ where: { id: latest.id }, data: { status: "EXPIRED" } });
    await tx.verificationCase.update({ where: { id: item.id }, data: { identityRequired: true } });
    const created = await tx.identityCheck.create({
      data: {
        verificationCaseId: item.id,
        mode: c.DOJAH_MODE,
        widgetId: c.DOJAH_WIDGET_ID!,
        consentVersion: identityConsentVersion,
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    await audit(
      req,
      {
        action: "identity.started",
        entityType: "identity_check",
        entityId: created.id,
        after: { provider: "dojah", mode: c.DOJAH_MODE, consentVersion: identityConsentVersion },
      },
      tx,
    );
    return created;
  });
  res.json({
    check: publicIdentity(check),
    url: check.status === "VERIFIED" ? null : dojahLaunchUrl(check.id, check.widgetId),
  });
});
identityRouter.post("/refresh", async (req, res) => {
  const c = requireDojah();
  const item = await ownedCase(req.auth!.sub);
  const check = await latestIdentity(item.id);
  if (!check) throw new AppError(404, "IDENTITY_NOT_STARTED", "Start identity verification first.");
  if (check.mode !== c.DOJAH_MODE)
    throw new AppError(
      409,
      "IDENTITY_ENVIRONMENT_MISMATCH",
      "Identity session belongs to another environment.",
    );
  // Atomically throttle outbound reads across devices; no customer-supplied reference is accepted.
  const claimed =
    check.status === "PENDING" &&
    (await prisma.identityCheck.updateMany({
      where: {
        id: check.id,
        status: "PENDING",
        OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: new Date(Date.now() - 15000) } }],
      },
      data: { lastCheckedAt: new Date() },
    }));
  if (claimed && claimed.count) {
    const result = await fetchDojahResult(check.id, c);
    if (result) await applyIdentityResult(result, "reconcile", req);
  }
  const updated = await latestIdentity(item.id);
  res.json({ check: publicIdentity(updated), passed: identityPassed(updated) });
});
export const dojahWebhookRouter = Router();
dojahWebhookRouter.post("/", async (req, res) => {
  const c = requireDojah();
  if (
    !Buffer.isBuffer(req.body) ||
    !validDojahSignature(req.body, req.get("x-dojah-signature") || "", c.DOJAH_WEBHOOK_SECRET!)
  )
    throw new AppError(401, "INVALID_WEBHOOK_SIGNATURE", "Invalid webhook signature");
  let body: unknown;
  try {
    body = JSON.parse(req.body.toString("utf8"));
  } catch {
    throw new AppError(400, "INVALID_WEBHOOK", "Invalid webhook payload");
  }
  const result = dojahResultSchema.parse(body);
  await applyIdentityResult(result, "webhook", req);
  res.json({ received: true });
});
