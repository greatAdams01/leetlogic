# Recovery actions and readable updates

The farmer screenshot showed an overdue recovery with a bare refund label, an old unlabeled timestamp and no usable next step. Active recovery consent forms existed, but closed cases suppressed every action. Notification rows contained status keys absent from the language dictionary, the Updates page fell back to generic copy, the farmer home had no bell, and no read/unread state was stored.

## Customer experience

- Updates cards explain the current next step in the user's language and show a short order reference. Review order issue opens a dedicated mobile Order assistance screen.
- Before the deadline, farmers review the original quantity, packing and saved pickup location, then confirm availability or decline fulfillment. Buyers waiting for the farmer can request a refund even before a proposal exists.
- Live proposals provide buyer acceptance and explicit delivery increase/surplus information. Expired reservations, expired proposals, prior acceptance and refund states determine available actions consistently on the API, mobile and web.
- Overdue cases explain why stock confirmation is closed. Refund due, processing, blocked, shipment reconciliation and completed states remain distinct. Processing copy does not imply provider confirmation or bank credit.
- Ask staff for help creates one active order-linked, high-priority request per participant in the existing support queue. The case shows its status and latest public staff reply, including after resolution. Internal notes and the other participant's support conversation remain private. Support requests never pause refunds or restart recovery.

## Notifications

The existing delivery notification outbox now records recovery creation, farmer confirmation, proposal creation, buyer decision and refund problems. Historical events receive human titles and descriptions, produce/order context and a relevant destination. A missing delivery record is created for recovery so its notification can use the same outbox.

Buyer and farmer homes have unread bell badges. The inbox polls every 15 seconds while active; existing supported foreground push notifications also invalidate it. Read state is persisted on the three existing notification tables. Tapping an update marks that item read and opens its order, assistance or listing view. Mark all as read uses a server snapshot cutoff so a new arrival is not accidentally marked read. All reads/writes are owner-scoped. The new copy is included in the bundled language catalogue.

## Rollout and validation

Additive migration `20261104190000_notification_reads` adds nullable `readAt` columns. It was applied to the local database and the Prisma client regenerated. API and clients must be deployed together with this migration. Existing rollout flags and payment rules were retained.

Validated with contract, mobile, web, payment integration and delivery/address suites, plus workspace type checking. Regression checks cover active/expired consent actions, proposal validity, readable unknown events, bell counts, routing, read ownership, late arrivals, support deduplication, support privacy and original pickup contact privacy. Actual device push delivery and an authenticated real-device visual review were not performed; in-app behavior was exercised with UI fixtures and the integration database.

## Admin refund recovery and Updates placement

Recovery cards have moved off buyer/farmer home dashboards into the mobile Updates inbox and web `/account/updates`. Home bells and the account Updates link remain entry points. Order-specific assistance remains available from tracking. Both inboxes provide category and unread filters, readable event descriptions, order context and direct action links.

The deadline worker previously ignored rejected refunds and created a new refund operation on every scan. It now blocks and escalates the existing rejected request. For uncertain card refunds without a provider ID, staff can use **Find original refund with provider**: a read-only Bachs `/refunds/by-charge/{payment_id}` lookup validates the charge, original operation reference, amount and currency before applying the existing completion logic. A refund belonging to another operation requires explicit investigation; it is never silently adopted.

**Check provider and retry original refund** requires payment-management permission, recent step-up and a reason. It first looks up the charge. If found, it reconciles instead of posting. Only a provider 404 permits queuing the same durable operation under the order lock; concurrent requests cannot create another operation. The worker sends the original operation ID in both the idempotency header and body. Outages never count as a missing refund. The admin shows the actual returned request status rather than implying refund completion. Safe provider error codes/statuses are retained in server diagnostics; private response text is excluded.

A read-only sandbox check on 4 November returned 404/NOT_FOUND for the affected charge's refund lookup. This is not proof of a completed refund. No new refund was submitted by the investigation, and no backend server was started. The existing UNKNOWN operation must be reconciled or retried through the guarded action after deployment. Real provider rejection causes predating these diagnostics cannot be reconstructed from the generic stored failure code.

Validation for this follow-up: 70 isolated payment integration tests, 14 Bachs provider tests, 402 mobile tests, 99 existing web tests plus one new Updates interaction test, and workspace type checking passed. No real-device visual check or successful external refund execution was performed.
