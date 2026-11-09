BEGIN;

-- Additive only: preserve all order IDs, payment records, shipment references and original workflows.
ALTER TABLE "trade_orders" ADD COLUMN "buyer_contact_snapshot" JSONB, ADD COLUMN "fulfillment_notes" VARCHAR(700);
ALTER TABLE "deliveries" ADD COLUMN "operations_notes" VARCHAR(700);
ALTER TABLE "shipments" ADD COLUMN "rider_assignment" JSONB;
ALTER TABLE "audit_logs" ADD COLUMN "transaction_id" BIGINT, ADD COLUMN "reason" VARCHAR(500);
ALTER TABLE "audit_logs" ALTER COLUMN "transaction_id" SET DEFAULT txid_current();
ALTER TABLE "delivery_events" ADD COLUMN "transaction_id" BIGINT;
ALTER TABLE "delivery_events" ALTER COLUMN "transaction_id" SET DEFAULT txid_current();
CREATE INDEX "audit_logs_transaction_id_idx" ON "audit_logs"("transaction_id");

CREATE TABLE "order_record_history" (
  "id" BIGSERIAL PRIMARY KEY,
  "order_id" UUID NOT NULL,
  "entity_type" VARCHAR(40) NOT NULL,
  "entity_id" UUID NOT NULL,
  "kind" VARCHAR(30) NOT NULL,
  "action" VARCHAR(120) NOT NULL,
  "actor_type" VARCHAR(30) NOT NULL,
  "actor_id" UUID,
  "actor_name" VARCHAR(160) NOT NULL,
  "reason" VARCHAR(500),
  "before" JSONB,
  "after" JSONB,
  "audit_id" BIGINT,
  "transaction_id" BIGINT,
  "request_id" UUID,
  "occurred_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp()
);
-- No cascade can erase the history, even if a principal or a source record is removed.
CREATE INDEX "order_record_history_order_id_id_idx" ON "order_record_history"("order_id", "id");
CREATE INDEX "order_record_history_order_id_transaction_id_idx" ON "order_record_history"("order_id", "transaction_id");
CREATE INDEX "order_record_history_audit_id_idx" ON "order_record_history"("audit_id");

CREATE FUNCTION order_history_actor(order_key UUID, actor_kind TEXT, actor_key UUID) RETURNS JSONB
LANGUAGE plpgsql AS $$
DECLARE actor_label TEXT; resolved_kind TEXT := actor_kind;
BEGIN
  IF actor_kind = 'admin' OR EXISTS (SELECT 1 FROM admin_accounts WHERE id = actor_key) THEN
    resolved_kind := 'admin';
    SELECT full_name INTO actor_label FROM admin_accounts WHERE id = actor_key;
  ELSIF actor_key IS NOT NULL AND actor_kind NOT IN ('system', 'shipbubble', 'courier') THEN
    SELECT CASE WHEN o."buyerId" = actor_key THEN 'buyer' WHEN f.user_id = actor_key THEN 'farmer' ELSE 'customer' END,
      COALESCE(p.full_name, p.display_name, u.phone_e164)
      INTO resolved_kind, actor_label
      FROM trade_orders o JOIN farmer_profiles f ON f.id = o."farmerProfileId"
      LEFT JOIN users u ON u.id = actor_key LEFT JOIN user_profiles p ON p.user_id = u.id
      WHERE o.id = order_key;
  END IF;
  IF actor_kind IN ('shipbubble', 'courier') THEN resolved_kind := 'courier'; actor_label := 'Courier provider'; END IF;
  RETURN jsonb_build_object('type', COALESCE(resolved_kind, 'system'), 'name',
      LEFT(COALESCE(actor_label, CASE WHEN resolved_kind = 'admin' THEN 'Administrator' WHEN resolved_kind IN ('buyer','farmer','customer') THEN 'Customer' ELSE 'LeetLogic automated system' END), 160));
END; $$;

