import { Router } from "express";
import { authenticator } from "otplib";
import { z } from "zod";
import { refreshSchema } from "@leetlogic/contracts";
import { prisma } from "@leetlogic/database";
import { decryptSecret, encryptSecret, hashToken, randomToken } from "../lib/crypto.js";
import { AppError } from "../lib/errors.js";
import { redis } from "../lib/redis.js";
import { requireAuth } from "../middleware/auth.js";
import { checkPassword, hashPassword } from "../services/admin-password.js";
import { issueAdminLink } from "../services/admin-email.js";
import { createSession, revokeSession, rotateSession } from "../services/sessions.js";
import { signAccessToken } from "../lib/tokens.js";
import { audit } from "../services/audit.js";

export const adminAuthRouter = Router();
const totpSchema = z.object({
  preAuthToken: z.string().min(32),
  code: z.string().regex(/^\d{6}$/),
  deviceId: z.string().min(8).max(128),
});
const emailSchema = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((value) => value.toLowerCase());
const deviceSchema = z.string().min(8).max(128);
async function limit(key: string, maximum = 10) {
  const count = await redis().incr(key);
  if (count === 1) await redis().expire(key, 900);
  if (count > maximum)
    throw new AppError(429, "RATE_LIMITED", "Too many attempts. Try again in 15 minutes.");
}
async function challenge(admin: { id: string; totpEnrolledAt: Date | null }, deviceId: string) {
  const preAuthToken = randomToken(32);
  await redis().setex(
    `admin-preauth:${hashToken(preAuthToken)}`,
    300,
    JSON.stringify({ adminId: admin.id, deviceId }),
  );
  return {
    preAuthToken,
    next: admin.totpEnrolledAt ? "TOTP_CHALLENGE" : "TOTP_ENROLLMENT",
    expiresInSeconds: 300,
  };
}
async function permissions(adminId: string) {
  const rows = await prisma.adminRoleAssignment.findMany({
    where: { adminId },
    include: { role: { include: { permissions: { include: { permission: true } } } } },
  });
  return [...new Set(rows.flatMap((x) => x.role.permissions.map((y) => y.permission.code)))];
}

