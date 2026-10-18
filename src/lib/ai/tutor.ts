// Phase 7: AI Tutor Core Service Orchestrator

import { dbService } from "../db";
import { buildAITutorContext } from "./context";
import { buildTutorSystemPrompt, buildTutorUserPrompt } from "./prompts";
import { getAIProvider, LocalTutorEngine } from "./provider";
import { validateTutorOutput } from "./validators";
import { MistakeAnalyzerService } from "./mistake-analyzer";
import type {
  AITutorInteractParams,
  TutorAPIResponse,
  AITutorMessageType,
} from "./types";

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

// In-memory sliding window rate-limiter per student
const rateLimitMap = new Map<string, RateLimitRecord>();
const MAX_REQUESTS_PER_MINUTE = 20;
const WINDOW_DURATION_MS = 60 * 1000;

export class AITutorService {
  /**
   * Check and increment rate limit for a student
   */
  static checkRateLimit(studentId: string): { allowed: boolean; remaining: number; resetInSeconds: number } {
    const now = Date.now();
    const record = rateLimitMap.get(studentId);

    if (!record || now > record.resetAt) {
      rateLimitMap.set(studentId, { count: 1, resetAt: now + WINDOW_DURATION_MS });
      return {
        allowed: true,
        remaining: MAX_REQUESTS_PER_MINUTE - 1,
        resetInSeconds: Math.ceil(WINDOW_DURATION_MS / 1000),
      };
    }

    if (record.count >= MAX_REQUESTS_PER_MINUTE) {
      return {
        allowed: false,
        remaining: 0,
        resetInSeconds: Math.max(1, Math.ceil((record.resetAt - now) / 1000)),
      };
    }

    record.count += 1;
    return {
      allowed: true,
      remaining: MAX_REQUESTS_PER_MINUTE - record.count,
      resetInSeconds: Math.max(1, Math.ceil((record.resetAt - now) / 1000)),
    };
  }

  /**
   * Reset rate limit state (useful after test suites or administrative resets)
   */
  static resetRateLimit(studentId?: string): void {
    if (studentId) {
      rateLimitMap.delete(studentId);
    } else {
      rateLimitMap.clear();
    }
  }

