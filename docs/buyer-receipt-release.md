# Buyer receipt and automatic payment release

Investigation and targeted correction: 6 November 2026. Existing receipt, private photo, release queue, payment worker, commission and ledger functionality are retained; no new migration or payment policy is introduced.

## Root cause and reported order

The receipt action was not deleted. `fulfillmentView` in `apps/api/src/routes/delivery.ts` computes `progress.canConfirm` using `deliveryReceiptReady`. `packages/contracts/src/order-journey.ts` selects the existing confirmation action only when that flag is true. Both guided clients previously rendered their primary footer only when there was an enabled action, making confirmation disappear entirely while delivery was still pending.

Farmer **Rider Collected Goods** records `FARMER_DISPATCHED`. It does not impersonate courier tracking or establish delivery to the buyer. A recorded courier booking, rider pickup, and completed delivery are separate milestones.

Read-only observation at `2026-11-06T20:17:40.580Z` for order `492b5572-eb89-4a22-bf45-d9d6d72815e5` / delivery `f8a5996a-6989-4ae4-896c-968aa50f8825` found:

- Order `FUNDED`, journey version 2, farmer decision `ACCEPTED`.
- `FARMER_DISPATCHED` recorded at `18:57:07.415Z`; delivery and both parcels still `BOOKED`, without a recorded courier `DELIVERED` event.
- No buyer receipt, financial hold, unresolved dispute, release or refund operation; fulfillment deadline `SECURED`.
- Produce principal remained held; released and refunded amounts were zero.

A separate read-only check at `20:19:22.511Z` found one verified original `ORDER` payment for the full produce principal, a locally `READY` connected farmer account, and payments/transfers enabled in **sandbox** mode. The worker must still verify current provider account capabilities and available NGN funds before any release. No buyer acknowledgment, shipment override, transfer, refund or live provider purchase was submitted during investigation.

The observed blocker was missing courier delivery evidence, not a missing payment or failed release. If physical delivery has occurred but tracking remains stale, reconcile the existing shipment through trusted provider records and established staff controls; do not fabricate completion or restart checkout.

## Exact confirmation conditions

For the courier-delivery flow, the existing server requires:

1. The authenticated caller is the order's buyer.
2. Order status is `FUNDED` or `DELIVERED`, not cancelled/refunded, and receipt has not already been confirmed. Matching confirmation retries return success without creating another receipt.
3. Farmer decision is not `PENDING` or `REJECTED`; version-2 orders use `ACCEPTED`. Legacy orders retain their existing compatibility.
4. Delivery is `DELIVERED`. `BOOKED`, `PICKED_UP`, `IN_TRANSIT`, farmer dispatch, failed delivery, cancellation or return do not qualify.
5. For split shipments, the complete recorded parcel plan matches the selected quote and expected package count: unique valid indexes, shipment IDs for every parcel, and **every parcel `DELIVERED`**. Parent completion alone is insufficient.
6. No financial hold, unresolved dispute, active checkout, or non-failed release/refund conflict. The existing fulfillment/refund policy must still permit receipt; a `SECURED` booking may finish after its original refund cutoff. Checkout quote expiry is not a new receipt deadline.
7. Version-2 confirmation has a saved private JPEG/PNG receipt photo (up to 10 MB) and `{ acknowledged: true }` after inspecting all goods. The upload and confirmation endpoints recheck authorization and eligibility under the order lock.

Buyer collection remains compatible: `PICKUP_READY` can authorize the existing pickup receipt flow without requiring a courier status. Farmer handover is not buyer acknowledgment and cannot release payment.

## Changes made

- The shared journey exposes `receiptPending` after dispatch/pickup/transit, without changing `canConfirm` or delivery-policy rules.
- Mobile and web keep **Confirm Receipt** visible but disabled while courier completion is pending, with localized guidance: **Available after the courier confirms delivery of every package.** Complete eligible delivery enables the same existing photo/inspection flow on refresh.
- Receipt inspection closes if eligibility is revoked; resolving review does not reopen it automatically. Premature clicks do not create receipt requests.
- The payment worker rechecks release eligibility and its unchanged, unexpired operation claim **after** the provider balance lookup and immediately before transfer submission. Previously, a hold, dispute, cancellation, missing receipt evidence or changed payment verification arriving during that lookup could bypass the earlier check.
- Payment documentation now reflects the already-existing automatic photographed-receipt release instead of incorrectly describing staff approval as mandatory for every receipt.

## Release lifecycle and safeguards

Buyer acknowledgment saves `deliveryConfirmedAt`, the `BUYER_RECEIPT_CONFIRMED` event and audit record once, without reducing held funds. `queueReceiptRelease` uses the existing `requestRelease` and `assertRelease` authorization. The durable payment worker discovers a saved receipt if the post-commit wake-up was lost or payment processing was temporarily unavailable.

Automatic release requires a verified original Bachs `ORDER` payment in the current mode, full produce principal held, accepted farmer decision and private evidence for new orders, eligible delivery, and no unresolved dispute/hold. Transfers must be enabled, the connected account ready, and provider NGN funds available. The existing order commission is deducted; shipping is not released to the farmer. This is a transfer into the connected farmer balance, **not an automatic bank withdrawal**.

Concurrent confirmations and worker runs reuse one operation identity. Provider `pending` keeps funds held. Only a matching provider-confirmed transfer posts the append-only journal, release entry, stock completion and payment-release event once, moving the order from `DELIVERED` to `COMPLETED`.

Safe pre-submission balance failures retry the original operation according to existing backoff. Definitive failures remain failed for staff review. Uncertain writes remain `UNKNOWN`; a known reference is reconciled read-only, while an unknown original transfer must be located and verified before further action. Buyer retries and automatic scans do not create replacement transfers after a failed or uncertain release. A dispute arriving after external settlement has started requires the existing support/reconciliation process, not an assumption that a completed transfer can be undone.

## Validation and rollout

The integration lifecycle covers farmer acceptance/readiness, one split booking, rider pickup, transit, partial delivery, complete delivery, private evidence, explicit acknowledgment, concurrent confirmation, concurrent worker claims, provider-pending settlement and exactly one successful release/ledger/inventory update. Additional cases cover ownership, holds, disputes, cancelled/returning delivery, farmer rejection, refunds, pre-transfer eligibility changes, expired/lost claims and failed/uncertain releases. Existing legacy receipt, balance-retry, refund and delivery-recovery regressions remain covered.

Run the isolated payment and delivery integration runners, API/contracts/mobile/web suites, workspace typecheck, changed-file ESLint, localization checks and `git diff --check`. Providers and native UI journeys are mocked in automated tests. A physical-device/provider sandbox pilot must still verify actual courier completion, camera evidence, receipt refresh and connected-account settlement.

Validation passed:

| Check | Result |
| --- | --- |
| Payment integration | 138 tests |
| Delivery/address integration | 81 tests |
| API unit tests | 184 tests |
| Shared contracts | 82 tests |
| Mobile | 515 tests; 54 receipt/checkout/localization cases rerun after final assertions |
| Web | 134 tests |
| Workspace typecheck, changed-file ESLint, locale checks, diff whitespace | Passed |

The latest isolated diagnostic schemas are `leetlogic_payments_integration_a7a6607f0fcd` and `leetlogic_delivery_integration_1a437a6abab3`; the runners applied all 28 existing migrations successfully without changing the reported order's schema or records.

Deploy/restart the API payment worker and update both clients with the shared journey changes. Production requires the existing supervised `worker:payments` process; release cannot depend on the buyer keeping the screen open. No configuration gate, refund deadline, delivery status, original payment or financial policy was changed for the reported order.
