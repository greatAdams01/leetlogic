# Payments and delivery

Implemented within the existing API, Next.js app/admin, Expo app and PostgreSQL. All financial flags default off. Actual `.env` credentials are managed by the project owner; this implementation does not change them.

## Configure sandbox

Use the root `.env`; restart API and worker after changes. The example contains the new settings.

1. Set `BACHS_MODE=sandbox`, the sandbox `BACHS_API_KEY`, `BACHS_ORGANIZATION_ID` and endpoint `BACHS_WEBHOOK_SECRET`. Set `PAYMENTS_RETURN_ORIGIN` to the web app origin reachable from the testing device. Keep live switches false.
2. Configure Bachs webhook destination `https://<ngrok-host>/v1/webhooks/bachs` with checkout, collection, refund, payout, transfer, dispute, account and capability events. Subscribe to connected-account events as well as platform events. Raw-body signatures, timestamps and account ownership are checked; webhook notifications trigger authoritative provider reads.
3. Enable `PAYMENTS_ENABLED` for the pilot. Enable transfers, payouts and refunds separately only for the sandbox flows being tested. Farmer setup is available under Account → Payments and earnings, and `/account/payments` on web. Farmers must finish hosted account onboarding, obtain transfer/payout capabilities, and verify an owned bank before buyer checkout is offered.
4. Confirm exact NGN payout fees with Bachs for this account. Set `BACHS_NGN_PAYOUT_FEE_MINOR` to the verified fee in kobo; leaving it blank disables withdrawal requests. Same-currency Bachs payout quotes do not quote fees. A changed actual fee blocks local completion and requires reconciliation; never guess this price.
5. Cards are enabled first. Bank transfers require `BACHS_BANK_REFUNDS_VERIFIED=true` after demonstrating the original-payer bank-refund transfer and payout flow. A bank refund requires the buyer's approved connected account and owned usable bank; missing payer details require an audited staff evidence review.
6. Configure Shipbubble test key/access and eligible category/routes using the delivery settings already documented. Confirm wallet balance before booking. Sandbox payments cannot fund live courier bookings. Unsupported produce, bulk and cold-chain stay in manual review.

The API key alone is insufficient: organization ID, webhook secret, farmer onboarding/capabilities, approved banks, provider pricing and eligible routes must also be ready. Provider-side setup and real sandbox transactions are still required; mocked tests do not certify provider account readiness.

## Run

From repository root:

```sh
pnpm --filter @leetlogic/database exec prisma migrate deploy
pnpm --filter @leetlogic/api dev
pnpm --filter @leetlogic/web dev
pnpm --filter @leetlogic/mobile start
```

Development API runs the payment and delivery polling jobs. Production API requires a separate supervised payment process:

```sh
pnpm --filter @leetlogic/api worker:payments
```

For compiled deployment, run `node dist/payment-jobs.js` inside `apps/api` with deployment environment variables. Keep the API process running for webhooks. Delivery jobs currently run in the API process. Payment jobs use database claims and leases; do not depend on the browser staying open. Run a single supervised payment worker initially. Graceful shutdown stops timers and closes database/Redis connections.

## Financial behaviour

