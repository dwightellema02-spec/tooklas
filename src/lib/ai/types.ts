// Phase 7: AI Tutor Type Definitions

export type AITutorRoleType = "STUDENT" | "TUTOR" | "SYSTEM";

export type AITutorMessageType =
  | "QUESTION"
  | "HINT"
  | "GUIDING_QUESTION"
  | "EXPLANATION"
  | "EXAMPLE"
  | "FEEDBACK"
  | "CLARIFICATION"
  | "REDIRECT";

export type AITutorHelpLevel =
  | "LEVEL_1_HINT"
  | "LEVEL_2_HINT"
  | "GUIDING_QUESTION"
  | "CONCEPT_EXPLANATION"
  | "WORKED_EXAMPLE"
  | "FULL_EXPLANATION";

export interface StudentContextData {
  id: string;
  name: string;
  gradeLevel?: number | null;
}

export interface CurriculumContextData {
  subject: string;
  grade: number;
  term: number;
  unitTitle?: string;
  lessonTitle?: string;
}

export interface QuestionContextData {
  id: string;
  type: string;
  prompt: string;
  difficulty: string;
  choices?: Array<{ id: string; text: string }>;
  expectedAnswer?: string; // Used strictly internally for server-side pedagogical guidance
  correctFeedback?: string;
  incorrectFeedback?: string;
}

export interface AttemptHistoryItem {
  answer: string;
  isCorrect: boolean;
  attemptNumber: number;
  timeTakenMs?: number | null;
  submittedAt?: string;
}

export interface RecentMessageItem {
  role: "STUDENT" | "TUTOR";
  content: string;
  messageType?: string;
  createdAt?: string;
}

export interface LessonContentBlockSummary {
  id: string;
  type: string;
  sequenceOrder: number;
  title?: string | null;
  content: string;
  metadata?: any;
}

export interface TeacherMaterialSummary {
  id: string;
  type: string;
  title: string;
  description?: string | null;
  notes?: string | null;
  provider?: string | null;
  channelName?: string | null;
  hasTranscript: boolean;
  fileName?: string | null;
  fileSize?: number | null;
  extractionStatus?: string;
  charCount?: number;
  wordCount?: number;
  sectionCount?: number;
  previewText?: string;
  extractedText?: string;
  hasExtractedContent?: boolean;
  extractionError?: string | null;
  storagePath?: string | null;
}

export interface GroundedDocumentChunk {
  id?: string;
  documentId?: string;
  documentTitle?: string;
  heading: string;
  content: string;
  charCount: number;
  sequenceOrder?: number;
  isTable?: boolean;
}

export interface PrerequisiteSkillSummary {
  id: string;
  title: string;
  difficulty?: number;
  accuracy?: number;
}

export interface LessonGroundedContent {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  learningObjectives: string[];
  competency?: {
    code: string;
    statement: string;
  };
  contentBlocks: LessonContentBlockSummary[];
  teacherMaterials: TeacherMaterialSummary[];
  documentChunks?: GroundedDocumentChunk[];
  prerequisiteSkills: PrerequisiteSkillSummary[];
}

export interface AITutorContext {
  student: StudentContextData;
  curriculum: CurriculumContextData;
  lesson?: { id: string; title: string; description?: string | null };
  skill?: { id: string; title: string; description?: string | null };
  question?: QuestionContextData;
  studentAnswer?: any;
  previousAttempts: AttemptHistoryItem[];
  recentMessages: RecentMessageItem[];
  helpLevel: AITutorHelpLevel;
  studentQuery?: string;
  practiceSessionId?: string;
  mistakeInsight?: {
    category: string;
    possibleCause?: string | null;
    pattern?: string | null;
  };
  masteryInsight?: {
    status: string;
    accuracy: number;
    recentAccuracy: number;
    summary?: string;
  };
  // Phase 21 Grounded Content Extensions
  groundedLesson?: LessonGroundedContent;
  adaptiveRecommendation?: {
    decisionType: string;
    reason: string;
    recommendedActivityType: string;
  };
  sourcePriority?: string[];
  videoIntegrityBoundary?: string;
  requestedLanguage?: "fil" | "en";
}

export interface StructuredTutorResponse {
  responseType: AITutorMessageType;
  message: string;
  guidingQuestion?: string;
  hintLevel?: number;
  encouragement?: string;
  nextStep?: string;
  detectedIssue?: string;
  suggestedAction?: string;
  sourceGrounding?: string[];
}

