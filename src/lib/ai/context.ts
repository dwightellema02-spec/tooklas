// Phase 7 & Phase 21: AI Tutor Context Builder & Content-Grounded Intelligence Pipeline
//
// What the tutor knows comes from the server's own data (the lesson, the question, the student's saved
// attempts). The page only says WHICH lesson, question or block the student is on, and the server checks it.

import { dbService } from "../db";
import { findRelevantDocumentChunks } from "../documents/document-extractor";
import { findArithmeticSlips } from "./arithmetic";
import { detectTopicConflict, topicsIn } from "./topics";
import type {
  AITutorContext,
  AITutorInteractParams,
  QuestionContextData,
  LessonGroundedContent,
  LessonContentBlockSummary,
  TeacherMaterialSummary,
  PrerequisiteSkillSummary,
} from "./types";

/** How much lesson text goes to the AI, and how much of one block. Keeps prompts small and on topic. */
const GROUNDING_MAX_CHARS = 4500;
const BLOCK_MAX_CHARS = 650;
const EXAMPLE_MAX_CHARS = 900;
const DOCUMENT_CHUNK_MAX_CHARS = 500;
const GROUNDING_BLOCK_TYPES = new Set(["TEXT", "EXAMPLE", "SUMMARY"]);
const ANSWER_BLOCK_TYPES = new Set(["CHECKPOINT", "QUESTION"]);

/**
 * Documents the school keeps for teachers only (for example the DepEd Lesson Exemplars and Budget of Work) are
 * never put in the tutor's prompt. Their title ends in "(Teacher Reference)" or the resource is marked TEACHER_ONLY.
 */
export function isTeacherReferenceOnly(res: { title?: string | null; status?: string | null }): boolean {
  return res.status === "TEACHER_ONLY" || /\(teacher reference\)/i.test(res.title || "");
}

const stripNumber = (t?: string | null) => (t ?? "").replace(/^\d+\.\s+/, "");
const squash = (s: string) => s.replace(/\s+/g, " ").trim();

/**
 * Picks the lesson text the AI sees: only teaching blocks (text, worked example, summary), the section the student
 * has open first, then the rest in order, until the budget is used. Pictures, explorers, videos, practice and
 * checkpoints (which carry answer keys) are not included.
 */
export function selectGroundingBlocks(
  blocks: Array<{ id: string; type: any; sequenceOrder: number; title?: string | null; content: string; metadata?: any }>,
  currentBlockId?: string
): LessonContentBlockSummary[] {
  const ordered = [...blocks].sort((a, b) => a.sequenceOrder - b.sequenceOrder);
  const usable = ordered.filter((b) => GROUNDING_BLOCK_TYPES.has(String(b.type)));
  if (usable.length === 0) return [];

  // The section the student is on: the block itself, or the nearest teaching block before it.
  let first: (typeof usable)[number] | undefined;
  if (currentBlockId) {
    const cur = ordered.find((b) => b.id === currentBlockId);
    if (cur) first = [...usable].reverse().find((b) => b.sequenceOrder <= cur.sequenceOrder) || usable[0];
  }

  const sequence = first ? [first, ...usable.filter((b) => b.id !== first!.id)] : usable;
  const chosen: LessonContentBlockSummary[] = [];
  let used = 0;
  for (const b of sequence) {
    const limit = String(b.type) === "EXAMPLE" ? EXAMPLE_MAX_CHARS : BLOCK_MAX_CHARS;
    const text = squash(b.content).slice(0, limit);
    if (used + text.length > GROUNDING_MAX_CHARS && chosen.length > 0) break;
    used += text.length;
    chosen.push({
      id: b.id,
      type: String(b.type),
      sequenceOrder: b.sequenceOrder,
      title: stripNumber(b.title),
      content: text,
      metadata: String(b.type) === "EXAMPLE" ? b.metadata : undefined,
    });
  }
  return chosen.sort((a, b) => a.sequenceOrder - b.sequenceOrder);
}

