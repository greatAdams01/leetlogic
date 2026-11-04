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

## Configurable refund period and guided admin drawer

Marketplace settings now includes **Automatic refund deadline (minutes)**. The persisted `paymentRecoveryTimeoutMinutes` defaults to 120 and accepts whole minutes from 15 to 10,080 (7 days). Saving uses the existing settings-management permission, recent authenticator step-up, version check and audit history. Migration `20261104210000_configurable_refund_deadline` adds the field and database range constraint; it has been applied locally and the Prisma client regenerated.

For newly verified order payments, the deadline is calculated from provider completion time using the current setting and stored once. Existing deadlines, including overdue/refund-processing cases, are unchanged by later edits or duplicate verification. Staff acknowledgement still cannot pause a timer. Alerts scale to 50%, 75% and approximately 92% of the stored duration; the default keeps the existing 60/90/110-minute warnings and deduplication keys. The deadline applies to verified money without secured fulfillment, not declined payments with no collected funds. Refund submission, provider credit and shipment-reconciliation exceptions remain distinct.

The finance drawer has an icon-only close button with an accessible label, keyboard dismissal/focus restoration and a 44-pixel target. Refund actions follow a review → authorization → next-action sequence. Existing refund operations are visible from payment reviews and the backend scopes them to that payment. Status-specific instructions explain when to wait, reconcile or investigate. A pending refund suppresses a second refund button. Retry, manual reference linking and bank-return evidence are grouped into expandable sections. Seller release is kept under other financial actions. Narrow layouts stack fields and actions without horizontal action tables.

Validation: configurable-deadline persistence and immutable existing deadlines, scaled alert deduplication, authorization and settings range/version checks, existing-refund display, guarded action enablement, completed-result guidance and icon-close/focus restoration were exercised. The full admin integration run passed its settings tests but has an unrelated private-document upload failure (409 instead of 201); this was left unchanged. No new backend process was started.

## Full-page refund and recovery reviews

The refund drawer has been replaced by bookmarkable `/admin/reconciliation/records/{payments|operations|recoveries}/{id}` pages. Queue Review links carry the current search, filters, dates and pagination in an internal return URL. Navigation back is restricted to finance destinations; technical references and older operation history are collapsed. Payment context, amounts and next steps are visible on a responsive page without a modal or nested scrolling panel. The existing funding-transfer drawers remain for their separate workflow.

Actions now follow **Choose action → Review & authorize → Submit → Track provider result**. Merely selecting an action makes no financial request. The selected action and relevant principal/shipping/bank return details are reviewed before entering a reason and current authenticator code. Cancel makes no mutation. Repeated submission is guarded locally as well as by the existing backend locks/idempotency. Payment and operation data refresh every 15 seconds while visible, with stale reads prevented from overwriting newer action results. Provider processing remains distinct from completion.

Recovery cases use the same full-page entry point. Expired, allocated or refund-bound cases suppress stock-confirmation and approval controls and link to the actual payment/refund record. Active cases explicitly distinguish sending a case to the refund queue from successful provider refund completion. The alternative stock/proposal/allocation path is grouped separately. A read-only, permission-protected `GET /v1/admin/money/recoveries/:id` uses the existing mode-scoped case view; no parallel recovery service was added.

Validation includes full-page navigation/return state, payment detail loading/error handling, internal return-path restrictions, action selection without submission, authorization, cancellation, completed refund behavior, closed recovery behavior, active recovery refund resolution, direct recovery access control and payment-mode isolation. The payment integration suite passed 73 tests; device-size visual verification and an actual provider refund were not performed in this UI follow-up. No additional backend was started.

## Simplified everyday refund flow

The normal path is **Review amount → Authorize once → Track result**. Refund-specific labels are Refund processing, Refund completed, Refund failed, Checking refund and an explicit attention state for blocked returns. Pending/uncertain card refunds show automatic tracking rather than reconciliation controls or another approval request. Troubleshooting is shown only for a genuine exception. New unallocated-payment refunds show verified principal and processing fees before approval. Full order refunds default server-side to produce plus verified delivery principal; staff do not need to enter kobo. Partial delivery adjustments and bank-return routing remain optional controls, with eligibility still enforced under the order lock.

The existing payment worker now claims uncertain card refunds with no provider reference using database leases. It queries the original charge, validates a matching refund and applies the existing completion logic. Only a definitive provider 404 allows requeuing the same durable refund, using the same provider reference and idempotency key. Outages never permit resubmission. Automatic submission stops after three operation attempts, while read-only status checks continue. Unresolved confirmation after 15 minutes and mismatched references raise deduplicated finance alerts. The staff retry endpoint shares this same routine. Known-reference refunds and bank-return operations retain existing background reconciliation. An uncertain bank return without a provider reference remains an explicit staff-verification exception; the app does not claim unsupported automatic discovery.

This follow-up did not submit a real refund or start an additional backend. Payment-worker availability remains necessary for unattended tracking and retries. Mocked provider/database integration tests cover found refunds, missing refunds, outages, concurrent claims, retry caps, eventual provider success and default full order principal. UI tests cover one-time authorization, cancellation, automatic pending tracking, completion labels and exception-only controls.

Follow-up validation passed: 77 payment integration tests, the 113-test web suite, the final 17 focused refund/status/queue UI checks (including one additional queue case), and workspace type checks. No provider-confirmed real refund or device-size visual verification was performed during implementation.
