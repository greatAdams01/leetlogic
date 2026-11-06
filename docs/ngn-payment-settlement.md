# NGN checkout and settlement correction

Investigated on 6 November 2026. All changes preserve existing financial records and the earlier escrow recovery safeguards.

## Confirmed findings

The Bachs sandbox account API and checkout-settings API initially both returned:

```json
{ "balance_currencies": ["USD"] }
```

The latest stored successful order checkout returned `currency: NGN` and `billing_currency: NGN`. Its charge also returned `currency: NGN` and `status: succeeded`. An older retrieved checkout showed the same currencies. The application already sent raw NGN pricing and restricted methods to `NGN_CARD` and, when the verified bank-return route is enabled, `NGN_BANK_TRANSFER`.

The missing account setting was significant: collection currency and settlement currency are different. Bachs documents that a payment priced and paid in NGN can be converted when the merchant account does not hold NGN. NGN-initiated checkouts settle into NGN by default when NGN balances are enabled. This explains the reported USD settlement and is consistent with the reproduced refund rejection about NGN not being held by the account. The payment retrieval API did not return a per-charge settlement-currency breakdown, so that API response alone cannot prove which wallet received a historical charge.

After the account owner changed withdrawal settings, a fresh API audit returned:

```json
{ "balance_currencies": ["NGN", "USD"] }
```

Both account and checkout-settings reads confirmed the change, on the account matching the configured organization ID. Keeping a USD balance enabled does not make an NGN-priced checkout a USD-priced checkout. Existing USD funds were not converted or relabeled.

## Checkout URL investigation

The stored nonempty checkout URLs retrieved during the audit used `sandbox-checkout.bachs.io/c/...`. A new checkout created after the change used the same host and path prefix. No alternative product-cart or client-created checkout flow was found in the application: web, mobile, order payments and delivery top-ups use the backend's checkout adapter.

The hostname is not a settlement-currency instruction. The app validates hosted origins and uses the configured sandbox or live API and corresponding keys. A USD price paid in its NGN equivalent remains different from an NGN-priced checkout; rewriting its URL cannot fix that.

## Code changes

- Every new checkout explicitly sends both `pricing.currency: NGN` and `billing_currency: NGN`, with server-owned amounts. Allowed payment methods remain NGN corridors only.
- Before creating an order payment or delivery top-up, the backend reads the provider account and checks both the configured organization identity and NGN balance availability. Missing/unknown currency configuration blocks creation with a user-facing error.
- The adapter repeats this account guard at the provider submission boundary. A queued checkout cannot silently fall back to a USD-only account. Recovery of an existing checkout operation also checks the account configuration.
- Before exposing a saved payment link, all customer payment endpoints verify that the remote session matches the saved checkout and attempt reference and has both NGN price and NGN billing currency. Unsafe or unverifiable links are withheld. Web and mobile explain that support should review the payment before another payment is made.
- Payment verification rejects a USD-priced or USD-billed session even if its charge was collected in NGN. A successful payment must also pass the account NGN readiness guard before the order is funded. Existing amount, identity, ownership, dispute and fulfillment checks remain in place.
- Added the read-only sandbox audit at `apps/api/scripts/diagnostics/payment-currencies.ts`. It prints currency/configuration evidence and URL host/path prefix, never the private hosted checkout token or credentials.

These checks apply in both provider modes. Only sandbox configuration was inspected and changed during this investigation. Live deployment requires NGN balances and NGN settlement enabled on the live Bachs account as well; a USD-only live account will be blocked by the same guard.

## Actual provider validation

Using the updated adapter after the account settings change, one new **₦1,000 sandbox checkout** was created and then independently retrieved from Bachs:

| Field                              | Verified result           |
| ---------------------------------- | ------------------------- |
| Provider mode                      | sandbox                   |
| Price currency                     | NGN                       |
| Billing currency                   | NGN                       |
| Amount                             | 1000.00                   |
| Hosted origin                      | sandbox-checkout.bachs.io |
| Account holds NGN                  | yes                       |
| Organization matches configuration | yes                       |

No real-money payment was made. The new validation checkout was not paid, so this verifies creation, account readiness and the locked session currencies, not completed payment settlement. Its private URL is excluded from the report. A genuine sandbox payment should be completed through the new session/order and its NGN wallet movement verified before claiming end-to-end settlement success.

Automated validation covers NGN-only submission, USD-only/missing/wrong-account rejection, both order and delivery-top-up entry points, mismatched price/billing rejection, saved-link withholding, and the existing escrow/refund/concurrency paths. Validation passed: 184 API unit tests, 89 payment integration tests, 132 web tests and 417 mobile tests (822 total). API, web and mobile typechecks passed; API and web production builds passed.

## Historical funds and deployment

Enabling NGN affects subsequent settlement configuration; it does not establish that older USD-settled funds have become NGN. Reconcile historical charges and actual wallet balances separately. Do not adjust an order's held principal, manufacture an NGN credit, blindly retry an uncertain transfer, or convert existing money as a side effect of this fix.

Deploy the API changes and restart the dedicated payment worker together. Verify the live account separately before enabling live collections. The earlier pending release must still pass the real available-NGN check; this change does not override insufficient balance, disputes or payout restrictions.

Primary provider references: [Currency selection and NGN settlement](https://docs.bachs.io/guides/checkout/any-currency-checkout), [checkout creation](https://docs.bachs.io/api-reference/payments/create-checkout-session), [account balance currencies](https://docs.bachs.io/api-reference/organizations/get-my-organization).
