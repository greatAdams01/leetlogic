import { Router, raw } from "express";
import { prisma } from "@leetlogic/database";
import { z } from "zod";
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { getConfig } from "../config.js";
import { AppError } from "../lib/errors.js";
export const producePhotosRouter = Router();
export const staffProducePhotosRouter = Router();
staffProducePhotosRouter.use(requireAuth("admin"), requirePermission("catalog.manage"));
const root = () => resolve(getConfig().PRIVATE_STORAGE_ROOT, "produce");
export function imageType(bytes: Buffer) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return "image/png";
  if (bytes.length > 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    return "image/jpeg";
  return null;
}
producePhotosRouter.post(
  "/",
  requireAuth("customer"),
  raw({ type: ["image/png", "image/jpeg"], limit: "10mb" }),
  async (req, res) => {
    if (!Buffer.isBuffer(req.body) || req.body.length < 16)
      throw new AppError(422, "INVALID_PHOTO", "Upload a JPEG or PNG image");
    const mimeType = imageType(req.body);
    if (!mimeType || mimeType !== req.get("content-type"))
      throw new AppError(422, "INVALID_PHOTO", "Image contents do not match its format");
    if (
      (await prisma.producePhoto.count({ where: { userId: req.auth!.sub, listingId: null } })) >= 20
    )
      throw new AppError(
        429,
        "PHOTO_LIMIT",
        "Submit existing photo drafts before uploading more images",
      );
    const id = randomUUID();
    await mkdir(root(), { recursive: true });
    await writeFile(resolve(root(), id), req.body, { flag: "wx", mode: 0o600 });
    try {
      await prisma.producePhoto.create({
        data: {
          id,
          userId: req.auth!.sub,
          mimeType,
          checksum: createHash("sha256").update(req.body).digest("hex"),
        },
      });
    } catch (error) {
      await unlink(resolve(root(), id));
      throw error;
    }
    res.status(201).json({ id, url: `/api/customer/listing-photos/${id}` });
  },
);
producePhotosRouter.get("/:id", async (req, res, next) => {
  const id = z.string().uuid().parse(req.params.id);
  const photo = await prisma.producePhoto.findUnique({ where: { id } });
  if (!photo) throw new AppError(404, "PHOTO_NOT_FOUND", "Photo not found");
  const listing = photo.listingId
    ? await prisma.listing.findUnique({ where: { id: photo.listingId } })
    : null;
  if (!listing || listing.status !== "ACTIVE" || listing.deletedAt) {
    await requireAuth("customer")(req, res, (error) => {
      if (error) return next(error);
      if (photo.userId !== req.auth!.sub)
        return next(new AppError(404, "PHOTO_NOT_FOUND", "Photo not found"));
      void send().catch(next);
    });
    return;
  }
  await send();
  async function send() {
    const bytes = await readFile(resolve(root(), id));
    if (createHash("sha256").update(bytes).digest("hex") !== photo!.checksum)
      throw new AppError(500, "PHOTO_CORRUPT", "Photo unavailable");
    res
      .set({
        "Content-Type": photo!.mimeType,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      })
      .send(bytes);
  }
});

staffProducePhotosRouter.get("/:id", async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const photo = await prisma.producePhoto.findUnique({ where: { id } });
  if (!photo?.listingId) throw new AppError(404, "PHOTO_NOT_FOUND", "Photo not found");
  const bytes = await readFile(resolve(root(), id));
  if (createHash("sha256").update(bytes).digest("hex") !== photo.checksum)
    throw new AppError(500, "PHOTO_CORRUPT", "Photo unavailable");
  res
    .set({
      "Content-Type": photo.mimeType,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    })
    .send(bytes);
});
