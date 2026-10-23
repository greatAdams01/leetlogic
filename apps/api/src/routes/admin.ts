import { identityPassed, effectiveIdentity, publicIdentity } from "../services/identity.js";
import { z } from "zod";
import { issueAdminLink } from "../services/admin-email.js";
import { Router } from "express";
import { adminInvitationSchema, verificationDecisionSchema } from "@leetlogic/contracts";
import { prisma } from "@leetlogic/database";
import { requireAuth, requirePermission, requireRecentStepUp } from "../middleware/auth.js";
import { AppError } from "../lib/errors.js";
import { audit } from "../services/audit.js";
import { LocalPrivateObjectStorage } from "../services/storage.js";

export const adminRouter = Router();
adminRouter.use(requireAuth("admin"));
adminRouter.post(
  "/invitations",
  requirePermission("admin.manage"),
  requireRecentStepUp,
  async (req, res) => {
    const body = adminInvitationSchema.parse(req.body);
    const role = await prisma.adminRole.findUnique({ where: { code: body.roleCode } });
    if (!role) throw new AppError(422, "ROLE_NOT_FOUND", "Role does not exist");
    const admin = await prisma.adminAccount.create({
      data: {
        email: body.email,
        fullName: body.fullName,
        invitedById: req.auth!.sub,
        roles: { create: { roleId: role.id } },
      },
    });
    await audit(req, {
      action: "admin.invited",
      entityType: "admin_account",
      entityId: admin.id,
      after: { email: body.email, roleCode: body.roleCode },
    });
    await issueAdminLink(admin.id, body.email, "SETUP");
    res.status(201).json({
      admin: { id: admin.id, email: admin.email, fullName: admin.fullName, status: admin.status },
    });
  },
);
adminRouter.get("/verifications", requirePermission("verification.read"), async (req, res) => {
  const { page, search, status } = z
    .object({
      page: z.coerce.number().int().min(1).max(10000).default(1),
      search: z.string().max(100).default(""),
      status: z
        .enum(["ALL", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "RESUBMISSION_REQUIRED"])
        .default("ALL"),
    })
    .parse(req.query);
  const where = {
    status:
      status === "ALL"
        ? {
            in: [
              "SUBMITTED",
              "UNDER_REVIEW",
              "RESUBMISSION_REQUIRED",
              "APPROVED",
              "REJECTED",
            ] as any,
          }
        : status,
    ...(search
      ? {
          farmerProfile: {
            OR: [
              { farmName: { contains: search, mode: "insensitive" as const } },
              {
                user: { profile: { fullName: { contains: search, mode: "insensitive" as const } } },
              },
            ],
          },
        }
      : {}),
  };
  const [cases, total] = await Promise.all([
    prisma.verificationCase.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * 25,
      take: 25,
      include: {
        farmerProfile: { include: { user: { include: { profile: true } } } },
        _count: { select: { documents: true, evidence: true } },
      },
    }),
    prisma.verificationCase.count({ where }),
  ]);
  res.json({ cases, total, page, pageSize: 25 });
});
adminRouter.get("/verifications/:id", requirePermission("verification.read"), async (req, res) => {
  const caseId = String(req.params.id);
  const item = await prisma.verificationCase.findUnique({
    where: { id: caseId },
    include: {
      farmerProfile: { include: { user: { include: { profile: true } }, primaryAddress: true } },
      documents: true,
      evidence: true,
      reviews: true,
    },
  });
  if (!item) throw new AppError(404, "VERIFICATION_NOT_FOUND", "Verification case was not found");
  const identity = await effectiveIdentity(item.id);
  const storage = new LocalPrivateObjectStorage();
  const documents = await Promise.all(
    item.documents.map(async (document) => ({
      ...document,
      encryptedObjectKey: undefined,
      readUrl: await storage.createReadUrl(document.id, 300),
    })),
  );
  await audit(req, {
    action: "verification.sensitive_viewed",
    entityType: "verification_case",
    entityId: item.id,
  });
  res.json({
    verification: {
      ...item,
      identity: publicIdentity(identity),
      identityPassed: identityPassed(identity),
      documents,
      evidence: await Promise.all(
        item.evidence.map(async (evidence) => ({
          id: evidence.id,
          verificationCaseId: evidence.verificationCaseId,
          note: evidence.note,
          mimeType: evidence.mimeType,
          createdAt: evidence.createdAt,
          readUrl: evidence.encryptedObjectKey
            ? await storage.createReadUrl(evidence.id, 300)
            : null,
        })),
      ),
    },
  });
});
async function decide(req: any, res: any, decision: "APPROVED" | "REJECTED") {
  const body = verificationDecisionSchema.parse(req.body);
  const caseId = String(req.params.id);
  const item = await prisma.$transaction(async (tx) => {
    const item = await tx.verificationCase.findUnique({ where: { id: caseId } });
    if (!item || !["SUBMITTED", "UNDER_REVIEW"].includes(item.status))
      throw new AppError(409, "VERIFICATION_NOT_REVIEWABLE", "Verification cannot be decided");
    if (
      decision === "APPROVED" &&
      item.identityRequired &&
      !identityPassed(await effectiveIdentity(item.id, tx))
    )
      throw new AppError(
        422,
        "IDENTITY_REQUIRED",
        "Complete identity verification with Dojah before approving this farm.",
      );
    const changed = await tx.verificationCase.updateMany({
      where: { id: caseId, status: item.status },
      data: { status: decision, decidedAt: new Date() },
    });
    if (!changed.count)
      throw new AppError(409, "STALE_RECORD", "Verification was already reviewed");
    await tx.verificationReview.create({
      data: {
        verificationCaseId: item.id,
        reviewerAdminId: req.auth.sub,
        decision,
        reason: body.reason,
        internalNotes: body.internalNotes,
      },
    });
    await tx.farmerProfile.update({
      where: { id: item.farmerProfileId },
      data: { verificationStatus: decision },
    });
    await audit(
      req,
      {
        action: `verification.${decision.toLowerCase()}`,
        entityType: "verification_case",
        entityId: item.id,
        after: { status: decision, reason: body.reason },
      },
      tx,
    );
    return item;
  });
  res.json({ id: item.id, status: decision });
}
adminRouter.post(
  "/verifications/:id/approve",
  requirePermission("verification.decide"),
  async (req, res) => decide(req, res, "APPROVED"),
);
adminRouter.post(
  "/verifications/:id/reject",
  requirePermission("verification.decide"),
  async (req, res) => decide(req, res, "REJECTED"),
);
adminRouter.get("/audit-logs", requirePermission("audit.read"), async (req, res) => {
  const { page, search } = z
    .object({
      page: z.coerce.number().int().min(1).max(10000).default(1),
      search: z.string().max(100).default(""),
    })
    .parse(req.query);
  const where = search
    ? {
        OR: [
          { action: { contains: search, mode: "insensitive" as const } },
          { entityType: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};
  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * 25,
      take: 25,
    }),
    prisma.auditLog.count({ where }),
  ]);
  res.json({ logs: logs.map((x) => ({ ...x, id: x.id.toString() })), total, page, pageSize: 25 });
});
adminRouter.post(
  "/invitations/:id/resend",
  requirePermission("admin.manage"),
  requireRecentStepUp,
  async (req, res) => {
    const admin = await prisma.adminAccount.findUniqueOrThrow({
      where: { id: z.string().uuid().parse(req.params.id) },
    });
    if (admin.status !== "INVITED" || !admin.email)
      throw new AppError(
        409,
        "INVITATION_UNAVAILABLE",
        "Only pending email invitations can be resent",
      );
    await issueAdminLink(admin.id, admin.email, "SETUP");
    await audit(req, {
      action: "admin.invitation.resent",
      entityType: "admin_account",
      entityId: admin.id,
    });
    res.json({ message: "Invitation sent" });
  },
);
