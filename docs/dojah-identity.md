# Dojah seller identity verification

LeetLogic uses Dojah EasyOnboard for identity checks in the existing Express API and Expo app. A verified identity is one requirement for submitting a farmer application; staff still review farm details and evidence. Identity checks never approve a farm, create a listing, or release money.

## Configure the sandbox

Add these values to the repository's **repository-root `.env`** (not `apps/.env`), following `.env.example`:

```dotenv
IDENTITY_PROVIDER=dojah
DOJAH_ENABLED=true
DOJAH_MODE=sandbox
DOJAH_APP_ID=<sandbox app ID>
DOJAH_SECRET_KEY=<sandbox API secret>
DOJAH_WIDGET_ID=<published sandbox widget ID>
DOJAH_WEBHOOK_SECRET=<subscription webhook secret>
DOJAH_FLOW_POLICY_CONFIRMED=false
DOJAH_LIVE_CHECKS=false
```

Do not put these values in `apps/mobile/.env`, any `EXPO_PUBLIC_*` variable, a screenshot, or source control. Only the published widget ID and an opaque session reference appear in the hosted URL. The API secret and webhook secret are different credentials.

In Dojah EasyOnboard:

1. Publish a **sandbox** flow restricted to Nigeria and the ID services actually enabled for the account. Dojah owns ID-type selection and capture; LeetLogic does not pretend that an uploaded photograph is a registry check.
2. Include `user_data`, `government_data`, and `selfie` steps. Enable name matching against government data, face matching to the government identity, and liveness. Require those checks for success. A selfie capture by itself is insufficient.
3. Configure suitable matching/liveness thresholds in Dojah and confirm them with the provider. The integration uses Dojah's step decisions, not invented client-side thresholds. Do not add credit checks, BVN checks, location collection or other unrelated steps to this seller flow.
4. Validate the mandatory checks using provider-approved sandbox fixtures, including a mismatch and a failed liveness check. Set `DOJAH_FLOW_POLICY_CONFIRMED=true` **only after verifying this configuration**. Sandbox launches are allowed before this flag is set so the flow can be tested. Live launches require the flag. A wrongly configured widget is not made safe by a successful HTTP response.
5. Subscribe the `kyc_widget` service to `https://<backend-host>/v1/webhooks/dojah`. Copy that subscription's **webhook secret** into `DOJAH_WEBHOOK_SECRET`. The handler checks the `x-dojah-signature` HMAC against the exact request bytes. It does not accept the static v2 signature in its place.
6. Start the backend from the repository root with `pnpm dev`. Its command loads the root `.env` via `--env-file=../../.env` from `apps/api`. Restart the API after changing environment variables. Restart/reload Expo Go to pick up the application changes.

Dojah requires a reachable HTTPS callback for webhook delivery. `localhost` and a private Wi-Fi IP cannot receive external callbacks. Use a deployed sandbox backend or a tightly scoped HTTPS ingress that forwards only the Dojah webhook path. Do not publicly expose the local console-OTP authentication service. The authenticated result-check endpoint can reconcile results as well; when a REST response omits `widget_id`, it cannot establish the configured flow and a passing result waits for a correctly bound signed webhook.

## Apply and run

```sh
pnpm db:generate
pnpm --filter @leetlogic/database build
pnpm --filter @leetlogic/database exec prisma migrate deploy
pnpm dev
```

The additive migration preserves existing cases, documents and reviews. New cases require Dojah; editable existing applications also require it on submission. Historical submitted cases without the requirement retain their existing review process. `IDENTITY_PROVIDER=manual` is an explicit legacy mode; changing that setting cannot bypass a case already marked as requiring provider verification.

## Expo Go pilot

The native Dojah SDK needs a custom development build and does not run inside Expo Go. This integration deliberately launches the documented hosted flow with the phone's browser, using React Native Linking and no additional native dependencies.

