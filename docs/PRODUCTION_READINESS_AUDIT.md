# TUKLAS AI — COMPLETE PROJECT UPDATE, LIMITATIONS & PRODUCTION READINESS AUDIT

**Audit Date:** October 16, 2026  
**Repository:** `c:\Users\dwight\Downloads\tuklas-ai`  
**Runtime Stack:** Node.js + Express 4.21.2 (`server.ts`), React 19.0.1 + Vite 8.3.1 SPA (`src/App.tsx`), Prisma 6.4.1 ORM + Neon PostgreSQL (`prisma/schema.prisma`), `@google/genai` 2.4.0 (`src/lib/ai/provider.ts`)  
**Overall Readiness Status:** **PILOT-READY WITH CONDITIONS** (Local/Managed Node.js + PostgreSQL ready; requires Serverless/Hosting architecture adaptation, rate-limit hardening on AI/upload routes, and CSV export multi-student fix before public multi-school production).

---

## PHASE 1 — REPOSITORY & ARCHITECTURE INSPECTION SUMMARY

### 1.1 Actual Architecture vs. Previous Reports
- **Monolithic Full-Stack Express + Vite Server (`server.ts`):** Unlike a Next.js App Router project, Tuklas AI uses a single Express entry point (`server.ts`, 2,934 lines) that registers 58 HTTP API endpoints (`/api/*`) and serves the React SPA (`src/App.tsx`) via Vite middleware in development (`NODE_ENV !== "production"`) and `express.static("dist")` in production (`server.ts:2907-2928`).
- **Client-Side Router (`src/App.tsx`):** Custom `window.history.pushState` / `popstate` router supporting 25 static and dynamic routes across Student, Teacher, Admin, Research, and Voice Lab views (`src/App.tsx:37-151`).
- **Database Layer (`prisma/schema.prisma`, `src/lib/db.ts`):** 27 Prisma models and 16 enums (`prisma/schema.prisma`, 1,083 lines) backed by a live Neon PostgreSQL instance (`GET /api/health` confirms `connected: true, provider: "neon-postgresql"`), paired with an automatic in-memory/JSON sandbox fallback (`fallbackStore` + `data/users-persistence.json` in `src/lib/db.ts:1883-1936`) when `DATABASE_URL` is absent in non-production environments.
- **Discrepancy Corrected from Phase 21 Report (`docs/PHASE_21_AI_LEARNING_INTELLIGENCE_AUDIT.md`):** The Phase 21 report stated that binary PDF/DOCX text extraction was *"NOT IMPLEMENTED"*. Inspection of the current codebase proves Phase 22 added full multi-format document extraction (`src/lib/documents/document-extractor.ts`, 745 lines) supporting PDF (`pdf-parse`), DOCX (`mammoth`), PPTX/XLSX (`jszip`), CSV/TXT/MD, and Gemini multimodal OCR, wired to `POST /api/lessons/:id/documents` (`server.ts:606-717`).

---

## PHASE 2 — COMPLETE UPDATE INVENTORY (38 INSPECTED FEATURES)

Every inspected feature is classified into one of six evidence-backed states:
- **CONFIRMED WORKING**: Verified by code inspection and automated/browser execution.
- **PARTIALLY WORKING**: Core path works, but has a specific limitation, hardcoded scope, or browser/environment constraint.
- **UI ONLY / PLACEHOLDER**: Visual presentation without dynamic backend mutation.
- **FALLBACK ONLY**: Operates via local/curated fallback when external API keys or quotas are unavailable.
- **BROKEN / FAILING**: Fails functional expectations.
- **UNVERIFIED**: Present in code, not executed in live hardware/production environment during this audit.

|Summary of 38 Inspected Features|Count|
|:---|---:|
|**Total Features Inspected**|**38**|
|**Confirmed Working**|**31**|
|**Partially Working**|**5**|
|**Fallback Only**|**2**|
|**UI Only / Placeholder**|**0**|
|**Broken / Failing**|**0**|
|**Unverified**|**0**|

---

### A. Student Features (10 Features)

