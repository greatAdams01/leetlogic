import { prisma } from "@leetlogic/database";
import { getConfig } from "../config.js";
import { hashToken, randomToken } from "../lib/crypto.js";
import { logger } from "../lib/logger.js";
import { AppError } from "../lib/errors.js";

export async function issueAdminLink(adminId: string, email: string, purpose: "SETUP" | "RESET") {
  const token = randomToken(32);
  const record = await prisma.adminInvitation.create({
    data: {
      adminId,
      purpose,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + (purpose === "SETUP" ? 86400000 : 1800000)),
    },
  });
  const config = getConfig();
  const link = new URL("/admin/setup", config.ADMIN_WEB_URL);
  link.searchParams.set("token", token);
  try {
    if (config.EMAIL_PROVIDER === "console") {
      if (config.NODE_ENV === "production")
        throw new AppError(503, "EMAIL_NOT_CONFIGURED", "Staff email delivery is not configured");
      logger.info({ email, setupLink: link.toString() }, "Development staff account link");
    } else {
      if (!config.RESEND_API_KEY)
        throw new AppError(503, "EMAIL_NOT_CONFIGURED", "Staff email delivery is not configured");
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: config.ADMIN_EMAIL_FROM,
          to: [email],
          subject:
            purpose === "SETUP"
              ? "Set up your LeetLogic staff account"
              : "Reset your LeetLogic staff password",
          text: `Use this link to ${purpose === "SETUP" ? "set up your account" : "reset your password"}: ${link}\nThis link expires and can only be used once.`,
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok)
        throw new AppError(503, "EMAIL_DELIVERY_FAILED", "Staff email could not be delivered");
    }
  } catch (error) {
    await prisma.adminInvitation.delete({ where: { id: record.id } });
    throw error;
  }
}
