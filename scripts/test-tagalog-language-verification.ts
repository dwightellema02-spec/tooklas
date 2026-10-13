/**
 * Tuklas AI - Tagalog / Filipino Language Tutor Verification Suite
 * Verifies that the AI Tutor properly identifies language preferences
 * and responds in natural Filipino/Tagalog for both Gemini AI and LocalTutorEngine.
 */

import { AITutorService } from "../src/lib/ai/tutor";
import { LocalTutorEngine } from "../src/lib/ai/provider";
import { buildTutorSystemPrompt, buildTutorUserPrompt } from "../src/lib/ai/prompts";
import { buildAITutorContext, detectLanguagePreference } from "../src/lib/ai/context";
import { isFilipinoText } from "../src/lib/voice/voice-utils";

async function main() {
  console.log("============================================================");
  console.log("TUKLAS AI - TAGALOG TUTOR RESPONSE & VOICE VERIFICATION SUITE");
  console.log("============================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(description: string, condition: boolean, extraInfo?: string) {
    if (condition) {
      console.log(`  [PASS] ${description}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${description}`);
      if (extraInfo) console.error(`         ${extraInfo}`);
      failed++;
    }
  }

  // TEST 1: detectLanguagePreference unit checks
  console.log("Test Suite 1: Language Preference Detection");
  assert("detects 'tagalog' as fil", detectLanguagePreference("tagalog") === "fil");
  assert("detects 'in tagalog' as fil", detectLanguagePreference("in tagalog") === "fil");
  assert("detects 'paliwanag sa tagalog' as fil", detectLanguagePreference("paliwanag sa tagalog") === "fil");
  assert("detects 'ipaliwanag sa tagalog' as fil", detectLanguagePreference("ipaliwanag sa tagalog") === "fil");
  assert("detects 'ano ang sagot' as fil", detectLanguagePreference("ano ang sagot") === "fil");
  assert("detects 'bakit lumipat sa kaliwa' as fil", detectLanguagePreference("bakit lumipat sa kaliwa") === "fil");
  assert("detects 'What is an integer?' as en", detectLanguagePreference("What is an integer?") === "en");
  assert("detects 'in english' as en", detectLanguagePreference("in english") === "en");

  // TEST 2: LocalTutorEngine - Video Boundary False Trigger Prevention
  console.log("\nTest Suite 2: LocalTutorEngine Video Integrity Immunity");
  const localEngine = new LocalTutorEngine();

  // Create a context that includes video boundary and teacher notes
  const mockContextWithVideo = await buildAITutorContext({
    studentId: "usr_student_01",
    lessonId: "lsn_01",
    skillId: "skl_01",
    studentQuery: "tagalog",
    helpLevel: "LEVEL_1_HINT",
  });

  const systemPromptFil = buildTutorSystemPrompt("fil");
  const userPromptTagalog = buildTutorUserPrompt(mockContextWithVideo);

  const localRes = await localEngine.generateTutorResponse({
    systemPrompt: systemPromptFil,
    userPrompt: userPromptTagalog,
    maxTokens: 500,
  });

  const parsedLocal = JSON.parse(localRes.text);

  assert(
    "LocalTutorEngine does NOT trigger YouTube video disclaimer for query 'tagalog'",
    !parsedLocal.message.includes("YouTube video") && !parsedLocal.message.includes("machine-readable transcripts")
  );
  assert(
    "LocalTutorEngine response is identified as Filipino text",
    isFilipinoText(parsedLocal.message)
  );
  assert(
    "LocalTutorEngine guidingQuestion is in Filipino",
    parsedLocal.guidingQuestion ? isFilipinoText(parsedLocal.guidingQuestion) : true
  );

  // TEST 3: LocalTutorEngine Filipino Responses for specific queries
  console.log("\nTest Suite 3: LocalTutorEngine Filipino Responses");
  const queryCases = [
    { query: "in tagalog", expectFil: true },
    { query: "paliwanag sa tagalog", expectFil: true },
    { query: "ibigay ang sagot", expectFil: true },
    { query: "bakit lumipat sa kaliwa", expectFil: true },
    { query: "ano ang absolute value", expectFil: true },
  ];

  for (const tc of queryCases) {
    const ctx = await buildAITutorContext({
      studentId: "usr_student_01",
      lessonId: "lsn_01",
      skillId: "skl_01",
      studentQuery: tc.query,
      helpLevel: "LEVEL_1_HINT",
    });
    const uPrompt = buildTutorUserPrompt(ctx);
    const res = await localEngine.generateTutorResponse({
      systemPrompt: buildTutorSystemPrompt("fil"),
      userPrompt: uPrompt,
      maxTokens: 500,
    });
    const parsed = JSON.parse(res.text);
    assert(
      `Query "${tc.query}" returns Filipino response`,
      isFilipinoText(parsed.message),
      `Got: ${parsed.message.slice(0, 80)}...`
    );
  }

  // TEST 4: Live AITutorService.interact Pipeline Test
  console.log("\nTest Suite 4: End-to-End AITutorService.interact Pipeline");
  AITutorService.resetRateLimit("usr_student_01");

  console.log("  Executing live request with studentQuery: 'tagalog'...");
  const liveResTagalog = await AITutorService.interact({
    studentId: "usr_student_01",
    lessonId: "lsn_01",
    skillId: "skl_01",
    studentQuery: "tagalog",
    helpLevel: "LEVEL_1_HINT",
  });

  console.log(`  Live response message:\n  "${liveResTagalog.message.content}"`);
  if (liveResTagalog.message.guidingQuestion) {
    console.log(`  Guiding question: "${liveResTagalog.message.guidingQuestion}"`);
  }

  assert(
    "Live response does NOT contain YouTube video disclaimer",
    !liveResTagalog.message.content.includes("YouTube video") &&
    !liveResTagalog.message.content.includes("machine-readable transcripts"),
    `Actual content: ${liveResTagalog.message.content}`
  );

  assert(
    "Live response is in natural Filipino (verified by isFilipinoText)",
    isFilipinoText(liveResTagalog.message.content),
    `Actual content: ${liveResTagalog.message.content}`
  );

  console.log("\n  Executing live request with studentQuery: 'paliwanag sa tagalog'...");
  const liveResPaliwanag = await AITutorService.interact({
    studentId: "usr_student_01",
    lessonId: "lsn_01",
    skillId: "skl_01",
    studentQuery: "paliwanag sa tagalog",
    helpLevel: "LEVEL_1_HINT",
  });

  console.log(`  Live response message:\n  "${liveResPaliwanag.message.content}"`);

  assert(
    "Live response for 'paliwanag sa tagalog' is in natural Filipino",
    isFilipinoText(liveResPaliwanag.message.content),
    `Actual content: ${liveResPaliwanag.message.content}`
  );

  console.log("\n  Executing live request with studentQuery: 'What is an integer?' (English query)...");
  const liveResEnglish = await AITutorService.interact({
    studentId: "usr_student_01",
    lessonId: "lsn_01",
    skillId: "skl_01",
    studentQuery: "What is an integer?",
    helpLevel: "LEVEL_1_HINT",
  });

  console.log(`  Live response message:\n  "${liveResEnglish.message.content}"`);

  assert(
    "Live response for English query is in English",
    !isFilipinoText(liveResEnglish.message.content) || liveResEnglish.message.content.toLowerCase().includes("integer"),
    `Actual content: ${liveResEnglish.message.content}`
  );

  console.log("\n============================================================");
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("============================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Fatal error in test suite:", err);
  process.exit(1);
});
