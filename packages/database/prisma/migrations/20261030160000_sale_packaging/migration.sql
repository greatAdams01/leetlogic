-- Commercial selling units remain separate from courier parcel measurements.
ALTER TABLE "listings" ADD COLUMN "sale_packaging" JSONB;
INSERT INTO "units" ("code", "name", "allows_decimal") VALUES ('LITRE', 'Litre', true)
ON CONFLICT ("code") DO NOTHING;
