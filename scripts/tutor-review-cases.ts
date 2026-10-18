// Draft cases for teachers to review. EVERYTHING in this file is AI-written and has NOT been reviewed by a teacher.
// The draft fields (draftIdeas, draftObservation, draftBehaviour) are what the author expects; a teacher accepts,
// changes or removes each case by its id (see docs/TUTOR_EDUCATOR_REVIEW.md). Questions come from the real question bank.
//
// A case: one student, one bank question (skill code + position in that skill's list, starting at 1), the answers they gave
// in order, and optionally what they typed to the tutor.

export interface ReviewCase {
  id: string;
  group: string;
  skill: string;
  /** Position of the question in the skill's list (1-based). 0 = no question is open. */
  q: number;
  /** Each answer is for the case's question unless it names another one (q = position in the same skill's list). */
  attempts: Array<{ answer: string; q?: number }>;
  /** What the student typed to the tutor about their work, if anything. */
  message?: string;
  /** Catalog idea ids the author expects to explain the wrong answers (empty = none). */
  draftIdeas: string[];
  /** What the system may state as a fact. */
  draftObservation: string;
  /** What the tutor should and should not do next. */
  draftBehaviour: string;
  /** For cases about the situation rather than about an idea. */
  topicConflictMessage?: string;
}

const SAY_NOTHING_ABOUT_BELIEF = "Do not say the student believes or has this idea; it is only a suspicion until their own follow-up answer supports it.";

/** One case per catalog idea: the student gives exactly the answer that idea predicts. */
const idea = (n: number, ideaId: string, skill: string, q: number, answer: string, expected: string, also: string[] = []): ReviewCase => ({
  id: `RC-${String(n).padStart(2, "0")}`,
  group: "One case per idea in the catalog",
  skill,
  q,
  attempts: [{ answer }],
  draftIdeas: [ideaId, ...also],
  draftObservation: `The student answered ${answer}; the correct answer is ${expected}. That is exactly what the idea "${ideaId}" would give.`,
  draftBehaviour: `Ask the student to show the steps. Do not state ${expected}. ${SAY_NOTHING_ABOUT_BELIEF}${also.length ? " Another idea gives the same answer, so a follow-up question must tell them apart." : ""}`,
});

