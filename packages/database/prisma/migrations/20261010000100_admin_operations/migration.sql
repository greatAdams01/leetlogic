-- AlterTable
ALTER TABLE "admin_accounts" ADD COLUMN     "email" VARCHAR(254),
ADD COLUMN     "password_hash" VARCHAR(500),
ALTER COLUMN "phone_e164" DROP NOT NULL;

-- CreateTable
CREATE TABLE "admin_invitations" (
    "id" UUID NOT NULL,
    "adminId" UUID NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "purpose" VARCHAR(20) NOT NULL DEFAULT 'SETUP',
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "usedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trade_orders" (
    "id" UUID NOT NULL,
    "reference" VARCHAR(60) NOT NULL,
    "buyerId" UUID NOT NULL,
    "farmerProfileId" UUID NOT NULL,
    "listingId" UUID NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "totalMinor" BIGINT NOT NULL,
    "heldMinor" BIGINT NOT NULL DEFAULT 0,
    "releasedMinor" BIGINT NOT NULL DEFAULT 0,
    "refundedMinor" BIGINT NOT NULL DEFAULT 0,
    "status" VARCHAR(40) NOT NULL DEFAULT 'AWAITING_PAYMENT',
    "deliveryConfirmedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "trade_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "carrier" VARCHAR(120) NOT NULL,
    "trackingRef" VARCHAR(120) NOT NULL,
    "status" VARCHAR(40) NOT NULL DEFAULT 'ASSIGNED',
    "evidence" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escrow_entries" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "kind" VARCHAR(30) NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "externalRef" VARCHAR(160),
    "mutationKey" VARCHAR(200) NOT NULL,
    "actorId" UUID NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "escrow_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "farmer_wallets" (
    "farmerProfileId" UUID NOT NULL,
    "balanceMinor" BIGINT NOT NULL DEFAULT 0,
    "reservedMinor" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "farmer_wallets_pkey" PRIMARY KEY ("farmerProfileId")
);

-- CreateTable
CREATE TABLE "withdrawals" (
    "id" UUID NOT NULL,
    "farmerProfileId" UUID NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "bankName" VARCHAR(120) NOT NULL,
    "accountLastFour" VARCHAR(4) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'REQUESTED',
    "reason" VARCHAR(500),
    "authorizedBy" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "withdrawals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" UUID NOT NULL,
    "subject" VARCHAR(160) NOT NULL,
    "kind" VARCHAR(30) NOT NULL DEFAULT 'SUPPORT',
    "userId" UUID,
    "orderId" UUID,
    "priority" VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    "status" VARCHAR(30) NOT NULL DEFAULT 'OPEN',
    "assignedTo" UUID,
    "resolution" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_messages" (
    "id" UUID NOT NULL,
    "ticketId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "internal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faq_articles" (
    "id" UUID NOT NULL,
    "question" VARCHAR(240) NOT NULL,
    "answer" TEXT NOT NULL,
    "audience" VARCHAR(30) NOT NULL DEFAULT 'FARMERS',
    "locale" VARCHAR(10) NOT NULL DEFAULT 'en',
    "status" VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    "updatedBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "faq_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "translation_entries" (
    "id" UUID NOT NULL,
    "key" VARCHAR(200) NOT NULL,
    "locale" VARCHAR(10) NOT NULL,
    "source" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    "updatedBy" UUID NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "translation_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_alerts" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "reason" TEXT NOT NULL,
    "severity" VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    "status" VARCHAR(30) NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "reviewedBy" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "risk_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_reviews" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "destination" VARCHAR(80) NOT NULL,
    "documentRef" VARCHAR(500) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'PENDING_REVIEW',
    "reason" TEXT,
    "reviewedBy" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "compliance_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_incidents" (
    "id" UUID NOT NULL,
    "service" VARCHAR(80) NOT NULL,
    "severity" VARCHAR(30) NOT NULL DEFAULT 'DEGRADED',
    "message" TEXT NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'INVESTIGATING',
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "updatedBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "system_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_settings" (
    "id" VARCHAR(40) NOT NULL DEFAULT 'marketplace',
    "platformFeeBasisPoints" INTEGER NOT NULL DEFAULT 600,
    "exportFeeBasisPoints" INTEGER NOT NULL DEFAULT 250,
    "escrowHoldHours" INTEGER NOT NULL DEFAULT 72,
    "disputeGraceHours" INTEGER NOT NULL DEFAULT 24,
    "supportPhone" VARCHAR(20) NOT NULL DEFAULT '',
    "supportEmail" VARCHAR(254) NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedBy" UUID,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "marketplace_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_invitations_tokenHash_key" ON "admin_invitations"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "trade_orders_reference_key" ON "trade_orders"("reference");

-- CreateIndex
CREATE INDEX "trade_orders_status_createdAt_idx" ON "trade_orders"("status", "createdAt");

-- CreateIndex
CREATE INDEX "trade_orders_farmerProfileId_idx" ON "trade_orders"("farmerProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_orderId_key" ON "shipments"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "escrow_entries_externalRef_key" ON "escrow_entries"("externalRef");

-- CreateIndex
CREATE UNIQUE INDEX "escrow_entries_mutationKey_key" ON "escrow_entries"("mutationKey");

-- CreateIndex
CREATE INDEX "escrow_entries_orderId_createdAt_idx" ON "escrow_entries"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "withdrawals_status_createdAt_idx" ON "withdrawals"("status", "createdAt");

-- CreateIndex
CREATE INDEX "support_tickets_kind_status_createdAt_idx" ON "support_tickets"("kind", "status", "createdAt");

-- CreateIndex
CREATE INDEX "support_messages_ticketId_createdAt_idx" ON "support_messages"("ticketId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "translation_entries_key_locale_key" ON "translation_entries"("key", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "admin_accounts_email_key" ON "admin_accounts"("email");

-- AddForeignKey
ALTER TABLE "admin_invitations" ADD CONSTRAINT "admin_invitations_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "admin_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "trade_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escrow_entries" ADD CONSTRAINT "escrow_entries_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "trade_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_farmerProfileId_fkey" FOREIGN KEY ("farmerProfileId") REFERENCES "farmer_wallets"("farmerProfileId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "trade_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_reviews" ADD CONSTRAINT "compliance_reviews_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "trade_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

