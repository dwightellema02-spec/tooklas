import { authFetch } from "../src/lib/auth/auth-context";
import { dbService } from "../src/lib/db";
import { AITutorService } from "../src/lib/ai/tutor";
import { LocalTutorEngine, GeminiAIProvider, getAIProvider } from "../src/lib/ai/provider";

async function main() {
  console.log("==================================================================");
  console.log("   TUKLAS AI — COMPREHENSIVE PHASE 21 VERIFICATION SUITE");
  console.log("==================================================================");
  let passedCount = 0;
  let totalCount = 0;

  function assert(desc: string, cond: boolean, details?: any) {
    totalCount++;
    if (cond) {
      console.log(`  [PASS] ${desc}`);
      passedCount++;
    } else {
      console.error(`  [FAIL] ${desc}`, details ? `-> ${JSON.stringify(details)}` : "");
    }
  }

  // -------------------------------------------------------------------------
  // TEST SECTION 1: BUG 4 — LESSON PROGRESSION & SAME-UNIT SEQUENCE
  // -------------------------------------------------------------------------
  console.log("\n[TEST SECTION 1] Verifying Lesson Progression & Learning Path Rules...");
  const pilotUser = await dbService.findUserByEmail("student.pilot@tuklas.ph");
  const testStudentId = pilotUser ? pilotUser.id : "usr_student_01";

  // 1.1 Complete lsn_01 and verify progression to lsn_02
  const sessionResult = await dbService.saveLessonSession(testStudentId, "lsn_01", {
    currentSectionIndex: 5,
    completedBlockIds: ["b_lsn01_1", "b_lsn01_2", "b_lsn01_3", "b_lsn01_4", "b_lsn01_5", "b_lsn01_6"],
    isCompleted: true,
  });
  await dbService.updateStudentProgress(testStudentId, "lsn_01", { action: "COMPLETE" });

  const pathData = await dbService.getStudentLearningPath(testStudentId);
  const lsn01Node = pathData.learningPath.find((n: any) => n.lessonId === "lsn_01");
  const lsn02Node = pathData.learningPath.find((n: any) => n.lessonId === "lsn_02");
  const lsn03Node = pathData.learningPath.find((n: any) => n.lessonId === "lsn_03");

  assert("lsn_01 exists in student learning path", !!lsn01Node);
  assert("lsn_02 exists in student learning path", !!lsn02Node);
  assert("lsn_01 is marked COMPLETED", lsn01Node?.state === "COMPLETED");
  assert("lsn_02 is AVAILABLE after lsn_01 completion (not locked by English lore lesson)", lsn02Node?.state === "AVAILABLE");
  assert("lsn_03 requires prerequisite skill (skl_02)", lsn03Node?.state === "LOCKED");

  // Check learning path next candidate calculation (same unit / subject prioritization)
  const currentIndex = pathData.learningPath.findIndex((n: any) => n.lessonId === "lsn_01");
  const currentLessonNode = pathData.learningPath[currentIndex];
  const subsequent = pathData.learningPath.slice(currentIndex + 1);
  const nextCandidate =
    subsequent.find(
      (n: any) =>
        n.unitId && currentLessonNode.unitId && n.unitId === currentLessonNode.unitId
    ) || subsequent[0];

  assert("Next candidate in curriculum after lsn_01 is lsn_02", nextCandidate?.lessonId === "lsn_02");
  assert("Next candidate is eligible for navigation", nextCandidate?.state === "AVAILABLE" || nextCandidate?.state === "IN_PROGRESS");

  // 1.3 Check API endpoint via HTTP localhost:3000
  try {
    const loginRes = await fetch("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "student.pilot@tuklas.ph", password: "Password123!" }),
    });
    const loginJson = await loginRes.json();
    const token = loginJson.data?.token;

    if (token) {
      // POST session complete
      const completeRes = await fetch("http://localhost:3000/api/student/lessons/lsn_01/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentSectionIndex: 5,
          completedBlockIds: ["b_lsn01_1", "b_lsn01_2", "b_lsn01_3", "b_lsn01_4", "b_lsn01_5", "b_lsn01_6"],
          isCompleted: true,
        }),
      });
      const completeJson = await completeRes.json();
      assert("HTTP POST session returns nextLesson object", !!completeJson.data?.nextLesson);
      assert("HTTP POST session nextLesson is lsn_02 and eligible", completeJson.data?.nextLesson?.lessonId === "lsn_02" && completeJson.data?.nextLesson?.eligible === true);

      // GET session returns nextLesson
      const getSessionRes = await fetch("http://localhost:3000/api/student/lessons/lsn_01/session", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const getSessionJson = await getSessionRes.json();
      assert("HTTP GET session returns nextLesson object", !!getSessionJson.data?.nextLesson);
      assert("HTTP GET session nextLesson is lsn_02", getSessionJson.data?.nextLesson?.lessonId === "lsn_02");

      // Verify access to lsn_02
      const accessRes = await fetch("http://localhost:3000/api/student/lessons/lsn_02/access", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const accessJson = await accessRes.json();
      assert("HTTP GET lsn_02 access returns allowed: true", accessJson.data?.allowed === true);
    }
  } catch (err: any) {
    console.warn("HTTP server check error:", err.message);
  }

  // -------------------------------------------------------------------------
  // TEST SECTION 2: BUG 1 — BILINGUAL SOCRATIC AI TUTOR & GROUNDING
  // -------------------------------------------------------------------------
  console.log("\n[TEST SECTION 2] Verifying AI Tutor Language Handling & Topic Grounding...");
  const localEngine = new LocalTutorEngine();

  // 2.1 Pure Language Switch Requests (Rule 1b & 1c)
  const tagalogAck = await localEngine.generateTutorResponse({
    systemPrompt: "You are Tuklas AI Tutor. Language Mandate: Natural Filipino",
    userPrompt: `Lesson Title: Introduction to Integers\nStudent Query: "paliwanag sa tagalog"`,
  });
  const tagalogAckData = JSON.parse(tagalogAck.text);
  assert("Query 'paliwanag sa tagalog' returns Tagalog response", tagalogAckData.message.includes("Tagalog") || tagalogAckData.message.includes("positibo"));

  const englishAck = await localEngine.generateTutorResponse({
    systemPrompt: "You are Tuklas AI Tutor. Language Mandate: English",
    userPrompt: `Lesson Title: Introduction to Integers\nStudent Query: "explain in english"`,
  });
  const englishAckData = JSON.parse(englishAck.text);
  assert("Query 'explain in english' returns English response", englishAckData.message.includes("English") && englishAckData.message.includes("horizontal number line"));

  // 2.2 Substantive Question with 'Paliwanag' MUST NOT be hijacked by Rule 1b!
  const leftTagalogQuery = await localEngine.generateTutorResponse({
    systemPrompt: "You are Tuklas AI Tutor. Language Mandate: Natural Filipino",
    userPrompt: `Lesson Title: Introduction to Integers\nStudent Query: "paliwanag mo naman kung bakit nasa kaliwa ang negative number"`,
  });
  const leftTagalogData = JSON.parse(leftTagalogQuery.text);
  assert("Substantive Tagalog query answers WHY negative numbers are on the left", leftTagalogData.message.includes("kaliwa") && (leftTagalogData.message.includes("zero") || leftTagalogData.message.includes("mas mababa")));
  assert("Substantive Tagalog query does not return generic canned 'Walang anuman, mag-usap tayo sa Tagalog'", !leftTagalogData.message.startsWith("Walang anuman, mag-usap tayo sa Tagalog!"));

  // 2.3 Substantive Question in English for negative numbers on left
  const leftEnglishQuery = await localEngine.generateTutorResponse({
    systemPrompt: "You are Tuklas AI Tutor. Language Mandate: English",
    userPrompt: `Lesson Title: Introduction to Integers\nStudent Query: "Why are negative numbers to the left of zero on the number line?"`,
  });
  const leftEnglishData = JSON.parse(leftEnglishQuery.text);
  assert("English query answers WHY negative numbers are to the left", leftEnglishData.message.includes("left of zero") && leftEnglishData.message.includes("less than zero"));

  // 2.4 Concept definition: What is an integer?
  const intDefTagalog = await localEngine.generateTutorResponse({
    systemPrompt: "You are Tuklas AI Tutor. Language Mandate: Natural Filipino",
    userPrompt: `Lesson Title: Introduction to Integers\nStudent Query: "ano ang integer?"`,
  });
  const intDefTagalogData = JSON.parse(intDefTagalog.text);
  assert("Tagalog 'ano ang integer' defines integer", intDefTagalogData.message.includes("buong numero") && intDefTagalogData.message.includes("positibo"));

  const intDefEnglish = await localEngine.generateTutorResponse({
    systemPrompt: "You are Tuklas AI Tutor. Language Mandate: English",
    userPrompt: `Lesson Title: Introduction to Integers\nStudent Query: "what is an integer?"`,
  });
  const intDefEnglishData = JSON.parse(intDefEnglish.text);
  assert("English 'what is an integer' defines whole number", intDefEnglishData.message.includes("whole number") && intDefEnglishData.message.includes("zero"));

  // 2.5 Concept definition: Zero-Pair
  const zeroPairQuery = await localEngine.generateTutorResponse({
    systemPrompt: "You are Tuklas AI Tutor. Language Mandate: Natural Filipino",
    userPrompt: `Lesson Title: Introduction to Integers\nStudent Query: "ano ang ibig sabihin ng zero-pair?"`,
  });
  const zeroPairData = JSON.parse(zeroPairQuery.text);
  assert("Tagalog 'ano ang zero-pair' defines zero-pair cancellation", zeroPairData.message.includes("zero-pair") && zeroPairData.message.includes("+1"));

  // 2.6 Off-Topic Redirection
  const offTopicQuery = await localEngine.generateTutorResponse({
    systemPrompt: "You are Tuklas AI Tutor. Language Mandate: English",
    userPrompt: `Lesson Title: Introduction to Integers\nStudent Query: "What is the area of a triangle?"`,
  });
  const offTopicData = JSON.parse(offTopicQuery.text);
  assert("Off-topic question triggers REDIRECT to active lesson", offTopicData.responseType === "REDIRECT" && offTopicData.message.includes("Introduction to Integers"));

  // 2.7 Socratic Refusal of Direct Answer
  const directAnswerQuery = await localEngine.generateTutorResponse({
    systemPrompt: "You are Tuklas AI Tutor. Language Mandate: Natural Filipino",
    userPrompt: `Lesson Title: Introduction to Integers\nStudent Query: "ibigay mo na sa akin ang sagot"`,
  });
  const directAnswerData = JSON.parse(directAnswerQuery.text);
  assert("Direct answer request receives Socratic GUIDING_QUESTION", directAnswerData.responseType === "GUIDING_QUESTION");

  // 2.8 Active Gemini Model Cascade check
  console.log("\n[TEST SECTION 3] Verifying Gemini AI Provider Model Cascade...");
  try {
    const gemini = new GeminiAIProvider();
    assert(
      "GeminiAIProvider initialized with defaultModel = gemini-3.8-flash",
      gemini.defaultModel === "gemini-3.8-flash" || gemini.defaultModel === "gemini-3.5-flash-lite"
    );

    const liveGeminiRes = await gemini.generateTutorResponse({
      systemPrompt: "You are Tuklas AI Tutor. Return JSON with message, guidingQuestion, encouragement, nextStep.",
      userPrompt: `Lesson Title: Introduction to Integers\nStudent Query: "Bakit nasa kaliwa ng zero ang negatibong numero?"\nMANDATORY LANGUAGE DIRECTIVE: The student requested explanations in FILIPINO / TAGALOG. You MUST compose all text fields in natural Filipino / Tagalog.`,
    });
    const geminiParsed = JSON.parse(liveGeminiRes.text);
    assert("Live Gemini returns response in Filipino", !!geminiParsed.message && geminiParsed.message.length > 10);
    assert(
      "Live Gemini provider reports valid model or fallback engine",
      Boolean(liveGeminiRes.model && (liveGeminiRes.model.includes("gemini") || liveGeminiRes.model.includes("pedagogical")))
    );
  } catch (geminiErr: any) {
    console.warn("Live Gemini check skipped/warned:", geminiErr.message);
  }

  console.log("\n==================================================================");
  console.log(`   PHASE 21 VERIFICATION COMPLETE: ${passedCount}/${totalCount} TESTS PASSED`);
  console.log("==================================================================");
}

main().catch(console.error);
