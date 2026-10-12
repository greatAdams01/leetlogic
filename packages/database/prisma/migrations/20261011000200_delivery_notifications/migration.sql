-- CreateTable
CREATE TABLE "delivery_notifications" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "locale" VARCHAR(10) NOT NULL,
    "messageKey" VARCHAR(80) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "delivery_notifications_userId_createdAt_idx" ON "delivery_notifications"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_notifications_eventId_userId_key" ON "delivery_notifications"("eventId", "userId");

-- AddForeignKey
ALTER TABLE "delivery_notifications" ADD CONSTRAINT "delivery_notifications_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "delivery_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE delivery_notifications ADD CONSTRAINT notification_user_fk FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE delivery_notifications ADD CONSTRAINT notification_order_fk FOREIGN KEY ("orderId") REFERENCES trade_orders(id) ON DELETE RESTRICT;
CREATE FUNCTION prevent_delivery_event_changes() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Delivery events are append-only'; END; $$;
CREATE TRIGGER delivery_events_append_only BEFORE UPDATE OR DELETE ON delivery_events FOR EACH ROW EXECUTE FUNCTION prevent_delivery_event_changes();
