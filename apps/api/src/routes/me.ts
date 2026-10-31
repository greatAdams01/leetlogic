import { audit } from "../services/audit.js";
import { getConfig } from "../config.js";
import { z } from "zod";
import { Router } from "express";
import {
  coordinatesSchema,
  addressInputSchema,
  sellerProfileSchema,
  updateLocaleSchema,
  updateMeSchema,
} from "@leetlogic/contracts";
import { prisma } from "@leetlogic/database";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { AppError } from "../lib/errors.js";
import { confirmedPostcode, issuePostcodeVerification, limitPostcodeRequests, nipost, uncheckedPostcode } from "../services/postcode-verification.js";
import { guardAddressChange, lockAddressOwners, saveCustomerAddress } from "../services/addresses.js";

export const meRouter = Router();
meRouter.use((_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
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
meRouter.post("/seller-profile", requireRole("SELLER"), async (req, res) => {
  const body = sellerProfileSchema.parse(req.body);
  const result = await prisma.$transaction(async (tx) => {
    await lockAddressOwners(tx, [req.auth!.sub]);
    const existing = await tx.farmerProfile.findUnique({
      where: { userId: req.auth!.sub },
      include: { primaryAddress: true },
    });
    if (existing) {
      const latest = await tx.verificationCase.findFirst({
        where: { farmerProfileId: existing.id },
        orderBy: { createdAt: "desc" },
      });
      if (
        !["NOT_STARTED", "DRAFT", "RESUBMISSION_REQUIRED"].includes(
          latest?.status || existing.verificationStatus,
        )
      )
        throw new AppError(
          409,
          "VERIFICATION_LOCKED",
          "Your application cannot be edited in its current state",
        );
    }
    const previousAddress = existing?.primaryAddress;
    const sameAddress =
      previousAddress &&
      !previousAddress.deletedAt &&
      previousAddress.state === body.state &&
      previousAddress.lga === body.lga &&
      previousAddress.city === body.city &&
      previousAddress.line1 === body.line1 &&
      (body.line2 === undefined || previousAddress.line2 === body.line2) &&
      (body.landmark === undefined || previousAddress.landmark === body.landmark) &&
      (body.postalCode === undefined || previousAddress.postalCode === body.postalCode) &&
      (!body.coordinates ||
        (previousAddress.latitude !== null &&
          previousAddress.longitude !== null &&
          Number(previousAddress.latitude) === body.coordinates.latitude &&
          Number(previousAddress.longitude) === body.coordinates.longitude));
    const verified = confirmedPostcode(req.auth!.sub, { ...body, line1: body.line1 || "" });
    const address = sameAddress
      ? body.verificationToken !== undefined
        ? await tx.address.update({ where: { id: previousAddress.id }, data: verified })
        : previousAddress
      : await tx.address.create({
          data: {
            userId: req.auth!.sub,
            countryCode: "NG",
            state: body.state,
            lga: body.lga,
            city: body.city,
            line1: body.line1 ?? "Farm location pending full address",
            line2: body.line2,
            landmark: body.landmark,
            postalCode: body.postalCode,
            ...verified,
            isDefaultFarm: true,
            ...(body.coordinates || {}),
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
        orderBy: { createdAt: "desc" },
      })) ??
      (await tx.verificationCase.create({
        data: {
          farmerProfileId: farmer.id,
          identityRequired: getConfig().IDENTITY_PROVIDER === "dojah",
        },
      }));
    return { farmer, verification };
  });
  res.status(201).json(result);
});

meRouter.patch("/farm-location", requireRole("SELLER"), async (req, res) => {
  const coordinates = coordinatesSchema.parse(req.body);
  const farmer = await prisma.farmerProfile.findUnique({ where: { userId: req.auth!.sub } });
  if (!farmer?.primaryAddressId)
    throw new AppError(
      422,
      "FARM_ADDRESS_REQUIRED",
      "Save your farm address before adding its map location.",
    );
  await prisma.$transaction(async (tx) => {
    await lockAddressOwners(tx, [req.auth!.sub]);
    const current = await tx.farmerProfile.findUniqueOrThrow({ where: { userId: req.auth!.sub } });
    if (!current.primaryAddressId) throw new AppError(422, "FARM_ADDRESS_REQUIRED", "Save your farm address before adding its map location.");
    await tx.$queryRaw`SELECT id FROM addresses WHERE id = ${current.primaryAddressId}::uuid FOR UPDATE`;
    const address = await tx.address.findFirst({ where: { id: current.primaryAddressId, userId: req.auth!.sub, countryCode: "NG", deletedAt: null } });
    if (!address) throw new AppError(404, "ADDRESS_NOT_FOUND", "Your farm address could not be found.");
    const changed = address.latitude == null || address.longitude == null || Number(address.latitude) !== coordinates.latitude || Number(address.longitude) !== coordinates.longitude;
    if (changed) await guardAddressChange(tx, address.id);
    const updated = await tx.address.updateMany({
      where: { id: current.primaryAddressId, userId: req.auth!.sub, deletedAt: null },
      data: { ...coordinates, ...(changed ? uncheckedPostcode : {}) },
    });
    if (!updated.count)
      throw new AppError(404, "ADDRESS_NOT_FOUND", "Your farm address could not be found.");
    await audit(
      req,
      { action: "farm.location.pinned", entityType: "address", entityId: current.primaryAddressId },
      tx,
    );
  });
  res.json({ saved: true });
});

meRouter.post("/addresses", async (req, res) => {
  const body = addressInputSchema.parse(req.body);
   const address = await saveCustomerAddress(req.auth!.sub, body, undefined, req);
  res.status(201).json({ address });
});
meRouter.patch("/addresses/:id", async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
   const address = await saveCustomerAddress(req.auth!.sub, addressInputSchema.parse(req.body), id, req);
  res.json({ address });
});
meRouter.post("/postcodes/lookup", async (req, res) => {
  const { code } = z.object({ code: z.string().min(1).max(40) }).strict().parse(req.body);
  await limitPostcodeRequests(req.auth!.sub);
  res.json(issuePostcodeVerification(req.auth!.sub, await nipost.lookup(code)));
});
meRouter.post("/postcodes/search", async (req, res) => {
  const { q } = z.object({ q: z.string().trim().min(1).max(40) }).strict().parse(req.body);
  await limitPostcodeRequests(req.auth!.sub);
  res.json(await nipost.search(q));
});
meRouter.post("/postcodes/reverse", async (req, res) => {
  const point = coordinatesSchema.parse(req.body);
  await limitPostcodeRequests(req.auth!.sub);
  res.json(await nipost.reverse(point));
});
