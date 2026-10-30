# Guided produce listing: English release acceptance

## Scope and decisions

Farmers choose Type or guided Voice before a new listing. Existing drafts open in Type unless previously saved in Voice. English instructions, transcription, commands and readback are the initial scope. Recognition requires on-device processing and never retries through a network recognizer. Audio recordings are not persisted or uploaded. Each confirmed answer is saved before asking the next question. Confirmed text is saved in the existing user/draft-scoped local draft; normal listing data and photos still use the API.

Native development/release builds are required: Expo Go does not contain the new speech modules. Android needs a supported on-device recognizer with an installed English model and an installed English TTS voice that does not require a network connection. The initial Android adapter checks Google's on-device recognition service. Other devices retain Type. iOS checks English recognizers individually rather than assuming the system language supports offline English. Both platforms can fail at runtime; errors pause the flow without confirming or advancing an answer.

## Required fields

The listing has six steps: Voice or Type, category, produce details, packaging and price, photos, and review. Guided Voice fills the category and details conversationally, then opens the packaging step to confirm how the produce is sold. Category-dependent package and size dropdowns include custom sizes and an Other / Custom option. Quantity counts the chosen selling units; the price is for one such unit. Changing the category or selling package clears incompatible price, stock, and parcel measurements.

Commercial `salePackaging` describes the priced selling unit (for example, one 50 kg bag), independently of courier `packaging` measurements. Commercial details remain available when packing assistance is requested. No courier measurements are guessed. Monetary displays use thousands separators and exactly two decimal places; editable amounts preserve an unformatted decimal string and convert to integer kobo at the API boundary. Saved device drafts use `flowVersion: 2`; the former photos step is restored to its new position.

| Field                | Requirement                                                                                     | Voice behavior                                                                          |
| -------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Produce title        | 2–160 characters                                                                                | Ask what is being sold; read back the title                                             |
| Category             | Current active catalogue category                                                               | Read available categories; accept its name or spoken list number                        |
| Description          | Nonempty, maximum 5,000 characters                                                              | Ask variety, freshness and condition                                                    |
| Selling unit         | Current catalogue unit                                                                          | Accept explicit aliases; explain tuber = PIECE                                          |
| Available quantity   | Positive, up to 9 integer and 3 fractional digits; whole numbers for indivisible units          | Ask a separate numeric question; reject ambiguous numbers                               |
| Price                | Positive NGN amount per selling unit, up to 10 integer and 2 fractional digits                  | Confirm exact naira amount and unit; convert to kobo with integer arithmetic            |
| Farm address         | Existing owned, nondeleted Nigerian address                                                     | Read numbered saved addresses and confirm full selection; stop if none exist            |
| Delivery scope       | LOCAL or NATIONWIDE                                                                             | Explicit local/nationwide question                                                      |
| Packing              | Complete valid measurements **or explicit packing assistance**                                  | Ask whether measurements are known; confirm help request and purchase restriction       |
| Package measurements | Selling units per package; packed kg including packaging; length, width, height in cm; handling | Ask individually, with units; no guessed measurements                                   |
| Handling             | STANDARD, PERISHABLE, COLD_CHAIN or BULK                                                        | Ask explicitly when entering measurements; staff must complete it for assisted listings |
| Photos               | 1–4 owned uploaded images; first image is cover                                                 | Spoken camera/library and cover instructions; actual capture/selection uses buttons     |
| Final confirmation   | Farmer confirms the review and presses Submit listing                                           | Readback available; speech cannot submit                                                |

Package notes are optional. Package units permit at most three decimal places, maximum 1,000,000, and must be whole for indivisible selling units. Weight is positive and at most 1,000,000 kg. Dimensions are positive and at most 1,000 cm. For KG sales, packed weight must be at least the selling kilograms in the package. No valid measurements are invented for assisted listings.

## Concrete acceptance criteria

