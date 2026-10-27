-- Preserve provider quality signals with the exact price/ETA snapshot used for ranking.
ALTER TABLE "delivery_quotes" ADD COLUMN "quality" JSONB;
