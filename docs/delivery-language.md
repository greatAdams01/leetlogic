# Delivery and language systems

## Implementation and launch status

These capabilities extend the existing Next.js app and Express API. No new app is created.

Implemented: Shipbubble HTTP adapter; optional server-side NIPOST NDAPS postcode checks and saved addresses; delivery quote/address snapshots; durable booking and tracking work; manual dispatch; delivery payment records separate from produce escrow; append-only tracking events; in-app notifications; authenticated customer/staff delivery APIs; language selection; locale-aware FAQs; published UI translation overrides; Azure translation cache and monthly admission control; typed produce drafts with private photo upload and mandatory confirmation/moderation.

**Not ready for a voice-enabled production launch:** no free hosted Igbo speech-to-text service has been verified and no consented recording corpus has been evaluated. Voice is hard-disabled in `/v1/listing-drafts/capabilities`. There is no recording upload endpoint, paid speech fallback, self-hosted model, or image identification. Typed listing entry remains available.

Live provider calls have not been verified with project credentials. Interface translations are initial candidates, not a claim of native-speaker review. Missing keys fall back to English; marketing body copy remains English. Before enabling a fully localized customer launch, reviewers must approve and publish the remaining authentication, listing, delivery, error, and notification strings. The initial customer screens display server error messages in English as a fallback.

## Customer and staff flows

- `/account`: existing customer phone OTP login, language preference, order links and delivery notifications. Customer tokens are held in HttpOnly cookies by `/api/customer/[...path]`; browser JSON never returns credentials. Cookie-based writes require the same origin. Mobile clients can use bearer-authenticated backend endpoints directly.
- `/sell`: typed listing fields and JPEG/PNG photo capture/upload, editable fields before creating a review draft, explicit confirmation and submission to `PENDING_REVIEW`. Requires a verified farmer profile, a catalogue category/unit and the farmer's existing saved address. Existing onboarding/verification APIs remain the prerequisite; no automatic approval is added.
- `/orders/{id}`: courier-service quote selection, separate produce and delivery costs, Bachs hosted checkout, delivery events, on-demand description translation, and buyer receipt confirmation. See [payments and delivery](payments-and-delivery.md) for financial setup and settlement safeguards.
- Admin order detail contains delivery operations. Confirmed historical external shipping payments, cancellation, and linking uncertain bookings require authenticator step-up. Supported checkout does not require staff fee approval; unsupported requests return errors rather than automatically creating manual-review deliveries. Existing manual arrangements can still record outside-carrier dispatch/evidence and require buyer receipt confirmation before escrow release.

## Delivery configuration and behavior

Start with `DELIVERY_ENABLED=false`. Configure `SHIPBUBBLE_API_KEY`, `SHIPBUBBLE_MODE=test`, `SHIPBUBBLE_TEST_KEY_CONFIRMED=true` only after verifying that the dashboard supplied a test key, and the confirmed `SHIPBUBBLE_CATEGORY_ID`. Approve local category UUIDs in `DELIVERY_ALLOWED_CATEGORIES` after confirming commodities with the carrier. Requests are eligible in all 36 Nigerian states and the FCT; actual provider quotations determine route availability, subject to the listing's shipping scope. The former state allowlist is no longer used. `DELIVERY_MAX_WEIGHT_KG` defaults to 1000 kg per parcel as an operational ceiling, not a vehicle-capacity guarantee; explicit environment values override it. Up to 20 identical STANDARD parcels can be quoted separately and offered as one courier-service option with an exact summed fee. Cold-chain, bulk, explicitly perishable loads and structured special handling are unsupported by automatic checkout.

The adapter uses `https://api.shipbubble.com/v1`; mode selects the credential policy, not an invented sandbox hostname. Address validation precedes rates. Only pickup services are offered; prices use the provider's VAT-inclusive total, converted to NGN minor units. Credentials and provider rate tokens are never sent to the browser.

Quotes have a conservative local 15-minute lifetime, not a claim of guaranteed provider validity. The server derives physical requirements from the saved order snapshot and pickup from farmer-owned saved addresses. Destination/date changes invalidate quotations and payable totals before the provider request; active checkout attempts block delivery changes. Selection, checkout initialization/resume, confirmed collection and booking revalidate the saved shipment and server-calculated amounts. The refresh endpoint obtains fresh tokens for the same courier/service and saved inputs. Bachs-funded increases require a separate buyer-approved shipping top-up; decreases remain refundable shipping credit. Historical external payment discrepancies require staff reconciliation. `DELIVERY_LIVE_BOOKINGS=true` is additionally required for live booking.

A PostgreSQL-backed queue is consumed every 15 seconds by the API process. Workers claim jobs with leases and split bookings claim each parcel before buying its label. A booking timeout or crash creates `BOOKING_UNCERTAIN`; no automatic retry spends the provider wallet twice. Staff locate and link the original shipment or uncertain parcel; matching provider addresses, courier and shipping price are required, and shipment IDs cannot be reused across orders/parcels. An exact, fully recorded split can finish local shipment/accounting finalization even after quote expiry, without another label purchase. Otherwise leave ambiguity blocked and investigate with the provider. There is deliberately no blind retry/reset button.

Tracking reconciles every 15 minutes. Duplicate and backward events do not regress ordinary shipment status; split shipments can report a partial-return exception. Failed attempts may resume transit; delivered shipments can progress to returns. Cancellation is attempted once per label and tracked afterward; timeout does not trigger another cancellation. All parcels must be delivered before buyer confirmation, and mixed delivered/cancelled/returned results block release. Carrier confirmation does not itself mark customer receipt, release escrow, or report a refund. Refunds require a confirmed eligible terminal delivery or proof that booking never started; settlement operations block new bookings.

