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

Out of scope: admin UI on mobile, payment collection, wallet/withdrawals, invented bank/USSD details, unsupported courier promises, driver calls, GPS maps, speeds/temperatures, recommendations, social chat, general AI assistance, automatic spoken translation, image recognition and language-pack downloads. Automatic speech transcription remains unavailable until the accepted free Igbo speech provider milestone passes. Listing detail entry supports optional device-only voice recording/playback, with microphone access requested only after the farmer taps Record.

## Dojah identity checks

Seller identity verification now uses Dojah’s hosted flow, opened in the phone browser so Expo Go remains supported. Configure the sandbox widget, mandatory matching/liveness steps, server credentials and signed webhook before testing. See [Dojah setup and test instructions](./dojah-identity.md). Identity verification remains separate from farm approval.

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

For Expo Go on a physical phone, keep the phone and computer on the same Wi-Fi and start Metro in LAN mode:

```sh
pnpm --filter @leetlogic/mobile start --go --lan --clear --port 8082
```

Scan the QR code with Expo Go. The app automatically uses Metro's local network host for the API on port 3000 and prints `[LeetLogic API] http://<computer-address>:3000` in the Metro console. The backend must also be running in its own terminal (`pnpm dev`); Metro does not start it. Simulator loopback remains supported: iOS uses `localhost`, and Android uses `10.0.2.2`.

If connection fails:

1. Open `http://<computer-address>:3000/health/ready` in the phone's browser. Find the Mac's Wi-Fi address with `ipconfig getifaddr en0`. The response should say `ready`. If it fails on the Mac too, start the backend and PostgreSQL/Redis; if it works only on the Mac, check Wi-Fi isolation, firewall access, and Expo Go's Local Network permission in iOS Settings.
2. Check the `[LeetLogic API]` console line. An old `EXPO_PUBLIC_API_URL` override takes priority over detection. Remove it or set it to the correct reachable API origin in `apps/mobile/.env`, then restart Metro with `--clear` and reload Expo Go.
3. A Metro tunnel forwards the JavaScript bundle only, not the backend. Use LAN mode for console-OTP testing. With a separately deployed backend, explicitly configure its HTTPS origin through `EXPO_PUBLIC_API_URL`.

To override detection, copy `apps/mobile/.env.example` to `apps/mobile/.env` and set `EXPO_PUBLIC_API_URL` to the desired API origin. Only the API origin belongs in an Expo public variable; provider keys remain on the server. Release builds require HTTPS. Console OTP is for local development only: read the actual code from the API terminal. No fixed test OTP or authentication bypass is included.

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

## Seller dashboard and navigation

The seller home follows Figma `2575:22158`. Signed-in seller mode uses **Home, Listings, Sell, Orders, Menu**; buyer mode retains **Home, Search, Orders, Menu**. The compact 28px active pill and neighbouring tabs animate together. Reduced motion is respected. Application verification and listing review remain separate from the main tabs.

The home screen reads actual owned listings, drafts, seller sales, account verification and earnings. It refreshes on returning to the app or pulling down. Available earnings exclude held/reserved funds. Identity and payment badges require confirmed backend state; no sample balances or orders are shown. “Withdraw” opens the existing payment setup/withdrawal screen.

Only funded orders that have not been picked up are counted as ready to pack. Unpaid purchases are not counted as sales. “Review order” opens the existing delivery detail; this change does not add a new order-acceptance state or release escrow. Low-stock alerts currently mean **at most two unreserved selling units**, with zero-available and paused listings excluded.

Drafts saved on the device appear separately from server drafts. Resume edits the same server draft; delete affects only an owned unsubmitted draft. Unapproved farmers can save/review drafts, but submission still requires farmer approval and listing moderation. Restock sets the **total** stock, including reserved units, so repeated submissions do not add inventory twice. Stock cannot be reduced below reservations, and inventory controls cannot activate unreviewed/rejected listings. Changes are audited.

Manual checks in Expo Go:

1. Sign in as a seller: confirm the farm dashboard and five seller tabs; check Home → Listings → Sell → Orders → Menu, then language changes and reduced-motion settings.
2. Check an approved, pending and rejected seller: badges/actions must follow actual status. Payment setup must not appear linked until the payment account is ready.
3. Save a produce draft, return Home, resume it, update it and delete it. Confirm submission remains blocked without approval.
4. Restock or pause an approved listing; verify the quantity/status after refreshing. Try reducing stock below reserved orders and confirm the actionable error.
5. Confirm paid sales appear in seller Orders while the same account's purchases appear only in buyer mode. Buyer navigation and marketplace remain unchanged.

