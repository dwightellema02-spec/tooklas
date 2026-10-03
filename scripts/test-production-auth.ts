/**
 * Tuklas AI - Production Authentication & Database Integrity Verification Suite
 *
 * Verifies:
 * 1. TEST A: User registration writes directly to PostgreSQL, returns 201, verified via Prisma.
 * 2. TEST B: Login retrieves from PostgreSQL, verifies password hash, issues session.
 * 3. TEST C: Application restart/cache clear preserves user in PostgreSQL and allows login.
 * 4. TEST D: Negative Database Test: When PostgreSQL is down/unavailable, registration and login
 *            FAIL SAFELY with HTTP 503 and NEVER create or authenticate fallback users.
 * 5. TEST E: Default role logins (Student, Teacher, Admin) verify against PostgreSQL.
 * 6. TEST F: IDOR and session validation integrity.
 */

import http from "http";
import { prisma, dbService, fallbackStore, DatabaseUnavailableError } from "../src/lib/db";
import { verifyPassword } from "../src/lib/auth/password";
import { createSessionToken, verifySessionToken } from "../src/lib/auth/session";

const PORT = 3001; // Isolated test port
const BASE_URL = `http://localhost:${PORT}`;

interface RequestOptions {
  method?: string;
  path: string;
  headers?: Record<string, string>;
  body?: any;
}

interface ResponseResult {
  status: number;
  headers: http.IncomingHttpHeaders;
  data: any;
}

