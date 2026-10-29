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
  const devices = new Map<string, typeof sessions>();
  for (const session of sessions) {
    const rows = devices.get(session.deviceId) || [];
    rows.push(session);
    devices.set(session.deviceId, rows);
  }
  return [...devices.values()].map((rows) => {
    const session = rows.find((row) => row.id === currentId) || rows[0]!;
    const recent = rows.reduce((latest, row) =>
      (row.lastUsedAt?.getTime() ?? 0) > (latest.lastUsedAt?.getTime() ?? 0) ? row : latest,
    );
    return {
      id: session.id,
      current: session.id === currentId,
      createdAt: session.createdAt,
      lastUsedAt: recent.lastUsedAt,
      deviceName: recent.deviceName ?? session.deviceName ?? null,
      platform: recent.devicePlatform ?? session.devicePlatform ?? null,
    };
  });
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
