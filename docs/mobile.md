# Mobile app and simulator pilot

The native client lives in `apps/mobile` in this monorepo and uses the existing Express API, database, identity, moderation and delivery services. It does not replace or duplicate the Next.js website/admin app.

## Implemented scope

The supplied Figma section (2575:21950) contains hundreds of screens. This pilot implements the core marketplace flow rather than treating every design as a product requirement:

- Language choice, the three introduction screens, buyer/seller role selection and Nigerian phone OTP sign-in.
- SecureStore access/refresh tokens and device ID, coalesced refresh requests, authenticated profile and sign-out.
- Public approved produce discovery, category/search filters and product details; authenticated resource translation.
- Customer order creation with transactional inventory reservation, idempotent duplicate submission and cancellation of owned unpaid orders. Customer inputs never set a price or escrow balance.
- Saved Nigerian addresses, personal details, farmer profile, private identity-photo upload and verification submission.
- Farmer produce listings; typed details and photo capture/library upload; a local draft per account, server draft validation, explicit review and moderation submission.
- Orders, delivery quote selection with expiration, separate shipping charges, actual carrier timeline, eligible booking and recipient confirmation. These call the existing delivery APIs and preserve their provider gates and dispute checks.
- In-app delivery notifications and FAQs in the selected locale.

Mobile interface text is bundled for `en`, `pcm`, `ha`, `ig` and `yo` in `apps/mobile/src/locales/ui.json`, including all three intros, navigation, forms, dialogs, status labels, units, validation, empty states and accessibility labels. Shared message keys and published server overrides remain compatible with the web workflow. Selecting a language updates the interface immediately; serialized device/server writes preserve the final choice, including first OTP sign-in. Interface translation works offline and does not consume Azure quota. Unknown backend/provider error prose is replaced by a localized error instead of leaking English text. The translations still require native-speaker editorial review before production.

The bundled LeetLogic logo appears at every launch before fonts or session preferences finish loading, rather than a blank screen or spinner. The native splash plugin also uses that logo in rebuilt device binaries; Expo Go does not reproduce a custom native splash fully. Proper names, identifiers, addresses, amounts and farmer-authored listing text are preserved. Dynamic resource translations still use the separately configured Azure service; operating-system permission screens use the device language.

Out of scope: admin UI on mobile, payment collection, wallet/withdrawals, invented bank/USSD details, unsupported courier promises, driver calls, GPS maps, speeds/temperatures, recommendations, social chat, general AI assistance, audio playback, image recognition and language-pack downloads. Voice is explicitly unavailable until the accepted free Igbo speech provider milestone passes. The native config does not request microphone permission.

## Run

From the repository root:

```sh
pnpm install
pnpm db:generate
pnpm --filter @leetlogic/contracts build
pnpm --filter @leetlogic/localization build
docker compose up -d postgres redis
pnpm dev
```

In another terminal:

```sh
pnpm --filter @leetlogic/mobile ios
# or
pnpm --filter @leetlogic/mobile android
```

The iOS simulator uses `http://localhost:3000`; the standard Android emulator uses `http://10.0.2.2:3000`. For a physical device, copy `apps/mobile/.env.example` to `apps/mobile/.env` and set `EXPO_PUBLIC_API_URL` to the computer's reachable LAN address. Only the API origin belongs in an Expo public variable; provider keys remain on the server. Release builds require HTTPS. Console OTP is for local development only: read the actual code from the API terminal. No fixed test OTP or authentication bypass is included.

