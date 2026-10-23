import { createHash } from "node:crypto";
import { prisma, type IdentityCheck, type Prisma } from "@leetlogic/database";
import { getConfig } from "../config.js";
import { AppError } from "../lib/errors.js";
import { audit } from "./audit.js";
import {
  dojahOutcome,
  dojahSummary,
  fetchDojahResult,
  requireDojah,
  type DojahResult,
} from "../providers/identity/dojah.js";
import type { Request } from "express";

export const latestIdentity = (caseId: string, tx: Prisma.TransactionClient = prisma) =>
  tx.identityCheck.findFirst({
    where: { verificationCaseId: caseId },
    orderBy: { createdAt: "desc" },
  });
/** A later unsuccessful attempt must never mask this account/case's accepted identity. */
export async function effectiveIdentity(caseId: string, tx: Prisma.TransactionClient = prisma) {
  const c = getConfig();
  const accepted = await tx.identityCheck.findFirst({
    where: {
      verificationCaseId: caseId,
      status: "VERIFIED",
      mode: c.NODE_ENV === "production" ? "live" : c.DOJAH_MODE,
    },
    orderBy: { createdAt: "desc" },
  });
  return accepted ?? latestIdentity(caseId, tx);
}
/** Read existing provider records only. Never launches or bills for a new check. */
export async function reconcileIdentityAttempts(caseId: string, req: Request) {
  if (identityPassed(await effectiveIdentity(caseId))) return;
  const c = requireDojah();
  // Oldest last-checked first makes progress across the history on repeated syncs.
  const checks = await prisma.identityCheck.findMany({
    where: { verificationCaseId: caseId, mode: c.DOJAH_MODE, status: { not: "VERIFIED" } },
    orderBy: [{ lastCheckedAt: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }],
    take: 10,
  });
  const results = await Promise.allSettled(
    checks.map(async (check) => {
      const claimed = await prisma.identityCheck.updateMany({
        where: {
          id: check.id,
          status: { not: "VERIFIED" },
          OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: new Date(Date.now() - 15000) } }],
        },
        data: { lastCheckedAt: new Date() },
      });
      if (!claimed.count) return false;
      const result = await fetchDojahResult(check.id, c);
      if (result) await applyIdentityResult(result, "reconcile", req);
      return true;
    }),
  );
  // A successful older result wins even when another attempt's provider request failed.
  if (identityPassed(await effectiveIdentity(caseId))) return;
  const failures = results.filter(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  if (failures.length) throw failures[0]!.reason;
}
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
        createdAt: check.createdAt,
        summary: check.resultSummary,
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
    const duplicate = await tx.identityCheckEvent.findUnique({ where: { digest } });
    const current = await tx.identityCheck.findUniqueOrThrow({ where: { id: check.id } });
    if (!duplicate)
      await tx.identityCheckEvent.create({
        data: { identityCheckId: check.id, digest, source, status: outcome },
      });
    // A verified identity never regresses. Earlier attempts can recover from an
    // earlier result when the authenticated provider now confirms overall success.
    const recover =
      source === "reconcile" && current.status !== "VERIFIED" && outcome === "VERIFIED";
    const backfill = current.status === "REVIEW" && !current.resultSummary && outcome === "REVIEW";
    if (
      (current.status !== "PENDING" && !recover && !backfill) ||
      (duplicate && !recover && !backfill)
    )
      return;
    await tx.identityCheck.update({
      where: { id: check.id },
      data: { status: outcome, resultSummary: dojahSummary(result), lastCheckedAt: new Date() },
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
