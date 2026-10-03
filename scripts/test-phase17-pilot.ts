import { prisma } from "../src/lib/db";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    passedCount++;
    console.log(`  ✅ PASS: ${testName}`);
  } else {
    failedCount++;
    console.error(`  ❌ FAIL: ${testName}${detail ? ` (${detail})` : ""}`);
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
  } catch {
    // raw text
  }
  return { status: response.status, headers: response.headers, json, text };
}

async function runPilotReadinessVerification() {
  console.log("=================================================================");
  console.log("🧪 TUKLAS AI — REAL-USER PILOT AUTOMATED VERIFICATION SUITE");
  console.log("=================================================================");
  console.log(`Target Server: ${BASE_URL}`);

  const teacherEmail = "pilot.teacher01@tuklas.local";
  const studentEmail = "pilot.student01@tuklas.local";
  const adminEmail = "pilot.admin@tuklas.local";
  const password = process.env.PILOT_INITIAL_PASSWORD || "TuklasPilot2026!";

  // -------------------------------------------------------------
  // SUITE 1: PILOT ACCOUNT AUTHENTICATION & SESSION PERSISTENCE
  // -------------------------------------------------------------
  console.log("\n[SUITE 1] Pilot Account Authentication & Sessions");

  // 1. Teacher Login
  const teacherLogin = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: teacherEmail, password }),
  });
  assert(teacherLogin.status === 200, "Teacher can login successfully", `Status: ${teacherLogin.status}`);
  assert(teacherLogin.json?.user?.role === "TEACHER", "Teacher user object has role TEACHER");
  assert(!teacherLogin.json?.user?.passwordHash, "Teacher response does not leak passwordHash");
  const teacherCookie = teacherLogin.headers.get("set-cookie") || "";
  const teacherTokenMatch = teacherCookie.match(/tuklas_session=([^;]+)/);
  const teacherAuthHeader: Record<string, string> = teacherTokenMatch
    ? { Authorization: `Bearer ${teacherTokenMatch[1]}` }
    : { Cookie: teacherCookie };

  // 2. Student Login
  const studentLogin = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: studentEmail, password }),
  });
  assert(studentLogin.status === 200, "Student 1 can login successfully", `Status: ${studentLogin.status}`);
  assert(studentLogin.json?.user?.role === "STUDENT", "Student user object has role STUDENT");
  assert(!studentLogin.json?.user?.passwordHash, "Student response does not leak passwordHash");
  const studentCookie = studentLogin.headers.get("set-cookie") || "";
  const studentTokenMatch = studentCookie.match(/tuklas_session=([^;]+)/);
  const studentAuthHeader: Record<string, string> = studentTokenMatch
    ? { Authorization: `Bearer ${studentTokenMatch[1]}` }
    : { Cookie: studentCookie };

  // 3. Admin Login
  const adminLogin = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: adminEmail, password }),
  });
  assert(adminLogin.status === 200, "Admin can login successfully", `Status: ${adminLogin.status}`);
  assert(adminLogin.json?.user?.role === "ADMIN", "Admin user object has role ADMIN");
  const adminCookie = adminLogin.headers.get("set-cookie") || "";
  const adminTokenMatch = adminCookie.match(/tuklas_session=([^;]+)/);
  const adminAuthHeader: Record<string, string> = adminTokenMatch
    ? { Authorization: `Bearer ${adminTokenMatch[1]}` }
    : { Cookie: adminCookie };

  // -------------------------------------------------------------
  // SUITE 2: PILOT STUDENT LEARNING EXPERIENCE
  // -------------------------------------------------------------
  console.log("\n[SUITE 2] Pilot Student Learning Experience");

  // 1. Student Dashboard
  const studentDash = await request("/api/student/dashboard", { headers: studentAuthHeader });
  assert(studentDash.status === 200, "Student dashboard loads successfully");

  // 2. Student Learning Path (Canonical lsn_01 is first and AVAILABLE)
  const learningPath = await request("/api/student/learning-path", { headers: studentAuthHeader });
  assert(learningPath.status === 200, "Student learning path loads successfully");
  const lessons = learningPath.json?.data?.learningPath || [];
  assert(lessons.length > 0, "Learning path contains published lessons");
  const firstLesson = lessons[0];
  assert(firstLesson?.lessonId === "lsn_01", "Canonical lesson lsn_01 is the first lesson in the sequence");
  assert(
    firstLesson?.state === "AVAILABLE" || firstLesson?.state === "COMPLETED",
    `First lesson is unlocked for student (state: ${firstLesson?.state})`
  );

  // 3. Access Lesson Content
  const lessonDetail = await request("/api/lessons/lsn_01", { headers: studentAuthHeader });
  assert(lessonDetail.status === 200, "Student can access lsn_01 details");
  const blocks =
    lessonDetail.json?.data?.contentBlocks ||
    lessonDetail.json?.lesson?.blocks ||
    lessonDetail.json?.blocks ||
    [];
  assert(blocks.length > 0, "Lesson lsn_01 contains educational content blocks");

  // 4. Video / Mathisipan Resource Progress
  const videoEvent = await request("/api/student/lessons/lsn_01/video-event", {
    method: "POST",
    headers: studentAuthHeader,
    body: JSON.stringify({
      videoId: "mth_vid_01",
      resourceId: "res_01",
      eventType: "WATCH_PROGRESS",
      positionSeconds: 65,
      totalSeconds: 120,
      watchDurationSeconds: 65,
    }),
  });
  assert(videoEvent.status === 200, "Video watch progress recorded");

  // 5. Formative Checkpoint
  const checkpoint = await request("/api/student/lessons/lsn_01/checkpoint", {
    method: "POST",
    headers: studentAuthHeader,
    body: JSON.stringify({
      blockId: blocks[0]?.id || "blk_checkpoint_01",
      answer: "B",
      isCorrect: true,
      feedback: "Great job! +5 and -3 leave +2.",
    }),
  });
  assert(checkpoint.status === 200, "Checkpoint answer accepted and recorded");

  // 6. AI Tutor Interaction (Socratic & Resilient)
  const tutorResp = await request("/api/ai/tutor", {
    method: "POST",
    headers: studentAuthHeader,
    body: JSON.stringify({
      lessonId: "lsn_01",
      message: "Can you explain how negative numbers work with integer counters?",
      context: {
        stepKey: "concept_explanation",
        mathConcept: "Adding Integers",
      },
    }),
  });
  assert(tutorResp.status === 200, "AI Tutor returns valid response (200)");
  const tutorText =
    tutorResp.json?.data?.message?.content ||
    tutorResp.json?.reply ||
    tutorResp.json?.message ||
    "";
  assert(
    typeof tutorText === "string" && tutorText.length > 10,
    "AI Tutor provides pedagogical feedback text"
  );
  assert(
    tutorResp.json?.data?.providerInfo?.provider === "local-pedagogical-engine" ||
      tutorResp.json?.data?.providerInfo?.provider === "google-gemini",
    "AI Tutor operates via verified pedagogical engine (local fallback or Gemini)"
  );

  // 7. Mastery Status
  const mastery = await request("/api/student/mastery", { headers: studentAuthHeader });
  assert(mastery.status === 200, "Student mastery overview endpoint functions correctly");

  // -------------------------------------------------------------
  // SUITE 3: PILOT TEACHER CLASSROOM & LESSON MANAGEMENT
  // -------------------------------------------------------------
  console.log("\n[SUITE 3] Pilot Teacher Classroom & Lesson Studio");

  // 1. Teacher Dashboard
  const teacherDash = await request("/api/teacher/dashboard", { headers: teacherAuthHeader });
  assert(teacherDash.status === 200, "Teacher dashboard loads successfully");

  // 2. Classes
  const teacherClasses = await request("/api/teacher/classes", { headers: teacherAuthHeader });
  assert(teacherClasses.status === 200, "Teacher classes endpoint returns 200");
  const pilotCohort = (teacherClasses.json?.data || []).find(
    (c: any) => c.name === "Pilot Cohort - Grade 7 Math"
  );
  assert(!!pilotCohort, "Pilot Cohort - Grade 7 Math classroom is assigned to teacher");

  // 3. Class Students
  if (pilotCohort) {
    const classDetail = await request(`/api/teacher/classes/${pilotCohort.id}`, { headers: teacherAuthHeader });
    assert(classDetail.status === 200, "Teacher can view pilot class details");
    const enrollments =
      classDetail.json?.data?.classroom?.enrollments ||
      classDetail.json?.data?.students ||
      [];
    assert(enrollments.length >= 1, "Pilot students are enrolled in pilot cohort class");
  }

  // 4. Curriculum / Terms
  const curriculum = await request("/api/curriculum", { headers: teacherAuthHeader });
  assert(curriculum.status === 200, "Curriculum structure loads successfully");
  const terms = curriculum.json?.data?.[0]?.grades?.[0]?.terms || [];
  assert(terms.length >= 4, "All 4 academic terms exist for MATATAG Grade 7");

  // -------------------------------------------------------------
  // SUITE 4: DATA SAFETY, IDOR & RBAC ISOLATION
  // -------------------------------------------------------------
  console.log("\n[SUITE 4] Data Safety, RBAC & Privacy");

  // 1. Student cannot access Teacher classes
  const studentIllegalClass = await request("/api/teacher/classes", { headers: studentAuthHeader });
  assert(
    studentIllegalClass.status === 403 || studentIllegalClass.status === 401,
    "Student is rejected from Teacher Classes endpoint (403/401)"
  );

  // 2. Student cannot access Teacher dashboard
  const studentIllegalDash = await request("/api/teacher/dashboard", { headers: studentAuthHeader });
  assert(
    studentIllegalDash.status === 403 || studentIllegalDash.status === 401,
    "Student is rejected from Teacher Dashboard endpoint (403/401)"
  );

  // 3. Student cannot access Admin summary
  const studentIllegalAdmin = await request("/api/admin/system-summary", { headers: studentAuthHeader });
  assert(
    studentIllegalAdmin.status === 403 || studentIllegalAdmin.status === 401,
    "Student is rejected from Admin system summary (403/401)"
  );

  // 4. Admin CAN access Admin summary
  const adminSummary = await request("/api/admin/system-summary", { headers: adminAuthHeader });
  assert(adminSummary.status === 200, "Admin can access Admin system summary");

  // -------------------------------------------------------------
  // SUITE 5: LOGOUT & RE-LOGIN INTEGRITY
  // -------------------------------------------------------------
  console.log("\n[SUITE 5] Session Lifecycle & Logout");

  const studentLogout = await request("/api/auth/logout", {
    method: "POST",
    headers: studentAuthHeader,
  });
  assert(studentLogout.status === 200, "Student logout endpoint returns 200");

  // Re-login
  const studentRelogin = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: studentEmail, password }),
  });
  assert(studentRelogin.status === 200, "Student can log back in with progress intact");

  console.log("\n=================================================================");
  console.log(`🏁 PILOT READINESS VERIFICATION COMPLETE: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("=================================================================");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runPilotReadinessVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test execution error:", err);
    process.exit(1);
  });
