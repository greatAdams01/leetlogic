import { reportedDevice } from "../services/reported-device.js";
import { z } from "zod";
import { activePhones, signOutPhone } from "../services/device-sessions.js";
import { Router } from "express";
import {
  normalizeNigerianPhone,
  refreshSchema,
  requestOtpSchema,
  verifyOtpSchema,
} from "@leetlogic/contracts";
import { prisma } from "@leetlogic/database";
import { requestOtp, verifyOtp } from "../services/otp.js";
import { createSession, revokeAll, revokeSession, rotateSession } from "../services/sessions.js";
import { requireAuth } from "../middleware/auth.js";

import { AppError } from "../lib/errors.js";
import { limitAuthAttempts } from "../services/auth-attempts.js";
import { accountRole } from "../services/account-role.js";

async function checkAccount(phone: string, intent: string, role?: string) {
  const user = await prisma.user.findUnique({ where: { phoneE164: phone }, include: { capabilities: true } });
  if (intent === "REGISTER") {
    if (user) throw new AppError(409, "PHONE_ALREADY_REGISTERED", "This phone number is already registered. Please log in.");
    if (!role) throw new AppError(422, "ROLE_REQUIRED", "Choose Buyer or Seller to create your account.");
  } else {
    if (!user) throw new AppError(404, "ACCOUNT_NOT_FOUND", "No account exists for this phone number. Please create an account.");
    if (user.status !== "ACTIVE" || user.deletedAt) throw new AppError(403, "ACCOUNT_UNAVAILABLE", "Account is unavailable.");
    accountRole(user);
  }
  return user;
}
export const authRouter = Router();
authRouter.post("/otp/request", async (req, res) => {
  const body = requestOtpSchema.parse(req.body);
  const phone = normalizeNigerianPhone(body.phone);
  await limitAuthAttempts(phone, req.ip, "request");
  await checkAccount(phone, body.intent, body.role);
  await requestOtp({
    purpose: "CUSTOMER_LOGIN",
    phone,
    deviceId: `${body.deviceId}:${body.intent}:${body.intent === "REGISTER" ? body.role : ""}`,
    ip: req.ip,
    requestId: req.requestId,
  });
  res.status(202).json({
    message: "If the number can receive messages, a code has been sent.",
    expiresInSeconds: 300,
    resendAfterSeconds: 60,
  });
});
authRouter.post("/otp/verify", async (req, res) => {
  const body = verifyOtpSchema.parse(req.body);
  const phone = normalizeNigerianPhone(body.phone);
  await limitAuthAttempts(phone, req.ip, "verify");
  await verifyOtp({
    purpose: "CUSTOMER_LOGIN",
    phone,
    deviceId: `${body.deviceId}:${body.intent}:${body.intent === "REGISTER" ? body.role : ""}`,
    code: body.code,
    ip: req.ip,
    requestId: req.requestId,
  });
  const existing = await checkAccount(phone, body.intent, body.role);
  let user;
  try {
    user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: { phoneVerifiedAt: new Date(), lastLoginAt: new Date() },
          include: { capabilities: true },
        })
      : await prisma.user.create({
          data: {
            phoneE164: phone, phoneVerifiedAt: new Date(), lastLoginAt: new Date(),
            capabilities: { create: { capability: body.role! } }, profile: { create: {} },
          },
          include: { capabilities: true },
        });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002")
      throw new AppError(409, "PHONE_ALREADY_REGISTERED", "This phone number is already registered. Please log in.");
    throw error;
  }
  const role = accountRole(user);
  const tokens = await createSession({
    subject: "CUSTOMER",
    principalId: user.id,
    deviceId: body.deviceId,
    ...reportedDevice(req),
    capabilities: user.capabilities.map((x) => x.capability),
  });
  res.json({
    ...tokens,
    user: {
      role,
      id: user.id,
      phone: user.phoneE164,
      preferredLocale: user.preferredLocale,
      capabilities: user.capabilities.map((x) => x.capability),
    },
  });
});
authRouter.post("/refresh", async (req, res) =>
  res.json(await rotateSession(refreshSchema.parse(req.body).refreshToken, "CUSTOMER")),
);
authRouter.post("/logout", requireAuth("customer"), async (req, res) => {
  await revokeSession(req.auth!.sessionId);
  res.status(204).end();
});
authRouter.post("/logout-all", requireAuth("customer"), async (req, res) => {
  await revokeAll("CUSTOMER", req.auth!.sub);
  res.status(204).end();
});

authRouter.get("/sessions", requireAuth("customer"), async (req, res) => {
  res.json({ items: await activePhones(req.auth!.sub, req.auth!.sessionId) });
});
authRouter.delete("/sessions/:id", requireAuth("customer"), async (req, res) => {
  await signOutPhone(req.auth!.sub, req.auth!.sessionId, z.string().uuid().parse(req.params.id));
  res.status(204).end();
});