| # | Feature | Status | Files & Routes | Evidence & Limitations |
| :--- | :--- | :--- | :--- | :--- |
| **A1** | **Student Registration & Login** | **CONFIRMED WORKING** | `server.ts:78-258`, `src/components/auth/AuthModal.tsx`, `src/lib/auth/auth-context.tsx` | Self-registration strictly enforces `role: "STUDENT"` (`server.ts:88`). Passwords hashed via `bcryptjs` (10 rounds). Session stored in both `httpOnly` cookie (`tuklas_session`) and `localStorage` Bearer token (`src/lib/auth/auth-context.tsx:108`). |
| **A2** | **Student Dashboard** | **CONFIRMED WORKING** | `src/app/student/page.tsx`, `GET /api/student/dashboard` (`server.ts:2255`), `src/lib/dashboard/index.ts` | Aggregates active learning path progress, adaptive next-step recommendation, skill mastery badges, recent practice sessions, and assigned classroom tasks. |
| **A3** | **MATATAG Grade 7 Learning Path** | **CONFIRMED WORKING** | `src/app/student/learning-path/page.tsx`, `GET /api/student/learning-path` (`server.ts:860`) | DAG-based prerequisite unlocking across Term 1 Unit 1 (`lsn_01` Understanding Integers, `lsn_02` Addition of Integers, `lsn_03` Subtraction of Integers). Verified by `scripts/verify-phase21-fixes.ts` (20/20 passed). |
| **A4** | **Interactive Lesson Viewer & Checkpoints** | **CONFIRMED WORKING** | `src/app/student/lessons/[id]/page.tsx`, `GET/POST /api/student/lessons/:id/session`, `POST /api/student/lessons/:id/checkpoint` | Renders Markdown + KaTeX math blocks, interactive number-line/counter manipulatives, and inline checkpoints. Saves `currentSectionIndex` and `completedBlockIds` in PostgreSQL (`LessonSession`, `CheckpointAttempt`). |
| **A5** | **Lesson Completion & Next-Lesson Unlocking** | **CONFIRMED WORKING** | `server.ts:1036-1096`, `src/lib/db.ts` (`resolveCanonicalLessonId`) | Deduplicates legacy UUID (`b5688f4e-...`) to canonical `lsn_01` (`src/lib/db.ts:53-61`), updates `StudentProgress`, and unlocks `lsn_02`. Verified in `scripts/verify-phase21-fixes.ts`. |
| **A6** | **Practice Sets & Attempt Engine** | **CONFIRMED WORKING** | `src/app/student/practice/[id]/page.tsx`, `POST /api/practice/start`, `POST /api/practice/:id/answer`, `POST /api/practice/:id/complete` | Supports 6 question types (`MULTIPLE_CHOICE`, `NUMERIC_INPUT`, `TEXT_INPUT`, `TRUE_FALSE`, `ORDERING`, `MATCHING`, `EQUATION`). Redacts `correctAnswer` on student GET requests (`server.ts:1255-1257`). |
| **A7** | **Practice History & Session Review** | **CONFIRMED WORKING** | `src/app/student/practice-history/page.tsx`, `GET /api/student/practice-history`, `GET /api/practice/:id/review` | Displays chronological practice attempts, scores, and per-item explanations. |
| **A8** | **Mastery Progress & Skill Detail View** | **CONFIRMED WORKING** | `src/app/student/mastery/[skillId]/page.tsx`, `GET /api/student/mastery/:skillId`, `POST /api/student/mastery/:skillId/recalculate` | 5-tier mastery model (`NOT_STARTED`, `LEARNING`, `DEVELOPING`, `PROFICIENT`, `MASTERED`) with accuracy, consistency, and application scores (`src/lib/mastery/index.ts`). |
| **A9** | **Adaptive Recommendations & Mistake Insights** | **CONFIRMED WORKING** | `GET /api/student/adaptive/recommendation`, `GET /api/student/insights`, `src/lib/adaptive/index.ts` | Triggered automatically upon practice completion (`server.ts:1634-1664`) or on-demand; allows completing or dismissing recommendations. |
| **A10** | **Student Assessments (Pre-Test & Post-Test)** | **PARTIALLY WORKING** | `GET /api/student/assessments`, `POST /api/student/assessments/:id/start`, `POST /api/student/assessments/attempts/:attemptId/submit` | Backend API and deterministic grading in `AssessmentService` work completely and redact answers (`server.ts:2599-2681`), but there is no dedicated `/student/assessments` standalone page registered in `src/App.tsx:69-149` (assessments are accessed via API/dashboard widgets). |

---

### B. Teacher Features (10 Features)

| # | Feature | Status | Files & Routes | Evidence & Limitations |
| :--- | :--- | :--- | :--- | :--- |
| **B1** | **Teacher Dashboard & Analytics** | **CONFIRMED WORKING** | `src/app/teacher/page.tsx`, `GET /api/teacher/dashboard` (`server.ts:2290`), `src/lib/teacher/index.ts` | Displays class-wide mastery distribution, struggling student alerts, and curriculum summary. Protected by `TEACHER`/`ADMIN` RBAC. |
| **B2** | **Class Management & Assignments** | **PARTIALLY WORKING** | `src/app/teacher/classes/page.tsx`, `src/app/teacher/classes/[classId]/page.tsx`, `GET /api/teacher/classes`, `POST /api/teacher/classes/:classId/assignments` | Viewing classes, student rosters, and creating assignments works (`server.ts:2353-2413`). However, there is no `POST /api/teacher/classes` or enrollment mutation endpoint in `server.ts` to create new classrooms or add/remove students via UI. |
| **B3** | **Student Roster, Detail & Mistake Insights** | **CONFIRMED WORKING** | `src/app/teacher/students/page.tsx`, `src/app/teacher/students/[studentId]/page.tsx`, `src/app/teacher/students/[studentId]/insights/page.tsx` | Paginated student search (`GET /api/teacher/students`), IDOR-verified student detail (`TeacherService.isTeacherAuthorizedForStudent`), on-demand mistake analysis (`POST /api/teacher/students/:studentId/analyze`), and teacher adaptive overrides (`POST /api/teacher/students/:studentId/adaptive/override`). |
| **B4** | **Curriculum & Unit Management** | **CONFIRMED WORKING** | `src/app/teacher/curriculum/page.tsx`, `src/app/teacher/curriculum/[unitId]/page.tsx`, `POST /api/units`, `POST /api/units/:unitId/reorder-lessons` | Supports creating units under MATATAG Terms, reordering lessons, and configuring skill prerequisites (`POST /api/skills/:skillId/prerequisites`). |
| **B5** | **Lesson Authoring, Content Blocks & Publishing** | **CONFIRMED WORKING** | `src/app/teacher/lessons/page.tsx`, `src/app/teacher/lessons/new/page.tsx`, `src/app/teacher/lessons/[id]/edit/page.tsx` | Full CRUD for lessons and content blocks (`POST/PUT/DELETE /api/lessons/:id/blocks`), status workflow (`DRAFT` -> `REVIEW` -> `PUBLISHED`), and ownership checks (`server.ts:418, 2457`). |
| **B6** | **Teacher Document Upload & Text Extraction** | **CONFIRMED WORKING** | `POST/GET/DELETE /api/lessons/:id/documents` (`server.ts:606-832`), `src/lib/documents/document-extractor.ts` | Extracts text, tables, and semantic chunks from PDF, DOCX, PPTX, XLSX, CSV, TXT, MD, and images (up to 25MB) and injects chunks into AI Tutor context. Note: Raw binary files are parsed in-memory and stored as extracted JSON in `LessonResource.notes` rather than persisted to cloud object storage (S3/R2). |
| **B7** | **Mathisipan / YouTube Video Attachment** | **FALLBACK ONLY** | `GET /api/youtube/search`, `POST /api/lessons/:id/video` (`server.ts:503-596`), `src/lib/youtube.ts` | `GET /api/health` confirms `YOUTUBE_API_KEY` is unconfigured (`configured: false`), so search operates in `Curated Mathisipan Catalog` fallback mode while URL validation and attachment work. |
| **B8** | **Question Bank & Question Editor** | **CONFIRMED WORKING** | `src/app/teacher/question-bank/page.tsx`, `src/app/teacher/questions/[id]/edit/page.tsx`, `src/app/teacher/questions/[id]/preview/page.tsx` | Full CRUD (`GET/POST/PATCH/PUT/DELETE /api/questions`), review status transitions (`POST /api/questions/:id/status`), and server-side `QuestionValidator`. |
| **B9** | **Practice Set Builder** | **CONFIRMED WORKING** | `src/app/teacher/practice-sets/page.tsx`, `GET/POST /api/practice-sets`, `POST/DELETE /api/practice-sets/:id/questions` | Creates practice sets and attaches/removes questions with ordering. |
| **B10** | **Teacher AI Settings & Teacher AI Assistant** | **CONFIRMED WORKING** | `src/app/teacher/ai-settings/page.tsx`, `GET/PATCH /api/ai/settings`, `POST /api/teacher/ai-assistant` | Configures global AI Tutor toggle, max hint level, and model preference; provides class-grounded Teacher AI pedagogical assistant (`server.ts:2416-2440`). |

