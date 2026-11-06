# Paid delivery booking recovery

Investigation and implementation: 6 November 2026. Checkout location resolution and the existing payment, top-up, refund, dispatch and receipt flows are retained. No new database migration, provider credential or financial-policy setting is introduced.

## Root cause

Order `492b5572-eb89-4a22-bf45-d9d6d72815e5`, delivery `f8a5996a-6989-4ae4-896c-968aa50f8825`, was inspected with a read-only database transaction:

| Milestone | Time (UTC, 6 November 2026) |
| --- | --- |
| Delivery quote returned | 17:02:30 |
| Local quote expiry | 17:17:25 |
| Authoritative payment success | 17:04:37 |
| Payment allocated and delivery marked paid | 17:04:51 |
| Farmer accepted | 18:02:24 |
| Farmer marked produce ready | 18:02:51 |
| Booking blocked with `QUOTE_EXPIRED` | 18:02:57 |

The payment was `SUCCEEDED`, the order `FUNDED`, and paid delivery equalled its selected fee. Neither `providerShipmentId` nor `bookingStartedAt` existed. Booking was rejected locally before a label purchase, not demonstrated to have failed at Shipbubble.

Checkout quotes have a local 15-minute validity window. New orders wait for farmer acceptance **and** readiness before booking. Reusing the checkout quote after that wait failed the local expiry check, and `QUOTE_EXPIRED` was absent from worker recovery. Farmers must not have to confirm within the checkout window.

[Shipbubble rates documentation](https://docs.shipbubble.com/api-reference/rates/request-shipping-rates) states that rate tokens expire seven days after generation, while pickup dates are limited to the next seven days and requests after 18:00 WAT are processed the following day. Provider token lifetime is not an application payment deadline or a guarantee that a past pickup date remains bookable. Extending checkout validity to seven days is therefore not the fix.

## Lifecycle and recovery rules

1. Before payment, request and select a compatible quote using the saved pickup, buyer destination, pickup date and order packing snapshot. Keep existing 15-minute checkout validity and provider receipt verification.
2. A verified receipt funds produce and shipping exactly once. Payment stays confirmed while delivery waits for the farmer; neither quote renewal nor booking retry creates another checkout.
3. Farmer acceptance alone does not book new orders. Readiness wakes the delivery worker immediately. Waiting farmers rotate through the polling queue without blocking later ready orders.
4. A worker claims the delivery. Before an irreversible purchase, an expired or nearly expired quote (one minute or less remaining) is renewed for the **same saved shipment**. No automatic address, packing, pickup-date or courier substitution is permitted.
5. Recheck the claim, selected quote, funded order, paid amount, saved shipment, financial hold, settlement operations, fulfillment deadline and active checkouts before accepting the rate response and before buying a label. Late responses from an expired claim cannot overwrite another worker's result.
6. A renewed courier/service must match, and both its buyer amount and provider wallet cost must equal the selected quote. Adopt that fresh quote and continue without changing the original payment attempt, payment quote ID, paid amount or accounting allocation.
7. Any increase, decrease or provider-cost difference records the observed quote and leaves the agreed selection intact as `BOOKING_BLOCKED / DELIVERY_PRICE_CHANGED`. Automatic processing stops: it cannot charge a shortfall, absorb a difference, refund surplus or bypass review through `/delivery/book`.
8. Existing explicitly requested `/delivery/refresh-quote` behavior remains: supported provider-paid increases expose the existing buyer-approved **shortfall-only** top-up checkout; decreases retain paid surplus as refundable credit without automatically refunding it. Legacy paid-price differences still require staff reconciliation. No automatic repricing policy is inferred from these controls.
9. Temporary rate/provider/wallet failures before label purchase retry after five minutes. Missing compatible courier service may retry without substituting another courier. Invalid shipment data, past pickup dates and changed prices need explicit attention rather than silent repair.
10. Persist `bookingStartedAt` before buying labels. An attempted purchase with an unknown result stays `BOOKING_UNCERTAIN` and requires provider reconciliation, never a blind second purchase. Split deliveries retain every parcel's original recorded purchase/uncertainty. Complete recorded split bookings can finalize local accounting despite quote expiry, without repurchasing labels.

[Shipbubble shipment creation](https://docs.shipbubble.com/api-reference/shipments/create-shipment) documents the quote token, courier and service fields, but does not document a label-purchase idempotency guarantee. Do not assume that repeating the same token cannot purchase twice.

## Payment and booking status

The shared buyer/farmer order views distinguish delivery payment from booking: **Awaiting courier booking**, **Booking your courier**, **Courier booking needs attention**, and **Delivery top-up required**. Readiness and payment alone never authorize dispatch or buyer receipt. A provider label must exist, and split bookings must have a complete matching parcel plan. Provider shipment `pending`/`confirmed` describes a recorded courier booking, not payment or rider pickup.

Renewal and booking-block events use the existing deduplicated delivery notification outbox. New customer copy is covered in the mobile localization catalogue. Existing location/address components are unchanged.

## Independent fulfillment deadline

The existing fulfillment/refund policy is separate from quote expiry. The investigated environment had automatic refunds enabled and a two-hour configured window. This fix does **not** extend, reset, disable or reinterpret that deadline. The worker cannot renew or buy labels once fulfillment is due for refund. Longer farmer delays require an explicitly chosen longer policy; existing orders retain their recorded deadline.

## Validation and rollout

Regression coverage includes 30-minute and three-hour farmer waits (the latter with an explicitly longer recorded deadline), duplicate acceptance/readiness, simultaneous workers, expired quotes, rate and wallet outages, backoff, courier disappearance, price increases/decreases/provider-cost changes, explicit shortfall top-up, concurrent shipment/quote/hold/refund/deadline changes, stale worker responses, past pickup dates, split renewal and ambiguous single/split purchases. Original receipts and funding remain idempotent.

Run `pnpm --filter @leetlogic/api test:payments`, `pnpm --filter @leetlogic/api test:delivery`, the API/contracts/mobile test suites, typechecks and localization checks. Integration runners use isolated local database schemas and mocked providers; they do not purchase courier labels or charge/refund buyers. A provider sandbox pilot is still necessary to verify current account access, rate changes, pickup scheduling and lost-response reconciliation.

Restart or deploy the API delivery worker with the changed code. Existing unpurchased `QUOTE_EXPIRED` deliveries are recoverable automatically only while their unchanged fulfillment policy permits booking. Do not manually mark a booking successful, restart paid checkout or extend an order's refund deadline to recover it.