1. A new listing offers Type and guided Voice before showing category/details fields. Selecting Type retains the existing manual workflow.
2. Voice checks permissions, offline English recognition and English speech output before opening the microphone. Missing support presents a primary Continue by typing action and optional voice retry, without installation instructions; no cloud fallback occurs.
3. Each question is spoken before listening begins. Each recording is bounded to 30 seconds and supplies only the current field. Only a final transcript is interpreted.
4. Every interpreted answer is spoken back with its numeric unit or price basis. Only exact affirmative commands commit it. No/repeat/back and “change price” (or another supported field name) permit corrections without erasing unrelated answers.
5. Ambiguous quantities (for example “one or two”), invalid catalogue entries, fractional pieces, excessive precision and out-of-range measurements do not advance the flow.
6. Changing the selling unit invalidates quantity, price and packaging values so they must be confirmed again.
7. Pause, backgrounding, permission loss, unavailable speech or recognition failure stop active speech/listening. Late results cannot update the draft. Confirmed answers survive resume/restart and switching to Type.
8. Full measurements and assisted packing both reach the packaging confirmation step, then photos and final review. Missing required nonpacking fields still block progression. Missing saved farm address requires profile setup; the app does not invent an address.
9. Assisted listings submit as PENDING_REVIEW with an explicit assistance flag. Staff cannot activate them; farmer resume, public discovery and buyer order creation also reject them, including incorrectly activated database records.
10. Authorized catalog staff complete measurements through the standard admin action dialog, supply a reason and generate an audit record. Values must match the listing unit. Completion leaves the listing PENDING_REVIEW; publication remains a separate moderation action.
11. Final review displays all normal listing fields, photos and packing-help status and offers spoken readback. Editing uses the existing draft editor and clears final confirmation. Submission requires the existing confirmation control and physical Submit listing button, approved farmer, valid fields and owned photos.
12. No spoken command can call submission or bypass API ownership, verification, photo, inventory or moderation checks.

## Automated verification

- English number grammar, strict confirmation commands, field extraction, catalogue/unit validation, range checks, unit dependency invalidation, assistance payload and saved-draft recovery.
- Guided conversation: complete assisted flow, negative confirmation and replacement, missing offline support, ambiguous answer, and ignoring a late recognition result after backgrounding.
- Existing mobile wizard, review, authentication and localization regressions.
- Database integration: assisted draft submission, activation/resume/discovery/purchase blocking, invalid completion, unauthorized completion, audited staff completion, separate moderation and purchase after completion.
- Mobile/API/admin TypeScript checks; iOS and Android JavaScript export; Expo module autolinking and Swift syntax parse.

## Required physical-device release checks

The automated tests mock device speech. They do not establish native compilation, microphone quality, recognition accuracy, installed voice behavior or accessibility on actual hardware. Before releasing Voice, build both native targets and verify:

- Android with offline English model + offline English voice; iPhone with on-device English support; test in airplane mode with Wi-Fi disabled.
- Device whose system language is not English but offline English is available.
- Missing English model, missing English voice, unsupported recognizer, denied/revoked microphone permission, and Expo Go: useful Type fallback without installation instructions without an app crash.
- Background/foreground, phone/audio interruption, Pause while speaking and while listening, repeated rapid pause/resume, and process restart after confirmed answers.
- Quiet and farm-noise recordings with representative Nigerian English speakers; explicitly verify quantities, prices, KG/PIECE and address readbacks. No automatic correctness claim is made from transcription alone.
- Correct a rejected answer and jump to a prior field; change selling unit; verify dependent values are re-entered.
- Camera/library cancellation and upload failure, cover selection, final readback, edit/review cycle, and explicit button-only submission.

Native build and physical-device checks remain release gates until recorded as completed. English prompts/parser live in a locale profile; Pidgin, Igbo, Yoruba and Hausa speech profiles are intentionally not enabled.

## Verification recorded on 29 October 2026

- Mobile: 299 tests passed across 50 files.
- API unit suite: 85 passed; 75 integration tests skipped by the default runner. The dedicated delivery/listing database suite ran separately: all 29 passed.
- Mobile, API and admin web TypeScript checks passed.
- iOS and Android JavaScript/Hermes exports passed.
- Both platforms discover the local speech module through Expo autolinking; Swift syntax parsing passed. These checks do not replace a native compile.
- Packing-assistance migration applied to localhost development database and isolated integration schema.
- Native compilation and physical-device speech checks remain outstanding. CocoaPods is not installed in this environment; no native build success is claimed.
