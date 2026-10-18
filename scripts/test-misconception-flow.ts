// End-to-end check of the misconception flow through the real HTTP server and database.
// Needs a running server (AI_PROVIDER=local is enough) on a database with the Term 1 lessons and question bank.
// Creates throwaway users (@example.invalid), so use a review/test database.
//   APP_URL=http://localhost:3210 DATABASE_URL=<same database> npx tsx scripts/test-misconception-flow.ts
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { MISCONCEPTION_BY_ID } from "../src/lib/ai/misconceptions/catalog.ts";

const B = (process.env.APP_URL || "http://localhost:3210").replace(/[/]$/, "");
const prisma = new PrismaClient();
const j = async (p: string, o: RequestInit = {}, tok?: string) => {
  const r = await fetch(B + p, { ...o, headers: { "content-type": "application/json", ...(tok ? { authorization: "Bearer " + tok } : {}) } });
  return { s: r.status, b: (await r.json().catch(() => ({}))) as any };
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const t = (name: string, ok: boolean, detail = "") => {
  ok ? pass++ : fail++;
  console.log((ok ? "  PASS  " : "  FAIL  ") + name + (ok ? "" : `  (${detail})`));
};

const SKILL = "skl_g7q1_w4l1";
const LESSON = "lsn_g7q1_w4_l1";
const SET = "ps_g7q1_w4l1_basic";
const PW = "Audit-Pass-9xQ!pilot";

async function newStudent(tag: string) {
  const email = `mis-${tag}-${Date.now()}@example.invalid`;
  const r = await j("/api/auth/register", { method: "POST", body: JSON.stringify({ name: "Mis " + tag, email, password: PW }) });
  return { tok: r.b.token as string, id: r.b.user?.id as string, email };
}
const startSession = async (tok: string) => (await j("/api/practice/start", { method: "POST", body: JSON.stringify({ practiceSetId: SET }) }, tok)).b.data;
const practiceAnswer = async (tok: string, sess: any, qid: string, ans: string) =>
  (await j(`/api/practice/${sess.id}/answer`, { method: "POST", body: JSON.stringify({ questionId: qid, answer: ans, timeTakenMs: 9000 }) }, tok)).b.data;
const rows = (studentId: string) => prisma.studentMisconception.findMany({ where: { studentId, skillId: SKILL }, orderBy: { createdAt: "asc" } });
const correctOf = async (qid: string) => String(JSON.parse((await prisma.question.findUniqueOrThrow({ where: { id: qid } })).questionData).correctAnswer);
const askTutor = (tok: string, sess: any, qid: string, ans: string, query = "I do not get this one.") =>
  j("/api/ai/tutor", { method: "POST", body: JSON.stringify({ lessonId: LESSON, skillId: SKILL, questionId: qid, practiceSessionId: sess.id, studentAnswer: ans, studentQuery: query, helpLevel: "LEVEL_1_HINT" }) }, tok);
const answerFollow = (tok: string, id: string, answer: string) => j(`/api/student/misconceptions/${id}/answer`, { method: "POST", body: JSON.stringify({ answer }) }, tok);

// 80 -> 100 answered 20: the amount of change (20) is also 20/100 of the new value, so two ideas fit.
const Q1 = "qst_g7q1_w4l1_01";

console.log("\n1. A wrong answer becomes suspicions with evidence, not a diagnosis");
const A = await newStudent("a");
const sessA = await startSession(A.tok);
const r1 = await practiceAnswer(A.tok, sessA, Q1, "20");
t("the wrong answer is graded wrong", r1?.isCorrect === false, JSON.stringify(r1)?.slice(0, 120));
await sleep(1500);
let rowsA = await rows(A.id);
t("two ideas are suspected (they predict the same wrong answer)", rowsA.length === 2 && ["pct.change.reports-amount", "pct.change.divides-by-new"].every((k) => rowsA.some((r) => r.conceptKey === k)), rowsA.map((r) => r.conceptKey).join(","));
t("status is SUSPECTED and confidence is low for one question", rowsA.every((r) => r.status === "SUSPECTED" && r.confidence <= 0.5), rowsA.map((r) => r.status + r.confidence).join(","));
const attemptA = await prisma.questionAttempt.findFirst({ where: { studentId: A.id, questionId: Q1 } });
t("each row links the attempt that was observed", rowsA.every((r) => JSON.parse(r.evidenceAttemptIds).includes(attemptA?.id)));
t("each row lists the other idea and the generic alternatives", rowsA.every((r) => {
  const alts = JSON.parse(r.alternatives);
  const other = r.conceptKey === "pct.change.reports-amount" ? "pct.change.divides-by-new" : "pct.change.reports-amount";
  return alts.some((a: any) => a.id === other) && alts.some((a: any) => a.id === "generic.calculation-slip") && alts.some((a: any) => a.id === "generic.guess");
}));
t("the observation is a plain fact that does not state the answer key", !/\b25\b/.test(rowsA[0].observation) && /20/.test(rowsA[0].observation), rowsA[0].observation);

console.log("\n2. A right answer or a non-numeric question creates nothing");
const Bst = await newStudent("b");
const sessB = await startSession(Bst.tok);
await practiceAnswer(Bst.tok, sessB, Q1, "25");
await practiceAnswer(Bst.tok, sessB, "qst_g7q1_w4l1_03", "false"); // true/false, answered wrongly
await sleep(1200);
t("no suspicion from a right answer or a true/false miss", (await rows(Bst.id)).length === 0);

console.log("\n3. The tutor asks a follow-up question that tells the ideas apart");
const tut = await askTutor(A.tok, sessA, Q1, "20");
const fu = tut.b.data?.followUp;
t("the tutor reply carries a DIAGNOSTIC follow-up", fu?.kind === "DIAGNOSTIC" && !!fu.prompt && !!fu.misconceptionId, JSON.stringify(tut.b.data?.followUp));
t("the follow-up is a different question from the one the student missed", fu?.questionId && fu.questionId !== Q1);
t("the tutor message itself does not give the answer (25)", !/(^|[^0-9.])25([^0-9]|$)/.test(String(tut.b.data?.message?.content) + String(tut.b.data?.message?.guidingQuestion)), tut.b.data?.message?.content);
const checkingRow = await prisma.studentMisconception.findUnique({ where: { id: fu.misconceptionId } });
t("that row is now CHECKING with the question stored", checkingRow?.status === "CHECKING" && checkingRow.diagnosticQuestionId === fu.questionId);
const tut2 = await askTutor(A.tok, sessA, Q1, "20", "Can you help again?");
t("asking again re-offers the same question instead of a new one", tut2.b.data?.followUp?.questionId === fu.questionId);

const pend = await j(`/api/student/misconceptions/pending?skillId=${SKILL}`, {}, A.tok);
t("the waiting question can be loaded on its own (after a reload)", pend.s === 200 && pend.b.data?.followUp?.questionId === fu.questionId, JSON.stringify(pend.b).slice(0, 120));
t("the pending question needs a sign-in and a skill", (await j(`/api/student/misconceptions/pending?skillId=${SKILL}`)).s === 401 && (await j("/api/student/misconceptions/pending", {}, A.tok)).s === 400);
t("another student has none waiting", (await j(`/api/student/misconceptions/pending?skillId=${SKILL}`, {}, (await newStudent("nopending")).tok)).b.data?.followUp === null);

console.log("\n4. The student's own answer decides");
const entry = MISCONCEPTION_BY_ID.get(checkingRow!.conceptKey)!;
const fq = await prisma.question.findUniqueOrThrow({ where: { id: fu.questionId } });
const predicted = entry.predict(fq.prompt)!;
const attemptsBefore = await prisma.questionAttempt.count({ where: { studentId: A.id } });
const masteryBefore = await prisma.skillMastery.findUnique({ where: { studentId_skillId: { studentId: A.id, skillId: SKILL } } });
const stranger = await newStudent("stranger");
t("another student cannot answer this student's follow-up", (await answerFollow(stranger.tok, fu.misconceptionId, "15")).s === 400);
t("an answer that is not a number is not recorded", (await answerFollow(A.tok, fu.misconceptionId, "I don't know")).b.data?.outcome === "NOT_A_NUMBER" && (await prisma.studentMisconception.findUnique({ where: { id: fu.misconceptionId } }))?.status === "CHECKING");
const conf0 = checkingRow!.confidence;
const ans1 = await answerFollow(A.tok, fu.misconceptionId, String(predicted));
t("the predicted wrong answer supports the idea", ans1.b.data?.outcome === "PREDICTED_ERROR" && ans1.b.data?.status === "CORRECTING", JSON.stringify(ans1.b));
const supp = await prisma.studentMisconception.findUnique({ where: { id: fu.misconceptionId } });
t("confidence rose because of the student's own answer", supp!.confidence > conf0, `${conf0} -> ${supp?.confidence}`);
t("the check is stored with the question, the answer and the outcome", JSON.parse(supp!.checks).some((c: any) => c.kind === "DIAGNOSTIC" && c.outcome === "PREDICTED_ERROR" && c.questionId === fu.questionId));
const next = ans1.b.data?.next;
t("a correction and a verification question follow at once", next?.kind === "VERIFICATION" && !!next.correction && next.correction.length > 20 && next.questionId !== fu.questionId, JSON.stringify(next)?.slice(0, 160));
t("the reply to the student never contains the correct answer", !new RegExp(`(^|[^0-9.])${await correctOf(fu.questionId)}([^0-9]|$)`).test(String(ans1.b.data?.message)), ans1.b.data?.message);
t("a follow-up answer is not a practice attempt and mastery is unchanged", (await prisma.questionAttempt.count({ where: { studentId: A.id } })) === attemptsBefore && JSON.stringify(await prisma.skillMastery.findUnique({ where: { studentId_skillId: { studentId: A.id, skillId: SKILL } } })) === JSON.stringify(masteryBefore));

console.log("\n5. Verification closes the loop");
const ver = await answerFollow(A.tok, fu.misconceptionId, await correctOf(next.questionId));
t("a correct verification answer resolves it", ver.b.data?.outcome === "CORRECT" && ver.b.data?.status === "RESOLVED", JSON.stringify(ver.b));
const resolved = await prisma.studentMisconception.findUnique({ where: { id: fu.misconceptionId } });
t("resolvedAt is set", !!resolved?.resolvedAt);

console.log("\n6. A resolved idea that shows up again becomes PERSISTING");
const cqs = ["qst_g7q1_w4l1_02", "qst_g7q1_w4l1_06", "qst_g7q1_w4l1_07", "qst_g7q1_w4l1_09"];
// find a bank question where the resolved idea predicts a wrong answer the student has not tried yet
let again: { q: string; v: number } | null = null;
for (const q of ["qst_g7q1_w4l1_06", "qst_g7q1_w4l1_09", "qst_g7q1_w4l1_07", "qst_g7q1_w4l1_14", "qst_g7q1_w4l1_18"]) {
  const used = new Set(JSON.parse(resolved!.checks).map((c: any) => c.questionId));
  const prompt = (await prisma.question.findUnique({ where: { id: q } }))?.prompt || "";
  const v = entry.predict(prompt);
  if (v !== null && !used.has(q) && q !== Q1) { again = { q, v }; break; }
}
void cqs;
if (again) {
  await practiceAnswer(A.tok, sessA, again.q, String(again.v));
  await sleep(1500);
  const after = await prisma.studentMisconception.findUnique({ where: { id: fu.misconceptionId } });
  t("the same idea explaining a new wrong answer reopens it as PERSISTING", after?.status === "PERSISTING", `${after?.status}`);
} else t("the same idea explaining a new wrong answer reopens it as PERSISTING", false, "no test question found");

console.log("\n7. The follow-up answer can also rule an idea out");
const C = await newStudent("c");
const sessC = await startSession(C.tok);
await practiceAnswer(C.tok, sessC, Q1, "20");
await sleep(1500);
const tutC = await askTutor(C.tok, sessC, Q1, "20");
const fuC = tutC.b.data?.followUp;
const rowC0 = await prisma.studentMisconception.findUnique({ where: { id: fuC.misconceptionId } });
const rightC = await answerFollow(C.tok, fuC.misconceptionId, await correctOf(fuC.questionId));
const rowC1 = await prisma.studentMisconception.findUnique({ where: { id: fuC.misconceptionId } });
t("answering the check correctly marks the idea NOT_SUPPORTED and lowers confidence", rightC.b.data?.outcome === "CORRECT" && rowC1?.status === "NOT_SUPPORTED" && rowC1.confidence < rowC0!.confidence, `${rowC0?.confidence} -> ${rowC1?.confidence} ${rowC1?.status}`);
t("a ruled-out idea is not offered again", rightC.b.data?.next === null || rightC.b.data?.next?.misconceptionId !== fuC.misconceptionId);

console.log("\n8. Repeating the same wrong idea after the correction is PERSISTING, not resolved");
const D = await newStudent("d");
const sessD = await startSession(D.tok);
await practiceAnswer(D.tok, sessD, Q1, "20");
await sleep(1500);
const tutD = await askTutor(D.tok, sessD, Q1, "20");
const fuD = tutD.b.data?.followUp;
const rowD = await prisma.studentMisconception.findUnique({ where: { id: fuD.misconceptionId } });
const entD = MISCONCEPTION_BY_ID.get(rowD!.conceptKey)!;
const dq = await prisma.question.findUniqueOrThrow({ where: { id: fuD.questionId } });
const dNext = (await answerFollow(D.tok, fuD.misconceptionId, String(entD.predict(dq.prompt)))).b.data?.next;
const vq = await prisma.question.findUniqueOrThrow({ where: { id: dNext.questionId } });
const dVer = await answerFollow(D.tok, fuD.misconceptionId, String(entD.predict(vq.prompt)));
t("the same wrong idea on the verification question is PERSISTING", dVer.b.data?.outcome === "PREDICTED_ERROR" && dVer.b.data?.status === "PERSISTING", JSON.stringify(dVer.b));

console.log("\n9. Teacher view and decisions");
const adminEmail = `mis-admin-${Date.now()}@example.invalid`;
const reg = await j("/api/auth/register", { method: "POST", body: JSON.stringify({ name: "Mis Admin", email: adminEmail, password: PW }) });
await prisma.user.update({ where: { id: reg.b.user.id }, data: { role: "ADMIN" } });
const login = await j("/api/auth/login", { method: "POST", body: JSON.stringify({ email: adminEmail, password: PW }) });
const adminTok = login.b.token as string;
t("a student cannot read the teacher list", (await j(`/api/teacher/students/${A.id}/misconceptions`, {}, A.tok)).s === 403);
const list = await j(`/api/teacher/students/${A.id}/misconceptions`, {}, adminTok);
const mine = (list.b.data || []).find((r: any) => r.id === fu.misconceptionId);
t("the teacher sees status, evidence, alternatives, checks and the draft notice", list.s === 200 && mine && mine.checks.length >= 2 && mine.alternatives.length >= 3 && mine.observedAnswers.length >= 1 && mine.reviewedDraft === true, JSON.stringify(list.b).slice(0, 160));
t("the teacher list does not carry correction text meant for students or answer keys", !JSON.stringify(list.b).includes("\"correction\""));
const other = (list.b.data || []).find((r: any) => r.id !== fu.misconceptionId);
const dismiss = await j(`/api/teacher/students/${A.id}/misconceptions/${other.id}`, { method: "PATCH", body: JSON.stringify({ status: "DISMISSED", teacherNote: "Looks like a slip." }) }, adminTok);
t("a teacher can dismiss one with a note", dismiss.s === 200 && dismiss.b.data?.status === "DISMISSED" && dismiss.b.data?.teacherNote === "Looks like a slip.", JSON.stringify(dismiss.b));
t("a student cannot change a teacher decision", (await j(`/api/teacher/students/${A.id}/misconceptions/${other.id}`, { method: "PATCH", body: JSON.stringify({ status: "SUPPORTED" }) }, A.tok)).s === 403);
t("an invalid status is refused", (await j(`/api/teacher/students/${A.id}/misconceptions/${other.id}`, { method: "PATCH", body: JSON.stringify({ status: "RESOLVED" }) }, adminTok)).s === 400);
await practiceAnswer(A.tok, sessA, "qst_g7q1_w4l1_06", "5");
await sleep(1200);
t("a dismissed idea stays dismissed after new wrong answers", (await prisma.studentMisconception.findUnique({ where: { id: other.id } }))?.status === "DISMISSED");

console.log(`\n${pass} passed, ${fail} failed`);
await prisma.$disconnect();
process.exitCode = fail ? 1 : 0;
