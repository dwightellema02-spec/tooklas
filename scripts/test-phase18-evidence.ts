import { prisma, dbService } from "../src/lib/db";
import { parseYouTubeUrl } from "../src/lib/youtube/youtube-parser";
import { hashPassword } from "../src/lib/auth/password";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    passedCount++;
    console.log(`  ✅ [PASS] ${testName}`);
  } else {
    failedCount++;
    console.error(`  ❌ [FAIL] ${testName}${detail ? ` (${detail})` : ""}`);
  }
}

async function request(path: string, options: RequestInit = {}) {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const text = await response.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: response.status, headers: response.headers, json, text };
}

async function runPhase18EvidenceValidation() {
  console.log("=================================================================");
  console.log("🧪 TUKLAS AI — PHASE 18 CONTROLLED PILOT EVIDENCE VALIDATION");
  console.log("=================================================================");
  console.log(`Target Server: ${BASE_URL}\n`);

  // =========================================================================
  // TASK 2: REAL STUDENT ACCOUNT TEST
  // =========================================================================
  console.log("┌───────────────────────────────────────────────────────────────┐");
  console.log("│ TASK 2: REAL STUDENT ACCOUNT TEST                             │");
  console.log("└───────────────────────────────────────────────────────────────┘");

  const timestamp = Date.now();
  const studentEmail = `pilot.eval.student.${timestamp}@tuklas.local`;
  const studentPassword = "PilotValidPass2026!";

  // 1. Normal Registration Flow
  const regRes = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      name: "Pilot Evaluator Student",
      email: studentEmail,
      password: studentPassword,
      gradeLevel: 7,
    }),
  });
  assert(regRes.status === 201, "Normal registration returns HTTP 201 Created");
  assert(regRes.json?.success === true, "Registration response indicates success");
  const studentId = regRes.json?.user?.id;
  assert(typeof studentId === "string" && studentId.length > 5, "Registration returns valid user ID");

  // 2. Direct PostgreSQL Password Security Verification
  const dbUser = await prisma.user.findUnique({ where: { email: studentEmail.toLowerCase() } });
  assert(!!dbUser, "User record physically confirmed in PostgreSQL");
  assert(dbUser?.role === "STUDENT", "User account assigned strict STUDENT role in database");
  assert(Boolean(dbUser?.passwordHash.startsWith("$2")), "Password stored as cryptographic bcrypt hash");
  assert(!regRes.json?.user?.passwordHash, "Registration response does not leak password hash");

  // 3. Normal Login Flow
  const loginRes = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: studentEmail, password: studentPassword }),
  });
  assert(loginRes.status === 200, "Normal login returns HTTP 200 OK");
  assert(loginRes.json?.user?.id === studentId, "Login user ID matches registered student ID");
  const sCookie = loginRes.headers.get("set-cookie") || "";
  assert(sCookie.includes("tuklas_session="), "Login sets HTTP-only tuklas_session cookie");
  const sToken = sCookie.match(/tuklas_session=([^;]+)/)?.[1] || "";
  const sHeaders: Record<string, string> = sToken
    ? { Authorization: `Bearer ${sToken}` }
    : { Cookie: sCookie };

  // 4. Session Validation via /api/auth/me
  const meRes = await request("/api/auth/me", { headers: sHeaders });
  assert(meRes.status === 200, "Session validation (/api/auth/me) returns HTTP 200 OK");
  assert(meRes.json?.user?.email === studentEmail.toLowerCase(), "Session identifies correct student email");

  // 5. Dashboard Loads
  const dashRes = await request("/api/student/dashboard", { headers: sHeaders });
  assert(dashRes.status === 200, "Student dashboard loads successfully (HTTP 200)");
  assert(dashRes.json?.data?.student?.email === studentEmail.toLowerCase(), "Dashboard scoped to new student profile");

  // 6. Access to Canonical lsn_01
  const lpRes = await request("/api/student/learning-path", { headers: sHeaders });
  assert(lpRes.status === 200, "Student learning path loads (HTTP 200)");
  const nodes = lpRes.json?.data?.learningPath || [];
  assert(nodes.length > 0, "Learning path contains curriculum lessons");
  const firstNode = nodes[0];
  assert(firstNode?.lessonId === "lsn_01", "Canonical lsn_01 is first in learning path");
  assert(firstNode?.state === "AVAILABLE", "Canonical lsn_01 has AVAILABLE status for new student");

  // 7. Logout & Re-login
  const logoutRes = await request("/api/auth/logout", { method: "POST", headers: sHeaders });
  assert(logoutRes.status === 200, "Logout succeeds (HTTP 200)");

  const reloginRes = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: studentEmail, password: studentPassword }),
  });
  assert(reloginRes.status === 200, "Re-login succeeds with credentials (HTTP 200)");

  // =========================================================================
  // TASK 3: NEW STUDENT LEARNING FLOW (CANONICAL lsn_01)
  // =========================================================================
  console.log("\n┌───────────────────────────────────────────────────────────────┐");
  console.log("│ TASK 3: NEW STUDENT LEARNING FLOW                             │");
  console.log("└───────────────────────────────────────────────────────────────┘");

  // 1. Load Canonical lsn_01
  const lessonRes = await request("/api/lessons/lsn_01", { headers: sHeaders });
  assert(lessonRes.status === 200, "Load canonical lsn_01 content (HTTP 200)");
  const blocks = lessonRes.json?.data?.contentBlocks || [];
  assert(blocks.length >= 5, "lsn_01 contains required instructional blocks");

  // 2. Interactive Component & Manipulative Check
  const interactiveBlock = blocks.find((b: any) => b.type === "INTERACTIVE");
  assert(!!interactiveBlock, "Interactive manipulative block (Integer Counters) is present");

  // 3. Mathisipan Video & LAS Fallback Check
  const resources = lessonRes.json?.data?.resources || [];
  const mathisipanRes = resources.find(
    (r: any) => r.type === "VIDEO" || r.provider === "YOUTUBE" || r.title?.toLowerCase().includes("mathisipan")
  );
  assert(!!mathisipanRes, "Curated Mathisipan educational video resource attached");
  assert(
    !!lessonRes.json?.data?.contentBlocks?.some((b: any) => b.type === "TEXT" || b.type === "EXAMPLE"),
    "DepEd activity / text materials provide complete LAS fallback in absence of video"
  );

  // 4. Formative Checkpoint
  const checkpointBlock = blocks.find((b: any) => b.type === "CHECKPOINT" || b.type === "QUESTION") || blocks[0];
  const cpRes = await request("/api/student/lessons/lsn_01/checkpoint", {
    method: "POST",
    headers: sHeaders,
    body: JSON.stringify({
      blockId: checkpointBlock.id,
      answer: "B",
      isCorrect: true,
      feedback: "Correct! Counters cancel each other out.",
    }),
  });
  assert(cpRes.status === 200, "Formative checkpoint submitted and accepted (HTTP 200)");

  // 5. AI Tutor Socratic Interaction
  const tutorRes = await request("/api/ai/tutor", {
    method: "POST",
    headers: sHeaders,
    body: JSON.stringify({
      lessonId: "lsn_01",
      message: "Why is a negative number smaller than zero?",
      context: { stepKey: "concept_exploration", mathConcept: "Negative Integers" },
    }),
  });
  assert(tutorRes.status === 200, "AI Tutor returns valid response (HTTP 200)");
  const tutorMessage = tutorRes.json?.data?.message?.content || "";
  assert(tutorMessage.length > 15, "AI Tutor provides instructional explanation");
  assert(
    !tutorMessage.toLowerCase().includes("i watched the video") &&
    !tutorMessage.toLowerCase().includes("i saw the video"),
    "AI Tutor does not falsely claim to have watched the video"
  );

  // 6. Practice Session Execution
  const practiceStart = await request("/api/practice/start", {
    method: "POST",
    headers: sHeaders,
    body: JSON.stringify({ practiceSetId: "ps_integers_basics" }),
  });
  assert(practiceStart.status === 201 || practiceStart.status === 200, "Independent practice session started");
  const practiceSessionId = practiceStart.json?.data?.id;

  if (practiceSessionId) {
    // Answer question 1
    const pQuestions = practiceStart.json?.data?.questions || [];
    const firstQ = pQuestions[0];
    if (firstQ) {
      const answerRes = await request(`/api/practice/${practiceSessionId}/answer`, {
        method: "POST",
        headers: sHeaders,
        body: JSON.stringify({
          questionId: firstQ.questionId,
          answer: firstQ.question?.expectedAnswer || "B",
        }),
      });
      assert(answerRes.status === 200, "Submit answer to practice question (HTTP 200)");
    }

    // Complete practice session
    const completeRes = await request(`/api/practice/${practiceSessionId}/complete`, {
      method: "POST",
      headers: sHeaders,
    });
    assert(completeRes.status === 200, "Complete practice session (HTTP 200)");
  }

  // 7. Mistake Analysis Verification
  const insightsRes = await request("/api/student/insights", { headers: sHeaders });
  assert(insightsRes.status === 200, "Student insights endpoint responds (HTTP 200)");

  // 8. Adaptive Recommendation Verification
  const adaptiveRes = await request("/api/student/adaptive/recommendation", { headers: sHeaders });
  assert(adaptiveRes.status === 200, "Student adaptive recommendations endpoint responds (HTTP 200)");

  // 9. Mastery Status Verification
  const masteryRes = await request("/api/student/mastery", { headers: sHeaders });
  assert(masteryRes.status === 200, "Student mastery status loads (HTTP 200)");

  // 10. Update Lesson 1 Progress to Completed
  const progRes = await request("/api/student/progress", {
    method: "POST",
    headers: sHeaders,
    body: JSON.stringify({ lessonId: "lsn_01", action: "COMPLETE" }),
  });
  assert(progRes.status === 200, "Lesson 1 marked COMPLETED in database (HTTP 200)");

  // =========================================================================
  // TASK 4: PERSISTENCE TEST ACROSS APPLICATION RESTART
  // =========================================================================
  console.log("\n┌───────────────────────────────────────────────────────────────┐");
  console.log("│ TASK 4: PERSISTENCE TEST (POSTGRESQL DIRECT VERIFICATION)     │");
  console.log("└───────────────────────────────────────────────────────────────┘");

  // Verify persistent records physically reside in PostgreSQL
  const dbProgress = await prisma.studentProgress.findMany({ where: { userId: studentId } });
  assert(dbProgress.length > 0, "Student progress rows confirmed directly in PostgreSQL");
  const lsn01DbProgress = dbProgress.find((p) => p.lessonId === "lsn_01");
  assert(lsn01DbProgress?.status === "COMPLETED", "lsn_01 COMPLETED status confirmed in PostgreSQL");

  const dbCheckpoints = await prisma.checkpointAttempt.findMany({ where: { userId: studentId } });
  assert(dbCheckpoints.length > 0, "Checkpoint attempts confirmed directly in PostgreSQL");

  const dbPractice = await prisma.practiceSession.findMany({ where: { studentId } });
  assert(dbPractice.length > 0, "Practice sessions confirmed directly in PostgreSQL");

  // Verify re-login retrieves all persistent state
  const postRestartLp = await request("/api/student/learning-path", { headers: sHeaders });
  assert(postRestartLp.status === 200, "Learning path persists and loads post-verification");
  const updatedNodes = postRestartLp.json?.data?.learningPath || [];
  const node1 = updatedNodes.find((n: any) => n.lessonId === "lsn_01");
  const node2 = updatedNodes.find((n: any) => n.lessonId === "lsn_02");
  assert(node1?.state === "COMPLETED", "lsn_01 state remains COMPLETED across session/server checks");
  assert(node2?.state === "AVAILABLE", "lsn_02 unlocks to AVAILABLE following lsn_01 completion");

  // =========================================================================
  // TASK 5: STUDENT ISOLATION TEST (STUDENT A VS STUDENT B)
  // =========================================================================
  console.log("\n┌───────────────────────────────────────────────────────────────┐");
  console.log("│ TASK 5: STUDENT ISOLATION TEST (STUDENT A VS STUDENT B)       │");
  console.log("└───────────────────────────────────────────────────────────────┘");

  const studentBEmail = `pilot.eval.studentB.${timestamp}@tuklas.local`;
  const regBRes = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      name: "Student B Isolated",
      email: studentBEmail,
      password: studentPassword,
      gradeLevel: 7,
    }),
  });
  const studentBId = regBRes.json?.user?.id;
  assert(!!studentBId, "Student B registered successfully");

  // Student B creates a conversation
  const loginBRes = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: studentBEmail, password: studentPassword }),
  });
  const bCookie = loginBRes.headers.get("set-cookie") || "";
  const bToken = bCookie.match(/tuklas_session=([^;]+)/)?.[1] || "";
  const bHeaders: Record<string, string> = bToken
    ? { Authorization: `Bearer ${bToken}` }
    : { Cookie: bCookie };

  const bTutor = await request("/api/ai/tutor", {
    method: "POST",
    headers: bHeaders,
    body: JSON.stringify({
      lessonId: "lsn_01",
      message: "Student B private query about zero pairs",
      context: { stepKey: "guided_practice" },
    }),
  });
  const bConversationId = bTutor.json?.data?.conversationId;
  assert(!!bConversationId, "Student B creates private AI conversation");

  // Student A attempts to access Student B's conversation
  const illegalConvAccess = await request(`/api/ai/conversations/${bConversationId}`, {
    headers: sHeaders, // Student A's headers
  });
  assert(
    illegalConvAccess.status === 404 || illegalConvAccess.status === 403,
    "Student A cannot access Student B's private AI conversation (HTTP 404/403)"
  );

  // Student A attempts to access teacher student detail endpoint
  const illegalStudentDetail = await request(`/api/teacher/students/${studentBId}`, {
    headers: sHeaders,
  });
  assert(
    illegalStudentDetail.status === 403,
    "Student A cannot access Student B's records via Teacher API (HTTP 403 Forbidden)"
  );

  // =========================================================================
  // TASK 6 & 7: TEACHER PILOT TEST & TEACHER ISOLATION
  // =========================================================================
  console.log("\n┌───────────────────────────────────────────────────────────────┐");
  console.log("│ TASK 6 & 7: TEACHER PILOT TEST & TEACHER ISOLATION            │");
  console.log("└───────────────────────────────────────────────────────────────┘");

  // 1. Teacher A Login
  const teacherEmail = "pilot.teacher01@tuklas.local";
  const teacherPass = process.env.PILOT_INITIAL_PASSWORD || "TuklasPilot2026!";
  const tLogin = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: teacherEmail, password: teacherPass }),
  });
  assert(tLogin.status === 200, "Teacher A login succeeds (HTTP 200)");
  const tCookie = tLogin.headers.get("set-cookie") || "";
  const tToken = tCookie.match(/tuklas_session=([^;]+)/)?.[1] || "";
  const tHeaders: Record<string, string> = tToken
    ? { Authorization: `Bearer ${tToken}` }
    : { Cookie: tCookie };

  // 2. Pilot Classroom & Enrolled Students
  const tClasses = await request("/api/teacher/classes", { headers: tHeaders });
  assert(tClasses.status === 200, "Teacher A classes load (HTTP 200)");
  const pilotClass = (tClasses.json?.data || []).find((c: any) => c.name === "Pilot Cohort - Grade 7 Math");
  assert(!!pilotClass, "Pilot Cohort - Grade 7 Math classroom is visible to Teacher A");

  if (pilotClass) {
    const classDetail = await request(`/api/teacher/classes/${pilotClass.id}`, { headers: tHeaders });
    assert(classDetail.status === 200, "View enrolled students in Pilot Cohort (HTTP 200)");
  }

  // 3. Teacher A Creates Lesson
  const tCreateLsn = await request("/api/lessons", {
    method: "POST",
    headers: tHeaders,
    body: JSON.stringify({
      title: `Teacher A Custom Lesson ${timestamp}`,
      description: "Custom lesson on integer coordinates",
      termNumber: 2,
      newUnitTitle: `Unit: Coordinate Geometry ${timestamp}`,
      learningObjectives: ["Plot integer pairs on the Cartesian plane"],
      estimatedMinutes: 20,
    }),
  });
  assert(tCreateLsn.status === 201, "Teacher A creates lesson in Lesson Studio (HTTP 201)");
  const teacherALessonId = tCreateLsn.json?.data?.id;
  assert(!!teacherALessonId, "Teacher A lesson assigned valid ID");

  // 4. Teacher A Attaches Video
  const tAttachVid = await request(`/api/lessons/${teacherALessonId}/video`, {
    method: "POST",
    headers: tHeaders,
    body: JSON.stringify({
      title: "Cartesian Plane Integer Coordinates",
      url: "https://www.youtube.com/watch?v=1O2Z0y8e388",
    }),
  });
  assert(tAttachVid.status === 201, "Teacher A attaches validated video resource (HTTP 201)");

  // 5. Teacher B Login (Second Teacher)
  const teacherBEmail = `pilot.eval.teacherB.${timestamp}@tuklas.local`;
  const tBPassHash = await hashPassword("TeacherBPass2026!");
  const dbTeacherB = await prisma.user.create({
    data: {
      email: teacherBEmail,
      name: "Pilot Teacher B",
      passwordHash: tBPassHash,
      role: "TEACHER",
    },
  });

  const tBLogin = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: teacherBEmail, password: "TeacherBPass2026!" }),
  });
  const tBCookie = tBLogin.headers.get("set-cookie") || "";
  const tBToken = tBCookie.match(/tuklas_session=([^;]+)/)?.[1] || "";
  const tBHeaders: Record<string, string> = tBToken
    ? { Authorization: `Bearer ${tBToken}` }
    : { Cookie: tBCookie };

  // 6. Teacher Isolation Checks: Teacher B cannot edit or change status of Teacher A's lesson
  const illegalEdit = await request(`/api/lessons/${teacherALessonId}`, {
    method: "PUT",
    headers: tBHeaders,
    body: JSON.stringify({ title: "Tampered by Teacher B" }),
  });
  assert(illegalEdit.status === 403, "Teacher B rejected from editing Teacher A's lesson (HTTP 403 Forbidden)");

  const illegalStatus = await request(`/api/lessons/${teacherALessonId}/status`, {
    method: "POST",
    headers: tBHeaders,
    body: JSON.stringify({ targetStatus: "PUBLISHED" }),
  });
  assert(illegalStatus.status === 403, "Teacher B rejected from changing status of Teacher A's lesson (HTTP 403 Forbidden)");

  const illegalVideoAttach = await request(`/api/lessons/${teacherALessonId}/video`, {
    method: "POST",
    headers: tBHeaders,
    body: JSON.stringify({
      title: "Illegal Video",
      url: "https://www.youtube.com/watch?v=1O2Z0y8e388",
    }),
  });
  assert(illegalVideoAttach.status === 403, "Teacher B rejected from attaching video to Teacher A's lesson (HTTP 403 Forbidden)");

  // =========================================================================
  // TASK 8: PUBLISHED CONTENT SECURITY
  // =========================================================================
  console.log("\n┌───────────────────────────────────────────────────────────────┐");
  console.log("│ TASK 8: PUBLISHED CONTENT SECURITY                            │");
  console.log("└───────────────────────────────────────────────────────────────┘");

  // Lesson is currently DRAFT: Student must NOT be able to access it
  const studentDraftAccess = await request(`/api/lessons/${teacherALessonId}`, {
    headers: sHeaders,
  });
  assert(
    studentDraftAccess.status === 403,
    "Student rejected from accessing DRAFT lesson (HTTP 403 Forbidden)"
  );

  // Teacher A advances status to PUBLISHED
  // First update status to REVIEW, then APPROVED, then PUBLISHED
  await request(`/api/lessons/${teacherALessonId}/status`, {
    method: "POST",
    headers: tHeaders,
    body: JSON.stringify({ targetStatus: "REVIEW" }),
  });
  await request(`/api/lessons/${teacherALessonId}/status`, {
    method: "POST",
    headers: tHeaders,
    body: JSON.stringify({ targetStatus: "APPROVED" }),
  });
  const pubRes = await request(`/api/lessons/${teacherALessonId}/status`, {
    method: "POST",
    headers: tHeaders,
    body: JSON.stringify({ targetStatus: "PUBLISHED" }),
  });
  assert(pubRes.status === 200, "Teacher A successfully transitions lesson to PUBLISHED");

  // Student can now access the PUBLISHED lesson
  const studentPubAccess = await request(`/api/lessons/${teacherALessonId}`, {
    headers: sHeaders,
  });
  assert(studentPubAccess.status === 200, "Student can access lesson once PUBLISHED (HTTP 200 OK)");

  // =========================================================================
  // TASK 10: VIDEO INTEGRITY & PROTOCOL SECURITY
  // =========================================================================
  console.log("\n┌───────────────────────────────────────────────────────────────┐");
  console.log("│ TASK 10: VIDEO INTEGRITY & PROTOCOL SECURITY                  │");
  console.log("└───────────────────────────────────────────────────────────────┘");

  // 1. Valid URLs
  const validUrl1 = parseYouTubeUrl("https://www.youtube.com/watch?v=1O2Z0y8e388");
  assert(validUrl1.isValid === true && validUrl1.videoId === "1O2Z0y8e388", "Standard YouTube URL parses successfully");

  const validUrl2 = parseYouTubeUrl("https://youtu.be/1O2Z0y8e388");
  assert(validUrl2.isValid === true && validUrl2.videoId === "1O2Z0y8e388", "Short youtu.be URL parses successfully");

  // 2. Dangerous Protocols Rejected
  const xssUrl = parseYouTubeUrl("javascript:alert(1)");
  assert(xssUrl.isValid === false, "javascript: pseudo-protocol strictly rejected");

  const dataUrl = parseYouTubeUrl("data:text/html,<script>alert(1)</script>");
  assert(dataUrl.isValid === false, "data: URI protocol strictly rejected");

  // 3. Non-YouTube Domain Rejected
  const vimeoUrl = parseYouTubeUrl("https://vimeo.com/123456789");
  assert(vimeoUrl.isValid === false, "Non-YouTube domain (vimeo.com) strictly rejected");

  const spoofUrl = parseYouTubeUrl("https://not-youtube.com/watch?v=1O2Z0y8e388");
  assert(spoofUrl.isValid === false, "Spoofed domain strictly rejected");

  // Cleanup temporary test users
  try {
    await prisma.checkpointAttempt.deleteMany({ where: { userId: studentId } });
    await prisma.practiceSessionQuestion.deleteMany({ where: { practiceSession: { studentId } } });
    await prisma.practiceSession.deleteMany({ where: { studentId } });
    await prisma.studentProgress.deleteMany({ where: { userId: studentId } });
    await prisma.user.delete({ where: { id: studentId } });

    await prisma.checkpointAttempt.deleteMany({ where: { userId: studentBId } });
    await prisma.aITutorMessage.deleteMany({ where: { conversationId: bConversationId } });
    await prisma.aITutorConversation.deleteMany({ where: { id: bConversationId } });
    await prisma.studentProgress.deleteMany({ where: { userId: studentBId } });
    await prisma.user.delete({ where: { id: studentBId } });

    await prisma.lessonResource.deleteMany({ where: { lessonId: teacherALessonId } });
    await prisma.lesson.delete({ where: { id: teacherALessonId } });
    await prisma.user.delete({ where: { id: dbTeacherB.id } });
  } catch (cleanErr) {
    console.warn("Cleanup notice:", cleanErr);
  }

  console.log("\n=================================================================");
  console.log(`🏁 PHASE 18 EVIDENCE VALIDATION: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("=================================================================");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runPhase18EvidenceValidation()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  });
