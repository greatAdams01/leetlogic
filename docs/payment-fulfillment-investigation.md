# Payment confirmation and pickup investigation

Investigation date: 2 November 2026. The working tree was clean before implementation. No existing changes were discarded and no commits were created.

## 1. Root cause and recovered payment

The local database was missing the existing `20261031210000_payment_confirmation_retries` migration. Its payment verification fields (`confirmedAt`, check/retry metadata) and webhook processing fields (`attempts`, `processedAt`) were referenced by current application code but absent from PostgreSQL. Reads failed with Prisma `P2022`. The generated Prisma client was also stale. Regenerated it and applied the existing additive migration successfully; no new migration was needed.

The configured Bachs sandbox webhook destination was enabled and subscribed to collection/checkout events. Its ngrok tunnel returned HTTP 502 / `ERR_NGROK_8012`: the agent could not connect to the API at localhost:3000. Started the API with its development payment worker. The same public URL now reaches the signature validator; unsigned requests receive HTTP 400 `INVALID_WEBHOOK_SIGNATURE`. `/health/ready` returns ready. Keep that process and ngrok running; production requires supervised API and payment-worker processes.

Read the actual sandbox checkout through Bachs: attempt `3df63179-dea7-4487-a2b6-9914296c12a2` was completed, while its local order had already been cancelled. Reconciled through the existing authoritative verification service. The receipt is now confirmed and preserved as `EXCEPTION` / `PAYMENT_ORDER_CHANGED`, with the provider completion timestamp. It requires the existing staff financial-review/refund flow. It was not refunded, restored to sellable stock, or dispatched. A cancelled order cannot safely be resurrected automatically after its reservation has been released.

Also fixed a missing `queueBooking` import used by existing delivery recovery routes. Frontend gaps compounded these operational failures: entering an order only read local payment state, and the hosted-payment return page performed one verification without subsequent retries.

## 2. Webhook handling

Bachs creates the actual hosted checkout links. This integration does not verify them with a separate underlying payment processor.

The existing `/v1/webhooks/bachs` handler verifies HMAC-SHA256 against the raw body, checks timestamp freshness and organization ownership, and supports rotating secrets. It durably records an event ID, body hash, resource/account references and processing state before returning HTTP 202. Duplicate event IDs reuse the same inbox entry.

Checkout (`checkout.completed`, `checkout.expired`) and collection (`collection.succeeded`, `collection.failed`, `collection.underpaid`) triggers cause account-bound provider checkout/payment reads. Currency, principal, explicit processing fee, checkout/payment reference, order metadata and completion time are validated. The handler never funds an order from webhook amounts or a redirect. Refund, payout, transfer, dispute, account and capability events use existing reconciliation paths; unsupported event families are ignored.

Funding runs under an order row lock in one database transaction: receipt, balanced journals, order funding, escrow entry, farmer notification outbox and delivery milestones commit together. Duplicate receipt verification cannot duplicate funding or notifications. Failed processing is retained with sanitized error codes and exponential retry. Delivery booking is queued after commit and recovered from durable delivery state after interruption.

## 3. Payment reconciliation and buyer experience

Webhook processing, authenticated buyer refresh and the background worker reuse `reconcilePayment`. Existing background checks include unresolved, expired and failed sessions so closing the browser or missing a webhook does not abandon a receipt. Provider failures retain retry metadata and backoff; uncertain provider writes are never blindly repeated.

Mobile and web order payment panels now verify pending payments on entry as well as foreground/focus return, and retry at 30-second intervals. The mobile panel retains the manual Check Payment action and displays a confirming message. The hosted return page retries delayed/provider-unavailable verification, clears its timer on unmount and stops after confirmation. Payment responses now expose confirmation metadata so a verified receipt awaiting financial review remains visibly confirmed. Order refresh follows newly confirmed funding.

## 4. Farmer notifications

The existing unique paid-order outbox entry is written in the funding transaction and delivered through the existing in-app inbox and Expo push worker. Repeated reconciliation does not create another entry. Push errors retry without rolling back payment; push acceptance does not prove device display. No new SMS provider was introduced.

Farmer order lists remain restricted to that farmer's funded orders. Each marketplace order has one listing/farmer; multi-farmer baskets remain separate orders, quotes and payment contexts. The existing order detail provides quantity, selling packaging and saved parcel measurements. Cancelled/unallocated exception receipts do not create misleading farmer fulfillment alerts.

