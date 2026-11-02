# Payment recovery and logistics finance

Implementation and rollout notes, 2 November 2026.

## Operating model

Verified receipts are authoritative. A redirect never confirms payment. Existing Bachs signature verification, server-side charge/session reconciliation, journal posting, notification outboxes, top-up checkout, and delivery workers remain the shared paths.

A cancelled order with an authoritative receipt opens one payment recovery case. The original checkout/payment snapshots remain immutable. The order is restored only after original stock, farmer eligibility, pickup contact/address and packaging are rechecked, the farmer confirms, a current compatible quote is obtained, and the buyer accepts that proposal version. Farmer phone confirmation requires a staff record; approval requires payment management permission, recent step-up, a reason, and an idempotency key. Reservations last at most 30 minutes and never beyond the refund deadline. Requoting invalidates buyer consent. Expired reservations invalidate farmer confirmation.

Allocation uses the normal funding service and records the paid farmer alert in the same database transaction. Booking failures retain confirmed payment and a separate fulfillment failure. Higher shipping requires the existing verified top-up; lower shipping stays a refundable liability. Current orders represent one farmer/product context each; mixed carts retain separate contexts and private pickup information.

## Deadlines and refunds

Every verified order receipt receives a provider-completion-time deadline plus two hours. Missing completion timestamps use checkout creation as a conservative lower bound, rather than resetting the clock when discovered. Investigate missing timestamps before rollout. Historical successful receipts lacking confirmation timestamps are reverified.

The deadline worker runs immediately on startup and every 15 seconds independently of normal payment polling. It persists its heartbeat, warnings at 60/90/110 minutes, and deduplicated blocked-order alerts. Staff acknowledgement cannot extend the deadline. Full, confirmed booking secures fulfillment; collection requires farmer readiness and buyer arrangement acceptance. Booking starts, top-up creation, approval and refund decisions use the same order lock and cutoff checks.

At expiry one durable refund decision is claimed. Existing or uncertain labels require reconciliation and cancellation first. Collected shipments require an incident review. No queued request marks a payment refunded. Final completion requires provider-confirmed refund/payout success. Late top-ups reopen refund obligations. Confirmed refunds return produce and shipping principal; original processing fees remain disclosed separately. Automatic bank returns fund the payout fee from the business so it does not reduce refundable principal. Pending refunds reserve remaining shipping liabilities once across original and top-up payments.

Unknown requests with no provider reference remain blocked for reviewed provider lookup/linking through the existing money-operations recovery controls. They are never blindly submitted again. Provider balances, unsupported routes, unmatched payer banks and disputes can block execution; the deadline and incident stay visible. Two hours refers to initiation, with shipment-reconciliation exceptions, never guaranteed bank-credit time.

## Pickup communication

The existing logistics booking carries the farmer's confirmed pickup address, phone, contact and instructions. Courier/tracking details appear through the existing order delivery view. Farmer readiness is an application milestone; the reviewed integration does not establish a direct rider chat capability. Do not present the selected courier service as a guaranteed named individual rider. Courier/support contact and tracking remain the supported coordination channels when individual details are unavailable.

## Finance portal

The existing admin money page includes live finance/recovery operations. Values use integer kobo and naira formatting. Gross collections, farmer liabilities, shipping collections, confirmed label charges, refund obligations, released commission and business expenses are separate. Internal holding journals do not establish a segregated bank escrow. An unconnected business-bank balance is unavailable.

Immediate wallet shortfall is `max(0, booking-ready provider cost - usable observed wallet - verified incoming funding)`. Local commitments reduce usable balance; purchased charges already reflected in the provider balance are not deducted twice. Stale balances (over five minutes), wallet errors and uncertain purchases make the requirement unverified. Conditional recoveries and expired quotes are excluded. Verified deposits already reflected in the wallet are not counted again as incoming funds.

Manual funding batches progress Planned → Transfer recorded → Verified, with failed/cancelled alternatives. Recording evidence does not move money or unblock bookings. Verification requires a fresh wallet read, explicit audited statement reconciliation, a unique transfer reference and recent step-up. A verified batch journals movement into the shipping wallet asset; courier expense is recognized on label purchase. No bank transfer or individual rider payment is sent by this portal.

## API surface

Existing authenticated customer order router:

- `GET /v1/orders/recoveries` and `/recoveries/:id`: buyer/farmer scoped cases.
- `POST /v1/orders/recoveries/:id/farmer`: farmer confirmation.
- `POST /v1/orders/recoveries/:id/decision`: versioned buyer quote acceptance/rejection.
- `POST /v1/orders/recoveries/:id/decline`: select refund.
- `POST /v1/orders/:id/delivery/collection-confirmation`: buyer pickup arrangement acceptance.

Existing admin money router gains `/finance`, `/finance/refresh`, `/recoveries`, recovery farmer/proposal/approve/decline actions, acknowledged `/recoveries/backfill`, and `/funding` batch/record/evidence/verify/close operations. Existing permissions, audit and step-up controls apply. Evidence is privately stored, type/size validated and served through authenticated routes.

## Safe rollout

All three switches default off: `PAYMENT_RECOVERY_ENABLED`, `PAYMENT_AUTO_REFUNDS_ENABLED`, `SHIPPING_FUNDING_ENABLED`. Apply additive migration `20261102090000_payment_recovery_finance`, regenerate Prisma and deploy application/worker together before activation. Never mix sandbox/live balances, jobs or evidence.

1. Inspect historical confirmed receipts and open shipments, return routes, provider funding and outstanding refunds. Enabling automation can make existing overdue receipts immediately refundable. The backfill API explicitly acknowledges that consequence.
2. Validate refund capability, bank-return fees/destinations, provider funding, cancellation behavior and public webhook delivery in sandbox. Checkout hides bank-transfer methods when the verified return route/configuration is unavailable; automatic refund mode requires refunds enabled.
3. Enable funding visibility and recovery separately. Run supervised sandbox recovery → booking and funding verification → booking pilots.
4. Enable automatic refunds only with funded return routes and independent monitoring of `/health/ready`; stale deadline heartbeat returns an unhealthy result. Configure the deployment's external monitor to alert accountable staff. The repository cannot provision that external monitor.
5. Confirm actual provider refund completion in a supervised sandbox transaction before live activation. Do not enable by merely attaching a screenshot or changing a UI status.

## Validation and limits

Automated integration tests mock provider calls while using isolated migrated PostgreSQL/Redis environments. Coverage includes concurrent allocation, consent invalidation, shipping increases/decreases, unattended deadlines, approval races, unknown bookings, ownership, funding verification idempotency, reservation expiry and warning deduplication, plus existing payment/delivery safeguards. See implementation report for final counts.

No real refund, Shipbubble transfer, live label purchase, physical collection, bank settlement or device push was performed for this implementation. Unknown no-reference provider requests still require the existing audited staff reconciliation path. External heartbeat alert routing and actual provider capabilities/funding must be validated before activation. All switches remain disabled pending that operational validation.
