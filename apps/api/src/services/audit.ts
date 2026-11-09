import { prisma, type Prisma } from "@leetlogic/database";
import type { Request } from "express";
const blocked = /password|token|secret|otp|document|code|authorization/i;
function redact(value: unknown): any {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, blocked.test(k) ? "[REDACTED]" : redact(v)]),
    );
  return value;
}
export async function audit(
  req: Request,
  input: {
    action: string;
    entityType: string;
    entityId?: string;
    before?: unknown;
    after?: unknown;
    reason?: string;
  },
  client: Prisma.TransactionClient = prisma,
) {
  const detail = input.after as { reason?: unknown; evidence?: unknown } | undefined;
  const suppliedReason = input.reason ?? (req.auth?.subject === "admin" ? req.body?.reason : undefined) ?? detail?.reason ?? detail?.evidence;
  await client.auditLog.create({
    data: {
      actorType: req.auth?.subject ?? "system",
      actorId: req.auth?.sub,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      reason: typeof suppliedReason === "string" ? suppliedReason.trim().slice(0, 500) || null : null,
      beforeRedacted: input.before ? redact(input.before) : undefined,
      afterRedacted: input.after ? redact(input.after) : undefined,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
      requestId: req.requestId,
    },
  });
}
