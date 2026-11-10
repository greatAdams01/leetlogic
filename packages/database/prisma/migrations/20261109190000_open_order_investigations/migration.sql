BEGIN;
-- Investigations stay open; final resolution alone freezes dispatch statuses.
CREATE OR REPLACE FUNCTION preserve_admin_order_resolution() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.admin_resolution IS NOT NULL THEN
    IF NEW.admin_resolution->>'financialAction' = 'HOLD' THEN
      NEW.status := 'UNDER_INVESTIGATION'; NEW.financial_hold := TRUE;
    ELSE NEW.status := NEW.admin_resolution->>'outcome'; END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION preserve_admin_delivery_resolution() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE resolution JSONB; order_key UUID;
BEGIN
  IF TG_TABLE_NAME = 'delivery_parcels' THEN
    SELECT "orderId" INTO order_key FROM deliveries WHERE id = NEW."deliveryId";
  ELSE order_key := NEW."orderId"; END IF;
  SELECT admin_resolution INTO resolution FROM trade_orders WHERE id = order_key;
  IF resolution IS NOT NULL AND resolution->>'financialAction' <> 'HOLD' THEN
    NEW.status := CASE WHEN resolution->>'outcome' = 'COMPLETED' THEN 'DELIVERED' ELSE 'CANCELLED' END;
  END IF;
  RETURN NEW;
END; $$;
-- Repair previously closed holds using their preserved pre-change snapshots.
-- Existing immutable history is retained; these corrections produce new history.
CREATE TEMP TABLE investigation_repairs ON COMMIT DROP AS
SELECT id, admin_resolution FROM trade_orders
WHERE admin_resolution->>'financialAction' = 'HOLD' AND admin_resolution->>'outcome' <> 'UNDER_INVESTIGATION';
INSERT INTO audit_logs (actor_type, action, entity_type, entity_id, request_id, reason)
SELECT 'system', 'order.admin.investigation.migrated', 'order', id, gen_random_uuid(),
  'Correct prior hold behavior: keep investigation open and restore the recorded dispatch state.' FROM investigation_repairs;
UPDATE trade_orders o SET admin_resolution = jsonb_set(o.admin_resolution, '{outcome}', '"UNDER_INVESTIGATION"'), status = 'UNDER_INVESTIGATION', financial_hold = TRUE
FROM investigation_repairs r WHERE r.id = o.id;
-- Find only snapshots captured by the exact transaction of this hold, not unrelated updates.
CREATE TEMP TABLE investigation_dispatch_snapshots ON COMMIT DROP AS
SELECT DISTINCT ON (h.entity_type, h.entity_id) h.entity_type, h.entity_id, h."before" AS snapshot
FROM order_record_history h JOIN investigation_repairs r ON r.id = h.order_id
WHERE h.kind = 'UPDATE' AND h.entity_type IN ('delivery','shipment','deliveryParcel')
AND h.transaction_id IN (SELECT v.transaction_id FROM order_record_history v WHERE v.order_id = r.id AND v.entity_type = 'order'
  AND v."after"->'admin_resolution'->>'id' = r.admin_resolution->>'id' AND v.kind = 'UPDATE')
ORDER BY h.entity_type, h.entity_id, h.id;
UPDATE deliveries d SET status = COALESCE(s.snapshot->>'status', d.status), "failureCode" = s.snapshot->>'failureCode'
FROM investigation_dispatch_snapshots s WHERE s.entity_type = 'delivery' AND s.entity_id = d.id;
UPDATE shipments d SET status = COALESCE(s.snapshot->>'status', d.status)
FROM investigation_dispatch_snapshots s WHERE s.entity_type = 'shipment' AND s.entity_id = d.id;
UPDATE delivery_parcels d SET status = COALESCE(s.snapshot->>'status', d.status), "failureCode" = s.snapshot->>'failureCode'
FROM investigation_dispatch_snapshots s WHERE s.entity_type = 'deliveryParcel' AND s.entity_id = d.id;
UPDATE fulfillment_deadlines f SET state = 'ADMIN_INVESTIGATION', "failureCode" = NULL
FROM investigation_repairs r WHERE f."orderId" = r.id;
INSERT INTO delivery_events (id, "deliveryId", status, source, "dedupeKey", details, "createdAt")
SELECT gen_random_uuid(), d.id, 'ADMIN_INVESTIGATION', 'system', r.id::text || ':investigation-repair',
  '{"outcome":"UNDER_INVESTIGATION","financialAction":"HOLD"}'::jsonb, clock_timestamp()
FROM deliveries d JOIN investigation_repairs r ON r.id = d."orderId";
COMMIT;
