CREATE TABLE "mobile_push_devices" (
  "token" VARCHAR(255) PRIMARY KEY,
  "userId" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "sessionFamilyId" UUID NOT NULL,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL
);
CREATE INDEX "mobile_push_devices_userId_idx" ON "mobile_push_devices"("userId");
CREATE TABLE "paid_order_notifications" (
  "id" UUID PRIMARY KEY,
  "orderId" UUID NOT NULL UNIQUE REFERENCES "trade_orders"("id") ON DELETE RESTRICT,
  "userId" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMPTZ(6),
  "nextRunAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "attempts" INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX "paid_order_notifications_userId_createdAt_idx" ON "paid_order_notifications"("userId", "createdAt");
CREATE INDEX "paid_order_notifications_sentAt_nextRunAt_idx" ON "paid_order_notifications"("sentAt", "nextRunAt");