function parseJson(raw: any): any {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function buildAITutorContext(params: AITutorInteractParams): Promise<AITutorContext> {
  const {
    studentId,
    conversationId,
    lessonId,
    skillId,
    questionId,
    practiceSessionId,
    blockId,
    studentQuery,
    helpLevel = "LEVEL_1_HINT",
  } = params;
  let studentAnswer = params.studentAnswer;

  // 1. Authenticated Student Context & Role Check
  const user = await dbService.findUserById(studentId);
  const userRole = user?.role || "STUDENT";
  const student = {
    id: studentId,
    name: user ? user.name : "Student",
    gradeLevel: user?.gradeLevel || 7,
  };

  // 2. Question Context from a practice question (if applicable)
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
      let choiceHints: Record<string, string> | undefined = undefined;

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
        if (qData.feedbackByChoice && typeof qData.feedbackByChoice === "object") {
          choiceHints = qData.feedbackByChoice;
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
        choiceHints,
        source: "practice",
      };
    }
  }

  // 3. Lesson & Curriculum Context Grounding
  let lessonContext: { id: string; title: string; description?: string | null } | undefined = undefined;
  let groundedLesson: LessonGroundedContent | undefined = undefined;
  let curriculum: AITutorContext["curriculum"] = {};
  let currentSection: AITutorContext["currentSection"] = undefined;
  let lessonHeader: string[] = [];
  const checkpointHistory: NonNullable<AITutorContext["checkpointHistory"]> = [];
  let previousAttemptsFromCheckpoint: any[] | undefined;

  if (targetLessonId) {
    const lesson: any = await dbService.getLessonById(targetLessonId);
    if (lesson) {
      const isStaff = userRole === "TEACHER" || userRole === "ADMIN";
      const isPublished = lesson.status === "PUBLISHED";

      // SECURITY & RBAC RULE: students can only access and ground in PUBLISHED lesson content.
      // Teachers and Admins can preview DRAFT / REVIEW lessons.
      if (isPublished || isStaff) {
        lessonContext = {
          id: lesson.id,
          title: lesson.title,
          description: lesson.description,
        };

        const term = lesson.unit?.term;
        curriculum = {
          subject: term?.grade?.subject?.name || undefined,
          grade: term?.grade?.level ?? undefined,
          term: term?.termNumber ?? undefined,
          unitTitle: lesson.unit?.title || undefined,
          lessonTitle: lesson.title,
        };

        const allBlocks: any[] = Array.isArray(lesson.contentBlocks) ? lesson.contentBlocks : [];
        const contentBlocks = selectGroundingBlocks(allBlocks, blockId);

        // The block the page says the student is on. It must belong to this lesson.
        const block = blockId ? allBlocks.find((b) => b.id === blockId) : undefined;
        if (block) {
          currentSection = { id: block.id, title: stripNumber(block.title), type: String(block.type) };

          // A checkpoint inside the lesson: the server knows the question and the answer key.
          if (ANSWER_BLOCK_TYPES.has(String(block.type)) && !questionContext) {
            const meta = parseJson(block.metadata);
            const options: string[] = Array.isArray(meta.options) ? meta.options.map(String) : [];
            const prompt = String(meta.question || block.content || "");
            if (prompt) {
              questionContext = {
                id: block.id,
                type: options.length > 0 ? "MULTIPLE_CHOICE" : "SHORT_ANSWER",
                prompt,
                difficulty: "EASY",
                choices: options.length > 0 ? options.map((text, i) => ({ id: `opt_${String.fromCharCode(97 + i)}`, text })) : undefined,
                expectedAnswer: meta.correctAnswer !== undefined ? String(meta.correctAnswer) : undefined,
                source: "checkpoint",
              };
            }
          }
        }

        // The student's checkpoint results for this lesson (saved by the server when they answered).
        try {
          const cps: any[] = await dbService.getCheckpointAttempts(studentId, lesson.id);
          const byBlock = new Map<string, any[]>();
          for (const c of cps) {
            if (!byBlock.has(c.blockId)) byBlock.set(c.blockId, []);
            byBlock.get(c.blockId)!.push(c);
          }
          for (const [bid, rows] of byBlock) {
            rows.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            checkpointHistory.push({ blockId: bid, attempts: rows.length, correct: rows.some((r) => r.isCorrect) });
          }
          if (questionContext?.source === "checkpoint") {
            const rows = (byBlock.get(questionContext.id) || []) as any[];
            previousAttemptsFromCheckpoint = rows.map((r, i) => ({
              answer: String(r.answer),
              isCorrect: Boolean(r.isCorrect),
              attemptNumber: Number(r.attempt || i + 1),
              timeTakenMs: null,
              submittedAt: r.createdAt ? new Date(r.createdAt).toISOString() : undefined,
            }));
            // What the student actually submitted is more reliable than what the page says.
            if ((studentAnswer === undefined || studentAnswer === null || studentAnswer === "") && previousAttemptsFromCheckpoint.length > 0) {
              studentAnswer = previousAttemptsFromCheckpoint[previousAttemptsFromCheckpoint.length - 1].answer;
            }
          }
        } catch (e) {
          console.warn("Failed to load checkpoint attempts for tutor context:", e);
        }

        // Teacher materials & resources. Teacher-reference documents are left out entirely, and extracted
        // document text is never copied into the notes the AI reads.
        const teacherMaterials: TeacherMaterialSummary[] = [];
        const groundedChunks: Array<{ documentId: string; documentTitle: string; heading: string; content: string; charCount: number }> = [];

        if (lesson.resources && Array.isArray(lesson.resources)) {
          for (const res of lesson.resources) {
            if (isTeacherReferenceOnly(res)) continue;

            let extractionStatus: string | undefined = undefined;
            let sectionCount: number | undefined = undefined;
            let charCount: number | undefined = undefined;
            let wordCount: number | undefined = undefined;
            let previewText: string | undefined = undefined;
            let hasExtractedContent = false;
            let extractionError: string | null | undefined = undefined;
            let parsedChunks: any[] = [];
            let plainNotes: string | null = res.notes || null;

            if (res.type === "PDF" || res.type === "DOCUMENT") {
              plainNotes = null; // document notes hold extraction data, not teacher-written text
              if (res.notes) {
                try {
                  const meta = JSON.parse(res.notes);
                  if (meta && typeof meta === "object" && meta.extractionStatus) {
                    extractionStatus = meta.extractionStatus;
                    sectionCount = meta.sectionCount;
                    charCount = meta.charCount;
                    wordCount = meta.wordCount;
                    previewText = undefined; // not forwarded
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
                  plainNotes = String(res.notes).slice(0, 300);
                }
              } else {
                extractionStatus = res.status || "PENDING";
              }

              // A few relevant passages for the current query, each short.
              if (hasExtractedContent && parsedChunks.length > 0) {
                const relevant = findRelevantDocumentChunks(studentQuery || "", parsedChunks, 2);
                for (const chunk of relevant) {
                  groundedChunks.push({
                    documentId: res.id,
                    documentTitle: res.title || res.fileName || "Teacher Material",
                    heading: chunk.heading,
                    content: String(chunk.content).slice(0, DOCUMENT_CHUNK_MAX_CHARS),
                    charCount: Math.min(chunk.charCount, DOCUMENT_CHUNK_MAX_CHARS),
                  });
                }
              }
            } else if (plainNotes) {
              plainNotes = plainNotes.slice(0, 300);
            }

            teacherMaterials.push({
              id: res.id,
              type: String(res.type),
              title: res.title,
              description: res.description,
              notes: plainNotes,
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

        const objectives = Array.isArray(lesson.learningObjectives) ? lesson.learningObjectives : [];
        lessonHeader = [lesson.title, ...objectives];

        groundedLesson = {
          id: lesson.id,
          title: lesson.title,
          description: lesson.description,
          status: lesson.status,
          learningObjectives: objectives,
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
      lessonHeader.push(foundSkill.title);
    }
  }

  // 5. Attempt History Context (the student's actual saved attempts for this question)
  let previousAttempts: any[] = [];
  if (questionId) {
    // All of the student's attempts on this question, across practice sessions: a repeated mistake in an earlier
    // session counts, and the tutor should know about it.
    const attempts = await dbService.getQuestionAttemptsForStudent(studentId, questionId);
    previousAttempts = [...attempts]
      .sort((a: any, b: any) => new Date(a.submittedAt || 0).getTime() - new Date(b.submittedAt || 0).getTime())
      .map((att: any, i: number) => ({
        answer: String(att.answer),
        isCorrect: Boolean(att.isCorrect),
        attemptNumber: i + 1, // counted across sessions, oldest first
        timeTakenMs: att.timeTakenMs || null,
        submittedAt: att.submittedAt ? new Date(att.submittedAt).toISOString() : undefined,
      }));
  } else if (previousAttemptsFromCheckpoint) {
    previousAttempts = previousAttemptsFromCheckpoint;
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

  // 12. Multilingual & Language Preference Detection
  const requestedLanguage = detectLanguagePreference(studentQuery, recentMessages);

  // 13. What the student wrote about their own work: this message and their earlier ones in the conversation
  const explanations: string[] = [];
  const pushText = (t?: string | null) => {
    const v = (t || "").trim();
    if (v && !explanations.includes(v)) explanations.push(v);
  };
  for (const m of recentMessages) if (m.role === "STUDENT") pushText(m.content);
  pushText(studentQuery);
  const arithmeticSlips = findArithmeticSlips(explanations.join(" \n "));

  // 14. How reliable is our knowledge of the topic? Facts from data versus a guess from the message.
  const lessonKnown = Boolean(groundedLesson);
  const questionKnown = Boolean(questionContext);
  const conflict = lessonKnown ? detectTopicConflict(studentQuery, lessonHeader) : null;
  const topicSource: NonNullable<AITutorContext["contextStatus"]>["topicSource"] = questionKnown
    ? "question"
    : lessonKnown
    ? "lesson"
    : topicsIn(studentQuery || "").length > 0
    ? "student_message"
    : "unknown";

  return {
    student,
    curriculum,
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
    requestedLanguage,
    currentSection,
    checkpointHistory,
    studentWork: { explanations, arithmeticSlips },
    contextStatus: {
      lessonKnown,
      questionKnown,
      topicSource,
      conflict: conflict ? { mentioned: conflict.mentioned.en, lessonTopic: conflict.lessonTopic?.en || "" } : undefined,
    },
  };
}

// Words that show a message is Filipino. Counted, not just tested, so one shared word does not decide it.
const FILIPINO_WORDS = [
  "ano", "bakit", "paano", "kailan", "saan", "sino", "alin", "magkano", "ilan",
  "natin", "namin", "ninyo", "kayo", "tayo", "sila", "ako", "ikaw", "siya", "ko", "mo", "niya", "yung", "yun", "iyon", "ito", "dito", "doon",
  "po", "opo", "ho", "oho",
  "mali", "tama", "sagot", "hindi", "wala", "meron", "mayroon", "gusto", "ayaw", "nakalimutan", "nakuha", "naintindihan", "maintindihan",
  "intindihin", "paliwanag", "ipaliwanag", "sabihin", "turuan", "tulungan", "tulong", "sige", "salamat", "lang", "naman", "talaga",
  "kasi", "kaya", "kung", "kapag", "dahil", "pero", "tapos", "saka", "gilid", "anggulo", "bilang", "numero", "aralin", "tuntunin",
  "ba", "na", "ang", "ng", "mga", "ay", "pa", "rin", "din", "muna", "nga", "pala", "subalit", "ngunit", "pakiusap", "paki",
  "kabaligtaran", "positibo", "negatibo", "alam", "sabi", "akin", "namin", "kanila", "nasa", "sa",
];
// "sa", "na", "ba", "pa", "ang", "ng" are weak: they are Filipino grammar words but short. They only count with others.
const WEAK_WORDS = new Set(["sa", "na", "ba", "pa", "ang", "ng", "ay", "mga", "rin", "din", "muna", "nga", "pala", "ko", "mo", "lang", "naman"]);
const STRONG_FILIPINO = new RegExp(`\\b(${FILIPINO_WORDS.filter((w) => !WEAK_WORDS.has(w)).join("|")})\\b`, "gi");
const WEAK_FILIPINO = new RegExp(`\\b(${[...WEAK_WORDS].join("|")})\\b`, "gi");

function filipinoScore(text: string): { strong: number; weak: number } {
  const strong = new Set((text.match(STRONG_FILIPINO) || []).map((w) => w.toLowerCase()));
  const weak = new Set((text.match(WEAK_FILIPINO) || []).map((w) => w.toLowerCase()));
  return { strong: strong.size, weak: weak.size };
}

/**
 * Detect language preference based on current student query and recent conversation history.
 * Recognizes explicit requests (tagalog, filipino, paliwanag sa tagalog, etc.)
 * as well as common Filipino and Taglish markers while supporting English defaults and explicit English requests.
 */
export function detectLanguagePreference(
  studentQuery?: string,
  recentMessages?: Array<{ role: string; content: string }>
): "fil" | "en" {
  const query = (studentQuery || "").trim().toLowerCase();

  // 1. Explicit English requests take immediate precedence
  const explicitEnglishRegex =
    /\b(english|in english|english please|please english|speak english|explain in english|use english|mag-?english|switch to english|back to english|can you speak english|can we speak english|change to english|ingles|sa ingles)\b/i;
  if (query === "english" || explicitEnglishRegex.test(query)) {
    return "en";
  }

  // 2. Explicit Tagalog / Filipino requests
  const explicitFilipinoRegex =
    /\b(tagalog|filipino|sa tagalog|in tagalog|paliwanag sa tagalog|ipaliwanag sa tagalog|mag-?tagalog|tagalugin|salitang tagalog|sa filipino|in filipino|paliwanag sa filipino|ipaliwanag sa filipino|mag-?filipino)\b/i;
  if (query === "tagalog" || query === "filipino" || explicitFilipinoRegex.test(query)) {
    return "fil";
  }

  // 3. Filipino and Taglish markers. Two different strong words, or one strong word with grammar words, is enough.
  const englishSentenceMarkers =
    /\b(what|how|why|when|where|which|who|can|could|would|please|give|tell|help|hint|rule|concept|explain|problem|integers?|numbers?|positive|negative|step|first|next|think|understand|confused|show|solve|wrong|correct|is|are|does|don't|dont|i|you|we|the|my|answer)\b/gi;
  const { strong, weak } = filipinoScore(query);
  const englishHits = new Set((query.match(englishSentenceMarkers) || []).map((w) => w.toLowerCase())).size;
  if (strong >= 2 || (strong >= 1 && weak >= 1) || (strong >= 1 && englishHits <= 1)) {
    return "fil";
  }

  // 4. If query is clearly composed in English, preserve English
  if (query && englishHits >= 1 && strong === 0) {
    return "en";
  }

  // 5. Conversational continuity for short/ambiguous queries (e.g. "-5", "hint", "next", "12"):
  // Only inspect previous STUDENT messages, never the TUTOR's text, or the tutor's own words would trap the
  // conversation in one language.
  if (recentMessages && recentMessages.length > 0) {
    const studentMessages = recentMessages.filter((m) => m.role === "STUDENT").slice(-3);
    for (let i = studentMessages.length - 1; i >= 0; i--) {
      const prev = studentMessages[i].content.trim().toLowerCase();
      if (prev === "english" || explicitEnglishRegex.test(prev)) return "en";
      if (prev === "tagalog" || prev === "filipino" || explicitFilipinoRegex.test(prev)) return "fil";
      const s = filipinoScore(prev);
      if (s.strong >= 2 || (s.strong >= 1 && s.weak >= 1)) return "fil";
      if ((prev.match(englishSentenceMarkers) || []).length >= 1 && s.strong === 0) return "en";
    }
  }

  return "en";
}