-- Resolve only explicit relationships, never timestamps or guesses across unrelated orders.
CREATE FUNCTION order_history_order(entity_kind TEXT, entity_key UUID) RETURNS UUID
LANGUAGE plpgsql STABLE AS $$
DECLARE order_key UUID;
BEGIN
  CASE entity_kind
    WHEN 'order' THEN order_key := entity_key;
    WHEN 'delivery' THEN SELECT "orderId" INTO order_key FROM deliveries WHERE id = entity_key;
    WHEN 'shipment' THEN SELECT "orderId" INTO order_key FROM shipments WHERE id = entity_key;
    WHEN 'deliveryParcel' THEN SELECT d."orderId" INTO order_key FROM delivery_parcels p JOIN deliveries d ON d.id = p."deliveryId" WHERE p.id = entity_key;
    WHEN 'deliveryQuote' THEN SELECT d."orderId" INTO order_key FROM delivery_quotes q JOIN deliveries d ON d.id = q."deliveryId" WHERE q.id = entity_key;
    WHEN 'payment' THEN SELECT "orderId" INTO order_key FROM payment_attempts WHERE id = entity_key;
    WHEN 'money_operation' THEN SELECT "orderId" INTO order_key FROM money_operations WHERE id = entity_key;
    WHEN 'moneyOperation' THEN SELECT "orderId" INTO order_key FROM money_operations WHERE id = entity_key;
    WHEN 'support_ticket' THEN SELECT "orderId" INTO order_key FROM support_tickets WHERE id = entity_key;
    WHEN 'compliance' THEN SELECT "orderId" INTO order_key FROM compliance_reviews WHERE id = entity_key;
    ELSE order_key := NULL;
  END CASE;
  RETURN order_key;
END; $$;

-- Keep exact money/quantity strings. Private receipt object keys and provider request tokens
-- are not operational evidence and must never be copied to a staff-readable history endpoint.
CREATE FUNCTION order_history_snapshot(entity_kind TEXT, value JSONB) RETURNS JSONB
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE result JSONB := value; field TEXT;
BEGIN
  IF value IS NULL THEN RETURN NULL; END IF;
  IF jsonb_typeof(value) <> 'object' THEN RETURN value; END IF;
  IF entity_kind = 'order' THEN
    result := (result - 'receipt_photo_key') || jsonb_build_object('receiptEvidencePresent', value->>'receipt_photo_key' IS NOT NULL);
  END IF;
  result := result - ARRAY['requestToken','checkoutUrl','encryptedPayload','payload'];
  IF entity_kind = 'money_operation' AND value->'payload'->>'reason' IS NOT NULL THEN
    result := result || jsonb_build_object('operationReason', LEFT(value->'payload'->>'reason', 500));
  END IF;
  FOR field IN SELECT jsonb_object_keys(result) LOOP
    IF (field LIKE '%Minor' OR field = 'quantity') AND result->field <> 'null'::jsonb THEN
      result := jsonb_set(result, ARRAY[field], to_jsonb(result->>field));
    END IF;
  END LOOP;
  RETURN result;
END; $$;

CREATE FUNCTION capture_order_buyer_contact() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.buyer_contact_snapshot IS NULL THEN
    SELECT jsonb_build_object('name', COALESCE(p.full_name, p.display_name, u.phone_e164), 'phone', u.phone_e164, 'email', COALESCE(p.email, ''))
      INTO NEW.buyer_contact_snapshot FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id WHERE u.id = NEW."buyerId";
  END IF;
  RETURN NEW;
END; $$;
UPDATE trade_orders o SET buyer_contact_snapshot = jsonb_build_object('name', COALESCE(p.full_name, p.display_name, u.phone_e164), 'phone', u.phone_e164, 'email', COALESCE(p.email, ''))
  FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id WHERE u.id = o."buyerId";
CREATE TRIGGER order_buyer_contact_at_creation BEFORE INSERT ON trade_orders FOR EACH ROW EXECUTE FUNCTION capture_order_buyer_contact();

-- Import the evidence that already exists, without pretending previously uncaptured values
-- can be recovered. The later BASELINE is the start of complete state reconstruction.
INSERT INTO order_record_history(order_id, entity_type, entity_id, kind, action, actor_type, actor_id, actor_name, reason, "before", "after", audit_id, request_id, occurred_at)
SELECT order_key, entity_type, entity_id, 'LEGACY_ACTION', action, identity->>'type', actor_id, identity->>'name',
  LEFT(after_redacted->>'reason', 500), before_redacted, after_redacted, id, request_id, created_at
FROM (SELECT a.*, order_history_order(entity_type, entity_id) AS order_key,
  order_history_actor(order_history_order(entity_type, entity_id), actor_type, actor_id) AS identity FROM audit_logs a) existing
WHERE order_key IS NOT NULL ORDER BY created_at, id;

INSERT INTO order_record_history(order_id, entity_type, entity_id, kind, action, actor_type, actor_id, actor_name, "after", occurred_at)
SELECT d."orderId", 'delivery', e.id, 'EVENT', e.status, identity->>'type', e."actorId", identity->>'name', e.details, e."createdAt"
FROM delivery_events e JOIN deliveries d ON d.id = e."deliveryId"
CROSS JOIN LATERAL (SELECT order_history_actor(d."orderId", e.source, e."actorId") AS identity) actor
ORDER BY e."createdAt", e.id;

