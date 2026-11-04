ALTER TABLE "delivery_notifications" ADD COLUMN "readAt" TIMESTAMPTZ(6);
ALTER TABLE "paid_order_notifications" ADD COLUMN "readAt" TIMESTAMPTZ(6);
ALTER TABLE "listing_approval_notifications" ADD COLUMN "readAt" TIMESTAMPTZ(6);
