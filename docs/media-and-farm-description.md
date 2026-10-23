# Images, videos, and farm descriptions

## Current storage and Cloudinary activation

Until Cloudinary is activated, uploads live in `PRIVATE_STORAGE_ROOT` (`.private-objects`, relative to the API process directory). Produce photos use `produce/<id>`; private verification evidence/documents use farmer-specific paths. PostgreSQL stores references and metadata, not image/video bytes. Existing files are not migrated or deleted by this change.

New images, farm-evidence videos, and legacy PDF document uploads can use Cloudinary. Add these values to the repository-root `.env`:

```dotenv
MEDIA_STORAGE=cloudinary
CLOUDINARY_CLOUD_NAME=<product environment cloud name>
CLOUDINARY_API_KEY=<API key>
CLOUDINARY_API_SECRET=<API secret>
```

Keep all credentials server-side. Restart the API after configuration. No unsigned upload preset is needed. Leaving `MEDIA_STORAGE=local` preserves local development behavior. Cloudinary errors do not silently fall back to disk.

Apply the additive migration with `pnpm --filter @leetlogic/database exec prisma migrate deploy` and generate/build the database package if setting up a new checkout.

All assets are uploaded with Cloudinary `authenticated` delivery. The server signs short-lived download requests only after the existing owner/public-listing or staff authorization checks. No reusable Cloudinary signed URL or API secret is returned to the app. Existing local references remain readable even after switching providers. A Cloudinary upload is deleted if saving its database reference fails. Listing photos retain checksums; private identity documents retain checksums and audit logging. Farm evidence remains private to the verification review.

Images/PDFs are limited to 10 MB; farm videos to 25 MB, MP4/MOV. Videos are accepted only as farm evidence, not identity documents or produce listing photos. File headers are checked server-side. Video capture is not requested; farmers can choose an existing video. Test actual uploads/downloads with the configured Cloudinary account before rollout, including the account's private/raw PDF settings. No live credential test has been possible while credentials are absent.

## Step 4: English description review

Farmers can type a supporting note and request English translation for Hausa, Igbo, or Yoruba through the existing Azure F0 translation service. The endpoint requires the authenticated farmer's editable verification case. The translated draft is editable and is not applied to the application until the farmer selects **Use this description**. Existing final declaration and submission checks remain in place. Pidgin automatic translation is not offered. Outages/quota limits retain the original and show a user-facing error; no paid upgrade occurs.

`POST /v1/seller/verification/description/translate`: `{text, sourceLocale}` (max 2,000 characters), returns `{text, original, translated, reason?}`. Translated text uses the existing resource-scoped cache and monthly usage cap. This is text processing, not speech transcription.

## Voice remains blocked — free production provider required

`GET /v1/seller/verification/voice` reports `enabled:false` and `acceptsAudio:false`. Microphone recording/upload is not enabled. The app does not collect or retain voice recordings and does not send them to Cloudinary. This does not claim that voice transcription is implemented.

On 2026-10-23, [Naija Speech API](https://asr.naijallm.com/) advertised free Igbo recognition and in-memory processing, but its published licence explicitly excludes commercial products without a separate licence. It is not eligible for LeetLogic as currently offered. Other advertised free services have not been validated for production terms, Igbo accuracy, and non-retention; no unverified endpoint is wired into the app.

Before enabling recording, obtain a free hosted service with explicit commercial permission and no recording retention, verify its documented endpoint and credentials, and run the agreed consented Igbo pilot (50 recordings, at least 95% correct numeric fields, native-speaker review). Implement short-lived on-device capture, server memory-only processing, deletion of temporary device recordings on success/failure/cancel/unmount, speech-to-text followed by English translation, and explicit farmer text review. Never store voice bytes in Cloudinary, PostgreSQL, Redis, files, or logs. Keep typed descriptions available. Voice-enabled launch remains incomplete until this milestone passes.

## Checks

Storage protocol tests mock Cloudinary, verifying authenticated uploads, signed expiry, deletion, backward-compatible reads, traversal rejection, and no local fallback. Admin integration checks private image/PDF/video access, identity-video rejection, voice gating, description authentication, submission, and review. Test scripts force local media storage to avoid uploading fixtures to real Cloudinary accounts.
