import { createHash } from "node:crypto";
import { prisma, type IdentityCheck, type Prisma } from "@leetlogic/database";
import { getConfig } from "../config.js";
import { AppError } from "../lib/errors.js";
import { audit } from "./audit.js";
import { dojahOutcome, type DojahResult } from "../providers/identity/dojah.js";
import type { Request } from "express";

export const latestIdentity = (caseId: string, tx: Prisma.TransactionClient = prisma) =>
  tx.identityCheck.findFirst({
    where: { verificationCaseId: caseId },
    orderBy: { createdAt: "desc" },
  });
export function identityPassed(check: Pick<IdentityCheck, "status" | "mode"> | null | undefined) {
  return (
    check?.status === "VERIFIED" && (getConfig().NODE_ENV !== "production" || check.mode === "live")
  );
}
export function publicIdentity(check: IdentityCheck | null) {
  return check
    ? {
        id: check.id,
        provider: check.provider,
        mode: check.mode,
        status:
          check.status === "PENDING" && check.expiresAt < new Date() ? "EXPIRED" : check.status,
        expiresAt: check.expiresAt,
        updatedAt: check.updatedAt,
      }
    : null;
}
export async function applyIdentityResult(
  result: DojahResult,
  source: "webhook" | "reconcile",
  req: Request,
) {
  const check = await prisma.identityCheck.findUnique({ where: { id: result.reference_id } });
  // Unknown references cannot create checks or bind them to a different account.
  if (!check) return;
  if (result.widget_id && result.widget_id !== check.widgetId)
    throw new AppError(
      422,
      "IDENTITY_REFERENCE_MISMATCH",
      "The identity result does not match this session.",
    );
  if (check.mode !== getConfig().DOJAH_MODE)
    throw new AppError(
      409,
      "IDENTITY_ENVIRONMENT_MISMATCH",
      "Identity session belongs to another environment.",
    );
  const outcome = dojahOutcome(result);
  // A reference alone does not establish which flow ran. Some REST responses
  // omit widget_id; wait for the signed widget event rather than accepting a
  // success from a potentially different, weaker flow in the same Dojah app.
  if (outcome === "VERIFIED" && result.widget_id !== check.widgetId) return;
  const digest = createHash("sha256")
    .update(JSON.stringify({ reference: check.id, result }))
    .digest("hex");
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM identity_checks WHERE id = ${check.id}::uuid FOR UPDATE`;
    if (await tx.identityCheckEvent.findUnique({ where: { digest } })) return;
    const current = await tx.identityCheck.findUniqueOrThrow({ where: { id: check.id } });
    await tx.identityCheckEvent.create({
      data: { identityCheckId: check.id, digest, source, status: outcome },
    });
    // Late and duplicate events never undo terminal results. Retrying uses a new reference.
    if (current.status !== "PENDING") return;
    await tx.identityCheck.update({
      where: { id: check.id },
      data: { status: outcome, lastCheckedAt: new Date() },
    });
    await audit(
      req,
      {
        action: "identity.result",
        entityType: "identity_check",
        entityId: check.id,
        after: { provider: "dojah", mode: current.mode, status: outcome, source },
      },
      tx,
    );
  });
}