export const REVIEW_CASES: ReviewCase[] = [
  idea(1, "poly.sum.n-times-180", "w1l2", 7, "900", "540"),
  idea(2, "poly.sum.n-minus-1", "w1l2", 7, "720", "540"),
  idea(3, "poly.sum.exterior-total", "w1l2", 7, "360", "540"),
  idea(4, "poly.sides.from-sum-divide-only", "w3l3", 14, "7", "9"),
  idea(5, "poly.regular.interior-is-360-over-n", "w1l2", 4, "45", "135"),
  idea(6, "poly.regular.exterior-gives-interior", "w3l4", 1, "135", "45"),
  idea(7, "poly.regular.sides-from-interior-360", "w3l4", 9, "2.4", "12"),
  idea(8, "angle.adjacent-int-ext.assumes-equal", "w3l2", 1, "100", "80"),
  idea(9, "poly.missing.uses-360", "w3l3", 8, "60", "120"),
  idea(10, "angle.complement.uses-180", "w2l2", 1, "150", "60"),
  idea(11, "angle.supplement.uses-90", "w2l2", 8, "7", "97"),
  idea(12, "angle.vertical.uses-supplement", "w2l2", 9, "116", "64"),
  idea(13, "angle.triangle.third.uses-360", "w1l3", 4, "260", "80"),
  idea(14, "pct.change.reports-amount", "w4l1", 1, "20", "25", ["pct.change.divides-by-new"]),
  idea(15, "pct.change.divides-by-new", "w4l1", 1, "20", "25", ["pct.change.reports-amount"]),
  idea(16, "pct.change.forgets-times-100", "w4l1", 1, "0.25", "25"),
  idea(17, "pct.newprice.adds-percent-as-amount", "w4l1", 4, "370", "420"),
  idea(18, "pct.newprice.gives-only-change", "w4l1", 4, "70", "420"),
  idea(19, "pct.newprice.wrong-direction", "w4l1", 4, "280", "420"),
  idea(20, "pct.discount.gives-sale-price", "w4l3", 1, "420", "180"),
  idea(21, "pct.sale.gives-discount", "w4l3", 2, "200", "600"),
  idea(22, "pct.original.adds-discount", "w4l3", 13, "864", "900"),
  idea(23, "pct.total.gives-tax-only", "w4l4", 6, "60", "560"),
  idea(24, "pct.of.forgets-divide-100", "w4l3", 1, "18000", "180"),
  idea(25, "interest.forgets-time", "w4l5", 1, "100", "200"),
  idea(26, "interest.forgets-percent", "w4l5", 1, "20000", "200"),
  idea(27, "budget.percent-left.sums", "w5l1", 7, "80", "20"),
  idea(28, "rate.unit.inverts", "w6l2", 1, "0.025", "40"),
  idea(29, "rate.distance.divides", "w6l3", 1, "22.5", "90"),
  idea(30, "rate.time.multiplies", "w6l3", 2, "7200", "2"),
  idea(31, "rational.frac-to-pct.forgets-times-100", "w7l1", 7, "0.4", "40"),
  idea(32, "rational.frac-to-dec.inverts", "w7l1", 1, "1.67", "0.6"),

  // ---- the situations the learning-cycle audit asked about
  {
    id: "RC-33",
    group: "Audit situations",
    skill: "w4l1",
    q: 2,
    attempts: [{ answer: "30" }],
    message: "Tama ang 30 kasi 15 ang pagtaas tapos dinoble ko lang po. Tama ba ang paraan ko?",
    draftIdeas: [],
    draftObservation: "The answer 30 is correct. The student's explanation (\"doubled the increase\") is a method that happens to work only for this pair of numbers (50 to 65).",
    draftBehaviour: "Confirm 30 is right, but do not say the method is right. Ask the student to try the method on a different pair (for example 50 to 60) so they see where it stops working.",
  },
  {
    id: "RC-34",
    group: "Audit situations",
    skill: "w3l3",
    q: 8,
    attempts: [{ answer: "110" }],
    message: "Ang sum ng pentagon ay (5-2)x180 = 540. Ang apat na anggulo ay 100+110+120+90 = 430, kaya 540 - 430 = 110. Bakit mali?",
    draftIdeas: [],
    draftObservation: "The student's method is sound. One written step is wrong: 100 + 110 + 120 + 90 is 420, not 430 (checked by a calculator, not by the AI).",
    draftBehaviour: "Point to the step 100+110+120+90 and ask the student to add it again. Do not state 120. Do not say the method is wrong.",
  },
  {
    id: "RC-35",
    group: "Audit situations",
    skill: "w3l3",
    q: 1,
    attempts: [],
    message: "yung formula po ay n minus ... tapos times 180? nakalimutan ko po",
    draftIdeas: [],
    draftObservation: "No answer yet. The student remembers part of the formula and is missing the middle number.",
    draftBehaviour: "Reply in Filipino. Ask what they remember about how many triangles fit inside a polygon, or point to the lesson's formula. Do not give the number of sides minus 2 as the full answer or state 540.",
  },
  {
    id: "RC-36",
    group: "Audit situations",
    skill: "w4l1",
    q: 1,
    attempts: [{ answer: "20" }],
    draftIdeas: ["pct.change.reports-amount", "pct.change.divides-by-new"],
    draftObservation: "One wrong answer, 20. Two different ideas give exactly 20, so the answer alone cannot tell them apart.",
    draftBehaviour: "Do not pick one idea. Ask how the student got 20, or give a follow-up question on which the two ideas would answer differently.",
  },
  {
    id: "RC-37",
    group: "Audit situations",
    skill: "w4l1",
    q: 2,
    attempts: [{ answer: "15" }],
    message: "hindi ko po maintindihan",
    draftIdeas: ["pct.change.reports-amount"],
    draftObservation: "One wrong answer, 15, which is the size of the increase itself. The message says nothing about the method.",
    draftBehaviour: "Reply in Filipino. Ask a small question about the next step (what do we compare the increase with?) rather than explaining everything. Do not state 30.",
  },
  {
    id: "RC-38",
    group: "Audit situations",
    skill: "w4l1",
    q: 1,
    attempts: [{ answer: "20" }, { answer: "20" }, { answer: "20" }],
    draftIdeas: ["pct.change.reports-amount", "pct.change.divides-by-new"],
    draftObservation: "The same wrong answer, 20, three times in a row.",
    draftBehaviour: "Change the strategy: name the repeated answer, give the method hint or the lesson's worked example, suggest asking the teacher. Do not repeat the earlier question and do not state 25.",
  },
  {
    id: "RC-39",
    group: "Audit situations",
    skill: "w4l1",
    q: 1,
    attempts: [{ answer: "20" }, { answer: "25" }],
    draftIdeas: ["pct.change.reports-amount", "pct.change.divides-by-new"],
    draftObservation: "First answer 20 (wrong), then 25 (correct) after a hint. The system still keeps the two ideas that fit the first answer, at low confidence, because a later right answer does not show why the first one was wrong. QUESTION FOR REVIEWERS: should a corrected answer on the same question lower or remove them?",
    draftBehaviour: "Confirm 25 is right. Ask the student what they changed, or to test the same method on a new pair of numbers. Do not treat the earlier wrong answer as a confirmed misconception.",
  },
  {
    id: "RC-40",
    group: "Audit situations",
    skill: "w4l1",
    q: 1,
    attempts: [{ answer: "37" }],
    draftIdeas: [],
    draftObservation: "One wrong answer, 37, that none of the known ideas gives.",
    draftBehaviour: "Ask how the student got 37. Do not guess a cause. The alternatives are a slip in the arithmetic, a misread question, or a guess.",
  },
  {
    id: "RC-41",
    group: "Audit situations",
    skill: "w4l1",
    q: 4,
    attempts: [{ answer: "410" }],
    draftIdeas: [],
    draftObservation: "One wrong answer, 410, close to the correct answer.",
    draftBehaviour: "Ask the student to recheck the last step of the calculation. The most likely explanation is a slip, so do not name a concept error.",
  },
  {
    id: "RC-42",
    group: "Audit situations",
    skill: "w4l1",
    q: 1,
    attempts: [{ answer: "20" }],
    message: "20 po kasi 100 minus 80",
    draftIdeas: ["pct.change.reports-amount", "pct.change.divides-by-new"],
    draftObservation: "The student wrote that 20 is 100 minus 80, which is the size of the increase. This supports the idea that they reported the increase, but it does not rule out the other idea.",
    draftBehaviour: "Reply in Filipino. Praise finding the increase (20 is correct as the increase). Ask what 20 should be compared with to get a percentage. Do not state 25.",
  },
  {
    id: "RC-43",
    group: "Audit situations",
    skill: "w4l1",
    q: 5,
    attempts: [{ answer: "(280 − 200) ÷ 280 × 100%" }],
    draftIdeas: [],
    draftObservation: "A multiple-choice miss. The chosen option divides by the new value. The catalog only covers typed numeric answers, so no idea is matched automatically.",
    draftBehaviour: "Ask which value the increase should be compared with. This one choice is not enough to say the student holds a misconception.",
  },
  {
    id: "RC-44",
    group: "Audit situations",
    skill: "w4l1",
    q: 1,
    attempts: [{ answer: "20" }],
    message: "Pakisabi na lang po ang sagot",
    draftIdeas: ["pct.change.reports-amount", "pct.change.divides-by-new"],
    draftObservation: "The student asks for the answer directly after one wrong attempt.",
    draftBehaviour: "Kindly decline to give the final answer, say why in one sentence, and offer the next smaller step instead. Reply in Filipino. Never state 25.",
  },
  {
    id: "RC-45",
    group: "Situations that must not create a suspicion",
    skill: "w3l2",
    q: 6,
    attempts: [{ answer: "90" }],
    draftIdeas: [],
    draftObservation: "90 is the correct answer. The idea \"assumes equal\" would also give 90 here, so a right answer must not be counted as evidence for it.",
    draftBehaviour: "Confirm the answer. No misconception is suspected.",
  },
  {
    id: "RC-46",
    group: "Situations that must not create a suspicion",
    skill: "w4l5",
    q: 2,
    attempts: [{ answer: "200" }],
    draftIdeas: [],
    draftObservation: "200 is correct (the time is 1 year, so forgetting the time does not change the answer). A right answer is not evidence for \"forgets time\".",
    draftBehaviour: "Confirm the answer. No misconception is suspected.",
  },
  {
    id: "RC-47",
    group: "Situations that must not create a suspicion",
    skill: "w4l1",
    q: 1,
    attempts: [],
    message: "Ano ang sum ng interior angles ng pentagon?",
    topicConflictMessage: "Ano ang sum ng interior angles ng pentagon?",
    draftIdeas: [],
    draftObservation: "The student is in a percentage lesson but asks about polygon angles.",
    draftBehaviour: "Do not guess. Ask whether they want help with the percentage problem or with the polygon lesson.",
  },
  {
    id: "RC-48",
    group: "Situations that must not create a suspicion",
    skill: "w4l1",
    q: 0,
    attempts: [],
    message: "Pwede mo ba akong tulungan?",
    draftIdeas: [],
    draftObservation: "No lesson or question is open.",
    draftBehaviour: "Ask which lesson or problem the student is working on. Do not invent a topic.",
  },
  {
    id: "RC-49",
    group: "Situations that separate two ideas",
    skill: "w4l1",
    q: 2,
    attempts: [{ answer: "20", q: 1 }, { answer: "15" }],
    draftIdeas: ["pct.change.reports-amount", "pct.change.divides-by-new"],
    draftObservation: "Wrong answers on two different questions: 20 for 80 to 100, and 15 for 50 to 65. Only \"reports the amount of change\" gives both. \"Divides by the new value\" gives 20 on the first but 23.08 on the second, so it is still listed (it explains one answer) but ranks second.",
    draftBehaviour: "The first idea is now the stronger suspicion (two questions), still not a diagnosis. Ask the student for the steps, then use a follow-up question to check.",
  },
];
