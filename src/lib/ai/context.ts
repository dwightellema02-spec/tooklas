// Phase 7 & Phase 21: AI Tutor Context Builder & Content-Grounded Intelligence Pipeline

import { dbService } from "../db";
import { findRelevantDocumentChunks } from "../documents/document-extractor";
import type {
  AITutorContext,
  AITutorInteractParams,
  QuestionContextData,
  LessonGroundedContent,
  LessonContentBlockSummary,
  TeacherMaterialSummary,
  PrerequisiteSkillSummary,
} from "./types";

export async function buildAITutorContext(params: AITutorInteractParams): Promise<AITutorContext> {
  const {
    studentId,
    conversationId,
    lessonId,
    skillId,
    questionId,
    practiceSessionId,
    studentQuery,
    helpLevel = "LEVEL_1_HINT",
    studentAnswer,
  } = params;

  // 1. Authenticated Student Context & Role Check
  const user = await dbService.findUserById(studentId);
  const userRole = user?.role || "STUDENT";
  const student = {
    id: studentId,
    name: user ? user.name : "Student",
    gradeLevel: user?.gradeLevel || 7,
  };

  // 2. Question Context (if applicable)
  let questionContext: QuestionContextData | undefined = undefined;
  let targetLessonId = lessonId;
  let targetSkillId = skillId;

  if (questionId) {
    const question = await dbService.getQuestionById(questionId);
    if (question) {
      if (!targetLessonId && question.lessonId) targetLessonId = question.lessonId;
      if (!targetSkillId && question.skillId) targetSkillId = question.skillId;

      let choices: Array<{ id: string; text: string }> | undefined = undefined;
      let expectedAnswer: string | undefined = undefined;

      try {
        const qData = typeof question.questionData === "string" ? JSON.parse(question.questionData) : question.questionData;
        if (qData.choices && Array.isArray(qData.choices)) {
          choices = qData.choices.map((c: any) => ({ id: String(c.id), text: String(c.text) }));
        }
        if (qData.correctAnswer !== undefined) {
          expectedAnswer = String(qData.correctAnswer);
        } else if (qData.acceptableAnswers && Array.isArray(qData.acceptableAnswers)) {
          expectedAnswer = qData.acceptableAnswers.join(" or ");
        }
      } catch {
        // Parsing fallback
      }

      questionContext = {
        id: question.id,
        type: question.type,
        prompt: question.prompt,
        difficulty: question.difficulty,
        choices,
        expectedAnswer,
        correctFeedback: question.correctFeedback || undefined,
        incorrectFeedback: question.incorrectFeedback || undefined,
      };
    }
  }

  // 3. Lesson & Curriculum Context Grounding
  let lessonContext: { id: string; title: string; description?: string | null } | undefined = undefined;
  let unitTitle: string | undefined = "Integers & Rational Numbers";
  let groundedLesson: LessonGroundedContent | undefined = undefined;

  if (targetLessonId) {
    const lesson = await dbService.getLessonById(targetLessonId);
    if (lesson) {
      const isStaff = userRole === "TEACHER" || userRole === "ADMIN";
      const isPublished = lesson.status === "PUBLISHED";

      // SECURITY & RBAC RULE (Part 21 & 22):
      // Students can only access and ground in PUBLISHED lesson content.
      // Teachers and Admins can preview DRAFT / REVIEW lessons.
      if (isPublished || isStaff) {
        lessonContext = {
          id: lesson.id,
          title: lesson.title,
          description: lesson.description,
        };

        if (lesson.unit && lesson.unit.title) {
          unitTitle = lesson.unit.title;
        }

        // Format grounded content blocks (text explanations, examples, definitions, summaries)
        const contentBlocks: LessonContentBlockSummary[] = [];
        if (lesson.contentBlocks && Array.isArray(lesson.contentBlocks)) {
          for (const block of lesson.contentBlocks) {
            contentBlocks.push({
              id: block.id,
              type: String(block.type),
              sequenceOrder: block.sequenceOrder,
              title: block.title,
              content: block.content,
              metadata: block.metadata,
            });
          }
        }

        // Format teacher materials & resources (teacher notes, LAS activities, video metadata, extracted docs)
        const teacherMaterials: TeacherMaterialSummary[] = [];
        const groundedChunks: Array<{
          documentId: string;
          documentTitle: string;
          heading: string;
          content: string;
          charCount: number;
        }> = [];

        if (lesson.resources && Array.isArray(lesson.resources)) {
          for (const res of lesson.resources) {
            let extractionStatus: string | undefined = undefined;
            let sectionCount: number | undefined = undefined;
            let charCount: number | undefined = undefined;
            let wordCount: number | undefined = undefined;
            let previewText: string | undefined = undefined;
            let hasExtractedContent = false;
            let extractionError: string | null | undefined = undefined;
            let parsedChunks: any[] = [];

            if (res.type === "PDF" || res.type === "DOCUMENT") {
              if (res.notes) {
                try {
                  const meta = JSON.parse(res.notes);
                  if (meta && typeof meta === "object" && meta.extractionStatus) {
                    extractionStatus = meta.extractionStatus;
                    sectionCount = meta.sectionCount;
                    charCount = meta.charCount;
                    wordCount = meta.wordCount;
                    previewText = meta.previewText;
                    extractionError = meta.error;
                    hasExtractedContent = meta.extractionStatus === "READY";
                    if (Array.isArray(meta.chunks)) {
                      parsedChunks = meta.chunks;
                    }
                  }
                } catch {
                  // res.notes is regular text
                  extractionStatus = res.status || "READY";
                  hasExtractedContent = false;
                }
              } else {
                extractionStatus = res.status || "PENDING";
              }

              // Extract relevant chunks for current student query / context
              if (hasExtractedContent && parsedChunks.length > 0) {
                const relevant = findRelevantDocumentChunks(studentQuery || "", parsedChunks, 3);
                for (const chunk of relevant) {
                  groundedChunks.push({
                    documentId: res.id,
                    documentTitle: res.title || res.fileName || "Teacher Material",
                    heading: chunk.heading,
                    content: chunk.content,
                    charCount: chunk.charCount,
                  });
                }
              }
            }

            teacherMaterials.push({
              id: res.id,
              type: String(res.type),
              title: res.title,
              description: res.description,
              notes: res.notes,
              provider: res.provider,
              channelName: res.channelName,
              hasTranscript: false, // Explicit: no machine-readable video transcript is provided
              fileName: res.fileName,
              fileSize: res.fileSize,
              extractionStatus,
              sectionCount,
              charCount,
              wordCount,
              previewText,
              hasExtractedContent,
              extractionError,
            });
          }
        }

        // Extract DepEd competency if available
        let competency: { code: string; statement: string } | undefined = undefined;
        if (lesson.unit && (lesson.unit as any).competencies && (lesson.unit as any).competencies.length > 0) {
          const comp = (lesson.unit as any).competencies[0];
          competency = { code: comp.code, statement: comp.statement };
        }

        // Extract prerequisite skills
        const prerequisiteSkills: PrerequisiteSkillSummary[] = [];
        if (lesson.skills && Array.isArray(lesson.skills)) {
          for (const ls of lesson.skills) {
            const skillObj = (ls as any).skill;
            if (skillObj && (skillObj as any).prerequisites && Array.isArray((skillObj as any).prerequisites)) {
              for (const prereq of (skillObj as any).prerequisites) {
                const pSkill = prereq.prerequisiteSkill || prereq.prerequisite;
                if (pSkill) {
                  prerequisiteSkills.push({
                    id: pSkill.id,
                    title: pSkill.title,
                    difficulty: pSkill.difficulty,
                  });
                }
              }
            } else if (skillObj && Array.isArray((skillObj as any).prerequisiteIds)) {
              for (const pId of (skillObj as any).prerequisiteIds) {
                prerequisiteSkills.push({
                  id: pId,
                  title: `Prerequisite (${pId})`,
                });
              }
            }
          }
        }

        groundedLesson = {
          id: lesson.id,
          title: lesson.title,
          description: lesson.description,
          status: lesson.status,
          learningObjectives: Array.isArray(lesson.learningObjectives) ? lesson.learningObjectives : [],
          competency,
          contentBlocks,
          teacherMaterials,
          prerequisiteSkills,
          documentChunks: groundedChunks,
        };
      } else {
        // Unpublished lesson blocked for students
        lessonContext = {
          id: lesson.id,
          title: "Unpublished Lesson Content",
          description: "This lesson is currently in draft review and not published for student access.",
        };
      }
    }
  }

  // 4. Skill Context
  let skillContext: { id: string; title: string; description?: string | null } | undefined = undefined;
  if (targetSkillId) {
    const skills = await dbService.getSkills();
    const foundSkill = skills.find((s: any) => s.id === targetSkillId);
    if (foundSkill) {
      skillContext = {
        id: foundSkill.id,
        title: foundSkill.title,
        description: foundSkill.description,
      };
    }
  }

  // 5. Attempt History Context (Load actual student attempts for this question)
  let previousAttempts: any[] = [];
  if (questionId) {
    const attempts = await dbService.getQuestionAttemptsForStudent(studentId, questionId, practiceSessionId);
    previousAttempts = attempts.map((att: any) => ({
      answer: String(att.answer),
      isCorrect: Boolean(att.isCorrect),
      attemptNumber: Number(att.attemptNumber),
      timeTakenMs: att.timeTakenMs || null,
      submittedAt: att.submittedAt ? new Date(att.submittedAt).toISOString() : undefined,
    }));
  }

  // 6. Recent Conversation History (Sliding window of last 6 messages)
  let recentMessages: any[] = [];
  if (conversationId) {
    const messages = await dbService.getAITutorMessages(conversationId, 6);
    recentMessages = messages.map((m: any) => ({
      role: m.role,
      content: m.content,
      messageType: m.messageType,
      createdAt: m.createdAt ? new Date(m.createdAt).toISOString() : undefined,
    }));
  }

  // 7. Check for Recent Mistake Analysis Insight (Phase 8 bridge)
  let mistakeInsight: { category: string; possibleCause?: string | null; pattern?: string | null } | undefined = undefined;
  if (targetSkillId) {
    try {
      const recentAnalysis = await dbService.getLatestMistakeAnalysisForSkill(studentId, targetSkillId);
      if (recentAnalysis && recentAnalysis.confidence >= 0.5) {
        mistakeInsight = {
          category: recentAnalysis.category,
          possibleCause: recentAnalysis.possibleCause,
          pattern: recentAnalysis.pattern,
        };
      }
    } catch (e) {
      console.warn("Failed to retrieve mistake insight for tutor context:", e);
    }
  }

  // 8. Mastery Engine Status (Phase 10 bridge)
  let masteryInsight: { status: string; accuracy: number; recentAccuracy: number; summary?: string } | undefined = undefined;
  if (targetSkillId) {
    try {
      const mastery = await dbService.getSkillMastery(studentId, targetSkillId);
      if (mastery) {
        masteryInsight = {
          status: mastery.status,
          accuracy: Math.round((mastery.accuracy || 0) * 100),
          recentAccuracy: Math.round((mastery.recentAccuracy || 0) * 100),
          summary: mastery.evidenceSummary || undefined,
        };
      }
    } catch (e) {
      console.warn("Failed to retrieve mastery insight for tutor context:", e);
    }
  }

  // 9. Active Adaptive Recommendation (Phase 9 bridge)
  let adaptiveRecommendation: { decisionType: string; reason: string; recommendedActivityType: string } | undefined = undefined;
  try {
    const recHistory = await dbService.getStudentAdaptiveHistory(studentId, { limit: 1 });
    if (recHistory && recHistory.length > 0) {
      const topRec = recHistory[0];
      if (topRec.status === "ACTIVE") {
        adaptiveRecommendation = {
          decisionType: topRec.decisionType,
          reason: topRec.reason,
          recommendedActivityType: topRec.recommendedActivityType,
        };
      }
    }
  } catch (e) {
    console.warn("Failed to retrieve adaptive recommendation for tutor context:", e);
  }

  // 10. Deterministic Source Priority (Part 5)
  const sourcePriority = [
    "1. Current published lesson content",
    "2. Current question/practice context",
    "3. Current skill/competency",
    "4. Teacher-authored material",
    "5. Relevant published supporting resources",
    "6. Student's previous learning evidence",
    "7. Approved curriculum metadata",
    "8. General mathematical knowledge",
  ];

  // 11. Video Integrity Policy (Part 6)
  const videoIntegrityBoundary =
    "Verified metadata and teacher notes are available for Mathisipan video resources. However, NO machine-readable video transcript is ingested into the system. You MUST NOT claim to have watched the video. Ground your answers in lesson text and teacher notes.";

  return {
    student,
    curriculum: {
      subject: "Mathematics",
      grade: 7,
      term: 1,
      unitTitle,
      lessonTitle: lessonContext?.title,
    },
    lesson: lessonContext,
    skill: skillContext,
    question: questionContext,
    studentAnswer,
    previousAttempts,
    recentMessages,
    helpLevel,
    studentQuery,
    practiceSessionId,
    mistakeInsight,
    masteryInsight,
    groundedLesson,
    adaptiveRecommendation,
    sourcePriority,
    videoIntegrityBoundary,
  };
}