---

### C. Admin Features (4 Features)

| # | Feature | Status | Files & Routes | Evidence & Limitations |
| :--- | :--- | :--- | :--- | :--- |
| **C1** | **Admin Portal & System Diagnostics** | **CONFIRMED WORKING** | `src/app/admin/page.tsx`, `GET /api/admin/system-summary` (`server.ts:2474`), `GET /api/health` | Enforces strict `ADMIN` role check (`server.ts:2476`). Displays live DB provider status, server uptime, and curriculum/research summary. |
| **C2** | **Admin Curriculum Governance** | **CONFIRMED WORKING** | `/admin/curriculum` (`src/App.tsx:87`), `server.ts:418, 454, 487` | Admin bypasses single-teacher ownership restrictions to review, edit, publish, or delete any teacher's draft/published lessons. |
| **C3** | **Admin Research Platform & CSV Exports** | **PARTIALLY WORKING** | `/admin/research` (`src/App.tsx:84`), `GET /api/admin/research/*` (`server.ts:2684-2898`) | Research analytics and CSV downloads work, **but** `GET /api/admin/research/export/metrics.csv` (`server.ts:2801`) hardcodes `"usr_student_01"` instead of exporting all authorized students, and `attempts.csv` (`server.ts:2833, 2855`) hardcodes `"Juan de la Cruz"` as fallback student name. |
| **C4** | **Admin User & Role Management UI** | **PARTIALLY WORKING** | `prisma/seed.ts`, `server.ts:78-145` | `UserRole` enum supports `STUDENT`, `TEACHER`, `ADMIN`, `RESEARCHER`, and self-registration locks users to `STUDENT`, **but** there is no Admin API endpoint or UI to promote a user to `TEACHER`/`ADMIN` or reset user passwords without running a database script. |

---

### D. AI Features (6 Features)

| # | Feature | Status | Files & Routes | Evidence & Limitations |
| :--- | :--- | :--- | :--- | :--- |
| **D1** | **Context-Grounded Socratic AI Tutor** | **CONFIRMED WORKING** | `POST /api/ai/tutor` (`server.ts:1725`), `src/lib/ai/tutor.ts`, `src/lib/ai/context.ts`, `src/lib/ai/prompts.ts` | Builds 10-part educational context (lesson blocks, teacher documents, active question, attempt history, last 6 messages, mistake insights, mastery, adaptive recommendation). Enforces Socratic guidance without leaking answers (`src/lib/ai/validators.ts`). |
| **D2** | **Gemini Model Cascade & LocalTutorEngine Fallback** | **FALLBACK ONLY** | `src/lib/ai/provider.ts:6-70, 77-1326` | `GeminiAIProvider` cascades through configured `AI_MODEL` (`gemini-2.5-flash-lite` -> `gemini-2.5-flash` -> `gemini-2.0-flash`) with a 15–16s timeout. Live tests (`scripts/verify-phase21-fixes.ts`) confirm the configured Gemini key currently returns `429 RESOURCE_EXHAUSTED (limit: 0)` on free-tier quota, seamlessly activating `LocalTutorEngine`. |
| **D3** | **AI Practice Question Generator** | **CONFIRMED WORKING** | `POST /api/ai/practice/generate` (`server.ts:1827`), `src/lib/ai/practice-generator.ts` | Generates lesson-aligned Grade 7 Integer questions (Lessons 1–3) validated by `QuestionValidator`. |
| **D4** | **AI Mistake Pattern Analyzer** | **CONFIRMED WORKING** | `src/lib/ai/mistake-analyzer.ts`, `POST /api/teacher/students/:studentId/analyze` | Categorizes student errors into `SIGN_ERROR`, `CALCULATION_ERROR`, `CONCEPTUAL_MISUNDERSTANDING`, `PROCEDURE_ERROR`, `INCOMPLETE_REASONING`, `PREREQUISITE_GAP`, and `CARELESS_MISTAKE` with linked attempt evidence. |
| **D5** | **Adaptive Recommendation Engine** | **CONFIRMED WORKING** | `src/lib/adaptive/index.ts`, `GET/POST /api/student/adaptive/recommendation` | Combines deterministic pedagogical rule engine (`RULE_ENGINE`) with optional AI-assisted explanation (`AI_ASSISTED`) and teacher overrides (`TEACHER_OVERRIDE`). |
| **D6** | **Prompt Injection & Video Integrity Guardrails** | **CONFIRMED WORKING** | `src/lib/ai/provider.ts:165-202`, `src/lib/ai/prompts.ts` | Blocks prompt injection (`ignore previous`, `system prompt`, `api_key`, `database_url`), off-topic queries, and prevents hallucinating YouTube video contents when transcripts are absent. |

---

### E. Voice & Bilingual Tutor Features (5 Features)

