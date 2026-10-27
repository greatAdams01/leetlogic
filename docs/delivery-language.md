# Delivery and language systems

## Implementation and launch status

These capabilities extend the existing Next.js app and Express API. No new app is created.

Implemented: Shipbubble HTTP adapter; delivery quote/address snapshots; durable booking and tracking work; manual dispatch; delivery payment records separate from produce escrow; append-only tracking events; in-app notifications; authenticated customer/staff delivery APIs; language selection; locale-aware FAQs; published UI translation overrides; Azure translation cache and monthly admission control; typed produce drafts with private photo upload and mandatory confirmation/moderation.

**Not ready for a voice-enabled production launch:** no free hosted Igbo speech-to-text service has been verified and no consented recording corpus has been evaluated. Voice is hard-disabled in `/v1/listing-drafts/capabilities`. There is no recording upload endpoint, paid speech fallback, self-hosted model, or image identification. Typed listing entry remains available.

Live provider calls have not been verified with project credentials. Interface translations are initial candidates, not a claim of native-speaker review. Missing keys fall back to English; marketing body copy remains English. Before enabling a fully localized customer launch, reviewers must approve and publish the remaining authentication, listing, delivery, error, and notification strings. The initial customer screens display server error messages in English as a fallback.

## Customer and staff flows

- `/account`: existing customer phone OTP login, language preference, order links and delivery notifications. Customer tokens are held in HttpOnly cookies by `/api/customer/[...path]`; browser JSON never returns credentials. Cookie-based writes require the same origin. Mobile clients can use bearer-authenticated backend endpoints directly.
- `/sell`: typed listing fields and JPEG/PNG photo capture/upload, editable fields before creating a review draft, explicit confirmation and submission to `PENDING_REVIEW`. Requires a verified farmer profile, a catalogue category/unit and the farmer's existing saved address. Existing onboarding/verification APIs remain the prerequisite; no automatic approval is added.
- `/orders/{id}`: quote selection, separate produce and delivery costs, delivery events, on-demand description translation, and buyer receipt confirmation. This page does not collect money; payment integrations remain outside this change.
- Admin order detail contains delivery operations. Confirmed external shipping payments, cancellation, and linking uncertain bookings require authenticator step-up. Unsupported parcels enter manual review; staff arrange a carrier outside Shipbubble and then record dispatch/evidence. Manual delivery also requires buyer receipt confirmation before escrow release.

## Delivery configuration and behavior

Start with `DELIVERY_ENABLED=false`. Configure `SHIPBUBBLE_API_KEY`, `SHIPBUBBLE_MODE=test`, `SHIPBUBBLE_TEST_KEY_CONFIRMED=true` only after verifying that the dashboard supplied a test key, and the confirmed `SHIPBUBBLE_CATEGORY_ID`. Approve local category UUIDs in `DELIVERY_ALLOWED_CATEGORIES` and Nigerian state names in `DELIVERY_ALLOWED_STATES` only after carrier coverage and commodities are confirmed. The default maximum parcel weight is 20 kg. Cold-chain, bulk and explicitly perishable loads always require manual review.

The adapter uses `https://api.shipbubble.com/v1`; mode selects the credential policy, not an invented sandbox hostname. Address validation precedes rates. Only pickup services are offered; prices use the provider's VAT-inclusive total, converted to NGN minor units. Credentials and provider rate tokens are never sent to the browser.

Quotes have a conservative local 15-minute lifetime, not a claim of guaranteed provider validity. Before funding, an existing delivery selection must have a current quote. Booking also validates quote freshness and separate shipping payment. The refresh endpoint obtains a fresh token for the same courier and inputs. Paid price changes require staff/external payment reconciliation; they are never silently charged. `DELIVERY_LIVE_BOOKINGS=true` is additionally required for live booking.

A PostgreSQL-backed queue is consumed every 15 seconds by the API process. Workers claim jobs with leases. A booking timeout or crash creates `BOOKING_UNCERTAIN`; no automatic retry spends the provider wallet twice. Staff locate the existing shipment and link it; matching provider addresses, courier and shipping price are required. If the provider cannot establish the result, leave it blocked and investigate with the provider. There is deliberately no blind retry/reset button.

