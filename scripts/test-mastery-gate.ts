/**
 * Checks the mastery gate: the next lesson opens only after the lesson before it was completed AND its
 * skill reached DEVELOPING (5+ practice attempts, 60%+ correct).
 *
 * Needs a running server whose database has the Term 1 lessons published and the question bank seeded.
 *   APP_URL=http://localhost:3000 npx tsx scripts/test-mastery-gate.ts
 *
 * It registers one throwaway student (…@example.invalid).
 */
import "dotenv/config";
import { SKILLS } from "../prisma/g7-q1-questions.ts";

const B = (process.env.APP_URL || "http://localhost:3000").replace(/[/]$/, "");
const j = async (p: string, o: RequestInit = {}, tok?: string) => {
  const r = await fetch(B + p, { ...o, headers: { "content-type": "application/json", ...(tok ? { authorization: "Bearer " + tok } : {}) } });
  return { s: r.status, b: (await r.json().catch(() => ({}))) as any };
};
let pass = 0, fail = 0;
const t = (n: string, ok: boolean, d = "") => { ok ? pass++ : fail++; console.log((ok ? "  PASS  " : "  FAIL  ") + n + (ok ? "" : ` (${d})`)); };

const key = new Map<string, any>();
for (const s of SKILLS) s.items().forEach((it, i) => key.set(`qst_g7q1_${s.code}_${String(i + 1).padStart(2, "0")}`, it));
const right = (id: string) => String(key.get(id).data.correctAnswer);
const wrong = (id: string) => {
  const it = key.get(id);
  if (it.type === "MULTIPLE_CHOICE") return it.data.choices.find((c: any) => c.id !== it.data.correctAnswer).id;
  if (it.type === "TRUE_FALSE") return String(!it.data.correctAnswer);
  return String(Number(it.data.correctAnswer) + 7);
};
async function runSet(tok: string, setId: string, pick: (id: string) => string) {
  const st = await j("/api/practice/start", { method: "POST", body: JSON.stringify({ practiceSetId: setId }) }, tok);
  const sess = st.b.data;
  for (const q of sess.questions || []) {
    const qid = q.questionId || q.question?.id;
    await j(`/api/practice/${sess.id}/answer`, { method: "POST", body: JSON.stringify({ questionId: qid, answer: pick(qid), timeTakenMs: 4000 }) }, tok);
  }
  return (await j(`/api/practice/${sess.id}/complete`, { method: "POST" }, tok)).s === 200;
}

const reg = await j("/api/auth/register", { method: "POST", body: JSON.stringify({ name: "Gate Test", email: `gate-${Date.now()}@example.invalid`, password: "Gate-Pass-9xQ!pilot" }) });
const tok = reg.b.token as string;
const node = async (id: string) => ((await j("/api/student/learning-path", {}, tok)).b.data?.learningPath || []).find((n: any) => n.lessonId === id);
const complete = (id: string) => j("/api/student/progress", { method: "POST", body: JSON.stringify({ lessonId: id, action: "COMPLETE" }) }, tok);

const L1 = "lsn_g7q1_w1_l1", L2 = "lsn_g7q1_w1_l2";
t("lesson 1 is open at the start", (await node(L1))?.state === "AVAILABLE");
t("lesson 2 is locked at the start", (await node(L2))?.state === "LOCKED");

// 1. finishing the lesson without practising does not open the next one
await complete(L1);
let n2 = await node(L2);
t("completing lesson 1 alone does NOT open lesson 2", n2?.state === "LOCKED", n2?.state);
t("the lock says to practise and shows progress so far", /Practice .* first.*5 practice questions.*0 answered/.test(n2?.lockReasons?.[0] || ""), n2?.lockReasons?.[0]);
t("the lock points to the lesson that has the practice", n2?.unlockGate?.lessonId === L1, JSON.stringify(n2?.unlockGate));
const acc = await j(`/api/student/lessons/${L2}/access`, {}, tok);
t("the access check refuses lesson 2 and names the gate", acc.b.data?.allowed === false && acc.b.data?.gate?.lessonId === L1, JSON.stringify(acc.b).slice(0, 160));

// 2. practising badly (all wrong) is not enough
await runSet(tok, "ps_g7q1_w1l1_basic", wrong);
n2 = await node(L2);
t("6 wrong answers keep lesson 2 locked", n2?.state === "LOCKED", n2?.state);
t("the lock now reports the attempts so far", /6 answered, 0% correct/.test(n2?.lockReasons?.[0] || ""), n2?.lockReasons?.[0]);

// 3. practising well opens it
await runSet(tok, "ps_g7q1_w1l1_mixed", right);
await runSet(tok, "ps_g7q1_w1l1_challenge", right);
n2 = await node(L2);
t("after 18 answers at 67% (6 wrong, 12 right) lesson 2 opens", n2?.state === "AVAILABLE", `${n2?.state} ${n2?.lockReasons?.[0] || ""}`);
const acc2 = await j(`/api/student/lessons/${L2}/access`, {}, tok);
t("the access check now allows lesson 2", acc2.b.data?.allowed === true, JSON.stringify(acc2.b).slice(0, 160));

// 4. lesson 3 still needs lesson 2 first
const n3 = await node("lsn_g7q1_w1_l3");
t("lesson 3 stays locked until lesson 2 is done", n3?.state === "LOCKED", n3?.state);

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
