// Phase 8: AI Mistake Analyzer Orchestrator

import { dbService } from "../db";
import { getAIProvider, LocalTutorEngine } from "./provider";
import { runDeterministicAnalysis, generateDeterministicMistakeCategory } from "./deterministic-analyzer";
import { findArithmeticSlips } from "./arithmetic";
import { buildMistakeAnalysisSystemPrompt, buildMistakeAnalysisUserPrompt } from "./prompts";
import { validateMistakeAnalysisOutput } from "./validators";
import type {
  MistakeAnalysisDTO,
  AnalysisTriggerType,
  QuestionAttemptDetail,
} from "./types";

export interface AnalyzeStudentMistakesParams {
  studentId: string;
  skillId?: string | null;
  lessonId?: string | null;
  practiceSessionId?: string | null;
  trigger?: AnalysisTriggerType;
  maxAttempts?: number;
  forceRefresh?: boolean;
}

export class MistakeAnalyzerService {
  /**
   * Main entrypoint for analyzing student mistake patterns
   */
  static async analyzeStudentMistakes(
    params: AnalyzeStudentMistakesParams
  ): Promise<MistakeAnalysisDTO> {
    const {
      studentId,
      skillId,
      lessonId,
      practiceSessionId,
      trigger = "PRACTICE_COMPLETED",
      maxAttempts = 10,
      forceRefresh = false,
    } = params;

    // 1. Collect relevant attempts (capped between 3 and 20 attempts)
    const limit = Math.min(20, Math.max(3, maxAttempts));
    const practiceAttempts: QuestionAttemptDetail[] =
      await dbService.getDetailedAttemptsForStudent({
        studentId,
        skillId,
        lessonId,
        // Analyse the student's recent attempts on the whole skill, not only the session that just ended: a
        // single session usually has one attempt per question, which hid every repeated mistake.
        practiceSessionId: skillId ? undefined : practiceSessionId,
        limit,
      });

    // Checkpoint answers inside the lesson are evidence too (they are not practice attempts and do not count toward
    // mastery). A session-specific analysis stays practice-only.
    const checkpointAttempts: QuestionAttemptDetail[] =
      skillId && !practiceSessionId
        ? ((await dbService.getCheckpointEvidenceForSkill(studentId, skillId, 10).catch(() => [])) as QuestionAttemptDetail[])
        : [];
    const attempts: QuestionAttemptDetail[] = [...practiceAttempts, ...checkpointAttempts].sort(
      (a, b) => new Date(a.submittedAt as any).getTime() - new Date(b.submittedAt as any).getTime()
    );

    // 2a. What the student wrote about their own work (typed to the tutor), and any step in it that does not compute
    const explanations = await dbService
      .getStudentExplanations({ studentId, skillId, lessonId, limit: 12 })
      .catch(() => [] as Array<{ text: string; questionId: string | null; studentAnswer: string | null }>);
    const studentWords = explanations.map((e: { text: string }) => e.text);
    const arithmeticSlips = findArithmeticSlips(studentWords.join(" \n "));

    // 2. Check for insufficient sample size (< 2 attempts). A step the student wrote that provably does not compute
    // is evidence on its own, so it lets the analysis continue.
    if (attempts.length < 2 && arithmeticSlips.length === 0) {
      const emptyFallback = {
        category: "UNKNOWN" as const,
        observation: `Only ${attempts.length} attempt recorded for this skill so far.`,
        pattern: "More practice questions are needed to identify a distinct learning pattern.",
        possibleCause: "Sample size too small for statistical or pedagogical inference.",
        confidence: 0.2,
        recommendation: "Continue practicing additional questions so Tuklas can detect your unique learning style.",
        evidenceAttemptIds: attempts.map((a) => a.id),
      };

      return (await dbService.saveMistakeAnalysis({
        studentId,
        skillId,
        lessonId,
        practiceSessionId,
        category: emptyFallback.category,
        observation: emptyFallback.observation,
        pattern: emptyFallback.pattern,
        possibleCause: emptyFallback.possibleCause,
        confidence: emptyFallback.confidence,
        recommendation: emptyFallback.recommendation,
        evidenceSummary: `Baseline recorded with ${attempts.length} attempts.`,
        trigger,
        analyzerVersion: "1.0",
        metadata: JSON.stringify({ attemptsCount: attempts.length, insufficient: true }),
        evidenceAttemptIds: emptyFallback.evidenceAttemptIds,
      })) as MistakeAnalysisDTO;
    }

    // 3. Prerequisite graph analysis
    let prerequisiteData: Array<{
      skillId: string;
      title: string;
      accuracy: number;
      totalAttempts: number;
    }> = [];

    if (skillId) {
      try {
        prerequisiteData = await dbService.getPrerequisitePerformance(studentId, skillId);
      } catch (e) {
        console.warn("Failed to query prerequisite performance:", e);
      }
    }

    // 5. Deterministic Pre-Analysis (facts, distributions, rule-based indicators)
    const deterministic = runDeterministicAnalysis(attempts, prerequisiteData);
    const deterministicFallback = generateDeterministicMistakeCategory(deterministic, attempts, { arithmeticSlips });

    // 6. Cache check: reuse an earlier analysis only when nothing new has happened since: the newest attempt and the
    // amount of written work must be the same as when it was made. (A time window alone returned stale results.)
    const latestAttemptId = attempts[attempts.length - 1]?.id ?? null;
    if (!forceRefresh && skillId) {
      const existing = await dbService.getLatestMistakeAnalysisForSkill(studentId, skillId);
      if (existing) {
        let meta: any = {};
        try {
          meta = existing.metadata ? JSON.parse(existing.metadata) : {};
        } catch {
          meta = {};
        }
        if (latestAttemptId && meta.latestAttemptId === latestAttemptId && (meta.explanationCount ?? 0) === studentWords.length) {
          const fullExisting = await dbService.getMistakeAnalysisById(existing.id, studentId, "STUDENT");
          if (fullExisting) return fullExisting as MistakeAnalysisDTO;
        }
      }
    }

    // 6. Resolve Skill & Lesson titles for AI grounding
    let skillTitle = "Target Math Skill";
    let lessonTitle = "Lesson Practice";

    if (skillId) {
      const skills = await dbService.getSkills();
      const s = skills.find((item: any) => item.id === skillId);
      if (s) skillTitle = s.title;
    }
    if (lessonId) {
      const l = await dbService.getLessonById(lessonId);
      if (l) lessonTitle = l.title;
    }

    // 7. Invoke AI Provider with strict validation
    const validAttemptIds = attempts.map((a) => a.id);
    let structured = deterministicFallback;

    // Check teacher AI settings
    const settings = await dbService.getTeacherAISettings();
    const canUseAI = settings.aiTutorEnabled !== false;

    if (canUseAI) {
      const provider = getAIProvider();
      const systemPrompt = buildMistakeAnalysisSystemPrompt();
      const userPrompt = buildMistakeAnalysisUserPrompt({
        skillTitle,
        lessonTitle,
        deterministic,
        attempts,
        studentWords,
        arithmeticSlips,
      });

      try {
        const rawResponse = await provider.generateTutorResponse({
          systemPrompt,
          userPrompt,
          maxTokens: 600,
          temperature: 0.2, // Low temperature for factual, analytical consistency
          timeoutMs: 12000,
        });

        structured = validateMistakeAnalysisOutput(
          rawResponse.text,
          validAttemptIds,
          deterministicFallback
        );
      } catch (err) {
        console.warn("AI Mistake Analysis provider failed, using deterministic fallback:", err);
        const fallbackProvider = new LocalTutorEngine();
        try {
          const fallbackRaw = await fallbackProvider.generateTutorResponse({
            systemPrompt,
            userPrompt,
            maxTokens: 500,
          });
          structured = validateMistakeAnalysisOutput(
            fallbackRaw.text,
            validAttemptIds,
            deterministicFallback
          );
        } catch {
          structured = deterministicFallback;
        }
      }
    }

    // 7b. A wrong answer is an observation, not a confirmed misconception. However sure a model sounds, the confidence
    // that is stored is capped by how much evidence there is: few wrong answers, or no explanation from the student,
    // keep it lower. (A step the system verified does not compute is the exception.)
    {
      let cap = 0.85;
      if (deterministic.incorrectCount < 3) cap = Math.min(cap, 0.7);
      if (studentWords.length === 0) cap = Math.min(cap, 0.75);
      const verified = arithmeticSlips.length > 0 && structured.category === "CALCULATION_ERROR";
      const limit = verified ? 0.85 : cap;
      if (structured.confidence > limit) structured = { ...structured, confidence: limit };
    }

    // 8. Persist analysis & evidence links
    const saved = await dbService.saveMistakeAnalysis({
      studentId,
      skillId,
      lessonId,
      practiceSessionId,
      category: structured.category,
      observation: structured.observation,
      pattern: structured.pattern,
      possibleCause: structured.possibleCause,
      confidence: structured.confidence,
      recommendation: structured.recommendation,
      evidenceSummary: `Analyzed ${attempts.length} attempts (${deterministic.correctCount} correct, ${deterministic.incorrectCount} incorrect, ${deterministic.accuracyPercentage}% accuracy).`,
      status: "COMPLETED",
      trigger,
      analyzerVersion: "1.0",
      metadata: JSON.stringify({
        deterministic,
        evidenceCount: structured.evidenceAttemptIds.length,
        latestAttemptId,
        checkpointAttemptCount: checkpointAttempts.length,
        explanationCount: studentWords.length,
        arithmeticSlips,
        timestamp: new Date().toISOString(),
      }),
      evidenceAttemptIds: structured.evidenceAttemptIds.filter((id) => !id.startsWith("cp_")),
    });

    return saved as MistakeAnalysisDTO;
  }

