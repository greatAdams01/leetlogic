-- Nullable metadata preserves existing delivery events and financial/receipt rules.
ALTER TABLE "delivery_events" ADD COLUMN "details" JSONB;
