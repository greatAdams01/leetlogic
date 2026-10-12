import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@leetlogic/database";
import { redis } from "../lib/redis.js";
import { getConfig } from "../config.js";
import { logger } from "../lib/logger.js";
const supported = ["en", "ha", "ig", "yo"];
export function protectTokens(text: string) {
  const tokens: string[] = [];
  const protectedText = text.replace(
    /\{\{[^}]+\}\}|\{[a-zA-Z_][\w.]*\}|https?:\/\/\S+|[\w.+-]+@[\w.-]+\.\w+|(?:₦|NGN\s*)?\d[\d,.]*(?:\s*(?:kg|g|NGN))?|\b[A-Z]{2,}-[A-Z0-9-]+\b/g,
    (token) => {
      tokens.push(token);
      return `<span translate="no">LLTOKEN${tokens.length - 1}X</span>`;
    },
  );
  return {
    text: protectedText,
    restore(value: string) {
      let output = value;
      for (let i = 0; i < tokens.length; i++) {
        const marker = `LLTOKEN${i}X`;
        if (output.split(marker).length !== 2) throw new Error("TRANSLATION_TOKEN_CHANGED");
        output = output.replace(
          new RegExp(`<span[^>]*>${marker}</span>|${marker}`, "g"),
          tokens[i]!,
        );
      }
      return output;
    },
  };
}
export async function translateResource(input: {
  resourceType: string;
  resourceId: string;
  sourceLocale: string;
  targetLocale: string;
  text: string;
}): Promise<{ text: string; original: string; translated: boolean; reason?: string }> {
  const original = { text: input.text, original: input.text, translated: false };
  if (input.sourceLocale === input.targetLocale) return original;
  const c = getConfig();
  if (!supported.includes(input.sourceLocale) || !supported.includes(input.targetLocale))
    return { ...original, reason: "LANGUAGE_NOT_SUPPORTED" };
  if (!c.TRANSLATION_ENABLED || !c.AZURE_TRANSLATOR_KEY || !c.AZURE_TRANSLATOR_REGION)
    return { ...original, reason: "TRANSLATION_UNAVAILABLE" };
  const sourceVersion = createHash("sha256")
    .update(input.sourceLocale + "\0" + input.text)
    .digest("hex");
  const key = {
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    sourceVersion,
    targetLocale: input.targetLocale,
  };
  const cached = await prisma.contentTranslation.findUnique({
    where: { resourceType_resourceId_sourceVersion_targetLocale: key },
  });
  if (cached) return { ...original, text: cached.text, translated: true };
  const lock = `translation:${input.resourceType}:${input.resourceId}:${sourceVersion}:${input.targetLocale}`;
  const owner = randomUUID();
  try {
    if ((await redis().set(lock, owner, "EX", 60, "NX")) !== "OK")
      return { ...original, reason: "TRANSLATION_PENDING" };
  } catch {
    return { ...original, reason: "TRANSLATION_UNAVAILABLE" };
  }
  try {
    const escaped = input.text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const protectedText = protectTokens(escaped);
    const characters = Array.from(protectedText.text).length;
    const month = new Date().toISOString().slice(0, 7);
    const admitted = await prisma.$transaction(async (tx) => {
      await tx.translationUsage.upsert({ where: { month }, create: { month }, update: {} });
      return tx.translationUsage.updateMany({
        where: { month, characters: { lte: c.TRANSLATION_MONTHLY_CAP - characters } },
        data: { characters: { increment: characters } },
      });
    });
    if (!admitted.count) return { ...original, reason: "TRANSLATION_QUOTA_REACHED" };
    const response = await fetch(
      `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&textType=html&from=${input.sourceLocale}&to=${input.targetLocale}`,
      {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": c.AZURE_TRANSLATOR_KEY!,
          "Ocp-Apim-Subscription-Region": c.AZURE_TRANSLATOR_REGION!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([{ Text: protectedText.text }]),
        signal: AbortSignal.timeout(20000),
      },
    );
    if (!response.ok) throw new Error("AZURE_UNAVAILABLE");
    const result = await response.json();
    if (typeof result?.[0]?.translations?.[0]?.text !== "string")
      throw new Error("INVALID_TRANSLATION");
    const text = protectedText
      .restore(result[0].translations[0].text)
      .replace(/<[^>]+>/g, "")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, "&");
    await prisma.contentTranslation.upsert({
      where: { resourceType_resourceId_sourceVersion_targetLocale: key },
      create: { ...key, sourceLocale: input.sourceLocale, text },
      update: {},
    });
    return { ...original, text, translated: true };
  } catch {
    logger.warn({ resourceType: input.resourceType }, "Translation request failed");
    return { ...original, reason: "TRANSLATION_UNAVAILABLE" };
  } finally {
    await redis()
      .eval(
        "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
        1,
        lock,
        owner,
      )
      .catch(() => {});
  }
}
