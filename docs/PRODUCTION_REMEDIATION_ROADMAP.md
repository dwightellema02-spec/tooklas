# TUKLAS AI — PRODUCTION REMEDIATION ROADMAP

**Document Version:** 1.0.0  
**Date:** October 16, 2026  
**Companion Document:** [`docs/PRODUCTION_READINESS_AUDIT.md`](file:///c:/Users/dwight/Downloads/tuklas-ai/docs/PRODUCTION_READINESS_AUDIT.md)  
**Total Estimated Remediation Effort:** **25.5 Engineering Hours** (~3.5–4 working days across 10 structured phases)

---

## PROTECTED BASELINE (ALREADY COMPLETED & VERIFIED — DO NOT REVERT)

Before executing any remediation phase below, the following completed engineering fixes are locked as the **Protected Baseline** and must be preserved across all future commits:

1. **Microsoft Edge & Chrome Microphone Lifecycle (`src/lib/voice/speech-recognition.ts`, `src/components/ai/AITutorPanel.tsx`, `src/components/ai/VoiceTutorButton.tsx`):**
   - Non-destructive `navigator.permissions.query({ name: "microphone" })` check (no `getUserMedia` stream theft before `recognition.start()`).
   - Protected `voiceState === "LISTENING"` transitions so async auto-hints (`requestTutorHelp`) never overwrite active speech capture or trigger TTS while listening.
   - Explicit `voiceState === "ERROR"` visual state and retry handler.
   - **Verified by:** `npx tsx scripts/verify-microphone-fix.ts` (27/27 passed) and `npx tsx scripts/test-edge-full-flow.ts`.
2. **Natural Tagalog & English TTS Voice Quality (`src/lib/voice/speech-synthesis.ts`, `src/lib/voice/voice-utils.ts`):**
   - Asynchronous voice pre-warming (`initVoices()` + `voiceschanged` listener) and `cachedVoices`.
   - Default speech rate `1.0` (`pitch: 1.0`) for natural neural prosody.
   - Prioritization of `Microsoft Angelo Online (Natural) - Filipino (Philippines)` and `Microsoft Blessica Online (Natural)` for `fil-PH`, and `Microsoft Rosa Online (Natural) - English (Philippines)` for `en-PH`/`en-US`.
   - Mathematical and Taglish speech sanitizer (`formatTextForSpeech`, `isFilipinoText`) preserving hyphenated codes (`LSN-01`) while converting `-4.5` -> `"negatibo 4.5"` / `"negative 4.5"`.
   - **Verified by:** `npx tsx scripts/test-tts-real-edge.ts`.
3. **Curriculum Progression & Bilingual Socratic AI Tutor (`src/lib/db.ts`, `src/lib/ai/context.ts`, `src/lib/ai/prompts.ts`, `src/lib/ai/provider.ts`):**
   - Canonical Lesson 1 deduplication (`resolveCanonicalLessonId`: `b5688f4e-dece-4add-a830-b20ae5b9a4b1` -> `lsn_01`) and sequential Lesson 1 -> Lesson 2 unlocking.
   - Seamless English <-> Tagalog language switching and Socratic guardrails.
   - **Verified by:** `npx tsx scripts/verify-phase21-fixes.ts` (20/20 passed).

---

## REMAINING WORK — 10-PHASE PRODUCTION REMEDIATION PLAN

### Phase 1: Critical Bug & Multi-Student Research Export Fixes
- **Status:** **COMPLETED & VERIFIED** (October 16, 2026)
- **Estimated Effort:** 2.0 hours (Completed)
- **Objective:** Eliminate hardcoded single-student assumptions in research CSV exports so teachers and administrators export complete, accurate multi-student classroom datasets.
- **Completed Fixes:**
  - `LIM-08`: Updated `GET /api/teacher/research/export/metrics.csv` and `/api/admin/research/export/metrics.csv` (`server.ts:2928-2958`) to query all authorized students via `TeacherService.getAuthorizedStudentsPaginated` and generate profiles for every authorized student.
  - `LIM-08`: Updated `GET /api/teacher/research/export/attempts.csv` (`server.ts:2961-3043`) to filter attempts to authorized students and resolve real student names from user records instead of hardcoding `"Juan de la Cruz"`.
- **Verification Evidence:**
  - `npx tsx scripts/test-phase14-research.ts` -> **25/25 PASS**.
  - Live HTTP verification (`verify-p0-p1-fixes.ts`) -> `GET /api/teacher/research/export/metrics.csv` exported all **8 authorized student rows**.

---

### Phase 2: Authentication, Session & Access-Control Hardening
- **Status:** **COMPLETED & VERIFIED** (`LIM-01`, `LIM-03`, `LIM-04`, `LIM-05`, `LIM-06`, `LIM-10`); `LIM-14` (`npm audit`) remaining in P2 backlog
- **Estimated Effort:** 4.5 hours (Core P0/P1 security controls completed)
- **Objective:** Remove demo credentials from the client bundle, harden cookie/session storage against XSS and CSRF, add HTTP security headers, and close missing IDOR/rate-limit gaps.
- **Completed Fixes:**
  - `LIM-01`: Removed hardcoded demo credentials (`student@tuklas.ai`, `teacher@tuklas.ai`, `admin@tuklas.ai`, `Tuklas2026!`) from `src/lib/auth/auth-context.tsx`; added dev-only `POST /api/auth/dev-quick-login` (`server.ts:248-297`) that returns `404` when `NODE_ENV === "production"` or `ENABLE_DEV_QUICK_LOGIN === "false"`; guarded `prisma/seed.ts` against running in production without `ALLOW_PRODUCTION_SEED=true`.
  - `LIM-03` (`SEC-01`): Stopped persisting `tuklas_session_token` in `localStorage` (`src/lib/auth/auth-context.tsx`), actively purging legacy tokens and relying on the `httpOnly` `tuklas_session` cookie + in-memory session state.
  - `LIM-04` (`SEC-02`): Changed `sameSite` on `tuklas_session` cookie in `server.ts` from `"none"` to `"lax"` and added Same-Origin CSRF `Origin` validation middleware on `/api` for `POST`, `PUT`, `PATCH`, and `DELETE` requests (`server.ts:75-97`).
  - `LIM-05` (`SEC-03`): Added HTTP security headers middleware in `server.ts:53-73` (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Permitted-Cross-Domain-Policies: none`, `Permissions-Policy: microphone=(self), camera=(), geolocation=()`, and `Strict-Transport-Security` in production/HTTPS).
  - `LIM-06` (`SEC-04`): Added `aiEndpointRateLimiter` (30 req/min) and `documentUploadRateLimiter` (20 uploads/15 min) in `src/lib/rate-limiter.ts` and attached them to `POST /api/lessons/:id/documents`, `POST /api/ai/tutor`, `POST /api/ai/practice/generate`, `POST /api/teacher/students/:studentId/analyze`, and `POST /api/teacher/ai-assistant`.
  - `LIM-10` (`SEC-06`): Enforced `TeacherService.isTeacherAuthorizedForStudent(session.userId, studentId, session.role)` on both `GET /api/teacher/students/:studentId/insights` and `POST /api/teacher/students/:studentId/analyze` (`server.ts:2024-2085`).
- **Verification Evidence:**
  - `Select-String -Path dist/assets/*.js -Pattern "student@tuklas\.ai|teacher@tuklas\.ai|admin@tuklas\.ai|Tuklas2026|tuklas_session"` -> **0 matches** (`BUNDLE_CLEAN_100_PERCENT`).
  - `npx tsx scripts/test-batch1a-auth-security.ts` -> **16/16 PASS**.
  - Live HTTP verification (`verify-p0-p1-fixes.ts`) -> **15/15 PASS** (CSRF cross-origin POST blocked with `403`, unassigned student insights/analyze blocked with `403`, enrolled student insights permitted with `200`).

---

### Phase 3: Database Migration & Persistence Completion
- **Status:** **PARTIALLY COMPLETED & VERIFIED** (`LIM-02` migration baseline generated on disk, awaiting user approval to stamp live DB; `LIM-09` production DB fallback guard completed; `LIM-11` `teacherAISettings` table remaining in P2)
- **Estimated Effort:** 4.5 hours
- **Objective:** Establish reproducible Prisma SQL migrations, eliminate silent in-memory fallback leaks when PostgreSQL is active, and persist `teacherAISettings` in PostgreSQL.
- **Completed Fixes:**
  - `LIM-02`: Verified `0` schema drift between live Neon PostgreSQL and `prisma/schema.prisma`; created `prisma/migrations/migration_lock.toml` and `prisma/migrations/0001_baseline/migration.sql` (1,171 lines) offline without touching the live database. **Pending User Approval:** Run `npx prisma migrate resolve --applied 0001_baseline` after taking a logical `pg_dump` backup.
  - `LIM-09`: Added `assertNotProductionFallback()` in `src/lib/db.ts:40-47` and enforced it across write methods (`updateStudentProgress`, `createLesson`, `updateLesson`, `updateLessonStatus`, `deleteLesson`, `saveLessonSession`, `submitCheckpointAttempt`) so production throws `503 DatabaseUnavailableError` instead of silently falling back to `fallbackStore`.

---

### Phase 4: AI Provider, Quota & Fallback Hardening
- **Status:** **COMPLETED & VERIFIED** (October 16, 2026)
- **Estimated Effort:** 2.0 hours (Completed)
- **Objective:** Eliminate sequential retry delays when Gemini API quota is exhausted or model names are invalid, normalize legacy model aliases, and enforce quota cooldowns.
- **Completed Fixes:**
  - `LIM-07`: Added `normalizeGeminiModel()` in `src/lib/ai/provider.ts:6-14` (`"gemini-3.8-flash"` -> `"gemini-3.5-flash-lite"`) and a 60-second static quota circuit breaker (`quotaCooldownUntil` in `src/lib/ai/provider.ts:20-75`) that trips immediately upon receiving `429` / `RESOURCE_EXHAUSTED`, delegating to `LocalTutorEngine` in `<5ms` during cooldown.
- **Verification Evidence:**
  - `npx tsx scripts/verify-phase21-fixes.ts` -> **18/18 PASS**.
  - `npx tsx scripts/verify-microphone-fix.ts` -> **27/27 PASS** (including real Google Chrome E2E lesson + microphone + AI Tutor flow).

---

### Phase 5: Voice, Microphone & Bilingual Tutor Browser Hardening
- **Status:** Core Fixes **COMPLETED** (Protected Baseline); Cross-Browser Chrome TTS Fallback Remaining
- **Estimated Effort:** 3.0 hours
- **Objective:** Preserve all working Microsoft Edge and Chrome microphone/STT/TTS fixes while addressing the missing native `fil-PH` voice in Google Chrome on Windows.
- **Completed Baseline Items (Already Done):**
  - Non-destructive `navigator.permissions.query` in `src/lib/voice/speech-recognition.ts`.
  - Protected `LISTENING` state in `src/components/ai/AITutorPanel.tsx`.
  - `Microsoft Angelo Online (Natural)` / `Microsoft Blessica Online (Natural)` prioritization and `rate: 1.0` in `src/lib/voice/speech-synthesis.ts`.
  - Math/Tagalog speech formatting in `src/lib/voice/voice-utils.ts`.
- **Remaining Issue to Fix:**
  - `LIM-13`: On Windows machines where Google Chrome only exposes 19 system voices without `fil-PH`, detect when no `fil-PH`/`tl-PH` voice is available in `SpeechSynthesisController` and either (a) use an optional server-side neural TTS proxy or (b) apply phonetic Filipino normalization with a subtle UI tooltip recommending Microsoft Edge for native Filipino neural voices (`Angelo` / `Blessica`).
- **Relevant Files or Services:**
  - `src/lib/voice/speech-synthesis.ts`, `src/lib/voice/voice-utils.ts`, `src/components/ai/AITutorPanel.tsx`
- **Dependencies:** Do NOT modify `src/lib/voice/speech-recognition.ts` or break Edge TTS selection.
- **Acceptance Criteria:**
  - `scripts/verify-microphone-fix.ts` (27/27), `scripts/test-edge-full-flow.ts`, and `scripts/test-tts-real-edge.ts` continue to pass 100%.
  - Chrome users without an OS Filipino voice pack receive clear audio playback and a non-intrusive indicator.
- **Tests Required:**
  - `npx tsx scripts/verify-microphone-fix.ts`
  - `npx tsx scripts/test-edge-full-flow.ts`
  - `npx tsx scripts/test-tts-real-edge.ts`
- **Definition of Done:** Both Microsoft Edge and Google Chrome pass all STT and TTS verification suites without regression.

---

### Phase 6: Student Workflow & Assessment UI Polish
- **Status:** Remaining Work
- **Estimated Effort:** 2.0 hours
- **Objective:** Expose the existing Pre-Test and Post-Test assessment engine (`AssessmentService`) via a dedicated student route and lazy-load heavy route bundles for faster mobile page loads.
- **Exact Issues to Fix:**
  - `Feature A10`: Add `/student/assessments` route in `src/App.tsx` (or link directly from the Student Dashboard) so students can launch and submit assigned Pre-Test (`asm_pre_integers`) and Post-Test (`asm_post_integers`) assessments in the UI.
  - `LIM-15`: Convert heavy route imports in `src/App.tsx` to `React.lazy()` + `<Suspense>` so the main entry chunk (`dist/assets/index-*.js`, currently `716.80 kB`) drops below `500 kB`, and require authentication on `/voice-lab`.
- **Relevant Files or Services:**
  - `src/App.tsx`, `src/app/student/page.tsx`, `src/app/voice-lab/page.tsx`
- **Dependencies:** Phase 2.
- **Acceptance Criteria:**
  - Students can view, start, and submit a published assessment from the Student UI.
  - `npm run build` completes with zero chunk-size warnings (`> 500 kB`).
- **Tests Required:**
  - `npm run build`
  - `npx tsx scripts/smoke-test-pilot-flows.ts`
- **Definition of Done:** Student assessment flow is accessible end-to-end in UI and client bundle chunks are `<500 kB`.

---

### Phase 7: Teacher & Admin Workflow Completion
- **Status:** Remaining Work
- **Estimated Effort:** 4.5 hours
- **Objective:** Enable teachers to create classrooms and enroll registered students from the UI, and enable admins to manage user roles (`STUDENT` / `TEACHER` / `ADMIN`).
- **Exact Issues to Fix:**
  - `LIM-12`: Add `POST /api/teacher/classes` (create classroom) and `POST /api/teacher/classes/:classId/enroll` (enroll student by email) in `server.ts` and wire to `src/app/teacher/classes/page.tsx` and `src/app/teacher/classes/[classId]/page.tsx`.
  - `LIM-16`: Add `GET /api/admin/users` and `PATCH /api/admin/users/:id/role` in `server.ts` (strictly `ADMIN` only) and add a User & Role Management card in `src/app/admin/page.tsx`.
- **Relevant Files or Services:**
  - `server.ts`, `src/lib/teacher/index.ts`, `src/app/teacher/classes/page.tsx`, `src/app/teacher/classes/[classId]/page.tsx`, `src/app/admin/page.tsx`
- **Dependencies:** Phase 2, Phase 3.
- **Acceptance Criteria:**
  - A teacher can create a new classroom and enroll a newly registered student (`POST /api/auth/register`) by email.
  - An admin can promote an account to `TEACHER` from `/admin` without running a CLI script.
- **Tests Required:**
  - `npx tsx scripts/test-phase12-security.ts`
  - `npx tsx scripts/test-new-account-e2e.ts`
- **Definition of Done:** Classroom creation, student enrollment, and admin role management work end-to-end with strict RBAC and IDOR checks.

---

### Phase 8: Research & Analytics Verification
- **Status:** Remaining Work
- **Estimated Effort:** 1.0 hour
- **Objective:** Verify end-to-end data flow from student pre-test, lesson completion, practice attempts, AI Tutor hint usage, and post-test into the Teacher/Admin Research Platform (`/teacher/research`, `/admin/research`).
- **Exact Issues to Fix:**
  - Validate that newly enrolled students' practice attempts, `hintUsed` flags (`src/lib/ai/tutor.ts:171`), and assessment attempts populate `ResearchService.getPrePostComparison()`, `getDifficultSkills()`, `getMistakeAnalytics()`, and the 3 CSV exports fixed in Phase 1.
- **Relevant Files or Services:**
  - `src/lib/research/index.ts`, `src/lib/research/exporter.ts`, `src/app/teacher/research/page.tsx`
- **Dependencies:** Phase 1, Phase 6, Phase 7.
- **Acceptance Criteria:**
  - All 6 research endpoints (`/profile/:id`, `/comparison`, `/difficult-skills`, `/mistakes`, `/interventions`, `/time-series`) and all 3 CSV exports return valid, non-empty empirical data.
- **Tests Required:**
  - `npx tsx scripts/test-phase14-research.ts`
  - `npx tsx scripts/test-phase18-evidence.ts`
- **Definition of Done:** Research platform and CSV exports pass full automated verification.

---

### Phase 9: Online Deployment Preparation (Node.js Host + Managed PostgreSQL)
- **Status:** Remaining Work (Do Not Deploy Until Approved)
- **Estimated Effort:** 1.0 hour
- **Objective:** Add production build/start scripts and deployment configuration files so the repository can be deployed cleanly to Render/Railway/Fly.io/Cloud Run connected to Neon/Supabase PostgreSQL.
- **Exact Issues to Fix:**
  - `LIM-02`: Update `package.json` build script or add `build:prod` (`npx prisma generate && npm run build`) and `start:prod` (`cross-env NODE_ENV=production npx tsx server.ts`).
  - `LIM-02`: Create `Dockerfile` and `render.yaml` (or `railway.json`) with health check path `/api/health` and documented environment variable placeholders.
- **Relevant Files or Services:**
  - `package.json`, `Dockerfile`, `render.yaml`, `.env.example`
- **Dependencies:** Phases 1–8.
- **Acceptance Criteria:**
  - `NODE_ENV=production` local smoke test serves the compiled `dist/` bundle and `/api/health` on port `3000` with zero errors.
- **Tests Required:**
  - `npm run build`
  - `npx tsx scripts/test-phase14-production.ts`
- **Definition of Done:** Deployment manifests and production build scripts are tested and ready for one-click cloud deployment.

---

### Phase 10: Post-Deployment Smoke Testing & Pilot Monitoring
- **Status:** Remaining Work (Post-Deployment)
- **Estimated Effort:** 1.0 hour
- **Objective:** Verify the live HTTPS deployment across Student, Teacher, Admin, AI Tutor, and Browser Microphone/TTS flows.
- **Exact Issues to Verify:**
  - HTTPS certificate validity (mandatory for browser `navigator.mediaDevices` / `SpeechRecognition` in production).
  - `/api/health` reporting `database.connected: true`, `isProduction: true`, `auth.cookieSecure: true`.
  - Real-browser smoke test in Microsoft Edge and Google Chrome over HTTPS: Student registration -> Lesson 1 -> Microphone voice query in Tagalog & English -> Read Aloud TTS -> Practice completion -> Teacher Research CSV export.
- **Relevant Files or Services:**
  - `scripts/smoke-test-pilot-flows.ts`, `scripts/smoke-test-voice-tutor.ts`
- **Dependencies:** Phase 9.
- **Acceptance Criteria:**
  - 100% of post-deployment smoke checks pass over HTTPS with zero console or 500 errors.
- **Tests Required:**
  - `APP_URL=https://<deployed-domain> npx tsx scripts/smoke-test-pilot-flows.ts`
- **Definition of Done:** Live HTTPS deployment is certified ready for DepEd Grade 7 Mathematics classroom pilot.
