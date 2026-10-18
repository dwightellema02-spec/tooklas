// Phase 7: AI Output Validation & Sanitization

import type {
  AITutorContext,
  StructuredTutorResponse,
  AITutorMessageType,
  StructuredMistakeAnalysis,
  MistakeCategoryType,
} from "./types";
import { isFilipinoText } from "../voice/voice-utils";
import { isIntegerContext, revealsExpectedAnswer, socraticResponse } from "./socratic-engine";
import { parseModelJson } from "./json-repair";

const VALID_ISSUES = ["SIGN_ERROR", "CALCULATION_ERROR", "CONCEPTUAL_MISUNDERSTANDING", "PREREQUISITE_GAP", "CONFUSION", "NONE"];
const VALID_ACTIONS = ["CONTINUE_LESSON", "TRY_SIMILAR", "TRY_EASIER", "TRY_HARDER", "REVIEW_CONCEPT", "REVIEW_PREREQUISITE", "PRACTICE", "RETRY", "ASK_TEACHER"];

const VALID_RESPONSE_TYPES: AITutorMessageType[] = [
  "QUESTION",
  "HINT",
  "GUIDING_QUESTION",
  "EXPLANATION",
  "EXAMPLE",
  "FEEDBACK",
  "CLARIFICATION",
  "REDIRECT",
];

// Patterns that indicate potential prompt injection leakage or system internal echoes
const FORBIDDEN_LEAK_PATTERNS = [
  /AI_API_KEY/i,
  /GEMINI_API_KEY/i,
  /system\s*prompt/i,
  /internal\s*instructions/i,
  /passwordHash/i,
  /DATABASE_URL/i,
];

/**
 * Checks a model reply before a student sees it. Besides cleaning it up, it refuses any reply that states the
 * final answer of a question the student has not answered correctly, and replaces it with a safe guiding reply.
 */
export function validateTutorOutput(rawText: string, context: AITutorContext): StructuredTutorResponse {
  const result = validateTutorOutputCore(rawText, context);
  const everything = [result.message, result.guidingQuestion, result.nextStep, result.encouragement].filter(Boolean).join(" ");
  if (revealsExpectedAnswer(everything, context)) {
    console.warn("Tutor reply withheld: it stated the final answer of an unanswered question.");
    return generateFallbackTutorResponse(context, { avoidAnswer: true, reason: "revealed_answer" });
  }
  return result;
}

