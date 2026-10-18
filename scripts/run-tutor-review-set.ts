/**
 * Runs the draft educator-review cases through the real misconception logic and the built-in tutor, prints a summary and
 * writes a CSV for teachers. No server, no database, no AI model.
 *
 *   npx tsx scripts/run-tutor-review-set.ts                        run and write docs/tutor-review/TUTOR_REVIEW_CASES.csv
 *   npx tsx scripts/run-tutor-review-set.ts --summarize <file.csv> read a CSV that teachers filled in and summarise their verdicts
 *
 * What the numbers mean: "agrees with the draft" says the SYSTEM gives the same answer as the AI-written expectation. It
 * does NOT say the expectation is right. Only a teacher's verdict does that (docs/TUTOR_EDUCATOR_REVIEW.md).
 * The tutor reply in the CSV is from the built-in tutor with a plain lesson header (no lesson text), not from Gemini.
 */
import fs from "fs";
import path from "path";
import { SKILLS } from "../prisma/g7-q1-questions.ts";
import { MISCONCEPTION_BY_ID } from "../src/lib/ai/misconceptions/catalog.ts";
import { alternativesFor, explainAttempts, numberOf, sameNumber, selectFollowUp, type PoolQuestion, type WrongAttempt } from "../src/lib/ai/misconceptions/detector.ts";
import { socraticResponse, revealsExpectedAnswer } from "../src/lib/ai/socratic-engine.ts";
import { findArithmeticSlips } from "../src/lib/ai/arithmetic.ts";
import { detectTopicConflict } from "../src/lib/ai/topics.ts";
import { detectLanguagePreference } from "../src/lib/ai/context.ts";
import type { AITutorContext } from "../src/lib/ai/types.ts";
import { REVIEW_CASES, type ReviewCase } from "./tutor-review-cases.ts";

const OUT = path.join("docs", "tutor-review", "TUTOR_REVIEW_CASES.csv");
const STATUS = "DRAFT, NOT REVIEWED BY A TEACHER";
const VERDICTS = ["ACCEPT", "CHANGE", "REMOVE"];

// ---------------------------------------------------------------- the bank
interface Item { id: string; prompt: string; expected: string; type: string; difficulty: string; incorrectFeedback: string }
function bank(skill: string): { title: string; items: Item[] } {
  const s = SKILLS.find((x) => x.code === skill);
  if (!s) throw new Error("Unknown skill " + skill);
  const items = (s.items() as any[]).map((it, i) => ({
    id: `qst_g7q1_${skill}_${String(i + 1).padStart(2, "0")}`,
    prompt: it.prompt as string,
    expected: it.type === "MULTIPLE_CHOICE" ? String(it.data.choices.find((c: any) => c.id === it.data.correctAnswer)?.text) : String(it.data.correctAnswer),
    type: it.type as string,
    difficulty: i < 6 ? "EASY" : i < 12 ? "MEDIUM" : "HARD",
    incorrectFeedback: String(it.incorrectFeedback || ""),
  }));
  return { title: s.title, items };
}
const isRight = (item: Item, answer: string) => {
  const a = numberOf(answer), b = numberOf(item.expected);
  return a !== null && b !== null ? sameNumber(a, b) : answer.trim().toLowerCase() === item.expected.trim().toLowerCase();
};

// ---------------------------------------------------------------- run one case
const DIAGNOSIS = /(you (believe|think that|have a misconception|are using the wrong)|your misconception|ang akala mo|may maling akala ka|you mistakenly)/i;

