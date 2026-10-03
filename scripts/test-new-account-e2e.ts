import { prisma } from "../src/lib/db";

const BASE_URL = `http://localhost:3000`;

async function runAudit() {
  console.log("=================================================================");
  console.log("🚀 TUKLAS AI — NEW ACCOUNT END-TO-END AUDIT & VERIFICATION");
  console.log("=================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${desc}`);
      failed++;
    }
  }

  try {
    const timestamp = Date.now();
    const testStudentEmail = `newstudent_${timestamp}@tuklas-audit.edu.ph`;
    const testStudentPassword = "SecurePassword123!";
    const testStudentName = `Audit Student ${timestamp}`;

    // STEP 1 & 2: REGISTRATION
    console.log("--- 1. NEW ACCOUNT REGISTRATION ---");
    const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: testStudentName,
        email: testStudentEmail,
        password: testStudentPassword,
      }),
    });

    const regData = await regRes.json();
    assert(regRes.status === 201, "Registration returns HTTP 201 Created");
    assert(regData.success === true, "Registration returns success: true");
    assert(Boolean(regData.user?.id), "Registration returns valid user ID");
    assert(regData.user?.role === "STUDENT", "Registration role is STUDENT");
    assert(Boolean(regData.token), "Registration issues session token");

    const newUserId = regData.user.id;

    // Direct PostgreSQL inspection via Prisma
    console.log("\n--- 2. POSTGRESQL DIRECT PERSISTENCE VERIFICATION ---");
    const pgUser = await prisma.user.findUnique({
      where: { id: newUserId },
    });
    assert(pgUser !== null, "New user record physically located in PostgreSQL via Prisma");
    assert(pgUser?.email === testStudentEmail.toLowerCase(), "PostgreSQL email matches normalized registered email");
    assert(pgUser?.role === "STUDENT", "PostgreSQL role matches STUDENT");
    assert(Boolean(pgUser?.passwordHash?.startsWith("$2")), "PostgreSQL contains valid bcrypt hash");

    // STEP 3: LOGIN WITH NEW CREDENTIALS
    console.log("\n--- 3. NEW ACCOUNT LOGIN ---");
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testStudentEmail,
        password: testStudentPassword,
      }),
    });

    const loginData = await loginRes.json();
    const setCookieHeader = loginRes.headers.get("set-cookie") || "";

    assert(loginRes.status === 200, "Login returns HTTP 200 OK");
    assert(loginData.success === true, "Login returns success: true");
    assert(loginData.user?.id === newUserId, "Login returns correct new student userId");
    assert(Boolean(loginData.token), "Login returns valid session token");
    assert(setCookieHeader.includes("tuklas_session"), "Login sets HTTP-only session cookie");

    const sessionToken = loginData.token;
    const cookieHeader = setCookieHeader.split(";")[0];

    // STEP 4: SESSION VERIFICATION & REFRESH INTEGRITY
    console.log("\n--- 4. SESSION VERIFICATION & REFRESH ---");
    // Verify with Bearer token
    const bearerMeRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    const bearerMeData = await bearerMeRes.json();
    assert(bearerMeRes.status === 200, "GET /api/auth/me with Bearer token returns 200 OK");
    assert(bearerMeData.user?.id === newUserId, "Bearer session identifies correct student");

    // Verify with Cookie
    const cookieMeRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Cookie: cookieHeader },
    });
    const cookieMeData = await cookieMeRes.json();
    assert(cookieMeRes.status === 200, "GET /api/auth/me with Cookie returns 200 OK");
    assert(cookieMeData.user?.id === newUserId, "Cookie session identifies correct student");

    // STEP 5: STUDENT DASHBOARD VERIFICATION
    console.log("\n--- 5. STUDENT DASHBOARD VERIFICATION ---");
    const dashRes = await fetch(`${BASE_URL}/api/student/dashboard`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    const dashData = await dashRes.json();
    assert(dashRes.status === 200, "GET /api/student/dashboard returns 200 OK");
    assert(dashData.data?.student?.id === newUserId, "Dashboard student profile matches new account");
    assert(Boolean(dashData.data?.curriculum), "Dashboard contains MATATAG curriculum context");
    assert(Boolean(dashData.data?.continueLearning), "Dashboard contains continueLearning DTO");
    assert(Boolean(dashData.data?.progressSummary), "Dashboard contains progressSummary DTO");
    assert(Array.isArray(dashData.data?.recentActivity), "Dashboard contains recentActivity array");

    // STEP 6: CURRICULUM & LESSON 1 ACCESS (NO MORE CIRCULAR DEADLOCK)
    console.log("\n--- 6. CURRICULUM & LESSON 1 ACCESS ---");
    const l1AccessRes = await fetch(`${BASE_URL}/api/student/lessons/lsn_01/access`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    const l1Access = await l1AccessRes.json();
    assert(l1AccessRes.status === 200, "GET /api/student/lessons/lsn_01/access returns 200 OK");
    assert(l1Access.data?.allowed === true, "Lesson 1 access is ALLOWED for brand new account");
    assert(l1Access.data?.state === "AVAILABLE", "Lesson 1 state is AVAILABLE");

    // Retrieve Lesson 1 content
    const l1Res = await fetch(`${BASE_URL}/api/lessons/lsn_01`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    const l1Data = await l1Res.json();
    assert(l1Res.status === 200, "GET /api/lessons/lsn_01 returns 200 OK");
    assert(l1Data.data?.contentBlocks?.length > 0, "Lesson 1 contains content blocks");

    // Check Lesson 2 is currently LOCKED for brand new account
    const l2AccessBefore = await fetch(`${BASE_URL}/api/student/lessons/lsn_02/access`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    const l2AccessDataBefore = await l2AccessBefore.json();
    assert(l2AccessBefore.status === 200, "GET /api/student/lessons/lsn_02/access returns 200 OK");
    assert(l2AccessDataBefore.data?.allowed === false, "Lesson 2 is initially LOCKED before completing Lesson 1");

    // STEP 7: LESSON 1 PROGRESSION & UNLOCKING LESSON 2
    console.log("\n--- 7. LESSON PROGRESSION (LESSON 1 -> LESSON 2) ---");
    const completeL1Res = await fetch(`${BASE_URL}/api/student/progress`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({
        lessonId: "lsn_01",
        action: "COMPLETE",
      }),
    });
    assert(completeL1Res.status === 200, "POST /api/student/progress completes Lesson 1");

    // Now re-check Lesson 2 access
    const l2AccessAfter = await fetch(`${BASE_URL}/api/student/lessons/lsn_02/access`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    const l2AccessDataAfter = await l2AccessAfter.json();
    assert(l2AccessDataAfter.data?.allowed === true, "Lesson 2 is now UNLOCKED after completing Lesson 1");
    assert(l2AccessDataAfter.data?.state === "AVAILABLE", "Lesson 2 state transitioned to AVAILABLE");

    // Check Lesson 3 remains locked until Lesson 2 is completed
    const l3Access = await fetch(`${BASE_URL}/api/student/lessons/lsn_03/access`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    const l3AccessData = await l3Access.json();
    assert(l3AccessData.data?.allowed === false, "Lesson 3 remains LOCKED until Lesson 2 is completed");

    // STEP 8: LOGOUT & RE-LOGIN INTEGRITY
    console.log("\n--- 8. LOGOUT & RE-LOGIN INTEGRITY ---");
    const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    assert(logoutRes.status === 200, "Logout returns 200 OK");

    const reLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testStudentEmail,
        password: testStudentPassword,
      }),
    });
    const reLoginData = await reLoginRes.json();
    assert(reLoginRes.status === 200, "Re-login returns 200 OK");
    assert(reLoginData.user?.id === newUserId, "Re-login returns same userId");

    const newSessionToken = reLoginData.token;

    // Verify learning path and Lesson 1 completion persisted in PostgreSQL across sessions
    const pathRes = await fetch(`${BASE_URL}/api/student/learning-path`, {
      headers: { Authorization: `Bearer ${newSessionToken}` },
    });
    const pathData = await pathRes.json();
    const lsn01Entry = (pathData.data?.learningPath || []).find((l: any) => l.lessonId === "lsn_01");
    assert(lsn01Entry?.state === "COMPLETED", "Lesson 1 state COMPLETED preserved in learning path across sessions");

    const reCheckDash = await fetch(`${BASE_URL}/api/student/dashboard`, {
      headers: { Authorization: `Bearer ${newSessionToken}` },
    });
    const reCheckDashData = await reCheckDash.json();
    assert(
      reCheckDashData.data?.progressSummary?.completedLessonsCount >= 1,
      "Dashboard reflects completedLessonsCount >= 1 in PostgreSQL across sessions"
    );

    // STEP 9: RBAC DATA ISOLATION
    console.log("\n--- 9. RBAC DATA ISOLATION (STUDENT CANNOT ACCESS TEACHER/ADMIN) ---");
    const teacherDenied = await fetch(`${BASE_URL}/api/teacher/dashboard`, {
      headers: { Authorization: `Bearer ${newSessionToken}` },
    });
    assert(teacherDenied.status === 403, "Student cannot access /api/teacher/dashboard (HTTP 403 Forbidden)");

    const adminDenied = await fetch(`${BASE_URL}/api/admin/system-summary`, {
      headers: { Authorization: `Bearer ${newSessionToken}` },
    });
    assert(adminDenied.status === 403, "Student cannot access /api/admin/system-summary (HTTP 403 Forbidden)");

  } catch (err) {
    console.error("Test execution failed with exception:", err);
    failed++;
  }

  console.log("\n=================================================================");
  console.log(`🏁 AUDIT SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("=================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runAudit();
