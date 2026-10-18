// Pure logic for suspected misconceptions: which catalog ideas explain a student's wrong answers, how sure we can be,
// what the alternatives are, and which follow-up question tells them apart. No database, no AI model.
//
// The rule that shapes everything here: a wrong answer is an OBSERVATION. An idea only becomes a suspicion when it
// predicts exactly the answer the student gave, and it only gains weight when it explains answers on more than one
// question or when the student's own answer to a follow-up question matches what the idea predicts.

import { MISCONCEPTIONS, normalizePrompt, type MisconceptionEntry } from "./catalog";

export interface WrongAttempt {
  attemptId?: string;
  questionId: string;
  prompt: string;
  /** What the student answered, as text (for a multiple-choice question: the text of the chosen option). */
  answer: string;
  /** The correct answer, when known, so a predicted answer that equals it is not counted as an error. */
  expected?: string;
}

export interface PoolQuestion {
  id: string;
  prompt: string;
  /** The correct answer as text. */
  expected: string;
  difficulty?: string;
}

export interface Explained {
  attemptId?: string;
  questionId: string;
  answer: string;
  predicted: number;
}

export interface Hypothesis {
  entry: MisconceptionEntry;
  explained: Explained[];
  distinctQuestions: number;
}

export interface Alternative {
  id: string;
  text: string;
  /** "catalog" for another known idea, "generic" for a slip, a misread question or a guess. */
  kind: "catalog" | "generic";
}

// ---------------------------------------------------------------- numbers
export function numberOf(text: string | number | null | undefined): number | null {
  if (text === null || text === undefined) return null;
  if (typeof text === "number") return Number.isFinite(text) ? text : null;
  const t = String(text).replace(/(\d),(?=\d{3}\b)/g, "$1").replace(/[₱%°\s]/g, "");
  const m = /^-?\d+(?:\.\d+)?$/.exec(t);
  if (m) return Number(t);
  const frac = /^(-?\d+)\/(\d+)$/.exec(t);
  if (frac && Number(frac[2]) !== 0) return Number(frac[1]) / Number(frac[2]);
  return null;
}

/** Two numbers are the same answer when they agree to within rounding (0.5 percent or 0.01). */
export const sameNumber = (a: number, b: number) => Math.abs(a - b) <= Math.max(0.01, Math.abs(b) * 0.005);

// ---------------------------------------------------------------- which ideas explain a wrong answer
export function explains(entry: MisconceptionEntry, prompt: string, answer: string, expected?: string): number | null {
  const given = numberOf(answer);
  if (given === null) return null;
  let predicted: number | null = null;
  try {
    predicted = entry.predict(normalizePrompt(prompt) === prompt ? prompt : prompt);
  } catch {
    predicted = null;
  }
  if (predicted === null || !Number.isFinite(predicted)) return null;
  const right = numberOf(expected);
  if (right !== null && sameNumber(predicted, right)) return null; // that idea would give the right answer here
  return sameNumber(predicted, given) ? predicted : null;
}

/** The catalog ideas that explain at least one of the wrong attempts, strongest first. */
export function explainAttempts(attempts: WrongAttempt[], skillCode?: string): Hypothesis[] {
  const out: Hypothesis[] = [];
  for (const entry of MISCONCEPTIONS) {
    if (skillCode && !entry.skills.includes(skillCode)) continue;
    const explained: Explained[] = [];
    for (const a of attempts) {
      const predicted = explains(entry, a.prompt, a.answer, a.expected);
      if (predicted !== null) explained.push({ attemptId: a.attemptId, questionId: a.questionId, answer: a.answer, predicted });
    }
    if (explained.length > 0) out.push({ entry, explained, distinctQuestions: new Set(explained.map((e) => e.questionId)).size });
  }
  return out.sort((a, b) => b.distinctQuestions - a.distinctQuestions || b.explained.length - a.explained.length);
}

/**
 * How sure the system is, as a number between 0 and 1. It rises with the number of different questions the idea explains,
 * falls when other ideas explain the same answers (the answers cannot tell them apart), and gets a lift only when the
 * student's own answer to a follow-up question matched the idea's prediction.
 */