  /**
   * Main interaction entrypoint
   */
  static async interact(params: AITutorInteractParams): Promise<TutorAPIResponse> {
    const { studentId, studentQuery, questionId, practiceSessionId } = params;

    // 1. Rate Limit Enforcement
    const rateLimit = this.checkRateLimit(studentId);
    if (!rateLimit.allowed) {
      throw new Error(
        `Rate limit exceeded. Please wait ${rateLimit.resetInSeconds} seconds before asking the AI Tutor again.`
      );
    }

    // 2. Teacher Settings Check
    const settings = await dbService.getTeacherAISettings();
    if (!settings.aiTutorEnabled) {
      throw new Error("The AI Tutor is currently disabled by your instructor. Please continue your lesson.");
    }

    // 3. Input Sanitization & Guard
    if (studentQuery && studentQuery.length > 1000) {
      throw new Error("Student query exceeds the maximum allowed length of 1000 characters.");
    }

    // 4. Resolve or Create Conversation
    const conversation = await dbService.getOrCreateAITutorConversation({
      studentId,
      lessonId: params.lessonId,
      skillId: params.skillId,
      questionId: params.questionId,
      practiceSessionId: params.practiceSessionId,
    });

    // 5. If student submitted a specific query or question, record their message
    if (studentQuery && studentQuery.trim().length > 0) {
      await dbService.saveAITutorMessage({
        conversationId: conversation.id,
        role: "STUDENT",
        content: studentQuery.trim(),
        messageType: "QUESTION",
        metadata: JSON.stringify({
          questionId: params.questionId || null,
          blockId: params.blockId || null,
          lessonId: params.lessonId || null,
          skillId: params.skillId || null,
          studentAnswer: params.studentAnswer === undefined || params.studentAnswer === null ? null : String(params.studentAnswer).slice(0, 200),
        }),
      });
    }

    // 6. Build Rich Educational Context
    const context = await buildAITutorContext({
      ...params,
      conversationId: conversation.id,
    });

    // 7. Generate Prompts
    const systemPrompt = buildTutorSystemPrompt(context.requestedLanguage);
    const userPrompt = buildTutorUserPrompt(context);

    // 8. Call AI Provider (with graceful automatic fallback)
    let rawResponse: { text: string; provider: string; model: string };
    const provider = getAIProvider();

    try {
      rawResponse = await provider.generateTutorResponse({
        systemPrompt,
        userPrompt,
        maxTokens: 1500,
        temperature: 0.3,
        timeoutMs: 20000,
        context,
      });
    } catch (providerError) {
      console.warn("Primary AI provider failed, activating local pedagogical engine fallback:", providerError);
      const fallbackProvider = new LocalTutorEngine();
      rawResponse = await fallbackProvider.generateTutorResponse({
        systemPrompt,
        userPrompt,
        maxTokens: 500,
        context,
      });
    }

    // 9. Validate & Sanitize Output
    const structured = validateTutorOutput(rawResponse.text, context);

    const startTime = Date.now();

    // 10. Persist Tutor Message to Database
    const savedTutorMessage = await dbService.saveAITutorMessage({
      conversationId: conversation.id,
      role: "TUTOR",
      content: structured.message,
      messageType: structured.responseType,
      hintLevel: structured.hintLevel,
      guidingQuestion: structured.guidingQuestion,
      metadata: JSON.stringify({
        encouragement: structured.encouragement,
        nextStep: structured.nextStep,
        detectedIssue: structured.detectedIssue,
        suggestedAction: structured.suggestedAction,
        sourceGrounding: structured.sourceGrounding,
        provider: rawResponse.provider,
        model: rawResponse.model,
        replacedBy: structured.fallbackReason || null,
        latencyMs: Date.now() - startTime,
      }),
    });

    // 10b. If the student wrote out a step that does not compute, that is evidence worth keeping: refresh the
    // mistake analysis in the background so the next hint and the teacher both see it.
    const analysisSkillId = params.skillId || context.skill?.id;
    if (analysisSkillId && (context.studentWork?.arithmeticSlips.length ?? 0) > 0) {
      MistakeAnalyzerService.analyzeStudentMistakes({
        studentId,
        skillId: analysisSkillId,
        lessonId: params.lessonId || context.lesson?.id,
        trigger: "N_NEW_ATTEMPTS",
      }).catch((err) => console.warn("Background analysis after tutor turn failed:", err));
    }

    // 11. Record hint usage on QuestionAttempt for research analytics
    if (questionId) {
      await dbService.markHintUsedOnQuestionAttempt(studentId, questionId, practiceSessionId);
    }

    return {
      success: true,
      conversationId: conversation.id,
      message: {
        id: savedTutorMessage.id,
        role: "TUTOR",
        content: savedTutorMessage.content,
        messageType: savedTutorMessage.messageType as AITutorMessageType,
        hintLevel: savedTutorMessage.hintLevel,
        guidingQuestion: savedTutorMessage.guidingQuestion,
        encouragement: structured.encouragement,
        detectedIssue: structured.detectedIssue || null,
        suggestedAction: structured.suggestedAction || null,
        createdAt: new Date(savedTutorMessage.createdAt).toISOString(),
      },
      providerInfo: {
        // When the model's reply was replaced by the built-in tutor, say so instead of naming the model.
        provider: structured.fallbackReason ? "local-pedagogical-engine" : rawResponse.provider,
        model: structured.fallbackReason ? "built-in (replaced " + rawResponse.provider + ": " + structured.fallbackReason + ")" : rawResponse.model,
      },
      rateLimit: {
        remaining: rateLimit.remaining,
        resetInSeconds: rateLimit.resetInSeconds,
      },
    };
  }
}
