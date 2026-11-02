# Admin Finance workspace

Finance navigation retains Payments & reconciliation, Withdrawals, and Reports & analytics. Each page now shares overview, payment history, operations, recovery/refunds, logistics funding and ledger views. Withdrawals defaults to provider payout requests and retains a separate legacy authorization view.

## Information and review model

- Summary cards distinguish verified collections, farmer obligations, unallocated money and recognized commission. The seven-day collections chart uses provider-confirmed principal and Lagos calendar dates. Counts and amounts come from database aggregates, independent of list pagination.
- Payments and operations use server-side reference/order search, status and date filters, and 20-row pagination. Search state lives in URL parameters and is restored by the order-finance return link.
- Quick reviews use a native modal drawer with focus containment, Escape/close and focus restoration. Each review shows exact amounts, status, provider reference, timestamps and applicable existing audited controls.
- Extensive order review uses `/admin/reconciliation/orders/:id`. The dedicated page scopes history, summaries, ledger checks and settlement controls to that order. Its back link preserves the originating queue URL.
- Recovery and funding have separate queues, summary cards and record-scoped drawers. Farmer confirmation, proposal approval and manual funding evidence no longer share a form across unrelated records. Recent recovery cases and funding batches explicitly disclose the existing 100-record limits.
- Ledger checks preserve funded/held/released/refunded balancing comparisons, with provider environment and legacy sources kept separate. Reports show readable tables of provider order statuses and produce ledger movements.

## Existing controls

Release, hold resolution, refund requests, withdrawal approval/rejection, uncertain-operation reconciliation/linking, original-payer bank review, provider readiness, balance reconciliation, recovery confirmation/approval and manual funding verification retain their existing backend services and permissions. Native review drawers do not alter payment or authorization rules. Financial feature switches are unchanged.

## API additions

Authenticated `payments.read` routes under `/v1/admin/money`:

- `GET /summary`: exact all-time aggregates, seven-day collections, order and ledger breakdowns; optional order scope.
- `GET /records`: payment or operation history with reference/order search, status, date range, kind, order and pagination filters.
- `GET /records/:type/:id`: environment-scoped record review with encrypted fields and operation payloads excluded.
- `GET /ledger`: paginated balance comparisons by provider environment or explicit legacy source.

The existing money endpoint accepts record/order scopes so reviews can fetch records older than the original recent-100 list.

## Validation

94 web tests and 63 payment/API integration tests passed, including history pagination, permission enforcement, environment isolation, exact money, payload redaction, summary/ledger correctness, modal reviews, focus restoration, filter URLs and safe return links. Web and API type checking passed. Desktop and mobile fixtures were visually reviewed, including the native drawer and Escape/focus behavior. The authenticated local admin page required a login; no live financial action was executed during UI verification.
