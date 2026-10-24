import { Router } from "express";
import { z } from "zod";
import { prisma } from "@leetlogic/database";
import { requireAuth } from "../middleware/auth.js";
import { AppError } from "../lib/errors.js";
import { audit } from "../services/audit.js";
import { serialize } from "../services/delivery.js";
export const listingDraftRouter = Router();
listingDraftRouter.use(requireAuth("customer"));
export const draftSchema = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(5000),
  sourceLocale: z.enum(["en", "pcm", "ig", "ha", "yo"]),
  categoryId: z.string().uuid(),
  unitCode: z.string().min(1).max(30),
  quantity: z
    .string()
    .regex(/^\d{1,9}(\.\d{1,3})?$/)
    .refine((x) => Number(x) > 0),
  unitPriceMinor: z.string().regex(/^[1-9]\d{0,11}$/),
  addressId: z.string().uuid(),
  photoId: z.string().uuid().optional(),
});
listingDraftRouter.get("/capabilities", (_req, res) =>
  res.json({
    voice: {
      enabled: false,
      reason: "FREE_IGBO_SPEECH_PROVIDER_NOT_VALIDATED",
      requiredRecordings: 50,
      requiredNumericAccuracy: 0.95,
    },
    typedEntry: true,
  }),
);
listingDraftRouter.get("/catalogue", async (req, res) => {
  const [categories, units, addresses, farmer] = await Promise.all([
    prisma.category.findMany({ include: { translations: true } }),
    prisma.unit.findMany(),
    prisma.address.findMany({ where: { userId: req.auth!.sub, deletedAt: null } }),
    prisma.farmerProfile.findUnique({ where: { userId: req.auth!.sub } }),
  ]);
  res.json(
    serialize({ categories, units, addresses, verificationStatus: farmer?.verificationStatus }),
  );
});
listingDraftRouter.post("/", async (req, res) => {
  const fields = draftSchema.parse(req.body);
  const draft = await prisma.listingDraft.create({ data: { userId: req.auth!.sub, fields } });
  res.status(201).json(draft);
});
listingDraftRouter.get("/", async (req, res) => {
  const items = await prisma.listingDraft.findMany({
    where: { userId: req.auth!.sub, listingId: null },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
  res.json({ items });
});
listingDraftRouter.delete("/:id", async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  await prisma.$transaction(async (tx) => {
    const result = await tx.listingDraft.deleteMany({
      where: { id, userId: req.auth!.sub, listingId: null },
    });
    if (!result.count)
      throw new AppError(404, "DRAFT_NOT_FOUND", "This draft is no longer available.");
    await audit(
      req,
      { action: "listing.draft.deleted", entityType: "listingDraft", entityId: id },
      tx,
    );
  });
  res.status(204).end();
});
listingDraftRouter.patch("/:id", async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const fields = draftSchema.parse(req.body);
  const result = await prisma.listingDraft.updateMany({
    where: { id, userId: req.auth!.sub, listingId: null },
    data: { fields, confirmed: false },
  });
  if (!result.count)
    throw new AppError(404, "DRAFT_NOT_FOUND", "This draft is no longer available.");
  res.json({ id });
});
listingDraftRouter.get("/:id", async (req, res) => {
  const draft = await prisma.listingDraft.findFirst({
    where: { id: z.string().uuid().parse(req.params.id), userId: req.auth!.sub },
  });
  if (!draft) throw new AppError(404, "DRAFT_NOT_FOUND", "Draft not found");
  res.json(draft);
});
listingDraftRouter.post("/:id/submit", async (req, res) => {
  const confirmed = z.object({ confirmed: z.literal(true) }).parse(req.body);
  const id = z.string().uuid().parse(req.params.id);
  const listing = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM listing_drafts WHERE id = ${id}::uuid FOR UPDATE`;
    const draft = await tx.listingDraft.findFirst({ where: { id, userId: req.auth!.sub } });
    if (!draft) throw new AppError(404, "DRAFT_NOT_FOUND", "Draft not found");
    if (draft.listingId) return tx.listing.findUniqueOrThrow({ where: { id: draft.listingId } });
    const body = draftSchema.parse(draft.fields);
    const farmer = await tx.farmerProfile.findUnique({ where: { userId: req.auth!.sub } });
    if (farmer?.verificationStatus !== "APPROVED")
      throw new AppError(
        403,
        "VERIFIED_FARMER_REQUIRED",
        "Complete farmer verification before submitting produce",
      );
    const address = await tx.address.findFirst({
      where: { id: body.addressId, userId: req.auth!.sub, deletedAt: null, countryCode: "NG" },
    });
    if (!address) throw new AppError(422, "INVALID_ADDRESS", "Choose your saved farm address");
    const category = await tx.category.findUnique({ where: { id: body.categoryId } });
    const unit = await tx.unit.findUnique({ where: { code: body.unitCode } });
    if (!category || !unit)
      throw new AppError(422, "INVALID_CATALOGUE", "Choose a valid category and unit");
    const photo = body.photoId
      ? await tx.producePhoto.findFirst({
          where: { id: body.photoId, userId: req.auth!.sub, listingId: null },
        })
      : null;
    if (body.photoId && !photo)
      throw new AppError(422, "INVALID_PHOTO", "Choose your uploaded produce photo");
    const item = await tx.listing.create({
      data: {
        farmerProfileId: farmer.id,
        categoryId: body.categoryId,
        unitCode: body.unitCode,
        locationAddressId: address.id,
        title: body.title,
        description: body.description,
        sourceLocale: body.sourceLocale,
        unitPriceMinor: BigInt(body.unitPriceMinor),
        availableQuantity: body.quantity,
        shippingScope: "NATIONWIDE",
        status: "PENDING_REVIEW",
      },
    });
    if (photo) {
      const attached = await tx.producePhoto.updateMany({
        where: { id: photo.id, listingId: null },
        data: { listingId: item.id },
      });
      if (!attached.count)
        throw new AppError(409, "PHOTO_ALREADY_USED", "Photo was attached to another listing");
      await tx.listingMedia.create({
        data: {
          listingId: item.id,
          type: "IMAGE",
          objectKey: `produce/${photo.id}`,
          mimeType: photo.mimeType,
          status: "READY",
        },
      });
    }
    await tx.listingDraft.update({
      where: { id },
      data: { confirmed: confirmed.confirmed, listingId: item.id },
    });
    await audit(
      req,
      { action: "listing.draft.submitted", entityType: "listing", entityId: item.id },
      tx,
    );
    return item;
  });
  res.status(201).json(serialize({ listing }));
});