Menu responsiveness: tab movement uses native transforms/opacity; tab widths change once per selection instead of being recalculated on every animation frame. The green pill uses fixed-size end caps and a transformed middle, retaining its 28px rounded shape. Menu shows cached account information immediately and schedules its initial refresh for idle time. Concurrent account reads share one request; unchanged account data does not trigger an app-wide state update. Icon XML is cached and repeated icon instances share disk reads. The navigation badge refreshes on entering the app, without fetching all seller orders on every tab tap. Component regression tests cover repeated Menu transitions, refresh cancellation, native animation settings and bounded renders; device-level smoothness remains part of the manual Expo Go checks.

Farm pickup: onboarding saves the farm address once. New listings default to that primary address; existing drafts keep their saved location. Menu → Farm location shows the primary farm without asking for a second pickup address. In an unpaid seller order, **Use a different pickup address** allows an owned saved address or adding another one. `POST /v1/orders/:id/delivery/pickup` is farmer-only, checks checkout/payment locks, snapshots the address for that order, invalidates old quotes, and audits the change. It does not change the farm or other orders. The buyer must obtain a fresh quote before paying.

Farm map pins: tap **Use my current location** in the seller farm-address step, confirm the centred pin by moving the map or tapping the collection point, then save the address. Existing farmers can add/update their pin through **Menu → Farm location**. Foreground permission is requested only after tapping; there is no background tracking. A fresh high-accuracy fix is requested with a 20-second timeout. Reported accuracy appears before confirmation; approximate results show a warning. Manual map selection remains available when permission is denied or GPS is unavailable. No default Nigeria-centre pin is saved automatically. Pins use the existing private address latitude/longitude fields and are included in authorized order pickup snapshots; public listings show only city/state/LGA and, for nearby searches, an approximate distance. Shipbubble still receives its documented postal-address fields, without unsupported coordinate fields.

