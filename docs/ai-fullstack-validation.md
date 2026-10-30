# AI contour validation

Recorded on 2026-10-20 on the local Windows development machine, branch
`feature/ai-fullstack-validation`.

## Changes covered

- Chat tools now call authenticated backend routes for translation, assist,
  summary, and one-off audio transcription. The AI service remains behind the
  backend for these operations.
- Voice uploads use multipart `POST /messages/chat/:chatId/voice`; the old
  simulated upload, transcript, and summary timers were removed. The backend
  persists the recording, calls STT, calls the shared `/summary` contract, and
  sends transcript and summary updates over WebSocket.
- `/secretary` remains for compatibility but is not used for voice summaries.
  Both chat and voice summaries use `{messages, language}` and the response
  `{summary, decisions, participants, language, provider}`.
- WebSocket event fields now match the frontend contract: `transcriptStatus`
  and `summary`.
- Backend AI timeouts are configurable and default to 120 seconds. Local
  Whisper inference has its own 120-second deadline and returns 504 on timeout.
  Provider errors become clear backend 502/504 responses.
- Frontend voice upload validation matches the backend's 20 MiB limit.

## Automated verification

Run from the repository root:

```powershell
python -m pytest ai-service/tests -q
```

Expected result: **55 passed** (including provider configuration, input errors,
mock STT, local Whisper adapter, and timeout/error handling).

Run the backend unit and integration suite from `backend`:

```powershell
$env:NODE_OPTIONS = '--experimental-vm-modules'
npm test -- --runInBand --coverage
npm run build
```

The suite includes the frontend API client and voice utility tests. The latest
run passed **57 tests in 15 suites**. Whole-backend coverage was 50.65% of
statements, 49.05% of branches, and 50.37% of lines. On the AI/message/controller
files changed for this work, coverage was 69.77% of statements and 60.46% of
functions. The CI workflow uploads the coverage output as an artifact. It also
builds the frontend and backend and keeps the existing AI tests and Docker
build.

The local frontend production build passed with `node
node_modules/next/dist/bin/next build`.

## Real local provider smoke run

The model was loaded in LM Studio as `qwen3.5-4b`, context 4096. `lms ps`
reported the model loaded; NVIDIA telemetry showed an RTX 2080 Ti with 11 GiB
total memory and 4.36 GiB in use while it was loaded.

With `AI_MOCK_MODE=false`, `AI_PROVIDER=lmstudio`, and
`STT_PROVIDER=openai_compatible`, the manual backend `TranslationService` smoke
test passed against the running local services:

| Operation | Provider evidence | Warm response | Observed output |
|---|---|---:|---|
| `/translate` | `mock=false` | 0.72 s | “Good morning. We are testing the local model.” |
| `/assist` | `mock=false` | 0.61 s | Formal rewrite returned in Russian |
| `/summary` | `provider=lmstudio` | 1.55 s | Summary included the decision, owner, and deadline |
| `/stt` | `provider=openai_compatible` | 1.03 s | Russian speech recognized by local faster-whisper |

The first Whisper request took about 6.49 seconds while loading the model; the
later warm call took about 1.15 seconds. The test used a temporary Russian
speech sample generated locally with Windows text-to-speech. Whisper recognized
the sentence but rendered the borrowed model name “Whisper” inaccurately. This
is one example of the quality variation; it is not an accuracy benchmark.

Re-run these real provider checks after starting LM Studio and the Whisper
adapter:

```powershell
cd ai-service
$env:AI_MOCK_MODE = 'false'
$env:AI_PROVIDER = 'lmstudio'
$env:AI_BASE_URL = 'http://127.0.0.1:1234/v1'
$env:AI_MODEL = 'qwen3.5-4b'
$env:AI_REASONING_EFFORT = 'none'
$env:STT_PROVIDER = 'openai_compatible'
$env:STT_BASE_URL = 'http://127.0.0.1:9000/v1'
python -m uvicorn src.main:app --host 127.0.0.1 --port 8000
```

In another terminal, start `python tools/local_whisper_server.py` from
`ai-service` (or run the local faster-whisper configuration in
[`lm-studio-local.md`](lm-studio-local.md)). Then set `AI_SERVICE_URL` and
`SOYUZ_STT_SAMPLE` and run `npm run test:ai-live` from `backend`. The live test
is intentionally excluded from normal CI because it requires downloaded local
models and live services.

## Limits and verification boundary

Supported language codes are `ru`, `en`, `de`, `fr`, `es`, `zh`, and `ar`;
source language for translation can also be `auto`. Text is limited to 5,000
characters, assist context to 10,000 characters, and summaries to 100 messages.
Backend voice uploads are limited to 20 MiB. The direct AI STT endpoint allows
25 MiB by default and accepts WAV, MP3, WebM, OGG, and M4A.

The Qwen model is a small local instruction model; it can paraphrase, omit
details, or invent summary content. The current checks prove contracts and
successful sample outputs, not production translation accuracy or factual
reliability. Whisper returns transcript text only, without word timestamps or
speaker labels. A larger corpus of reviewed, task-specific examples is still
needed for a meaningful quality benchmark.

The live provider smoke test exercised the real backend `TranslationService`
against real LM Studio and Whisper. The application was then started with
PostgreSQL and Redis in Docker and exercised over its HTTP API using an isolated
`soyuz_validation` database. The legacy camelCase `userId/chatId` schema was
reproduced in that disposable database; startup exposed a migration mismatch,
which is fixed by renaming those columns to the snake_case names used by the
`Message` entity and adding missing delivery-state columns. The project's
existing `messenger_db` volume was not modified.

Authenticated HTTP checks through NestJS all succeeded with the live local
providers: `/messages/translate` returned a Russian translation,
`/messages/assist` returned a formal rewrite, `/messages/summary` returned a
short summary, and `/messages/transcribe` recognized a locally synthesized
Russian sample. Invalid empty translation text, an unsupported assist action,
and an empty summary each returned HTTP 400. This validates backend-to-AI
integration; it does not replace a browser UI acceptance pass.