INSERT INTO order_record_history(order_id, entity_type, entity_id, kind, action, actor_type, actor_id, actor_name, reason, "after", occurred_at)
SELECT e."orderId", 'escrow', e.id, 'LEDGER', 'escrow.' || LOWER(e.kind), identity->>'type', e."actorId", identity->>'name', e.reason,
  order_history_snapshot('escrow', to_jsonb(e)), e."createdAt"
FROM escrow_entries e CROSS JOIN LATERAL (SELECT order_history_actor(e."orderId", CASE WHEN EXISTS(SELECT 1 FROM admin_accounts a WHERE a.id = e."actorId") THEN 'admin' ELSE 'system' END, e."actorId") AS identity) actor
ORDER BY e."createdAt", e.id;

INSERT INTO order_record_history(order_id, entity_type, entity_id, kind, action, actor_type, actor_name, "after", occurred_at)
SELECT order_key, entity_type, entity_id, 'BASELINE', 'history.baseline', 'system', 'LeetLogic automated system', snapshot, transaction_timestamp()
FROM (
  SELECT id AS order_key, 'order' AS entity_type, id AS entity_id, order_history_snapshot('order', to_jsonb(o)) AS snapshot FROM trade_orders o
  UNION ALL SELECT "orderId", 'delivery', id, order_history_snapshot('delivery', to_jsonb(d)) FROM deliveries d
  UNION ALL SELECT "orderId", 'shipment', id, order_history_snapshot('shipment', to_jsonb(s)) FROM shipments s
  UNION ALL SELECT d."orderId", 'deliveryParcel', p.id, order_history_snapshot('deliveryParcel', to_jsonb(p)) FROM delivery_parcels p JOIN deliveries d ON d.id = p."deliveryId"
  UNION ALL SELECT d."orderId", 'deliveryQuote', q.id, order_history_snapshot('deliveryQuote', to_jsonb(q)) FROM delivery_quotes q JOIN deliveries d ON d.id = q."deliveryId"
  UNION ALL SELECT "orderId", 'payment', id, order_history_snapshot('payment', to_jsonb(p)) FROM payment_attempts p
  UNION ALL SELECT "orderId", 'money_operation', id, order_history_snapshot('money_operation', to_jsonb(m)) FROM money_operations m WHERE "orderId" IS NOT NULL
) baseline;