  /**
   * Deterministically evaluate a single question attempt for immediate mistake categorization
   */
  static evaluateAttempt(params: {
    prompt: string;
    questionData?: any;
    studentAnswer: any;
    correctAnswer?: any;
    skillId?: string;
  }): { category: string; feedback?: string } {
    const { prompt, studentAnswer, correctAnswer } = params;
    const ansStr = String(studentAnswer || "").trim().toLowerCase();
    const corrStr = String(correctAnswer || "").trim().toLowerCase();
    const promptLower = (prompt || "").toLowerCase();

    // Check for sign error
    const ansNum = parseFloat(ansStr);
    const corrNum = parseFloat(corrStr);
    if (!isNaN(ansNum) && !isNaN(corrNum) && ansNum === -corrNum && ansNum !== 0) {
      return { category: "SIGN_ERROR", feedback: "Check your positive and negative signs carefully." };
    }

    // Check for comparison error on negative numbers
    if (
      (promptLower.includes("compare") || promptLower.includes("order") || promptLower.includes("greater") || promptLower.includes("less")) &&
      (promptLower.includes("negative") || promptLower.includes("-"))
    ) {
      return { category: "CONCEPTUAL_MISUNDERSTANDING", feedback: "Remember that on a number line, values farther to the right are always greater." };
    }

    // Default calculation or conceptual error
    if (!isNaN(ansNum) && !isNaN(corrNum)) {
      return { category: "CALCULATION_ERROR", feedback: "Review your calculation steps to verify your arithmetic." };
    }

    return { category: "CONCEPTUAL_MISUNDERSTANDING", feedback: "Review the lesson materials and concept definitions." };
  }
}
