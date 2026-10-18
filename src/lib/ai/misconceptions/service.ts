// Suspected misconceptions over time: find them from wrong answers, ask a follow-up question that tells the ideas
// apart, correct, verify, and keep every step so a teacher can see the evidence.
//
// Nothing here changes mastery. A follow-up answer is graded by the server and stored in the misconception row; it is
// not a QuestionAttempt, so the mastery gate (practice-only) keeps meaning what it says.
//
// Status flow:  SUSPECTED -> CHECKING -> SUPPORTED | NOT_SUPPORTED
//               SUPPORTED -> CORRECTING -> RESOLVED | PERSISTING        (DISMISSED: set by a teacher)
// A RESOLVED idea that explains a NEW wrong answer later becomes PERSISTING.

import { dbService } from "../../db";
import { MISCONCEPTION_BY_ID, type MisconceptionEntry } from "./catalog";
import {
  alternativesFor,
  classifyFollowUpAnswer,
  confidenceFor,
  explainAttempts,
  selectFollowUp,
  type Alternative,
  type FollowUpOutcome,
  type PoolQuestion,
} from "./detector";

type Lang = "en" | "fil";

export interface StoredCheck {
  kind: "DIAGNOSTIC" | "VERIFICATION";
  questionId: string;
  answer: string;
  outcome: FollowUpOutcome;
  at: string;
}

export interface MisconceptionFollowUp {
  kind: "DIAGNOSTIC" | "VERIFICATION";
  misconceptionId: string;
  questionId: string;
  prompt: string;
  /** For a verification question: the correction to show first (catalog text and the lesson's worked example). */
  correction?: string;
}

const OPEN = ["SUSPECTED", "CHECKING", "SUPPORTED", "CORRECTING", "PERSISTING"];
const MAX_VERIFICATIONS = 3;
const MAX_NEW_PER_RUN = 3;

const parse = <T,>(text: string | null | undefined, fallback: T): T => {
  try {
    return text ? (JSON.parse(text) as T) : fallback;
  } catch {
    return fallback;
  }
};

const skillCodeOf = (skillId: string) => /(w\d+l\d+)$/.exec(skillId)?.[1];

function summarize(prompt: string, answer: string): string {
  const p = prompt.replace(/\s+/g, " ").trim();
  return `"${p.length > 140 ? p.slice(0, 137) + "..." : p}" was answered "${answer}"`;
}

// ---------------------------------------------------------------- detect
/**
 * Look at the student's wrong numeric answers on a skill and record, for each catalog idea that predicts those exact
 * answers, a SUSPECTED misconception. Existing rows get fresh evidence; a teacher's DISMISSED rows are left alone.
 */
export async function detect(params: { studentId: string; skillId: string; lessonId?: string | null }): Promise<void> {
  const { studentId, skillId, lessonId } = params;
  const code = skillCodeOf(skillId);
  if (!code) return;
  const attempts = await dbService.getWrongNumericAttemptsForSkill(studentId, skillId);
  if (attempts.length === 0) return;
  const hypotheses = explainAttempts(attempts, code);
  if (hypotheses.length === 0) return;

  const best = hypotheses[0].distinctQuestions;
  let created = 0;
  for (const h of hypotheses) {
    const existing = await dbService.findStudentMisconception(studentId, skillId, h.entry.id);
    if (existing?.status === "DISMISSED") continue;
    const isTop = h.distinctQuestions === best;
    if (!existing && (!isTop || created >= MAX_NEW_PER_RUN)) continue;

    const alternatives = alternativesFor(h, hypotheses, attempts);
    const rivals = alternatives.filter((a) => a.kind === "catalog").length;
    const checks = parse<StoredCheck[]>(existing?.checks, []);
    const supported = checks.some((c) => c.kind === "DIAGNOSTIC" && c.outcome === "PREDICTED_ERROR");
    const contradicted = checks.some((c) => c.kind === "DIAGNOSTIC" && c.outcome === "CORRECT");
    const confidence = confidenceFor({ distinctQuestions: h.distinctQuestions, rivals, supportedByFollowUp: supported, contradictedByFollowUp: contradicted });
    const observedAnswers = h.explained.map((e) => ({ attemptId: e.attemptId, questionId: e.questionId, answer: e.answer, predicted: e.predicted }));
    const evidenceAttemptIds = h.explained.map((e) => e.attemptId).filter(Boolean);
    const observation =
      h.explained.length === 1
        ? "One wrong answer: " + summarize(attempts.find((a) => a.attemptId === h.explained[0].attemptId)?.prompt || "", h.explained[0].answer) + "."
        : `${h.explained.length} wrong answers on ${h.distinctQuestions} different question(s) match this idea exactly.`;

    if (!existing) {
      await dbService.createStudentMisconception({
        studentId,
        skillId,
        lessonId: lessonId || null,
        conceptKey: h.entry.id,
        concept: h.entry.name.en,
        belief: h.entry.belief,
        confidence,
        observation,
        observedAnswers: JSON.stringify(observedAnswers),
        evidenceAttemptIds: JSON.stringify(evidenceAttemptIds),
        alternatives: JSON.stringify(alternatives),
        correction: JSON.stringify(h.entry.correction),
      });
      created++;
      continue;
    }

    const knownIds = new Set(parse<string[]>(existing.evidenceAttemptIds, []));
    const newEvidence = evidenceAttemptIds.some((id) => !knownIds.has(id as string));
    const patch: Record<string, any> = {
      confidence,
      observation,
      observedAnswers: JSON.stringify(observedAnswers),
      evidenceAttemptIds: JSON.stringify(evidenceAttemptIds),
      alternatives: JSON.stringify(alternatives),
    };
    // The same idea explains a wrong answer that came after it was resolved: it is still there.
    if (existing.status === "RESOLVED" && newEvidence) {
      patch.status = "PERSISTING";
      patch.resolvedAt = null;
      patch.verificationQuestionId = null;
    }
    await dbService.updateStudentMisconception(existing.id, patch);
  }
}

