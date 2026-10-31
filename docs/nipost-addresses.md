# NIPOST NDAPS addresses and nationwide delivery

Postcode checks and saved pickup/delivery addresses extend the existing API, website and mobile app. NIPOST checks postcode assignment and the address fields it supplies; it does **not** verify identity, confirm a map pin, register a new postcode or guarantee courier coverage.

## Server configuration

Use the existing owner-supplied secret key in the repository-root `.env` or deployment environment:

```dotenv
NIPOST_API_KEY=
```

- Only server-side secret keys are accepted: `nipost_test_…` outside production, or `nipost_live_…`. Publishable `nipost_pk_test_…` / `nipost_pk_live_…` keys are not used by this adapter. Never copy the secret into `NEXT_PUBLIC_*`, `EXPO_PUBLIC_*`, browser code or mobile binaries.
- The key determines TEST/LIVE mode; there is no separate NIPOST mode or enable switch. Production (`NODE_ENV=production`) rejects test keys and test verification proofs. Approve live lookup costs before supplying a live key.
- Request the `lookup` scope and granted L2 access for address details; `search` is needed for autocomplete/reverse search. Live access requires the organization's verified KYB and suitable grants. A key cannot exceed the organization's access level.
- Requests use `https://api.postcode.gov.ng`, the `X-API-Key` header and an eight-second timeout. Restart the API after configuration changes. A missing/invalid key leaves manual address saving available.
- Keep the existing `TOKEN_HASH_SECRET` stable and shared across API instances: it signs short-lived verification proofs. Do not regenerate persistent application secrets as part of this rollout; rotation invalidates outstanding proofs.

NIPOST setup is independent of Shipbubble and Bachs. It does not enable shipping, label purchases or payment collection.

## Lookup limits and sandbox data

| App check | Meaning | Live credit usage |
| --- | --- | --- |
| L1 | Assigned postcode validity only; the app derives the state from the postcode prefix. Street address and map pin remain unverified. | No credits |
| L2 | Validity plus the administrative/recent-house fields actually returned. Missing fields still need manual entry. | Consumes credits |

The adapter requests L2 first. If NIPOST denies L2 for access or insufficient credits, it retries L1 and returns the limitation with any successful validity-only result. A missing lookup scope may also prevent L1. State-only responses are labelled L1, not full address verification. Other failures do not silently become successful checks.

Test keys use a separate, small dataset of **public places**, not production residential addresses; calls consume no credits at any level. For example, the documented sandbox code `FC-01-A01-KP-27` resolves only with a test key. Use that key's autocomplete to discover other sandbox codes. Live example postcodes do not resolve in the sandbox. Sandbox results are clearly labelled and must not be represented as verified production addresses.

Point geometry requires provider L5 access. This implementation never requests L5 or substitutes a postcode lookup for the customer's independently confirmed map pin.

## Customer and farmer workflow

1. Enter a digital postcode, optionally search its segments, then choose **Check postcode**. Autocomplete accepts postcode fragments, not street-name searches; partial suggestions are not proofs.
2. Review the returned details before choosing **Use these postcode details**. Only supplied fields are applied. A changed state clears an obsolete LGA; changed location details clear the old pin. Complete missing street, city/town and LGA fields manually.
3. Independently select/confirm an optional map pin. Reverse search uses a confirmed point and a maximum 25-metre radius, returning only a nearest-postcode candidate; it does not verify the building or pin. The candidate must still be reviewed and checked.
4. Save the address with its server-issued proof, or choose **Enter address manually**. Manual addresses, blank postcodes and legacy six-digit postal references remain usable during missing configuration, denied access, exhausted credits, rate limits and outages. A format check or six-digit reference is never NDAPS verification.

Buyers manage saved addresses in their account and select them at delivery checkout; farmers use the same address checks for farm/pickup locations and listing pickup selection. Recipient name, email and phone remain editable when a saved destination is selected. Its canonical postcode, directions and confirmed coordinates come from the owned saved address. Switching to manual entry removes the saved-address reference and pin. Web address saves retain entered pickup email/date and recipient details, but require a fresh quote before payment.

## API and proof lifecycle

All endpoints below require customer bearer authentication. The web proxy uses the existing HttpOnly customer session and same-origin write checks. `/v1/me` responses are `Cache-Control: no-store`.

- `GET /v1/me`: returns the customer's addresses and persisted verification metadata.
- `POST /v1/me/postcodes/search`: `{q}`; returns bounded postcode-segment suggestions, without a proof.
- `POST /v1/me/postcodes/lookup`: `{code}`; returns `{postcode,valid,mode,level,fields,addressDetailsAvailable,limitation?,verificationToken?}`. Only valid lookups receive a proof.
- `POST /v1/me/postcodes/reverse`: `{latitude,longitude}`; returns `{found,candidate?}`, without a proof.
- `POST /v1/me/addresses` / `PATCH /v1/me/addresses/:id`: label, state, LGA, city and line1, plus optional line2, landmark, postalCode, nested `coordinates`, `verificationToken` and `isDefaultDelivery`. PATCH currently requires the full required address fields, not a partial location patch. Responses contain `{address}`.
- `POST /v1/me/seller-profile` also accepts the optional postcode, directions, coordinates and proof alongside farm details. `PATCH /v1/me/farm-location` updates the independently confirmed farm pin.