- Checkout contains produce and a saved current delivery quote. Bachs processing fees are charged to the buyer and disclosed on hosted checkout. Produce, shipping, provider fee and commission are separate records.
- Verified collection funds the order once and queues delivery. Redirects never mark orders paid. Expired/unfunded reservations are released; late, underpaid, overpaid and extra-charge receipts are held for review, not silently accepted.
- Shipping quote increases require a separate buyer-approved top-up. Decreases preserve paid shipping as refundable credit. Shipbubble wallet funding remains an operator task; Bachs does not automatically fund it. Confirmed booking costs are journalled against the shipping wallet asset; actual/missing cost discrepancies freeze the order for review. Wallet balance reconciliation is a snapshot, not an automatic assertion that all external wallet transactions are accounted for.
- Courier delivery does not release funds. Buyer receipt confirmation **and** recent-TOTP staff approval are required. Open local/provider disputes and financial holds block release. Commission uses the order's existing configured rate; the farmer receives produce proceeds less commission in their connected balance.
- Earnings screen separates held, available and pending withdrawals. Withdrawal requests reserve the amount plus disclosed fee, require staff approval, and are completed only after provider confirmation. Legacy internal-wallet credits cannot be withdrawn through this provider flow.
- Card refunds return eligible principal/shipping through the original payment. Customer-paid processing fees are not subtracted twice. Bank refunds use a transfer followed by payout; order refund completion waits for the payout. Bachs can apply non-returnable refund charges according to its account terms. Courier cancellation does not mean that a payment or wallet refund succeeded.
- Append-only, balanced journals and durable operations retain financial history. Legacy admin escrow funding/release controls cannot operate on Bachs orders.

## Recovery and staff controls

Admin order details, withdrawals and reconciliation show provider operations, review requirements and balance snapshots. Money-management permission, recent TOTP and a recorded reason protect releases, refunds, approvals and recovery actions.

- An uncertain POST with no provider reference stays `UNKNOWN`. Find the original operation in Bachs, then use **Verify and link original operation**. The server reads and checks its identity before reconciliation. Never create a replacement payment/transfer to resolve uncertainty.
- Known provider references are polled using GET. Timeouts do not cause blind money-write retries.
- **Refund unallocated payment** handles late/under/over/extra charges without changing order inventory or held produce. **Complete financial review** only clears a hold after exception receipts are resolved/refunded, local disputes resolved, and provider disputes are confirmed won. Lost disputes remain frozen for manual finance investigation.
- Connected account/bank creation interrupted before saving its ID can be linked to a verified original resource. Account parent/email and original bank details are checked; private setup input stays encrypted until resolved.
- Fee, amount, destination or ownership mismatch must be investigated against provider records. Do not edit journal rows or mark a refund completed manually. `FAILED` is a definitive failure; `UNKNOWN` is uncertainty.

Monitor worker heartbeat/process health, pending/unknown operations, payment exceptions, stale tracking, available provider balance and Shipbubble wallet balance. Logs include operation/request IDs and sanitized codes, never API keys, full bank details or webhook bodies.

## Validation

```sh
pnpm --filter @leetlogic/api test
pnpm --filter @leetlogic/api test:payments
pnpm --filter @leetlogic/api test:delivery
pnpm --filter @leetlogic/api test:identity
pnpm --filter @leetlogic/api test:admin
pnpm --filter @leetlogic/mobile test
pnpm --filter @leetlogic/web build
```

Integration commands require local PostgreSQL/Redis and create isolated integration schemas. Provider calls are mocked; no external money movement or courier purchase is performed. Sandbox pilot still needs real hosted checkout, account onboarding, signed webhook delivery, transfer, payout, card/bank refund and courier test results, including fee handling and network interruption. Interactive simulator testing remains with the project owner.

Before live use, obtain Bachs approval for platform collection and delayed farmer settlement, verify production capability/fee/refund rules, confirm courier commodities/routes, provision reconciliation/incident ownership, then explicitly enable live collection and money switches. This implementation does not assert regulated escrow custody or declare the provider pilot complete.

## Provider references

- [Bachs separate charges and transfers](https://docs.bachs.io/connect/split-payments/separate-transfers)
- [Bachs webhooks](https://docs.bachs.io/guides/webhooks/overview)
- [Bachs refunds](https://docs.bachs.io/guides/refunds)
- [Bachs payout quotes](https://docs.bachs.io/api-reference/payouts/create-payout-quote)
- [Bachs bank reference API](https://docs.bachs.io/api-reference/reference/list-banks)
- [Shipbubble official SDK API specification](https://github.com/Shipbubble/node-sdk/blob/main/openapi.yaml)