// ---------------------------------------------------------------- the follow-up question
async function lessonExample(lessonId?: string | null): Promise<string | null> {
  if (!lessonId) return null;
  try {
    const lesson: any = await dbService.getLessonById(lessonId);
    const block = (lesson?.contentBlocks || []).find((b: any) => String(b.type) === "EXAMPLE" && b.content);
    if (!block) return null;
    const text = String(block.content).replace(/\s+/g, " ").trim();
    return text.length > 500 ? text.slice(0, 497) + "..." : text;
  } catch {
    return null;
  }
}

/** The correction for a row, in the student's language, with the lesson's first worked example when there is one. */
async function correctionText(row: { correction: string; lessonId: string | null }, lang: Lang): Promise<string> {
  const c = parse<{ en: string; fil: string }>(row.correction, { en: "", fil: "" });
  const base = lang === "fil" ? c.fil || c.en : c.en || c.fil;
  const example = await lessonExample(row.lessonId);
  if (!example) return base;
  return base + (lang === "fil" ? "\n\nHalimbawa mula sa aralin: " : "\n\nWorked example from the lesson: ") + example;
}

/**
 * The one follow-up question to put in front of the student for a skill, or null. It is chosen from the student's
 * open misconceptions in this order: a question already waiting for an answer; a correction that needs a verification
 * question; a suspicion that needs a diagnostic question.
 */