Tracking reconciles every 15 minutes. Duplicate and backward events do not regress status. Failed attempts may resume transit; delivered shipments can progress to returns. Cancellation is attempted once and tracked afterward; timeout does not trigger a second cancellation. Delivery confirmation from the carrier does not itself mark customer receipt, release escrow, or report an external refund. Produce escrow refunds are blocked while an integrated delivery remains active.

Webhook: register `/v1/webhooks/shipbubble`. No signature contract was established from the official reference reviewed, so unauthenticated payloads only schedule a throttled read of a known shipment through the authenticated Shipbubble API. They cannot change status. Unknown references are ignored, and public responses do not disclose whether a reference exists.

Authoritative references: https://docs.shipbubble.com/get-started and https://github.com/Shipbubble/node-sdk/blob/main/openapi.yaml. Verify account-specific commodity coverage, restrictions, credentials and provider payloads before pilot activation.

### Pricing readiness and address validation

Quote requests return `503 DELIVERY_CONFIGURATION_REQUIRED` before changing an order if the provider key, confirmed key mode, provider category ID, or either delivery allowlist is missing. The diagnostic log names the missing settings; customer responses do not expose configuration details. Only explicitly unsupported parcels or routes enter manual review.

Shipbubble address validation receives the full address including state and Nigeria, plus confirmed latitude/longitude when available. Buyers retain the pin from their selected saved delivery address; changing the street address or state clears that pin. Provider address rejections return `PICKUP_ADDRESS_INVALID` or `DESTINATION_ADDRESS_INVALID` so the correct party can fix the location.

Sandbox verification on 27 October 2026 returned courier quotes for the saved standard 10 kg Rivers-to-Rivers processed-produce shipment using Shipbubble category `24032950` (Dry food and supplements). This verifies sandbox pricing, not live booking or live charges. Local credentials and route configuration remain in the ignored `.env`; other environments need their own configuration. An order cancelled by reservation expiry must be placed again; the quote diagnostic does not revive orders or book shipments.

## Language configuration and behavior

Configure a **dedicated Azure Translator F0 resource** and set `AZURE_TRANSLATOR_KEY`, `AZURE_TRANSLATOR_REGION`, and `TRANSLATION_ENABLED=true`. Do not switch the Azure resource to a paid tier. Azure's free monthly limit is two million characters; the app defaults to reserving at most 1.9 million as headroom, configurable only up to two million. Other consumers of that Azure resource are outside our usage counter, hence the dedicated-resource requirement.

Dynamic translation supports `en`, `ha`, `ig`, `yo`. Pidgin interface text is stored locally and can be reviewed through admin; dynamic Pidgin translation returns original content with an unsupported-language reason. Translation has no conversational assistant, voice recognition or speech synthesis behavior.

Interface dictionaries ship with the app, published admin messages override them, and missing values fall back to English. Published overrides are fetched without HTTP caching on language changes, focus and every minute while mounted. Language choice persists in a guest cookie and in authenticated customer preferences.

Dynamic content is translated on demand and cached in PostgreSQL by resource, source-content hash, source language and target language. Edits change the hash and cannot serve an old translation. Redis locks deduplicate concurrent translation requests. The monthly reservation update is atomic across processes. Failed provider requests conservatively consume reserved budget because billing may already have occurred. Exhaustion/outages return original text. Numeric values, units, placeholders, URLs and order references are protected; corrupted placeholders reject the translation.

Private messages are authorized before cache lookup and internal support notes are never customer-translatable. New support messages have source-language metadata; historical messages default to English and need correction if they were authored in another language. There is no public arbitrary-text proxy.

## API reference

Customer bearer authentication is required except for published content and public active produce photos:

