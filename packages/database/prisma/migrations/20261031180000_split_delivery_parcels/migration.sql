CREATE TABLE delivery_parcels (
 id uuid PRIMARY KEY, "deliveryId" uuid NOT NULL REFERENCES deliveries(id) ON DELETE RESTRICT,
 "quoteId" uuid NOT NULL REFERENCES delivery_quotes(id) ON DELETE RESTRICT, "parcelIndex" integer NOT NULL,
 "requestToken" text NOT NULL, "serviceCode" varchar(120) NOT NULL, "courierId" varchar(120) NOT NULL,
 "amountMinor" bigint NOT NULL, "walletMinor" bigint NOT NULL, "actualMinor" bigint,
 "providerShipmentId" varchar(160) UNIQUE, "trackingUrl" text, status varchar(40) NOT NULL DEFAULT 'PENDING',
 "failureCode" varchar(80), "cancelAttemptedAt" timestamptz, "createdAt" timestamptz NOT NULL DEFAULT now(),
 "updatedAt" timestamptz NOT NULL DEFAULT now(), UNIQUE ("deliveryId", "parcelIndex"),
 CHECK ("parcelIndex" >= 0 AND "amountMinor" >= 0 AND "walletMinor" >= 0)
);
