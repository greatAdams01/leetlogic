ALTER TABLE addresses
  ADD COLUMN postcode_verified_at timestamptz,
  ADD COLUMN postcode_verification_level integer,
  ADD COLUMN postcode_verification_mode varchar(8),
  ADD CONSTRAINT addresses_postcode_verification_check CHECK (
    (postcode_verified_at IS NULL AND postcode_verification_level IS NULL AND postcode_verification_mode IS NULL)
    OR (postal_code IS NOT NULL AND postcode_verified_at IS NOT NULL
      AND postcode_verification_level IS NOT NULL AND postcode_verification_mode IS NOT NULL
      AND postal_code ~ '^[A-Z]{2}-[0-9]{2}-[A-Z0-9]{3}-[A-Z]{2}-[0-9]{2}$'
      AND postcode_verification_level IN (1, 2) AND postcode_verification_mode IN ('TEST', 'LIVE'))
  );
