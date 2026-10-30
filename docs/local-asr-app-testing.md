# Test guided listing with the local Meta service

The phone talks to the existing authenticated LeetLogic API. The API forwards recordings to a single Meta worker on `127.0.0.1:8091`. No model runs on the phone. This is an opt-in **English testing mode**, not a release of validated multilingual transcription.

## Prerequisites

- The checkpoint and Python runtime from the local benchmark are installed.
- Python environment includes the bundled phone-audio decoder: `.local/asr-benchmark/venv/bin/python -m pip install -r scripts/asr/requirements.txt`.
- Run `pnpm install` after pulling the code to obtain `expo-speech`, which reads prompts using Expo's standard speech module.
- PostgreSQL and Redis are running (`docker compose up -d postgres redis`).
- Phone and Mac are on the same Wi-Fi for Expo LAN mode. The API must be reachable on the Mac's port 3000.

## Terminal 1: Meta service

```bash
cd /Users/greatadams/Documents/ChatGPT/LEETLOGIC
bash scripts/asr/start-local-service.sh
```

Wait for `ASR ready: http://127.0.0.1:8091/health (English test mode)`.

The script uses the downloaded checkpoint, exposes the soundfile library to the native runtime, and loads one CPU model with two Torch threads. The first run creates `.local/asr-benchmark/service.env` with a private random service token (file permissions 0600). Leave this terminal running. Ctrl+C stops the worker.

Check readiness from another terminal:

```bash
curl http://127.0.0.1:8091/health
```

Expected JSON includes `"status":"ready"`, `"provider":"meta"`, and `"languages":["en"]`.

## Terminal 2: restart backend with ASR enabled

Stop an existing backend dev process with Ctrl+C before restarting on the same port.

```bash
cd /Users/greatadams/Documents/ChatGPT/LEETLOGIC
set -a
source .local/asr-benchmark/service.env
set +a
pnpm --filter @leetlogic/api dev
```

This supplies `LISTING_ASR_ENABLED`, `LISTING_ASR_URL` and the private token to the API. The normal root `.env` continues to supply database, Redis and authentication settings. Never put the service token into `EXPO_PUBLIC_*` variables or the mobile app.

## Terminal 3: restart Metro in server-voice mode

```bash
cd /Users/greatadams/Documents/ChatGPT/LEETLOGIC
EXPO_PUBLIC_LISTING_VOICE_PROVIDER=server pnpm --filter @leetlogic/mobile start --clear --lan
```

Scan the QR code/open the app, sign in as a farmer and start a listing. Select **Use guided voice · English**. Existing drafts also offer switching to guided voice. On physical iPhones, turn off Silent mode and raise the volume if prompts cannot be heard.

The app normally derives the Mac API address from Metro. If a custom backend address or port is needed:

```bash
EXPO_PUBLIC_LISTING_VOICE_PROVIDER=server EXPO_PUBLIC_API_URL=http://YOUR_MAC_LAN_IP:3000 pnpm --filter @leetlogic/mobile start --clear --lan
```

Use your actual Mac LAN IP in that optional command, not `localhost` on the phone. The phone does not connect to port 8091 directly. Metro tunnel mode alone does not expose the API.

## What to test

1. Listen to the question, answer, then pause briefly or tap **Done speaking**. Recording ends after approximately 1.5 seconds of detected silence or at the recording cap. A manual Done control also works where metering is unreliable.
2. The app displays that it is transcribing, then reads the interpreted answer back. Say yes/no to confirm or replace it. Spoken commands cannot submit the listing.
3. Try price and quantity answers carefully: e.g. `twenty five`, `one thousand five hundred`, and a rejection/correction. The initial synthetic benchmark contained numeric errors; do not assume a readable transcript is correct.
4. Test Pause/backgrounding while recording and while uploading. Temporary recordings must be removed after cleanup; cancelled/late results must not change fields.
5. Stop Terminal 1 and attempt Voice again: the app must offer typing and preserve confirmed answers.
6. Complete photos and final review. Use only a test listing/account if submitting; final submission still follows normal marketplace moderation.

Only English is enabled. The service rejects other language requests until their prompts, extraction rules and accuracy have been validated. The opt-in flag leaves the existing device provider as the default when omitted.

## Implementation and checks

- Standard `expo-audio` records mono AAC/M4A. `expo-speech` reads prompts and is included in compatible Expo Go builds; the custom native speech module is not required in server mode.
- Temporary phone audio uploads through the authenticated API, with a 2 MiB limit, cancellation, timeout and per-account attempt limits. The Python worker checks its private token, decodes in memory, enforces duration and handles one inference at a time. Busy/unavailable service responses pause the flow.
- API endpoints: `GET /v1/listing-drafts/voice/capabilities` and `POST /v1/listing-drafts/voice/transcribe?language=en` (authenticated).
- Local synthetic HTTP smoke test: `.local/asr-benchmark/venv/bin/python scripts/asr/smoke_test_service.py`.

Real WAV and M4A HTTP transcription were exercised locally. Automated tests cover the recorder, cleanup/cancellation and backend forwarding. These are not a substitute for testing microphone input, silence detection, speakers and networking on the actual phone.
