// Drives the real HTTP tutor with nine learning scenarios and prints what the student would see, for a person to judge.
// Needs a running server whose database has the Term 1 lessons and question bank. Creates throwaway students (@example.invalid).
//   APP_URL=http://localhost:3000 npx tsx scripts/audit-tutor-scenarios.ts
// Run it once against AI_PROVIDER=local (the built-in tutor) and once against Gemini to compare. The "engine=" line says which
// one answered, and says so when a model reply was replaced by the built-in tutor and why.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const B = (process.env.APP_URL || "http://localhost:3210").replace(/[/]$/, "");
const prisma = new PrismaClient();
const j = async (p: string, o: RequestInit = {}, tok?: string) => {
  const r = await fetch(B + p, { ...o, headers: { "content-type": "application/json", ...(tok ? { authorization: "Bearer " + tok } : {}) } });
  return { s: r.status, b: (await r.json().catch(() => ({}))) as any };
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const INTEGERISH = /integer|number line|counter|zero-?pair|absolute value|negatibo|negative|positibo|positive number/i;

async function newStudent(tag: string) {
  const r = await j("/api/auth/register", { method: "POST", body: JSON.stringify({ name: "Audit " + tag, email: `audit-${tag}-${Date.now()}@example.invalid`, password: "Audit-Pass-9xQ!pilot" }) });
  return { tok: r.b.token as string, id: r.b.user?.id as string };
}
const session = async (tok: string, setId: string) => (await j("/api/practice/start", { method: "POST", body: JSON.stringify({ practiceSetId: setId }) }, tok)).b.data;
const answer = async (tok: string, sess: any, qid: string, ans: string) =>
  (await j(`/api/practice/${sess.id}/answer`, { method: "POST", body: JSON.stringify({ questionId: qid, answer: ans, timeTakenMs: 9000 }) }, tok)).b.data;
let conv: string | undefined;
const tutor = async (tok: string, body: any) => {
  const r = await j("/api/ai/tutor", { method: "POST", body: JSON.stringify({ conversationId: conv, ...body }) }, tok);
  if (r.b.data?.conversationId) conv = r.b.data.conversationId;
  return r;
};
function judge(label: string, r: any, expectedAnswer?: string) {
  const d = r.b.data;
  const m = d?.message;
  const text = [m?.content, m?.guidingQuestion].filter(Boolean).join(" | ");
  const flags: string[] = [];
  if (expectedAnswer && new RegExp(`(^|[^0-9.])${expectedAnswer}([^0-9]|$)`).test(text)) flags.push("REVEALS-ANSWER");
  if (INTEGERISH.test(text)) flags.push("INTEGER-WORDS");
  console.log(`\n--- ${label}\n  engine=${d?.providerInfo?.provider}/${d?.providerInfo?.model || ""} type=${m?.messageType} hint=${m?.hintLevel} issue=${m?.detectedIssue} action=${m?.suggestedAction} ${flags.join(" ")} ${r.s !== 200 ? "HTTP " + r.s + " " + JSON.stringify(r.b).slice(0, 100) : ""}\n  TUTOR: ${text.replace(/\s+/g, " ").slice(0, 520)}`);
}
async function evidence(studentId: string, skillId: string, label: string) {
  await sleep(10000);
  const a = await prisma.mistakeAnalysis.findFirst({ where: { studentId, skillId }, orderBy: { createdAt: "desc" } });
  const ms = await prisma.skillMastery.findUnique({ where: { studentId_skillId: { studentId, skillId } } });
  const ar = await prisma.adaptiveRecommendation.findFirst({ where: { studentId, skillId }, orderBy: { createdAt: "desc" } });
  console.log(`  [${label}] analysis: ${a ? `${a.category} conf=${a.confidence} | obs="${(a.observation || "").slice(0, 120)}" | cause="${(a.possibleCause || "").slice(0, 90)}"` : "none"}`);
  console.log(`  [${label}] mastery: ${ms ? `${ms.status} attempts=${ms.attemptCount} acc=${ms.accuracy}` : "none"}   adaptive: ${ar ? `${ar.decisionType} -> ${ar.recommendedActivityType} ${ar.recommendedActivityId || ""}` : "none"}`);
}

{ // S1
  conv = undefined; const { tok } = await newStudent("s1");
  const sess = await session(tok, "ps_g7q1_w4l1_basic");
  await answer(tok, sess, "qst_g7q1_w4l1_02", "30");
  console.log("\n===== S1 correct answer (30), flawed reasoning");
  judge("S1", await tutor(tok, { lessonId: "lsn_g7q1_w4_l1", questionId: "qst_g7q1_w4l1_02", practiceSessionId: sess.id, studentAnswer: "30", studentQuery: "Tama ang 30 kasi 15 ang pagtaas tapos dinoble ko lang po. Tama ba ang paraan ko?", helpLevel: "GUIDING_QUESTION" }));
}
{ // S2
  conv = undefined; const { tok, id } = await newStudent("s2");
  const sess = await session(tok, "ps_g7q1_w3l3_mixed");
  await answer(tok, sess, "qst_g7q1_w3l3_08", "110");
  console.log("\n===== S2 wrong (110), sound method + addition slip");
  judge("S2", await tutor(tok, { lessonId: "lsn_g7q1_w3_l3", questionId: "qst_g7q1_w3l3_08", practiceSessionId: sess.id, studentAnswer: "110", studentQuery: "Ang sum ng pentagon ay (5-2)x180 = 540. Ang apat na anggulo ay 100+110+120+90 = 430, kaya 540 - 430 = 110. Bakit mali?", helpLevel: "LEVEL_1_HINT" }), "120");
  await j(`/api/practice/${sess.id}/complete`, { method: "POST" }, tok);
  await evidence(id, "skl_g7q1_w3l3", "S2");
}
{ // S3
  conv = undefined; const { tok } = await newStudent("s3");
  const sess = await session(tok, "ps_g7q1_w3l3_basic");
  console.log("\n===== S3 incomplete answer");
  judge("S3", await tutor(tok, { lessonId: "lsn_g7q1_w3_l3", questionId: "qst_g7q1_w3l3_01", practiceSessionId: sess.id, studentAnswer: "", studentQuery: "yung formula po ay n minus ... tapos times 180? nakalimutan ko po", helpLevel: "LEVEL_1_HINT" }), "540");
}
{ // S4
  conv = undefined; const { tok } = await newStudent("s4");
  const sess = await session(tok, "ps_g7q1_w1l2_mixed");
  console.log("\n===== S4 ambiguous");
  judge("S4", await tutor(tok, { lessonId: "lsn_g7q1_w1_l2", questionId: "qst_g7q1_w1l2_08", practiceSessionId: sess.id, studentQuery: "baka yung pangalawa po? hindi ako sure", helpLevel: "GUIDING_QUESTION" }), "regular pentagon");
}
{ // S5 + S6
  conv = undefined; const { tok, id } = await newStudent("s5");
  console.log("\n===== S5 repeated error: 80 -> 100, answers 20 three times");
  let last: any;
  for (let k = 1; k <= 3; k++) {
    last = await session(tok, "ps_g7q1_w4l1_basic");
    await answer(tok, last, "qst_g7q1_w4l1_01", "20");
    judge(`S5 attempt ${k}`, await tutor(tok, { lessonId: "lsn_g7q1_w4_l1", questionId: "qst_g7q1_w4l1_01", practiceSessionId: last.id, studentAnswer: "20", studentQuery: k === 1 ? "mali po ba ang 20?" : "20 pa rin po ang nakuha ko", helpLevel: k === 1 ? "LEVEL_1_HINT" : "LEVEL_2_HINT" }), "25");
    if (k < 3) await j(`/api/practice/${last.id}/complete`, { method: "POST" }, tok);
  }
  console.log("\n===== S6 correction after hint");
  const fixed = await session(tok, "ps_g7q1_w4l1_basic");
  await answer(tok, fixed, "qst_g7q1_w4l1_01", "25");
  judge("S6", await tutor(tok, { lessonId: "lsn_g7q1_w4_l1", questionId: "qst_g7q1_w4l1_01", practiceSessionId: fixed.id, studentAnswer: "25", studentQuery: "Nakuha ko na! 100 - 80 = 20, tapos 20 / 80 = 0.25 kaya 25%", helpLevel: "LEVEL_1_HINT" }));
  await j(`/api/practice/${fixed.id}/complete`, { method: "POST" }, tok);
  await evidence(id, "skl_g7q1_w4l1", "S5/S6");
}
{ // S7 checkpoint inside the lesson (the server must know the question and the student's answer)
  conv = undefined; const { tok, id } = await newStudent("s7");
  const block: any = await prisma.lessonContentBlock.findFirst({ where: { lessonId: "lsn_g7q1_w1_l1", type: "CHECKPOINT" }, orderBy: { sequenceOrder: "asc" } });
  const meta = JSON.parse(block.metadata);
  const wrong = (meta.options as string[]).find((o) => o !== meta.correctAnswer)!;
  await j("/api/student/lessons/lsn_g7q1_w1_l1/checkpoint", { method: "POST", body: JSON.stringify({ blockId: block.id, answer: wrong }) }, tok);
  console.log(`\n===== S7 checkpoint help. Question: "${meta.question}" student chose: "${wrong}"`);
  judge("S7 (blockId only; the page sends no answer text)", await tutor(tok, { lessonId: "lsn_g7q1_w1_l1", blockId: block.id, studentQuery: "bakit po mali ang sagot ko?", helpLevel: "LEVEL_1_HINT" }), meta.correctAnswer.split(" ")[0]);
}
{ // S8 no lesson, no question
  conv = undefined; const { tok } = await newStudent("s8");
  console.log("\n===== S8 no lesson and no question open");
  judge("S8", await tutor(tok, { studentQuery: "tulungan mo ako sa lesson ko", helpLevel: "LEVEL_1_HINT" }));
}
{ // S9 conflicting topic
  conv = undefined; const { tok } = await newStudent("s9");
  console.log("\n===== S9 percent lesson open, student asks about polygon angles");
  judge("S9", await tutor(tok, { lessonId: "lsn_g7q1_w4_l1", skillId: "skl_g7q1_w4l1", studentQuery: "Ano po ang sum ng interior angles ng pentagon?", helpLevel: "LEVEL_1_HINT" }), "540");
}
await prisma.$disconnect();
