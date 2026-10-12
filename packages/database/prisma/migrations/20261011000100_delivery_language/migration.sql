-- AlterTable
ALTER TABLE "listings" ADD COLUMN     "sourceLocale" VARCHAR(10) NOT NULL DEFAULT 'en';

-- AlterTable
ALTER TABLE "support_messages" ADD COLUMN     "sourceLocale" VARCHAR(10) NOT NULL DEFAULT 'en';

-- CreateTable
CREATE TABLE "deliveries" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "status" VARCHAR(40) NOT NULL DEFAULT 'QUOTE_REQUIRED',
    "pickup" JSONB,
    "destination" JSONB,
    "package" JSONB,
    "selectedQuoteId" UUID,
    "shippingMinor" BIGINT NOT NULL DEFAULT 0,
    "paidMinor" BIGINT NOT NULL DEFAULT 0,
    "paymentRef" VARCHAR(160),
    "providerShipmentId" VARCHAR(160),
    "trackingUrl" TEXT,
    "courier" VARCHAR(120),
    "lastSyncedAt" TIMESTAMPTZ(6),
    "cancelAttemptedAt" TIMESTAMPTZ(6),
    "cancelRequestedAt" TIMESTAMPTZ(6),
    "bookingStartedAt" TIMESTAMPTZ(6),
    "nextSyncAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseUntil" TIMESTAMPTZ(6),
    "failureCode" VARCHAR(80),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_quotes" (
    "id" UUID NOT NULL,
    "deliveryId" UUID NOT NULL,
    "requestToken" TEXT NOT NULL,
    "serviceCode" VARCHAR(120) NOT NULL,
    "courier" VARCHAR(120) NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "eta" VARCHAR(180),
    "inputHash" VARCHAR(64) NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_events" (
    "id" UUID NOT NULL,
    "deliveryId" UUID NOT NULL,
    "dedupeKey" VARCHAR(200) NOT NULL,
    "status" VARCHAR(40) NOT NULL,
    "source" VARCHAR(30) NOT NULL,
    "actorId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_translations" (
    "id" UUID NOT NULL,
    "resourceType" VARCHAR(30) NOT NULL,
    "resourceId" UUID NOT NULL,
    "sourceVersion" VARCHAR(64) NOT NULL,
    "sourceLocale" VARCHAR(10) NOT NULL,
    "targetLocale" VARCHAR(10) NOT NULL,
    "text" TEXT NOT NULL,
    "provider" VARCHAR(30) NOT NULL DEFAULT 'azure',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "translation_usage" (
    "month" VARCHAR(7) NOT NULL,
    "characters" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "translation_usage_pkey" PRIMARY KEY ("month")
);

-- CreateTable
CREATE TABLE "listing_drafts" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "fields" JSONB NOT NULL,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "listingId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "listing_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "produce_photos" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "listingId" UUID,
    "mimeType" VARCHAR(30) NOT NULL,
    "checksum" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "produce_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "deliveries_orderId_key" ON "deliveries"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "deliveries_paymentRef_key" ON "deliveries"("paymentRef");

-- CreateIndex
CREATE UNIQUE INDEX "deliveries_providerShipmentId_key" ON "deliveries"("providerShipmentId");

-- CreateIndex
CREATE INDEX "deliveries_status_nextSyncAt_idx" ON "deliveries"("status", "nextSyncAt");

-- CreateIndex
CREATE INDEX "delivery_quotes_deliveryId_idx" ON "delivery_quotes"("deliveryId");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_events_dedupeKey_key" ON "delivery_events"("dedupeKey");

-- CreateIndex
CREATE INDEX "delivery_events_deliveryId_createdAt_idx" ON "delivery_events"("deliveryId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "content_translations_resourceType_resourceId_sourceVersion__key" ON "content_translations"("resourceType", "resourceId", "sourceVersion", "targetLocale");

-- CreateIndex
CREATE UNIQUE INDEX "listing_drafts_listingId_key" ON "listing_drafts"("listingId");

-- CreateIndex
CREATE INDEX "listing_drafts_userId_idx" ON "listing_drafts"("userId");

-- CreateIndex
CREATE INDEX "produce_photos_listingId_idx" ON "produce_photos"("listingId");

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "trade_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_quotes" ADD CONSTRAINT "delivery_quotes_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "deliveries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_events" ADD CONSTRAINT "delivery_events_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "deliveries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Financial and ownership invariants apply to all writers.
ALTER TABLE deliveries ADD CONSTRAINT delivery_amounts CHECK ("shippingMinor" >= 0 AND "paidMinor" >= 0 AND ("paidMinor" = 0 OR "paidMinor" = "shippingMinor"));
ALTER TABLE delivery_quotes ADD CONSTRAINT delivery_quote_amount CHECK ("amountMinor" >= 0);
CREATE UNIQUE INDEX delivery_quote_owner ON delivery_quotes ("deliveryId", id);
ALTER TABLE deliveries ADD CONSTRAINT selected_quote_owner FOREIGN KEY (id, "selectedQuoteId") REFERENCES delivery_quotes ("deliveryId", id) ON DELETE RESTRICT;
ALTER TABLE translation_usage ADD CONSTRAINT translation_usage_bounds CHECK (characters BETWEEN 0 AND 2000000);
ALTER TABLE listing_drafts ADD CONSTRAINT draft_user_fk FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE listing_drafts ADD CONSTRAINT draft_listing_fk FOREIGN KEY ("listingId") REFERENCES listings(id) ON DELETE RESTRICT;
ALTER TABLE produce_photos ADD CONSTRAINT photo_user_fk FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE produce_photos ADD CONSTRAINT photo_listing_fk FOREIGN KEY ("listingId") REFERENCES listings(id) ON DELETE RESTRICT;
