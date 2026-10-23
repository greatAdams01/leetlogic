import {paymentsOpenApiPaths} from "./payments-openapi.js";
import { identityOpenApiPaths } from "./identity-openapi.js";
import { marketplaceOpenApiPaths } from "./marketplace-openapi.js";
import { deliveryOpenApiPaths } from "./delivery-openapi.js";
const text = (minLength: number, maxLength?: number) => ({ type: "string", minLength, ...(maxLength ? { maxLength } : {}) });
const object = (properties: Record<string, unknown>, required: string[] = []) => ({ type: "object", properties, required });
const phone = { ...text(10, 20), description: "Nigerian phone number, in local or +234 format", example: "+2348012345678" };
const deviceId = { ...text(8, 128), description: "Use the same device ID when requesting and verifying a code", example: "swagger-test-device" };
const code = { type: "string", pattern: "^\\d{6}$", example: "123456" };
const otp = object({ phone, deviceId }, ["phone", "deviceId"]);
const verifyOtp = object({ phone, deviceId, code }, ["phone", "deviceId", "code"]);
const refresh = object({ refreshToken: { ...text(32), description: "Refresh token returned by login" } }, ["refreshToken"]);
const preAuthToken = { ...text(32), description: "Token returned by administrator OTP verification" };
const body = (schema: unknown, example?: unknown) => ({ required: true, content: { "application/json": { schema, ...(example ? { example } : {}) } } });
const caseId = [{ name: "id", in: "path", required: true, description: "Verification case ID", schema: { type: "string", format: "uuid" } }];
const decision = object({ reason: text(3, 500), internalNotes: text(0, 2000) }, ["reason"]);

