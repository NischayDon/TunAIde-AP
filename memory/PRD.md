# tunAide AP — Audio Pusher · PRD

## Original Problem Statement
Build "tunAide AP" (tunAide Audio Pusher) — a production-quality Expo/React Native mobile companion app for the tunAide Transcribe web app. Core philosophy: **Find. Organize. Select. Push. Transcribe.** Discover all accessible device audio, organize it virtually (never move/rename originals), let users select one or many files and push them to tunAide Transcribe via API. Dark-first UI: near-black background, purple accent, premium productivity feel. NOT a music player.

## User Choices / Defaults Applied (user skipped clarification)
- Auth: JWT email/password (FastAPI + MongoDB, bcrypt + PyJWT, 7-day tokens, secure token storage)
- tunAide Transcribe API: our FastAPI backend acts as the tunAide API; transcription is **SIMULATED (MOCK)** — jobs flip processing→complete after 45s; swappable via env later
- "View on Website": configurable `EXPO_PUBLIC_TRANSCRIBE_WEB_URL` (empty by default → informative toast, nothing invented)
- Uploaded audio storage: Emergent Managed Object Storage

## Architecture
- **Backend** (`/app/backend/server.py`): FastAPI + Motor/MongoDB. Routes (all `/api`): auth/register, auth/login, auth/me, POST /uploads (multipart → Emergent Object Storage, duplicate-awareness by name+size), GET /uploads, GET /transcriptions (time-based simulated status). uuid string ids, `_id` excluded everywhere.
- **Frontend** (Expo Router, SDK 54):
  - `src/theme.ts` design tokens (from design_guidelines.json), Geist fonts (local TTFs in assets/fonts)
  - `src/context/` — Auth, Library (scan/index/favorites/selection), Upload (queue engine: sequential, progress, retry×1 auto, cancel, wifi-only + offline checks), Toast
  - `src/utils/audioMeta.ts` — virtual library model, kind/source detection heuristics, categories/groups resolver, search/sort
  - Audio discovery: expo-media-library incremental paging on native; **MOCK sample library (14 files) on web preview** (`src/data/sampleAudio.ts`)
  - Uploads: expo-file-system/legacy createUploadTask (native, real progress) / XHR + blob (web, synth-WAV MOCK fallback for CORS)
  - Preview player: expo-audio (play/pause/seek/±10s)
  - Screens: onboarding(4), auth, permissions+scan, tabs (Library/Search/Push/Activity/Profile), category/[key] (lists + groups), audio/[id], push-config (modal), queue, success, settings
- **Persistence**: library index/favorites/settings/onboarding via `@/src/utils/storage`; JWT via secure storage. Library browsable offline.

## User Personas
- Students/journalists/professionals with lectures, interviews, meetings, voice memos on device who need fast transcription without manual browser uploads.

## Core Requirements (static)
Never auto-upload; explicit Push only. Never move/rename originals. Graceful permission denial (Open Settings). Honest platform limits messaging.

## Implemented (2026-06-16) — MVP COMPLETE, tested (iteration_1: backend 13/13 pass, full frontend happy path pass)
- Onboarding, JWT auth (register/login/me/signout, session persistence)
- Permission explanation → scan experience with live count/phases
- Library home (category cards + browse chips + recently added), category/group views, sort sheet, select-all
- Search (live, multi-field) + kind/format chips + duration filter + sort bottom sheet
- Audio detail (metadata, favorite, preview player, prominent Push)
- Multi-select (long-press), SelectionBar (count • size • Push)
- Push config (quality/priority/note/destination, Push Now / Add to Queue)
- Upload queue (progress, cancel, retry, remove, start), auto-navigate to Success
- Activity (Uploads/Transcriptions tabs, 10s polling, offline banner)
- Profile, Settings (rescan, wifi-only, auto-retry, sign out, about)
- Offline handling: queue kept, toasts; empty/error states throughout

## Known Notes
- MOCKED: transcription simulation (45s), web-preview sample library, web synth-WAV upload fallback
- Test creds: test@tunaide.com / Test123! (see /app/memory/test_credentials.md)
- Minor observations from testing (non-blocking): Uploads tab first-focus brief empty render; sign-out sheet button occasionally near viewport edge at 390×844

## Prioritized Backlog
- P1: Collections/playlists (user-created), advanced duplicate detection (hash-based), background uploads, push notifications (on user request), lazy native file-size fetch on selection, artist/album metadata extraction on native (ID3)
- P2: Excluded folders setting, scan frequency, concurrent uploads setting, light/system theme, upload detail screen, transcription detail/handoff deep links
- Future: real tunAide Transcribe API swap-in (replace simulated transcription section in server.py; point EXPO_PUBLIC_TRANSCRIBE_WEB_URL + backend env)

## Next Tasks
1. P1 items above (collections, duplicate detection)
2. Address minor UI observations
3. Native device validation via Expo Go (real media-library scan)
