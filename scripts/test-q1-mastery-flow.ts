/**
 * End-to-end check of the mastery flow with the Term 1 question bank.
 *
 * Needs a running server (dev mode is fine) whose database already has the lessons published and the
 * question bank seeded (scripts/seed-bow-restructure.ts and scripts/seed-q1-question-bank.ts).
 *   APP_URL=http://localhost:3000 npx tsx scripts/test-q1-mastery-flow.ts
 *
 * It registers two throwaway students (…@example.invalid). It briefly sets one lesson to DRAFT and back to
 * check that practice sets of unpublished lessons stay hidden, so run it only against a test database.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { SKILLS } from "../prisma/g7-q1-questions.ts";

const B = (process.env.APP_URL || "http://localhost:3000").replace(/[/]$/, "");
const j = async (p: string, o: RequestInit = {}, tok?: string) => {
  const r = await fetch(B + p, { ...o, headers: { "content-type": "application/json", ...(tok ? { authorization: "Bearer " + tok } : {}) } });
  return { s: r.status, b: (await r.json().catch(() => ({}))) as any };
};
let pass = 0, fail = 0;
const t = (n: string, ok: boolean, d = "") => { ok ? pass++ : fail++; console.log((ok ? "  PASS  " : "  FAIL  ") + n + (ok ? "" : ` (${d})`)); };

// answer keys from the bank itself
const key = new Map<string, any>();
for (const s of SKILLS) s.items().forEach((it, i) => key.set(`qst_g7q1_${s.code}_${String(i + 1).padStart(2, "0")}`, it));
const right = (id: string) => { const it = key.get(id); return it.type === "MULTIPLE_CHOICE" ? it.data.correctAnswer : it.type === "TRUE_FALSE" ? String(it.data.correctAnswer) : String(it.data.correctAnswer); };
const wrong = (id: string) => { const it = key.get(id); if (it.type === "MULTIPLE_CHOICE") return it.data.choices.find((c: any) => c.id !== it.data.correctAnswer).id; if (it.type === "TRUE_FALSE") return String(!it.data.correctAnswer); return String(Number(it.data.correctAnswer) + 7); };

const reg = async (name: string) => (await j("/api/auth/register", { method: "POST", body: JSON.stringify({ name, email: `${name.replace(/\s/g, "").toLowerCase()}-${Date.now()}@example.invalid`, password: "Master-Pass-9xQ!pilot" }) })).b.token as string;
const A = await reg("Strong Student"), Bk = await reg("Struggling Student");

async function runSet(tok: string, setId: string, pick: (id: string) => string) {
  const st = await j("/api/practice/start", { method: "POST", body: JSON.stringify({ practiceSetId: setId }) }, tok);
  if (st.s !== 201) return { ok: false, status: st.s, feedback: [] as string[] };
  const sess = st.b.data;
  const qs: any[] = sess.questions || sess.sessionQuestions || [];
  const feedback: string[] = [];
  for (const q of qs) {
    const qid = q.questionId || q.question?.id;
    const r = await j(`/api/practice/${sess.id}/answer`, { method: "POST", body: JSON.stringify({ questionId: qid, answer: pick(qid), timeTakenMs: 4000 }) }, tok);
    feedback.push(r.b.data?.feedback || r.b.data?.result?.feedback || "");
  }
  const done = await j(`/api/practice/${sess.id}/complete`, { method: "POST" }, tok);
  return { ok: done.s === 200, status: done.s, count: qs.length, feedback, summary: done.b.data };
}

// 1. what a student receives
const sp = await j("/api/practice-sets/ps_g7q1_w1l1_basic", {}, A);
const sq: any[] = (sp.b.data?.questions || []).map((x: any) => x.question);
t("student can open a published lesson's practice set (6 questions)", sp.s === 200 && sq.length === 6, `status ${sp.s} count ${sq.length}`);
const blob = JSON.stringify(sq);
t("no answer key, explanation or per-choice hint reaches the student", !/correctAnswer|feedbackByChoice|correctFeedback|incorrectFeedback|"explanation"/.test(blob));

// 2. strong student: all three sets and the week quiz, all correct
for (const kind of ["basic", "mixed", "challenge"]) {
  const r = await runSet(A, `ps_g7q1_w1l1_${kind}`, right);
  t(`strong student completes w1l1 ${kind} set (6/6 correct)`, r.ok && r.count === 6 && (r.summary?.score ?? r.summary?.correctAnswers) !== undefined, JSON.stringify(r).slice(0, 160));
}
const quiz = await runSet(A, "ps_g7q1_w1_quiz", right);
t("strong student completes the Week 1 quiz", quiz.ok, JSON.stringify(quiz).slice(0, 160));
const m1 = await j("/api/student/mastery/skl_g7q1_w1l1", {}, A);
const level1 = m1.b.data?.mastery?.status || m1.b.data?.status || m1.b.data?.level || JSON.stringify(m1.b.data).slice(0, 200);
console.log("   mastery after 18+ correct attempts:", level1);
t("strong student reaches PROFICIENT or MASTERED", /PROFICIENT|MASTERED/.test(String(level1)), String(level1));

// 3. struggling student: wrong answers, specific feedback, low mastery
const bad = await runSet(Bk, "ps_g7q1_w4l1_basic", wrong);
t("struggling student completes the set with wrong answers", bad.ok, JSON.stringify(bad).slice(0, 160));
{
  // Answer one multiple-choice question with a specific wrong choice and expect that choice's own hint.
  const st = await j("/api/practice/start", { method: "POST", body: JSON.stringify({ practiceSetId: "ps_g7q1_w4l1_basic" }) }, Bk);
  const mcId = "qst_g7q1_w4l1_05";
  const item = key.get(mcId);
  const wrongChoice = item.data.choices.find((c: any) => c.id !== item.data.correctAnswer);
  const res = await j(`/api/practice/${st.b.data.id}/answer`, { method: "POST", body: JSON.stringify({ questionId: mcId, answer: wrongChoice.id, timeTakenMs: 3000 }) }, Bk);
  const got = res.b.data?.feedback || res.b.data?.result?.feedback || "";
  t("a wrong multiple-choice answer gets the hint written for that exact mistake", got === item.data.feedbackByChoice[wrongChoice.id], `got "${got}"`);
}
await runSet(Bk, "ps_g7q1_w4l1_mixed", wrong);
const m2 = await j("/api/student/mastery/skl_g7q1_w4l1", {}, Bk);
const level2 = m2.b.data?.mastery?.status || m2.b.data?.status || m2.b.data?.level || JSON.stringify(m2.b.data).slice(0, 200);
console.log("   mastery after 12 wrong attempts:", level2);
t("struggling student is NOT shown as proficient", !/PROFICIENT|MASTERED/.test(String(level2)), String(level2));
const rec = await j("/api/student/adaptive/recommendation", {}, Bk);
console.log("   adaptive recommendation:", JSON.stringify(rec.b.data?.recommendationType || rec.b.data?.recommendedActivityType || rec.b.data).slice(0, 120));
t("adaptive engine responds for the struggling student", rec.s === 200, String(rec.s));

// 4. practice sets of an unpublished lesson stay hidden from students
const prisma = new PrismaClient();
await prisma.lesson.update({ where: { id: "lsn_g7q1_w7_l2" }, data: { status: "DRAFT" } });
const list = await j("/api/practice-sets", {}, A);
t("sets of an unpublished lesson are not listed for students", !(list.b.data || []).some((p: any) => String(p.id).startsWith("ps_g7q1_w7_l2") || String(p.id).startsWith("ps_g7q1_w7l2")), "listed");
const hidden = await j("/api/practice-sets/ps_g7q1_w7l2_basic", {}, A);
t("opening such a set returns 404", hidden.s === 404, String(hidden.s));
const startHidden = await j("/api/practice/start", { method: "POST", body: JSON.stringify({ practiceSetId: "ps_g7q1_w7l2_basic" }) }, A);
t("starting such a set returns 404", startHidden.s === 404, String(startHidden.s));
await prisma.lesson.update({ where: { id: "lsn_g7q1_w7_l2" }, data: { status: "PUBLISHED" } });
const back = await j("/api/practice-sets/ps_g7q1_w7l2_basic", {}, A);
t("the set opens again once the lesson is published", back.s === 200, String(back.s));
await prisma.$disconnect();

console.log(`\n${pass} passed, ${fail} failed`);
