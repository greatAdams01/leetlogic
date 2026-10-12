const uuid = { type: "string", format: "uuid" };
const object = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: "object",
  properties,
  required,
});
const string = { type: "string" };
const contact = object(
  {
    name: string,
    email: { type: "string", format: "email" },
    phone: string,
    address: string,
    state: string,
    country: { const: "NG" },
  },
  ["name", "email", "phone", "address", "state"],
);
const parcel = object(
  {
    weightKg: { type: "number", exclusiveMinimum: 0 },
    length: { type: "number", exclusiveMinimum: 0 },
    width: { type: "number", exclusiveMinimum: 0 },
    height: { type: "number", exclusiveMinimum: 0 },
    pickupDate: { type: "string", format: "date" },
    handling: { enum: ["STANDARD", "PERISHABLE", "COLD_CHAIN", "BULK"] },
  },
  ["weightKg", "length", "width", "height", "pickupDate", "handling"],
);
const reason = { type: "string", minLength: 10, maxLength: 500 };
function operation(summary: string, schema?: unknown, hasId = true) {
  return {
    summary,
    security: [{ bearerAuth: [] }],
    ...(hasId ? { parameters: [{ name: "id", in: "path", required: true, schema: uuid }] } : {}),
    ...(schema
      ? { requestBody: { required: true, content: { "application/json": { schema } } } }
      : {}),
    responses: {
      "200": { description: "Successful response" },
      "201": { description: "Created" },
      "202": { description: "Queued or manual review required" },
      "401": { description: "Sign in required" },
      "403": { description: "Permission or authenticator step-up required" },
      "404": { description: "Resource unavailable to this principal" },
      "409": { description: "State conflict; refresh or reconcile" },
      "422": { description: "Invalid fields" },
      "503": { description: "Provider unavailable or feature disabled" },
    },
  };
}
export const deliveryOpenApiPaths: Record<string, unknown> = {
  "/orders": { get: operation("List customer orders", undefined, false) },
  "/orders/notifications": {
    get: operation("List private delivery notifications", undefined, false),
  },
  "/listing-drafts/capabilities": {
    get: operation("Voice readiness and typed listing capability", undefined, false),
  },
  "/listing-drafts/catalogue": {
    get: operation("Listing categories, units and owned farm addresses", undefined, false),
  },
  "/listing-drafts": {
    post: operation(
      "Save an owned produce draft",
      object(
        {
          title: string,
          description: string,
          quantity: string,
          unitCode: string,
          unitPriceMinor: { type: "string", description: "NGN minor units" },
          categoryId: uuid,
          addressId: uuid,
          photoId: uuid,
          sourceLocale: { enum: ["en", "pcm", "ha", "ig", "yo"] },
        },
        [
          "title",
          "description",
          "quantity",
          "unitCode",
          "unitPriceMinor",
          "categoryId",
          "addressId",
          "sourceLocale",
        ],
      ),
      false,
    ),
  },
  "/listing-drafts/{id}": { get: operation("Read owned draft") },
  "/listing-drafts/{id}/submit": {
    post: operation(
      "Confirm and submit draft for moderation",
      object({ confirmed: { const: true } }, ["confirmed"]),
    ),
  },
  "/translations/{resource}/{id}": {
    get: {
      ...operation("Translate authorized listing or customer-visible support message"),
      parameters: [
        {
          name: "resource",
          in: "path",
          required: true,
          schema: { enum: ["listings", "messages"] },
        },
        { name: "id", in: "path", required: true, schema: uuid },
        {
          name: "locale",
          in: "query",
          required: true,
          schema: { enum: ["en", "pcm", "ha", "ig", "yo"] },
        },
      ],
    },
  },
  "/webhooks/shipbubble": {
    post: {
      summary: "Schedule an authenticated shipment read; payload cannot change state",
      requestBody: { content: { "application/json": { schema: object({ order_id: string }) } } },
      responses: { "202": { description: "Accepted without revealing shipment existence" } },
    },
  },
};
for (const prefix of ["/orders", "/admin/delivery-orders"]) {
  const base = `${prefix}/{id}/delivery`;
  deliveryOpenApiPaths[base] = {
    get: operation("Read authorized delivery costs, quotes and tracking events"),
  };
  deliveryOpenApiPaths[`${base}/quotes`] = {
    post: operation(
      "Validate addresses and obtain eligible pickup quotes; dimensions in cm",
      object({ pickup: contact, destination: contact, parcel }, [
        "pickup",
        "destination",
        "parcel",
      ]),
    ),
  };
  deliveryOpenApiPaths[`${base}/select`] = {
    post: operation(
      "Select a current saved delivery quote",
      object({ quoteId: uuid }, ["quoteId"]),
    ),
  };
  for (const action of ["book", "refresh-quote"])
    deliveryOpenApiPaths[`${base}/${action}`] = {
      post: operation(
        action === "book"
          ? "Queue funded and separately paid delivery"
          : "Refresh same courier quote without silently changing a paid amount",
        object({}),
      ),
    };
}
deliveryOpenApiPaths["/orders/{id}/delivery/confirm"] = {
  post: operation("Buyer confirms receipt; escrow is not released automatically", object({})),
};
const staff = "/admin/delivery-orders/{id}/delivery";
for (const [action, summary, schema] of [
  [
    "payment",
    "Confirm verified external shipping payment with step-up",
    object({ amountMinor: string, reference: string }, ["amountMinor", "reference"]),
  ],
  ["reconcile", "Schedule carrier tracking reconciliation", object({})],
  [
    "link",
    "Link an uncertain booking after verified shipment matching and step-up",
    object({ providerShipmentId: string, reason }, ["providerShipmentId", "reason"]),
  ],
  [
    "cancel",
    "Request cancellation with step-up; does not complete a refund",
    object({ reason }, ["reason"]),
  ],
  [
    "manual-dispatch",
    "Record confirmed manual carrier arrangement for a funded order",
    object({ carrier: string, trackingRef: string, reason }, ["carrier", "trackingRef", "reason"]),
  ],
  [
    "manual-status",
    "Update manual dispatch with evidence; does not confirm customer receipt",
    object(
      {
        status: {
          enum: [
            "PICKED_UP",
            "IN_TRANSIT",
            "DELIVERED",
            "FAILED_ATTEMPT",
            "RETURNING",
            "RETURNED",
            "CANCELLED",
          ],
        },
        evidence: reason,
      },
      ["status", "evidence"],
    ),
  ],
] as const)
  deliveryOpenApiPaths[`${staff}/${action}`] = { post: operation(summary, schema) };