export interface TutorAIRequest {
  systemPrompt: string;
  userPrompt: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

export interface TutorAIResponseRaw {
  text: string;
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  provider: string;
  model: string;
}

export interface AIProvider {
  readonly name: string;
  readonly defaultModel: string;
  generateTutorResponse(request: TutorAIRequest): Promise<TutorAIResponseRaw>;
}

export interface AITutorInteractParams {
  studentId: string;
  conversationId?: string;
  lessonId?: string;
  skillId?: string;
  questionId?: string;
  practiceSessionId?: string;
  studentQuery?: string;
  helpLevel?: AITutorHelpLevel;
  studentAnswer?: any;
}

export interface TutorMessageDTO {
  id: string;
  role: "STUDENT" | "TUTOR";
  content: string;
  messageType: AITutorMessageType;
  hintLevel?: number | null;
  guidingQuestion?: string | null;
  encouragement?: string | null;
  detectedIssue?: string | null;
  suggestedAction?: string | null;
  createdAt: string;
}

export interface TutorAPIResponse {
  success: boolean;
  conversationId: string;
  message: TutorMessageDTO;
  providerInfo: {
    provider: string;
    model: string;
  };
  rateLimit?: {
    remaining: number;
    resetInSeconds: number;
  };
}

export interface TeacherAISettings {
  aiTutorEnabled: boolean;
  maxHintLevel: number;
  model: string;
  allowDirectStudentChat: boolean;
  provider: string;
}

// -------------------------------------------------------------
// PHASE 8: AI MISTAKE ANALYZER TYPES
// -------------------------------------------------------------

export type MistakeCategoryType =
  | "CALCULATION_ERROR"
  | "CONCEPTUAL_MISUNDERSTANDING"
  | "PREREQUISITE_GAP"
  | "APPLICATION_DIFFICULTY"
  | "SIGN_ERROR"
  | "PROCEDURAL_ERROR"
  | "READING_OR_INTERPRETATION_ERROR"
  | "INCONSISTENT_PERFORMANCE"
  | "POSSIBLE_CARELESS_ERROR"
  | "QUESTION_TYPE_DIFFICULTY"
  | "UNKNOWN";

export type AnalysisStatusType = "PENDING" | "COMPLETED" | "FAILED" | "OUTDATED";

export type AnalysisTriggerType =
  | "PRACTICE_COMPLETED"
  | "TEACHER_REQUESTED"
  | "N_NEW_ATTEMPTS"
  | "SKILL_THRESHOLD_REACHED";

export interface QuestionAttemptDetail {
  id: string;
  studentId: string;
  questionId: string;
  practiceSessionId?: string | null;
  skillId?: string | null;
  answer: string;
  isCorrect: boolean;
  attemptNumber: number;
  timeTakenMs?: number | null;
  hintUsed: boolean;
  submittedAt: Date | string;
  question: {
    id: string;
    type: string;
    prompt: string;
    difficulty: string;
    explanation?: string | null;
    questionData?: string | null;
    correctFeedback?: string | null;
    incorrectFeedback?: string | null;
  };
}

export interface DeterministicAnalysisResult {
  totalAttempts: number;
  correctCount: number;
  incorrectCount: number;
  accuracyPercentage: number;
  recentTrend: "IMPROVING" | "DECLINING" | "STABLE" | "INCONSISTENT";
  questionTypeDistribution: Record<
    string,
    { total: number; correct: number; incorrect: number }
  >;
  difficultyDistribution: Record<
    string,
    { total: number; correct: number; incorrect: number }
  >;
  hintUsageCount: number;
  retryCount: number;
  commonWrongAnswers: Array<{ answer: string; frequency: number }>;
  isolatedError: boolean;
  signErrorDetected: boolean;
  comparisonErrorDetected: boolean;
  prerequisiteGaps: Array<{
    prerequisiteSkillId: string;
    title: string;
    accuracy: number;
    totalAttempts: number;
  }>;
  strengthDetected: boolean;
}

export interface StructuredMistakeAnalysis {
  category: MistakeCategoryType;
  observation: string;
  pattern: string;
  possibleCause: string;
  confidence: number;
  recommendation: string;
  evidenceAttemptIds: string[];
}

export interface MistakeAnalysisEvidenceItem {
  attemptId: string;
  questionId: string;
  questionPrompt: string;
  questionType: string;
  difficulty: string;
  studentAnswer: string;
  isCorrect: boolean;
  attemptNumber: number;
  timeTakenMs?: number | null;
  submittedAt: string;
}

export interface MistakeAnalysisDTO {
  id: string;
  studentId: string;
  studentName?: string;
  skillId?: string | null;
  skillTitle?: string | null;
  lessonId?: string | null;
  lessonTitle?: string | null;
  practiceSessionId?: string | null;
  category: MistakeCategoryType;
  observation: string;
  pattern: string;
  possibleCause?: string | null;
  confidence: number;
  recommendation: string;
  evidenceSummary?: string | null;
  status: AnalysisStatusType;
  trigger: AnalysisTriggerType;
  analyzerVersion: string;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
  evidences: MistakeAnalysisEvidenceItem[];
}

// -------------------------------------------------------------
// PHASE 21: CONTENT-GROUNDED QUESTION GENERATION TYPES
// -------------------------------------------------------------

export interface GenerateQuestionParams {
  lessonId?: string;
  skillId?: string;
  difficulty?: "EASY" | "MEDIUM" | "HARD";
  questionType?: string;
  targetMisconception?: string;
  studentWeakness?: string;
  studentMistakePattern?: string;
  recentQuestionPrompts?: string[];
  teacherDocumentSource?: string;
  requestedByRole?: string;
  count?: number;
}

export interface GeneratedQuestionPayload {
  prompt: string;
  type: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  questionData: string; // JSON with choices, correctAnswer, etc.
  expectedAnswer: any;
  explanation: string;
  correctFeedback: string;
  incorrectFeedback: string;
  learningObjective: string;
  sourceContext: string;
  misconceptionTargets?: string[];
  explainability?: {
    source: string;
    concept: string;
    difficulty: string;
    reason: string;
  };
}

export interface GeneratedQuestionValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  deterministicVerified: boolean;
}

export interface GeneratedQuestionResult {
  success: boolean;
  question?: GeneratedQuestionPayload;
  validation: GeneratedQuestionValidationResult;
  metadata: {
    lessonId?: string;
    skillId?: string;
    difficulty: string;
    questionType: string;
    learningObjective: string;
    sourceContext: string;
    generatorVersion: string;
    explainability?: any;
  };
}


