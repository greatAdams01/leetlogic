import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const permissions = [
  ["admin.manage", "Invite staff and assign roles"],
  ["verification.read", "Read verification cases"],
  ["verification.decide", "Approve or reject verification cases"],
  ["verification.override", "Override verification decisions"],
  ["users.read", "Read user accounts"],
  ["users.manage", "Suspend or close users"],
  ["catalog.manage", "Manage categories and catalogue content"],
  ["orders.read", "Read orders"],
  ["orders.manage", "Manage order operations"],
  ["payments.read", "Read payment records"],
  ["payments.manage", "Refund, release or reconcile payments"],
  ["disputes.manage", "Manage disputes"],
  ["support.manage", "Manage support conversations"],
  ["risk.manage", "Review risk alerts"],
  ["compliance.manage", "Review export compliance"],
  ["settings.manage", "Manage marketplace settings"],
  ["system.manage", "Manage system incidents"],
  ["content.manage", "Manage translations and public content"],
  ["audit.read", "Read audit records"],
] as const;

const roles: Record<string, string[]> = {
  SUPER_ADMIN: permissions.map(([code]) => code),
  OPERATIONS_MANAGER: [
    "verification.read",
    "users.read",
    "users.manage",
    "catalog.manage",
    "orders.read",
    "orders.manage",
    "support.manage",
    "risk.manage",
    "compliance.manage",
    "audit.read",
  ],
  VERIFICATION_OFFICER: ["verification.read", "verification.decide", "users.read"],
  FINANCE_DISPUTES_OFFICER: [
    "orders.read",
    "payments.read",
    "payments.manage",
    "disputes.manage",
    "support.manage",
    "audit.read",
  ],
  SUPPORT_CONTENT_OFFICER: [
    "users.read",
    "orders.read",
    "catalog.manage",
    "content.manage",
    "support.manage",
  ],
};

async function main() {
  for (const language of [
    { code: "en", name: "English", nativeName: "English", sortOrder: 1 },
    { code: "pcm", name: "Nigerian Pidgin", nativeName: "Naijá", sortOrder: 2 },
    { code: "ig", name: "Igbo", nativeName: "Igbo", sortOrder: 3 },
    { code: "ha", name: "Hausa", nativeName: "Hausa", sortOrder: 4 },
    { code: "yo", name: "Yoruba", nativeName: "Yorùbá", sortOrder: 5 },
  ])
    await prisma.language.upsert({
      where: { code: language.code },
      create: language,
      update: language,
    });

  for (const unit of [
    { code: "KG", name: "Kilogram", allowsDecimal: true },
    { code: "BAG", name: "Bag", allowsDecimal: false },
    { code: "BASKET", name: "Basket", allowsDecimal: false },
    { code: "CRATE", name: "Crate", allowsDecimal: false },
    { code: "TONNE", name: "Tonne", allowsDecimal: true },
    { code: "PIECE", name: "Piece", allowsDecimal: false },
  ])
    await prisma.unit.upsert({ where: { code: unit.code }, create: unit, update: unit });

  const permissionRows = new Map<string, string>();
  for (const [code, description] of permissions) {
    const row = await prisma.permission.upsert({
      where: { code },
      create: { code, description },
      update: { description },
    });
    permissionRows.set(code, row.id);
  }
  for (const [code, grants] of Object.entries(roles)) {
    const role = await prisma.adminRole.upsert({
      where: { code },
      create: {
        code,
        name: code
          .split("_")
          .map((x) => x[0] + x.slice(1).toLowerCase())
          .join(" "),
      },
      update: {},
    });

    await prisma.rolePermission.createMany({
      skipDuplicates: true,
      data: grants.map((permission) => ({
        roleId: role.id,
        permissionId: permissionRows.get(permission)!,
      })),
    });
  }

  const bootstrapEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const bootstrapName = process.env.BOOTSTRAP_ADMIN_NAME;
  if (bootstrapEmail && bootstrapName) {
    const role = await prisma.adminRole.findUniqueOrThrow({ where: { code: "SUPER_ADMIN" } });
    const admin = await prisma.adminAccount.upsert({
      where: { email: bootstrapEmail },
      create: { email: bootstrapEmail, fullName: bootstrapName },
      update: {},
    });
    await prisma.adminRoleAssignment.upsert({
      where: { adminId_roleId: { adminId: admin.id, roleId: role.id } },
      create: { adminId: admin.id, roleId: role.id },
      update: {},
    });
  }
}

main().finally(() => prisma.$disconnect());