function validateTutorOutputCore(rawText: string, context: AITutorContext): StructuredTutorResponse {
  if (!rawText || typeof rawText !== "string" || rawText.trim().length === 0) {
    return generateFallbackTutorResponse(context, { reason: "empty_reply" });
  }

  // 1. Check for sensitive pattern leakage
  for (const pattern of FORBIDDEN_LEAK_PATTERNS) {
    if (pattern.test(rawText)) {
      return {
        responseType: "REDIRECT",
        message: "Let's focus on your mathematics lesson and work through the problem step by step.",
        guidingQuestion: "What is the first step you should take here?",
        hintLevel: 1,
        encouragement: "Let's keep going!",
      };
    }
  }

  // 2. Extract JSON payload
  let jsonString = rawText.trim();
  const jsonBlockMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonBlockMatch && jsonBlockMatch[1]) {
    jsonString = jsonBlockMatch[1].trim();
  }

  // Also try finding the outermost { ... }
  const firstBrace = jsonString.indexOf("{");
  const lastBrace = jsonString.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    jsonString = jsonString.substring(firstBrace, lastBrace + 1);
  }

  try {
    // Repairs unescaped LaTeX backslashes in JSON strings (e.g. \frac, \text, \times, \dots), including the commands
    // that JSON would otherwise read as a tab, a form feed or a newline.
    const parsed: any = parseModelJson(jsonString);
    if (parsed === null) throw new Error("not valid JSON");

    if (parsed && typeof parsed === "object") {
      let responseType: AITutorMessageType = "HINT";
      if (parsed.responseType && VALID_RESPONSE_TYPES.includes(parsed.responseType as AITutorMessageType)) {
        responseType = parsed.responseType as AITutorMessageType;
      }

      let message = "";
      if (typeof parsed.message === "string" && parsed.message.trim().length > 0) {
        message = sanitizeMessage(parsed.message.trim());
      } else {
        message = context.requestedLanguage === "fil"
          ? "Balikan natin ang konseptong ito nang magkasama, hakbang-hakbang."
          : "Let's review this concept together step by step.";
      }

      const guidingQuestion =
        typeof parsed.guidingQuestion === "string" && parsed.guidingQuestion.trim().length > 0
          ? sanitizeMessage(parsed.guidingQuestion.trim())
          : undefined;

      const hintLevel =
        typeof parsed.hintLevel === "number" && Number.isFinite(parsed.hintLevel) ? Math.min(3, Math.max(1, Math.round(parsed.hintLevel))) : 1;
      const encouragement =
        typeof parsed.encouragement === "string"
          ? sanitizeMessage(parsed.encouragement.trim())
          : (context.requestedLanguage === "fil" ? "Kaya mo iyan!" : "You can do this!");
      const nextStep = typeof parsed.nextStep === "string" ? sanitizeMessage(parsed.nextStep.trim()) : undefined;
      const issueRaw = typeof parsed.detectedIssue === "string" ? parsed.detectedIssue.trim().toUpperCase() : "";
      const actionRaw = typeof parsed.suggestedAction === "string" ? parsed.suggestedAction.trim().toUpperCase() : "";
      const detectedIssue = VALID_ISSUES.includes(issueRaw) ? issueRaw : undefined;
      const suggestedAction = VALID_ACTIONS.includes(actionRaw) ? actionRaw : undefined;
      const sourceGrounding = Array.isArray(parsed.sourceGrounding)
        ? parsed.sourceGrounding.map((s: any) => String(s).slice(0, 100))
        : undefined;

      // If Tagalog/Filipino was requested, verify that the message is in Filipino; if not, use localized fallback
      if (context.requestedLanguage === "fil" && !isFilipinoText(message)) {
        return generateFallbackTutorResponse(context, { reason: "wrong_language" });
      }

      // If English was requested, verify that the message is in English; if it is Filipino, use localized fallback
      if (context.requestedLanguage === "en" && isFilipinoText(message)) {
        return generateFallbackTutorResponse(context, { reason: "wrong_language" });
      }

      return {
        responseType,
        message,
        guidingQuestion,
        hintLevel,
        encouragement,
        nextStep,
        detectedIssue,
        suggestedAction,
        sourceGrounding,
      };
    }
  } catch {
    // If regex can extract message from partially formatted or truncated JSON:
    const messageMatch = rawText.match(/["']message["']\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
    if (messageMatch && messageMatch[1] && messageMatch[1].trim().length > 5) {
      const extractedMessage = sanitizeMessage(messageMatch[1].replace(/\\"/g, '"').trim());
      if (
        (context.requestedLanguage === "fil" && isFilipinoText(extractedMessage)) ||
        (context.requestedLanguage === "en" && !isFilipinoText(extractedMessage))
      ) {
        return {
          responseType: "HINT",
          message: extractedMessage,
          hintLevel: 1,
          encouragement: context.requestedLanguage === "fil" ? "Kaya mo iyan!" : "Keep trying!",
        };
      }
    }

    // JSON parsing failed; only use rawText if it looks like genuine student-facing natural language
    const isSchemaEcho = /responseType|JSON output|guidingQuestion|hintLevel|sourceGrounding/i.test(rawText);
    if (rawText.length > 10 && rawText.length < 1500 && !rawText.includes("{") && !rawText.includes("```") && !isSchemaEcho) {
      if (
        (context.requestedLanguage === "fil" && isFilipinoText(rawText)) ||
        (context.requestedLanguage === "en" && !isFilipinoText(rawText))
      ) {
        return {
          responseType: "HINT",
          message: sanitizeMessage(rawText.trim()),
          hintLevel: 1,
          encouragement: context.requestedLanguage === "fil" ? "Ipagpatuloy ang pagsusumikap!" : "Keep trying!",
        };
      }
    }
  }

  return generateFallbackTutorResponse(context, { reason: "unreadable_reply" });
}

function sanitizeMessage(text: string): string {
  // Strip control characters, keep standard printable text and common markdown/math
  return text
    .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F]/g, "")
    .slice(0, 2000); // Cost/DoS safeguard: limit single message length
}

/** The built-in reply used when a model reply is missing, unreadable, in the wrong language or gave the answer away. */
export function generateFallbackTutorResponse(context: AITutorContext, opts: { avoidAnswer?: boolean; reason?: string } = {}): StructuredTutorResponse {
  return { ...fallbackCore(context), fallbackReason: opts.reason || "fallback" };
}

function fallbackCore(context: AITutorContext): StructuredTutorResponse {
  // Outside the integer lessons, answer from the lesson, the question and the student's work instead of
  // number-line text that has nothing to do with the topic.
  if (!isIntegerContext(context)) {
    const r = socraticResponse(context);
    return {
      responseType: r.responseType,
      message: r.message,
      guidingQuestion: r.guidingQuestion,
      hintLevel: r.hintLevel,
      encouragement: r.encouragement,
      nextStep: r.nextStep,
      detectedIssue: r.detectedIssue,
      suggestedAction: r.suggestedAction,
      sourceGrounding: r.sourceGrounding,
    };
  }
  const isFilipino = context.requestedLanguage === "fil";
  const targetSkill = context.skill?.title || context.lesson?.title || (isFilipino ? "araling ito" : "this math concept");

  if (isFilipino) {
    if (context.helpLevel === "LEVEL_1_HINT") {
      return {
        responseType: "HINT",
        message: `Maglaan ng sandali upang balikan ang tuntunin para sa ${targetSkill}. Tandaan na bawat positibo at negatibong numero ay may tiyak na posisyon sa number line.`,
        guidingQuestion: "Saang direksyon sa number line ang kumakatawan sa mas malalaking halaga?",
        hintLevel: 1,
        encouragement: "Gawin natin ito nang dahan-dahan, isang hakbang sa bawat pagkakataon!",
        nextStep: "Tukuyin muna ang mga sign ng bawat numero.",
      };
    }

    if (context.helpLevel === "LEVEL_2_HINT") {
      return {
        responseType: "HINT",
        message: `Sa isang karaniwang horizontal number line, ang mga numerong nasa bandang kanan ay laging mas malaki kaysa sa mga numerong nasa kaliwa. Para sa mga negatibong numero, ang mas malapit sa zero ang may mas malaking halaga.`,
        guidingQuestion: "Sa dalawang numero, alin ang mas malapit sa zero o mas nasa bandang kanan?",
        hintLevel: 2,
        encouragement: "Malapit mo na itong makuha!",
      };
    }

    if (context.helpLevel === "GUIDING_QUESTION") {
      return {
        responseType: "GUIDING_QUESTION",
        message: `Himayin natin ito. Ano ang mga sign ng mga numerong kasama sa tanong na ito?`,
        guidingQuestion: "Pareho ba silang positibo, parehong negatibo, o magkaiba ang sign?",
        hintLevel: 1,
        encouragement: "Pagtuunan muna ng pansin ang mga sign!",
      };
    }

    if (context.helpLevel === "CONCEPT_EXPLANATION") {
      return {
        responseType: "EXPLANATION",
        message: `Sa Grade 7 Mathematics, ang integers ay kinabibilangan ng lahat ng positibong buong numero, zero, at negatibong buong numero ($... -3, -2, -1, 0, 1, 2, 3 ...$). Kapag naghahambing ng integers, ang anumang positibong numero ay laging mas malaki kaysa sa anumang negatibong numero. Sa pagitan ng dalawang negatibong numero, ang may mas maliit na absolute value ang mas malaki.`,
        guidingQuestion: "Paano magagamit ang tuntuning ito sa mga numero sa iyong tanong?",
        hintLevel: 2,
        encouragement: "Ang pagbabalik-aral sa konsepto ay nagpapatibay ng iyong kaalaman!",
      };
    }

    return {
      responseType: "HINT",
      message: `Tingnan natin ito nang hakbang-hakbang. Anong operasyon o katangian ang sa tingin mo ay angkop gamitin para sa ${targetSkill}?`,
      guidingQuestion: "Masasabi mo ba kung ano ang eksaktong ipinapahanap ng tanong?",
      hintLevel: 1,
      encouragement: "Kaya mo ito — lutasin natin ito nang magkasama!",
    };
  }

  if (context.helpLevel === "LEVEL_1_HINT") {
    return {
      responseType: "HINT",
      message: `Take a moment to review the rule for ${targetSkill}. Remember that every positive and negative number has a position on the number line.`,
      guidingQuestion: "Which direction on the number line represents greater values?",
      hintLevel: 1,
      encouragement: "Take it one step at a time!",
      nextStep: "Identify the signs of the numbers first.",
    };
  }

  if (context.helpLevel === "LEVEL_2_HINT") {
    return {
      responseType: "HINT",
      message: `On a standard number line, numbers farther to the right are always greater than numbers to the left. For negative numbers, numbers closer to zero have a larger value.`,
      guidingQuestion: "Between the two numbers, which one is closer to zero or farther to the right?",
      hintLevel: 2,
      encouragement: "You're getting closer!",
    };
  }

  if (context.helpLevel === "GUIDING_QUESTION") {
    return {
      responseType: "GUIDING_QUESTION",
      message: `Let's break this down. What are the signs of the numbers involved in this problem?`,
      guidingQuestion: "Are both numbers positive, both negative, or different signs?",
      hintLevel: 1,
      encouragement: "Focus on the signs first!",
    };
  }

  if (context.helpLevel === "CONCEPT_EXPLANATION") {
    return {
      responseType: "EXPLANATION",
      message: `In Grade 7 Mathematics, integers include all positive whole numbers, zero, and negative whole numbers ($... -3, -2, -1, 0, 1, 2, 3 ...$). When comparing integers, any positive number is greater than any negative number. Between two negative numbers, the one with the smaller absolute value is greater.`,
      guidingQuestion: "How does this rule apply to the numbers in your problem?",
      hintLevel: 2,
      encouragement: "Reviewing the concept helps build strong fundamentals!",
    };
  }

  return {
    responseType: "HINT",
    message: `Let's look at this step by step. What operation or property do you think applies here for ${targetSkill}?`,
    guidingQuestion: "Can you identify what the question is asking you to find?",
    hintLevel: 1,
    encouragement: "You're doing great — let's solve it together!",
  };
}

// -------------------------------------------------------------
// PHASE 8: MISTAKE ANALYSIS VALIDATOR
// -------------------------------------------------------------

const VALID_MISTAKE_CATEGORIES: MistakeCategoryType[] = [
  "CALCULATION_ERROR",
  "CONCEPTUAL_MISUNDERSTANDING",
  "PREREQUISITE_GAP",
  "APPLICATION_DIFFICULTY",
  "SIGN_ERROR",
  "PROCEDURAL_ERROR",
  "READING_OR_INTERPRETATION_ERROR",
  "INCONSISTENT_PERFORMANCE",
  "POSSIBLE_CARELESS_ERROR",
  "QUESTION_TYPE_DIFFICULTY",
  "UNKNOWN",
];

export function validateMistakeAnalysisOutput(
  rawText: string,
  validAttemptIds: string[],
  fallback: StructuredMistakeAnalysis
): StructuredMistakeAnalysis {
  if (!rawText || typeof rawText !== "string" || rawText.trim().length === 0) {
    return fallback;
  }

  // 1. Check for sensitive pattern leakage
  for (const pattern of FORBIDDEN_LEAK_PATTERNS) {
    if (pattern.test(rawText)) {
      return fallback;
    }
  }

  // 2. Extract JSON payload
  let jsonString = rawText.trim();
  const jsonBlockMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonBlockMatch && jsonBlockMatch[1]) {
    jsonString = jsonBlockMatch[1].trim();
  }

  const firstBrace = jsonString.indexOf("{");
  const lastBrace = jsonString.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    jsonString = jsonString.substring(firstBrace, lastBrace + 1);
  }

  try {
    const parsed = JSON.parse(jsonString);

    if (parsed && typeof parsed === "object") {
      // Validate category
      let category: MistakeCategoryType = fallback.category;
      if (
        parsed.category &&
        VALID_MISTAKE_CATEGORIES.includes(parsed.category as MistakeCategoryType)
      ) {
        category = parsed.category as MistakeCategoryType;
      }

      // Validate & sanitize observation
      const observation =
        typeof parsed.observation === "string" && parsed.observation.trim().length > 0
          ? sanitizeMessage(parsed.observation.trim())
          : fallback.observation;

      // Validate & sanitize pattern
      const pattern =
        typeof parsed.pattern === "string" && parsed.pattern.trim().length > 0
          ? sanitizeMessage(parsed.pattern.trim())
          : fallback.pattern;

      // Validate & sanitize possibleCause
      const possibleCause =
        typeof parsed.possibleCause === "string" && parsed.possibleCause.trim().length > 0
          ? sanitizeMessage(parsed.possibleCause.trim())
          : fallback.possibleCause;

      // Validate confidence (must be between 0.0 and 1.0)
      let confidence = fallback.confidence;
      if (typeof parsed.confidence === "number" && !isNaN(parsed.confidence)) {
        confidence = Math.max(0.0, Math.min(1.0, Number(parsed.confidence.toFixed(2))));
      }

      // Validate & sanitize recommendation
      const recommendation =
        typeof parsed.recommendation === "string" && parsed.recommendation.trim().length > 0
          ? sanitizeMessage(parsed.recommendation.trim())
          : fallback.recommendation;

      // VALIDATE EVIDENCE: AI MUST NOT INVENT ATTEMPTS
      // Only retain attempt IDs that actually exist in the supplied validAttemptIds set
      const validIdSet = new Set(validAttemptIds);
      let evidenceAttemptIds: string[] = [];

      if (Array.isArray(parsed.evidenceAttemptIds)) {
        evidenceAttemptIds = parsed.evidenceAttemptIds
          .map((id: any) => String(id).trim())
          .filter((id: string) => validIdSet.has(id));
      }

      // If AI didn't return any valid IDs, default to fallback's valid IDs
      if (evidenceAttemptIds.length === 0) {
        evidenceAttemptIds = fallback.evidenceAttemptIds;
      }

      return {
        category,
        observation,
        pattern,
        possibleCause,
        confidence,
        recommendation,
        evidenceAttemptIds,
      };
    }
  } catch {
    // JSON parse failed, use safe fallback
  }

  return fallback;
}

