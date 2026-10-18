/**
 * Checks the misconception catalog and the pure detection logic. No server, no database, no AI model.
 *   npx tsx scripts/test-misconception-model.ts
 *
 * The catalog is DRAFT content written from the question bank; these tests show that it behaves as designed
 * (an idea explains an answer only when it predicts exactly that answer, rivals are kept, follow-up questions tell
 * ideas apart). They do not show that the ideas are the right ones: that needs a teacher (docs/TUTOR_EDUCATOR_REVIEW.md).
 */
import { SKILLS } from "../prisma/g7-q1-questions.ts";
import { MISCONCEPTIONS } from "../src/lib/ai/misconceptions/catalog.ts";
import {
  alternativesFor,
  classifyFollowUpAnswer,
  confidenceFor,
  explainAttempts,
  explains,
  numberOf,
  sameNumber,
  selectFollowUp,
  type PoolQuestion,
  type WrongAttempt,
} from "../src/lib/ai/misconceptions/detector.ts";

let pass = 0, fail = 0;
const t = (name: string, ok: boolean, detail = "") => {
  ok ? pass++ : fail++;
  console.log((ok ? "  PASS  " : "  FAIL  ") + name + (ok ? "" : `  (${detail})`));
};

// the real bank, as the app stores it
const bank = new Map<string, PoolQuestion & { skill: string; type: string }>();
for (const s of SKILLS) {
  (s.items() as any[]).forEach((it, i) => {
    const id = `qst_g7q1_${s.code}_${String(i + 1).padStart(2, "0")}`;
    const expected = it.type === "MULTIPLE_CHOICE" ? it.data.choices.find((c: any) => c.id === it.data.correctAnswer)?.text : String(it.data.correctAnswer);
    bank.set(id, { id, prompt: it.prompt, expected, difficulty: i < 6 ? "EASY" : i < 12 ? "MEDIUM" : "HARD", skill: s.code, type: it.type });
  });
}
const q = (id: string) => bank.get(id)!;
const wrong = (id: string, answer: string): WrongAttempt => ({ attemptId: "a_" + id + "_" + answer, questionId: id, prompt: q(id).prompt, answer, expected: q(id).expected });

console.log("\n1. The catalog itself");
{
  t("every entry has a unique id and both languages", new Set(MISCONCEPTIONS.map((m) => m.id)).size === MISCONCEPTIONS.length && MISCONCEPTIONS.every((m) => m.name.en && m.name.fil && m.correction.en && m.correction.fil && m.belief));
  const covered = new Map<string, number>();
  const coincidences: string[] = [];
  for (const [id, item] of bank) {
    if (item.type !== "NUMERIC_INPUT") continue;
    for (const e of MISCONCEPTIONS) {
      if (!e.skills.includes(item.skill)) continue;
      const p = e.predict(item.prompt);
      if (p === null) continue;
      covered.set(e.id, (covered.get(e.id) || 0) + 1);
      if (sameNumber(p, numberOf(item.expected)!)) coincidences.push(`${e.id} on ${id}`);
    }
  }
  t("every entry applies to at least one bank question", MISCONCEPTIONS.every((m) => (covered.get(m.id) || 0) >= 1), MISCONCEPTIONS.filter((m) => !covered.get(m.id)).map((m) => m.id).join(", "));
  t("an idea that would give the RIGHT answer is never reported as an explanation of a wrong one", coincidences.every((c) => {
    const [eid, , qid] = c.split(" ");
    const e = MISCONCEPTIONS.find((m) => m.id === eid)!;
    return explains(e, q(qid).prompt, String(e.predict(q(qid).prompt)), q(qid).expected) === null;
  }), coincidences.join("; "));
  t("coincidences are rare (a prediction equal to the right answer)", coincidences.length <= 4, String(coincidences.length));
}

console.log("\n2. Which ideas explain a wrong answer");
{
  const a1 = wrong("qst_g7q1_w4l1_01", "20"); // 80 -> 100, answered 20
  const h1 = explainAttempts([a1], "w4l1");
  const ids1 = h1.map((h) => h.entry.id);
  t("80 to 100 answered 20 is explained by BOTH 'reports the amount' and 'divides by the new value'", ids1.includes("pct.change.reports-amount") && ids1.includes("pct.change.divides-by-new"), ids1.join(", "));
  t("one wrong answer cannot rank the two apart", h1.length >= 2 && h1[0].distinctQuestions === 1 && h1[1].distinctQuestions === 1);

  const a2 = wrong("qst_g7q1_w4l1_02", "15"); // 50 -> 65, answered 15 (the increase)
  const h2 = explainAttempts([a1, a2], "w4l1");
  t("a second question separates them: only 'reports the amount' explains both answers", h2[0].entry.id === "pct.change.reports-amount" && h2[0].distinctQuestions === 2 && !h2.find((h) => h.entry.id === "pct.change.divides-by-new" && h.distinctQuestions === 2), h2.map((h) => h.entry.id + ":" + h.distinctQuestions).join(", "));

  t("a different wrong answer is not explained by an idea that predicts something else", !explainAttempts([wrong("qst_g7q1_w4l1_01", "37")], "w4l1").some((h) => h.entry.id === "pct.change.reports-amount"));
  t("a non-numeric answer is never matched", explainAttempts([wrong("qst_g7q1_w4l1_01", "twenty")], "w4l1").length === 0);
  t("ideas from another skill are ignored", explainAttempts([a1], "w6l2").length === 0);

  const sum = explainAttempts([wrong("qst_g7q1_w3l3_01", "900"), wrong("qst_g7q1_w3l3_02", "1080")], "w3l3"); // 5 sides -> 900 = 5x180, 6 sides -> 1080 = 6x180
  t("answering n x 180 twice is explained by 'uses n x 180' on two questions", sum[0]?.entry.id === "poly.sum.n-times-180" && sum[0].distinctQuestions === 2, sum.map((h) => h.entry.id).join(","));

  const adj = explainAttempts([wrong("qst_g7q1_w3l2_06", "90")], "w3l2"); // exterior 90 -> interior 90 is CORRECT
  t("90 degrees for a 90 degree exterior angle is right, so 'assumes equal' is not reported", !adj.some((h) => h.entry.id === "angle.adjacent-int-ext.assumes-equal"));
  const adj2 = explainAttempts([wrong("qst_g7q1_w3l2_01", "100")], "w3l2"); // exterior 100 -> interior 80, answered 100
  t("100 for a 100 degree exterior angle is explained by 'assumes equal'", adj2.some((h) => h.entry.id === "angle.adjacent-int-ext.assumes-equal"));
}

