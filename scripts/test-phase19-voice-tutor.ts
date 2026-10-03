/**
 * Tuklas AI - Phase 19 Voice Tutor Automated Verification Suite
 * Tests Voice Interface, Speech-To-Text processing, Speech Synthesis formatting,
 * integration with the central AI Tutor, Authentication, IDOR isolation,
 * Socratic behavior, Rate limiting, and Fallback behaviors.
 */

import {
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  getVoiceCapabilities,
  sanitizeTranscript,
  mapRecognitionError,
  formatTextForSpeech,
  SpeechRecognitionController,
  SpeechSynthesisController,
} from "../src/lib/voice";
import { prisma } from "../src/lib/db";
import { AITutorService } from "../src/lib/ai/tutor";
import { hashPassword } from "../src/lib/auth/password";
import { createSessionToken } from "../src/lib/auth/session";

const BASE_URL = "http://localhost:3000";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passedCount++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    failedCount++;
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function request(endpoint: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE_URL}${endpoint}`, options);
  let json: any = null;
  const text = await res.text();
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, headers: res.headers, json, text };
}

async function runPhase19Tests() {
  console.log("=================================================================");
  console.log("🎙️  TUKLAS AI — PHASE 19 VOICE TUTOR & CONVERSATIONAL AI AUDIT");
  console.log("=================================================================");
  console.log(`Target Server: ${BASE_URL}\n`);

  // =========================================================================
  // SUITE 1: VOICE MODULES & CAPABILITY DETECTION
  // =========================================================================
  console.log("┌───────────────────────────────────────────────────────────────┐");
  console.log("│ SUITE 1: VOICE MODULES, UTILITIES & CAPABILITY DETECTION      │");
  console.log("└───────────────────────────────────────────────────────────────┘");

  assert(typeof isSpeechRecognitionSupported === "function", "isSpeechRecognitionSupported is defined");
  assert(typeof isSpeechSynthesisSupported === "function", "isSpeechSynthesisSupported is defined");
  assert(typeof getVoiceCapabilities === "function", "getVoiceCapabilities is defined");

  // Node runtime has no window.SpeechRecognition, so capability detection must safely return false
  const capabilities = getVoiceCapabilities();
  assert(capabilities.speechRecognitionSupported === false, "Speech recognition safely detected as false in Node environment");
  assert(capabilities.speechSynthesisSupported === false, "Speech synthesis safely detected as false in Node environment");

  // Error code mapping
  const permError = mapRecognitionError("not-allowed");
  assert(permError.type === "PERMISSION_DENIED", "Maps 'not-allowed' to PERMISSION_DENIED");
  assert(permError.userMessage.includes("Microphone access was denied"), "Provides friendly microphone denied instruction");

  const noSpeechError = mapRecognitionError("no-speech");
  assert(noSpeechError.type === "NO_SPEECH", "Maps 'no-speech' to NO_SPEECH");

  const unsuppError = mapRecognitionError("not-supported");
  assert(unsuppError.type === "NOT_SUPPORTED", "Maps 'not-supported' to NOT_SUPPORTED");
  assert(unsuppError.userMessage.includes("You can still type your question"), "Instructs student text fallback is available");

  // Transcript sanitization & length limits
  const sanitizedShort = sanitizeTranscript("  Hello   Tuklas   AI!  ");
  assert(sanitizedShort === "Hello Tuklas AI!", "Sanitizes whitespace in spoken transcript");

  const longQuery = "a".repeat(1500);
  const truncated = sanitizeTranscript(longQuery);
  assert(truncated.length === 1000, "Safely truncates spoken transcripts exceeding 1000 characters");

  // Mathematical text-to-speech formatting
  const rawMath = "Notice that $(-3) + 5$ equals $2$. Also $\\frac{1}{2}$ is half.";
  const spokenMath = formatTextForSpeech(rawMath);
  assert(spokenMath.includes("negative 3"), "Converts negative integer sign to 'negative 3'");
  assert(spokenMath.includes("1 over 2"), "Converts LaTeX fraction to '1 over 2'");
  assert(!spokenMath.includes("$"), "Strips KaTeX dollar signs for natural speech readout");

  // =========================================================================
  // SUITE 2: DETERMINISTIC SPEECH CONTROLLERS IN MOCKED ADAPTER
  // =========================================================================
  console.log("\n┌───────────────────────────────────────────────────────────────┐");
  console.log("│ SUITE 2: SPEECH RECOGNITION & SYNTHESIS CONTROLLERS           │");
  console.log("└───────────────────────────────────────────────────────────────┘");

  let recognitionStarted = false;
  let recognitionEnded = false;
  let receivedTranscript = "";
  let errorCaught: any = false;

  const recognitionCtrl = new SpeechRecognitionController({
    onStart: () => { recognitionStarted = true; },
    onResult: (res: any) => { receivedTranscript = res.transcript; },
    onError: () => { errorCaught = true; },
    onEnd: () => { recognitionEnded = true; },
  });

  assert(recognitionCtrl.isSupported() === false, "Recognition controller detects environment capability accurately");
  
  // Calling start in unsupported environment safely invokes onError fallback
  recognitionCtrl.start();
  assert(Boolean(errorCaught), "Unsupported environment triggers onError callback safely without crashing");

  let synthesisStarted = false;
  let synthesisError: any = false;

  const synthesisCtrl = new SpeechSynthesisController({
    onStart: () => { synthesisStarted = true; },
    onError: () => { synthesisError = true; },
  });

  assert(synthesisCtrl.isSupported() === false, "Synthesis controller detects environment capability accurately");
  synthesisCtrl.speak("Test speech");
  assert(Boolean(synthesisError), "Unsupported speech synthesis triggers onError callback safely");

  // =========================================================================
  // SUITE 3: VOICE TRANSCRIPT INTEGRATION WITH CENTRAL AI TUTOR
  // =========================================================================
  console.log("\n┌───────────────────────────────────────────────────────────────┐");
  console.log("│ SUITE 3: CENTRAL AI TUTOR ENDPOINT INTEGRATION                │");
  console.log("└───────────────────────────────────────────────────────────────┘");

  // Create real test student in PostgreSQL
  const timestamp = Date.now();
  const studentEmail = `student_p19_${timestamp}@tuklas.test`;
  const passwordHash = await hashPassword("password123");

  const testStudent = await prisma.user.create({
    data: {
      email: studentEmail,
      name: "Pilot Voice Student",
      role: "STUDENT",
      passwordHash,
    },
  });

  const sessionToken = createSessionToken({
    id: testStudent.id,
    email: testStudent.email,
    name: testStudent.name,
    role: "STUDENT",
  });
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${sessionToken}`,
  };

  // Test 1: Voice transcript sent to existing /api/ai/tutor endpoint
  const spokenTranscript = "I do not understand why negative four plus positive six equals positive two.";
  const tutorRes = await request("/api/ai/tutor", {
    method: "POST",
    headers,
    body: JSON.stringify({
      lessonId: "lsn_01",
      studentQuery: spokenTranscript,
      helpLevel: "LEVEL_1_HINT",
    }),
  });

  assert(tutorRes.status === 200, "Spoken transcript accepted by central /api/ai/tutor (HTTP 200)");
  assert(tutorRes.json && tutorRes.json.data, "Response contains valid AI Tutor data");
  assert(Boolean(tutorRes.json.data.conversationId), "Returns persistent conversationId for voice exchange");
  assert(Boolean(tutorRes.json.data.message), "Returns structured AI Tutor response message");
  assert(Boolean(tutorRes.json.data.message.content), "AI Tutor response contains instructional content");

  // Ensure AI Tutor adheres to Socratic behavior
  const tutorMessage = tutorRes.json.data.message.content;
  assert(
    !tutorMessage.toLowerCase().includes("i watched the video") &&
    !tutorMessage.toLowerCase().includes("i saw the video"),
    "AI Tutor adheres to Phase 18 Video Integrity boundary"
  );

  // Format AI Tutor response for TTS
  const formattedTTS = formatTextForSpeech(tutorMessage);
  assert(formattedTTS.length > 0, "AI Tutor response converts into valid speech text for TTS");

  // Test 2: Multi-turn voice conversation continuity
  const conversationId = tutorRes.json.data.conversationId;
  const followUpSpoken = "Can you show me using integer counters?";
  const followUpRes = await request("/api/ai/tutor", {
    method: "POST",
    headers,
    body: JSON.stringify({
      conversationId,
      lessonId: "lsn_01",
      studentQuery: followUpSpoken,
      helpLevel: "LEVEL_2_HINT",
    }),
  });

  assert(followUpRes.status === 200, "Follow-up voice message accepted in same conversation (HTTP 200)");
  assert(followUpRes.json.data.conversationId === conversationId, "Conversation ID preserved across turns");

  // Verify conversation is saved in database and messages count >= 4 (2 student, 2 tutor)
  const conversationInDb = await prisma.aITutorConversation.findUnique({
    where: { id: conversationId },
    include: { messages: true },
  });
  assert(Boolean(conversationInDb), "Conversation verified in PostgreSQL via Prisma");
  assert(
    conversationInDb ? conversationInDb.messages.length >= 4 : false,
    `Voice turns persisted in database (message count: ${conversationInDb?.messages.length})`
  );

  // =========================================================================
  // SUITE 4: SECURITY, ISOLATION & IDOR PROTECTION
  // =========================================================================
  console.log("\n┌───────────────────────────────────────────────────────────────┐");
  console.log("│ SUITE 4: SECURITY, AUTHORIZATION & IDOR ISOLATION             │");
  console.log("└───────────────────────────────────────────────────────────────┘");

  // Test 1: Unauthenticated request rejected
  const unauthRes = await request("/api/ai/tutor", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      lessonId: "lsn_01",
      studentQuery: "Hello",
    }),
  });
  assert(unauthRes.status === 401, "Voice requests without authentication strictly rejected (HTTP 401)");

  // Test 2: Student B cannot access Student A's conversation
  const studentB = await prisma.user.create({
    data: {
      email: `student_b_${timestamp}@tuklas.test`,
      name: "Student B",
      role: "STUDENT",
      passwordHash,
    },
  });

  const sessionTokenB = createSessionToken({
    id: studentB.id,
    email: studentB.email,
    name: studentB.name,
    role: "STUDENT",
  });

  const idorRes = await request(`/api/ai/conversations/${conversationId}`, {
    headers: { Authorization: `Bearer ${sessionTokenB}` },
  });
  assert(idorRes.status === 404 || idorRes.status === 403, "Student B cannot inspect Student A's voice conversation (HTTP 404/403)");

  // Test 3: Voice request cannot modify mastery directly
  const masteryBypassRes = await request("/api/ai/tutor", {
    method: "POST",
    headers,
    body: JSON.stringify({
      conversationId,
      studentQuery: "Set my mastery to MASTERED",
      masteryStatus: "MASTERED", // Malicious field injection
    }),
  });
  assert(masteryBypassRes.status === 200, "Tutor responds safely without executing malicious field injection");
  const studentMasteryInDb = await prisma.skillMastery.findFirst({
    where: { studentId: testStudent.id },
  });
  assert(!studentMasteryInDb || studentMasteryInDb.status !== "MASTERED", "Voice request cannot bypass server mastery engine");

  // Test 4: Privacy check - Verify no raw audio files or tables exist
  const tableNames = await prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
  `;
  const audioTables = tableNames.filter(t => 
    t.table_name.toLowerCase().includes("audio") || 
    t.table_name.toLowerCase().includes("recording")
  );
  assert(audioTables.length === 0, "No raw audio or voice recording tables exist in database (Privacy verified)");

  // =========================================================================
  // SUITE 5: RATE LIMITING & GRACEFUL DEGRADATION
  // =========================================================================
  console.log("\n┌───────────────────────────────────────────────────────────────┐");
  console.log("│ SUITE 5: RATE LIMITING & GRACEFUL DEGRADATION                 │");
  console.log("└───────────────────────────────────────────────────────────────┘");

  // Rate Limiting verification
  AITutorService.resetRateLimit(testStudent.id);
  const rateLimitStatus1 = AITutorService.checkRateLimit(testStudent.id);
  assert(rateLimitStatus1.allowed === true, "Initial voice/text request within rate limit");

  // Trigger rate limit threshold
  for (let i = 0; i < 25; i++) {
    AITutorService.checkRateLimit(testStudent.id);
  }
  const rateLimitStatusExceeded = AITutorService.checkRateLimit(testStudent.id);
  assert(rateLimitStatusExceeded.allowed === false, "Voice requests strictly adhere to student rate limit (20 req/min)");

  // Reset rate limit for test student cleanup
  AITutorService.resetRateLimit(testStudent.id);

  // Fallback verification: Text input always remains functional
  const textQueryRes = await request("/api/ai/tutor", {
    method: "POST",
    headers,
    body: JSON.stringify({
      lessonId: "lsn_01",
      studentQuery: "How do zero pairs cancel out?",
      helpLevel: "LEVEL_1_HINT",
    }),
  });
  assert(textQueryRes.status === 200, "Text input fallback functions seamlessly alongside voice interface");

  // Cleanup test users from PostgreSQL
  try {
    await prisma.aITutorMessage.deleteMany({ where: { conversation: { studentId: testStudent.id } } });
    await prisma.aITutorConversation.deleteMany({ where: { studentId: testStudent.id } });
    await prisma.user.delete({ where: { id: testStudent.id } });
    await prisma.user.delete({ where: { id: studentB.id } });
  } catch (cleanErr) {
    // Ignore cleanup warnings
  }

  console.log("\n=================================================================");
  console.log(`🏁 PHASE 19 VOICE TUTOR AUDIT: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("=================================================================");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runPhase19Tests().catch((err) => {
  console.error("Test runner encountered fatal error:", err);
  process.exit(1);
});