export async function nextFollowUp(params: { studentId: string; skillId: string; language?: Lang }): Promise<MisconceptionFollowUp | null> {
  const { studentId, skillId } = params;
  const lang: Lang = params.language === "fil" ? "fil" : "en";
  const rows = (await dbService.listStudentMisconceptions({ studentId, skillId, statuses: OPEN })).filter((r) => MISCONCEPTION_BY_ID.get(r.conceptKey));
  if (rows.length === 0) return null;

  // 1. a question that is already waiting
  for (const status of ["CHECKING", "CORRECTING"]) {
    for (const r of rows.filter((x) => x.status === status)) {
      const qid = status === "CHECKING" ? r.diagnosticQuestionId : r.verificationQuestionId;
      const q = qid ? await dbService.getNumericQuestion(qid) : null;
      if (q) {
        return {
          kind: status === "CHECKING" ? "DIAGNOSTIC" : "VERIFICATION",
          misconceptionId: r.id,
          questionId: q.id,
          prompt: q.prompt,
          correction: status === "CORRECTING" ? await correctionText(r, lang) : undefined,
        };
      }
    }
  }

  const { pool, answeredIds } = await dbService.getNumericQuestionPoolForSkill(studentId, skillId);
  const usedBy = (r: (typeof rows)[number]) => parse<StoredCheck[]>(r.checks, []).map((c) => c.questionId);

  // 2. a supported (or persisting) idea needs a correction and a question to verify it
  for (const r of rows.filter((x) => x.status === "SUPPORTED" || x.status === "PERSISTING")) {
    const entry = MISCONCEPTION_BY_ID.get(r.conceptKey)!;
    const checks = parse<StoredCheck[]>(r.checks, []);
    if (checks.filter((c) => c.kind === "VERIFICATION").length >= MAX_VERIFICATIONS) continue;
    const pick = selectFollowUp(entry, [], pool as PoolQuestion[], [...answeredIds, ...usedBy(r)]);
    if (!pick) continue;
    await dbService.updateStudentMisconception(r.id, { status: "CORRECTING", verificationQuestionId: pick.question.id });
    return { kind: "VERIFICATION", misconceptionId: r.id, questionId: pick.question.id, prompt: pick.question.prompt, correction: await correctionText(r, lang) };
  }

  // 3. a suspicion needs a diagnostic question that separates it from the other ideas
  const suspected = rows.filter((x) => x.status === "SUSPECTED").sort((a, b) => b.confidence - a.confidence);
  for (const r of suspected) {
    const entry = MISCONCEPTION_BY_ID.get(r.conceptKey)!;
    const rivalIds = parse<Alternative[]>(r.alternatives, []).filter((a) => a.kind === "catalog").map((a) => a.id);
    const rivals = rivalIds.map((id) => MISCONCEPTION_BY_ID.get(id)).filter((e): e is MisconceptionEntry => !!e);
    const evidenceQuestions = parse<{ questionId: string }[]>(r.observedAnswers, []).map((o) => o.questionId);
    const pick = selectFollowUp(entry, rivals, pool as PoolQuestion[], [...answeredIds, ...evidenceQuestions, ...usedBy(r)]);
    if (!pick) continue;
    await dbService.updateStudentMisconception(r.id, { status: "CHECKING", diagnosticQuestionId: pick.question.id });
    return { kind: "DIAGNOSTIC", misconceptionId: r.id, questionId: pick.question.id, prompt: pick.question.prompt };
  }
  return null;
}

// ---------------------------------------------------------------- the student's answer
export interface FollowUpResult {
  outcome: FollowUpOutcome;
  status: string;
  /** What to tell the student. It never contains the correct answer: the question may still be in their practice set. */
  message: string;
  next: MisconceptionFollowUp | null;
}

const say = (lang: Lang, en: string, fil: string) => (lang === "fil" ? fil : en);