console.log("\n3. Alternatives and confidence");
{
  const a1 = wrong("qst_g7q1_w4l1_01", "20");
  const hs = explainAttempts([a1], "w4l1");
  const primary = hs.find((h) => h.entry.id === "pct.change.reports-amount")!;
  const alts = alternativesFor(primary, hs, [a1]);
  t("the rival idea is listed as an alternative", alts.some((a) => a.id === "pct.change.divides-by-new" && a.kind === "catalog"));
  t("a slip, a misread and a guess are always listed", ["generic.calculation-slip", "generic.misread", "generic.guess"].every((id) => alts.some((a) => a.id === id)));
  const lone = confidenceFor({ distinctQuestions: 1, rivals: 0 });
  t("one question gives low confidence (never above 0.5)", lone <= 0.5, String(lone));
  t("more questions raise it", confidenceFor({ distinctQuestions: 2, rivals: 0 }) > lone && confidenceFor({ distinctQuestions: 3, rivals: 0 }) > confidenceFor({ distinctQuestions: 2, rivals: 0 }));
  t("rival ideas lower it", confidenceFor({ distinctQuestions: 2, rivals: 2 }) < confidenceFor({ distinctQuestions: 2, rivals: 0 }));
  t("the student's own matching follow-up answer raises it, and it is capped at 0.85", confidenceFor({ distinctQuestions: 3, rivals: 0, supportedByFollowUp: true }) === 0.85 && confidenceFor({ distinctQuestions: 1, rivals: 0, supportedByFollowUp: true }) > lone);
  t("a contradicting follow-up answer lowers it", confidenceFor({ distinctQuestions: 2, rivals: 0, contradictedByFollowUp: true }) < confidenceFor({ distinctQuestions: 2, rivals: 0 }));
}

console.log("\n4. The follow-up question tells the ideas apart");
{
  const a1 = wrong("qst_g7q1_w4l1_01", "20");
  const hs = explainAttempts([a1], "w4l1");
  const reports = hs.find((h) => h.entry.id === "pct.change.reports-amount")!.entry;
  const divides = hs.find((h) => h.entry.id === "pct.change.divides-by-new")!.entry;
  const pool = [...bank.values()].filter((x) => x.skill === "w4l1" && x.type === "NUMERIC_INPUT");
  const pick = selectFollowUp(reports, [divides], pool, [a1.questionId]);
  t("a follow-up question is found", !!pick, "none");
  if (pick) {
    const rp = divides.predict(pick.question.prompt);
    t("the suspected idea predicts a WRONG answer on it", !sameNumber(pick.predicted, numberOf(pick.question.expected)!), `${pick.predicted} vs ${pick.question.expected}`);
    t("the rival idea would answer differently, so the student's answer separates them", rp === null || !sameNumber(rp, pick.predicted), `${rp} vs ${pick.predicted}`);
    t("it is not a question the student already answered", pick.question.id !== a1.questionId);
    t("the easiest suitable question is chosen first", pick.question.difficulty === "EASY" || pool.filter((x) => x.difficulty === "EASY").every((x) => x.id === pick.question.id || !selectFollowUp(reports, [divides], [x], [a1.questionId])));
    t("answering the predicted wrong answer supports the idea", classifyFollowUpAnswer(pick.question, pick.predicted, String(pick.predicted)) === "PREDICTED_ERROR");
    t("answering correctly is reported as correct", classifyFollowUpAnswer(pick.question, pick.predicted, pick.question.expected) === "CORRECT");
    t("any other number is 'other error'", classifyFollowUpAnswer(pick.question, pick.predicted, "123456") === "OTHER_ERROR");
    t("a non-number is reported as such", classifyFollowUpAnswer(pick.question, pick.predicted, "I don't know") === "NOT_A_NUMBER");
  }
  t("with every question excluded there is no follow-up", selectFollowUp(reports, [divides], pool, pool.map((x) => x.id)) === null);

  // 80->100 and 20: when the rival would give the SAME wrong answer, that question is not chosen
  const same = pool.find((x) => sameNumber(reports.predict(x.prompt) ?? NaN, divides.predict(x.prompt) ?? -1));
  const chosenAmongAll = selectFollowUp(reports, [divides], pool, [a1.questionId]);
  t("a question on which the two ideas agree is never chosen as the follow-up", !same || chosenAmongAll?.question.id !== same.id, same?.id);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
