-- Paid shipping stays a historical receipt when a refreshed quote changes price.
-- A shortfall requires an explicit buyer top-up; a surplus remains refundable credit.
ALTER TABLE deliveries DROP CONSTRAINT delivery_amounts;
ALTER TABLE deliveries ADD CONSTRAINT delivery_amounts CHECK ("shippingMinor" >= 0 AND "paidMinor" >= 0);