export async function answerFollowUp(params: { studentId: string; misconceptionId: string; answer: string; language?: Lang }): Promise<FollowUpResult> {
  const lang: Lang = params.language === "fil" ? "fil" : "en";
  const row = await dbService.getStudentMisconception(params.misconceptionId);
  if (!row || row.studentId !== params.studentId) throw new Error("Follow-up question not found.");
  const kind = row.status === "CHECKING" ? "DIAGNOSTIC" : row.status === "CORRECTING" ? "VERIFICATION" : null;
  if (!kind) throw new Error("There is no follow-up question waiting for an answer.");
  const entry = MISCONCEPTION_BY_ID.get(row.conceptKey);
  const qid = kind === "DIAGNOSTIC" ? row.diagnosticQuestionId : row.verificationQuestionId;
  const question = qid ? await dbService.getNumericQuestion(qid) : null;
  if (!entry || !question) throw new Error("This follow-up question is no longer available.");
  let predicted: number | null = null;
  try {
    predicted = entry.predict(question.prompt);
  } catch {
    predicted = null;
  }
  const outcome = classifyFollowUpAnswer(question, predicted ?? NaN, String(params.answer ?? "").slice(0, 60));

  if (outcome === "NOT_A_NUMBER") {
    return { outcome, status: row.status, message: say(lang, "Please type a number as your answer.", "Mag-type po ng numero bilang sagot."), next: null };
  }

  const checks = parse<StoredCheck[]>(row.checks, []);
  checks.push({ kind, questionId: question.id, answer: String(params.answer).slice(0, 60), outcome, at: new Date().toISOString() });
  const patch: Record<string, any> = { checks: JSON.stringify(checks) };
  let message = "";

  if (kind === "DIAGNOSTIC") {
    const alternatives = parse<Alternative[]>(row.alternatives, []);
    const distinct = new Set(parse<{ questionId: string }[]>(row.observedAnswers, []).map((o) => o.questionId)).size || 1;
    const rivals = alternatives.filter((a) => a.kind === "catalog").length;
    if (outcome === "CORRECT") {
      patch.status = "NOT_SUPPORTED";
      patch.confidence = confidenceFor({ distinctQuestions: distinct, rivals, contradictedByFollowUp: true });
      message = say(lang, "That is correct. Thank you, that helps me understand how you are thinking.", "Tama po iyan. Salamat, nakatulong ito para maintindihan ko ang iniisip mo.");
    } else if (outcome === "PREDICTED_ERROR") {
      patch.status = "SUPPORTED";
      patch.confidence = confidenceFor({ distinctQuestions: distinct, rivals, supportedByFollowUp: true });
      message = say(lang, "Thank you. That is not the answer yet, but it shows me how you are working it out.", "Salamat po. Hindi pa iyan ang sagot, pero nakita ko kung paano mo ito ginagawa.");
    } else {
      patch.status = "SUSPECTED"; // a different mistake: this question did not settle it
      patch.diagnosticQuestionId = null;
      message = say(lang, "Thank you. That is not the answer yet.", "Salamat po. Hindi pa iyan ang sagot.");
    }
  } else if (outcome === "CORRECT") {
    patch.status = "RESOLVED";
    patch.resolvedAt = new Date();
    message = say(lang, "Correct! You used the idea the right way this time.", "Tama! Nagamit mo na nang tama ang ideya ngayon.");
  } else if (outcome === "PREDICTED_ERROR") {
    patch.status = "PERSISTING";
    message = say(lang, "That is the same slip as before. Let us look at the example again, or ask your teacher to go over it with you.", "Pareho pa rin ito ng naunang pagkakamali. Balikan natin ang halimbawa, o magtanong sa guro.");
  } else {
    patch.status = "SUPPORTED"; // a new kind of mistake: offer another correction and question
    patch.verificationQuestionId = null;
    message = say(lang, "Not quite. Let us try once more with a different question.", "Hindi pa po tama. Subukan natin ulit sa ibang tanong.");
  }

  const updated = await dbService.updateStudentMisconception(row.id, patch);
  const next = patch.status === "PERSISTING" || patch.status === "RESOLVED" || patch.status === "NOT_SUPPORTED" ? null : await nextFollowUp({ studentId: params.studentId, skillId: row.skillId, language: lang });
  // Report the state after any follow-up was queued (SUPPORTED becomes CORRECTING when a verification question is set).
  const final = next ? await dbService.getStudentMisconception(row.id) : updated;
  return { outcome, status: final?.status || patch.status, message, next };
}

// ---------------------------------------------------------------- views
/** Open misconceptions for the tutor: only what the tutor may use, never the correction text or the evidence ids. */
export async function openForTutor(studentId: string, skillId: string) {
  const rows = (await dbService.listStudentMisconceptions({ studentId, skillId, statuses: OPEN })).filter((r) => MISCONCEPTION_BY_ID.get(r.conceptKey));
  return rows.map((r) => ({
    id: r.id,
    conceptKey: r.conceptKey,
    concept: r.concept,
    belief: r.belief,
    status: r.status as string,
    confidence: r.confidence,
  }));
}

/** The full record for a teacher, with the JSON columns parsed. */
export async function listForTeacher(studentId: string, skillId?: string | null) {
  const rows = await dbService.listStudentMisconceptions({ studentId, skillId });
  return rows.map((r) => ({
    id: r.id,
    skillId: r.skillId,
    skillTitle: (r as any).skill?.title || null,
    conceptKey: r.conceptKey,
    concept: r.concept,
    belief: r.belief,
    status: r.status,
    confidence: r.confidence,
    observation: r.observation,
    observedAnswers: parse<any[]>(r.observedAnswers, []),
    alternatives: parse<Alternative[]>(r.alternatives, []),
    checks: parse<StoredCheck[]>(r.checks, []),
    teacherNote: r.teacherNote,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
    reviewedDraft: true as const, // the catalog is AI-drafted and not yet reviewed by a teacher
  }));
}

/** Teacher decisions: dismiss it, mark it confirmed (SUPPORTED), or add a note. */
export async function teacherUpdate(id: string, studentId: string, action: { status?: "DISMISSED" | "SUPPORTED" | "SUSPECTED"; teacherNote?: string }) {
  const row = await dbService.getStudentMisconception(id);
  if (!row || row.studentId !== studentId) return null;
  const patch: Record<string, any> = {};
  if (action.status) patch.status = action.status;
  if (typeof action.teacherNote === "string") patch.teacherNote = action.teacherNote.slice(0, 1000);
  if (Object.keys(patch).length === 0) return row;
  return dbService.updateStudentMisconception(id, patch);
}
