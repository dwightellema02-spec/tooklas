// A deterministic, topic-aware Socratic tutor. It is the fallback when the AI model is unavailable or its answer
// cannot be used, and it also supplies the safe reply when a model answer would give away the final answer.
//
// It works only from facts the server holds: the lesson text, the question, the student's saved attempts and what the
// student wrote about their own work. It does not guess the student's topic and it never states the expected answer.

import { TOPICS, topicsIn } from "./topics";
import type { AITutorContext, AITutorHelpLevel } from "./types";

export interface EngineReply {
  responseType: "HINT" | "GUIDING_QUESTION" | "EXPLANATION" | "EXAMPLE" | "FEEDBACK" | "CLARIFICATION" | "REDIRECT";
  message: string;
  guidingQuestion?: string;
  hintLevel: number;
  encouragement: string;
  nextStep: string;
  detectedIssue: string;
  suggestedAction: string;
  sourceGrounding: string[];
}

// ---------------------------------------------------------------- small helpers
const squash = (s: string) => String(s ?? "").replace(/\s+/g, " ").trim();
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

/** Integer lessons keep the original keyword tutor, which was written for them. */
export function isIntegerContext(ctx: AITutorContext): boolean {
  const header = [ctx.lesson?.title, ctx.skill?.title, ctx.curriculum?.unitTitle, ...(ctx.groundedLesson?.learningObjectives || [])].join(" ");
  if (ctx.lesson && ctx.groundedLesson) return /\binteger/i.test(header);
  if (ctx.lesson) return /\binteger/i.test(header);
  return topicsIn(ctx.studentQuery || "").some((t) => t.id === "integers");
}

function choiceTextOf(q: NonNullable<AITutorContext["question"]>, value: string): string {
  const v = squash(value);
  const byId = q.choices?.find((c) => c.id.toLowerCase() === v.toLowerCase());
  if (byId) return byId.text;
  return v;
}

