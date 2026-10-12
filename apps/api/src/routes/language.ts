import { Router } from "express";
import { z } from "zod";
import { prisma } from "@leetlogic/database";
import { requireAuth } from "../middleware/auth.js";
import { AppError } from "../lib/errors.js";
import { translateResource } from "../services/translation.js";
export const languageRouter = Router();
languageRouter.use(requireAuth("customer"));
languageRouter.get("/:resource/:id", async (req, res) => {
  const resource = z.enum(["listings", "messages"]).parse(req.params.resource);
  const id = z.string().uuid().parse(req.params.id);
  const targetLocale = z.enum(["en", "pcm", "ha", "ig", "yo"]).parse(req.query.locale);
  let text: string;
  let sourceLocale: string;
  if (resource === "listings") {
    const listing = await prisma.listing.findUnique({
      where: { id },
      include: { farmerProfile: true },
    });
    const bought = listing
      ? await prisma.tradeOrder.count({ where: { listingId: id, buyerId: req.auth!.sub } })
      : 0;
    if (
      !listing ||
      listing.deletedAt ||
      (listing.status !== "ACTIVE" && listing.farmerProfile.userId !== req.auth!.sub && !bought)
    )
      throw new AppError(404, "LISTING_NOT_FOUND", "Listing not found");
    text = listing.description ?? listing.title;
    sourceLocale = listing.sourceLocale;
  } else {
    const message = await prisma.supportMessage.findUnique({
      where: { id },
      include: { ticket: { include: { order: { include: { farmerProfile: true } } } } },
    });
    if (
      !message ||
      message.internal ||
      (message.ticket.userId !== req.auth!.sub &&
        message.ticket.order?.buyerId !== req.auth!.sub &&
        message.ticket.order?.farmerProfile.userId !== req.auth!.sub)
    )
      throw new AppError(404, "MESSAGE_NOT_FOUND", "Message not found");
    text = message.body;
    sourceLocale = message.sourceLocale;
  }
  res.json(
    await translateResource({
      resourceType: resource,
      resourceId: id,
      sourceLocale,
      targetLocale,
      text,
    }),
  );
});