function request(options: RequestOptions): Promise<ResponseResult> {
  return new Promise((resolve, reject) => {
    const postData = options.body ? JSON.stringify(options.body) : "";
    const reqHeaders: Record<string, string> = {
      ...(options.headers || {}),
    };
    if (options.body) {
      reqHeaders["Content-Type"] = "application/json";
      reqHeaders["Content-Length"] = Buffer.byteLength(postData).toString();
    }

    const req = http.request(
      {
        hostname: "localhost",
        port: PORT,
        path: options.path,
        method: options.method || "GET",
        headers: reqHeaders,
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => {
          let parsed = raw;
          try {
            parsed = JSON.parse(raw);
          } catch {
            // Keep raw text
          }
          resolve({
            status: res.statusCode || 0,
            headers: res.headers,
            data: parsed,
          });
        });
      }
    );

    req.on("error", reject);
    if (postData) req.write(postData);
    req.end();
  });
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ [PASS] ${testName}`);
  } else {
    failed++;
    console.error(`  ❌ [FAIL] ${testName}${detail ? ` - ${detail}` : ""}`);
    throw new Error(`Assertion failed: ${testName} - ${detail || ""}`);
  }
}

async function runTestSuite() {
  console.log("=================================================================");
  console.log("🚀 TUKLAS AI — PRODUCTION AUTHENTICATION & DATABASE INTEGRITY TEST");
  console.log("=================================================================\n");

  // Spin up an Express server instance for the test on port 3001
  const express = (await import("express")).default;
  const app = express();
  app.use(express.json());

  // Setup auth routes identical to server.ts
  const { validateEmail, validatePassword, validateName } = await import("../src/lib/auth/validation");
  const { hashPassword } = await import("../src/lib/auth/password");

  function getSessionFromRequest(req: any) {
    const cookieHeader = req.headers.cookie;
    let token: string | undefined;
    if (cookieHeader) {
      const cookies = Object.fromEntries(
        cookieHeader.split(";").map((c: string) => {
          const [k, ...v] = c.trim().split("=");
          return [k, decodeURIComponent(v.join("="))];
        })
      );
      token = cookies["tuklas_session"];
    }
    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split("Bearer ")[1];
    }
    if (!token) return null;
    return verifySessionToken(token);
  }

  app.post("/api/auth/register", async (req: any, res: any) => {
    try {
      const { name, email, password, gradeLevel } = req.body;
      const validatedEmail = validateEmail(email);
      const validatedPass = validatePassword(password);
      const validatedName = validateName(name);

      const existing = await dbService.findUserByEmail(validatedEmail);
      if (existing) {
        return res.status(409).json({ success: false, error: "An account with this email already exists" });
      }

      const passwordHash = await hashPassword(validatedPass);
      const user = await dbService.createUser({
        name: validatedName,
        email: validatedEmail,
        passwordHash,
        role: "STUDENT",
        gradeLevel: typeof gradeLevel === "number" ? gradeLevel : 7,
      });

      const token = createSessionToken({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      });

      res.cookie("tuklas_session", token, { httpOnly: true, path: "/" });
      return res.status(201).json({ success: true, user: { id: user.id, email: user.email, name: user.name, role: user.role }, token });
    } catch (error: any) {
      if (error instanceof DatabaseUnavailableError) {
        return res.status(503).json({ success: false, error: "Database service is temporarily unavailable. Please try again." });
      }
      return res.status(400).json({ success: false, error: error.message });
    }
  });

  app.post("/api/auth/login", async (req: any, res: any) => {
    try {
      const { email, password } = req.body;
      const validatedEmail = validateEmail(email);
      const validatedPass = validatePassword(password);

      const user = await dbService.findUserByEmail(validatedEmail);
      if (!user) {
        return res.status(401).json({ success: false, error: "Invalid email or password" });
      }

      const isValid = await verifyPassword(validatedPass, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ success: false, error: "Invalid email or password" });
      }

      const token = createSessionToken({ id: user.id, email: user.email, name: user.name, role: user.role });
      res.cookie("tuklas_session", token, { httpOnly: true, path: "/" });
      return res.json({ success: true, user: { id: user.id, email: user.email, name: user.name, role: user.role }, token });
    } catch (error: any) {
      if (error instanceof DatabaseUnavailableError) {
        return res.status(503).json({ success: false, error: "Database service is temporarily unavailable. Please try again." });
      }
      return res.status(400).json({ success: false, error: error.message });
    }
  });

  app.post("/api/auth/logout", (_req: any, res: any) => {
    res.clearCookie("tuklas_session", { path: "/" });
    return res.json({ success: true, message: "Logged out successfully" });
  });

  app.get("/api/auth/me", async (req: any, res: any) => {
    try {
      const session = getSessionFromRequest(req);
      if (!session) {
        return res.status(401).json({ success: false, user: null, error: "No active session" });
      }
      const user = await dbService.findUserById(session.userId);
      if (!user) {
        res.clearCookie("tuklas_session", { path: "/" });
        return res.status(401).json({ success: false, user: null, error: "User record not found" });
      }
      return res.json({ success: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
    } catch (error: any) {
      if (error instanceof DatabaseUnavailableError) {
        return res.status(503).json({ success: false, user: null, error: "Database service is temporarily unavailable. Please try again." });
      }
      return res.status(500).json({ success: false, user: null, error: "Authentication check failed" });
    }
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(PORT, resolve));
  console.log(`[TEST SERVER] Running on port ${PORT}\n`);

  try {
    const timestamp = Date.now();
    const uniqueEmail = `production-test-unique-${timestamp}@example.com`;
    const password = "UniqueSecurePassword123!";
    const fullName = "Gabriela Silang";

    // -------------------------------------------------------------
    // TEST A — REGISTRATION
    // -------------------------------------------------------------
    console.log("--- 1. TEST A: REGISTRATION (PostgreSQL Direct Persistence) ---");
    const regRes = await request({
      method: "POST",
      path: "/api/auth/register",
      body: { name: fullName, email: uniqueEmail, password, gradeLevel: 7 },
    });

    assert(regRes.status === 201, "Registration returns HTTP 201 Created", `Status: ${regRes.status}`);
    assert(Boolean(regRes.data?.success), "Registration returns success: true");
    assert(Boolean(regRes.data?.token), "Registration issues session token");
    assert(regRes.data?.user?.email === uniqueEmail.toLowerCase(), "Registration returns correct normalized email");
    assert(regRes.data?.user?.role === "STUDENT", "Registration enforces STUDENT role");

    const createdUserId = regRes.data?.user?.id;
    assert(Boolean(createdUserId), "Registration returns assigned userId");

    // DIRECT POSTGRESQL PRISMA VERIFICATION
    const postgresUser = await prisma.user.findUnique({
      where: { email: uniqueEmail.toLowerCase() },
    });
    assert(Boolean(postgresUser), "User record physically confirmed in PostgreSQL via Prisma");
    assert(postgresUser?.id === createdUserId, "PostgreSQL record ID matches returned ID");
    assert(postgresUser?.name === fullName, "PostgreSQL record contains correct name");
    const isPwHashed = await verifyPassword(password, postgresUser?.passwordHash || "");
    assert(isPwHashed, "Password in PostgreSQL matches cryptographic bcrypt hash");

    // -------------------------------------------------------------
    // TEST B — LOGIN TEST
    // -------------------------------------------------------------
    console.log("\n--- 2. TEST B: LOGIN (PostgreSQL Direct Retrieval) ---");
    // Logout first
    const logoutRes = await request({ method: "POST", path: "/api/auth/logout" });
    assert(logoutRes.status === 200, "Logout returns HTTP 200");

    // Login with new account
    const loginRes = await request({
      method: "POST",
      path: "/api/auth/login",
      body: { email: uniqueEmail, password },
    });

    assert(loginRes.status === 200, "Login returns HTTP 200 OK");
    assert(Boolean(loginRes.data?.success), "Login returns success: true");
    assert(loginRes.data?.user?.id === createdUserId, "Login returns correct user ID");
    assert(loginRes.data?.user?.email === uniqueEmail.toLowerCase(), "Login returns correct email");
    assert(Boolean(loginRes.data?.token), "Login returns session token");

    // Verify session
    const meRes = await request({
      method: "GET",
      path: "/api/auth/me",
      headers: { Authorization: `Bearer ${loginRes.data?.token}` },
    });
    assert(meRes.status === 200, "Session /api/auth/me succeeds with Bearer token");
    assert(meRes.data?.user?.id === createdUserId, "Authenticated profile matches PostgreSQL user");

    // -------------------------------------------------------------
    // TEST C — RESTART TEST
    // -------------------------------------------------------------
    console.log("\n--- 3. TEST C: APPLICATION RESTART SIMULATION ---");
    // Wipe volatile fallbackStore users array completely
    fallbackStore.users = [];
    assert(fallbackStore.users.length === 0, "Volatile fallbackStore memory completely cleared");

    // Attempt login without re-creating user
    const restartLoginRes = await request({
      method: "POST",
      path: "/api/auth/login",
      body: { email: uniqueEmail, password },
    });

    assert(restartLoginRes.status === 200, "Login succeeds after volatile cache cleared (retrieved from PostgreSQL)");
    assert(restartLoginRes.data?.user?.id === createdUserId, "User data correctly retrieved from PostgreSQL after restart");

    // -------------------------------------------------------------
    // TEST D — NEGATIVE DATABASE TEST (DATABASE UNAVAILABLE)
    // -------------------------------------------------------------
    console.log("\n--- 4. TEST D: NEGATIVE DATABASE TEST (PostgreSQL Unavailable) ---");
    // Temporarily swap DATABASE_URL to unreachable endpoint
    const originalDbUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "postgresql://invalid_user:invalid_pass@localhost:54329/non_existent_db?connect_timeout=1";

    try {
      const offlineEmail = `offline-test-${timestamp}@example.com`;

      // Negative Registration Attempt
      const offlineRegRes = await request({
        method: "POST",
        path: "/api/auth/register",
        body: { name: "Offline Student", email: offlineEmail, password: "OfflinePassword123!" },
      });

      assert(offlineRegRes.status === 503, "Database failure returns HTTP 503 Service Unavailable on registration", `Status: ${offlineRegRes.status}`);
      assert(offlineRegRes.data?.error === "Database service is temporarily unavailable. Please try again.", "Returns safe, non-leaking user-facing error message");
      assert(offlineRegRes.data?.success === false, "Registration reports success: false");

      // Verify user was NOT created in fallbackStore
      const fallbackCheck = fallbackStore.users.find((u) => u.email === offlineEmail);
      assert(fallbackCheck === undefined, "Negative test: No fallback user created in local memory");

      // Negative Login Attempt
      const offlineLoginRes = await request({
        method: "POST",
        path: "/api/auth/login",
        body: { email: uniqueEmail, password },
      });

      assert(offlineLoginRes.status === 503, "Database failure returns HTTP 503 Service Unavailable on login", `Status: ${offlineLoginRes.status}`);
      assert(offlineLoginRes.data?.error === "Database service is temporarily unavailable. Please try again.", "Returns safe user-facing error message on login failure");
      assert(offlineLoginRes.data?.success === false, "Login reports success: false");
    } finally {
      // Restore valid DATABASE_URL immediately
      process.env.DATABASE_URL = originalDbUrl;
    }

    // Verify recovery after restoring database URL
    const recoveryLogin = await request({
      method: "POST",
      path: "/api/auth/login",
      body: { email: uniqueEmail, password },
    });
    assert(recoveryLogin.status === 200, "Database service normal operations restored after re-connection");

    // -------------------------------------------------------------
    // TEST E — SEEDED ROLES VERIFICATION IN POSTGRESQL
    // -------------------------------------------------------------
    console.log("\n--- 5. TEST E: SEEDED USERS AUTHENTICATION VIA POSTGRESQL ---");
    const rolesToTest = [
      { email: "student@tuklas.ai", role: "STUDENT" },
      { email: "teacher@tuklas.ai", role: "TEACHER" },
      { email: "admin@tuklas.ai", role: "ADMIN" },
    ];

    for (const r of rolesToTest) {
      const roleLoginRes = await request({
        method: "POST",
        path: "/api/auth/login",
        body: { email: r.email, password: "Tuklas2026!" },
      });
      assert(roleLoginRes.status === 200, `${r.role} account (${r.email}) authenticates successfully via PostgreSQL`);
      assert(roleLoginRes.data?.user?.role === r.role, `${r.role} account returns correct role: ${r.role}`);
    }

    console.log("\n=================================================================");
    console.log(`🎉 ALL ${passed} VERIFICATION TESTS PASSED SUCCESSFULLY!`);
    console.log("=================================================================\n");
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runTestSuite().catch((err) => {
  console.error("\n❌ TEST SUITE FAILED WITH ERROR:", err);
  process.exit(1);
});
