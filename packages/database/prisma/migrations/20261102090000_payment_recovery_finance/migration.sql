-- CreateTable
CREATE TABLE "payment_recoveries" (
    "id" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "mode" VARCHAR(10) NOT NULL,
    "state" VARCHAR(40) NOT NULL DEFAULT 'WAITING_FARMER',
    "version" INTEGER NOT NULL DEFAULT 0,
    "farmerConfirmation" JSONB,
    "farmerConfirmedAt" TIMESTAMPTZ(6),
    "reservationUntil" TIMESTAMPTZ(6),
    "reservationActive" BOOLEAN NOT NULL DEFAULT false,
    "allocatedAt" TIMESTAMPTZ(6),
    "approvalKey" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payment_recoveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recovery_proposals" (
    "id" UUID NOT NULL,
    "recoveryId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "quoteId" UUID,
    "snapshot" JSONB NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "buyerAcceptedAt" TIMESTAMPTZ(6),
    "buyerRejectedAt" TIMESTAMPTZ(6),
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recovery_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fulfillment_deadlines" (
    "orderId" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "mode" VARCHAR(10) NOT NULL,
    "confirmedAt" TIMESTAMPTZ(6) NOT NULL,
    "refundDueAt" TIMESTAMPTZ(6) NOT NULL,
    "state" VARCHAR(40) NOT NULL DEFAULT 'ACTIVE',
    "securedAt" TIMESTAMPTZ(6),
    "collectionBuyerAt" TIMESTAMPTZ(6),
    "failureCode" VARCHAR(80),
    "nextRunAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "fulfillment_deadlines_pkey" PRIMARY KEY ("orderId")
);

-- CreateTable
CREATE TABLE "shipping_funding_batches" (
    "id" UUID NOT NULL,
    "mode" VARCHAR(10) NOT NULL,
    "state" VARCHAR(30) NOT NULL DEFAULT 'PLANNED',
    "amountMinor" BIGINT NOT NULL,
    "sourceLabel" VARCHAR(120) NOT NULL,
    "destination" VARCHAR(240) NOT NULL,
    "transferReference" VARCHAR(160),
    "transferKey" VARCHAR(180),
    "evidence" JSONB,
    "shipmentIds" JSONB NOT NULL,
    "initiatedBy" UUID NOT NULL,
    "verifiedBy" UUID,
    "verificationReason" VARCHAR(500),
    "verifiedAt" TIMESTAMPTZ(6),
    "observedWalletMinor" BIGINT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "shipping_funding_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_alerts" (
    "key" VARCHAR(200) NOT NULL,
    "mode" VARCHAR(10) NOT NULL,
    "orderId" UUID,
    "code" VARCHAR(80) NOT NULL,
    "resolvedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_alerts_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "finance_heartbeats" (
    "id" VARCHAR(40) NOT NULL,
    "checkedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "walletCheckedAt" TIMESTAMPTZ(6),
    "walletMinor" BIGINT,
    "walletError" VARCHAR(80),

    CONSTRAINT "finance_heartbeats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_recoveries_paymentId_key" ON "payment_recoveries"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_recoveries_approvalKey_key" ON "payment_recoveries"("approvalKey");

-- CreateIndex
CREATE INDEX "payment_recoveries_mode_state_orderId_idx" ON "payment_recoveries"("mode", "state", "orderId");

-- CreateIndex
CREATE UNIQUE INDEX "recovery_proposals_recoveryId_version_key" ON "recovery_proposals"("recoveryId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "fulfillment_deadlines_paymentId_key" ON "fulfillment_deadlines"("paymentId");

-- CreateIndex
CREATE INDEX "fulfillment_deadlines_mode_state_nextRunAt_idx" ON "fulfillment_deadlines"("mode", "state", "nextRunAt");

-- CreateIndex
CREATE UNIQUE INDEX "shipping_funding_batches_transferKey_key" ON "shipping_funding_batches"("transferKey");

-- CreateIndex
CREATE INDEX "shipping_funding_batches_mode_state_idx" ON "shipping_funding_batches"("mode", "state");

-- CreateIndex
CREATE INDEX "finance_alerts_mode_resolvedAt_createdAt_idx" ON "finance_alerts"("mode", "resolvedAt", "createdAt");

ALTER TABLE payment_recoveries ADD CONSTRAINT recovery_payment_fk FOREIGN KEY ("paymentId") REFERENCES payment_attempts(id) ON DELETE RESTRICT;
ALTER TABLE payment_recoveries ADD CONSTRAINT recovery_order_fk FOREIGN KEY ("orderId") REFERENCES trade_orders(id) ON DELETE RESTRICT;
ALTER TABLE recovery_proposals ADD CONSTRAINT proposal_recovery_fk FOREIGN KEY ("recoveryId") REFERENCES payment_recoveries(id) ON DELETE RESTRICT;
ALTER TABLE recovery_proposals ADD CONSTRAINT proposal_quote_fk FOREIGN KEY ("quoteId") REFERENCES delivery_quotes(id) ON DELETE RESTRICT;
ALTER TABLE fulfillment_deadlines ADD CONSTRAINT deadline_payment_fk FOREIGN KEY ("paymentId") REFERENCES payment_attempts(id) ON DELETE RESTRICT;
ALTER TABLE fulfillment_deadlines ADD CONSTRAINT deadline_order_fk FOREIGN KEY ("orderId") REFERENCES trade_orders(id) ON DELETE RESTRICT;
ALTER TABLE shipping_funding_batches ADD CONSTRAINT funding_positive_amount CHECK ("amountMinor" > 0);
