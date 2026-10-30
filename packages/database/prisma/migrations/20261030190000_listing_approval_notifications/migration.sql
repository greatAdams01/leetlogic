CREATE TABLE "listing_approval_notifications" (
  "id" UUID NOT NULL,
  "listingId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMPTZ(6),
  "nextRunAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "listing_approval_notifications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "listing_approval_notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "listing_approval_notifications_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "listing_approval_notifications_listingId_key" ON "listing_approval_notifications"("listingId");
CREATE INDEX "listing_approval_notifications_userId_createdAt_idx" ON "listing_approval_notifications"("userId", "createdAt");
CREATE INDEX "listing_approval_notifications_sentAt_nextRunAt_idx" ON "listing_approval_notifications"("sentAt", "nextRunAt");