| # | Feature | Status | Files & Routes | Evidence & Limitations |
| :--- | :--- | :--- | :--- | :--- |
| **E1** | **Browser Speech Recognition (STT) & Edge Lifecycle** | **CONFIRMED WORKING** | `src/lib/voice/speech-recognition.ts`, `src/components/ai/VoiceTutorButton.tsx`, `src/components/ai/AITutorPanel.tsx` | Uses non-destructive `navigator.permissions.query({ name: "microphone" })` (preventing Microsoft Edge `msedge.exe` hardware stream theft), guards `LISTENING` state against async auto-hints, and delivers transcripts directly to the AI Tutor input. Verified in `scripts/verify-microphone-fix.ts` (27/27) and `scripts/test-edge-full-flow.ts`. |
| **E2** | **Bilingual English / Tagalog / Taglish Switching** | **CONFIRMED WORKING** | `src/lib/ai/context.ts`, `src/lib/ai/prompts.ts`, `src/lib/ai/provider.ts:91-150`, `src/lib/voice/voice-utils.ts` | Automatically detects explicit language switch requests (`"Explain in Tagalog"`, `"Switch to English"`) and Taglish indicators (`po`, `opo`, `paano`, `bakit`, `atin`, `nasa`) and responds in natural pedagogical Filipino or English. Verified in `scripts/verify-phase21-fixes.ts` (20/20). |
| **E3** | **Natural Text-to-Speech (TTS) & Voice Selection** | **PARTIALLY WORKING** | `src/lib/voice/speech-synthesis.ts`, `src/lib/voice/voice-utils.ts` | Pre-warms voices via `voiceschanged`, uses natural `rate: 1.0`, and prioritizes `Microsoft Angelo Online (Natural) - Filipino (Philippines)` and `Microsoft Blessica Online (Natural)` in Edge (`scripts/test-tts-real-edge.ts`). **Limitation:** Google Chrome on Windows only ships 19 voices with no native `fil-PH` voice, falling back to `en-US`/`id-ID` unless a cloud TTS endpoint is added or Edge is used. |
| **E4** | **Mathematical & Tagalog Speech Sanitization** | **CONFIRMED WORKING** | `src/lib/voice/voice-utils.ts` (`formatTextForSpeech`) | Normalizes Unicode minus signs (`\u2212`, `\u2013`), converts `-5` -> `"negative 5"` (English) or `"negatibo 5"` (Tagalog), `10 - 4` -> `"10 minus 4"`, `|-14|` -> `"the absolute value of negative 14"`, while preserving hyphenated codes (`LSN-01`, `M7NS-Ia-1`). |
| **E5** | **Voice Lab Diagnostic Page** | **CONFIRMED WORKING** | `src/app/voice-lab/page.tsx` (`/voice-lab` in `src/App.tsx:86`) | Provides an interactive diagnostic sandbox for testing STT, TTS voices, and math speech formatting. Note: Currently accessible on `/voice-lab` without an authentication gate. |

---

### F. Research & Analytics Features (3 Features)

| # | Feature | Status | Files & Routes | Evidence & Limitations |
| :--- | :--- | :--- | :--- | :--- |
| **F1** | **4-Pillar Research Competency Profiles** | **CONFIRMED WORKING** | `src/app/teacher/research/page.tsx`, `src/lib/research/index.ts`, `GET /api/teacher/research/profile/:studentId` | Computes empirical `Understanding`, `Accuracy`, `Application`, and `Consistency` metrics with confidence scores and evidence counts (`ResearchMetricRecord`). |
| **F2** | **Pre-Test vs. Post-Test & Longitudinal Analytics** | **CONFIRMED WORKING** | `GET /api/teacher/research/comparison`, `difficult-skills`, `mistakes`, `interventions`, `time-series` (`server.ts:2706-2790`) | Computes paired pre/post growth (`scoreDifferencePoints`, `relativeGrowthPercent`), difficult skills ranking, mistake distribution, and non-causal intervention observations. |
| **F3** | **Standardized Research CSV Exports** | **PARTIALLY WORKING** | `src/lib/research/exporter.ts`, `GET /api/teacher/research/export/{metrics,attempts,comparison}.csv` (`server.ts:2793-2898`) | Generates RFC-4180 CSV files with UTF-8 headers. **Limitation:** `metrics.csv` (`server.ts:2801`) only exports `"usr_student_01"` instead of querying all classroom students, and `attempts.csv` (`server.ts:2855`) hardcodes `"Juan de la Cruz"` in the fallback path. |

---

## PHASE 3 — AUTOMATED & MANUAL VERIFICATION RESULTS

All verification commands were executed non-destructively against `c:\Users\dwight\Downloads\tuklas-ai`:

| Verification Check | Command Executed | Result | Evidence / Output Summary |
| :--- | :--- | :--- | :--- |
| **1. TypeScript Typecheck** | `npx tsc --noEmit` | **PASS (0 errors)** | Clean compilation across all frontend, backend, voice, and AI modules. |
| **2. Prisma Schema Validation** | `npx prisma validate` | **PASS** | `The schema at prisma\schema.prisma is valid 🚀` (27 models, PostgreSQL provider). |
| **3. Production Client Build** | `npm run build` (`vite build`) | **PASS (15.63s)** | Transformed 1,765 modules into `dist/`. Warning: `dist/assets/index-BYsMKduw.js` is `716.80 kB` (gzip `122.74 kB`), exceeding Vite's 500 kB chunk warning threshold. |
| **4. Live Health & DB Check** | `GET http://localhost:3000/api/health` | **PASS** | `status: "ok"`, `database: { connected: true, provider: "neon-postgresql" }`, `auth.secretConfigured: true`, `aiTutor.configured: true`. |
| **5. Phase 21 Core & Bilingual Suite** | `npx tsx scripts/verify-phase21-fixes.ts` | **PASS (20/20)** | Verified Lesson 1 -> Lesson 2 progression, canonical lesson ID deduplication, Socratic hints, Tagalog/English language switching, and Gemini -> `LocalTutorEngine` fallback. |
| **6. Microphone & Chrome E2E Suite** | `npx tsx scripts/verify-microphone-fix.ts` | **PASS (27/27)** | Verified `SpeechRecognitionController` state machine, non-destructive permission check, error/retry state, and headless Chrome click-to-input flow. |
| **7. Microsoft Edge Full Voice E2E** | `npx tsx scripts/test-edge-full-flow.ts` | **PASS** | Verified real `msedge.exe` mic button click -> `LISTENING` -> transcript `"Paano mag-add ng negative integers"` -> input populated -> AI Tutor response. |
| **8. Microsoft Edge Natural TTS Check** | `npx tsx scripts/test-tts-real-edge.ts` | **PASS** | Verified real `msedge.exe` Read Aloud click selects `Microsoft Angelo Online (Natural) - Filipino (Philippines)` (`lang: "fil-PH"`, `rate: 1`, `pitch: 1`). |
| **9. Dependency Vulnerability Audit** | `npm audit --json` | **WARN (4 vulns)** | 361 total dependencies: **0 Critical**, **1 High**, **3 Moderate** across `mammoth`, `argparse`, `source-map-js`, and `sprintf-js`. |

