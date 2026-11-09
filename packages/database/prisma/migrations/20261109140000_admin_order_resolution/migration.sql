BEGIN;
ALTER TABLE trade_orders ADD COLUMN admin_resolution JSONB;
-- Closure is an operational decision, not a fabricated courier receipt or payment.
-- Existing deferred history triggers capture each resolution and all subsequent financial changes.
CREATE FUNCTION preserve_admin_order_resolution() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.admin_resolution IS NOT NULL THEN
    NEW.status := NEW.admin_resolution->>'outcome';
    IF NEW.admin_resolution->>'financialAction' = 'HOLD' THEN NEW.financial_hold := TRUE; END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER order_resolution_status BEFORE UPDATE ON trade_orders FOR EACH ROW EXECUTE FUNCTION preserve_admin_order_resolution();
CREATE FUNCTION preserve_admin_delivery_resolution() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE resolution JSONB; order_key UUID;
BEGIN
  IF TG_TABLE_NAME = 'delivery_parcels' THEN
    SELECT "orderId" INTO order_key FROM deliveries WHERE id = NEW."deliveryId";
  ELSE order_key := NEW."orderId"; END IF;
  SELECT admin_resolution INTO resolution FROM trade_orders WHERE id = order_key;
  IF resolution IS NOT NULL THEN
    NEW.status := CASE WHEN resolution->>'outcome' = 'COMPLETED' THEN 'DELIVERED' ELSE 'CANCELLED' END;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER delivery_resolution_status BEFORE INSERT OR UPDATE ON deliveries FOR EACH ROW EXECUTE FUNCTION preserve_admin_delivery_resolution();
CREATE TRIGGER shipment_resolution_status BEFORE INSERT OR UPDATE ON shipments FOR EACH ROW EXECUTE FUNCTION preserve_admin_delivery_resolution();
CREATE TRIGGER parcel_resolution_status BEFORE INSERT OR UPDATE ON delivery_parcels FOR EACH ROW EXECUTE FUNCTION preserve_admin_delivery_resolution();
COMMIT;
