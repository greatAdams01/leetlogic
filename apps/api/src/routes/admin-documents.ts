import { Router, raw } from "express";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { z } from "zod";
import { prisma } from "@leetlogic/database";
import { getConfig } from "../config.js";
import { decryptSecret, encryptSecret, safeEqual } from "../lib/crypto.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { AppError } from "../lib/errors.js";
import { audit } from "../services/audit.js";
export const adminDocumentsRouter = Router();
export const documentUploadsRouter = Router();
const root = () => resolve(getConfig().PRIVATE_STORAGE_ROOT);
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
    const document = await prisma.verificationDocument.findUniqueOrThrow({
      where: { id: documentId },
    });
    const objectKey = decryptSecret(document.encryptedObjectKey);
    if (
      !/^[a-zA-Z0-9_./-]+$/.test(objectKey) ||
      objectKey.split("/").some((part) => part === ".." || part === ".")
    )
      throw new AppError(404, "DOCUMENT_UNAVAILABLE", "Document is unavailable");
    let bytes: Buffer;
    try {
      const base = await realpath(root());
      const path = await realpath(resolve(base, objectKey));
      if (!path.startsWith(base + sep)) throw new Error("Outside storage");
      bytes = await readFile(path);
    } catch {
      throw new AppError(
        404,
        "DOCUMENT_UNAVAILABLE",
        "Document file is unavailable in private storage",
      );
    }
    if (createHash("sha256").update(bytes).digest("hex") !== document.checksumSha256.toLowerCase())
      throw new AppError(409, "DOCUMENT_INTEGRITY_FAILED", "Document checksum does not match");
    await audit(req, {
      action: "verification.document.viewed",
      entityType: "verification_document",
      entityId: document.id,
    });
    res
      .set({
        "Content-Type": document.mimeType,
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
  raw({ type: ["image/jpeg", "image/png", "application/pdf"], limit: "10mb" }),
  async (req, res) => {
    const documentType = z
      .enum(["NIN_SLIP", "VOTER_CARD", "DRIVERS_LICENSE", "PASSPORT"])
      .parse(req.query.documentType);
    const mimeType = z
      .enum(["image/jpeg", "image/png", "application/pdf"])
      .parse(req.get("Content-Type"));
    const bytes = req.body;
    if (!Buffer.isBuffer(bytes) || bytes.length === 0)
      throw new AppError(422, "FILE_REQUIRED", "Upload a PDF, PNG, or JPEG document");
    const magicValid =
      mimeType === "application/pdf"
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
      where: { farmerProfileId: farmer.id, status: { in: ["DRAFT", "RESUBMISSION_REQUIRED"] } },
      orderBy: { createdAt: "desc" },
    });
    if (!verification)
      throw new AppError(409, "VERIFICATION_LOCKED", "No editable verification case is available");
    const objectKey = `${farmer.id}/${randomUUID()}`;
    await mkdir(resolve(root(), farmer.id), { recursive: true, mode: 0o700 });
    await writeFile(resolve(root(), objectKey), bytes, { mode: 0o600, flag: "wx" });
    const document = await prisma.verificationDocument.create({
      data: {
        verificationCaseId: verification.id,
        documentType,
        mimeType,
        checksumSha256: createHash("sha256").update(bytes).digest("hex"),
        encryptedObjectKey: encryptSecret(objectKey),
      },
    });
    res
      .status(201)
      .json({
        document: {
          id: document.id,
          documentType,
          mimeType,
          checksumSha256: document.checksumSha256,
        },
      });
  },
);
