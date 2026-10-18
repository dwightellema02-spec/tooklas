# Educator review of the tutor's misconception ideas

**Status: DRAFT, NOT REVIEWED BY A TEACHER.** The 32 wrong ideas in the catalog and the 49 cases below were written by an AI from the
question bank. Nothing here has been checked by a teacher or tried with students. The tutor treats every idea as a suspicion that the
student's own answer must support, but a suspicion is only worth following if the idea is a real one. That is what this review decides.

## What a teacher is asked to do

Open `docs/tutor-review/TUTOR_REVIEW_CASES.csv` in Excel or Google Sheets (UTF-8, Filipino text displays correctly). Each row is one
student situation. For each row fill in the four empty columns at the end:

| Column | What to write |
|---|---|
| `reviewer_verdict` | `ACCEPT` (the draft is right as written), `CHANGE` (right idea, wrong wording or wrong expectation) or `REMOVE` (not a real or useful case) |
| `reviewer_notes` | What to change, or why. One line is enough. |
| `reviewed_by` | Your name |
| `reviewed_on` | The date |

The columns before those show what the system did, so you can compare it with your own judgement:

* `student_answers`, `student_message`: what the student did (the answer the idea predicts, or an audit situation).
* `draft_observation`: the fact the system may state. Check that it is a fact, not a guess.
* `draft_ideas`: the wrong idea(s) the author thinks would explain the answer. **This is the main thing to judge:** would a student
  really think this way, or is another cause more likely? Several ideas can give the same wrong answer on purpose.
* `system_ideas_found`, `system_agrees_with_draft`: what the code finds from the same answers. Agreement only shows the code does what the
  author intended. It does not show the author was right.
* `follow_up_question_system_would_ask`, `answer_that_would_support_the_idea`: the question the tutor would put to the student next, and
  the wrong answer that would count in favour of the idea. Is it a fair question? Would it tell the ideas apart?
* `builtin_tutor_reply`: what the built-in tutor says (English or Filipino, matching the student). Would you say this to a Grade 7 student?
* `reply_gives_answer_away`, `reply_states_a_diagnosis`: automatic checks. Both should be `no` on every row.
* `draft_expected_tutor_behaviour`: what the author thinks the tutor should and should not do.

Not every row needs a long note. Rows in the groups "Audit situations" and "Situations that must not create a suspicion" matter most: they
are the cases where a wrong call hurts a student (a right answer treated as a problem, or an answer given away).

**One question the author could not settle (RC-39):** a student answers 20, is wrong, gets a hint and then answers 25. The system keeps the
earlier suspicion at low confidence. Should a corrected answer lower or remove it?

## Loading the verdicts back

```bash
npx tsx scripts/run-tutor-review-set.ts --summarize docs/tutor-review/TUTOR_REVIEW_CASES.csv
```

(use the path of the file you filled in). It counts ACCEPT, CHANGE and REMOVE, lists every case a teacher wants changed or removed with
the note, and flags verdicts that are not one of the three words. It does not edit anything. The changes are made by a person:

* an idea in the catalog: `src/lib/ai/misconceptions/catalog.ts`, found by the idea id in `draft_ideas` (for example
  `pct.change.reports-amount`). Change its belief, its name or its correction text (both English and Filipino), or delete the entry.
* a case: `scripts/tutor-review-cases.ts`, found by the case id (for example `RC-14`).

After editing, run `npx tsx scripts/run-tutor-review-set.ts` again to regenerate the CSV and `npx tsx scripts/test-misconception-model.ts`
to check the catalog still behaves. Until every idea has been through this review the teacher screen says the list is an AI-written draft.

## What the run reports (and what it does not)

`npx tsx scripts/run-tutor-review-set.ts` runs all cases through the real detection code and the built-in tutor, then writes the CSV. On the
last run: 49 cases; the code finds the same ideas as the draft in 49 of 49 (two drafts were rewritten after the first run because the
author's expectation was less precise than what the code does: RC-39 and RC-49); no reply gave an answer away; no reply stated a
diagnosis; a follow-up question was available in 34 of the 39 cases where an idea was found.

These numbers measure agreement with the AI-written drafts. They say nothing about whether the drafts are right.

## Known limits of this set

* **The tutor replies are from the built-in tutor, not from Gemini**, and without lesson text (only the lesson title). The live tutor
  with the full lesson will word things differently.
* **Four built-in replies are generic.** RC-35 (remembered part of the formula), RC-37 ("hindi ko po maintindihan"), RC-42 (the student
  explained their 20) and RC-44 (the student asked for the answer) get the standard "how did you get it?" reply, not one that uses what the
  student said, and RC-44's reply does not say why the answer is not given. The author sees these as gaps to fix after review, not as passes.
* **Follow-up questions exist only for typed number questions that have a second question in the same skill where the idea gives a different
  wrong answer.** No follow-up was available for RC-01 to RC-04 and RC-12. Multiple-choice and true/false misses (RC-43) do not match any idea.
* **Cross-lesson ideas are not followed up.** A follow-up never comes from a different skill, because that question may be ahead of what the
  student has been taught.
* **Every case is one student at one moment.** The longer flow (suspected, checking, supported, correcting, resolved or persisting) is
  covered by `scripts/test-misconception-flow.ts` with made-up answers, not by real students.