function runCase(c: ReviewCase) {
  const { title, items } = bank(c.skill);
  const main = c.q > 0 ? items[c.q - 1] : null;

  // wrong attempts across questions of this skill, as the detector sees them
  const attempts = c.attempts.map((a, i) => {
    const item = items[(a.q ?? c.q) - 1];
    return { a, item, correct: item ? isRight(item, a.answer) : false, n: i + 1 };
  });
  const wrong: WrongAttempt[] = attempts
    .filter((x) => x.item && !x.correct && x.item.type === "NUMERIC_INPUT")
    .map((x) => ({ attemptId: `${c.id}-a${x.n}`, questionId: x.item.id, prompt: x.item.prompt, answer: x.a.answer, expected: x.item.expected }));
  const hyps = explainAttempts(wrong, c.skill);
  const found = hyps.map((h) => h.entry.id);

  // the follow-up question the system would ask for the strongest suspicion
  let followUp = "";
  let followUpWrong = "";
  if (hyps.length > 0) {
    const top = hyps.filter((h) => h.distinctQuestions === hyps[0].distinctQuestions)[0];
    const rivals = alternativesFor(top, hyps, wrong).filter((a) => a.kind === "catalog").map((a) => MISCONCEPTION_BY_ID.get(a.id)!).filter(Boolean);
    const pool: PoolQuestion[] = items.filter((i) => i.type === "NUMERIC_INPUT").map((i) => ({ id: i.id, prompt: i.prompt, expected: i.expected, difficulty: i.difficulty }));
    const pick = selectFollowUp(top.entry, rivals, pool, attempts.map((x) => x.item?.id).filter(Boolean) as string[]);
    if (pick) {
      followUp = `(for "${top.entry.id}") ${pick.question.prompt}`;
      followUpWrong = String(Math.round(pick.predicted * 100) / 100);
    } else followUp = "(none available)";
  }

  // the built-in tutor's reply to the last turn
  const mine = attempts.filter((x) => (x.a.q ?? c.q) === c.q);
  const header = [title, "Week · " + title];
  const conflict = c.message ? detectTopicConflict(c.message, header) : null;
  const lessonKnown = c.q > 0;
  const ctx = {
    student: { id: "s1", name: "Student", gradeLevel: 7 },
    curriculum: { subject: "Mathematics", grade: 7, term: 1, lessonTitle: title },
    lesson: lessonKnown ? { id: "lsn_" + c.skill, title } : undefined,
    skill: lessonKnown ? { id: "skl_" + c.skill, title } : undefined,
    question: main
      ? { id: main.id, type: main.type, prompt: main.prompt, difficulty: main.difficulty, expectedAnswer: main.expected, incorrectFeedback: main.incorrectFeedback, source: "practice" }
      : undefined,
    studentAnswer: mine.length ? mine[mine.length - 1].a.answer : undefined,
    previousAttempts: mine.map((x) => ({ answer: x.a.answer, isCorrect: x.correct, attemptNumber: x.n })),
    recentMessages: [],
    helpLevel: "LEVEL_1_HINT",
    studentQuery: c.message || "",
    groundedLesson: lessonKnown ? { id: "lsn_" + c.skill, title, status: "PUBLISHED", learningObjectives: [title], contentBlocks: [], teacherMaterials: [], prerequisiteSkills: [] } : undefined,
    requestedLanguage: detectLanguagePreference(c.message || "", []),
    contextStatus: {
      lessonKnown,
      questionKnown: Boolean(main),
      topicSource: main ? "question" : lessonKnown ? "lesson" : "unknown",
      conflict: conflict ? { mentioned: conflict.mentioned.en, lessonTopic: conflict.lessonTopic?.en || "" } : undefined,
    },
    studentWork: { explanations: c.message ? [c.message] : [], arithmeticSlips: c.message ? findArithmeticSlips(c.message) : [] },
  } as unknown as AITutorContext;
  const reply = socraticResponse(ctx);
  const replyText = [reply.message, reply.guidingQuestion].filter(Boolean).join(" ");
  const lastWrong = mine.length > 0 && !mine[mine.length - 1].correct;
  const reveals = Boolean(main) && lastWrong && revealsExpectedAnswer(replyText, ctx);
  const diagnosis = DIAGNOSIS.test(replyText);

  const draft = [...c.draftIdeas].sort().join(",");
  const got = [...found].sort().join(",");
  const agrees = draft === got;

  return { c, main, wrong, found, followUp, followUpWrong, replyText, replyLang: ctx.requestedLanguage, reveals, diagnosis, agrees, draft, got };
}

