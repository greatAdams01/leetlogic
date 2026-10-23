import { getConfig } from "../config.js";
import { identityPassed, effectiveIdentity, publicIdentity } from "../services/identity.js";
import { Router } from "express";
import { z } from "zod";
import { translateResource } from "../services/translation.js";
import {
  farmEvidenceSchema,
  submitVerificationSchema,
  verificationDocumentSchema,
} from "@leetlogic/contracts";
import { prisma } from "@leetlogic/database";
import { requireAuth } from "../middleware/auth.js";
import { AppError } from "../lib/errors.js";
import { encryptSecret } from "../lib/crypto.js";

export const verificationRouter = Router();
verificationRouter.use(requireAuth("customer"));
async function currentCase(userId: string) {
  const farmer = await prisma.farmerProfile.findUnique({ where: { userId } });
  if (!farmer) throw new AppError(404, "SELLER_PROFILE_REQUIRED", "Create a seller profile first");
  const item = await prisma.verificationCase.findFirst({
    where: { farmerProfileId: farmer.id },
    orderBy: { createdAt: "desc" },
    include: {
      documents: { orderBy: { createdAt: "asc" } },
      evidence: { orderBy: { createdAt: "asc" } },
      reviews: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!item) throw new AppError(404, "VERIFICATION_NOT_FOUND", "Verification case was not found");
  return { farmer, item };
}
verificationRouter.get("/", async (req, res) => {
  const { farmer, item } = await currentCase(req.auth!.sub);
  const check = await effectiveIdentity(item.id);
  res.json({
    farmer,
    verification: {
      id: item.id,
      status: item.status,
      identityRequired: item.identityRequired || getConfig().IDENTITY_PROVIDER === "dojah",
      identity: publicIdentity(check),
      identityPassed: identityPassed(check),
      submittedAt: item.submittedAt,
      documents: item.documents.map((d) => ({
        id: d.id,
        documentType: d.documentType,
        mimeType: d.mimeType,
      })),
      evidence: item.evidence.map((e) => ({
        id: e.id,
        note: e.note,
        hasPhoto: !!e.encryptedObjectKey,
        mimeType: e.mimeType,
      })),
      reviews: item.reviews.map((r) => ({ reason: r.reason, decision: r.decision })),
    },
  });
});
verificationRouter.post("/", async (req, res) => {
  const { farmer, item } = await currentCase(req.auth!.sub);
  if (!["DRAFT", "RESUBMISSION_REQUIRED"].includes(item.status))
    throw new AppError(409, "VERIFICATION_LOCKED", "Verification is already under review");
  res.json({ farmer, verification: item });
});
verificationRouter.get("/voice", async (req, res) => {
  await currentCase(req.auth!.sub);
  // No production-eligible free Igbo speech provider has passed validation.
  // Do not collect audio until it can be processed without retention.
  res.json({ enabled: false, languages: [], acceptsAudio: false });
});
verificationRouter.post("/description/translate", async (req, res) => {
  const { item } = await currentCase(req.auth!.sub);
  if (!["DRAFT", "RESUBMISSION_REQUIRED"].includes(item.status))
    throw new AppError(409, "VERIFICATION_LOCKED", "Your application cannot be edited now");
  const body = z
    .object({
      text: z.string().trim().min(1).max(2000),
      sourceLocale: z.enum(["en", "ha", "ig", "yo"]),
    })
    .strict()
    .parse(req.body);
  res.json(
    await translateResource({
      resourceType: "farm-description",
      resourceId: item.id,
      sourceLocale: body.sourceLocale,
      targetLocale: "en",
      text: body.text,
    }),
  );
});
verificationRouter.post("/documents", async (req, res) => {
  const body = verificationDocumentSchema.parse(req.body);
  const { item } = await currentCase(req.auth!.sub);
  if (!["DRAFT", "RESUBMISSION_REQUIRED"].includes(item.status))
    throw new AppError(409, "VERIFICATION_LOCKED", "Documents cannot be changed now");
  const document = await prisma.verificationDocument.create({
    data: {
      verificationCaseId: item.id,
      documentType: body.documentType,
      encryptedObjectKey: encryptSecret(body.objectKey),
      mimeType: body.mimeType,
      checksumSha256: body.checksumSha256,
      referenceLastFour: body.referenceLastFour,
    },
  });
  res.status(201).json({ document: { ...document, encryptedObjectKey: undefined } });
});
verificationRouter.post("/evidence", async (req, res) => {
  const body = farmEvidenceSchema.parse(req.body);
  const { item } = await currentCase(req.auth!.sub);
  if (!["DRAFT", "RESUBMISSION_REQUIRED"].includes(item.status))
    throw new AppError(409, "VERIFICATION_LOCKED", "Evidence cannot be changed now");
  if (
    !item.evidence.some(
      (e) =>
        e.encryptedObjectKey &&
        ["image/jpeg", "image/png", "video/mp4", "video/quicktime"].includes(e.mimeType || ""),
    )
  )
    throw new AppError(
      422,
      "FARM_EVIDENCE_REQUIRED",
      "Upload at least one farm photo or video before continuing.",
    );
  const evidence = await prisma.farmEvidence.create({
    data: { verificationCaseId: item.id, note: body.note },
  });
  res.status(201).json({ evidence: { ...evidence, encryptedObjectKey: undefined } });
});
verificationRouter.post("/submit", async (req, res) => {
  submitVerificationSchema.parse(req.body);
  const { farmer, item } = await currentCase(req.auth!.sub);
  // Retrying a successful submission must not reopen or modify the application.
  if (["SUBMITTED", "UNDER_REVIEW"].includes(item.status)) {
    res.json({ verification: { id: item.id, status: item.status } });
    return;
  }
  if (!["DRAFT", "RESUBMISSION_REQUIRED"].includes(item.status))
    throw new AppError(
      409,
      "VERIFICATION_LOCKED",
      "Verification cannot be submitted in its current state",
    );
  if (!farmer.primaryAddressId)
    throw new AppError(
      422,
      "FARM_LOCATION_REQUIRED",
      "Complete your farm location before submitting",
    );
  const needsIdentity = item.identityRequired || getConfig().IDENTITY_PROVIDER === "dojah";
  if (!needsIdentity && !item.documents.length)
    throw new AppError(
      422,
      "IDENTITY_DOCUMENT_REQUIRED",
      "At least one identity document is required",
    );
  const verification = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM verification_cases WHERE id = ${item.id}::uuid FOR UPDATE`;
    const locked = await tx.verificationCase.findUniqueOrThrow({ where: { id: item.id } });
    const mediaCount = await tx.farmEvidence.count({
      where: {
        verificationCaseId: item.id,
        encryptedObjectKey: { not: null },
        mimeType: { in: ["image/jpeg", "image/png", "video/mp4", "video/quicktime"] },
      },
    });
    if (!mediaCount)
      throw new AppError(
        422,
        "FARM_EVIDENCE_REQUIRED",
        "Upload at least one farm photo or video before continuing.",
      );
    const requiredIdentity = needsIdentity || locked.identityRequired;
    if (requiredIdentity && !identityPassed(await effectiveIdentity(item.id, tx)))
      throw new AppError(
        422,
        "IDENTITY_REQUIRED",
        "Complete identity verification with Dojah before submitting.",
      );
    const changed = await tx.verificationCase.updateMany({
      where: { id: item.id, status: { in: ["DRAFT", "RESUBMISSION_REQUIRED"] } },
      data: { status: "SUBMITTED", submittedAt: new Date(), identityRequired: requiredIdentity },
    });
    if (!changed.count)
      throw new AppError(409, "VERIFICATION_LOCKED", "Verification is already under review");
    await tx.farmerProfile.update({
      where: { id: farmer.id },
      data: { verificationStatus: "SUBMITTED" },
    });
    return { id: item.id, status: "SUBMITTED" };
  });
  res.json({ verification });
});
