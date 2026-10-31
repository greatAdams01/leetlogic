-- Add verification/retry metadata only. Existing payment, order and inventory values are unchanged.
-- Historical timestamps stay null: a migration cannot verify a payment.
ALTER TABLE "payment_attempts"
  ADD COLUMN "confirmedAt" TIMESTAMPTZ(6),
  ADD COLUMN "lastCheckedAt" TIMESTAMPTZ(6),
  ADD COLUMN "nextCheckAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "checkFailures" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "checkErrorCode" VARCHAR(80);

CREATE INDEX "payment_attempts_mode_status_nextCheckAt_idx"
  ON "payment_attempts"("mode", "status", "nextCheckAt");

ALTER TABLE "money_webhooks"
  ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "processedAt" TIMESTAMPTZ(6);
