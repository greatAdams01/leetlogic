-- AlterTable
ALTER TABLE "trade_orders" ADD COLUMN     "financial_hold" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "funds_provider" VARCHAR(20),
ADD COLUMN     "reservation_expires_at" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "delivery_quotes" ADD COLUMN     "courierId" VARCHAR(120),
ADD COLUMN     "walletMinor" BIGINT;

-- CreateTable
CREATE TABLE "financial_accounts" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "mode" VARCHAR(10) NOT NULL,
    "providerAccountId" VARCHAR(160),
    "status" VARCHAR(40) NOT NULL DEFAULT 'ONBOARDING',
    "capabilities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "financial_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_attempts" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "buyerId" UUID NOT NULL,
    "mode" VARCHAR(10) NOT NULL,
    "kind" VARCHAR(30) NOT NULL DEFAULT 'ORDER',
    "status" VARCHAR(40) NOT NULL DEFAULT 'QUEUED',
    "amountMinor" BIGINT NOT NULL,
    "produceMinor" BIGINT NOT NULL,
    "shippingMinor" BIGINT NOT NULL,
    "processingFeeMinor" BIGINT NOT NULL DEFAULT 0,
    "quoteId" UUID,
    "checkoutId" VARCHAR(160),
    "checkoutUrl" TEXT,
    "chargeId" VARCHAR(160),
    "method" VARCHAR(40),
    "paidMinor" BIGINT NOT NULL DEFAULT 0,
    "exceptionCode" VARCHAR(80),
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payment_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "money_operations" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "actorId" UUID,
    "orderId" UUID,
    "paymentId" UUID,
    "mode" VARCHAR(10) NOT NULL,
    "kind" VARCHAR(40) NOT NULL,
    "status" VARCHAR(40) NOT NULL DEFAULT 'QUEUED',
    "mutationKey" VARCHAR(240) NOT NULL,
    "requestHash" CHAR(64) NOT NULL,
    "amountMinor" BIGINT NOT NULL DEFAULT 0,
    "feeMinor" BIGINT NOT NULL DEFAULT 0,
    "providerRef" VARCHAR(160),
    "payload" JSONB NOT NULL,
    "encryptedPayload" TEXT,
    "failureCode" VARCHAR(80),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "leaseUntil" TIMESTAMPTZ(6),
    "nextRunAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "money_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_destinations" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "mode" VARCHAR(10) NOT NULL,
    "providerId" VARCHAR(160) NOT NULL,
    "bankCode" VARCHAR(20) NOT NULL,
    "bankName" VARCHAR(120) NOT NULL,
    "accountName" VARCHAR(160) NOT NULL,
    "accountLastFour" VARCHAR(4) NOT NULL,
    "fingerprint" CHAR(64) NOT NULL,
    "usable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_destinations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "money_webhooks" (
    "id" VARCHAR(160) NOT NULL,
    "mode" VARCHAR(10) NOT NULL,
    "eventType" VARCHAR(100) NOT NULL,
    "resourceId" VARCHAR(160),
    "accountId" VARCHAR(160),
    "bodyHash" CHAR(64) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'QUEUED',
    "nextRunAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "failureCode" VARCHAR(80),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "money_webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "money_journals" (
    "id" UUID NOT NULL,
    "reference" VARCHAR(240) NOT NULL,
    "mode" VARCHAR(10) NOT NULL,
    "orderId" UUID,
    "operationId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "money_journals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "money_journal_lines" (
    "id" UUID NOT NULL,
    "journalId" UUID NOT NULL,
    "account" VARCHAR(160) NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'NGN',

    CONSTRAINT "money_journal_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "money_reconciliations" (
    "id" UUID NOT NULL,
    "mode" VARCHAR(10) NOT NULL,
    "platformAvailableMinor" BIGINT NOT NULL,
    "heldProduceMinor" BIGINT NOT NULL,
    "pendingOperations" INTEGER NOT NULL,
    "exceptionCount" INTEGER NOT NULL,
    "shippingWalletMinor" BIGINT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "money_reconciliations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "financial_accounts_providerAccountId_key" ON "financial_accounts"("providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "financial_accounts_userId_mode_key" ON "financial_accounts"("userId", "mode");

-- CreateIndex
CREATE UNIQUE INDEX "payment_attempts_checkoutId_key" ON "payment_attempts"("checkoutId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_attempts_chargeId_key" ON "payment_attempts"("chargeId");

-- CreateIndex
CREATE INDEX "payment_attempts_orderId_mode_status_idx" ON "payment_attempts"("orderId", "mode", "status");

-- CreateIndex
CREATE UNIQUE INDEX "money_operations_mutationKey_key" ON "money_operations"("mutationKey");

-- CreateIndex
CREATE INDEX "money_operations_mode_status_nextRunAt_idx" ON "money_operations"("mode", "status", "nextRunAt");

-- CreateIndex
CREATE INDEX "money_operations_orderId_kind_idx" ON "money_operations"("orderId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "bank_destinations_mode_providerId_key" ON "bank_destinations"("mode", "providerId");

-- CreateIndex
CREATE UNIQUE INDEX "bank_destinations_userId_mode_fingerprint_key" ON "bank_destinations"("userId", "mode", "fingerprint");

-- CreateIndex
CREATE INDEX "money_webhooks_mode_status_nextRunAt_idx" ON "money_webhooks"("mode", "status", "nextRunAt");

-- CreateIndex
CREATE UNIQUE INDEX "money_journals_reference_key" ON "money_journals"("reference");

-- CreateIndex
CREATE INDEX "money_journal_lines_account_idx" ON "money_journal_lines"("account");

-- AddForeignKey
ALTER TABLE "money_journal_lines" ADD CONSTRAINT "money_journal_lines_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "money_journals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Financial history cannot be rewritten, including by accidental application updates.
CREATE TRIGGER money_journals_immutable BEFORE UPDATE OR DELETE ON money_journals FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();
CREATE TRIGGER money_journal_lines_immutable BEFORE UPDATE OR DELETE ON money_journal_lines FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();
ALTER TABLE money_journal_lines ADD CONSTRAINT money_line_nonzero CHECK ("amountMinor" <> 0), ADD CONSTRAINT money_line_currency CHECK (currency = 'NGN');
CREATE FUNCTION check_money_journal() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target uuid; line_count bigint; balance numeric;
BEGIN
  IF TG_TABLE_NAME = 'money_journals' THEN target := NEW.id; ELSE target := NEW."journalId"; END IF;
  SELECT count(*), COALESCE(sum("amountMinor"),0) INTO line_count,balance FROM money_journal_lines WHERE "journalId" = target;
  IF line_count < 2 OR balance <> 0 THEN RAISE EXCEPTION 'Financial journal must balance'; END IF;
  RETURN NULL;
END; $$;
CREATE CONSTRAINT TRIGGER money_journal_balanced AFTER INSERT ON money_journals DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_money_journal();
CREATE CONSTRAINT TRIGGER money_lines_balanced AFTER INSERT ON money_journal_lines DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_money_journal();
ALTER TABLE payment_attempts ADD CONSTRAINT payment_order_fk FOREIGN KEY ("orderId") REFERENCES trade_orders(id) ON DELETE RESTRICT;
ALTER TABLE money_operations ADD CONSTRAINT operation_order_fk FOREIGN KEY ("orderId") REFERENCES trade_orders(id) ON DELETE RESTRICT;
ALTER TABLE financial_accounts ADD CONSTRAINT financial_user_fk FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE payment_attempts ADD CONSTRAINT payment_positive CHECK ("amountMinor" > 0 AND "produceMinor" >= 0 AND "shippingMinor" >= 0 AND "amountMinor" = "produceMinor" + "shippingMinor");