- `GET /v1/orders` and `GET /v1/orders/notifications`
- `GET /v1/orders/:id/delivery`
- `POST /v1/orders/:id/delivery/quotes`: pickup/destination `{name,email,phone,address,state,country:"NG"}`, parcel `{weightKg,length,width,height,pickupDate,handling}`; dimensions in cm.
- `POST .../select`: `{quoteId}`; `POST .../refresh-quote`, `POST .../book`, `POST .../confirm`.
- `GET /v1/translations/{listings|messages}/:id?locale=ig`: `{text,original,translated,reason?}`.
- `GET /v1/listing-drafts/capabilities`, `GET .../catalogue`, `POST /v1/listing-drafts`, `GET .../:id`, `POST .../:id/submit`: `{confirmed:true}`.
- `POST /v1/listing-photos`: raw JPEG/PNG, up to 10 MB; `GET .../:id`. Unpublished photos require owner access. Staff can view submitted photos through `GET /v1/admin/produce-photos/:id` with catalogue permission.

Staff endpoints use `/v1/admin/delivery-orders/:id/delivery` and permission checks:

- Shared read/quotes/select/refresh/book operations.
- `POST .../payment`: `{amountMinor,reference}` for a verified external delivery payment.
- `POST .../reconcile`; `POST .../link`: `{providerShipmentId,reason}`.
- `POST .../cancel`: `{reason}`. No external refund is implied.
- `POST .../manual-dispatch`: `{carrier,trackingRef,reason}`.
- `POST .../manual-status`: `{status,evidence}`.

Monetary JSON values are decimal strings in NGN minor units. Resource UUIDs are validated, and order reads are restricted to buyer, farmer, or permitted staff. The delivery timeline is the durable in-app notification source; outbound SMS/email/push delivery is not added here.

## Voice launch gate

Do not enable voice until all of these are satisfied:

1. A hosted API explicitly covers Igbo transcription, permits production/commercial use under an ongoing free allocation, and has documented quotas/data handling. Signup credits alone do not satisfy the free-service requirement.
2. At least 50 consented recordings cover multiple speakers, accents, farm vocabulary, noise, quantities, units and prices. Numeric field transcription accuracy is at least 95%; native speakers approve usability.
3. Implement guided product/quantity/unit/price/location recordings, each at most 30 seconds, validated by actual format and decoded duration. Never trust only the filename or a client-reported duration.
4. Transcription jobs produce editable drafts; ambiguous fields remain blank. Require field confirmation before moderation submission. Delete private recordings after processing or within 24 hours of failure.
5. Test microphone denial, upload interruption, transcription failure, retention cleanup, access control and duplicate job submission. No recording or transcript content in logs.

The current typed draft/photo flow is the reusable foundation for that later milestone. The voice-enabled launch remains blocked, rather than pretending translation is speech recognition.

## Verification and operations

Two additive migrations preserve existing records: `20261011000100_delivery_language` and `20261011000200_delivery_notifications`. Apply with `pnpm --filter @leetlogic/database exec prisma migrate deploy` and regenerate the client with `pnpm db:generate`.

Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`. From `apps/api`, run `node --env-file=../../.env scripts/test-admin.mjs` and `node --env-file=../../.env scripts/test-delivery.mjs`. The latter uses schema `leetlogic_delivery_integration`, Redis database 14 and `/tmp/leetlogic-delivery-tests`; keep Redis 14 dedicated to this suite. Admin tests use their existing separate schema/Redis 15.

Tests use simulated provider responses and real PostgreSQL/Redis, not live courier booking or Azure billing. Before pilot activation verify addresses/rates, booking, cancellation, tracking and callbacks with Shipbubble's dashboard test key, and verify each Azure language against approved farm vocabulary.

Monitor persisted delivery `failureCode`, booking age and `lastSyncedAt`; `translation_usage` tracks the cap, and `content_translations` records successful cache entries. Application logs identify failed operation types/IDs without private content. Customer cookie refresh requests are coalesced within a Next.js process; a multi-instance rollout must provide sticky sessions or shared refresh coordination before relying on parallel cookie refreshes. Existing infrastructure still needs production alert routing, backups and durable private photo storage. Feature switches default off. No live booking or paid translation configuration was enabled by this implementation.
