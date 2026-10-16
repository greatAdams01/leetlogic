import { z } from "zod";
import { Router } from "express";
import { sellerProfileSchema, updateLocaleSchema, updateMeSchema } from "@leetlogic/contracts";
import { prisma } from "@leetlogic/database";
import { requireAuth } from "../middleware/auth.js";
import { AppError } from "../lib/errors.js";

export const meRouter = Router();
meRouter.use(requireAuth("customer"));
meRouter.get("/", async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.auth!.sub },
    include: {
      profile: true,
      capabilities: true,
      farmerProfile: true,
      addresses: { where: { deletedAt: null } },
    },
  });
  if (!user) throw new AppError(404, "USER_NOT_FOUND", "User was not found");
  res.json({ user });
});
meRouter.patch("/", async (req, res) => {
  const body = updateMeSchema.parse(req.body);
  const profile = await prisma.userProfile.upsert({
    where: { userId: req.auth!.sub },
    create: { userId: req.auth!.sub, ...body },
    update: body,
  });
  res.json({ profile });
});
meRouter.patch("/locale", async (req, res) => {
  const { locale } = updateLocaleSchema.parse(req.body);
  const language = await prisma.language.findFirst({ where: { code: locale, isEnabled: true } });
  if (!language) throw new AppError(422, "LOCALE_NOT_ENABLED", "Language is not enabled");
  await prisma.user.update({ where: { id: req.auth!.sub }, data: { preferredLocale: locale } });
  res.json({ locale });
});
meRouter.post("/seller-profile", async (req, res) => {
  const body = sellerProfileSchema.parse(req.body);
  const result = await prisma.$transaction(async (tx) => {
    await tx.userCapability.upsert({
      where: { userId_capability: { userId: req.auth!.sub, capability: "SELLER" } },
      create: { userId: req.auth!.sub, capability: "SELLER" },
      update: {},
    });
    const address = await tx.address.create({
      data: {
        userId: req.auth!.sub,
        countryCode: "NG",
        state: body.state,
        lga: body.lga,
        city: body.city,
        line1: body.line1 ?? "Farm location pending full address",
        isDefaultFarm: true,
      },
    });
    const farmer = await tx.farmerProfile.upsert({
      where: { userId: req.auth!.sub },
      create: {
        userId: req.auth!.sub,
        farmName: body.farmName,
        farmType: body.farmType,
        description: body.description,
        primaryAddressId: address.id,
      },
      update: {
        farmName: body.farmName,
        farmType: body.farmType,
        description: body.description,
        primaryAddressId: address.id,
      },
    });
    const verification =
      (await tx.verificationCase.findFirst({
        where: { farmerProfileId: farmer.id, status: { in: ["DRAFT", "RESUBMISSION_REQUIRED"] } },
      })) ?? (await tx.verificationCase.create({ data: { farmerProfileId: farmer.id } }));
    return { farmer, verification };
  });
  res.status(201).json(result);
});

const addressSchema = z.object({
  label: z.string().trim().min(1).max(60),
  state: z.string().trim().min(2).max(80),
  lga: z.string().trim().min(2).max(80),
  city: z.string().trim().min(2).max(100),
  line1: z.string().trim().min(5).max(180),
});
meRouter.post("/addresses", async (req, res) => {
  const body = addressSchema.parse(req.body);
  const address = await prisma.address.create({
    data: { ...body, countryCode: "NG", userId: req.auth!.sub },
  });
  res.status(201).json({ address });
});
