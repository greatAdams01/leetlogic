CREATE TABLE "dispute_evidence" (
 "id" UUID PRIMARY KEY,
 "ticketId" UUID NOT NULL REFERENCES "support_tickets"("id") ON DELETE RESTRICT,
 "storageKey" TEXT NOT NULL,
 "mimeType" VARCHAR(80) NOT NULL,
 "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "dispute_evidence_ticketId_idx" ON "dispute_evidence"("ticketId");
