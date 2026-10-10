ALTER TABLE trade_orders ADD COLUMN "feeBasisPoints" INTEGER NOT NULL DEFAULT 600;
ALTER TABLE trade_orders ADD CONSTRAINT order_fee_valid CHECK ("feeBasisPoints" BETWEEN 0 AND 10000);
ALTER TABLE escrow_entries ADD COLUMN "feeMinor" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE escrow_entries ADD CONSTRAINT escrow_fee_valid CHECK ("feeMinor" >= 0 AND "feeMinor" <= "amountMinor");
