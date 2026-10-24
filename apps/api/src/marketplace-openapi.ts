const auth = [{ bearerAuth: [] }];
const uuid = { type: "string", format: "uuid" };
const body = (schema: unknown) => ({ required: true, content: { "application/json": { schema } } });
const ok = {
  "200": { description: "Success" },
  "401": { description: "Sign in required" },
  "404": { description: "Resource not available" },
  "409": { description: "State or inventory conflict" },
  "422": { description: "Invalid input" },
};
export const marketplaceOpenApiPaths = {
  "/marketplace/categories": {
    get: {
      summary: "Public produce categories",
      responses: { "200": { description: "Categories with locale names" } },
    },
  },
  "/marketplace/listings": {
    get: {
      summary: "Public approved produce listings (up to 50)",
      parameters: [
        { in: "query", name: "search", schema: { type: "string", maxLength: 100 } },
        { in: "query", name: "categoryId", schema: uuid },
      ],
      responses: {
        "200": { description: "Listings; street addresses and private contact details excluded" },
      },
    },
  },
  "/marketplace/listings/{id}": {
    get: {
      summary: "Public active produce detail",
      parameters: [{ in: "path", name: "id", required: true, schema: uuid }],
      responses: ok,
    },
  },
  "/marketplace/my-listings": {
    get: {
      summary: "Current farmer’s listings, including moderation status",
      security: auth,
      responses: ok,
    },
  },
  "/marketplace/my-listings/{id}/inventory": {
    patch: {
      summary:
        "Update owned moderated listing stock or pause/resume sales; reserved quantities remain protected",
      security: auth,
      parameters: [{ in: "path", name: "id", required: true, schema: uuid }],
      requestBody: body({
        type: "object",
        additionalProperties: false,
        minProperties: 1,
        properties: {
          availableQuantity: { type: "string", pattern: "^\\d{1,9}(\\.\\d{1,3})?$" },
          status: { enum: ["ACTIVE", "PAUSED"] },
        },
      }),
      responses: ok,
    },
  },
  "/marketplace/orders": {
    post: {
      summary: "Reserve produce and create an unpaid customer order",
      security: auth,
      parameters: [{ in: "header", name: "Idempotency-Key", required: true, schema: uuid }],
      requestBody: body({
        type: "object",
        required: ["listingId", "quantity"],
        properties: {
          listingId: uuid,
          quantity: { type: "string", pattern: "^\\d{1,9}(\\.\\d{1,3})?$" },
        },
      }),
      responses: { ...ok, "201": { description: "Created, or replay of the same order" } },
    },
  },
  "/marketplace/orders/{id}/cancel": {
    post: {
      summary: "Cancel an owned unpaid order and release its stock once",
      security: auth,
      parameters: [{ in: "path", name: "id", required: true, schema: uuid }],
      responses: ok,
    },
  },
  "/me/addresses": {
    post: {
      summary: "Save a Nigerian address for the signed-in customer",
      security: auth,
      requestBody: body({
        type: "object",
        required: ["label", "state", "lga", "city", "line1"],
        properties: Object.fromEntries(
          ["label", "state", "lga", "city", "line1"].map((k) => [k, { type: "string" }]),
        ),
      }),
      responses: { ...ok, "201": { description: "Address saved" } },
    },
  },
};
