import { reportedDevice } from "../services/reported-device.js";
import { prisma } from "@leetlogic/database";
import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/errors.js";
import { verifyAccessToken } from "../lib/tokens.js";
export const requireAuth =
  (subject: "customer" | "admin") => async (req: Request, _res: Response, next: NextFunction) => {
    const [kind, token] = req.headers.authorization?.split(" ") ?? [];
    if (kind !== "Bearer" || !token)
      return next(new AppError(401, "AUTH_REQUIRED", "Authentication is required"));
    try {
      req.auth = verifyAccessToken(token, subject);
      const session = await prisma.session.findUnique({
        where: { id: req.auth.sessionId },
        include: {
          user: true,
          admin: {
            include: {
              roles: {
                include: { role: { include: { permissions: { include: { permission: true } } } } },
              },
            },
          },
        },
      });
      if (
        !session ||
        session.revokedAt ||
        session.expiresAt <= new Date() ||
        (subject === "admin"
          ? session.adminId !== req.auth.sub || session.admin?.status !== "ACTIVE"
          : session.userId !== req.auth.sub || session.user?.status !== "ACTIVE")
      )
        throw new AppError(401, "SESSION_EXPIRED", "Please sign in again");
      const device = subject === "customer" ? reportedDevice(req) : {};
      if (
        !session.lastUsedAt ||
        Date.now() - session.lastUsedAt.getTime() > 60_000 ||
        (device.deviceName && device.deviceName !== session.deviceName) ||
        (device.devicePlatform && device.devicePlatform !== session.devicePlatform)
      ) {
        await prisma.session.updateMany({
          where: { id: session.id, revokedAt: null, replacedById: null },
          data: { lastUsedAt: new Date(), ...device },
        });
      }
      if (subject === "admin")
        req.auth.permissions = [
          ...new Set(
            session.admin!.roles.flatMap((x) => x.role.permissions.map((y) => y.permission.code)),
          ),
        ];
      next();
    } catch (error) {
      next(error);
    }
  };
export const requirePermission =
  (permission: string) => (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth?.permissions?.includes(permission))
      return next(new AppError(403, "FORBIDDEN", "You do not have permission for this action"));
    next();
  };
export const requireRecentStepUp = (req: Request, _res: Response, next: NextFunction) => {
  const ageSeconds = req.auth?.stepUpAt
    ? Math.floor(Date.now() / 1000) - req.auth.stepUpAt
    : Number.POSITIVE_INFINITY;
  if (ageSeconds > 300)
    return next(
      new AppError(403, "STEP_UP_REQUIRED", "A recent authenticator confirmation is required"),
    );
  next();
};
