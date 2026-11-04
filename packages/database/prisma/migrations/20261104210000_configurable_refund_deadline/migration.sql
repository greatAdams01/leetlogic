ALTER TABLE "marketplace_settings" ADD COLUMN "paymentRecoveryTimeoutMinutes" INTEGER NOT NULL DEFAULT 120;
ALTER TABLE "marketplace_settings" ADD CONSTRAINT "payment_recovery_timeout_range" CHECK ("paymentRecoveryTimeoutMinutes" BETWEEN 15 AND 10080);
