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

export const authRouter = Router();
authRouter.post("/otp/request", async (req, res) => {
  const body = requestOtpSchema.parse(req.body);
  const phone = normalizeNigerianPhone(body.phone);
  await requestOtp({
    purpose: "CUSTOMER_LOGIN",
    phone,
    deviceId: body.deviceId,
    ip: req.ip,
    requestId: req.requestId,
  });
  res
    .status(202)
    .json({
      message: "If the number can receive messages, a code has been sent.",
      expiresInSeconds: 300,
      resendAfterSeconds: 60,
    });
});
authRouter.post("/otp/verify", async (req, res) => {
  const body = verifyOtpSchema.parse(req.body);
  const phone = normalizeNigerianPhone(body.phone);
  await verifyOtp({
    purpose: "CUSTOMER_LOGIN",
    phone,
    deviceId: body.deviceId,
    code: body.code,
    ip: req.ip,
    requestId: req.requestId,
  });
  const user = await prisma.user.upsert({
    where: { phoneE164: phone },
    create: {
      phoneE164: phone,
      phoneVerifiedAt: new Date(),
      lastLoginAt: new Date(),
      capabilities: { create: { capability: "BUYER" } },
      profile: { create: {} },
    },
    update: { phoneVerifiedAt: new Date(), lastLoginAt: new Date() },
    include: { capabilities: true },
  });
  const tokens = await createSession({
    subject: "CUSTOMER",
    principalId: user.id,
    deviceId: body.deviceId,
    capabilities: user.capabilities.map((x) => x.capability),
  });
  res.json({
    ...tokens,
    user: {
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
