-- Only normalized outcomes are retained; no provider identity records or media.
ALTER TABLE "identity_checks" ADD COLUMN "result_summary" JSONB;