Webhook: register `/v1/webhooks/shipbubble`. No signature contract was established from the official reference reviewed, so unauthenticated payloads only schedule a throttled read of a known shipment through the authenticated Shipbubble API. They cannot change status. Unknown references are ignored, and public responses do not disclose whether a reference exists.

Authoritative references: https://docs.shipbubble.com/get-started and https://github.com/Shipbubble/node-sdk/blob/main/openapi.yaml. Verify account-specific commodity coverage, restrictions, credentials and provider payloads before pilot activation.

### Pricing readiness and address validation

Quote requests return `503 DELIVERY_CONFIGURATION_REQUIRED` before changing an order if the provider key, confirmed key mode, provider category ID, or approved product-category list is missing. The diagnostic log names the missing settings; customer responses do not expose configuration details. Unsupported shipments/routes return actionable errors, and empty provider results return `NO_DELIVERY_OPTIONS`; neither automatically falls back to staff review.

Shipbubble address validation receives the full address including state and Nigeria, plus confirmed latitude/longitude when available. Buyers retain the pin from their selected saved delivery address; changing the street address or state clears that pin. Provider address rejections return `PICKUP_ADDRESS_INVALID` or `DESTINATION_ADDRESS_INVALID` so the correct party can fix the location.

Optional `NIPOST_API_KEY` enables NDAPS postcode checks, not courier coverage or map-pin verification. Manual and legacy six-digit addresses remain usable. Saved postcodes, landmarks and additional directions travel with the authorized delivery snapshot and are included in Shipbubble delivery instructions. See [NIPOST setup, lookup limits, proofs and migration rollout](nipost-addresses.md).

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
- `POST /v1/orders/:id/delivery/quotes`: pickup/destination `{name,email,phone,address,state,country:"NG",addressId?,postalCode?,instructions?,latitude?,longitude?}`, parcel `{pickupDate}`. Older clients may still send measurements, but the server ignores them and derives the shipment from saved packing. Pickup must match the farmer's saved address; saved destination references must belong to the buyer, with canonical location fields resolved on the server.
- `POST .../collection`: select farmer pickup with no shipping fee. `POST .../pickup`: farmer-only `{addressId}` for an owned saved pickup location before checkout.
- `POST .../select`: `{quoteId}`; `POST .../refresh-quote`, `POST .../book`, `POST .../confirm`.
- `GET /v1/translations/{listings|messages}/:id?locale=ig`: `{text,original,translated,reason?}`.
- `GET /v1/listing-drafts/capabilities`, `GET .../catalogue`, `POST /v1/listing-drafts`, `GET .../:id`, `POST .../:id/submit`: `{confirmed:true}`.
- `POST /v1/listing-photos`: raw JPEG/PNG, up to 10 MB; `GET .../:id`. Unpublished photos require owner access. Staff can view submitted photos through `GET /v1/admin/produce-photos/:id` with catalogue permission.

Staff endpoints use `/v1/admin/delivery-orders/:id/delivery` and permission checks:

- Shared read/quotes/select/refresh/book operations.
- `POST .../payment`: `{amountMinor,reference}` for a verified external delivery payment.
- `POST .../reconcile`; `POST .../link`: `{providerShipmentId,reason}` for an uncertain single-parcel booking. `POST .../parcels/:parcelId/link` uses the same body for an uncertain split parcel.
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

Additive migrations preserve existing records: `20261011000100_delivery_language`, `20261011000200_delivery_notifications`, `20261028140000_listing_packaging`, `20261029100000_delivery_quote_quality`, `20261031180000_split_delivery_parcels`, and `20261031200000_ndaps_address_verification`. Apply with `pnpm --filter @leetlogic/database exec prisma migrate deploy` and regenerate the client with `pnpm db:generate`. Coordinate API, worker and client deployment; see [shipping checkout and provider boundaries](shipping-checkout.md).

Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`. From `apps/api`, run `node --env-file=../../.env scripts/test-admin.mjs` and `node --env-file=../../.env scripts/test-delivery.mjs`. The latter runs delivery and address suites sequentially in a fresh `leetlogic_delivery_integration_<suffix>` schema and Redis database 14. It inherits `PRIVATE_STORAGE_ROOT` if set; otherwise storage is `apps/api/.private-objects/delivery-tests`. Use a dedicated local test directory, never production storage. Schemas are retained for diagnostics; keep Redis 14 dedicated and do not run concurrent invocations sharing it. Payment integrations use fresh `leetlogic_payments_integration_<suffix>` schemas and Redis 13; admin tests retain their separate schema/Redis 15.

Tests use simulated provider responses and real PostgreSQL/Redis, not NIPOST credits, live courier booking or Azure billing. Before pilot activation verify addresses/rates, booking, cancellation, tracking and callbacks with Shipbubble's dashboard test key, verify NDAPS sandbox/manual fallback and proof expiry, and verify each Azure language against approved farm vocabulary.

Monitor persisted delivery `failureCode`, booking age and `lastSyncedAt`; `translation_usage` tracks the cap, and `content_translations` records successful cache entries. Application logs identify failed operation types/IDs without private content. Customer cookie refresh requests are coalesced within a Next.js process; a multi-instance rollout must provide sticky sessions or shared refresh coordination before relying on parallel cookie refreshes. Existing infrastructure still needs production alert routing, backups and durable private photo storage. Feature switches default off. No live booking or paid translation configuration was enabled by this implementation.
