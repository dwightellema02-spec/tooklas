# How the AI tutor follows the learning cycle

This note describes what the tutor does today, what it can and cannot prove, and how to test it. It replaces guesswork about
"is the tutor adaptive" with the facts below.

## 1. What the tutor knows, and where it comes from

The page only says **which** lesson, question, practice session or lesson block the student is on. The server loads everything else
from its own data and checks that the block belongs to the lesson:

| Fact | Source |
|---|---|
| Lesson title, objectives, text, worked examples | the published lesson (students never get drafts) |
| The section the student has open | `blockId` sent by the lesson page, checked against the lesson |
| Practice question, choices, answer key | the question row; the key is used only to judge, never shown |
| Checkpoint question and answer key | the lesson block's metadata, found from `blockId` |
| The student's answer | their saved attempt (practice, across sessions) or their saved checkpoint answer |
| What the student wrote about their steps | their message to the tutor, saved with the question and answer it was about |
| Mastery, latest mistake analysis, adaptive recommendation | the mastery, analysis and adaptive tables |

Only teaching blocks (text, worked example, summary) go to the AI, the open section first, within a size cap. Pictures, explorers,
videos, practice and checkpoints (which carry answer keys) do not. Documents marked "(Teacher Reference)", such as the DepEd Lesson
Exemplars, and the extracted text of any document, are never put in the prompt.

When the lesson and question are unknown, or the student's message is about a different topic than the open lesson, the tutor asks
which one they mean instead of guessing. Topic from data and topic from the message are kept apart (`contextStatus.topicSource`).

## 2. What it does with the student's work

* A written equation that does not compute (for example `100 + 110 + 120 + 90 = 430`) is found by a small calculator, not by the AI.
  That is a verified observation. The tutor points to the step and asks the student to recheck it, without saying the final answer.
* A wrong answer on its own is an observation, never a confirmed misconception. The first reply asks a question; the second changes
  strategy (the same wrong answer twice is named, and the method hint is given); the third explains the method with the lesson's
  worked example, still without the final result, and suggests asking the teacher.
* A right answer is confirmed and followed by a check of understanding: the student is asked to explain, or to test the method on
  the lesson's worked example.
* Replies that state the final answer of a question the student has not answered correctly are replaced before the student sees
  them (`fallbackReason: revealed_answer`). So are replies in the wrong language, empty or unreadable ones.

## 3. Engines

1. The AI model (Gemini), when it answers and its reply passes the checks above.
2. The built-in tutor (`socratic-engine.ts`) otherwise. It works from the same facts, outside the integer lessons it is topic-aware, and
   it says what it can do (ask, hint, change strategy, check a step) without inventing a diagnosis. Integer lessons keep the original
   keyword tutor.

The reply says which one answered. When the model's reply was replaced, the engine label names the reason and the tutor panel shows
a "Basic tutor mode" note.

## 4. Mistake analysis

* It looks at the student's recent attempts on the whole **skill** (not one session), plus checkpoint answers in the lessons that teach
  it, plus what the student wrote about their work.
* Sign errors are reported only when wrong answers are the exact opposite of the right ones, more than once. Words such as "sign" in a
  question's text do nothing.
* The same wrong answer repeated is reported as a consistent method (`PROCEDURAL_ERROR`) with a diagnostic question, not a cause.
* Several wrong answers with no pattern are `UNKNOWN`; the cause "cannot be told from the answers alone".
* Confidence is capped by evidence: below 0.7 with fewer than 3 wrong answers, 0.75 without any explanation from the student, 0.85
  at most (also when a model is more sure). A cached analysis is reused only if the newest attempt and the amount of written work are
  unchanged.
* Mastery counts stay **practice-only**. Checkpoint answers feed the mistake analysis and the tutor, not the mastery gate (5 practice
  answers, 60% correct), so the gate means what it says.

## 5. Adaptive next step

Rules are deterministic and use real evidence (accuracy, hints, repeated mistakes, prerequisites). The practice set that is recommended
is the one whose questions are closest to the difficulty the decision asked for (easy, medium, hard), and the app no longer falls back to
a fixed practice set.