For Expo Go testing, restart Metro after installing dependencies. Set a simulated device location in your simulator/emulator, or test outdoors on a physical device to assess actual GPS accuracy. Native store builds need the Android Google Maps SDK/API-key configuration described in the [Expo map documentation](https://docs.expo.dev/versions/latest/sdk/map-view/); Expo Go provides its own map setup. Do not put server API credentials in the mobile app.

The map picker is a bottom sheet with a top-right close button, backdrop dismissal and fixed footer controls. The map is outside any ScrollView; its centre pin follows completed pan/zoom gestures. GPS recentres an open map. Closing discards an unconfirmed point and ignores any late GPS result. The initial regional map centre is never treated as a selected pickup point.

All custom mobile modals use `AppSheet`: a rounded bottom sheet, top-right close control, backdrop/Android-back dismissal, safe-area spacing, and fixed footer actions. Forms scroll with keyboard avoidance; maps and option lists keep their own gestures. Saving blocks dismissal. Adding a bank uses details → review → verification within a single sheet; closing a pending verification preserves the operation and exposes View bank verification rather than submitting again. Withdrawal details and review stay in one sheet and submit only after explicit confirmation.

### Seller listing flow

The Sell tab opens a focused four-step flow based on Figma `2575:22177`:
category, produce details, photos, and review. Back preserves entered details;
closing saves a device draft. Saved server drafts reopen for editing. The farm
address is the default pickup address; order delivery can use a separate pickup
address when necessary. Local delivery means within the farm's state; nationwide
delivery still requires an eligible route and parcel quote.

Provide at least one real produce photo (maximum four JPEG/PNG images, 10 MB each).
The farmer can replace/remove photos and choose the cover. Photos remain private
until listing approval. Quantities follow the selected unit's decimal rules and
prices are stored as exact NGN minor amounts. Explicit review is required before
submission. Submitted listings are **pending review**, not immediately live.
AI grading, automatic voice transcription, automatic image identification, and sharing an
unapproved listing are not part of this flow.

For a new database, add the seven produce categories and selling units without
creating demo users/listings or overwriting staff-managed translations:

```sh
pnpm --filter @leetlogic/database seed:catalogue
```

Simulator checklist: select a category, go forward/back, close and recover a
draft, change unit, try a fractional whole-unit quantity, upload/replace/reorder
photos, verify the cover on review, then confirm submission. Check the pending
status in My listings and approve through the existing admin moderation flow.
Repeat with each language and a narrow screen. Camera/library denial and failed
uploads should leave the draft editable with a visible error.

Listing categories are Vegetables, Fruits, Grains, Roots & Tubers, Legumes, Oils,
and Processed Produce. The actual product name is entered in step two. Re-running
`seed:catalogue` moves existing product categories and saved server drafts to these
groups, retains old records for history, and hides them from selection. Device
drafts recover through catalogue aliases. This does not enable new delivery
commodities: provider eligibility still requires explicitly configured category IDs.

### Listing review and private voice drafts

Step 4 displays every uploaded photo, the selected category, produce details,
price/quantity, delivery scope and full farm address. Photos are grouped into a
cover preview and compact thumbnails immediately above the details. There is no
voice recording card on this review step.

Step 2 offers an optional voice aid beside the editable product fields. It can
capture a farmer describing the produce and other details in their own language.
Recording is limited to 30 seconds and stops when the app leaves the foreground.
It supports playback, re-recording and removal. Continuing or leaving the details step stays blocked
while recording or saving.

Voice recordings and their metadata remain in account-scoped storage **on that
device**. They are not sent to the API, Cloudinary, buyers, or a speech provider.
Saved recordings remain local until removed or app data is cleared. Re-recording
replaces the previous note. Typed listing fields and explicit confirmation are
still required. This does not satisfy the separate speech-to-listing launch
milestone; no transcription or automatic translation is advertised.

After installing the audio dependency, restart Metro with
`pnpm --filter @leetlogic/mobile start --clear`. Expo Go supports the audio module;
custom native builds need rebuilding to pick up the microphone permission.
Simulator/device checks: preview all four photos, deny/allow microphone access,
record/stop, reach the 30-second limit, play/replay/remove, go back and return,
restart the app, and switch accounts. Confirm a voice note never appears in any
network request. Interactive microphone/speaker checks remain manual.

### Account entry and farmer device security

Signing out clears the session, account mode and navigation history immediately and returns to language selection. Buyers can choose their role and browse without signing in; account actions still require a phone code. A newly verified phone without an account preference or farmer profile must choose its role. Role preferences and device security belong to the verified user ID, not the last phone used on the device.

Farmers create and confirm a four-digit device PIN. Returning farmer sessions require that PIN, and leaving the app in the background for at least 30 seconds locks the farmer workspace. Optional Face ID, Android face unlock or fingerprint authentication uses the enrolled device capabilities with strong Android biometrics required. Biometrics do not replace Dojah identity verification or server authorization for payments. Five incorrect PIN attempts trigger a persisted one-minute cooldown. “Sign in with a code instead” requires another phone OTP before creating a replacement PIN for that same account.

PIN flows can be tested in Expo Go. Face ID requires an iOS development build with the configured usage permission; restart Metro after installing dependencies and rebuild the native development client to include `expo-local-authentication`. Simulator biometric enrollment and success/failure simulation must be configured in the simulator. Test new-phone role selection, buyer guest browsing, farmer PIN confirmation, cancelled biometric prompts, background locking, recovery and logout with an unavailable API. Interactive simulator testing remains a manual check.

### Buyer area filters and categories

“Shop near you” requests foreground device location on the buyer marketplace, including before sign-in, using the same fresh high-accuracy fix and 20-second timeout as farmer pins. Results use straight-line distance to confirmed farm/listing pins, ordered nearest first, within 50 km by default; buyers can select 25/50/100/200 km. Farms without pins are available through the manual area filters. A device fix refreshes when the app returns to the foreground or the buyer taps Refresh; no background tracking is enabled. Device mode and radius are saved locally, without storing precise buyer coordinates. Manual state/LGA choices override GPS and are saved per account/guest. Permission denial, disabled location services and timeouts leave manual browsing available. Public results show approximate distance, not farmer coordinates. In the simulator, set a simulated location near an existing farm pin before testing.

Staff with `catalog.manage` can manage categories at `/admin/categories`: English name, optional Pidgin/Hausa/Igbo/Yoruba names, slug, display order and active status. Changes appear on the next catalogue fetch. Deactivating a category prevents selection for new listings and preserves existing listings and orders. Category changes are recorded in the audit log. No migration or provider key is required.
