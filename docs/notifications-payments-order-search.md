# Notifications, payment release and buyer order search

## Confirmed cause of the local delayed release

A read-only inspection found a provider-funded local order with a saved receipt photo and buyer confirmation, a completed delivery, no dispute or financial hold, the full produce amount held, and a ready farmer payment account with transfer capability. It had no release operation.

Two separate issues explained the wait:

1. The automatic scanner required `journey_version >= 2` and `farmer_decision = ACCEPTED`, excluding the existing version-1 `LEGACY` order even though it had the required receipt evidence.
2. `PAYMENTS_TRANSFERS_ENABLED` was unset in the local configuration and therefore defaults to false. Fixing the scanner cannot authorize a transfer while this switch is disabled.

The local data and configuration were inspected without requesting a provider transfer. Financial feature flags were not changed. Normal eligible receipt release does not require staff approval; disputes, financial holds, missing proof, unavailable accounts, disabled configuration and failed operations still require the appropriate resolution.

## Release behavior

- Buyer confirmation commits receipt/evidence first, then wakes durable release queueing immediately. The scheduled worker remains the recovery source after a crash or a missed wakeup.
- Photographed legacy receipts now qualify for automatic queueing. Both current and legacy automatic releases require a successful provider-verified original payment in the current provider mode and the original produce amount.
- `requestRelease` retains the order lock, held-funds equality, receipt/delivery/split-parcel checks, dispute protection, refund exclusion and operation idempotency. The transfer worker still performs trusted provider/account/balance checks and verifies provider results before updating balances.
- An existing failed release is not replaced automatically. Staff retain exceptional retry/refund/dispute authority.
- Configuration or queueing failures create an operational finance alert and one deduplicated paused-release notification. Processing and completed release events notify both parties. The standalone payment worker now drains order-event notifications as well as paid-order and listing notifications.
- Production still requires the separately deployed payment worker. A queued transfer is shown as waiting for that worker; provider-pending/unknown results remain awaiting confirmation.

The worker will pick up eligible legacy receipts once an authorized operator restores the transfer configuration. Enabling sandbox/live money movement remains an operational decision; this change does not enable financial features or bypass live-write safeguards.

## Truthful payment display

The old warning came from `paymentActions.locked`: a confirmed order no longer has the `AWAITING_PAYMENT` checkout status, so it is deliberately locked against another checkout. Both clients were presenting that checkout condition as a green order-payment notice.

Confirmed-order payment panels now use a backend projection based on verified payment attempts, held/released/refunded amounts, receipt evidence, disputes, the current transfer operation and financial configuration. An order record alone never establishes payment success. Existing unpaid records remain checkout reservations and are labeled Checkout in progress. Non-success messages use neutral or warning styling.

Escrow, transfer and earnings are separate fields:

| State | Escrow | Transfer | Earnings |
| --- | --- | --- | --- |
| Verified and held | Held in escrow | Not started | Not credited |
| Release queued | Still held | Queued/processing | Not credited |
| Configuration paused | Still held | Paused or not started | Not credited |
| Provider transfer confirmed and ledger updated | Released | Confirmed | Credited to earnings |

A bank withdrawal is separate from credited platform earnings. A release amount without a verified successful transfer is shown for review rather than as available money. Zero held funds are not described as held in escrow.

## Notifications

The section is labeled Notifications on both clients. `/account/notifications` is the canonical web route; `/account/updates` continues working for existing links. Notifications have type icons, selected filters, explicit unread markers, read/unread styling, timestamps, calendar-day groups and contextual order/listing actions. Supported categories include orders, payments, delivery, pickup and system announcements. Recovery links and snapshot-safe mark-all-read behavior are preserved.

## Buyer order search

`GET /orders` accepts `q` (up to 100 characters), `filter` (`ALL`, `ACTIVE`, `COMPLETED`, `CANCELLED`), `limit` (1–50) and a UUID `cursor`. It returns `items`, `hasMore` and `nextCursor`, with stable descending creation-time/ID ordering. The default size remains 50 for existing dashboard consumers; search clients request pages of 20.

Search matches order reference, produce title, farmer full/display name and farm name, case-insensitively. Ownership and role scope are always combined with search and filters. A cursor must belong to the same visible result set. Seller contact/account details are not exposed by search.

Completed means receipt-confirmed or financially completed, excluding cancelled/refunded orders. Cancelled includes rejected/refunded orders; Active excludes those and receipt-confirmed orders. Mobile and web debounce input, combine filters, load server cursor pages, discard stale responses, show clear empty/error states, and refresh on foreground/focus. Web results reset on account change; native search also separates its result context by account.

## Validation and deployment

No database migration is needed. Contracts, API, API/payment workers and both clients must be deployed together. Tests cover legacy immediate queueing, disabled configuration, idempotency, disputes, transfer/result distinctions, search ownership, filters, tied-timestamp pagination, farmer/product search, stale frontend requests, notification semantics and payment-panel regressions. Integration suites use isolated databases and mocked providers.

Desktop and 390-pixel browser inspection used synthetic fixtures for notifications, seller-name search, combined filters and empty states. The temporary preview route was removed. Native hardware and live provider transfers were not exercised.