SDK 57 uses the compatible Expo Go build installed by Expo CLI. See [Expo simulator setup](https://docs.expo.dev/workflow/ios-simulator/) and [version compatibility](https://docs.expo.dev/troubleshooting/expo-go-version-mismatch/). A device build will need the normal app signing and permission checks before distribution.

If Android stays offline with hardware graphics, close that emulator and retry without wiping it:

```sh
~/Library/Android/sdk/emulator/emulator -avd Medium_Phone_API_37.0 -no-snapshot-load -no-boot-anim -gpu swiftshader -cores 2 -no-audio
```

## Checks and pilot checklist

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm --filter @leetlogic/mobile build
pnpm --filter @leetlogic/mobile exec expo install --check
pnpm --filter @leetlogic/api test:delivery
pnpm --filter @leetlogic/api test:admin
```

The delivery integration suite runs in a separate PostgreSQL schema/Redis database. It covers public listing data minimization, customer authentication, concurrent duplicate orders, stock reservation, insufficient stock, self-purchase denial, address ownership, unpaid-order cancellation and the prior delivery/language cases. Native domain tests cover exact monetary conversion, ambiguous inputs, quantity precision and HTTPS tracking links. Test data does not seed the normal customer marketplace.

Still perform the following on real interactive simulators/devices before calling the mobile pilot validated:

1. Select each locale, restart, confirm persistence and published-message/English fallback. Finish all intros and choose both roles.
2. Request a real development OTP; reject incorrect/expired codes, verify resend cooldown, sign in, restart and exercise refresh/logout.
3. Browse actual approved records, search/filter and create an order. Retry a timed-out submission; confirm exactly one reservation. Cancel an unpaid order and confirm stock restoration.
4. Add a pickup/delivery address. Complete seller verification with test-only identity imagery, approve through the existing admin, create a produce draft and attach a test JPEG/PNG.
5. Deny camera/library access, interrupt an upload, restart the draft and check private-image access. Inspect the review photo and all fields; no submission without confirmation. Verify moderation status rather than instant publication.
6. With Shipbubble test access explicitly enabled, exercise quote selection/expiration, unsupported produce, funding, booking uncertainty, duplicate events, cancellation/returns and customer confirmation. Provider delivery alone must not release escrow.
7. Check small/large screens, keyboard avoidance, back navigation, text scaling, screen-reader labels, poor connectivity and loading/error/empty states.

Both native bundle exports are build checks, not substitutes for those interactive tests. iOS installed Expo Go but opening the project timed out; UI automation for Device Hub was denied. Android became reachable after the software-rendering restart and the app rendered its language screen. That screenshot exposed cached SVG loading and a stray React Native text node; both were corrected before the final rendering check. UI automation permission is unavailable for Android Studio. The user chose to handle interactive simulator testing. Simulator test status must distinguish screen rendering from completed sign-in/order/photo scenarios.

## Additional API surface

- `GET /v1/marketplace/categories`, `/listings?search=&categoryId=`, `/listings/:id` are public and expose no farmer street address or private phone/email.
- `GET /v1/marketplace/my-listings` returns the authenticated farmer's records.
- `POST /v1/marketplace/orders` accepts `{listingId, quantity}` and a UUID `Idempotency-Key`. It derives buyer, price, fee and farmer on the server. Keep the same key when retrying an uncertain response; change it when intentionally changing the order input.
- `POST /v1/marketplace/orders/:id/cancel` requires the owning buyer and an unpaid, unbooked order; repeated calls release inventory once. Paid/dispatched cancellations require staff.
- `POST /v1/me/addresses` accepts label, state, LGA, city and line1. Country and owner are assigned on the server.
- Seller profile accepts an optional full `line1` farm address while retaining compatibility with existing clients.

Full dynamic translation and delivery configuration remains in [delivery-language.md](delivery-language.md). Provider access, eligible routes, reviewed translations and validated Igbo speech remain production readiness gates.

## Current handoff

Android is running the language screen with the bundled Figma logo, selection indicators and arrow verified in a native screenshot. The development Tools bubble belongs to Expo Go. The final capture is `/tmp/leetlogic-mobile-handoff.png`. The API is on port 3000 and Android Metro is on port 8082. PostgreSQL/Redis remain running for manual tests. iOS was shut down after its launch timeout. Interactive sign-in, order and photo scenarios remain for the user to execute.

## Interface language and startup follow-up

Every bundled mobile interface phrase has entries for all five launch locales. Coverage tests inspect JSX copy, form/button labels, dialogs, intro configuration, shared-message keys, status labels and placeholders. Source-language identifiers and user-authored resource content are deliberately preserved. Error codes select localized messages; unknown provider prose uses a localized generic failure. Locale changes clear stale server overrides, apply immediately and persist in order, including after the first OTP sign-in.

On each cold launch, the bundled LeetLogic leaf and wordmark are visible for at least 1.2 seconds and remain while fonts/preferences load. Rebuilt standalone binaries also have the native logo splash configured. Expo Go shows its own native loading surface before the app's branded startup screen; rebuild a device binary to validate the native splash. Editorial review by speakers of each language and manual long-text layout checks remain part of release QA.

## Visible development terminals and live logs

Open the executable launchers in `scripts/terminals/` to run/read each service in macOS Terminal. The API and Metro launchers start the service; Docker launchers follow already running containers. `web.command` is available when the Next.js app is needed, but is not started for mobile-only testing. Only launch one terminal per application server to avoid port conflicts.

```sh
open -a Terminal scripts/terminals/api.command scripts/terminals/mobile.command
open -a Terminal scripts/terminals/postgres.command scripts/terminals/redis.command scripts/terminals/adminer.command
```

Terminal titles identify the service. Output is also appended under `.local/logs/` (Git ignored, directory restricted by the launcher, files mode 0600). API logs can contain development OTP codes; do not share these logs publicly. Ctrl+C stops a log stream; for API/Metro/web it also stops that server. For Docker streams it leaves the container running. The launchers use a PTY so Metro's normal keyboard shortcuts still work.

Onboarding now exposes **Change language** on all three slides and on role selection. The language picker has a back control when there is a previous screen. Finishing a change returns to the owning screen, preserving the intro slide. Account **Settings → Language** opens the same picker and returns to the account screen without replaying the intros.

### Farmer verification screens

The seller application now advances through separate screens: farm details, farm location, identity selection, document preview, supporting evidence, and final review. Continue actions stay in the footer; changing stages remounts the scroll container at the top. Back and Edit retain entered fields during the flow. Farm details and location are persisted together after the location stage. Reopening an existing application restores saved profile, documents and evidence from the authenticated API; an unfinished, unsaved first stage is retained only while this flow remains open. Identity photos require a readable-preview confirmation before upload. Supporting notes and optional private farm evidence photos use the existing review case and appear in the staff review. No identity numbers or banking details are collected. Submitted/under-review, approved and rejected cases are read-only; staff-requested corrections reopen the application.

### Phone verification design and policies

Phone and OTP screens follow Figma frames `2521:25322` and `2521:25366`. Original flag, lock, format hint and back assets are bundled with native SVG dimensions. Phone entry accepts at most 11 digits with a fixed country badge: 11 local digits beginning with 0, or 10 without the leading 0. Do not enter the country code again. Invalid/incomplete input is checked before submitting; network, cooldown, expired/incorrect OTP, provider and dependency failures have distinct messages, and server request IDs are preserved for support. Continue displays a spinner while a request is pending. OTP uses six visual boxes backed by one native input for paste, autofill, deletion and screen readers; it does not prefill the sample code in the design. Resend cooldown is calculated from a deadline and refreshed when the app returns from the background.

The website now has `/terms` and `/privacy` draft pages. In local development mobile opens the API host on web port 3001, unless `EXPO_PUBLIC_WEB_URL` is set. For release, set `EXPO_PUBLIC_WEB_URL` to the deployed HTTPS website or supply `EXPO_PUBLIC_TERMS_URL` and `EXPO_PUBLIC_PRIVACY_URL`. Review the drafts, verify the operator/support contact and approve retention periods and provider/transfer arrangements before treating them as final production policies. No live site was deployed by this change.