-- Deferred triggers see the transaction's audit entry even when the existing workflow writes
-- its audit log AFTER updating the row. A rollback discards both the write and its new history.
CREATE FUNCTION capture_order_record_history() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE before_value JSONB; after_value JSONB; row_value JSONB; order_key UUID; identity JSONB; entry audit_logs%ROWTYPE;
  context_actor UUID; context_source TEXT;
  entity_kind TEXT := TG_ARGV[0]; row_key UUID; event_time TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF TG_OP <> 'INSERT' THEN before_value := order_history_snapshot(entity_kind, to_jsonb(OLD)); END IF;
  IF TG_OP <> 'DELETE' THEN after_value := order_history_snapshot(entity_kind, to_jsonb(NEW)); END IF;
  -- Worker leases and polling timestamps are not business changes. Their values remain in
  -- full snapshots when an actual operational field changes; do not flood activity history.
  IF TG_OP = 'UPDATE' AND (before_value - ARRAY['updatedAt','lastSyncedAt','nextSyncAt','leaseUntil','lastCheckedAt','nextCheckAt','checkFailures']) IS NOT DISTINCT FROM
    (after_value - ARRAY['updatedAt','lastSyncedAt','nextSyncAt','leaseUntil','lastCheckedAt','nextCheckAt','checkFailures']) THEN RETURN NULL; END IF;
  row_value := COALESCE(after_value, before_value); row_key := (row_value->>'id')::uuid;
  IF entity_kind = 'order' THEN order_key := row_key;
  ELSIF entity_kind IN ('deliveryParcel','deliveryQuote') THEN SELECT "orderId" INTO order_key FROM deliveries WHERE id = (row_value->>'deliveryId')::uuid;
  ELSE order_key := (row_value->>'orderId')::uuid; END IF;
  IF order_key IS NULL AND entity_kind = 'money_operation' THEN RETURN NULL; END IF;
  IF order_key IS NULL THEN RAISE EXCEPTION 'Cannot preserve order record history without its order'; END IF;
  SELECT * INTO entry FROM audit_logs a WHERE a.transaction_id = txid_current()
    AND order_history_order(a.entity_type, a.entity_id) = order_key
    ORDER BY (a.entity_type = entity_kind AND a.entity_id = row_key) DESC, (a.actor_type = 'admin') DESC, a.id DESC LIMIT 1;
  identity := order_history_actor(order_key, COALESCE(entry.actor_type, 'system'), entry.actor_id);
  -- Provider reads do not use a customer/admin request. Their verified events identify
  -- the courier, including shipment changes made in the same tracking transaction.
  IF entry.id IS NULL THEN
    SELECT e."actorId", e.source INTO context_actor, context_source FROM delivery_events e JOIN deliveries d ON d.id = e."deliveryId"
      WHERE d."orderId" = order_key AND e.transaction_id = txid_current()
      ORDER BY (e.source IN ('shipbubble','courier')) DESC, e."createdAt" DESC, e.id DESC LIMIT 1;
    IF context_source IS NOT NULL THEN
      identity := order_history_actor(order_key, context_source, context_actor);
    ELSIF entity_kind = 'money_operation' AND TG_OP = 'INSERT' AND row_value->>'actorId' IS NOT NULL THEN
      identity := order_history_actor(order_key, 'customer', (row_value->>'actorId')::uuid);
    ELSIF entity_kind = 'payment' AND TG_OP = 'INSERT' THEN
      identity := order_history_actor(order_key, 'customer', (row_value->>'buyerId')::uuid);
    END IF;
  END IF;
  INSERT INTO order_record_history(order_id, entity_type, entity_id, kind, action, actor_type, actor_id, actor_name, reason, "before", "after", audit_id, transaction_id, request_id, occurred_at)
    VALUES(order_key, entity_kind, row_key, TG_OP, COALESCE(entry.action, entity_kind || '.' || LOWER(TG_OP)), identity->>'type',
      COALESCE(entry.actor_id, context_actor, CASE WHEN TG_OP = 'INSERT' AND entity_kind = 'money_operation' THEN (row_value->>'actorId')::uuid WHEN TG_OP = 'INSERT' AND entity_kind = 'payment' THEN (row_value->>'buyerId')::uuid END), identity->>'name',
      COALESCE(entry.reason, LEFT(entry.after_redacted->>'reason',500), LEFT(entry.after_redacted->>'evidence',500), row_value->>'operationReason'), before_value, after_value, entry.id, txid_current(), entry.request_id, event_time);
  RETURN NULL;
END; $$;
CREATE CONSTRAINT TRIGGER preserve_order_versions AFTER INSERT OR UPDATE OR DELETE ON trade_orders DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION capture_order_record_history('order');
CREATE CONSTRAINT TRIGGER preserve_delivery_versions AFTER INSERT OR UPDATE OR DELETE ON deliveries DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION capture_order_record_history('delivery');
CREATE CONSTRAINT TRIGGER preserve_shipment_versions AFTER INSERT OR UPDATE OR DELETE ON shipments DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION capture_order_record_history('shipment');
CREATE CONSTRAINT TRIGGER preserve_parcel_versions AFTER INSERT OR UPDATE OR DELETE ON delivery_parcels DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION capture_order_record_history('deliveryParcel');
CREATE CONSTRAINT TRIGGER preserve_quote_versions AFTER INSERT OR UPDATE OR DELETE ON delivery_quotes DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION capture_order_record_history('deliveryQuote');
CREATE CONSTRAINT TRIGGER preserve_payment_versions AFTER INSERT OR UPDATE OR DELETE ON payment_attempts DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION capture_order_record_history('payment');
CREATE CONSTRAINT TRIGGER preserve_money_operation_versions AFTER INSERT OR UPDATE OR DELETE ON money_operations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION capture_order_record_history('money_operation');

CREATE FUNCTION capture_order_audit_action() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE order_key UUID; identity JSONB;
BEGIN
  order_key := order_history_order(NEW.entity_type, NEW.entity_id);
  IF order_key IS NULL THEN RETURN NULL; END IF;
  identity := order_history_actor(order_key, NEW.actor_type, NEW.actor_id);
  INSERT INTO order_record_history(order_id, entity_type, entity_id, kind, action, actor_type, actor_id, actor_name, reason, "before", "after", audit_id, transaction_id, request_id, occurred_at)
    VALUES(order_key, LEFT(NEW.entity_type, 40), NEW.entity_id, 'ACTION', NEW.action, identity->>'type', NEW.actor_id, identity->>'name', NEW.reason,
      order_history_snapshot(NEW.entity_type, NEW.before_redacted), order_history_snapshot(NEW.entity_type, NEW.after_redacted), NEW.id, NEW.transaction_id, NEW.request_id, NEW.created_at);
  RETURN NULL;
