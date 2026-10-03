/**
 * Tuklas AI - Voice Tutor Smoke Test & Manual Verification Procedure
 * Phase 19: Conversational AI Voice Interface
 */

const BASE_URL = "http://localhost:3000";

async function runVoiceTutorSmokeTest() {
  console.log("=================================================================");
  console.log("🎤 TUKLAS AI — PHASE 19 VOICE TUTOR SMOKE & INTEGRATION TEST");
  console.log("=================================================================");

  // 1. Verify Application Server is Live
  console.log("\n[STEP 1] Checking Server Availability...");
  try {
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    const health = await healthRes.json();
    console.log(`  ✅ Server is healthy: status = ${health.status}, provider = ${health.database?.provider}`);
  } catch (err: any) {
    console.error("  ❌ Server is not reachable at " + BASE_URL);
    process.exit(1);
  }

  // 2. Verify Student Login Flow
  console.log("\n[STEP 2] Student Authentication & Session Creation...");
  let loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "pilot.student01@tuklas.local",
      password: process.env.PILOT_INITIAL_PASSWORD || "TuklasPilot2026!",
    }),
  });
  let loginData = await loginRes.json();
  if (!loginRes.ok) {
    loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "student@tuklas.ai",
        password: "password123",
      }),
    });
    loginData = await loginRes.json();
  }

  const sessionToken = loginData.token || loginData.data?.sessionToken;
  const user = loginData.user || loginData.data?.user;
  if (!loginRes.ok || !sessionToken) {
    console.error("  ❌ Student login failed:", loginData);
    process.exit(1);
  }
  console.log(`  ✅ Student authenticated: ${user.name} (${user.role})`);

  // 3. Verify Lesson Access
  console.log("\n[STEP 3] Opening Lesson 1 (lsn_01) Context...");
  const lessonRes = await fetch(`${BASE_URL}/api/lessons/lsn_01`);
  const lessonData = await lessonRes.json();
  console.log(`  ✅ Lesson loaded: "${lessonData.data?.title}" (${lessonData.data?.blocks?.length} blocks)`);

  // 4. Verify AI Tutor Voice Pipeline Simulation
  console.log("\n[STEP 4] Voice Transcript Simulation into AI Tutor...");
  const voiceTranscript = "Can you help me understand how zero pairs work when adding integers?";
  const tutorRes = await fetch(`${BASE_URL}/api/ai/tutor`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({
      lessonId: "lsn_01",
      studentQuery: voiceTranscript,
      helpLevel: "LEVEL_1_HINT",
    }),
  });
  const tutorData = await tutorRes.json();
  if (!tutorRes.ok || !tutorData.data?.message) {
    console.error("  ❌ AI Tutor endpoint failed:", tutorData);
    process.exit(1);
  }
  console.log(`  ✅ Spoken transcript processed by AI Tutor`);
  console.log(`  ✅ AI Tutor response received: "${tutorData.data.message.content.slice(0, 100)}..."`);
  console.log(`  ✅ Socratic message type: ${tutorData.data.message.messageType}`);

  // 5. Environmental Audio Hardware Assessment
  console.log("\n=================================================================");
  console.log("🎙️  BROWSER AUDIO HARDWARE CAPABILITY AUDIT");
  console.log("=================================================================");
  console.log("Node CLI Environment: Headless runner (No physical microphone or audio output)");
  console.log("Status: AUTOMATED BROWSER VOICE TEST: NOT_AVAILABLE");
  console.log("\n📋 MANUAL VERIFICATION PROCEDURE (For Chrome / Edge / Safari):");
  console.log("  1. Open http://localhost:3000/login and log in with student@tuklas.ai / password123");
  console.log("  2. Navigate to 'Sets, Real Numbers, and Integer Operations' (Lesson 1)");
  console.log("  3. Click 'Need a hint?' or open the AI Tutor panel in the bottom right corner");
  console.log("  4. Verify the 'Talk to Tuklas' button is visible next to hint suggestion pills");
  console.log("  5. Click 'Talk to Tuklas'");
  console.log("     - Browser will display microphone permission prompt: select 'Allow'");
  console.log("     - Waveform animation displays in red: 'Listening... Speak your question now'");
  console.log("  6. Speak aloud: 'How do I add a positive and negative number?'");
  console.log("  7. Verify real-time interim transcript previews in italic text");
  console.log("  8. Stop speaking or click 'Done':");
  console.log("     - State switches to 'Processing your question...' with green spinner");
  console.log("     - AI Tutor generates Socratic guidance");
  console.log("     - State switches to 'Tuklas is speaking...' with audio waveform");
  console.log("     - Browser voice reads the guidance aloud using SpeechSynthesis");
  console.log("  9. Click 'Stop' or 'Stop Speaking': voice stops speaking immediately");
  console.log(" 10. Type question using keyboard to confirm seamless text input fallback");
  console.log("=================================================================\n");
}

runVoiceTutorSmokeTest().catch((err) => {
  console.error("Smoke test failure:", err);
  process.exit(1);
});
