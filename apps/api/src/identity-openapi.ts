const security = [{ bearerAuth: [] }];
const errors = {
  "401": { description: "Customer session required" },
  "404": { description: "Seller profile, case or identity session not found" },
  "409": { description: "Application locked or identity environment mismatch" },
  "503": { description: "Dojah not configured, disabled, or temporarily unavailable" },
};
export const identityOpenApiPaths = {
  "/seller/verification/identity": {
    get: {
      summary: "Read the authenticated seller's identity verification status",
      security,
      description:
        "Returns required, available, consentVersion, passed, and a sanitized check. Sandbox results do not pass in production.",
      responses: {
        "200": { description: "Current identity state; no raw identity record or media" },
        ...errors,
      },
    },
  },
  "/seller/verification/identity/start": {
    post: {
      summary: "Create or reuse a Dojah hosted identity session",
      security,
      description:
        "Consent is required. The backend binds a random reference to this account's current case. Concurrent starts reuse a pending session. No caller-supplied reference or outcome is accepted.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["consent", "consentVersion"],
              properties: {
                consent: { type: "boolean", const: true },
                consentVersion: { type: "string", const: "dojah-identity-v1" },
              },
            },
          },
        },
      },
      responses: {
        "200": { description: "Sanitized check and Dojah HTTPS URL (null when already verified)" },
        "422": { description: "Consent absent or wrong consent version" },
        "429": { description: "Three starts per case per 24 hours exceeded" },
        ...errors,
      },
    },
  },
  "/seller/verification/identity/refresh": {
    post: {
      summary: "Reconcile the authenticated seller's latest identity session",
      security,
      description:
        "A server-only call to Dojah using the account-bound reference. Outbound reads are throttled to once per 15 seconds. Never accepts client success callbacks as evidence.",
      responses: {
        "200": { description: "Latest sanitized check and passed flag" },
        "502": { description: "Unusable provider response" },
        ...errors,
      },
    },
  },
  "/webhooks/dojah": {
    post: {
      summary: "Receive signed Dojah kyc_widget results",
      security: [],
      description:
        "Requires x-dojah-signature: hex HMAC-SHA256 of the exact raw JSON bytes, using the subscription webhook secret. Unknown references create no records. Duplicate and delayed events cannot regress terminal outcomes.",
      parameters: [
        {
          in: "header",
          name: "x-dojah-signature",
          required: true,
          schema: { type: "string", pattern: "^[a-fA-F0-9]{64}$" },
        },
      ],
      requestBody: {
        required: true,
        content: { "application/json": { schema: { type: "object" } } },
      },
      responses: {
        "200": { description: "Received" },
        "401": { description: "Invalid or missing raw-body signature" },
        "422": { description: "Invalid result or widget mismatch" },
        "503": { description: "Integration unavailable" },
      },
    },
  },
};
