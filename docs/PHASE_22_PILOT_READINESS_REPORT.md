TUKLAS AI — PHASE 22 VERIFICATION REPORT (Pilot readiness and curriculum alignment)

PHASE: 22 (real-world end-to-end validation), with Phase 29, 30 and 31 checks applied to what changed.
OBJECTIVE: Align Grade 7 Mathematics with the April 2026 Budget of Work, add the Q1 Week 1-6 lessons,
and close the security and deployment gaps found in the pre-launch audit.

Master plan mapping (rule 3): section 25 curriculum, section 26 learning path, section 20 teacher
platform, section 23 security, section 24 database, sections 30, 37 and 39 (phases 22, 29, 31).

IMPLEMENTED:
1. Three-term curriculum blueprint from the Budget of Work, and an idempotent, dry-run-by-default
   restructure script (`scripts/seed-bow-restructure.ts`).
2. Twenty original DRAFT lessons for Term 1 Weeks 1-7, one per sub-topic (a week is several class days, so a
   week is not one lesson), limited to the Budget of Work and the exemplars. Multi-day lessons have Day sections.
   24 Math Isip videos are attached to the lessons they match (Weeks 1-7); the DepEd PDFs are teacher-only. Week 7 has no exemplar, so it follows the Budget of Work competency only.
3. A practice question bank for mastery: 360 questions (20 skills x 18) in 60 practice sets plus 7 weekly quizzes, checked by
   code before writing; wrong choices carry hints for the mistake they stand for; students never receive answers or hints in advance.
   Checkpoints and questions are graded on the server. Answer keys and teacher-document text are never sent
   to students or visitors. `/api/curriculum` and `/api/lessons` show visitors and students published lessons only.
4. Client route guard; production Content-Security-Policy; 1 MB body limit (30 MB only for signed-in staff
   uploads); AI settings and health details restricted.
5. Teacher: create class, enroll and remove students by email. Admin: list accounts and change roles.
6. Deployment: Dockerfile, render.yaml with migrations before start, working Windows/Linux start script,
   `build:prod`, runbook, smoke test, demo-account securing script, first-admin script.
7. Fixes: BOM in the baseline migration that broke `migrate deploy`; esbuild/vite peer conflict; learning path
   mixing units, subjects and grades; integer-specific wording shown on non-integer lessons; stale "Phase 1" text.

VERIFICATION:

Feature                                             Status
------------------------------------------------------------
Typecheck, production build                         PASS
Migration on a fresh database, no schema drift      PASS
Restructure script: dry run, apply, second run      PASS
Draft lessons hidden from students and visitors     PASS
Checkpoint answer keys not exposed; server grading  PASS
Forged isCorrect flag ignored                       PASS
Teacher document text hidden from students          PASS
Class create / enroll / remove, teacher isolation   PASS
Admin role changes, self-change blocked             PASS
Route guard (signed out, student on /teacher)       PASS
CSP present, no console violations (one lesson page)PASS
Mobile layout, 375 px (lesson, classes)             PARTIAL (emulated, two pages)
AI tutor answer                                     FALLBACK VERIFIED (Gemini returned 503)
Gemini live answer                                  NOT VERIFIED
Read-aloud                                          PARTIAL (speech started; audio not heard by tester)
Microphone input                                    NOT VERIFIED
Password reset, email verification                  NOT IMPLEMENTED
Skills and practice sets for the new lessons        NOT IMPLEMENTED

AUTOMATED TESTS (against a throwaway PostgreSQL database):
smoke test 25/25, roles and classes 20/20, auth unit 16/16, phase 21 20/20, phase 12 security 21/21,
new-account end-to-end 42/42, phase 14 research 25/25, phase 15 mastery 53/53, production auth 35/35,
teacher lesson and unit integration: all pass.

TYPECHECK: PASS
BUILD: PASS (main chunk about 715 kB, above the 500 kB warning)
DATABASE: PASS (fresh migration, restructure, role and class writes)
SECURITY: PASS for the items listed; see remaining risks
REAL BROWSER: PARTIAL (in-app browser, localhost only)
REAL DEVICE: NOT COMPLETED
REAL USER: NOT COMPLETED

KNOWN LIMITATIONS:
1. The tutor falls back to a rule-based engine when Gemini is unavailable.
2. Roles are stored in the session, so a changed role applies at the next sign-in (up to 7 days).
3. Rate limits are in memory, so only one instance is supported.
4. `npm audit`: 3 moderate findings in mammoth (breaking fix deferred).
5. The Admin research card reads a fixed demo student id.
6. The new lessons are drafts and have not been reviewed by a teacher. Week 7 was written from the Budget of Work only because no exemplar was provided.

DEFECTS FOUND:
1. Anyone could read draft lessons, answer keys and the DepEd PDF text through public endpoints.
2. The server trusted the browser's claim that a checkpoint answer was correct.
3. Teacher pages rendered for visitors who were not signed in.
4. `prisma migrate deploy` failed on a new database (byte-order mark in the baseline migration).
5. A one-megabyte-plus request body was accepted from anonymous visitors (limit was 30 MB for all).

FIXES: items 3, 4, 6 and 7 under IMPLEMENTED, with automated evidence above.

REMAINING RISKS:
1. The default demo password is in the git history of the original repository. Any database seeded before must run
   `scripts/secure-demo-accounts.ts`. (Owner action.)
2. A real Gemini key was present in a local `.env` that travelled in a zip. Rotate it. (Owner action.)
3. No privacy notice, consent flow or password reset yet; open sign-ups on a public address.
4. Voice and microphone are not validated on real classroom hardware.
5. The DepEd exemplars are teacher-use only; storing them as teacher-only documents is a decision for the school.

FINAL DECISION:
READY_WITH_MINOR_FIXES for a controlled, invitation-only classroom pilot once the owner actions above are done.
Not recommended for open public sign-up yet.