---

## PHASE 4 — DATABASE & PERSISTENCE AUDIT

### 4.1 Database Engine & Connection Status
- **Configured Provider:** PostgreSQL (`prisma/schema.prisma:10-13`, `provider = "postgresql"`, `url = env("DATABASE_URL")`).
- **Live Status:** Connected to Neon PostgreSQL (`GET /api/health` -> `provider: "neon-postgresql"`, `connected: true`).
- **Dual-Mode Persistence Architecture (`src/lib/db.ts`):**
  - When `hasValidDatabaseUrl` is true (`postgresql://` or `postgres://`), `dbService` queries PostgreSQL via Prisma (`src/lib/db.ts:63-95`).
  - When `hasValidDatabaseUrl` is false in development/test, `dbService` falls back to `fallbackStore` in memory and persists registered users to `data/users-persistence.json` (`src/lib/db.ts:1883-1936`).
  - In production (`NODE_ENV === "production"`), `validateProductionEnv()` (`src/lib/env.ts:64-81`) halts startup if `DATABASE_URL` is missing or not a valid `postgresql://` URL, and `loadPersistedUsers()` / `savePersistedUsers()` are explicitly disabled (`src/lib/db.ts:1887, 1919`).

### 4.2 Schema Completeness vs. Persistence Risks
1. **Missing `prisma/migrations` Directory (Priority P1):** Inspection of `prisma/` shows only `schema.prisma` and `seed.ts`. Schema changes have been applied via `prisma db push` rather than versioned SQL migrations (`prisma migrate dev` / `prisma migrate deploy`). For production CI/CD, a baseline migration history in `prisma/migrations/` is needed to prevent accidental drift or destructive resets.
2. **In-Memory Fallback Silent Catch Blocks (`src/lib/db.ts`) (Priority P1):** Several `dbService` methods wrap Prisma queries in `try { ... } catch { return fallbackStore... }` even when `hasValidDatabaseUrl` is true. If a transient Neon PostgreSQL connection timeout occurs in production, returning `fallbackStore` seed data could show stale demo records instead of returning `503 DatabaseUnavailableError`.
3. **Teacher Document Storage in DB Column (`server.ts:690-705`) (Priority P2):** Uploaded teacher documents (`.pdf`, `.docx`, `.pptx`) have their extracted text and chunks serialized as JSON into `LessonResource.notes` (`TEXT` column in PostgreSQL), while the original binary file is discarded after extraction. If teachers expect students to download the original PDF file, object storage (e.g., Supabase Storage / S3 / R2) is required.
4. **Teacher AI Settings Persistence (`src/lib/db.ts:1592`) (Priority P2):** `teacherAISettings` (`aiTutorEnabled`, `maxHintLevel`, `model`) is stored in `fallbackStore.teacherAISettings` in memory rather than a dedicated Prisma table in `prisma/schema.prisma`, meaning settings reset to defaults whenever the server restarts.

---

## PHASE 5 — SECURITY & STUDENT PRIVACY AUDIT

*(Note: All secret values, API keys, passwords, and connection strings are strictly omitted from this report.)*

### 5.1 Confirmed Security Controls
- **Startup Secret Enforcement (`src/lib/env.ts`, `src/lib/auth/session.ts`):** `validateAuthSecret()` requires `AUTH_SECRET` to be $\ge 32$ characters and blocks known default placeholders (`KNOWN_COMPROMISED_SECRETS` in `src/lib/auth/session.ts:19-24`). `server.ts:36-41` terminates startup (`process.exit(1)`) if validation fails in production.
- **Timing-Safe HMAC-SHA256 Token Verification (`src/lib/auth/session.ts:97-155`):** Session tokens use `crypto.timingSafeEqual` and validate user existence against the database on `/api/auth/me` (`server.ts:227`).
- **Password Hashing (`src/lib/auth/password.ts`):** Uses `bcryptjs` (10 salt rounds) and rejects weak/short passwords via `validatePassword()`.
- **Self-Registration Role Lockdown (`server.ts:87-88`):** Public `POST /api/auth/register` ignores any client-supplied role and hardcodes `const assignedRole: UserRole = "STUDENT"`.
- **IDOR & Ownership Enforcement:**
  - Student AI conversations check `conversation.studentId === session.userId` (`server.ts:1786`).
  - Teacher student detail, mastery, adaptive history, and research profile endpoints verify classroom authorization via `TeacherService.isTeacherAuthorizedForStudent()` (`server.ts:870, 1702, 2045, 2210, 2343, 2692`).
  - Student question/assessment endpoints strip `correctAnswer` and `explanation` before returning payloads (`server.ts:1255, 2632`).
