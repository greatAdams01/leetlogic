import { Router, raw } from "express";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@leetlogic/database";
import { getConfig } from "../config.js";
import { decryptSecret, encryptSecret, safeEqual } from "../lib/crypto.js";
import { requireAuth, requirePermission, requireRole } from "../middleware/auth.js";
import { AppError } from "../lib/errors.js";
import { audit } from "../services/audit.js";
import { storeMedia, readMedia, deleteMedia } from "../services/storage/private-media.js";
export const adminDocumentsRouter = Router();
export const documentUploadsRouter = Router();
adminDocumentsRouter.get(
  "/:id",
  requireAuth("admin"),
  requirePermission("verification.read"),
  async (req, res) => {
    const documentId = z.string().uuid().parse(req.params.id);
    const { expires, signature } = z
      .object({ expires: z.coerce.number().int(), signature: z.string().regex(/^[a-f0-9]{64}$/) })
      .parse(req.query);
    const expected = createHmac("sha256", getConfig().TOKEN_HASH_SECRET)
      .update(`${documentId}:${expires}`)
      .digest("hex");
    if (
      expires < Math.floor(Date.now() / 1000) ||
      expires > Math.floor(Date.now() / 1000) + 300 ||
      !safeEqual(signature, expected)
    )
      throw new AppError(
        403,
        "DOCUMENT_LINK_EXPIRED",
        "Refresh the verification review to open this document",
      );
    const document = await prisma.verificationDocument.findUnique({ where: { id: documentId } });
    const evidence = document
      ? null
      : await prisma.farmEvidence.findUnique({ where: { id: documentId } });
    const encryptedKey = document?.encryptedObjectKey || evidence?.encryptedObjectKey;
    if (!encryptedKey) throw new AppError(404, "DOCUMENT_UNAVAILABLE", "Document is unavailable");
    const objectKey = decryptSecret(encryptedKey);
    const bytes = await readMedia(objectKey);
    if (
      document &&
      createHash("sha256").update(bytes).digest("hex") !== document.checksumSha256.toLowerCase()
    )
      throw new AppError(409, "DOCUMENT_INTEGRITY_FAILED", "Document checksum does not match");
    await audit(req, {
      action: "verification.document.viewed",
      entityType: document ? "verification_document" : "farm_evidence",
      entityId: documentId,
    });
    res
      .set({
        "Content-Type":
          document?.mimeType ||
          evidence?.mimeType ||
          (bytes.subarray(0, 5).toString() === "%PDF-"
            ? "application/pdf"
            : bytes[0] === 137
              ? "image/png"
              : "image/jpeg"),
        "Content-Disposition": 'inline; filename="verification-document"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox",
      })
      .send(bytes);
  },
);
documentUploadsRouter.post(
  "/",
  requireAuth("customer"),
  requireRole("SELLER"),
  raw({
    type: ["image/jpeg", "image/png", "application/pdf", "video/mp4", "video/quicktime"],
    limit: "25mb",
  }),
  async (req, res) => {
    const kind = z.enum(["identity", "evidence"]).default("identity").parse(req.query.kind);
    const documentType =
      kind === "identity"
        ? z
            .enum(["NIN_SLIP", "VOTER_CARD", "DRIVERS_LICENSE", "PASSPORT"])
            .parse(req.query.documentType)
        : null;
    const mimeType = z
      .enum(["image/jpeg", "image/png", "application/pdf", "video/mp4", "video/quicktime"])
      .parse(req.get("Content-Type"));
    if (kind === "evidence" && mimeType === "application/pdf")
      throw new AppError(
        422,
        "FARM_EVIDENCE_REQUIRED",
        "Upload at least one farm photo or video before continuing.",
      );
    const bytes = req.body;
    if (!Buffer.isBuffer(bytes) || bytes.length === 0)
      throw new AppError(422, "FILE_REQUIRED", "Upload a PDF, PNG, or JPEG document");
    if (kind === "identity" && mimeType.startsWith("video/"))
      throw new AppError(
        422,
        "FILE_TYPE_MISMATCH",
        "Choose an image or PDF for your identity document",
      );
    if (!mimeType.startsWith("video/") && bytes.length > 10 * 1024 * 1024)
      throw new AppError(413, "FILE_TOO_LARGE", "Choose an image or PDF smaller than 10 MB");
    const magicValid = mimeType.startsWith("video/")
      ? bytes.length > 12 &&
        bytes.subarray(4, 8).toString() === "ftyp" &&
        ["isom", "iso2", "iso4", "iso5", "iso6", "mp41", "mp42", "avc1", "M4V ", "qt  "].includes(
          bytes.subarray(8, 12).toString(),
        )
      : mimeType === "application/pdf"
        ? bytes.subarray(0, 5).toString() === "%PDF-"
        : mimeType === "image/png"
          ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    if (!magicValid)
      throw new AppError(422, "FILE_TYPE_MISMATCH", "File contents do not match the declared type");
    const farmer = await prisma.farmerProfile.findUniqueOrThrow({
      where: { userId: req.auth!.sub },
    });
    const verification = await prisma.verificationCase.findFirst({
      where: { farmerProfileId: farmer.id },
      orderBy: { createdAt: "desc" },
    });
    if (!verification || !["DRAFT", "RESUBMISSION_REQUIRED"].includes(verification.status))
      throw new AppError(409, "VERIFICATION_LOCKED", "No editable verification case is available");
    const objectKey = await storeMedia(bytes, mimeType, `${farmer.id}/${randomUUID()}`);
    try {
      if (kind === "evidence") {
        const evidence = await prisma.farmEvidence.create({
          data: {
            verificationCaseId: verification.id,
            mimeType,
            encryptedObjectKey: encryptSecret(objectKey),
          },
        });
        res.status(201).json({ evidence: { id: evidence.id, hasPhoto: true, mimeType } });
        return;
      }
      const document = await prisma.verificationDocument.create({
        data: {
          verificationCaseId: verification.id,
          documentType: documentType!,
          mimeType,
          checksumSha256: createHash("sha256").update(bytes).digest("hex"),
          encryptedObjectKey: encryptSecret(objectKey),
        },
      });
      res.status(201).json({
        document: {
          id: document.id,
          documentType,
          mimeType,
          checksumSha256: document.checksumSha256,
        },
      });
    } catch (error) {
      await deleteMedia(objectKey);
      throw error;
    }
  },
);
