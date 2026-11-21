# Guided Voice Listing: Physical Device QA

Run this checklist on a physical Android phone and a physical iPhone using the same app build and test account. Use a test farmer account and do not publish a real listing. Record device model, OS version, app build, locale, network type, result, and a screen recording or log for each failure.

## Test listing

Use rice in 50 kg bags, 20 bags available, at ₦75,000 per bag. Use a valid farm pickup address and a delivery scope supported by the test environment. When asked about courier measurements, choose packing assistance for one run and enter valid dimensions for another.

Expected review: Bag; 50 kg per bag; 20 bags; ₦75,000 per bag; 1,000 kg total stock; ₦1,500,000 gross inventory value; commission at the rate returned by the app; net farmer earnings consistent with that commission. Final review must remain editable and must not submit until the farmer explicitly taps the submit button.

## Acceptance runs (repeat each on Android and iPhone)

1. **Normal speech:** Start a new guided listing. Answer every prompt at a natural pace, confirm each interpretation, complete photos and review, and submit only in the test environment. Confirm each answer is visible before confirmation and the review values match the test listing.
2. **Nigerian English and pauses:** Repeat with at least two Nigerian English speakers. Pause for three to four seconds between words in “fifty kilograms per bag” and “seventy-five thousand naira.” The recording must remain active until Done speaking or the longer silence timeout; it must not cut off mid-answer.
3. **Package-aware answers:** Say “twenty bags,” “each bag contains 50 kg,” “₦75,000 per bag,” “two and a half kilograms,” and “half a tonne” in their matching prompts. Confirm the visible interpretation. Give a mismatched unit and an ambiguous answer (“one or two”); the app must ask again without advancing or saving the value.
4. **Correction and typing switch:** Confirm a package answer, say “change package size,” replace it, then switch to typing and back. Previously confirmed valid answers must remain, dependent quantity, price, and courier details must be revalidated when applicable, and voice must resume at the first incomplete field.
5. **Noise and recognition errors:** Repeat in quiet conditions, then with ordinary background noise. Try an unclear answer and a recognition failure. The app must offer retry or typing, preserve confirmed answers, and avoid duplicate recordings or stale answers.
6. **Microphone permissions:** Deny permission once, then deny permanently / disable it in system settings. Confirm the app explains how to recover and provides typing without discarding the draft. Re-enable permission and verify voice can start again.
7. **Connectivity:** With the server transcription provider enabled, interrupt connectivity during upload and retry after restoring it. Confirm an actionable error, no duplicate request, and preservation of the draft. Repeat with local/offline recognition where available.
8. **Interruption and recovery:** Start recording, background the app, return, close and reopen the app, and resume the draft. No recording should continue in the background; late recognition must not overwrite the current field; resume at the first incomplete or invalid field with confirmed data intact.
9. **Financial review and final submission:** Compare spoken and visible review. Confirm package, stock, scope, packing assistance, gross amount, commission rate, commission amount, and net earnings agree. Correct one value before submitting. Verify the listing appears in the normal moderation flow and that no second listing is created by retrying a completed submission.

## Pass criteria

- Every acceptance run passes on both platforms, or the failed step is logged with reproduction details and a blocking issue.
- No confirmed field is lost during retries, correction, app interruption, or switching input methods.
- No unconfirmed or ambiguous value is saved or submitted.
- Spoken and visible financial values use the same configured commission and rounding.
- Speech recognition quality is reported separately from app handling; mocked tests do not count as speech-recognition evidence.

## Results

| Platform / device | OS / app build | Locale / network | Runs passed / total | Evidence / issue |
|---|---|---|---|---|
| Android physical device |  |  |  |  |
| iPhone physical device |  |  |  |  |