const norm = (s: string) => squash(s).toLowerCase().replace(/[₱%°\s]/g, "");
const numberOf = (s: string): number | null => {
  const t = squash(s).replace(/,(?=\d{3}\b)/g, "").replace(/[₱%°]/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
};

/** true / false when the student's answer can be checked against the key, null when it cannot. */
export function answersMatch(q: AITutorContext["question"], answer: any): boolean | null {
  if (!q || q.expectedAnswer === undefined || q.expectedAnswer === null || q.expectedAnswer === "") return null;
  if (answer === undefined || answer === null || squash(String(answer)) === "") return null;
  const a = squash(String(answer));
  const expectedRaw = String(q.expectedAnswer);
  if (q.choices && q.choices.length > 0) {
    return norm(choiceTextOf(q, a)) === norm(choiceTextOf(q, expectedRaw));
  }
  const na = numberOf(a);
  const ne = numberOf(expectedRaw);
  if (na !== null && ne !== null) return Math.abs(na - ne) < 1e-9 * Math.max(1, Math.abs(ne));
  const tf = (x: string) => (/^(true|tama|oo|yes)$/i.test(x) ? "true" : /^(false|mali|hindi|no)$/i.test(x) ? "false" : x.toLowerCase());
  return tf(a) === tf(expectedRaw) || norm(a) === norm(expectedRaw);
}

/**
 * True when text states the final answer of a question the student has not answered correctly yet.
 * Numbers that the question itself already shows are ignored, since the tutor must be able to talk about them.
 */
export function revealsExpectedAnswer(text: string, rawCtx: AITutorContext): boolean {
  const ctx = { ...rawCtx, previousAttempts: rawCtx.previousAttempts ?? [] };
  const q = ctx.question;
  if (!q || q.expectedAnswer === undefined || q.expectedAnswer === "") return false;
  if (answersMatch(q, ctx.studentAnswer) === true) return false;
  if (ctx.previousAttempts.some((a) => a.isCorrect)) return false;
  const body = text.replace(/(\d),(?=\d{3}\b)/g, "$1");

  if (q.choices && q.choices.length > 0) {
    const correct = choiceTextOf(q, String(q.expectedAnswer));
    if (correct.length < 4) return false;
    const idx = body.toLowerCase().indexOf(correct.toLowerCase());
    if (idx < 0) return false;
    const before = body.slice(Math.max(0, idx - 50), idx);
    return /(correct|right|tamang|tama|answer is|sagot ay|should be|dapat ay)/i.test(before);
  }

  const expected = numberOf(String(q.expectedAnswer));
  if (expected === null) return false;
  const token = String(expected);
  const shown = [q.prompt, ...(q.choices || []).map((c) => c.text), ...ctx.previousAttempts.map((a) => a.answer), String(ctx.studentAnswer ?? "")]
    .join(" ")
    .replace(/(\d),(?=\d{3}\b)/g, "$1");
  const standalone = new RegExp(`(^|[^0-9.])${token.replace(".", "\\.")}([^0-9]|\\.(?!\\d)|$)`);
  if (standalone.test(shown)) return false; // the question or the student already shows this number
  if (token.replace(/[-.]/g, "").length <= 2) {
    return new RegExp(`(answer|sagot|result|resulta|equals|=|is|ay)\\s*\\$?\\s*${token.replace(".", "\\.")}(?![0-9])`, "i").test(body);
  }
  return standalone.test(body);
}

// ---------------------------------------------------------------- lesson facts
function keyRule(ctx: AITutorContext): string | null {
  const blocks = ctx.groundedLesson?.contentBlocks || [];
  const promptWords = new Set(squash(ctx.question?.prompt || "").toLowerCase().split(/[^a-zа-я0-9]+/i).filter((w) => w.length > 3));
  let formula: { line: string; score: number } | null = null;
  let definition: { line: string; score: number } | null = null;
  for (const b of blocks) {
    if (b.type !== "TEXT" && b.type !== "SUMMARY") continue;
    for (const raw of String(b.content).split(/(?<=[.!?])\s+|\n+/)) {
      const line = squash(raw.replace(/^[\s\-*•#]+/, "").replace(/\*+/g, "").replace(/\s*\|.*$/, ""));
      if (line.length < 25 || line.length > 260) continue;
      const score = line.toLowerCase().split(/[^a-z0-9]+/).filter((w) => promptWords.has(w)).length;
      if (/(=|×|÷|\bformula\b|\bdivid|\bmultipl|\bsubtract|\badd\b|\bsum\b|\bequals?\b)/i.test(line)) {
        if (!formula || score > formula.score) formula = { line, score };
      } else if (score >= 1 && /\b(is|are|means|called|has|have)\b/i.test(line)) {
        if (!definition || score > definition.score) definition = { line, score };
      }
    }
  }
  const best = formula || definition;
  return best ? clip(best.line, 220) : null;
}

function workedExample(ctx: AITutorContext): { problem: string; steps: string[] } | null {
  for (const b of ctx.groundedLesson?.contentBlocks || []) {
    if (b.type !== "EXAMPLE") continue;
    let meta: any = b.metadata;
    if (typeof meta === "string") {
      try {
        meta = JSON.parse(meta);
      } catch {
        meta = null;
      }
    }
    if (meta && meta.problem && Array.isArray(meta.steps) && meta.steps.length) {
      return { problem: clip(squash(String(meta.problem)), 200), steps: meta.steps.slice(0, 3).map((s: string) => clip(squash(String(s)), 150)) };
    }
    const m = /Problem:\s*(.+?)\s*Step 1:/i.exec(squash(b.content));
    if (m) return { problem: clip(m[1], 200), steps: [] };
  }
  return null;
}

function genericWrongFeedback(s?: string): string | null {
  const v = squash(s || "");
  if (!v || /^not quite\. check your steps/i.test(v) || /^incorrect/i.test(v)) return null;
  return v;
}

const rank = (h: AITutorHelpLevel | undefined): number => (h === "CONCEPT_EXPLANATION" ? 3 : h === "LEVEL_2_HINT" ? 2 : 1);

// ---------------------------------------------------------------- intents
const INJECTION = /(ignore (all |the |your )?(previous|above|prior)|system prompt|act as dan|jailbreak|developer mode|api[_ ]?key|database_url|passwordhash|reveal your (instructions|prompt))/i;
const OFF_TOPIC = /\b(celebrity|movie|song|recipe|weather|basketball game|crush|boyfriend|girlfriend|tiktok|mobile legends)\b/i;
const DIRECT_ANSWER = /(give me the (final )?answer|what('| i)?s the (final )?answer|just tell me|tell me the answer|show (me )?the answer|ibigay.{0,12}sagot|ano ang sagot|ano po ang sagot|sagutin mo na|pakisabi.{0,24}sagot|sabihin mo.{0,24}sagot|sabihin.{0,12}na lang.{0,12}sagot|the answer for this)/i;
const CONFUSED = /(don'?t (understand|know|get)|dont (understand|know|get)|\bidk\b|no idea|confused|i'?m lost|hindi ko (po )?(alam|maintindihan|gets)|di ko (po )?(alam|maintindihan|gets)|nalilito|\bewan\b|hirap na hirap|walang ideya)/i;
const WANTS_EXAMPLE = /(another example|an example|worked example|show me an example|halimbawa)/i;
const WANTS_SIMPLER = /(simpler|easier|too hard|mas madali|mas simple|masyadong mahirap|paki-?simple)/i;
const LANGUAGE_ONLY = /^(in )?(tagalog|filipino|english|ingles|sa tagalog|sa filipino|sa ingles)( please| po)?[.!]*$/i;

function ordinalChoice(query: string): number | null {
  if (/\b(una|first)\b/i.test(query)) return 0;
  if (/\b(pangalawa|ikalawa|second)\b/i.test(query)) return 1;
  if (/\b(pangatlo|ikatlo|third)\b/i.test(query)) return 2;
  if (/\b(pang-?apat|ikaapat|fourth)\b/i.test(query)) return 3;
  return null;
}

// ---------------------------------------------------------------- the engine
export function socraticResponse(rawCtx: AITutorContext): EngineReply {
  const ctx: AITutorContext = { ...rawCtx, previousAttempts: rawCtx.previousAttempts ?? [], recentMessages: rawCtx.recentMessages ?? [] };
  const fil = ctx.requestedLanguage === "fil";
  const t = (f: string, e: string) => (fil ? f : e);
  const query = squash(ctx.studentQuery || "");
  const lower = query.toLowerCase();
  const lessonTitle = ctx.lesson?.title && ctx.groundedLesson ? squash(ctx.lesson.title.replace(/^Week \d+\s*[·-]\s*/i, "")) : undefined;
  const q = ctx.question;
  const grounding: string[] = [];
  if (lessonTitle) grounding.push(`Lesson: ${lessonTitle}`);
  if (q) grounding.push(`${q.source === "checkpoint" ? "Checkpoint" : "Question"}: ${clip(squash(q.prompt), 80)}`);
  if (ctx.previousAttempts.length) grounding.push(`Student attempts: ${ctx.previousAttempts.length}`);

  const reply = (r: Partial<EngineReply> & { message: string; responseType: EngineReply["responseType"] }): EngineReply => ({
    hintLevel: 1,
    encouragement: t("Hakbang-hakbang lang, kaya mo ito.", "One step at a time, you can do this."),
    nextStep: t("Sagutin ang tanong sa itaas.", "Answer the question above."),
    detectedIssue: "NONE",
    suggestedAction: "CONTINUE_LESSON",
    sourceGrounding: grounding.length ? grounding : ["No lesson context"],
    ...r,
  });

  // 1. Safety
  if (INJECTION.test(query) || OFF_TOPIC.test(query)) {
    return reply({
      responseType: "REDIRECT",
      message: lessonTitle
        ? t(`Balik muna tayo sa aralin natin ngayon: ${lessonTitle}. Dito kita matutulungan nang pinakamahusay.`, `Let's get back to today's lesson: ${lessonTitle}. That's where I can help you best.`)
        : t("Matematika ang pinagtutulungan natin dito. Anong aralin o tanong ang gusto mong pag-usapan?", "I'm here to help with your math. Which lesson or question would you like to work on?"),
      guidingQuestion: t("Alin sa aralin ang nahihirapan ka?", "Which part of the lesson is hard for you?"),
      nextStep: t("Bumalik sa kasalukuyang aralin.", "Go back to the current lesson."),
    });
  }

  // 2. Context honesty: do not guess what the student is studying
  const status = ctx.contextStatus;
  if (status && !status.lessonKnown && !status.questionKnown) {
    return reply({
      responseType: "CLARIFICATION",
      message: t(
        "Gusto kitang matulungan, pero hindi ko pa alam kung anong aralin o tanong ang ginagawa mo. Para hindi ako manghula, sabihin mo muna kung alin ito.",
        "I'd like to help, but I don't know yet which lesson or question you're working on. So I don't guess, please tell me which one it is."
      ),
      guidingQuestion: t("Anong aralin o tanong ang pinag-aaralan mo ngayon?", "Which lesson or question are you working on right now?"),
      nextStep: t("Buksan ang aralin o tanong, o isulat dito ang pamagat nito.", "Open the lesson or question, or type its title here."),
    });
  }
  if (status?.conflict) {
    const topic = TOPICS.find((x) => x.en === status.conflict!.mentioned);
    const there = fil ? topic?.fil || status.conflict.mentioned : status.conflict.mentioned;
    return reply({
      responseType: "CLARIFICATION",
      message: t(
        `Nasa aralin ka ngayon na "${lessonTitle || status.conflict.lessonTopic}", pero mukhang tungkol sa ${there} ang tinatanong mo. Para hindi ako magkamali, sabihin mo kung alin ang gusto mong pag-usapan.`,
        `You're in the lesson "${lessonTitle || status.conflict.lessonTopic}", but your question seems to be about ${there}. So I don't get it wrong, tell me which one you want to talk about.`
      ),
      guidingQuestion: t(`Magpapatuloy ba tayo sa ${lessonTitle || "kasalukuyang aralin"}, o sa ${there}?`, `Shall we continue with ${lessonTitle || "the current lesson"}, or with ${there}?`),
      nextStep: t("Sabihin kung alin ang pipiliin mo.", "Tell me which one you choose."),
    });
  }

  const slips = ctx.studentWork?.arithmeticSlips || [];
  const answer = ctx.studentAnswer === undefined || ctx.studentAnswer === null ? "" : squash(String(ctx.studentAnswer));
  const correct = answersMatch(q, answer);
  // What to show the student: the text of a chosen option, not its internal id.
  const shown = q && q.choices?.length ? choiceTextOf(q, answer) : answer;
  const wrong = ctx.previousAttempts.filter((a) => !a.isCorrect);
  const lastTwoSame = wrong.length >= 2 && squash(wrong[wrong.length - 1].answer) === squash(wrong[wrong.length - 2].answer);
  const wrongCount = Math.max(wrong.length, correct === false ? 1 : 0);
  const effective = Math.max(rank(ctx.helpLevel), wrongCount >= 3 ? 3 : wrongCount >= 2 ? 2 : 1);
  const rule = keyRule(ctx);
  const example = workedExample(ctx);
  const explained = query.split(/\s+/).length >= 7 || /=/.test(query);
  const prefix = LANGUAGE_ONLY.test(lower) ? t("Sige, magpatuloy tayo sa Tagalog. ", "Sure, let's continue in English. ") : "";

  // 2b. Honesty about media and documents the tutor cannot read
  const materials = ctx.groundedLesson?.teacherMaterials || [];
  if (/\b(video|youtube|mathisip|mathisipan|napanood|pinanood|panoorin)\b/i.test(lower) && materials.some((m) => m.type === "YOUTUBE")) {
    return reply({
      responseType: "CLARIFICATION",
      message: prefix + t(
        "Hindi ko napanood ang video, at wala akong transcript nito. Makakatulong pa rin ako gamit ang teksto at mga halimbawa ng aralin mo.",
        "I have not watched the video and I do not have a transcript of it. I can still help using your lesson's text and examples."
      ),
      guidingQuestion: t("Aling bahagi ng aralin o video ang hindi mo naintindihan? Sabihin mo ang konsepto.", "Which part of the lesson or video was unclear? Tell me the idea."),
      suggestedAction: "CONTINUE_LESSON",
    });
  }
  const failedDocs = materials.filter((m) => m.extractionStatus === "FAILED");
  if (failedDocs.length > 0 && /\b(pdf|document|dokumento|file|attachment|worksheet|handout|module|modyul)\b/i.test(lower)) {
    return reply({
      responseType: "CLARIFICATION",
      message: prefix + t(
        "Nakalakip ang dokumento ng guro, pero hindi ko nabasa ang teksto nito. Makakatulong pa rin ako gamit ang nilalaman ng aralin.",
        "The teacher's document is attached, but I couldn't extract its text. I can still help using the lesson content."
      ),
      guidingQuestion: t("Aling bahagi ng aralin ang gusto mong pag-usapan?", "Which part of the lesson would you like to talk about?"),
      suggestedAction: "CONTINUE_LESSON",
    });
  }

  // 3. A written step that does not compute: a verified observation, whatever the answer was
  if (slips.length > 0 && correct !== true) {
    const s = slips[0];
    return reply({
      responseType: "GUIDING_QUESTION",
      message: prefix + t(
        `Salamat sa pagpapakita ng mga hakbang mo. May isang hakbang na dapat nating suriin: isinulat mo na ${s.expression} = ${s.claimed}.`,
        `Thanks for showing your steps. There is one step we should check: you wrote ${s.expression} = ${s.claimed}.`
      ),
      guidingQuestion: t(`Ano ang makukuha mo kapag kinalkula mo ulit ang ${s.expression}?`, `What do you get when you work out ${s.expression} again?`),
      detectedIssue: "CALCULATION_ERROR",
      suggestedAction: "RETRY",
      nextStep: t("Kalkulahin muli ang hakbang na iyon, tapos subukan ulit ang sagot.", "Recalculate that step, then try the answer again."),
      encouragement: t("Ang pagsulat ng mga hakbang ang nagpapadali sa paghahanap ng mali.", "Writing your steps makes it easy to find a slip."),
    });
  }

  // 4. A question is open
  if (q) {
    // 4a. Right answer: confirm, then check that they understand (not only that they guessed)
    if (correct === true) {
      if (slips.length > 0) {
        const s = slips[0];
        return reply({
          responseType: "FEEDBACK",
          message: prefix + t(
            `Tama ang sagot mong ${shown}. Pero tingnan ang hakbang mo: isinulat mo na ${s.expression} = ${s.claimed}, na hindi tugma sa kinalabasan nito.`,
            `Your answer ${shown} is right. But look at your step: you wrote ${s.expression} = ${s.claimed}, which does not match what it works out to.`
          ),
          guidingQuestion: t(`Ano ang makukuha mo sa ${s.expression}, at paano ito nauugnay sa sagot mo?`, `What does ${s.expression} work out to, and how does it connect to your answer?`),
          detectedIssue: "CALCULATION_ERROR",
          suggestedAction: "RETRY",
        });
      }
      const probe = explained && example
        ? t(`Subukan natin ang paraan mo sa halimbawa sa aralin: ${example.problem} Paano mo ito lulutasin?`, `Let's test your method on a lesson example: ${example.problem} How would you solve it?`)
        : explained
        ? t(`Kung iba ang mga numero, gagana pa rin ba ang paraan mo? Ipaliwanag kung bakit.`, `If the numbers were different, would your method still work? Explain why.`)
        : t(`Paano mo nakuha ang ${shown}? Ilarawan ang mga hakbang mo.`, `How did you get ${shown}? Describe your steps.`);
      return reply({
        responseType: "FEEDBACK",
        message: prefix + t(
          `Tama ang sagot mong ${shown}!${explained ? " Salamat sa pagpapaliwanag." : ""} Gusto kong matiyak na naiintindihan mo ang paraan, hindi lang ang sagot.`,
          `Your answer ${shown} is correct!${explained ? " Thank you for explaining." : ""} I want to be sure you understand the method, not just the answer.`
        ),
        guidingQuestion: probe,
        suggestedAction: "TRY_SIMILAR",
        encouragement: t("Mahusay ang pagsisikap mo.", "Nice work."),
        nextStep: t("Ipaliwanag ang paraan mo, o subukan ang susunod na tanong.", "Explain your method, or try the next question."),
      });
    }

    // 4b. A wrong answer: strategy depends on the evidence (how many wrong attempts, same answer or not)
    if (correct === false) {
      const chosen = q.choices?.find((c) => c.id.toLowerCase() === answer.toLowerCase() || norm(c.text) === norm(answer));
      const choiceHint = chosen && q.choiceHints ? q.choiceHints[chosen.id] : undefined;
      const method = genericWrongFeedback(q.incorrectFeedback);
      const exNote = example && !revealsExpectedAnswer(example.problem + " " + example.steps.join(" "), ctx) ? example : null;
      const exText = exNote ? `${exNote.problem}${exNote.steps.length ? " " + exNote.steps.map((s, i) => `${i + 1}) ${s}`).join(" ") : ""}` : "";
      const na = numberOf(answer);
      const ne = numberOf(String(q.expectedAnswer ?? ""));
      const flipped = na !== null && ne !== null && na !== 0 && na === -ne;

      // What the student said alongside the wrong answer decides how the reply opens. Without this the reply
      // ignored "just tell me the answer", "I don't understand" and the student's own explanation.
      const asksAnswer = DIRECT_ANSWER.test(lower);
      const confused = CONFUSED.test(lower) || WANTS_SIMPLER.test(lower);
      const ownWords = query.length >= 8 && !asksAnswer && !confused;
      const lead = asksAnswer
        ? t("Hindi ko ibibigay ang pinal na sagot, dahil mas natututo ka kapag ikaw mismo ang nakakuha nito. ", "I won't give the final answer, because you learn more when you find it yourself. ")
        : confused
        ? t("Ayos lang na hindi pa sigurado. Hatiin natin sa maliliit na hakbang. ", "It's fine not to be sure yet. Let's split this into small steps. ")
        : ownWords
        ? t("Salamat sa paliwanag mo. ", "Thanks for explaining. ")
        : "";

      if (effective === 1) {
        const isMC = Boolean(q.choices && q.choices.length > 0);
        const gq = confused || asksAnswer
          ? t("Ano ang hinihingi ng tanong? Sabihin mo sa sarili mong salita.", "What is the question asking you to find? Say it in your own words.")
          : ownWords && !isMC
          ? rule
            ? t(`Balikan ang tuntunin sa aralin: "${rule}" Alin sa mga hakbang mo ang tumutugma rito?`, `Look at the rule in your lesson: "${rule}" Which of your steps matches it?`)
            : t("Alin sa mga hakbang mo ang sigurado kang tama, at alin ang hindi mo sigurado?", "Which of your steps are you sure about, and which are you unsure of?")
          : choiceHint
          ? t(`Baka ito ang nangyari sa pinili mo: ${choiceHint} Sa tingin mo, tama ba iyon?`, `This might be what happened with your choice: ${choiceHint} Do you think that fits?`)
          : rule
          ? isMC
            ? t(`Balikan ang aralin: "${rule}" Alin sa mga pagpipilian ang tumutugma rito?`, `Look at your lesson: "${rule}" Which of the choices matches this?`)
            : t(`Balikan ang tuntunin sa aralin: "${rule}" Alin sa mga numero sa tanong ang ilalagay mo rito?`, `Look at the rule in your lesson: "${rule}" Which numbers from the question would you put into it?`)
          : isMC
          ? t(`Ano ang dahilan mo sa pagpili ng "${choiceTextOf(q, answer)}"?`, `What was your reason for choosing "${choiceTextOf(q, answer)}"?`)
          : t(`Paano mo nakuha ang ${shown}? Isulat ang mga hakbang mo para makita natin kung saan mag-aayos.`, `How did you get ${shown}? Write your steps so we can see where to adjust.`);
        return reply({
          responseType: "GUIDING_QUESTION",
          message: prefix + lead + (ownWords
            ? t(`Hindi pa tama ang ${shown}, pero malapit tayong makahanap ng dahilan.`, `${shown} is not right yet, but we can find out why.`)
            : t(`Salamat sa pagsubok. Hindi pa tama ang ${shown}, pero malapit tayong makahanap ng dahilan.`, `Thanks for trying. ${shown} is not right yet, but we can find out why.`)),
          guidingQuestion: gq,
          hintLevel: 1,
          detectedIssue: flipped ? "SIGN_ERROR" : "NONE",
          suggestedAction: "RETRY",
          nextStep: t("Subukan ulit pagkatapos ng hakbang na ito.", "Try again after this step."),
        });
      }

      if (effective === 2) {
        const intro = lastTwoSame
          ? t(`Dalawang beses mo nang sinagot ang ${shown}, kaya subukan nating iba ang paraan.`, `You have answered ${shown} twice, so let's try a different way.`)
          : t(`Subukan natin ang mas tiyak na pahiwatig.`, `Let's try a more specific hint.`);
        const body = method
          ? t(` Pahiwatig: ${method}`, ` Hint: ${method}`)
          : choiceHint
          ? t(` Isipin ito: ${choiceHint}`, ` Think about this: ${choiceHint}`)
          : exNote
          ? t(` Tingnan ang halimbawa sa aralin: ${exText}`, ` Look at the lesson example: ${exText}`)
          : rule
          ? t(` Tuntunin sa aralin: "${rule}"`, ` Rule from your lesson: "${rule}"`)
          : "";
        return reply({
          responseType: "HINT",
          message: prefix + lead + intro + body,
          guidingQuestion: t("Gamit iyan, ano ang una mong gagawin sa mga numero ng tanong?", "Using that, what is the first thing you would do with the numbers in the question?"),
          hintLevel: 2,
          detectedIssue: flipped ? "SIGN_ERROR" : "NONE",
          suggestedAction: lastTwoSame ? "TRY_EASIER" : "RETRY",
          nextStep: t("Subukan ulit gamit ang pahiwatig.", "Try again using the hint."),
        });
      }

      // three or more wrong attempts: explain the method in full, still without the final result
      const parts: string[] = [];
      if (method) parts.push(method);
      if (rule && !method) parts.push(`"${rule}"`);
      if (exNote) parts.push(t(`Halimbawa sa aralin: ${exText}`, `Lesson example: ${exText}`));
      return reply({
        responseType: "EXPLANATION",
        message: prefix + lead + t(
          `Ipaliwanag natin ang paraan nang buo, dahil ilang beses mo nang sinubukan. ${parts.join(" ")}`.trim(),
          `Let's explain the method fully, since you have tried a few times. ${parts.join(" ")}`.trim()
        ),
        guidingQuestion: t("Gamitin ang parehong mga hakbang sa tanong mo. Ano ang unang hakbang?", "Use the same steps on your question. What is the first step?"),
        hintLevel: 3,
        detectedIssue: flipped ? "SIGN_ERROR" : "NONE",
        suggestedAction: wrongCount >= 4 ? "ASK_TEACHER" : "REVIEW_CONCEPT",
        nextStep: ctx.previousLesson
          ? t(
              `Gusto mo bang panoorin ulit ang video ng araling ito, o balikan ang naunang aralin, "${ctx.previousLesson.title}", para ulitin? Kung nahihirapan ka pa rin, itanong ito sa guro mo.`,
              `Would you like to watch this lesson's video again, or go back to the previous lesson, "${ctx.previousLesson.title}", to relearn it? If you are still stuck, ask your teacher.`
            )
          : t("Kung nahihirapan ka pa rin, itanong ito sa guro mo.", "If you are still stuck, ask your teacher."),
        encouragement: t("Ang pagtitiyaga mo ang magdadala sa iyo roon.", "Your persistence will get you there."),
      });
    }

    // 4c. A question is open but there is no answer to judge yet
    if (DIRECT_ANSWER.test(lower)) {
      return reply({
        responseType: "GUIDING_QUESTION",
        message: prefix + t("Hindi ko ibibigay agad ang sagot, pero tutulungan kitang makuha ito mismo.", "I won't give the answer straight away, but I will help you get it yourself."),
        guidingQuestion: rule
          ? t(`Tingnan ang tuntunin sa aralin: "${rule}" Alin sa mga numero sa tanong ang ilalagay mo rito?`, `Look at the rule in your lesson: "${rule}" Which numbers in the question would you put into it?`)
          : t("Ano ang hinihingi ng tanong? Sabihin mo sa sarili mong salita.", "What is the question asking you to find? Say it in your own words."),
        suggestedAction: "RETRY",
      });
    }
    if (q.choices && q.choices.length > 0) {
      const ord = ordinalChoice(lower);
      if (ord !== null && q.choices[ord]) {
        return reply({
          responseType: "CLARIFICATION",
          message: prefix + t(
            `Ang ${["una", "pangalawa", "pangatlo", "pang-apat"][ord]} ay "${q.choices[ord].text}". Iyon ba ang ibig mong sabihin?`,
            `The ${["first", "second", "third", "fourth"][ord]} option is "${q.choices[ord].text}". Is that the one you mean?`
          ),
          guidingQuestion: t("Kung oo, bakit mo ito pinili?", "If yes, why did you choose it?"),
          suggestedAction: "RETRY",
        });
      }
      if (/(baka|maybe|siguro|i think|parang|not sure|hindi.{0,6}sure|di.{0,6}sure)/i.test(lower)) {
        return reply({
          responseType: "CLARIFICATION",
          message: prefix + t("Salamat sa pagsubok. Para tama ang usapan natin, sabihin mo kung aling pagpipilian ang ibig mong sabihin.", "Thanks for trying. So we are talking about the same thing, tell me which option you mean."),
          guidingQuestion: t("Alin ang pinili mo, at ano ang dahilan mo?", "Which one did you pick, and what is your reason?"),
          suggestedAction: "RETRY",
        });
      }
    }
    if (CONFUSED.test(lower) || WANTS_SIMPLER.test(lower)) {
      return reply({
        responseType: "GUIDING_QUESTION",
        message: prefix + t("Ayos lang na hindi pa sigurado. Maghiwa-hiwalay tayo sa maliliit na hakbang.", "It's fine not to be sure yet. Let's split this into small steps."),
        guidingQuestion: rule
          ? t(`May tuntunin sa aralin: "${rule}" Ano ang hinihingi ng tanong, sa sarili mong salita?`, `Your lesson has this rule: "${rule}" What is the question asking, in your own words?`)
          : t("Ano ang hinihingi ng tanong? Sabihin mo sa sarili mong salita.", "What is the question asking you to find? Say it in your own words."),
        suggestedAction: "TRY_EASIER",
      });
    }
    if (rule && /(formula|tuntunin|nakalimutan|forgot|hindi ko matandaan|di ko matandaan|n minus|incomplete)/i.test(lower)) {
      return reply({
        responseType: "GUIDING_QUESTION",
        message: prefix + t(`Magandang simula ang naalala mo. Narito ang tuntunin sa aralin mo: "${rule}"`, `What you remembered is a good start. Here is the rule from your lesson: "${rule}"`),
        guidingQuestion: t("Ilapat ito sa mga numero ng tanong. Ano ang makukuha mo sa unang hakbang?", "Apply it to the numbers in the question. What do you get in the first step?"),
        suggestedAction: "RETRY",
      });
    }
    return reply({
      responseType: "GUIDING_QUESTION",
      message: prefix + t("Subukan mo muna. Hindi baleng mali, doon tayo magsisimula.", "Give it a try first. It's okay to be wrong, that's where we start."),
      guidingQuestion: rule
        ? t(`Ano ang una mong gagawin? Pahiwatig mula sa aralin: "${rule}"`, `What would you do first? A hint from your lesson: "${rule}"`)
        : t("Ano ang unang hakbang na gagawin mo sa tanong na ito?", "What is the first step you would take on this question?"),
      suggestedAction: "RETRY",
    });
  }

  // 5. A lesson is open but no question
  if (answer && !q) {
    return reply({
      responseType: "CLARIFICATION",
      message: prefix + t(`Nakita kong ${shown} ang sagot mo, pero hindi ko makita kung para saan itong tanong.`, `I see your answer is ${shown}, but I can't see which question it is for.`),
      guidingQuestion: t("Alin sa mga tanong ang sinasagot mo? Isulat ang tanong.", "Which question are you answering? Type the question."),
    });
  }
  if (WANTS_EXAMPLE.test(lower) && example) {
    return reply({
      responseType: "EXAMPLE",
      message: prefix + t(`Narito ang halimbawa mula sa aralin mo: ${example.problem}${example.steps.length ? " " + example.steps.map((s, i) => `${i + 1}) ${s}`).join(" ") : ""}`, `Here is an example from your lesson: ${example.problem}${example.steps.length ? " " + example.steps.map((s, i) => `${i + 1}) ${s}`).join(" ") : ""}`),
      guidingQuestion: t("Alin sa mga hakbang na ito ang pinakamahirap para sa iyo?", "Which of these steps is hardest for you?"),
      suggestedAction: "TRY_SIMILAR",
    });
  }
  const objective = ctx.groundedLesson?.learningObjectives?.[0];
  const intro = ctx.groundedLesson?.contentBlocks.find((b) => b.type === "TEXT");
  const firstSentence = intro ? clip(squash(intro.content).split(/(?<=[.!?])\s/)[0] || "", 240) : "";
  return reply({
    responseType: "GUIDING_QUESTION",
    message: prefix + (firstSentence
      ? t(`Mula sa aralin mo: ${firstSentence}`, `From your lesson: ${firstSentence}`)
      : t(`Nasa aralin tayo na ${lessonTitle}.`, `We are in the lesson ${lessonTitle}.`)),
    guidingQuestion: objective
      ? t(`Sa sarili mong salita, ano ang ibig sabihin ng: "${objective}"?`, `In your own words, what does this mean: "${objective}"?`)
      : t("Aling bahagi ng aralin ang gusto mong pag-usapan?", "Which part of the lesson would you like to talk about?"),
    suggestedAction: CONFUSED.test(lower) ? "TRY_EASIER" : "CONTINUE_LESSON",
  });
}
