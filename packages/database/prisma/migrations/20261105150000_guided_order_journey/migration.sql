ALTER TABLE trade_orders
 ADD COLUMN journey_version INTEGER NOT NULL DEFAULT 1,
 ADD COLUMN farmer_decision VARCHAR(20) NOT NULL DEFAULT 'LEGACY',
 ADD COLUMN farmer_decided_at TIMESTAMPTZ(6),
 ADD COLUMN rejection_reason VARCHAR(500),
 ADD COLUMN handed_over_at TIMESTAMPTZ(6),
 ADD COLUMN receipt_photo_key TEXT,
 ADD COLUMN receipt_photo_mime VARCHAR(40),
 ADD COLUMN receipt_photo_at TIMESTAMPTZ(6);
ALTER TABLE trade_orders ADD CONSTRAINT order_farmer_decision_check CHECK (farmer_decision IN ('LEGACY', 'PENDING', 'ACCEPTED', 'REJECTED'));

ALTER TABLE delivery_notifications ADD COLUMN sent_at TIMESTAMPTZ(6), ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0, ADD COLUMN next_run_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW();
-- Do not send historical notifications when deploying the new outbox.
UPDATE delivery_notifications SET sent_at = NOW();
CREATE INDEX delivery_notification_outbox_idx ON delivery_notifications(next_run_at) WHERE sent_at IS NULL;