adminAuthRouter.post("/login", async (req, res) => {
  const body = z
    .object({ email: emailSchema, password: z.string().min(1).max(128), deviceId: deviceSchema })
    .parse(req.body);
  await limit(`admin-login-ip:${req.ip}`, 100);
  await limit(`admin-login-email:${hashToken(body.email)}`);
  const admin = await prisma.adminAccount.findUnique({ where: { email: body.email } });
  // Always perform password derivation, including unknown accounts.
  const fallback = `scrypt:${"0".repeat(32)}:${"0".repeat(128)}`;
  const valid = await checkPassword(body.password, admin?.passwordHash ?? fallback);
  if (!admin || !valid || ["SUSPENDED", "CLOSED"].includes(admin.status))
    throw new AppError(401, "ADMIN_LOGIN_FAILED", "Email or password is incorrect");
  await redis().del(`admin-login-email:${hashToken(body.email)}`);
  res.json(await challenge(admin, body.deviceId));
});
adminAuthRouter.post("/password/request-reset", async (req, res) => {
  const { email } = z.object({ email: emailSchema }).parse(req.body);
  await limit(`admin-reset:${req.ip}`);
  const admin = await prisma.adminAccount.findUnique({ where: { email } });
  if (admin?.status === "ACTIVE" || admin?.status === "INVITED")
    await issueAdminLink(admin.id, email, admin.status === "INVITED" ? "SETUP" : "RESET");
  res.status(202).json({ message: "If your account is eligible, a reset link has been sent." });
});
adminAuthRouter.post("/setup", async (req, res) => {
  const body = z
    .object({
      token: z.string().min(32).max(128),
      password: z.string().min(12).max(128),
      deviceId: deviceSchema,
    })
    .parse(req.body);
  await limit(`admin-setup:${req.ip}`);
  const passwordHash = await hashPassword(body.password);
  const admin = await prisma.$transaction(async (tx) => {
    const invitation = await tx.adminInvitation.findUnique({
      where: { tokenHash: hashToken(body.token) },
      include: { admin: true },
    });
    if (
      !invitation ||
      invitation.usedAt ||
      invitation.expiresAt <= new Date() ||
      ["SUSPENDED", "CLOSED"].includes(invitation.admin.status)
    )
      throw new AppError(401, "SETUP_EXPIRED", "Account setup link is invalid or expired");
    const consumed = await tx.adminInvitation.updateMany({
      where: { id: invitation.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (!consumed.count)
      throw new AppError(401, "SETUP_EXPIRED", "Account setup link has already been used");
    await tx.adminInvitation.updateMany({
      where: { adminId: invitation.adminId, usedAt: null },
      data: { usedAt: new Date() },
    });
    await tx.session.updateMany({
      where: { adminId: invitation.adminId },
      data: { revokedAt: new Date() },
    });
    return tx.adminAccount.update({ where: { id: invitation.adminId }, data: { passwordHash } });
  });
  res.json(await challenge(admin, body.deviceId));
});
adminAuthRouter.post("/totp/enrol", async (req, res) => {
  const { preAuthToken } = z.object({ preAuthToken: z.string().min(32) }).parse(req.body);
  const raw = await redis().get(`admin-preauth:${hashToken(preAuthToken)}`);
  if (!raw) throw new AppError(401, "PREAUTH_EXPIRED", "Login challenge has expired");
  const { adminId } = JSON.parse(raw) as { adminId: string };
  const admin = await prisma.adminAccount.findUniqueOrThrow({ where: { id: adminId } });
  if (admin.totpEnrolledAt)
    throw new AppError(409, "TOTP_ALREADY_ENROLLED", "TOTP is already enrolled");
  const enrollmentKey = `admin-totp-enroll:${hashToken(preAuthToken)}`;
  await redis().set(enrollmentKey, authenticator.generateSecret(), "EX", 300, "NX");
  const secret = (await redis().get(enrollmentKey))!;
  res.json({
    secret,
    otpauthUrl: authenticator.keyuri(admin.email ?? admin.id, "Leetlogic Admin", secret),
  });
});
adminAuthRouter.post("/totp/confirm", async (req, res) => {
  const body = totpSchema.parse(req.body);
  const raw = await redis().get(`admin-preauth:${hashToken(body.preAuthToken)}`);
  if (!raw) throw new AppError(401, "PREAUTH_EXPIRED", "Login challenge has expired");
  const { adminId, deviceId } = JSON.parse(raw) as { adminId: string; deviceId: string };
  if (deviceId !== body.deviceId)
    throw new AppError(401, "DEVICE_MISMATCH", "Login challenge is invalid");
  const admin = await prisma.adminAccount.findUniqueOrThrow({ where: { id: adminId } });
  if (["SUSPENDED", "CLOSED"].includes(admin.status))
    throw new AppError(401, "ADMIN_LOGIN_FAILED", "Account is unavailable");
  await limit(`admin-totp:${adminId}`);
  let secret: string;
  let recoveryCodes: string[] | undefined;
  if (!admin.totpEnrolledAt) {
    const pending = await redis().get(`admin-totp-enroll:${hashToken(body.preAuthToken)}`);
    if (!pending) throw new AppError(401, "TOTP_ENROLLMENT_EXPIRED", "Enrollment has expired");
    secret = pending;
  } else {
    if (!admin.totpSecretEncrypted)
      throw new AppError(500, "TOTP_CONFIGURATION_ERROR", "TOTP configuration is invalid");
    secret = decryptSecret(admin.totpSecretEncrypted);
  }
  if (!authenticator.check(body.code, secret))
    throw new AppError(401, "TOTP_INVALID", "Authenticator code is invalid");
  await redis().del(`admin-totp:${adminId}`);
  const consumed = await redis().getdel(`admin-preauth:${hashToken(body.preAuthToken)}`);
  if (!consumed) throw new AppError(401, "PREAUTH_EXPIRED", "Login challenge was already used");
  if (!admin.totpEnrolledAt) {
    recoveryCodes = Array.from({ length: 10 }, () => randomToken(8));
    const hashes = recoveryCodes.map((code) => ({ adminId: admin.id, codeHash: hashToken(code) }));
    await prisma.$transaction(async (tx) => {
      const enrolled = await tx.adminAccount.updateMany({
        where: { id: admin.id, totpEnrolledAt: null, status: "INVITED" },
        data: {
          totpSecretEncrypted: encryptSecret(secret),
          totpEnrolledAt: new Date(),
          status: "ACTIVE",
        },
      });
      if (!enrolled.count)
        throw new AppError(
          409,
          "TOTP_ALREADY_ENROLLED",
          "Authenticator enrollment has changed. Sign in again.",
        );
      await tx.adminRecoveryCode.createMany({ data: hashes });
    });
  }
  await redis().del(
    `admin-preauth:${hashToken(body.preAuthToken)}`,
    `admin-totp-enroll:${hashToken(body.preAuthToken)}`,
  );
  const tokens = await createSession({
    subject: "ADMIN",
    principalId: admin.id,
    deviceId: body.deviceId,
    permissions: await permissions(admin.id),
  });
  await prisma.adminAccount.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
  req.auth = { sub: admin.id, subject: "admin", sessionId: "pre-session" };
  await audit(req, {
    action: "admin.login.succeeded",
    entityType: "admin_account",
    entityId: admin.id,
  });
  res.json({ ...tokens, ...(recoveryCodes ? { recoveryCodes } : {}) });
});
adminAuthRouter.post("/totp/step-up", requireAuth("admin"), async (req, res) => {
  const { code } = z.object({ code: z.string().regex(/^\d{6}$/) }).parse(req.body);
  const admin = await prisma.adminAccount.findUniqueOrThrow({ where: { id: req.auth!.sub } });
  await limit(`admin-stepup:${admin.id}`);
  if (
    !admin.totpSecretEncrypted ||
    !authenticator.check(code, decryptSecret(admin.totpSecretEncrypted))
  )
    throw new AppError(401, "TOTP_INVALID", "Authenticator code is invalid");
  await redis().del(`admin-stepup:${admin.id}`);
  const accessToken = signAccessToken({ ...req.auth!, stepUpAt: Math.floor(Date.now() / 1000) });
  await audit(req, {
    action: "admin.step_up.succeeded",
    entityType: "admin_account",
    entityId: admin.id,
  });
  res.json({ accessToken, expiresInSeconds: 600 });
});
adminAuthRouter.post("/recovery", async (req, res) => {
  const body = z
    .object({
      preAuthToken: z.string().min(32).max(128),
      recoveryCode: z.string().min(8).max(64),
      deviceId: deviceSchema,
    })
    .parse(req.body);
  const raw = await redis().get(`admin-preauth:${hashToken(body.preAuthToken)}`);
  if (!raw)
    throw new AppError(401, "PREAUTH_EXPIRED", "Sign in with your email and password first");
  const { adminId, deviceId } = JSON.parse(raw) as { adminId: string; deviceId: string };
  if (deviceId !== body.deviceId)
    throw new AppError(401, "DEVICE_MISMATCH", "Login challenge is invalid");
  await limit(`admin-recovery:${adminId}`);
  await prisma.$transaction(async (tx) => {
    const admin = await tx.adminAccount.findUniqueOrThrow({ where: { id: adminId } });
    if (admin.status !== "ACTIVE")
      throw new AppError(401, "ADMIN_LOGIN_FAILED", "Account is unavailable");
    const used = await tx.adminRecoveryCode.updateMany({
      where: { adminId, codeHash: hashToken(body.recoveryCode), usedAt: null },
      data: { usedAt: new Date() },
    });
    if (!used.count)
      throw new AppError(401, "RECOVERY_INVALID", "Recovery code is invalid or already used");
    await tx.session.updateMany({ where: { adminId }, data: { revokedAt: new Date() } });
    await tx.adminAccount.update({
      where: { id: adminId },
      data: { totpEnrolledAt: null, totpSecretEncrypted: null, status: "INVITED" },
    });
    await tx.adminRecoveryCode.deleteMany({ where: { adminId } });
  });
  await redis().del(`admin-preauth:${hashToken(body.preAuthToken)}`);
  res.json(await challenge({ id: adminId, totpEnrolledAt: null }, deviceId));
});
adminAuthRouter.post("/refresh", async (req, res) =>
  res.json(await rotateSession(refreshSchema.parse(req.body).refreshToken, "ADMIN")),
);
adminAuthRouter.post("/logout", requireAuth("admin"), async (req, res) => {
  await revokeSession(req.auth!.sessionId);
  res.status(204).end();
});