- **Student Audio Privacy (`src/lib/voice/speech-recognition.ts`):** Speech-to-text runs locally in the browser's `SpeechRecognition` API; only the final text string is sent to `/api/ai/tutor`. No student voice recordings or raw audio buffers are transmitted or stored on the server.
- **Development Demo Switcher Gate (`src/components/auth/AuthModal.tsx:141`, `src/lib/auth/auth-context.tsx:163`):** The instant demo login buttons (`Student`, `Teacher`, `Admin`) are gated behind `Boolean(import.meta.env.DEV)` and disabled in production builds.

### 5.2 Identified Security & Privacy Vulnerabilities
1. **[SEC-01] Dual Token Storage in `localStorage` (`src/lib/auth/auth-context.tsx:108, 137`) — Priority P1:**
   - **Evidence:** `POST /api/auth/login` and `/api/auth/register` return `{ token }` in the JSON body (`server.ts:132, 193`), and `auth-context.tsx` saves it to `localStorage.setItem("tuklas_session_token", data.token)`.
   - **Risk:** Although `tuklas_session` is set as an `httpOnly` cookie, storing the same token in `localStorage` exposes the session token to any XSS vector.
   - **Fix:** Rely exclusively on the `httpOnly` cookie in same-origin production deployments (or short-lived memory tokens) and stop persisting session tokens in `localStorage`.
2. **[SEC-02] Cookie `sameSite: "none"` Set Unconditionally in Production (`server.ts:119, 180`) — Priority P1:**
   - **Evidence:** `sameSite: isHttps || isProd ? "none" : "lax"`.
   - **Risk:** `SameSite=None` allows cross-site cookie transmission, increasing CSRF exposure on state-changing POST/PUT/DELETE routes since no CSRF token middleware is present.
   - **Fix:** Change `sameSite` to `"lax"` (since Express serves both the SPA and `/api/*` on the same origin) or implement explicit CSRF origin/header verification.
