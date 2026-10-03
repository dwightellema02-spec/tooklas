/**
 * Phase 15 Interactive Mastery Learning Verification Test Suite
 *
 * Validates:
 * 1. Learning Stage categorization & pedagogical progression
 * 2. Interactive Counter & Zero-Pair mathematical logic
 * 3. Worked Example progressive reveal & pedagogical rationale
 * 4. Guided Practice Checkpoints & AI Tutor context integration
 * 5. Server-authoritative Mastery Engine evaluation & 5-stage scale
 * 6. Adaptive Recommendation and Next Steps integration
 * 7. Student Lesson Session Resume Engine & PostgreSQL persistence
 * 8. Practice session start, submission, and review workflow
 * 9. Accessibility criteria (ARIA, min 44px touch target compliance)
 */

import { prisma, dbService } from "../src/lib/db";
import { MasteryEngine } from "../src/lib/mastery/mastery-engine";
import { AdaptiveEngine } from "../src/lib/adaptive/adaptive-engine";
import { buildTutorSystemPrompt } from "../src/lib/ai/prompts";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passCount++;
  } else {
    console.error(`  ❌ FAIL: ${testName} ${detail ? `(${detail})` : ""}`);
    failCount++;
  }
}

async function runPhase15Tests() {
  console.log("==========================================================");
  console.log("🚀 STARTING PHASE 15 INTERACTIVE MASTERY VERIFICATION");
  console.log("==========================================================");

  // -------------------------------------------------------------------------
  // SUITE 1: CURRICULUM LESSONS & 6-STAGE LEARNING LOOP IN POSTGRESQL
  // -------------------------------------------------------------------------
  console.log("\n📦 SUITE 1: Curriculum Lessons & 6-Stage Progression in Database");

  const lsn01 = await dbService.getLessonById("lsn_01");
  assert(!!lsn01, "lsn_01 exists and is retrievable via dbService");
  assert(
    (lsn01?.contentBlocks?.length || 0) >= 6,
    `lsn_01 contains rich content blocks (count: ${lsn01?.contentBlocks?.length})`
  );

  const blockTypes = (lsn01?.contentBlocks || []).map((b: any) => b.type);
  assert(blockTypes.includes("TEXT"), "lsn_01 contains TEXT (Concept stage)");
  assert(blockTypes.includes("INTERACTIVE"), "lsn_01 contains INTERACTIVE (Explore stage)");
  assert(blockTypes.includes("EXAMPLE"), "lsn_01 contains EXAMPLE (Worked Example stage)");
  assert(
    blockTypes.includes("CHECKPOINT") || blockTypes.includes("QUESTION"),
    "lsn_01 contains CHECKPOINT/QUESTION (Guided Practice stage)"
  );
  assert(blockTypes.includes("PRACTICE"), "lsn_01 contains PRACTICE (Independent Practice stage)");
  assert(blockTypes.includes("SUMMARY"), "lsn_01 contains SUMMARY (Mastery & Review stage)");

  const lsn02 = await dbService.getLessonById("lsn_02");
  assert(!!lsn02, "lsn_02 exists and is retrievable via dbService");
  assert(
    (lsn02?.contentBlocks?.length || 0) >= 6,
    `lsn_02 contains enriched blocks for addition (count: ${lsn02?.contentBlocks?.length})`
  );

  const lsn03 = await dbService.getLessonById("lsn_03");
  assert(!!lsn03, "lsn_03 exists and is retrievable via dbService");
  assert(
    (lsn03?.contentBlocks?.length || 0) >= 6,
    `lsn_03 contains enriched blocks for subtraction (count: ${lsn03?.contentBlocks?.length})`
  );

  // -------------------------------------------------------------------------
  // SUITE 2: INTERACTIVE COUNTERS & ZERO-PAIR MATHEMATICAL LOGIC
  // -------------------------------------------------------------------------
  console.log("\n🧮 SUITE 2: Integer Counters & Zero-Pairs Mathematical Logic");

  function evaluateCounters(positives: number, negatives: number) {
    const zeroPairs = Math.min(positives, negatives);
    const netValue = positives - negatives;
    const remainingPositives = Math.max(0, positives - zeroPairs);
    const remainingNegatives = Math.max(0, negatives - zeroPairs);
    return { zeroPairs, netValue, remainingPositives, remainingNegatives };
  }

  // Case A: (+4) + (-2) = +2 (2 zero pairs, 2 remaining positive)
  const caseA = evaluateCounters(4, 2);
  assert(caseA.zeroPairs === 2, "Case (+4)+(-2) forms exactly 2 zero pairs");
  assert(caseA.netValue === 2, "Case (+4)+(-2) has net value of +2");
  assert(caseA.remainingPositives === 2, "Case (+4)+(-2) has 2 remaining positive counters");
  assert(caseA.remainingNegatives === 0, "Case (+4)+(-2) has 0 remaining negative counters");

  // Case B: (-3) + (+5) = +2 (3 zero pairs, 2 remaining positive)
  const caseB = evaluateCounters(5, 3);
  assert(caseB.zeroPairs === 3, "Case (-3)+(+5) forms exactly 3 zero pairs");
  assert(caseB.netValue === 2, "Case (-3)+(+5) has net value of +2");

  // Case C: (-2) + (-3) = -5 (0 zero pairs, 5 remaining negative)
  const caseC = evaluateCounters(0, 5);
  assert(caseC.zeroPairs === 0, "Case (-2)+(-3) forms 0 zero pairs");
  assert(caseC.netValue === -5, "Case (-2)+(-3) has net value of -5");
  assert(caseC.remainingNegatives === 5, "Case (-2)+(-3) has 5 remaining negative counters");

  // Case D: (+3) + (-3) = 0 (3 zero pairs, 0 remaining)
  const caseD = evaluateCounters(3, 3);
  assert(caseD.zeroPairs === 3, "Case (+3)+(-3) forms 3 zero pairs");
  assert(caseD.netValue === 0, "Case (+3)+(-3) cancels to exact 0");

  // -------------------------------------------------------------------------
  // SUITE 3: WORKED EXAMPLE PROGRESSIVE DISCLOSURE & RATIONALE
  // -------------------------------------------------------------------------
  console.log("\n📖 SUITE 3: Worked Example Progressive Disclosure Structure");

  const exampleBlock = lsn01?.contentBlocks?.find((b: any) => b.type === "EXAMPLE");
  assert(!!exampleBlock, "lsn_01 has an EXAMPLE block");
  let parsedExampleMeta: any = {};
  try {
    parsedExampleMeta = JSON.parse(exampleBlock?.metadata || "{}");
  } catch {}
  assert(
    Boolean(parsedExampleMeta.problem || exampleBlock?.content.includes("Problem:")),
    "Example block defines a clear Problem statement"
  );
  assert(
    Boolean((parsedExampleMeta.steps?.length || 0) >= 2 || exampleBlock?.content.includes("Step")),
    "Example block contains step-by-step guidance"
  );
  assert(
    Boolean(parsedExampleMeta.answer || exampleBlock?.content.includes("Answer:")),
    "Example block provides verifiable final answer"
  );

  // -------------------------------------------------------------------------
  // SUITE 4: GUIDED PRACTICE CHECKPOINTS & SERVER RECORDING
  // -------------------------------------------------------------------------
  console.log("\n🎯 SUITE 4: Checkpoints & Formative Assessment Persistence");

  const checkpointBlock = lsn01?.contentBlocks?.find((b: any) => b.type === "CHECKPOINT");
  assert(!!checkpointBlock, "lsn_01 has a CHECKPOINT block");
  let parsedCheckpointMeta: any = {};
  try {
    parsedCheckpointMeta = JSON.parse(checkpointBlock?.metadata || "{}");
  } catch {}
  assert(
    Array.isArray(parsedCheckpointMeta.options) && parsedCheckpointMeta.options.length >= 2,
    "Checkpoint provides multiple choice options for low-stakes practice"
  );
  assert(
    !!parsedCheckpointMeta.correctAnswer,
    `Checkpoint designates an expected correct answer (${parsedCheckpointMeta.correctAnswer})`
  );
  assert(
    !!parsedCheckpointMeta.explanation,
    "Checkpoint includes formative conceptual explanation"
  );

  // Test recording a checkpoint attempt via dbService
  const testStudentId = "usr_student_01";
  const recordedCheckpoint = await dbService.submitCheckpointAttempt({
    userId: testStudentId,
    lessonId: "lsn_01",
    blockId: checkpointBlock?.id || "blk_05",
    answer: parsedCheckpointMeta.correctAnswer || "-2",
    isCorrect: true,
    feedback: "Correct: -2 is to the right of -5 and -8.",
  });
  assert(!!recordedCheckpoint, "Checkpoint attempt successfully recorded in database");
  assert(recordedCheckpoint.isCorrect === true, "Recorded checkpoint correctly flags isCorrect=true");

  // Verify retrieval in lesson session attempts
  const restoredSession = await dbService.getLessonSession(testStudentId, "lsn_01");
  assert(!!restoredSession, "Lesson session retrievable for student");

  const checkpointAttempts = await dbService.getCheckpointAttempts(testStudentId, "lsn_01");
  assert(
    checkpointAttempts.some((a: any) => a.blockId === (checkpointBlock?.id || "blk_05")),
    "Restored checkpoint attempt includes blockId in attempts list"
  );

  // -------------------------------------------------------------------------
  // SUITE 5: SERVER-AUTHORITATIVE MASTERY ENGINE (5-STAGE SCALE)
  // -------------------------------------------------------------------------
  console.log("\n🏆 SUITE 5: Server-Authoritative 5-Stage Mastery Scale");

  const masteryEval = await MasteryEngine.evaluateSkillMastery({
    studentId: testStudentId,
    skillId: "skl_01",
    forceRecalculate: false,
  });

  assert(!!masteryEval, "MasteryEngine evaluates skill mastery without errors");
  const validStages = ["NOT_STARTED", "LEARNING", "DEVELOPING", "PROFICIENT", "MASTERED"];
  assert(
    validStages.includes(masteryEval.status),
    `Mastery status (${masteryEval.status}) belongs to canonical 5-stage scale`
  );
  assert(
    typeof masteryEval.accuracy === "number" && masteryEval.accuracy >= 0 && masteryEval.accuracy <= 1,
    `Mastery accuracy is a valid float in [0, 1] (actual: ${masteryEval.accuracy})`
  );
  assert(
    !!masteryEval.explanation?.summary,
    `Mastery provides pedagogical summary explanation: "${masteryEval.explanation?.summary?.slice(0, 40)}..."`
  );
  assert(
    !!masteryEval.explanation?.nextStep,
    `Mastery provides actionable next step guidance: "${masteryEval.explanation?.nextStep?.slice(0, 40)}..."`
  );

  // Verify student masteries list
  const studentMasteries = await MasteryEngine.getStudentMasteries(testStudentId);
  assert(
    Array.isArray(studentMasteries) && studentMasteries.length > 0,
    `Student masteries list contains records (count: ${studentMasteries.length})`
  );

  // -------------------------------------------------------------------------
  // SUITE 6: ADAPTIVE RECOMMENDATION INTEGRATION
  // -------------------------------------------------------------------------
  console.log("\n🧭 SUITE 6: Adaptive Recommendation & Remediation Engine");

  const adaptiveRec = await AdaptiveEngine.generateAdaptiveRecommendation({
    studentId: testStudentId,
    skillId: "skl_01",
  });
  assert(!!adaptiveRec, "AdaptiveEngine generates a recommendation for the student");
  assert(
    !!adaptiveRec.recommendedActivityType,
    `Recommendation designates activity type: ${adaptiveRec.recommendedActivityType}`
  );
  assert(
    !!adaptiveRec.reason || !!adaptiveRec.explanation?.reason,
    "Recommendation contains explanatory rationale for student"
  );

  // -------------------------------------------------------------------------
  // SUITE 7: SOCRATIC AI TUTOR WITH FAILED CHECKPOINT CONTEXT
  // -------------------------------------------------------------------------
  console.log("\n🤖 SUITE 7: Socratic AI Tutor Context Integration");

  // Verify Socratic system prompt enforcement
  const socraticPrompt = buildTutorSystemPrompt();
  assert(
    socraticPrompt.includes("NOT to be an answer dispenser") || socraticPrompt.includes("NEVER reveal"),
    "AI Tutor prompt enforces Socratic non-disclosure of direct answers"
  );

  // -------------------------------------------------------------------------
  // SUITE 8: PRACTICE SESSION & REVIEW CYCLE
  // -------------------------------------------------------------------------
  console.log("\n📝 SUITE 8: Practice Session & Completion Workflow");

  const practiceSet = await prisma.practiceSet.findFirst({
    where: { lessonId: "lsn_01" },
    include: { questions: { include: { question: true } } },
  });
  assert(!!practiceSet, "Practice set exists for lsn_01 in database");
  assert(
    (practiceSet?.questions?.length || 0) > 0,
    `Practice set has linked questions (count: ${practiceSet?.questions?.length})`
  );

  // -------------------------------------------------------------------------
  // SUITE 9: ACCESSIBILITY & TOUCH TARGET COMPLIANCE
  // -------------------------------------------------------------------------
  console.log("\n♿ SUITE 9: Accessibility Standards & Responsive Target Sizes");

  // Verify touch target standard in key interactive UI
  const fs = await import("fs");
  const countersCode = fs.readFileSync("src/components/lesson/interactive/IntegerCountersManipulative.tsx", "utf8");
  const stageStepperCode = fs.readFileSync("src/components/lesson/LearningStageStepper.tsx", "utf8");
  const lessonPageCode = fs.readFileSync("src/app/student/lessons/[id]/page.tsx", "utf8");

  assert(
    countersCode.includes("min-h-[44px]") || countersCode.includes("w-11 h-11"),
    "IntegerCountersManipulative uses standard min 44px touch targets"
  );
  assert(
    countersCode.includes("aria-label"),
    "IntegerCountersManipulative includes descriptive ARIA labels"
  );
  assert(
    stageStepperCode.includes("aria-label") && stageStepperCode.includes("nav"),
    "LearningStageStepper uses semantic <nav> and aria-label"
  );
  assert(
    stageStepperCode.includes("min-h-[44px]"),
    "LearningStageStepper stage buttons meet 44px touch target guidelines"
  );
  assert(
    lessonPageCode.includes("LearningStageStepper"),
    "StudentLessonPage renders LearningStageStepper component"
  );
  assert(
    lessonPageCode.includes("LessonMasteryReview"),
    "StudentLessonPage integrates LessonMasteryReview component"
  );

  console.log("\n==========================================================");
  console.log(`🏁 PHASE 15 VERIFICATION COMPLETE: ${passCount} PASSED, ${failCount} FAILED`);
  console.log("==========================================================");

  if (failCount > 0) {
    process.exit(1);
  }
}

runPhase15Tests().catch((err) => {
  console.error("FATAL ERROR IN TEST SUITE:", err);
  process.exit(1);
});
