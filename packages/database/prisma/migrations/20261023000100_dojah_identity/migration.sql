ALTER TABLE "verification_cases" ADD COLUMN "identity_required" BOOLEAN NOT NULL DEFAULT false;
CREATE TYPE "IdentityCheckStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED', 'REVIEW', 'ABANDONED', 'EXPIRED');
CREATE TABLE "identity_checks" (
  "id" UUID NOT NULL,
  "verification_case_id" UUID NOT NULL,
  "provider" VARCHAR(30) NOT NULL DEFAULT 'dojah',
  "mode" VARCHAR(10) NOT NULL,
  "widget_id" VARCHAR(120) NOT NULL,
  "status" "IdentityCheckStatus" NOT NULL DEFAULT 'PENDING',
  "consent_version" VARCHAR(50) NOT NULL,
  "consent_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "last_checked_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "identity_checks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "identity_checks_verification_case_id_fkey" FOREIGN KEY ("verification_case_id") REFERENCES "verification_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "identity_checks_verification_case_id_created_at_idx" ON "identity_checks"("verification_case_id", "created_at");
CREATE TABLE "identity_check_events" (
  "id" UUID NOT NULL,
  "identity_check_id" UUID NOT NULL,
  "digest" CHAR(64) NOT NULL,
  "status" "IdentityCheckStatus" NOT NULL,
  "source" VARCHAR(20) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "identity_check_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "identity_check_events_identity_check_id_fkey" FOREIGN KEY ("identity_check_id") REFERENCES "identity_checks"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "identity_check_events_digest_key" ON "identity_check_events"("digest");