// ---------------------------------------------------------------- CSV
const esc = (v: unknown) => {
  const s = String(v ?? "").replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
  return /[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const COLUMNS = [
  "case_id", "group", "skill", "question", "correct_answer", "student_answers", "student_message",
  "draft_observation", "draft_ideas", "system_ideas_found", "system_agrees_with_draft",
  "follow_up_question_system_would_ask", "answer_that_would_support_the_idea",
  "builtin_tutor_reply", "reply_gives_answer_away", "reply_states_a_diagnosis", "draft_expected_tutor_behaviour",
  "status", "reviewer_verdict", "reviewer_notes", "reviewed_by", "reviewed_on",
];

function writeCsv(results: ReturnType<typeof runCase>[]) {
  const lines = [COLUMNS.join(",")];
  for (const r of results) {
    const { c } = r;
    const answers = c.attempts.length ? c.attempts.map((a) => (a.q && a.q !== c.q ? `${a.answer} (question ${a.q})` : a.answer)).join(" ; ") : "(no answer yet)";
    lines.push(
      [
        c.id, c.group, c.skill, r.main?.prompt || "(none open)", r.main?.expected || "", answers, c.message || "",
        c.draftObservation, r.draft || "(none)", r.got || "(none)", r.agrees ? "yes" : "NO",
        r.followUp, r.followUpWrong,
        `[${r.replyLang}] ${r.replyText}`, r.reveals ? "YES" : "no", r.diagnosis ? "YES" : "no", c.draftBehaviour,
        STATUS, "", "", "", "",
      ].map(esc).join(",")
    );
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, "﻿" + lines.join("\r\n") + "\r\n", "utf8"); // BOM so Excel reads Filipino text correctly
}

// ---------------------------------------------------------------- summarise teachers' verdicts
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell.length || row.length) { row.push(cell.replace(/\r$/, "")); rows.push(row); }
  return rows.filter((r) => r.length > 1);
}

function summarize(file: string) {
  const rows = parseCsv(fs.readFileSync(file, "utf8"));
  const head = rows[0];
  const col = (n: string) => head.indexOf(n);
  const need = ["case_id", "group", "reviewer_verdict", "reviewer_notes", "reviewed_by"].map(col);
  if (need.some((i) => i < 0)) throw new Error("This does not look like a review CSV (missing columns).");
  const body = rows.slice(1);
  const verdict = (r: string[]) => r[col("reviewer_verdict")].trim().toUpperCase();
  const counts: Record<string, number> = { ACCEPT: 0, CHANGE: 0, REMOVE: 0, "NOT YET REVIEWED": 0, INVALID: 0 };
  for (const r of body) {
    const v = verdict(r);
    counts[v === "" ? "NOT YET REVIEWED" : VERDICTS.includes(v) ? v : "INVALID"]++;
  }
  console.log(`\nVerdicts in ${file} (${body.length} cases)`);
  for (const [k, v] of Object.entries(counts)) console.log(`  ${k.padEnd(18)} ${v}`);
  const reviewers = [...new Set(body.map((r) => r[col("reviewed_by")].trim()).filter(Boolean))];
  console.log(`  reviewers: ${reviewers.join(", ") || "(none named)"}`);
  const open = body.filter((r) => ["CHANGE", "REMOVE"].includes(verdict(r)));
  if (open.length) console.log("\nCases a teacher wants changed or removed:");
  for (const r of open) console.log(`  ${r[col("case_id")]}  ${verdict(r)}  ${r[col("reviewer_notes")]}`);
  const bad = body.filter((r) => verdict(r) !== "" && !VERDICTS.includes(verdict(r)));
  for (const r of bad) console.log(`  ${r[col("case_id")]}: "${r[col("reviewer_verdict")]}" is not ACCEPT, CHANGE or REMOVE`);
  if (counts["NOT YET REVIEWED"] === body.length) console.log("\nNo teacher has reviewed these cases yet. The catalog and the cases remain AI-written drafts.");
}

// ---------------------------------------------------------------- main
const arg = process.argv.indexOf("--summarize");
if (arg >= 0) {
  summarize(process.argv[arg + 1]);
} else {
  const results = REVIEW_CASES.map(runCase);
  writeCsv(results);
  const disagree = results.filter((r) => !r.agrees);
  console.log(`Ran ${results.length} draft cases (status: ${STATUS}).`);
  console.log(`  ideas the system finds agree with the draft: ${results.length - disagree.length} of ${results.length}`);
  for (const r of disagree) console.log(`    ${r.c.id}: draft [${r.draft || "none"}] but system found [${r.got || "none"}]`);
  const rev = results.filter((r) => r.reveals);
  const dia = results.filter((r) => r.diagnosis);
  console.log(`  built-in tutor replies that give the answer away: ${rev.length}${rev.length ? " (" + rev.map((r) => r.c.id).join(", ") + ")" : ""}`);
  console.log(`  built-in tutor replies that state a diagnosis:    ${dia.length}${dia.length ? " (" + dia.map((r) => r.c.id).join(", ") + ")" : ""}`);
  console.log(`  follow-up question available where an idea was found: ${results.filter((r) => r.found.length && r.followUp && r.followUp !== "(none available)").length} of ${results.filter((r) => r.found.length).length}`);
  console.log(`Wrote ${OUT}. These numbers measure agreement with AI-written drafts, not correctness.`);
  process.exitCode = rev.length || dia.length ? 1 : 0;
}