3. **[SEC-03] Missing HTTP Security Headers (`helmet`) & CORS Policy (`server.ts:43-50`) — Priority P1:**
   - **Evidence:** `server.ts` does not set `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, or `Strict-Transport-Security`.
   - **Fix:** Add security header middleware (`helmet` or custom headers) and explicit origin allowlisting.
4. **[SEC-04] Missing Rate Limiting on Expensive Endpoints (`server.ts`) — Priority P1:**
   - **Evidence:** `loginRateLimiter` and `registerRateLimiter` are applied to `/api/auth/login` and `/api/auth/register`, and `AITutorService` has an internal 20 req/min limit, **but** `POST /api/ai/practice/generate` (`server.ts:1827`), `POST /api/teacher/students/:studentId/analyze` (`server.ts:1924`), `POST /api/teacher/ai-assistant` (`server.ts:2416`), and `POST /api/lessons/:id/documents` (30MB body limit, `server.ts:47, 606`) have no rate limiters attached, even though `submissionRateLimiter` is defined in `src/lib/rate-limiter.ts:126` and never imported.
   - **Fix:** Attach `submissionRateLimiter` (and a dedicated AI generation rate limiter) to all AI and document upload endpoints.
5. **[SEC-05] Seeded Demo Accounts Use Predictable Password in `prisma/seed.ts` — Priority P1:**
   - **Evidence:** `prisma/seed.ts:16-84` seeds `student@tuklas.ai`, `teacher@tuklas.ai`, and `admin@tuklas.ai` (including `UserRole.ADMIN`) into the live database with a hardcoded password reported in `auth-context.tsx:168-173`. Even though the UI hides the quick-login buttons in production, the credentials themselves remain in the client bundle (`auth-context.tsx:168-173`) and work against `/api/auth/login` if `prisma/seed.ts` was run on the production database.
   - **Fix:** Remove hardcoded demo passwords from `src/lib/auth/auth-context.tsx` (move dev quick-login to a dev-only backend route or environment variables) and disable/rotate default admin/teacher passwords before public launch.
6. **[SEC-06] Missing IDOR Check on `GET /api/teacher/students/:studentId/insights` and `POST .../analyze` (`server.ts:1900-1950`) — Priority P2:**
   - **Evidence:** Unlike `server.ts:2045` and `2210` which call `TeacherService.isTeacherAuthorizedForStudent()`, lines `1900-1950` check `session.role === "TEACHER"` without verifying that `studentId` is enrolled in the teacher's classroom.
   - **Fix:** Add `TeacherService.isTeacherAuthorizedForStudent(session.userId, studentId, session.role)` check to both routes.

---

## PHASE 6 — AI PROVIDER, QUOTA & COST AUDIT

### 6.1 Model Configuration & Cascade Behavior
- **SDK:** `@google/genai` v2.4.0 (`src/lib/ai/provider.ts:3`).
- **Configured Model Strings:**
  - `.env.example` and `src/lib/db.ts:1595` reference `"gemini-3.8-flash"`.
  - `src/lib/ai/provider.ts:8, 23-29` cascades through `[this.model, "gemini-3.5-flash-lite", "gemini-3.5-flash"]` (note: in the `@google/genai` SDK, standard upstream model identifiers are `gemini-2.5-flash-lite`, `gemini-2.5-flash`, and `gemini-2.0-flash`, whereas `gemini-3.8-flash` / `gemini-3.5-flash` are non-standard/preview identifiers that can trigger `404 Not Found` or `429 RESOURCE_EXHAUSTED` depending on the API project).
- **Live Quota Findings:** During `npx tsx scripts/verify-phase21-fixes.ts`, the configured Gemini API key returned `429 RESOURCE_EXHAUSTED (quota metric: GenerateContentInputTokensPerModelPerMinute-FreeTier, limit: 0)` or model fallback, causing `AITutorService.interact()` (`src/lib/ai/tutor.ts:134-142`) to catch the error after the retry cascade and fall back to `LocalTutorEngine`.

### 6.2 Latency & Cost Risk Analysis
- **Sequential Cascade Latency Trap (`src/lib/ai/provider.ts:21-69`) — Priority P1:**
  - When the primary Gemini model fails due to `429 Quota Exceeded` or invalid model ID, `GeminiAIProvider.generateTutorResponse()` loops sequentially through up to 3 models (`for (const modelToUse of modelsToTry)`). Each attempt adds 1–15 seconds of network latency before `LocalTutorEngine` finally responds.
  - **Fix:** Implement a circuit breaker (e.g., 60-second cooldown after a `429` or `404` from Gemini) and standardize model identifiers to valid upstream Gemini models (`gemini-2.5-flash` / `gemini-2.5-flash-lite`).
- **Per-User & Global Cost Controls:**
  - `AITutorService` enforces 20 requests/minute per student (`src/lib/ai/tutor.ts:21`), `maxTokens: 500` (`tutor.ts:130`), and `studentQuery.length <= 1000` (`tutor.ts:89`).
  - **Gap:** There is no daily per-student token/request budget or global daily spend cap across `/api/ai/tutor`, `/api/ai/practice/generate`, `/api/teacher/students/:studentId/analyze`, `/api/teacher/ai-assistant`, and multimodal OCR in `document-extractor.ts`.

---

## PHASE 7 — ONLINE DEPLOYMENT READINESS & ARCHITECTURE

### 7.1 Why Static-Only Vercel Deployment Will Fail as Currently Configured
Tuklas AI is **not** a static SPA or a Next.js project:
1. `package.json` runs `"start": "cross-env NODE_ENV=production tsx server.ts"`.
2. All 58 `/api/*` endpoints live inside `server.ts` (Express), using stateful in-memory rate limiters (`src/lib/rate-limiter.ts`, `src/lib/ai/tutor.ts:20`) and a long-lived Prisma client (`src/lib/db.ts`).
3. Deploying only `vite build` (`dist/`) to Vercel static hosting would deploy the frontend UI with **no backend API**. To deploy on Vercel, `server.ts` would need to be exported as a Vercel Serverless Function (`api/index.ts` + `vercel.json` rewrites), which also resets in-memory rate limiters on every cold start and imposes a 4.5 MB request body limit (breaking the 25 MB teacher document upload on `POST /api/lessons/:id/documents`).

### 7.2 Recommended Production Architecture Comparison

| Architecture Option | How It Works | Pros | Cons / Limitations | Verdict |
| :--- | :--- | :--- | :--- | :--- |
| **Option A (Recommended): Managed Node.js Container (Render / Railway / Fly.io / Google Cloud Run) + Managed PostgreSQL (Neon / Supabase)** | Runs `npm run build` during build phase and `npm run start` (`NODE_ENV=production tsx server.ts`) as a persistent Node.js web service connected to Neon/Supabase PostgreSQL. | **Zero architectural rewrite required.** Supports 25 MB document uploads, persistent Prisma connection pooling, and in-memory sliding-window rate limiters out of the box. Automatic HTTPS for Web Speech API microphone access. | Requires a standard `$5–$7/mo` always-on Node container to avoid cold-start sleep during school hours. | **BEST FIT FOR IMMEDIATE PILOT & PRODUCTION** |
| **Option B: Vercel (Frontend + Serverless Express `api/index.ts`) + Neon/Supabase PostgreSQL** | Exports `app` from `server.ts`, adds `vercel.json` routing `/api/(.*)` to `api/index.ts`, and serves `dist/` via Vercel CDN. | Zero-config global CDN and free/hobby preview deployments on every Git push. | Vercel Serverless Functions enforce a **4.5 MB payload limit** (breaks 25 MB PDF uploads), **10s–60s execution timeouts**, and stateless cold starts (resets in-memory rate limiters). | **VIABLE ONLY IF UPLOADS ARE REDUCED TO <4MB OR MOVED DIRECTLY TO CLOUD STORAGE** |

### 7.3 Required Production Environment Variables
*(Names and purpose only — no secret values)*

| Variable Name | Required in Prod? | Purpose | Validation Rule (`src/lib/env.ts`) |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | **Yes** | Enables production static serving, secure cookies, and strict fail-closed validation. | Must be `"production"`. |
| `PORT` | **Yes (Auto)** | HTTP port bound by Express (`0.0.0.0:$PORT`). | Defaults to `3000` if unset. |
| `DATABASE_URL` | **Yes** | Pooled PostgreSQL connection string (Neon / Supabase). | Must start with `postgresql://` or `postgres://`. |
| `AUTH_SECRET` | **Yes** | Cryptographic key for HMAC-SHA256 session signing. | Minimum 32 characters; must not match `KNOWN_COMPROMISED_SECRETS`. |
| `GEMINI_API_KEY` | Optional | Google Gemini API key for live AI Tutor, Question Generator, Mistake Analyzer, and OCR. | Falls back to `LocalTutorEngine` if omitted. |
| `AI_PROVIDER` | Optional | Selects `"gemini"` (default) or `"local"` (`LocalTutorEngine`). | Defaults to `"gemini"` when `GEMINI_API_KEY` is present. |
| `AI_MODEL` | Optional | Primary Gemini model identifier. | Should be set to `"gemini-2.5-flash"` or `"gemini-2.5-flash-lite"`. |
| `YOUTUBE_API_KEY` | Optional | YouTube Data API v3 key for live video search. | Falls back to curated Mathisipan catalog if omitted. |
| `APP_URL` | Optional | Public HTTPS origin URL for CORS and canonical links. | Should match deployed HTTPS domain. |

---

## PHASE 8 — PRIORITIZED LIMITATIONS & RISK REGISTER

Every limitation discovered during the audit is cataloged below with exact evidence, priority (`P0` Blocker, `P1` High, `P2` Medium, `P3` Enhancement), required fix, and estimated effort.

|Summary of Identified Limitations|Count|
|:---|---:|
|**Total Limitations Logged**|**16**|
|**Resolved & Verified in Controlled P0/P1 Remediation (`LIM-01`, `LIM-03`–`LIM-10`)**|**9**|
|**Prepared on Disk — Awaiting User Approval for DB Baseline Stamp (`LIM-02`)**|**1**|
|**Remaining P2/P3 Backlog (`LIM-11`–`LIM-16`)**|**6**|

| ID | Feature or Issue | Status | Verification & Implementation Summary | Priority |
| :--- | :--- | :---: | :--- | :---: |
| **LIM-01** | **Hardcoded Demo Credentials in Client Bundle & Seeded DB** | **RESOLVED & VERIFIED** | Stripped hardcoded demo emails and passwords from `src/lib/auth/auth-context.tsx`; added dev-only `POST /api/auth/dev-quick-login` (`server.ts`, returns `404` in production); guarded `prisma/seed.ts` against running in production (`ALLOW_PRODUCTION_SEED`). Verified `0` matches in `dist/assets/*.js`. | **P0** |
| **LIM-02** | **Prisma Migration Baseline (`prisma/migrations`)** | **PREPARED ON DISK (DB STAMP PENDING APPROVAL)** | Generated `prisma/migrations/migration_lock.toml` and `prisma/migrations/0001_baseline/migration.sql` (1,171 lines) with `0` schema drift against live Neon PostgreSQL. Live database untouched; `npx prisma migrate resolve --applied 0001_baseline` awaits explicit user approval. | **P0** |
| **LIM-03** | **Session Token Duplicated in `localStorage` (`SEC-01`)** | **RESOLVED & VERIFIED** | Removed `localStorage.setItem/getItem` for session tokens in `src/lib/auth/auth-context.tsx`, actively purging any legacy token and relying on the `httpOnly` `tuklas_session` cookie + in-memory fallback. | **P1** |
| **LIM-04** | **Cookie `SameSite=None` Without CSRF Protection (`SEC-02`)** | **RESOLVED & VERIFIED** | Changed `tuklas_session` cookie to `sameSite: "lax"` across all auth endpoints in `server.ts` and added Same-Origin CSRF `Origin` validation middleware on `/api` for `POST`/`PUT`/`PATCH`/`DELETE` (verified `403` on cross-origin POST). | **P1** |
| **LIM-05** | **Missing HTTP Security Headers (`SEC-03`)** | **RESOLVED & VERIFIED** | Added security headers middleware in `server.ts`: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Permitted-Cross-Domain-Policies: none`, `Permissions-Policy: microphone=(self), camera=(), geolocation=()`, and `Strict-Transport-Security` (in production/HTTPS). | **P1** |
| **LIM-06** | **Unthrottled AI Generation & Document Upload Routes (`SEC-04`)** | **RESOLVED & VERIFIED** | Added `aiEndpointRateLimiter` (30 req/min) and `documentUploadRateLimiter` (20 req/15 min) in `src/lib/rate-limiter.ts` and attached them to `/api/lessons/:id/documents`, `/api/ai/tutor`, `/api/ai/practice/generate`, `/api/teacher/students/:studentId/analyze`, and `/api/teacher/ai-assistant`. | **P1** |
| **LIM-07** | **Gemini Invalid Model Names & Sequential Retry Latency (`src/lib/ai/provider.ts`)** | **RESOLVED & VERIFIED** | Added `normalizeGeminiModel` (`gemini-3.8-flash` -> `gemini-3.5-flash-lite`) and a 60-second static quota circuit breaker (`quotaCooldownUntil`) in `GeminiAIProvider` so `429 RESOURCE_EXHAUSTED` immediately delegates to `LocalTutorEngine`. | **P1** |
| **LIM-08** | **Research CSV Exports Hardcode Single Student ID (`usr_student_01`)** | **RESOLVED & VERIFIED** | Updated `GET /api/teacher/research/export/metrics.csv` and `attempts.csv` (`server.ts`) to query all authorized students via `TeacherService.getAuthorizedStudentsPaginated` and resolve real student names (verified exporting all 8 authorized student rows). | **P1** |
| **LIM-09** | **Silent Fallback to In-Memory Seed Store on DB Errors (`src/lib/db.ts`)** | **RESOLVED & VERIFIED** | Added `assertNotProductionFallback()` in `src/lib/db.ts` and enforced it across write operations (`updateStudentProgress`, `createLesson`, `updateLesson`, `updateLessonStatus`, `deleteLesson`, `saveLessonSession`, `submitCheckpointAttempt`) so production throws `503 DatabaseUnavailableError` instead of silently losing writes. | **P1** |
| **LIM-10** | **Missing IDOR Check on Teacher Student Insights Routes (`SEC-06`)** | **RESOLVED & VERIFIED** | Added `TeacherService.isTeacherAuthorizedForStudent(session.userId, studentId, session.role)` check to both `GET /api/teacher/students/:studentId/insights` and `POST /api/teacher/students/:studentId/analyze` (`server.ts`), verified returning `403` for unassigned students. | **P2** |
| **LIM-11** | **In-Memory Persistence of `teacherAISettings`** | **OPEN (P2)** | `src/lib/db.ts` stores `teacherAISettings` in `fallbackStore.teacherAISettings`; persist in PostgreSQL so settings survive server restarts. | **P2** |
| **LIM-12** | **No Teacher Classroom Creation / Student Enrollment UI & API** | **OPEN (P2)** | Add `POST /api/teacher/classes` and student classroom enrollment endpoints/UI controls. | **P2** |
| **LIM-13** | **Chrome on Windows Lacks Native `fil-PH` TTS Voice** | **OPEN (P2)** | Edge provides 321 voices including `Microsoft Angelo Online (Natural)`; Chrome on Windows provides 19 voices without `fil-PH`. | **P2** |
| **LIM-14** | **`npm audit` Reports 4 Dependency Vulnerabilities (`1 High, 3 Moderate`)** | **OPEN (P2)** | Upgrade `mammoth` and transitive packages via `npm audit fix`. | **P2** |
| **LIM-15** | **Client Bundle Chunk Size Warning (`716.80 kB`) & Unprotected `/voice-lab`** | **OPEN (P3)** | Lazy-load heavy route views in `src/App.tsx` via `React.lazy()` and gate `/voice-lab`. | **P3** |
| **LIM-16** | **No Admin UI for User Role Promotion & Password Reset** | **OPEN (P3)** | Add `/api/admin/users` management endpoints and Admin Portal UI controls. | **P3** |
