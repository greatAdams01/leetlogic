# Guided farmer and buyer order journey

The former order workspace made users switch between broad tabs and repeated status text. It had no general farmer acceptance decision, buyer pickup handover record, or receipt-photo requirement. Fulfillment and financial completion also needed visibly separate states.

Both customer clients now use one shared `orderJourney` projection. The main screen shows the current task, product/quantity/value, a short progress strip, payment status and one persistent primary action. Pickup information and courier tracking appear when relevant. Order details, payment/receipt, history and problem reporting are expandable secondary sections. Unpaid checkout and staff logistics tools retain their established workflows.

## State and authorization map

| Milestone | Farmer | Buyer | Server rule |
| --- | --- | --- | --- |
| Payment verified, decision pending | Accept or decline with reason | Waiting for farmer | Funded, owned, no hold/dispute/settlement, fulfillment deadline open |
| Accepted | Prepare goods; mark ready | Farmer preparing | Acceptance required on new orders |
| Pickup ready | Confirm goods handed to buyer | Pickup details; inspect and confirm receipt | Farmer handover is an attestation, never buyer receipt |
| Delivery ready | Wait for booked rider; confirm collection | Rider/tracking updates | Booking waits for acceptance and readiness; complete booking required for dispatch |
| Handed over / dispatched | Await buyer confirmation | Receive and inspect goods | Courier delivery and all split-parcel checks still govern receipt eligibility |
| Receipt confirmed | Payment processing | Order completed; payment processing | Private photo plus explicit inspection acknowledgment for new orders; no active dispute or hold |
| Transfer confirmed | Payment released | Payment released | Existing trusted worker validates provider response and posts ledger once |
| Declined | No preparation | Refund pending | Reason, audit, notification and support ticket saved atomically; existing refund worker/authorization checks apply |
| Dispute/review | Actions paused | Resolve through Report a Problem | Existing dispute process blocks release; staff retain exceptional resolution authority |

`deliveryConfirmedAt` still means buyer receipt. Internal `DELIVERED` can therefore precede the financial `COMPLETED` state. The UI reports payment processing, released, or requiring attention independently. A farmer’s readiness, pickup handover or dispatch does not release funds.

## API and durability

- `POST /orders/:id/delivery/decision` accepts `{accept, reason?}`. A rejection requires a reason. Opposite or late decisions are rejected; matching retries are safe.
- Existing `/ready` and `/dispatch` endpoints retain their locks and provider guards.
- `POST /orders/:id/delivery/handover` records buyer collection once without changing receipt or held funds.
- `POST /orders/:id/delivery/receipt-photo` accepts a JPEG or PNG up to 10 MB. It verifies the format and ownership, rechecks current confirmation eligibility under the order lock, stores the photo privately, audits it, and removes superseded drafts. The storage key is never serialized to customers.
- `GET /orders/:id/delivery/receipt-photo` is authenticated and order-scoped (or staff with order read access), with private/no-store caching.
- `/confirm` requires a saved photo and `{acknowledged:true}` for new orders. Confirmation is idempotent and leaves held money unchanged.
- The money worker discovers confirmed new orders durably and creates one release through the existing release authorization function. It reuses existing operations, never repeatedly creates operations after financial failure, and skips unresolved disputes. Provider checks, accounts, financial feature flags and ledger guards are preserved.
- Rejection stops preparation/booking and enters the established refund path. Failed or blocked financial operations stay visible for staff review; clients cannot perform exceptional release or refund.
- Delivery events create inbox notifications in the same transaction. A leased, retried push outbox now delivers these updates to buyer and farmer devices. Old notifications are marked sent during migration so deployment does not replay history. Buyer push registration and account-scoped deep links are supported. Courier notification uses the existing provider booking integration after readiness; no separate rider account or unsupported messaging API is introduced.

## Compatibility and rollout

Migration `20261105150000_guided_order_journey` adds decision, handover, receipt metadata and push-outbox fields without rewriting historical orders. Existing orders default to `journeyVersion=1` and `LEGACY`; new marketplace/cart orders explicitly use version 2 and `PENDING`. Legacy confirmation APIs remain compatible. Deploy the migration, generated database client, contracts, API/workers and both customer clients together. The migration was verified in isolated test schemas and applied successfully to the local `localhost/leetlogic` database. No production database was changed.

Unpaid orders use the established cancellation endpoint and inventory release. Paid cancellations and problems use order support/disputes and staff resolution, preserving refund and shipment reconciliation safeguards. Photos and partial form state survive failed submissions while the screen remains open; offline writes show an error and require a deliberate retry. No fulfillment or money action is queued blindly while offline.

## Validation

Integration tests use isolated local PostgreSQL schemas, separate Redis databases and mocked payment/shipping/media providers. They cover acceptance/rejection ordering, role enforcement, duplicate decisions, pickup handover without release, receipt-photo privacy and format checks, explicit inspection, dispute blocking, full split-shipment fulfillment and exactly one provider-confirmed release/ledger entry. Existing cancellation, refund, failed-operation and legacy-flow suites remain part of the checks. UI tests cover guided actions, photo preview, upload failure, duplicate submission guards and accessible secondary sections.

Responsive browser inspection uses synthetic fixture orders only; the temporary preview route is removed before delivery. Native device rendering, physical collection, actual camera hardware, live push delivery, and real payment/shipping providers still require staging/device validation.
