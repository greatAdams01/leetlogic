const security = [{ bearerAuth: [] }];
const id = { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } };
const body = (properties: Record<string, unknown>, required: string[] = []) => ({
  required: true,
  content: {
    "application/json": {
      schema: { type: "object", additionalProperties: false, properties, required },
    },
  },
});
const text = { type: "string" },
  uuid = { type: "string", format: "uuid" },
  minor = {
    type: "string",
    pattern: "^[0-9]{1,16}$",
    description: "Exact NGN kobo, never floating point",
  };
const responses = {
  "200": { description: "Current authorized resource" },
  "202": { description: "Durably accepted; not proof of completed money movement" },
  "401": { description: "Session or webhook signature invalid" },
  "403": { description: "Missing permission or recent TOTP" },
  "404": { description: "Not found or not owned" },
  "409": { description: "State, dispute, pricing or idempotency conflict" },
  "503": { description: "Disabled, unconfigured or provider unavailable" },
};
const operation = (summary: string, requestBody?: unknown, parameters: unknown[] = []) => ({
  summary,
  security,
  parameters,
  ...(requestBody ? { requestBody } : {}),
  responses,
});
export const paymentsOpenApiPaths = {
  "/orders/{id}/payments": {
    get: operation(
      "Read own order payments, shipping charges and receipt/release state",
      undefined,
      [id],
    ),
  },
  "/orders/{id}/checkout": {
    post: operation(
      "Create or reuse server-priced hosted checkout; quote and seller readiness required",
      body({ kind: { type: "string", enum: ["ORDER", "DELIVERY_TOPUP"] } }),
      [id],
    ),
  },
  "/orders/{id}/payments/{paymentId}/refresh": {
    post: operation("Buyer requests authoritative payment reconciliation", undefined, [
      id,
      { ...id, name: "paymentId" },
    ]),
  },
  "/financial": {
    get: operation("Read own payment setup, masked banks, earnings and withdrawal reservations"),
  },
  "/financial/payments/{id}": {
    get: operation("Read own payment after hosted checkout return", undefined, [id]),
  },
  "/financial/onboarding": {
    post: operation(
      "Create/reuse owned connected account and secure onboarding link",
      body(
        {
          email: { type: "string", format: "email" },
          firstName: text,
          lastName: text,
          entityType: { type: "string", enum: ["individual", "company"] },
          displayName: text,
        },
        ["email", "firstName", "lastName", "entityType", "displayName"],
      ),
    ),
  },
  "/financial/onboarding/link": { post: operation("Resume secure provider onboarding") },
  "/financial/refresh": {
    post: operation("Verify own provider capabilities and approved bank destinations"),
  },
  "/financial/banks": {
    get: operation("List supported Nigerian banks"),
    post: operation(
      "Verify an owned bank; full number encrypted until provider resolution",
      body({ bankCode: text, accountNumber: { type: "string", pattern: "^[0-9]{10}$" } }, [
        "bankCode",
        "accountNumber",
      ]),
    ),
  },
  "/financial/withdrawals": {
    post: operation(
      "Reserve earnings and submit staff-approved withdrawal with fee consent",
      body({ amountMinor: minor, feeMinor: minor, destinationId: uuid, mutationKey: uuid }, [
        "amountMinor",
        "feeMinor",
        "destinationId",
        "mutationKey",
      ]),
    ),
  },
  "/admin/money": {
    get: operation("payments.read: recent operations, exceptions and balance reconciliation"),
  },
  "/admin/money/reconcile": {
    post: operation("payments.manage: snapshot authoritative platform and shipping balances"),
  },
  "/admin/money/readiness": {
    post: operation("payments.manage: check configured organization identity"),
  },
  "/admin/money/orders/{id}/release": {
    post: operation(
      "Recent TOTP + payments.manage: release only after buyer receipt and resolved disputes",
      body({ reason: text }, ["reason"]),
      [id],
    ),
  },
  "/admin/money/orders/{id}/refund": {
    post: operation(
      "Recent TOTP + payments.manage: queue eligible original-payment refunds",
      body({ reason: text, shippingRefundMinor: minor, destinationId: uuid }, [
        "reason",
        "shippingRefundMinor",
      ]),
      [id],
    ),
  },
  "/admin/money/payments/{id}/refund": {
    post: operation(
      "Recent TOTP + payments.manage: refund unallocated exception receipt",
      body({ reason: text, destinationId: uuid }, ["reason"]),
      [id],
    ),
  },
  "/admin/money/orders/{id}/resolve-hold": {
    post: operation(
      "Recent TOTP + payments.manage: clear only fully resolved financial review",
      body({ reason: text }, ["reason"]),
      [id],
    ),
  },
  ...Object.fromEntries(
    ["approve", "reject", "reconcile"].map((action) => [
      `/admin/money/operations/{id}/${action}`,
      {
        post: operation(
          `Recent TOTP + payments.manage: ${action} original operation`,
          body({ reason: text }, ["reason"]),
          [id],
        ),
      },
    ]),
  ),
  "/admin/money/operations/{id}/link": {
    post: operation(
      "Recent TOTP + payments.manage: verify and link original provider operation after uncertain write",
      body({ reason: text, providerRef: text }, ["reason", "providerRef"]),
      [id],
    ),
  },
  "/admin/money/operations/{id}/refund-bank": {
    post: operation(
      "Recent TOTP + payments.manage: record reviewed original-payer bank evidence",
      body({ reason: text, destinationId: uuid, originalPayerVerified: { const: true } }, [
        "reason",
        "destinationId",
        "originalPayerVerified",
      ]),
      [id],
    ),
  },
  "/webhooks/bachs": {
    post: {
      summary: "Persist verified Bachs event trigger; raw body required",
      description:
        "X-Bachs-Signature-V2 (t/v1) or X-Bachs-Timestamp + X-Bachs-Signature. Five-minute timestamp tolerance, rotated secrets, account ownership, event deduplication. Provider GET determines outcome.",
      responses,
    },
  },
};