Seller mobile Home, order lists, and delivery details now refresh automatically at 30-second intervals and on foreground return. Web account orders/inbox and delivery details refresh automatically while visible and on focus. These reads use the same persisted records as buyer tracking.

## 5. Courier and pickup communication

Selections are courier-service quotations, not identified individual riders or independently certified vehicles. Existing quotation and booking validation checks the saved shipment, quote expiry, exact parcel fees, funds, settlement locks, supported produce/handling and provider service availability. A provider service can fail or become unavailable after selection; this cannot be prevented by a preflight read alone.

Shipbubble address validation receives the farmer's saved pickup name, phone, email and address. Quote requests carry the validated pickup address, date and saved pickup directions; booking purchases the selected service using the existing quote token. This is the supported route by which the courier receives pickup information. The adapter does not expose a verified individual rider phone, chat endpoint or precise rider-arrival window. No rider identity, direct-call number or messaging capability was invented. Existing tracking links remain available, and the interface explains courier coordination and the support fallback. Actual courier contact/arrival remains provider-managed and needs a real provider pilot.

Added farmer-only `POST /v1/orders/:id/delivery/ready`. It requires a funded, non-held order in an eligible pre-pickup state, uses the order lock and a unique delivery-event key, and writes buyer/farmer notifications through the existing delivery-event system. Buttons are available on mobile and web. Buyer collection advances from `PICKUP_PREPARING` to `PICKUP_READY`; courier orders record `READY_FOR_PICKUP` as a separate milestone without overwriting provider shipment status or causing another booking. Repeating readiness does not duplicate alerts or regress a shipment already in transit.

Readiness is currently an in-app milestone. The reviewed Shipbubble integration has no readiness/message API, so this does not send an invented readiness command to a rider. Courier pickup contact failures require tracking/provider support or staff recovery.

## 6. Fulfillment tracking and recovery

Payment confirmation and delivery fulfillment remain separate. Funding records Payment confirmed and Preparing for pickup milestones. Successful courier booking records BOOKED (Courier booked); it does not claim a named rider has been assigned. Farmer readiness records Ready for pickup. Verified provider tracking advances Picked up, In transit and Delivered. Existing transition rules ignore stale regressions and preserve special return/failure transitions. Split shipments require complete parcel evidence before buyer receipt/release.

Existing booking claims, leases and saved provider references prevent blind duplicate purchases. A failure after funding preserves payment, records BOOKING_BLOCKED or BOOKING_UNCERTAIN separately and exposes the failure. Recoverable provider/wallet/configuration failures retry; stale quotations require quote refresh and any buyer-approved top-up. Ambiguous purchases require staff linking/reconciliation of original labels. Delivery does not release farmer funds automatically: existing buyer receipt and staff approval remain required.

## 7. Validation and limits

- Payment integration: 51 tests passed, including duplicate funding, authoritative amount/reference checks, provider failures, missed-webhook reconciliation, refunds/disputes, booking failure recovery, multi-farmer separation, split shipments, farmer-only readiness, duplicate readiness notifications and readiness without courier-status regression.
- Delivery/address integration: 77 tests passed.
- API unit suite: 169 passed; dedicated integration suites are skipped by that command and were run separately as listed above.
- Mobile: 389 tests passed, including new order-entry and delayed-confirmation retries.
- Web: 83 tests passed, including return-page provider-outage/delayed-confirmation retries and order-entry reconciliation.
- Workspace TypeScript checks and the web production build passed.
- Actual Bachs sandbox checkout was read and reconciled. Public unsigned webhook rejection and API readiness were checked. An existing sandbox collection event was resubmitted through Bachs' endpoint-specific resend API. Bachs reported successful delivery with HTTP 202, and the local worker marked the event PROCESSED with no failure code.

Provider calls in automated integration tests are mocked. No new card charge, courier purchase, physical pickup, individual rider contact, device push display, real multi-parcel delivery, live settlement or refund was performed. These remain pilot checks. The historical cancelled-order receipt requires staff resolution through existing controls.

Provider references: [Bachs webhook verification](https://docs.bachs.io/guides/webhooks/overview), [Bachs endpoint redelivery](https://docs.bachs.io/api-reference/webhooks/resend-an-event-to-an-endpoint), [Shipbubble official API schema](https://github.com/Shipbubble/node-sdk/blob/main/openapi.yaml).
