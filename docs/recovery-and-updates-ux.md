# Recovery actions and readable updates

The farmer screenshot showed an overdue recovery with a bare refund label, an old unlabeled timestamp and no usable next step. Active recovery consent forms existed, but closed cases suppressed every action. Notification rows contained status keys absent from the language dictionary, the Updates page fell back to generic copy, the farmer home had no bell, and no read/unread state was stored.

## Customer experience

- Home cards explain the current next step in the user's language and show a short order reference. Review order issue opens a dedicated mobile Order assistance screen.
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
