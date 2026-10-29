import { prisma } from "@leetlogic/database";
import { AppError } from "../lib/errors.js";

export async function activePhones(userId: string, currentId: string) {
  const sessions = await prisma.session.findMany({
    where: {
      userId,
      subject: "CUSTOMER",
      revokedAt: null,
      replacedById: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
  const devices = new Map<string, (typeof sessions)[number]>();
  for (const session of sessions) {
    if (!devices.has(session.deviceId) || session.id === currentId)
      devices.set(session.deviceId, session);
  }
  return [...devices.values()].map((session) => ({
    id: session.id,
    current: session.id === currentId,
    createdAt: session.createdAt,
    lastUsedAt: session.lastUsedAt,
  }));
}

export async function signOutPhone(userId: string, currentId: string, targetId: string) {
  const [current, target] = await Promise.all([
    prisma.session.findFirst({ where: { id: currentId, userId, subject: "CUSTOMER" } }),
    prisma.session.findFirst({
      where: {
        id: targetId,
        userId,
        subject: "CUSTOMER",
        revokedAt: null,
        replacedById: null,
        expiresAt: { gt: new Date() },
      },
    }),
  ]);
  if (!target || !current) throw new AppError(404, "SESSION_NOT_FOUND", "Phone session not found");
  if (current.deviceId === target.deviceId)
    throw new AppError(409, "CURRENT_PHONE", "Use the account menu to sign out this phone.");
  await prisma.session.updateMany({
    where: { userId, subject: "CUSTOMER", deviceId: target.deviceId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
