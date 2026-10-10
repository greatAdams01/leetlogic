import { Router } from "express";
import { z } from "zod";
import { prisma, Prisma } from "@leetlogic/database";
import { requireAuth, requirePermission, requireRecentStepUp } from "../middleware/auth.js";
import { AppError } from "../lib/errors.js";
import { audit } from "../services/audit.js";

export const operationsRouter = Router();
operationsRouter.use(requireAuth("admin"));
const id = z.string().uuid();
const reasonSchema = z.object({ reason: z.string().trim().min(5).max(500) });
const json = (value: unknown) =>
  JSON.parse(
    JSON.stringify(value, (_key, item) => (typeof item === "bigint" ? item.toString() : item)),
  );
const querySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  search: z.string().max(100).default(""),
  status: z.string().max(40).default("ALL"),
});
operationsRouter.get("/me", async (req, res) => {
  const admin = await prisma.adminAccount.findUniqueOrThrow({
    where: { id: req.auth!.sub },
    select: {
      id: true,
      fullName: true,
      email: true,
      roles: { include: { role: { select: { code: true, name: true } } } },
    },
  });
  res.json({ ...admin, permissions: req.auth!.permissions });
});
operationsRouter.get("/dashboard", requirePermission("orders.read"), async (_req, res) => {
  const [users, listings, orders, verifications, tickets, escrow] = await Promise.all([
    prisma.user.count(),
    prisma.listing.count(),
    prisma.tradeOrder.count(),
    prisma.verificationCase.count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } } }),
    prisma.supportTicket.count({ where: { status: "OPEN" } }),
    prisma.tradeOrder.aggregate({
      _sum: { heldMinor: true, releasedMinor: true, refundedMinor: true, totalMinor: true },
    }),
  ]);
  res.json(json({ users, listings, orders, verifications, tickets, escrow: escrow._sum }));
});
// Resource queues are paginated in the database. No sample records are returned.
const resources = {
  users: {
    permission: "users.read",
    delegate: prisma.user,
    include: { profile: true, farmerProfile: true },
  },
  listings: {
    permission: "catalog.manage",
    delegate: prisma.listing,
    include: {
      farmerProfile: { include: { user: { include: { profile: true } } } },
      category: true,
    },
  },
  orders: {
    permission: "orders.read",
    delegate: prisma.tradeOrder,
    include: { shipment: true, ledger: true },
  },
  logistics: { permission: "orders.read", delegate: prisma.shipment, include: { order: true } },
  withdrawals: { permission: "payments.read", delegate: prisma.withdrawal },
  support: {
    permission: "support.manage",
    delegate: prisma.supportTicket,
    where: { kind: "SUPPORT" },
    include: { messages: { orderBy: { createdAt: "asc" }, take: 100 } },
  },
  disputes: {
    permission: "disputes.manage",
    delegate: prisma.supportTicket,
    where: { kind: "DISPUTE" },
    include: { messages: true, order: true },
  },
  faq: { permission: "content.manage", delegate: prisma.faqArticle },
  translations: { permission: "content.manage", delegate: prisma.translationEntry },
  risk: { permission: "risk.manage", delegate: prisma.riskAlert },
  compliance: {
    permission: "compliance.manage",
    delegate: prisma.complianceReview,
    include: { order: true },
  },
  system: { permission: "system.manage", delegate: prisma.systemIncident },
} as const;
for (const [name, resource] of Object.entries(resources)) {
  operationsRouter.get(`/${name}`, requirePermission(resource.permission), async (req, res) => {
    const { page, search, status } = querySchema.parse(req.query);
    const allowed: Record<string, string[]> = {
      users: ["ACTIVE", "SUSPENDED", "CLOSED"],
      listings: ["DRAFT", "PENDING_REVIEW", "ACTIVE", "PAUSED", "SOLD_OUT", "REJECTED", "ARCHIVED"],
      orders: ["AWAITING_PAYMENT", "FUNDED", "DELIVERED", "COMPLETED", "REFUNDED", "CANCELLED"],
      logistics: ["ASSIGNED", "IN_TRANSIT", "DELIVERED"],
      withdrawals: ["REQUESTED", "AUTHORIZED", "REJECTED"],
      support: ["OPEN", "IN_PROGRESS", "RESOLVED"],
      disputes: ["OPEN", "IN_PROGRESS", "RESOLVED"],
      faq: ["DRAFT", "PUBLISHED"],
      translations: ["DRAFT", "PUBLISHED"],
      risk: ["OPEN", "RESOLVED", "DISMISSED"],
      compliance: ["PENDING_REVIEW", "APPROVED", "REJECTED"],
      system: ["INVESTIGATING", "IDENTIFIED", "MONITORING", "RESOLVED"],
    };
    if (status !== "ALL" && !allowed[name]?.includes(status))
      throw new AppError(422, "INVALID_STATUS", "Status filter is invalid");
    // The searchable fields differ by model; never interpolate SQL from a search string.
    const searchFields: Record<string, string[]> = {
      users: ["phoneE164"],
      listings: ["title"],
      orders: ["reference"],
      logistics: ["carrier", "trackingRef"],
      withdrawals: ["bankName"],
      support: ["subject"],
      disputes: ["subject"],
      faq: ["question"],
      translations: ["key", "value"],
      risk: ["title"],
      compliance: ["destination"],
      system: ["service", "message"],
    };
    const where = {
      ...(status !== "ALL" ? { status } : {}),
      ...("where" in resource ? resource.where : {}),
      ...(search
        ? {
            OR: searchFields[name]!.map((field) => ({
              [field]: { contains: search, mode: "insensitive" },
            })),
          }
        : {}),
    };
    // Each delegate comes from the explicit allowlist above; body fields are validated separately.
    const delegate = resource.delegate as any;
    const [items, total] = await Promise.all([
      delegate.findMany({
        where,
        ...("include" in resource ? { include: resource.include } : {}),
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * 25,
        take: 25,
      }),
      delegate.count({ where }),
    ]);
    res.json(json({ items, total, page, pageSize: 25 }));
  });
}
operationsRouter.post("/users/:id/status", requirePermission("users.manage"), async (req, res) => {
  const body = reasonSchema
    .extend({ status: z.enum(["ACTIVE", "SUSPENDED", "CLOSED"]) })
    .parse(req.body);
  const userId = id.parse(req.params.id);
  const user = await prisma.$transaction(async (tx) => {
    const item = await tx.user.update({ where: { id: userId }, data: { status: body.status } });
    if (body.status !== "ACTIVE")
      await tx.session.updateMany({ where: { userId }, data: { revokedAt: new Date() } });
    await audit(
      req,
      { action: "user.status.changed", entityType: "user", entityId: userId, after: body },
      tx,
    );
    return item;
  });
  res.json(user);
});
operationsRouter.post(
  "/listings/:id/status",
  requirePermission("catalog.manage"),
  async (req, res) => {
    const body = reasonSchema
      .extend({ status: z.enum(["ACTIVE", "REJECTED", "PAUSED", "ARCHIVED"]) })
      .parse(req.body);
    const listingId = id.parse(req.params.id);
    const item = await prisma.$transaction(async (tx) => {
      const listing = await tx.listing.findUniqueOrThrow({
        where: { id: listingId },
        include: { farmerProfile: true },
      });
      if (body.status === "ACTIVE" && listing.farmerProfile.verificationStatus !== "APPROVED")
        throw new AppError(409, "SELLER_UNVERIFIED", "Only verified farmers can publish listings");
      if (
        !(["PENDING_REVIEW", "ACTIVE", "PAUSED", "REJECTED"] as string[]).includes(listing.status)
      )
        throw new AppError(
          409,
          "INVALID_TRANSITION",
          "Listing cannot be changed from its current status",
        );
      const changed = await tx.listing.updateMany({
        where: { id: listingId, status: listing.status },
        data: { status: body.status },
      });
      if (!changed.count)
        throw new AppError(409, "STALE_RECORD", "Listing changed. Refresh and try again.");
      await audit(
        req,
        {
          action: "listing.status.changed",
          entityType: "listing",
          entityId: listingId,
          before: { status: listing.status },
          after: body,
        },
        tx,
      );
      return tx.listing.findUniqueOrThrow({ where: { id: listingId } });
    });
    res.json(json(item));
  },
);
const ticketSchema = z.object({
  subject: z.string().trim().min(3).max(160),
  kind: z.enum(["SUPPORT", "DISPUTE"]).default("SUPPORT"),
  userId: id.optional(),
  orderId: id.optional(),
  priority: z.enum(["NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
});
operationsRouter.post("/support", requirePermission("support.manage"), async (req, res) => {
  const body = ticketSchema.parse(req.body);
  if (body.kind === "DISPUTE" && !req.auth!.permissions?.includes("disputes.manage"))
    throw new AppError(403, "FORBIDDEN", "Dispute permission is required");
  if (body.kind === "DISPUTE" && !body.orderId)
    throw new AppError(422, "ORDER_REQUIRED", "Select an order for the dispute");
  if (body.userId) await prisma.user.findUniqueOrThrow({ where: { id: body.userId } });
  const item = await prisma.$transaction(async (tx) => {
    const ticket = await tx.supportTicket.create({ data: body });
    await audit(
      req,
      { action: "ticket.created", entityType: "support_ticket", entityId: ticket.id, after: body },
      tx,
    );
    return ticket;
  });
  res.status(201).json(item);
});
operationsRouter.post(
  "/support/:id/message",
  requirePermission("support.manage"),
  async (req, res) => {
    const body = z
      .object({ body: z.string().trim().min(1).max(10000), internal: z.boolean().default(false) })
      .parse(req.body);
    const ticketId = id.parse(req.params.id);
    const item = await prisma.$transaction(async (tx) => {
      const ticket = await tx.supportTicket.findUniqueOrThrow({ where: { id: ticketId } });
      if (ticket.status === "RESOLVED")
        throw new AppError(409, "TICKET_CLOSED", "Reopen the ticket before replying");
      if (ticket.kind === "DISPUTE" && !req.auth!.permissions?.includes("disputes.manage"))
        throw new AppError(403, "FORBIDDEN", "Dispute permission is required");
      const message = await tx.supportMessage.create({
        data: { ...body, ticketId, authorId: req.auth!.sub },
      });
      await audit(
        req,
        { action: "ticket.message.created", entityType: "support_ticket", entityId: ticketId },
        tx,
      );
      return message;
    });
    res.status(201).json(item);
  },
);
operationsRouter.post(
  "/support/:id/status",
  requirePermission("support.manage"),
  async (req, res) => {
    const body = reasonSchema
      .extend({ status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED"]) })
      .parse(req.body);
    const ticketId = id.parse(req.params.id);
    const item = await prisma.$transaction(async (tx) => {
      const ticket = await tx.supportTicket.findUniqueOrThrow({ where: { id: ticketId } });
      if (ticket.kind === "DISPUTE" && !req.auth!.permissions?.includes("disputes.manage"))
        throw new AppError(403, "FORBIDDEN", "Dispute permission is required");
      const updated = await tx.supportTicket.update({
        where: { id: ticketId },
        data: { status: body.status, resolution: body.reason, assignedTo: req.auth!.sub },
      });
      await audit(
        req,
        {
          action: "ticket.status.changed",
          entityType: "support_ticket",
          entityId: ticketId,
          after: body,
        },
        tx,
      );
      return updated;
    });
    res.json(item);
  },
);
const contentSchemas = {
  faq: z.object({
    question: z.string().trim().min(3).max(240),
    answer: z.string().trim().min(3).max(20000),
    audience: z.enum(["FARMERS", "BUYERS", "ALL"]),
    locale: z.enum(["en", "pcm", "ig", "ha", "yo"]),
    status: z.enum(["DRAFT", "PUBLISHED"]),
  }),
  translations: z.object({
    key: z.string().trim().min(1).max(200),
    source: z.string().min(1).max(10000),
    value: z.string().min(1).max(10000),
    locale: z.enum(["en", "pcm", "ig", "ha", "yo"]),
    status: z.enum(["DRAFT", "PUBLISHED"]),
  }),
  system: z.object({
    service: z.string().trim().min(2).max(80),
    severity: z.enum(["DEGRADED", "OUTAGE", "MAINTENANCE"]),
    message: z.string().min(5).max(10000),
    status: z.enum(["INVESTIGATING", "IDENTIFIED", "MONITORING", "RESOLVED"]),
    isPublic: z.boolean().default(false),
  }),
};
for (const [name, schema] of Object.entries(contentSchemas)) {
  const permission = name === "system" ? "system.manage" : "content.manage";
  for (const method of ["post", "put"] as const)
    operationsRouter[method](
      `/${name}${method === "put" ? "/:id" : ""}`,
      requirePermission(permission),
      async (req, res) => {
        const body = schema.parse(req.body);
        const delegateName = {
          faq: "faqArticle",
          translations: "translationEntry",
          system: "systemIncident",
        }[name]!;
        const item = await prisma.$transaction(async (tx) => {
          const delegate = (tx as any)[delegateName];
          const item =
            method === "put"
              ? await delegate.update({
                  where: { id: id.parse(req.params.id) },
                  data: { ...body, updatedBy: req.auth!.sub },
                })
              : await delegate.create({ data: { ...body, updatedBy: req.auth!.sub } });
          await audit(
            req,
            {
              action: `${name}.${method === "put" ? "updated" : "created"}`,
              entityType: name,
              entityId: item.id,
            },
            tx,
          );
          return item;
        });
        res.status(method === "post" ? 201 : 200).json(item);
      },
    );
}
operationsRouter.get("/settings", requirePermission("settings.manage"), async (_req, res) =>
  res.json(
    await prisma.marketplaceSettings.upsert({
      where: { id: "marketplace" },
      create: {},
      update: {},
    }),
  ),
);
operationsRouter.put(
  "/settings",
  requirePermission("settings.manage"),
  requireRecentStepUp,
  async (req, res) => {
    const body = z
      .object({
        version: z.number().int().positive(),
        platformFeeBasisPoints: z.number().int().min(0).max(10000),
        exportFeeBasisPoints: z.number().int().min(0).max(10000),
        escrowHoldHours: z.number().int().min(0).max(8760),
        disputeGraceHours: z.number().int().min(0).max(8760),
        supportPhone: z.string().max(40),
        supportEmail: z.string().email().max(254),
      })
      .parse(req.body);
    const { version, ...data } = body;
    await prisma.$transaction(async (tx) => {
      const result = await tx.marketplaceSettings.updateMany({
        where: { id: "marketplace", version },
        data: { ...data, version: { increment: 1 }, updatedBy: req.auth!.sub },
      });
      if (!result.count)
        throw new AppError(409, "STALE_SETTINGS", "Settings changed. Refresh before saving.");
      await audit(
        req,
        { action: "settings.updated", entityType: "marketplace_settings", after: data },
        tx,
      );
    });
    res.json(await prisma.marketplaceSettings.findUnique({ where: { id: "marketplace" } }));
  },
);
operationsRouter.get("/roles", requirePermission("admin.manage"), async (req, res) => {
  const { page, search } = querySchema.parse(req.query);
  const where = search
    ? {
        OR: [
          { email: { contains: search, mode: "insensitive" as const } },
          { fullName: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};
  const [roles, staff] = await Promise.all([
    prisma.adminRole.findMany({ include: { permissions: { include: { permission: true } } } }),
    prisma.adminAccount.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * 25,
      take: 25,
      select: {
        id: true,
        email: true,
        fullName: true,
        status: true,
        createdAt: true,
        roles: { include: { role: true } },
      },
    }),
  ]);
  res.json({
    roles,
    items: staff,
    total: await prisma.adminAccount.count({ where }),
    page,
    pageSize: 25,
  });
});
operationsRouter.post(
  "/roles/:id",
  requirePermission("admin.manage"),
  requireRecentStepUp,
  async (req, res) => {
    const body = z
      .object({
        roleCode: z.enum([
          "SUPER_ADMIN",
          "OPERATIONS_MANAGER",
          "VERIFICATION_OFFICER",
          "FINANCE_DISPUTES_OFFICER",
          "SUPPORT_CONTENT_OFFICER",
        ]),
        status: z.enum(["ACTIVE", "SUSPENDED"]),
      })
      .parse(req.body);
    const adminId = id.parse(req.params.id);
    if (adminId === req.auth!.sub)
      throw new AppError(409, "SELF_CHANGE_DENIED", "Another super admin must change your access");
    await prisma.$transaction(async (tx) => {
      const role = await tx.adminRole.findUniqueOrThrow({ where: { code: body.roleCode } });
      const admin = await tx.adminAccount.findUniqueOrThrow({ where: { id: adminId } });
      if (body.status === "ACTIVE" && !admin.totpEnrolledAt)
        throw new AppError(409, "ENROLLMENT_REQUIRED", "Staff must complete account setup first");
      await tx.adminRoleAssignment.deleteMany({ where: { adminId } });
      await tx.adminRoleAssignment.create({ data: { adminId, roleId: role.id } });
      await tx.adminAccount.update({ where: { id: adminId }, data: { status: body.status } });
      await tx.session.updateMany({ where: { adminId }, data: { revokedAt: new Date() } });
      await audit(
        req,
        {
          action: "admin.access.changed",
          entityType: "admin_account",
          entityId: adminId,
          after: body,
        },
        tx,
      );
    });
    res.json({ message: "Staff access updated" });
  },
);
for (const resource of ["risk", "compliance"] as const)
  operationsRouter.post(
    `/${resource}/:id/status`,
    requirePermission(`${resource}.manage`),
    async (req, res) => {
      const body = reasonSchema
        .extend({
          status:
            resource === "risk"
              ? z.enum(["OPEN", "RESOLVED", "DISMISSED"])
              : z.enum(["APPROVED", "REJECTED"]),
        })
        .parse(req.body);
      const entityId = id.parse(req.params.id);
      const item = await prisma.$transaction(async (tx) => {
        const delegate = resource === "risk" ? tx.riskAlert : tx.complianceReview;
        const data =
          resource === "risk"
            ? { status: body.status, resolution: body.reason, reviewedBy: req.auth!.sub }
            : { status: body.status, reason: body.reason, reviewedBy: req.auth!.sub };
        const item = await (delegate as any).update({ where: { id: entityId }, data });
        await audit(
          req,
          { action: `${resource}.reviewed`, entityType: resource, entityId, after: body },
          tx,
        );
        return item;
      });
      res.json(item);
    },
  );
operationsRouter.get("/reports", requirePermission("payments.read"), async (_req, res) => {
  const [orders, withdrawals, ledger] = await Promise.all([
    prisma.tradeOrder.groupBy({
      by: ["status"],
      _count: true,
      _sum: { totalMinor: true, heldMinor: true, releasedMinor: true, refundedMinor: true },
    }),
    prisma.withdrawal.groupBy({ by: ["status"], _count: true, _sum: { amountMinor: true } }),
    prisma.escrowEntry.groupBy({
      by: ["kind"],
      _sum: { amountMinor: true, feeMinor: true },
      _count: true,
    }),
  ]);
  res.json(json({ orders, withdrawals, ledger }));
});
operationsRouter.get("/reconciliation", requirePermission("payments.read"), async (_req, res) => {
  const orders = await prisma.tradeOrder.findMany({ include: { ledger: true } });
  const items = orders.map((order) => {
    const funded = order.ledger
      .filter((x) => x.kind === "FUND")
      .reduce((a, x) => a + x.amountMinor, 0n);
    const released = order.ledger
      .filter((x) => x.kind === "RELEASE")
      .reduce((a, x) => a + x.amountMinor, 0n);
    const refunded = order.ledger
      .filter((x) => x.kind === "REFUND")
      .reduce((a, x) => a + x.amountMinor, 0n);
    return {
      id: order.id,
      reference: order.reference,
      heldMinor: order.heldMinor,
      releasedMinor: order.releasedMinor,
      refundedMinor: order.refundedMinor,
      balanced:
        funded - released - refunded === order.heldMinor &&
        released === order.releasedMinor &&
        refunded === order.refundedMinor,
    };
  });
  res.json(json({ items, total: items.length }));
});
operationsRouter.post("/orders", requirePermission("orders.manage"), async (req, res) => {
  const body = z
    .object({ buyerId: id, listingId: id, quantity: z.string().regex(/^\d{1,15}(\.\d{1,3})?$/) })
    .parse(req.body);
  const quantity = new Prisma.Decimal(body.quantity);
  if (quantity.lte(0)) throw new AppError(422, "INVALID_QUANTITY", "Quantity must be positive");
  const order = await prisma.$transaction(async (tx) => {
    const buyer = await tx.user.findUniqueOrThrow({ where: { id: body.buyerId } });
    if (buyer.status !== "ACTIVE")
      throw new AppError(409, "BUYER_UNAVAILABLE", "Buyer is not active");
    await tx.$queryRaw`SELECT id FROM listings WHERE id = ${body.listingId}::uuid FOR UPDATE`;
    const listing = await tx.listing.findUniqueOrThrow({
      where: { id: body.listingId },
      include: { farmerProfile: true },
    });
    if (
      listing.status !== "ACTIVE" ||
      listing.farmerProfile.verificationStatus !== "APPROVED" ||
      listing.availableQuantity.minus(listing.reservedQuantity).lt(quantity)
    )
      throw new AppError(
        409,
        "INVENTORY_UNAVAILABLE",
        "Verified listing does not have enough available inventory",
      );
    const total = quantity.mul(listing.unitPriceMinor.toString());
    if (total.gt("9223372036854775807"))
      throw new AppError(422, "TOTAL_TOO_LARGE", "Order total exceeds the supported amount");
    if (!total.isInteger())
      throw new AppError(422, "INVALID_TOTAL", "Order total must be a whole minor currency unit");
    const settings = await tx.marketplaceSettings.upsert({
      where: { id: "marketplace" },
      create: {},
      update: {},
    });
    const order = await tx.tradeOrder.create({
      data: {
        reference: `LL-${crypto.randomUUID()}`,
        feeBasisPoints: settings.platformFeeBasisPoints,
        buyerId: body.buyerId,
        listingId: listing.id,
        farmerProfileId: listing.farmerProfileId,
        quantity,
        totalMinor: BigInt(total.toFixed(0)),
      },
    });
    await tx.listing.update({
      where: { id: listing.id },
      data: { reservedQuantity: { increment: quantity } },
    });
    await tx.inventoryMovement.create({
      data: {
        listingId: listing.id,
        type: "RESERVE",
        quantity,
        referenceType: "order",
        referenceId: order.id,
      },
    });
    await audit(
      req,
      {
        action: "order.created",
        entityType: "order",
        entityId: order.id,
        after: { reference: order.reference },
      },
      tx,
    );
    return order;
  });
  res.status(201).json(json(order));
});
operationsRouter.post(
  "/orders/:id/escrow",
  requirePermission("payments.manage"),
  requireRecentStepUp,
  async (req, res) => {
    const body = reasonSchema
      .extend({
        kind: z.enum(["FUND", "RELEASE", "REFUND"]),
        amountMinor: z.string().regex(/^[1-9]\d{0,17}$/),
        externalRef: z.string().trim().min(3).max(160).optional(),
        mutationKey: z.string().uuid(),
      })
      .parse(req.body);
    const orderId = id.parse(req.params.id);
    if (body.kind === "FUND" && !body.externalRef)
      throw new AppError(422, "REFERENCE_REQUIRED", "A verified payment reference is required");
    const item = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM trade_orders WHERE id = ${orderId}::uuid FOR UPDATE`;
      const previous = await tx.escrowEntry.findUnique({
        where: { mutationKey: body.mutationKey },
      });
      if (previous) {
        if (
          previous.orderId !== orderId ||
          previous.kind !== body.kind ||
          previous.amountMinor.toString() !== body.amountMinor ||
          previous.actorId !== req.auth!.sub ||
          previous.externalRef !== (body.externalRef ?? null) ||
          previous.reason !== body.reason
        )
          throw new AppError(
            409,
            "IDEMPOTENCY_CONFLICT",
            "Request identifier was used for a different action",
          );
        return previous;
      }
      const order = await tx.tradeOrder.findUniqueOrThrow({ where: { id: orderId } });
      const amount = BigInt(body.amountMinor);
      const feeMinor =
        body.kind === "RELEASE" ? (amount * BigInt(order.feeBasisPoints)) / 10000n : 0n;
      if (body.kind === "FUND") {
        if (order.status !== "AWAITING_PAYMENT" || amount !== order.totalMinor)
          throw new AppError(409, "INVALID_FUNDING", "Funding must match the awaiting order total");
        await tx.tradeOrder.update({
          where: { id: orderId },
          data: { heldMinor: amount, status: "FUNDED" },
        });
      } else {
        if (order.heldMinor !== amount)
          throw new AppError(
            409,
            "FULL_SETTLEMENT_REQUIRED",
            "Settle the full held amount for this order",
          );
        if (order.heldMinor < amount)
          throw new AppError(409, "INSUFFICIENT_ESCROW", "Amount exceeds held escrow");
        if (
          await tx.supportTicket.count({
            where: { orderId, kind: "DISPUTE", status: { not: "RESOLVED" } },
          })
        )
          throw new AppError(409, "DISPUTE_OPEN", "Resolve the dispute before settling escrow");
        if (body.kind === "RELEASE" && !order.deliveryConfirmedAt)
          throw new AppError(409, "DELIVERY_REQUIRED", "Confirm delivery before releasing escrow");
        await tx.tradeOrder.update({
          where: { id: orderId },
          data: {
            heldMinor: { decrement: amount },
            ...(body.kind === "RELEASE"
              ? { releasedMinor: { increment: amount } }
              : { refundedMinor: { increment: amount } }),
            ...(order.heldMinor === amount
              ? { status: body.kind === "RELEASE" ? "COMPLETED" : "REFUNDED" }
              : {}),
          },
        });
        if (body.kind === "RELEASE")
          await tx.farmerWallet.upsert({
            where: { farmerProfileId: order.farmerProfileId },
            create: { farmerProfileId: order.farmerProfileId, balanceMinor: amount - feeMinor },
            update: { balanceMinor: { increment: amount - feeMinor } },
          });
        await tx.inventoryMovement.create({
          data: {
            listingId: order.listingId,
            type: body.kind === "RELEASE" ? "SALE" : "RELEASE",
            quantity: order.quantity,
            referenceType: "order",
            referenceId: orderId,
          },
        });
        if (order.heldMinor === amount)
          await tx.listing.update({
            where: { id: order.listingId },
            data: {
              reservedQuantity: { decrement: order.quantity },
              ...(body.kind === "RELEASE"
                ? { availableQuantity: { decrement: order.quantity } }
                : {}),
            },
          });
      }
      const entry = await tx.escrowEntry.create({
        data: { orderId, ...body, amountMinor: amount, feeMinor, actorId: req.auth!.sub },
      });
      await audit(
        req,
        {
          action: `escrow.${body.kind.toLowerCase()}`,
          entityType: "order",
          entityId: orderId,
          after: { amountMinor: body.amountMinor, reason: body.reason },
        },
        tx,
      );
      return entry;
    });
    res.json(json(item));
  },
);
operationsRouter.post("/logistics", requirePermission("orders.manage"), async (req, res) => {
  const body = z
    .object({
      orderId: id,
      carrier: z.string().trim().min(2).max(120),
      trackingRef: z.string().trim().min(2).max(120),
    })
    .parse(req.body);
  const item = await prisma.$transaction(async (tx) => {
    const order = await tx.tradeOrder.findUniqueOrThrow({ where: { id: body.orderId } });
    if (order.status !== "FUNDED")
      throw new AppError(409, "ORDER_NOT_FUNDED", "Fund the order before dispatch");
    const item = await tx.shipment.create({ data: body });
    await audit(
      req,
      { action: "shipment.assigned", entityType: "shipment", entityId: item.id },
      tx,
    );
    return item;
  });
  res.status(201).json(item);
});
operationsRouter.post(
  "/logistics/:id/status",
  requirePermission("orders.manage"),
  async (req, res) => {
    const body = z
      .object({
        status: z.enum(["IN_TRANSIT", "DELIVERED"]),
        evidence: z.string().trim().min(5).max(500),
      })
      .parse(req.body);
    const shipmentId = id.parse(req.params.id);
    const item = await prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.findUniqueOrThrow({ where: { id: shipmentId } });
      await tx.$queryRaw`SELECT id FROM trade_orders WHERE id = ${shipment.orderId}::uuid FOR UPDATE`;
      const order = await tx.tradeOrder.findUniqueOrThrow({ where: { id: shipment.orderId } });
      if (!["FUNDED", "DELIVERED"].includes(order.status) || order.heldMinor <= 0n)
        throw new AppError(409, "ORDER_NOT_FUNDED", "Shipment order is no longer funded");
      if (
        shipment.status === "DELIVERED" ||
        (body.status === "DELIVERED" && shipment.status !== "IN_TRANSIT")
      )
        throw new AppError(409, "INVALID_TRANSITION", "Shipment status transition is invalid");
      const changed = await tx.shipment.updateMany({
        where: { id: shipmentId, status: shipment.status },
        data: body,
      });
      if (!changed.count)
        throw new AppError(409, "STALE_RECORD", "Shipment changed. Refresh and retry.");
      if (body.status === "DELIVERED")
        await tx.tradeOrder.update({
          where: { id: shipment.orderId },
          data: { status: "DELIVERED", deliveryConfirmedAt: new Date() },
        });
      await audit(
        req,
        {
          action: "shipment.status.changed",
          entityType: "shipment",
          entityId: shipmentId,
          after: body,
        },
        tx,
      );
      return tx.shipment.findUniqueOrThrow({ where: { id: shipmentId } });
    });
    res.json(item);
  },
);
operationsRouter.post(
  "/withdrawals",
  requirePermission("payments.manage"),
  requireRecentStepUp,
  async (req, res) => {
    const body = z
      .object({
        farmerProfileId: id,
        amountMinor: z.string().regex(/^[1-9]\d{0,17}$/),
        bankName: z.string().min(2).max(120),
        accountLastFour: z.string().regex(/^\d{4}$/),
      })
      .parse(req.body);
    const item = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "farmerProfileId" FROM farmer_wallets WHERE "farmerProfileId" = ${body.farmerProfileId}::uuid FOR UPDATE`;
      const wallet = await tx.farmerWallet.findUniqueOrThrow({
        where: { farmerProfileId: body.farmerProfileId },
      });
      const amount = BigInt(body.amountMinor);
      if (wallet.balanceMinor - wallet.reservedMinor < amount)
        throw new AppError(409, "INSUFFICIENT_BALANCE", "Insufficient available farmer balance");
      await tx.farmerWallet.update({
        where: { farmerProfileId: body.farmerProfileId },
        data: { reservedMinor: { increment: amount } },
      });
      const item = await tx.withdrawal.create({ data: { ...body, amountMinor: amount } });
      await audit(
        req,
        { action: "withdrawal.requested", entityType: "withdrawal", entityId: item.id },
        tx,
      );
      return item;
    });
    res.status(201).json(json(item));
  },
);
operationsRouter.post(
  "/withdrawals/:id/status",
  requirePermission("payments.manage"),
  requireRecentStepUp,
  async (req, res) => {
    const body = reasonSchema
      .extend({ status: z.enum(["AUTHORIZED", "REJECTED"]) })
      .parse(req.body);
    const withdrawalId = id.parse(req.params.id);
    const item = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM withdrawals WHERE id = ${withdrawalId}::uuid FOR UPDATE`;
      const withdrawal = await tx.withdrawal.findUniqueOrThrow({ where: { id: withdrawalId } });
      if (withdrawal.status !== "REQUESTED")
        throw new AppError(409, "ALREADY_REVIEWED", "Withdrawal has already been reviewed");
      if (body.status === "REJECTED")
        await tx.farmerWallet.update({
          where: { farmerProfileId: withdrawal.farmerProfileId },
          data: { reservedMinor: { decrement: withdrawal.amountMinor } },
        });
      const item = await tx.withdrawal.update({
        where: { id: withdrawalId },
        data: { status: body.status, reason: body.reason, authorizedBy: req.auth!.sub },
      });
      await audit(
        req,
        {
          action: "withdrawal.reviewed",
          entityType: "withdrawal",
          entityId: withdrawalId,
          after: body,
        },
        tx,
      );
      return item;
    });
    res.json(json(item));
  },
);
operationsRouter.post("/risk", requirePermission("risk.manage"), async (req, res) => {
  const body = z
    .object({
      userId: id,
      title: z.string().min(3).max(160),
      reason: z.string().min(5).max(10000),
      severity: z.enum(["LOW", "MEDIUM", "HIGH"]),
    })
    .parse(req.body);
  await prisma.user.findUniqueOrThrow({ where: { id: body.userId } });
  const item = await prisma.$transaction(async (tx) => {
    const item = await tx.riskAlert.create({ data: body });
    await audit(req, { action: "risk.created", entityType: "risk", entityId: item.id }, tx);
    return item;
  });
  res.status(201).json(item);
});
operationsRouter.post("/compliance", requirePermission("compliance.manage"), async (req, res) => {
  const body = z
    .object({
      orderId: id,
      destination: z.string().min(2).max(80),
      documentRef: z.string().min(5).max(500),
    })
    .parse(req.body);
  const item = await prisma.$transaction(async (tx) => {
    const item = await tx.complianceReview.create({ data: body });
    await audit(
      req,
      { action: "compliance.created", entityType: "compliance", entityId: item.id },
      tx,
    );
    return item;
  });
  res.status(201).json(item);
});
operationsRouter.post(
  "/orders/:id/cancel",
  requirePermission("orders.manage"),
  async (req, res) => {
    const body = reasonSchema.parse(req.body);
    const orderId = id.parse(req.params.id);
    const item = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM trade_orders WHERE id = ${orderId}::uuid FOR UPDATE`;
      const order = await tx.tradeOrder.findUniqueOrThrow({ where: { id: orderId } });
      if (order.status !== "AWAITING_PAYMENT")
        throw new AppError(
          409,
          "CANNOT_CANCEL",
          "Only unpaid orders can be cancelled; funded orders require refund review",
        );
      const item = await tx.tradeOrder.update({
        where: { id: orderId },
        data: { status: "CANCELLED" },
      });
      await tx.listing.update({
        where: { id: order.listingId },
        data: { reservedQuantity: { decrement: order.quantity } },
      });
      await tx.inventoryMovement.create({
        data: {
          listingId: order.listingId,
          type: "RELEASE",
          quantity: order.quantity,
          referenceType: "order",
          referenceId: orderId,
        },
      });
      await audit(
        req,
        { action: "order.cancelled", entityType: "order", entityId: orderId, after: body },
        tx,
      );
      return item;
    });
    res.json(json(item));
  },
);
operationsRouter.get("/lookups", async (req, res) => {
  const type = z.enum(["users", "listings", "orders", "farmers"]).parse(req.query.type);
  const permission = {
    users: "users.read",
    listings: "catalog.manage",
    orders: "orders.read",
    farmers: "payments.read",
  }[type];
  if (!req.auth!.permissions?.includes(permission))
    throw new AppError(403, "FORBIDDEN", "You do not have permission for these records");
  if (type === "users") {
    const users = await prisma.user.findMany({
      where: { status: "ACTIVE" },
      include: { profile: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json({
      items: users.map((user) => ({
        id: user.id,
        label: `${user.profile?.fullName || "Customer"} · ${user.phoneE164}`,
      })),
    });
  } else if (type === "listings") {
    const listings = await prisma.listing.findMany({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json({
      items: listings.map((listing) => ({
        id: listing.id,
        label: `${listing.title} · ${listing.availableQuantity.minus(listing.reservedQuantity)} available`,
      })),
    });
  } else if (type === "orders") {
    const orders = await prisma.tradeOrder.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
    res.json({
      items: orders.map((order) => ({
        id: order.id,
        label: `${order.reference} · ${order.status}`,
      })),
    });
  } else {
    const wallets = await prisma.farmerWallet.findMany({
      include: { farmerProfile: true },
      take: 100,
    });
    res.json({
      items: wallets.map((wallet) => ({
        id: wallet.farmerProfileId,
        label: `${wallet.farmerProfile.farmName} · ${wallet.balanceMinor - wallet.reservedMinor} kobo available`,
      })),
    });
  }
});