Create clients send a UUID `Idempotency-Key`; reuse it with the identical body after an uncertain response, and use a new key after changing input. Address ownership/country and verification timestamps/level/mode are server-controlled: raw latitude/longitude fields and client-supplied verification metadata are rejected by the saved-address schema. Coordinate pairs belong inside `coordinates`.

Proofs are customer-bound HMACs covering the postcode, provider fields, mode and check time, expiring after 15 minutes. Saving checks both ownership and consistency with the supplied address fields. A proof does not contain or verify coordinates and is not persisted on the address. After a successful save, clients clear it rather than resending an expired proof during later edits.

Omitting `verificationToken` retains existing verification only when the location is unchanged; explicit `null` removes verification. Label/default-only changes can retain it. Changes to the address, directions, postcode or pin clear verification unless an applicable fresh proof is supplied. Geographic edits clear the saved pin unless confirmed replacement coordinates are explicitly supplied.

Location changes to addresses used by unpaid orders retire selected fees, expire old quotes and invalidate provider responses still in flight. Active checkout blocks these changes with `CHECKOUT_ACTIVE`. Paid, financially held or booked orders block them with `ADDRESS_IN_USE`; save a new address for future orders instead of redirecting an in-flight shipment. Label-only edits remain possible. Terminal orders no longer keep the location locked. Changing a primary-address flag never redirects a saved order.

## Nationwide eligibility and rollout

The national catalogue includes all 36 states and the FCT. `DELIVERY_ALLOWED_STATES` has been removed and no longer restricts quotations; remove obsolete copies from deployment configuration. Nationwide eligibility means customers can **request** quotes, not that a carrier serves every location. Listing NONE/LOCAL/NATIONWIDE scope, approved `DELIVERY_ALLOWED_CATEGORIES`, packing/handling limits, Shipbubble configuration and actual provider results still determine availability. An empty result returns `NO_DELIVERY_OPTIONS`, not automatic staff review. See [shipping checkout](shipping-checkout.md).

Back up and test the database rollout before applying the additive `20261031200000_ndaps_address_verification` migration alongside any earlier pending migrations:

```sh
pnpm --filter @leetlogic/contracts build
pnpm --filter @leetlogic/database exec prisma migrate deploy
pnpm db:generate
```

Deploy compatible API, delivery worker and clients together. The migration adds nullable verification provenance and a consistency constraint; it preserves existing addresses and does not mark legacy records verified or require a postcode. Start with manual addresses/test-mode postcode checks and retain the existing shipping/payment sandbox and live gates. Test configuration, denied L2 access, expired proofs, manual fallback, saved pins, address-change locks and fresh quoting before enabling live lookups.

## Checks and support

```sh
pnpm build
pnpm test
pnpm typecheck
pnpm locales:check
pnpm --filter @leetlogic/api test:delivery
pnpm --filter @leetlogic/api test:payments
```

The delivery command runs both delivery and address integration suites sequentially in a fresh `leetlogic_delivery_integration_<suffix>` PostgreSQL schema, with Redis database 14. Payment checks use `leetlogic_payments_integration_<suffix>` and Redis 13. Keep these databases dedicated to tests; do not run concurrent invocations sharing the same Redis database or target production infrastructure. Schemas are retained for diagnostics rather than seeding or migrating the normal application schema. See [delivery operations](delivery-language.md) for test storage paths. Providers are mocked; these checks spend no NIPOST credits, buy no labels and collect no money.

All three postcode actions share an app quota of 30 requests per authenticated customer per minute in Redis; NIPOST also applies per-key limits. Autocomplete should remain explicit/bounded rather than sending a request on every keystroke.

| Error / limitation | Action |
| --- | --- |
| `POSTCODE_SERVICE_CONFIGURATION` | Operator checks the server secret, key environment and scopes; customer can save manually. |
| `POSTCODE_ACCESS_REQUIRED` / `POSTCODE_CREDITS_REQUIRED` | Review L2 grants/credits; any L1 fallback still leaves street details manual. |
| `POSTCODE_RATE_LIMITED` / `POSTCODE_SERVICE_UNAVAILABLE` | Respect `Retry-After`, retry later or save manually. |
| `POSTCODE_PROVIDER_RESPONSE_INVALID` | Investigate sanitized provider diagnostics; do not treat it as verification. |
| `POSTCODE_VERIFICATION_EXPIRED` / `POSTCODE_ADDRESS_MISMATCH` | Review and check again, or explicitly save without verification. |
| `CHECKOUT_ACTIVE` / `ADDRESS_IN_USE` | Reconcile the existing payment/order, or save a new address; never bypass the lock. |

Monitor provider operation/reason/status, quota failures and credit consumption without logging keys, address bodies or proof tokens. Live provider readiness and real-device address/pin QA remain operator checks, separate from mocked validation.

References reviewed 31 October 2026: [NIPOST authentication, key kinds and test data](https://docs.postcode.gov.ng/authentication.md), [lookup levels](https://docs.postcode.gov.ng/concepts/lookup-levels.md).
