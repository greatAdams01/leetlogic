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
  },
  client: Prisma.TransactionClient = prisma,
) {
  await client.auditLog.create({
    data: {
      actorType: req.auth?.subject ?? "system",
      actorId: req.auth?.sub,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      beforeRedacted: input.before ? redact(input.before) : undefined,
      afterRedacted: input.after ? redact(input.after) : undefined,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
      requestId: req.requestId,
    },
  });
}
