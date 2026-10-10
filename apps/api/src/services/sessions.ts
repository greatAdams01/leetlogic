import { randomUUID } from "node:crypto";
import { prisma, type Prisma, type SessionSubject } from "@leetlogic/database";
import { addDays, addHours } from "./time.js";
import { hashToken, randomToken } from "../lib/crypto.js";
import { AppError } from "../lib/errors.js";
import { signAccessToken } from "../lib/tokens.js";

export async function createSession(
  input: {
    subject: SessionSubject;
    principalId: string;
    deviceId: string;
    capabilities?: string[];
    permissions?: string[];
    tokenFamilyId?: string;
    expiresAt?: Date;
  },
  client: Prisma.TransactionClient = prisma,
) {
  const refreshToken = randomToken();
  const expiresAt =
    input.expiresAt ??
    (input.subject === "ADMIN" ? addHours(new Date(), 8) : addDays(new Date(), 30));
  const session = await client.session.create({
    data: {
      subject: input.subject,
      userId: input.subject === "CUSTOMER" ? input.principalId : undefined,
      adminId: input.subject === "ADMIN" ? input.principalId : undefined,
      tokenFamilyId: input.tokenFamilyId ?? randomUUID(),
      refreshTokenHash: hashToken(refreshToken),
      deviceId: input.deviceId,
      expiresAt,
    },
  });
  return {
    accessToken: signAccessToken({
      sub: input.principalId,
      subject: input.subject === "ADMIN" ? "admin" : "customer",
      sessionId: session.id,
      capabilities: input.capabilities,
      permissions: input.permissions,
    }),
    refreshToken,
    expiresInSeconds: input.subject === "ADMIN" ? 600 : 900,
  };
}
export async function rotateSession(refreshToken: string, expectedSubject: SessionSubject) {
  const tokenHash = hashToken(refreshToken);
  const current = await prisma.session.findUnique({
    where: { refreshTokenHash: tokenHash },
    include: {
      user: { include: { capabilities: true } },
      admin: {
        include: {
          roles: {
            include: { role: { include: { permissions: { include: { permission: true } } } } },
          },
        },
      },
    },
  });
  if (!current || current.subject !== expectedSubject)
    throw new AppError(401, "INVALID_REFRESH_TOKEN", "Session is invalid");
  if (current.revokedAt || current.replacedById) {
    await prisma.session.updateMany({
      where: { tokenFamilyId: current.tokenFamilyId },
      data: { revokedAt: new Date(), reuseDetectedAt: new Date() },
    });
    throw new AppError(401, "REFRESH_TOKEN_REUSED", "Session family has been revoked");
  }
  if (
    (current.admin && current.admin.status !== "ACTIVE") ||
    (current.user && current.user.status !== "ACTIVE")
  )
    throw new AppError(401, "ACCOUNT_UNAVAILABLE", "Account is unavailable");
  if (current.expiresAt <= new Date())
    throw new AppError(401, "SESSION_EXPIRED", "Session has expired");
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM sessions WHERE id = ${current.id}::uuid FOR UPDATE`;
    const locked = await tx.session.findUniqueOrThrow({ where: { id: current.id } });
    if (locked.revokedAt || locked.replacedById)
      throw new AppError(401, "REFRESH_TOKEN_REUSED", "Session was already refreshed");
    const capabilities = current.user?.capabilities.map((x) => x.capability);
    const permissions = current.admin?.roles.flatMap((x) =>
      x.role.permissions.map((y) => y.permission.code),
    );
    const next = await createSession(
      {
        subject: current.subject,
        principalId: current.userId ?? current.adminId!,
        deviceId: current.deviceId,
        capabilities,
        permissions: [...new Set(permissions)],
        tokenFamilyId: current.tokenFamilyId,
        expiresAt: current.expiresAt,
      },
      tx,
    );
    const nextRow = await tx.session.findUniqueOrThrow({
      where: { refreshTokenHash: hashToken(next.refreshToken) },
    });
    await tx.session.update({
      where: { id: current.id },
      data: { revokedAt: new Date(), replacedById: nextRow.id, lastUsedAt: new Date() },
    });
    return next;
  });
}
export async function revokeSession(sessionId: string) {
  await prisma.session.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
export async function revokeAll(subject: SessionSubject, principalId: string) {
  await prisma.session.updateMany({
    where: subject === "CUSTOMER" ? { userId: principalId } : { adminId: principalId },
    data: { revokedAt: new Date() },
  });
}
