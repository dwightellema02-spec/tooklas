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

## 6. Tests

* `npx tsx scripts/test-tutor-learning-cycle.ts`: 64 checks, no server, covering the calculator, topics, Taglish detection, the answer
  guard, the fallback tutor in each situation, lesson text selection, the mistake analysis and LaTeX in model replies.
* `APP_URL=... npx tsx scripts/audit-tutor-scenarios.ts`: nine scenarios through the real HTTP tutor (correct answer with flawed
  reasoning, wrong answer with an addition slip, incomplete, ambiguous, repeated errors, correction after a hint, checkpoint help, no
  context, conflicting topic). It prints what the student would see; a person judges it.

**Not done:** an educator-reviewed set of expected answers and misconceptions, many live model samples, and any test with students.
Those are the next step (P3).