export const openapi = {
  openapi: "3.1.0", info: { title: "Leetlogic API", version: "0.1.0", description: "Phase One identity, verification and administration API" },
  servers: [{ url: "/v1" }],
  components: { securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } }, schemas: { Error: { type: "object", properties: { error: { type: "object", required: ["code", "message", "requestId"], properties: { code: { type: "string" }, message: { type: "string" }, fieldErrors: { type: "object" }, requestId: { type: "string", format: "uuid" }, retryAfterSeconds: { type: "integer" } } } } } } },
  paths: {
    ...identityOpenApiPaths,
    ...paymentsOpenApiPaths,
    ...deliveryOpenApiPaths,
    ...marketplaceOpenApiPaths,
    "/auth/otp/request": { post: { summary: "Request customer OTP", requestBody: body(otp), responses: { "202": { description: "Accepted" }, "422": { description: "Invalid request" } } } },
    "/auth/otp/verify": { post: { summary: "Verify customer OTP", description: "Creates a buyer account for a new phone number, or signs in an existing customer. Returns access and refresh tokens.", requestBody: body(verifyOtp), responses: { "200": { description: "Authenticated" } } } },
    "/auth/refresh": { post: { summary: "Rotate customer refresh token", requestBody: body(refresh), responses: { "200": { description: "Rotated" } } } },
    "/auth/logout": { post: { summary: "Log out this customer device", security: [{ bearerAuth: [] }], responses: { "204": { description: "Logged out" } } } },
    "/auth/logout-all": { post: { summary: "Log out every customer device", security: [{ bearerAuth: [] }], responses: { "204": { description: "Logged out" } } } },
    "/me": { get: { summary: "Current customer", security: [{ bearerAuth: [] }], responses: { "200": { description: "Current user" } } }, patch: { summary: "Update customer profile", requestBody: body(object({ fullName: text(2, 120), displayName: text(2, 80), email: { type: ["string", "null"], format: "email" } }), { fullName: "Ada Okafor", displayName: "Ada", email: "ada@example.com" }), security: [{ bearerAuth: [] }], responses: { "200": { description: "Updated" } } } },
    "/me/locale": { patch: { summary: "Change preferred locale", requestBody: body(object({ locale: { type: "string", enum: ["en", "pcm", "ig", "ha", "yo"] } }, ["locale"]), { locale: "en" }), security: [{ bearerAuth: [] }], responses: { "200": { description: "Updated" } } } },
    "/me/seller-profile": { post: { summary: "Activate seller capability", requestBody: body(object({ farmName: text(2, 160), farmType: text(2, 80), description: text(0, 1000), state: text(2, 80), lga: text(2, 80), city: text(2, 100) }, ["farmName", "farmType", "state", "lga", "city"]), { farmName: "Ada Farms", farmType: "Crop farming", state: "Lagos", lga: "Epe", city: "Epe" }), security: [{ bearerAuth: [] }], responses: { "201": { description: "Created" } } } },
    "/seller/verification": { get: { summary: "Current farmer verification", security: [{ bearerAuth: [] }], responses: { "200": { description: "Verification" } } } },
    "/seller/verification/documents": { post: { summary: "Add identity document metadata", requestBody: body(object({ documentType: { type: "string", enum: ["NIN_SLIP", "VOTER_CARD", "DRIVERS_LICENSE", "PASSPORT"] }, objectKey: { ...text(8, 500), description: "Key of an existing private storage object; this endpoint does not upload files" }, mimeType: { type: "string", enum: ["image/jpeg", "image/png", "application/pdf"] }, checksumSha256: { type: "string", pattern: "^[a-fA-F0-9]{64}$" }, referenceLastFour: { type: "string", pattern: "^[A-Za-z0-9]{4}$" } }, ["documentType", "objectKey", "mimeType", "checksumSha256"]), { documentType: "NIN_SLIP", objectKey: "verification/example.pdf", mimeType: "application/pdf", checksumSha256: "0".repeat(64) }), security: [{ bearerAuth: [] }], responses: { "201": { description: "Created" } } } },
    "/seller/verification/evidence": { post: { summary: "Add farm or business evidence", requestBody: body({ ...object({ objectKey: text(8, 500), note: text(3, 2000) }), anyOf: [{ required: ["objectKey"] }, { required: ["note"] }] }, { note: "Our farm is located in Epe." }), security: [{ bearerAuth: [] }], responses: { "201": { description: "Created" } } } },
    "/seller/verification/submit": { post: { summary: "Submit verification", requestBody: body(object({ declarationAccepted: { type: "boolean", const: true } }, ["declarationAccepted"]), { declarationAccepted: true }), security: [{ bearerAuth: [] }], responses: { "200": { description: "Submitted" } } } },
    "/admin/auth/login": { post: { summary: "Staff email and password sign-in", requestBody: body(object({ email: { type: "string", format: "email" }, password: text(1, 128), deviceId }, ["email", "password", "deviceId"])), responses: { "200": { description: "Device-bound authenticator challenge" } } } },
    "/admin/auth/setup": { post: { summary: "Consume an email invitation or password reset link", requestBody: body(object({ token: text(32, 128), password: text(12, 128), deviceId }, ["token", "password", "deviceId"])), responses: { "200": { description: "Authenticator challenge" } } } },
    "/admin/auth/password/request-reset": { post: { summary: "Request staff password reset email", requestBody: body(object({ email: { type: "string", format: "email" } }, ["email"])), responses: { "202": { description: "Request accepted" } } } },
    "/admin/auth/totp/enrol": { post: { summary: "Enroll an authenticator", requestBody: body(object({ preAuthToken }, ["preAuthToken"])), responses: { "200": { description: "Enrollment created" } } } },
    "/admin/auth/totp/confirm": { post: { summary: "Confirm TOTP and log in", requestBody: body(object({ preAuthToken, code, deviceId }, ["preAuthToken", "code", "deviceId"])), responses: { "200": { description: "Authenticated" } } } },
    "/admin/auth/totp/step-up": { post: { summary: "Confirm TOTP for a sensitive action", requestBody: body(object({ code }, ["code"])), security: [{ bearerAuth: [] }], responses: { "200": { description: "Confirmed" } } } },
    "/admin/auth/refresh": { post: { summary: "Rotate administrator refresh token", requestBody: body(refresh), responses: { "200": { description: "Rotated" } } } },
    "/admin/auth/logout": { post: { summary: "Log out administrator device", security: [{ bearerAuth: [] }], responses: { "204": { description: "Logged out" } } } },
    "/admin/invitations": { post: { summary: "Invite an administrator", requestBody: body(object({ email: { type: "string", format: "email" }, fullName: text(2, 120), roleCode: { type: "string", enum: ["SUPER_ADMIN", "OPERATIONS_MANAGER", "VERIFICATION_OFFICER", "FINANCE_DISPUTES_OFFICER", "SUPPORT_CONTENT_OFFICER"] } }, ["email", "fullName", "roleCode"])), security: [{ bearerAuth: [] }], responses: { "201": { description: "Invited" } } } },
    "/admin/verifications": { get: { summary: "Verification review queue", security: [{ bearerAuth: [] }], responses: { "200": { description: "Review queue" } } } },
    "/admin/verifications/{id}": { get: { summary: "Read a verification case", parameters: caseId, security: [{ bearerAuth: [] }], responses: { "200": { description: "Verification case" } } } },
    "/admin/verifications/{id}/approve": { post: { summary: "Approve verification", parameters: caseId, requestBody: body(decision, { reason: "Identity and farm evidence verified" }), security: [{ bearerAuth: [] }], responses: { "200": { description: "Approved" } } } },
    "/admin/verifications/{id}/reject": { post: { summary: "Reject verification", parameters: caseId, requestBody: body(decision, { reason: "Identity evidence is unreadable" }), security: [{ bearerAuth: [] }], responses: { "200": { description: "Rejected" } } } },
    "/admin/audit-logs": { get: { summary: "Read audit records", security: [{ bearerAuth: [] }], responses: { "200": { description: "Audit records" } } } },
  },
} as const;
