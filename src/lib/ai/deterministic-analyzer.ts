// Phase 8: Deterministic Performance & Mistake Pre-Analyzer

import type {
  QuestionAttemptDetail,
  DeterministicAnalysisResult,
  StructuredMistakeAnalysis,
  MistakeCategoryType,
} from "./types";

export function runDeterministicAnalysis(
  attempts: QuestionAttemptDetail[],
  prerequisiteData: Array<{
    skillId: string;
    title: string;
    accuracy: number;
    totalAttempts: number;
  }> = []
): DeterministicAnalysisResult {
  const totalAttempts = attempts.length;
  if (totalAttempts === 0) {
    return {
      totalAttempts: 0,
      correctCount: 0,
      incorrectCount: 0,
      accuracyPercentage: 0,
      recentTrend: "STABLE",
      questionTypeDistribution: {},
      difficultyDistribution: {},
      hintUsageCount: 0,
      retryCount: 0,
      commonWrongAnswers: [],
      isolatedError: false,
      signErrorDetected: false,
      comparisonErrorDetected: false,
      prerequisiteGaps: [],
      strengthDetected: false,
    };
  }

  let correctCount = 0;
  let hintUsageCount = 0;
  let retryCount = 0;
  const questionTypeDist: Record<string, { total: number; correct: number; incorrect: number }> = {};
  const difficultyDist: Record<string, { total: number; correct: number; incorrect: number }> = {};
  const wrongAnswerMap = new Map<string, number>();

  // A sign error is only reported from the numbers themselves: the wrong answer is the exact opposite of the right
  // one, and it happened more than once. A word like "sign" in the question text (for example "without the %
  // sign") says nothing about the student's mistake.
  let signFlips = 0;
  let comparisonErrors = 0;
  const correctOf = (att: QuestionAttemptDetail): number | null => {
    try {
      const d = att.question.questionData ? JSON.parse(att.question.questionData) : null;
      const n = d && d.correctAnswer !== undefined ? parseFloat(String(d.correctAnswer)) : NaN;
      return Number.isFinite(n) ? n : null;
    } catch {
      return null;
    }
  };

  for (const att of attempts) {
    if (att.isCorrect) {
      correctCount++;
    } else {
      const ansKey = String(att.answer || "").trim();
      if (ansKey) {
        wrongAnswerMap.set(ansKey, (wrongAnswerMap.get(ansKey) || 0) + 1);
      }

      const promptLower = (att.question.prompt || "").toLowerCase();
      const given = parseFloat(String(att.answer || "").replace(/[^0-9.\-]/g, ""));
      const right = correctOf(att);
      if (right !== null && Number.isFinite(given) && right !== 0 && given === -right) signFlips++;

      // Ordering or comparing signed numbers: only when the question really contains a negative number.
      if (/(greater|less|compare|order|ascending|descending)/.test(promptLower) && /(^|[\s(])-\d/.test(att.question.prompt || "")) {
        comparisonErrors++;
      }
    }

    if (att.hintUsed) {
      hintUsageCount++;
    }

    if (att.attemptNumber > 1) {
      retryCount++;
    }

    // Question Type Breakdown
    const qType = att.question.type || "UNKNOWN";
    if (!questionTypeDist[qType]) {
      questionTypeDist[qType] = { total: 0, correct: 0, incorrect: 0 };
    }
    questionTypeDist[qType].total++;
    if (att.isCorrect) questionTypeDist[qType].correct++;
    else questionTypeDist[qType].incorrect++;

    // Difficulty Breakdown
    const diff = att.question.difficulty || "MEDIUM";
    if (!difficultyDist[diff]) {
      difficultyDist[diff] = { total: 0, correct: 0, incorrect: 0 };
    }
    difficultyDist[diff].total++;
    if (att.isCorrect) difficultyDist[diff].correct++;
    else difficultyDist[diff].incorrect++;
  }

  const signErrorDetected = signFlips >= 2;
  const comparisonErrorDetected = comparisonErrors >= 1;
  const incorrectCount = totalAttempts - correctCount;
  const accuracyPercentage = Math.round((correctCount / totalAttempts) * 100);

  // Compute trend (oldest half vs newest half)
  let recentTrend: "IMPROVING" | "DECLINING" | "STABLE" | "INCONSISTENT" = "STABLE";
  if (totalAttempts >= 4) {
    const half = Math.floor(totalAttempts / 2);
    const older = attempts.slice(0, half);
    const newer = attempts.slice(half);

    const olderAcc = Math.round((older.filter((a) => a.isCorrect).length / older.length) * 100);
    const newerAcc = Math.round((newer.filter((a) => a.isCorrect).length / newer.length) * 100);

    if (newerAcc - olderAcc >= 25) {
      recentTrend = "IMPROVING";
    } else if (olderAcc - newerAcc >= 25) {
      recentTrend = "DECLINING";
    } else {
      // Check for alternating oscillations
      let switches = 0;
      for (let i = 1; i < attempts.length; i++) {
        if (attempts[i].isCorrect !== attempts[i - 1].isCorrect) switches++;
      }
      if (switches >= Math.floor(totalAttempts * 0.7)) {
        recentTrend = "INCONSISTENT";
      } else {
        recentTrend = "STABLE";
      }
    }
  }

  // Common wrong answers list
  const commonWrongAnswers = Array.from(wrongAnswerMap.entries())
    .map(([answer, frequency]) => ({ answer, frequency }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 5);

  const isolatedError = totalAttempts >= 4 && incorrectCount === 1;
  const strengthDetected = totalAttempts >= 4 && accuracyPercentage >= 85;

  const prerequisiteGaps = prerequisiteData
    .filter((p) => p.totalAttempts >= 3 && p.accuracy < 60)
    .map((p) => ({
      prerequisiteSkillId: p.skillId,
      title: p.title,
      accuracy: p.accuracy,
      totalAttempts: p.totalAttempts,
    }));

  return {
    totalAttempts,
    correctCount,
    incorrectCount,
    accuracyPercentage,
    recentTrend,
    questionTypeDistribution: questionTypeDist,
    difficultyDistribution: difficultyDist,
    hintUsageCount,
    retryCount,
    commonWrongAnswers,
    isolatedError,
    signErrorDetected,
    comparisonErrorDetected,
    prerequisiteGaps,
    strengthDetected,
  };
}

/**
 * Deterministic Pedagogical Inference Fallback
 * Guarantees zero hallucinations and authentic MATATAG Grade 7 insights
 */
export function generateDeterministicMistakeCategory(
  result: DeterministicAnalysisResult,
  attempts: QuestionAttemptDetail[],
  studentWork?: { arithmeticSlips: Array<{ expression: string; claimed: number; actual: number }> }
): StructuredMistakeAnalysis {
  const incorrectAttempts = attempts.filter((a) => !a.isCorrect);
  const evidenceAttemptIds = incorrectAttempts.map((a) => a.id);
  // Confidence grows with the amount of evidence and is never close to certain: these are hypotheses.
  const scaled = (base: number, n: number) => Math.min(0.85, Math.round((base + 0.08 * Math.max(0, n - 2)) * 100) / 100);

  // 0. The student's own written steps contain an equation that does not compute: this is observed, not inferred.
  if (studentWork && studentWork.arithmeticSlips.length > 0) {
    const s = studentWork.arithmeticSlips[0];
    return {
      category: "CALCULATION_ERROR",
      observation: `In their own written steps the student wrote "${s.expression} = ${s.claimed}", which works out to ${s.actual}.`,
      pattern: "A step in the student's written work does not compute, so the final answer built on it may be off.",
      possibleCause: "A slip in arithmetic. The method itself may still be right; the student's explanation would show.",
      confidence: 0.75,
      recommendation: "Ask the student to recompute that step, then retry the question. Diagnostic question: what do you get for that step now?",
      evidenceAttemptIds,
    };
  }

  // 1. High Accuracy / Isolated error
  if (result.totalAttempts >= 3 && result.accuracyPercentage >= 85 && result.isolatedError) {
    return {
      category: "POSSIBLE_CARELESS_ERROR",
      observation: `Student answered ${result.correctCount} of ${result.totalAttempts} questions correctly (${result.accuracyPercentage}% accuracy).`,
      pattern: "An isolated incorrect answer appeared amidst a sequence of otherwise accurate responses.",
      possibleCause: "Likely a minor input slip or momentary oversight rather than a conceptual weakness.",
      confidence: 0.78,
      recommendation: "Review the single missed question and double-check inputs before final submission.",
      evidenceAttemptIds,
    };
  }

  // 2. Prerequisite Gap Identified
  if (result.prerequisiteGaps.length > 0 && result.accuracyPercentage < 65) {
    const gap = result.prerequisiteGaps[0];
    return {
      category: "PREREQUISITE_GAP",
      observation: `Student scored ${result.accuracyPercentage}% on the current skill and had an average accuracy of ${gap.accuracy}% on prerequisite skill "${gap.title}".`,
      pattern: `Performance appears hindered by foundational concepts from prerequisite skill "${gap.title}".`,
      possibleCause: "Incomplete mastery of prerequisite concepts before attempting this standard.",
      confidence: 0.85,
      recommendation: `Spend 10-15 minutes revisiting ${gap.title} to build a firmer foundation.`,
      evidenceAttemptIds,
    };
  }

  // 3. Ordering or comparing signed numbers (the question itself contains negative numbers)
  if (result.comparisonErrorDetected && incorrectAttempts.length >= 2) {
    return {
      category: "CONCEPTUAL_MISUNDERSTANDING",
      observation: `Student made ${incorrectAttempts.length} errors on questions that ask to order or compare negative numbers.`,
      pattern: "The wrong answers are consistent with treating a larger-looking negative number as the greater one.",
      possibleCause: "Possibly applying positive whole-number size rules to negative numbers. This is a hypothesis: ask the student to explain how they compared.",
      confidence: scaled(0.6, incorrectAttempts.length),
      recommendation: "Practice placing pairs of negative numbers on a horizontal number line to reinforce that values farther to the right are always greater.",
      evidenceAttemptIds,
    };
  }

  // 4. Sign errors: the wrong answers are exactly the opposite of the correct ones, more than once
  if (result.signErrorDetected && incorrectAttempts.length >= 2) {
    return {
      category: "SIGN_ERROR",
      observation: "In at least two wrong answers the number was right but the sign was reversed.",
      pattern: "The size of the answer was correct while its positive or negative sign was the opposite of the correct one.",
      possibleCause: "Possibly a sign rule applied the wrong way round. A hypothesis: ask the student which rule they used.",
      confidence: scaled(0.6, incorrectAttempts.length),
      recommendation: "Review the two-step rule for adding integers with unlike signs: subtract absolute values and take the sign of the larger magnitude.",
      evidenceAttemptIds,
    };
  }

  // 5. Inconsistent Performance
  if (result.recentTrend === "INCONSISTENT" && result.totalAttempts >= 5) {
    return {
      category: "INCONSISTENT_PERFORMANCE",
      observation: `Performance fluctuated frequently across ${result.totalAttempts} attempts with an overall accuracy of ${result.accuracyPercentage}%.`,
      pattern: "Alternating between correct and incorrect answers on similar difficulty levels.",
      possibleCause: "Partial conceptual grasp where procedural steps are remembered intermittently.",
      confidence: 0.72,
      recommendation: "Try writing out each step on scratch paper to stabilize consistent procedural execution.",
      evidenceAttemptIds,
    };
  }

  // 6. Question Type Difficulty
  for (const [type, stats] of Object.entries(result.questionTypeDistribution)) {
    if (stats.total >= 3 && stats.correct === 0) {
      return {
        category: "QUESTION_TYPE_DIFFICULTY",
        observation: `Student struggled specifically with ${type.replace(/_/g, " ").toLowerCase()} questions (0 of ${stats.total} correct), while overall accuracy across all types was ${result.accuracyPercentage}%.`,
        pattern: `Errors correlate strongly with the ${type.replace(/_/g, " ")} format rather than the general math topic.`,
        possibleCause: `Unfamiliarity with how to format answers for ${type.replace(/_/g, " ")}.`,
        confidence: 0.75,
        recommendation: `Review sample worked examples formatted as ${type.replace(/_/g, " ")}.`,
        evidenceAttemptIds: incorrectAttempts.filter((a) => a.question.type === type).map((a) => a.id),
      };
    }
  }

  // 7. The same wrong answer again and again: a consistent method, not a one-off slip. The system can say that
  // much, but not WHY, so the recommendation is to ask the student to explain.
  const repeated = result.commonWrongAnswers[0];
  if (repeated && repeated.frequency >= 2) {
    return {
      category: "PROCEDURAL_ERROR",
      observation: `The student gave the answer "${repeated.answer}" ${repeated.frequency} times and it was marked incorrect each time.`,
      pattern: "The same wrong answer repeated, which points to a consistent method rather than a one-off slip.",
      possibleCause: "A systematic misunderstanding or a wrong procedure is possible. The answers alone cannot show which.",
      confidence: scaled(0.5, repeated.frequency + 1),
      recommendation: "Ask the student to explain their steps on one of these questions, then walk through a worked example from the lesson. Diagnostic question: how did you get that answer?",
      evidenceAttemptIds,
    };
  }

  // 8. Several wrong answers but nothing that shows why: say so instead of inventing a cause.
  if (incorrectAttempts.length >= 2) {
    return {
      category: "UNKNOWN",
      observation: `Student answered ${result.incorrectCount} of ${result.totalAttempts} questions incorrectly.`,
      pattern: "The wrong answers do not show one clear error pattern.",
      possibleCause: "The cause cannot be told from the answers alone. The student's explanation of their steps is needed.",
      confidence: 0.4,
      recommendation: "Ask the student to explain how they solved one of the questions they missed, and watch for the step where it goes wrong.",
      evidenceAttemptIds,
    };
  }

  // Default / Unknown
  return {
    category: "UNKNOWN",
    observation: `Collected ${result.totalAttempts} attempts with ${result.accuracyPercentage}% accuracy.`,
    pattern: "Insufficient error concentration to establish a decisive learning pattern.",
    possibleCause: "A wider sample of practice attempts is needed to discern clear tendencies.",
    confidence: 0.35,
    recommendation: "Continue practicing additional questions to help Tuklas identify your unique learning patterns.",
    evidenceAttemptIds,
  };
}
