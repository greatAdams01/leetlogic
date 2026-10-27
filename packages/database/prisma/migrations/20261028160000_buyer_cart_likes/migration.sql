CREATE TABLE "cart_items" (
 "userId" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
 "listingId" UUID NOT NULL REFERENCES "listings"("id") ON DELETE RESTRICT,
 "quantity" DECIMAL(18,3) NOT NULL CHECK ("quantity" > 0),
 "unitPriceMinor" BIGINT NOT NULL CHECK ("unitPriceMinor" > 0),
 "updatedAt" TIMESTAMPTZ(6) NOT NULL,
 PRIMARY KEY ("userId", "listingId")
);
CREATE TABLE "liked_listings" (
 "userId" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
 "listingId" UUID NOT NULL REFERENCES "listings"("id") ON DELETE RESTRICT,
 "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY ("userId", "listingId")
);