## 6. Suspected misconceptions (P2)

A wrong answer is an observation. The system turns it into a **suspicion** only when a catalog idea predicts exactly that wrong answer
(for example, 80 to 100 answered 20 fits "reports the amount of change" and also "divides by the new value"). Both are kept, with the other
causes that cannot be ruled out (a slip, a misread question, a guess). One question gives low confidence (at most 0.5); the same idea
explaining wrong answers on more questions raises it; rival ideas lower it; the student's own matching follow-up answer raises it most.
The ceiling is 0.85.

| Step | What happens | Who decides |
|---|---|---|
| SUSPECTED | recorded in the background after a wrong numeric practice answer | the catalog predicts the exact answer |
| CHECKING | the tutor panel shows a follow-up question on which the ideas would answer differently | the system picks it |
| SUPPORTED / NOT_SUPPORTED | the student answers it; the server grades it | the student's answer |
| CORRECTING | the correction (catalog text and the lesson's worked example) and a verification question are shown | the system |
| RESOLVED / PERSISTING | verification answered correctly, or the same wrong idea again (also when a resolved idea explains a new wrong answer) | the student's answer |
| DISMISSED | a teacher decided it does not apply (never reopened by the system) | the teacher |

* Follow-up and verification answers are stored in the misconception row, **not** as practice attempts, so mastery stays practice-only.
  The reply to the student never contains the correct answer, because the question may still be in their practice set.
* The tutor prompt lists open ideas as hypotheses ("never tell the student they have this misconception"). If the student is still
  wrong after two replies and the model repeats itself (word overlap above 0.8), the reply is replaced by the built-in tutor's
  next move (`fallbackReason: repeated_reply`).
* Teachers see each suspicion with its evidence, alternatives, follow-up results and confidence, and can dismiss, confirm or add a
  note (Insights page, Mistakes tab). The list says the catalog is an AI-written draft.
* Code: `src/lib/ai/misconceptions/` (catalog, detector, service); table `StudentMisconception` (migration 0002).

**Limits.** The 32 ideas are AI-written drafts that no teacher has reviewed (section 8). Detection and follow-up exist only for typed
number questions; a follow-up needs another numeric question in the same skill where the idea gives a different wrong answer (no
follow-up for 5 of the 39 draft cases that find an idea). Multiple-choice and true/false misses are not matched to ideas.

## 7. Tests

* `npx tsx scripts/test-tutor-learning-cycle.ts`: 70 checks, no server (calculator, topics, Taglish, answer guard, fallback tutor,
  lesson text selection, repeat detection, mistake analysis, LaTeX in model replies, hypotheses in the prompt).
* `npx tsx scripts/test-misconception-model.ts`: 31 checks, no server (catalog sanity on the real question bank, which ideas explain which
  answers, ambiguity, confidence, alternatives, follow-up choice, grading of follow-up answers).
* `APP_URL=... DATABASE_URL=... npx tsx scripts/test-misconception-flow.ts`: 34 checks through the real server and database (suspicion,
  follow-up, support, correction, verification, persisting, ruled out, teacher view, security, mastery untouched). Creates throwaway users:
  use a review or test database.
* `APP_URL=... npx tsx scripts/audit-tutor-scenarios.ts`: nine scenarios through the real HTTP tutor. It prints what the student would
  see; a person judges it.

## 8. Educator review (P3)

`docs/TUTOR_EDUCATOR_REVIEW.md` explains the review of the ideas. `npx tsx scripts/run-tutor-review-set.ts` writes
`docs/tutor-review/TUTOR_REVIEW_CASES.csv`: 49 AI-drafted cases (one per idea, the audit situations, cases that must not create a suspicion)
with empty verdict columns for teachers. `--summarize <file.csv>` reads the verdicts back. **Status: draft, not reviewed by a teacher.**

**Not done:** teacher review of the catalog and cases, many live model samples, a check of how the tutor replies read to students, and any
test with students.