1. Complete farm details and location.
2. On **Verify your identity**, read and accept the Dojah consent checkbox, then select **Verify with Dojah**.
3. Complete the sandbox flow in the browser using provider-approved test identities. Return to LeetLogic manually when finished.
4. The app checks the result when foregrounded and reads webhook updates while waiting. **Check verification result** retries a server reconciliation, throttled to one outbound read per session per 15 seconds.
5. Continue becomes available after a confirmed successful identity result. Proceed to farm evidence and the final declaration; do not upload the ID again into LeetLogic.
6. Reloading preserves the account and resumes the application using server identity state. Interrupted/cancelled flows can be reopened with the same pending reference. Expired or unsuccessful checks can start a new attempt; at most three starts per case are allowed in 24 hours.

Test camera denial, leaving the browser early, reloading, mismatched names, failed liveness, delayed and duplicate callbacks, provider/network outages and expired sessions. Test with actual supported phones; a simulator is not evidence that live camera/liveness works.

App-owned prompts are bundled in all five locales. The hosted Dojah flow's language support must be checked in its dashboard before claiming an entirely localized identity journey.

## API and states

All customer endpoints require the existing customer session and operate only on its latest verification case. They never accept a user-supplied check ID or verification outcome.

- `GET /v1/seller/verification/identity`: availability, required consent version, sanitized latest status, and `passed`.
- `POST /v1/seller/verification/identity/start`: `{ "consent": true, "consentVersion": "dojah-identity-v1" }`. Creates/reuses a session and returns the Dojah launch URL. Concurrent duplicate starts share a reference.
- `POST /v1/seller/verification/identity/refresh`: reconciles the account's latest session with Dojah.
- `POST /v1/webhooks/dojah`: raw JSON and `x-dojah-signature`; no customer login. Unknown references do not create records.

`PENDING` waits for a result. `VERIFIED` requires `Completed`, overall `status: true`, passing mandatory steps, no explicitly failed step, and the expected widget ID. Completion alone, document OCR alone, and a browser success callback never pass. Unsuccessful completed results become `REVIEW`; failures and abandoned flows retain their distinct states. New attempts use new references; delayed old events cannot verify the newer session or reverse a terminal result.

The database stores session references, environment, widget, consent version/time, status, and event digests. It does not store the raw NIN, full provider payload, returned identity record, selfie URLs or biometric images. Existing farm evidence and legacy private documents retain their existing storage rules. Logs omit provider bodies and credentials. Audit records track starts and result changes. Admin verification details show the identity result and sandbox label; required identity checks cannot be bypassed by farm approval.

Sandbox results cannot satisfy submission or approval checks when `NODE_ENV=production`. Live use requires separate live credentials/widget/subscription, `DOJAH_MODE=live`, and `DOJAH_LIVE_CHECKS=true`, followed by explicit production readiness checks. Nothing automatically enables paid live checks.

## Automated checks

```sh
pnpm --filter @leetlogic/api test
pnpm --filter @leetlogic/api test:identity
pnpm --filter @leetlogic/mobile test
```

`test:identity` applies migrations to the separate local `leetlogic_identity_integration` schema. It uses mocked provider responses, real PostgreSQL, and the real authentication middleware; it never calls Dojah or spends verification credits. Audit rows remain append-only. It rejects a non-local database host.

## Provider references

- [Hosted flows](https://docs.dojah.io/api-reference/hosted-flows-easyonboard/how-hosted-flows-work)
- [React Native and Expo limitations / hosted URL](https://docs.dojah.io/api-reference/widget-sdks/react-native)
- [Webhooks and raw-body signatures](https://docs.dojah.io/api-reference/core-concepts/webhooks-signatures)
- [Server reconciliation](https://docs.dojah.io/api-reference/verifications/get-verification)
- [Sandbox and production](https://docs.dojah.io/api-reference/get-started/environments)

If consent is selected but verification cannot open, check the root `.env` path and `DOJAH_ENABLED=true`. The app keeps the consented launch action available so the server can report configuration errors and a previously loaded unavailable state cannot permanently disable it. Missing server credentials are reported as `IDENTITY_NOT_CONFIGURED`, without exposing their values.