export function confidenceFor(opts: { distinctQuestions: number; rivals: number; supportedByFollowUp?: boolean; contradictedByFollowUp?: boolean }): number {
  let c = opts.distinctQuestions >= 3 ? 0.62 : opts.distinctQuestions === 2 ? 0.52 : 0.35;
  c -= 0.05 * Math.min(opts.rivals, 3);
  if (opts.supportedByFollowUp) c += 0.3;
  if (opts.contradictedByFollowUp) c -= 0.25;
  return Math.round(Math.min(0.85, Math.max(0.1, c)) * 100) / 100;
}

/** Other explanations the system cannot rule out, always including a slip and a misread question. */
export function alternativesFor(primary: Hypothesis, all: Hypothesis[], attempts: WrongAttempt[]): Alternative[] {
  const alts: Alternative[] = [];
  const answers = new Set(primary.explained.map((e) => e.answer.trim()));
  for (const h of all) {
    if (h.entry.id === primary.entry.id) continue;
    if (h.explained.some((e) => answers.has(e.answer.trim()))) {
      alts.push({ id: h.entry.id, text: h.entry.name.en, kind: "catalog" });
    }
  }
  const close = attempts.some((a) => {
    const g = numberOf(a.answer);
    const r = numberOf(a.expected);
    return g !== null && r !== null && r !== 0 && Math.abs(g - r) / Math.abs(r) <= 0.1;
  });
  alts.push({
    id: "generic.calculation-slip",
    text: close ? "a slip in the arithmetic (the answer is close to the correct one)" : "a slip in the arithmetic",
    kind: "generic",
  });
  alts.push({ id: "generic.misread", text: "misreading or mistyping the question or the numbers", kind: "generic" });
  alts.push({ id: "generic.guess", text: "a guess, with no consistent method behind it", kind: "generic" });
  return alts;
}

// ---------------------------------------------------------------- follow-up questions
/**
 * A question from the same skill on which the suspected idea gives a specific WRONG answer, and on which the other
 * ideas that explained the same answers would answer differently. The student's answer then tells the ideas apart.
 */
export function selectFollowUp(
  primary: MisconceptionEntry,
  rivals: MisconceptionEntry[],
  pool: PoolQuestion[],
  excludeIds: string[]
): { question: PoolQuestion; predicted: number } | null {
  const rank = (d?: string) => (d === "EASY" ? 0 : d === "MEDIUM" ? 1 : 2);
  const candidates = pool
    .filter((q) => !excludeIds.includes(q.id) && numberOf(q.expected) !== null)
    .map((q) => ({ question: q, predicted: safePredict(primary, q.prompt) }))
    .filter((x): x is { question: PoolQuestion; predicted: number } => x.predicted !== null)
    .filter((x) => !sameNumber(x.predicted, numberOf(x.question.expected)!))
    .filter((x) =>
      rivals.every((r) => {
        const rp = safePredict(r, x.question.prompt);
        return rp === null || !sameNumber(rp, x.predicted);
      })
    );
  candidates.sort((a, b) => rank(a.question.difficulty) - rank(b.question.difficulty) || a.question.id.localeCompare(b.question.id));
  return candidates[0] || null;
}

function safePredict(entry: MisconceptionEntry, prompt: string): number | null {
  try {
    const v = entry.predict(prompt);
    return v !== null && Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

export type FollowUpOutcome = "CORRECT" | "PREDICTED_ERROR" | "OTHER_ERROR" | "NOT_A_NUMBER";

/** What the student's answer to a follow-up question says about the suspected idea. */
export function classifyFollowUpAnswer(question: PoolQuestion, predicted: number, answer: string): FollowUpOutcome {
  const g = numberOf(answer);
  if (g === null) return "NOT_A_NUMBER";
  const right = numberOf(question.expected);
  if (right !== null && sameNumber(g, right)) return "CORRECT";
  if (sameNumber(g, predicted)) return "PREDICTED_ERROR";
  return "OTHER_ERROR";
}

/** The catalog entry ids that would explain this answer on this question, for any skill. */
export function explainingIds(prompt: string, answer: string, expected?: string): string[] {
  return MISCONCEPTIONS.filter((e) => explains(e, prompt, answer, expected) !== null).map((e) => e.id);
}
