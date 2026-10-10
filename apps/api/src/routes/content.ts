import { Router } from "express";
import { z } from "zod";
import { prisma } from "@leetlogic/database";
export const contentRouter = Router();
const locale = z.enum(["en", "pcm", "ig", "ha", "yo"]).default("en");
contentRouter.get("/faq", async (req, res) => {
  const query = z
    .object({ locale, audience: z.enum(["BUYERS", "FARMERS", "ALL"]).default("ALL") })
    .parse(req.query);
  const items = await prisma.faqArticle.findMany({
    where: {
      status: "PUBLISHED",
      locale: query.locale,
      ...(query.audience !== "ALL" ? { audience: { in: [query.audience, "ALL"] } } : {}),
    },
    select: { id: true, question: true, answer: true, audience: true, locale: true },
    orderBy: { createdAt: "asc" },
  });
  res.json({ items });
});
contentRouter.get("/translations", async (req, res) => {
  const language = locale.parse(req.query.locale);
  const entries = await prisma.translationEntry.findMany({
    where: { locale: language, status: "PUBLISHED" },
    select: { key: true, value: true },
  });
  res.json({
    locale: language,
    messages: Object.fromEntries(entries.map((x) => [x.key, x.value])),
  });
});
contentRouter.get("/status", async (_req, res) =>
  res.json({
    items: await prisma.systemIncident.findMany({
      where: { isPublic: true },
      select: { service: true, severity: true, message: true, status: true, updatedAt: true },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  }),
);