END; $$;
CREATE TRIGGER preserve_order_audit_actions AFTER INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION capture_order_audit_action();

CREATE FUNCTION capture_order_delivery_event() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE order_key UUID; identity JSONB; previous JSONB; entry audit_logs%ROWTYPE;
BEGIN
  SELECT "orderId" INTO order_key FROM deliveries WHERE id = NEW."deliveryId";
  identity := order_history_actor(order_key, NEW.source, NEW."actorId");
  SELECT * INTO entry FROM audit_logs a WHERE a.transaction_id = txid_current()
    AND order_history_order(a.entity_type, a.entity_id) = order_key ORDER BY a.id DESC LIMIT 1;
  IF NEW.status = 'PROVIDER_CONTACT_UPDATED' THEN
    SELECT h."after" INTO previous FROM order_record_history h WHERE h.order_id = order_key AND h.kind = 'EVENT'
      AND h.action = NEW.status AND h."after"->>'providerShipmentId' = NEW.details->>'providerShipmentId' ORDER BY h.id DESC LIMIT 1;
  END IF;
  INSERT INTO order_record_history(order_id, entity_type, entity_id, kind, action, actor_type, actor_id, actor_name, reason, "before", "after", transaction_id, request_id, occurred_at)
    VALUES(order_key, 'delivery', NEW."deliveryId", 'EVENT', NEW.status, identity->>'type', NEW."actorId", identity->>'name',
      COALESCE(entry.reason, LEFT(entry.after_redacted->>'reason',500), LEFT(entry.after_redacted->>'evidence',500)), previous, NEW.details, txid_current(), entry.request_id, NEW."createdAt");
  RETURN NULL;
END; $$;
CREATE CONSTRAINT TRIGGER preserve_order_delivery_events AFTER INSERT ON delivery_events DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION capture_order_delivery_event();

CREATE FUNCTION capture_order_ledger_event() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE identity JSONB;
BEGIN
  identity := order_history_actor(NEW."orderId", CASE WHEN EXISTS(SELECT 1 FROM admin_accounts a WHERE a.id = NEW."actorId") THEN 'admin' ELSE 'system' END, NEW."actorId");
  INSERT INTO order_record_history(order_id, entity_type, entity_id, kind, action, actor_type, actor_id, actor_name, reason, "after", transaction_id, occurred_at)
    VALUES(NEW."orderId", 'escrow', NEW.id, 'LEDGER', 'escrow.' || LOWER(NEW.kind), identity->>'type', NEW."actorId", identity->>'name', NEW.reason,
      order_history_snapshot('escrow', to_jsonb(NEW)), txid_current(), NEW."createdAt");
  RETURN NULL;
END; $$;
CREATE TRIGGER preserve_order_ledger_events AFTER INSERT ON escrow_entries FOR EACH ROW EXECUTE FUNCTION capture_order_ledger_event();

CREATE FUNCTION prevent_order_history_changes() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Operational history and audit logs are append-only'; END; $$;
CREATE TRIGGER order_history_append_only BEFORE UPDATE OR DELETE ON order_record_history FOR EACH ROW EXECUTE FUNCTION prevent_order_history_changes();
CREATE TRIGGER order_history_no_truncate BEFORE TRUNCATE ON order_record_history FOR EACH STATEMENT EXECUTE FUNCTION prevent_order_history_changes();
-- Row-level UPDATE/DELETE on audit_logs is already rejected by the foundation migration's audit_logs_append_only trigger.
CREATE TRIGGER audit_logs_no_truncate BEFORE TRUNCATE ON audit_logs FOR EACH STATEMENT EXECUTE FUNCTION prevent_order_history_changes();
CREATE FUNCTION prevent_direct_order_history_insert() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF pg_trigger_depth() < 2 THEN RAISE EXCEPTION 'Operational history is written only by database capture triggers'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER order_history_database_writes_only BEFORE INSERT ON order_record_history FOR EACH ROW EXECUTE FUNCTION prevent_direct_order_history_insert();
REVOKE UPDATE, DELETE, TRUNCATE ON order_record_history, audit_logs FROM PUBLIC;

COMMIT;
