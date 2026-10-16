/**
 * Post-deployment smoke test (master plan Phase 10 / Phase 22).
 *
 *   APP_URL=https://your-domain npx tsx scripts/smoke-test-pilot-flows.ts
 *
 * It registers one throwaway student (smoke-<random>@example.invalid) and checks that the public
 * surface is closed and that the core student flow works. It never uses demo accounts.
 * Exit code 0 means every check passed.
 */

const BASE = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    failures.push(name);
    console.log(`  FAIL  ${name}${detail ? ` (${detail})` : ""}`);
  }
}

async function call(path: string, init: RequestInit & { token?: string } = {}) {
  const { token, ...rest } = init;
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(rest.headers as Record<string, string>) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, { ...rest, headers });
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { res, status: res.status, body };
}

async function main() {
  console.log(`Smoke test against ${BASE}\n`);

  console.log("Service");
  const health = await call("/api/health");
  check("health endpoint returns 200 with a connected database", health.status === 200 && health.body?.database?.connected === true, `status ${health.status}`);
  const home = await fetch(BASE + "/");
  check("home page loads", home.status === 200);
  check("security headers are set", home.headers.get("x-content-type-options") === "nosniff" && home.headers.get("x-frame-options") === "DENY");
  if (BASE.startsWith("https://")) {
    check("HSTS is set on HTTPS", !!home.headers.get("strict-transport-security"));
    check("Content-Security-Policy is set", !!home.headers.get("content-security-policy"));
  }

  console.log("\nPublic surface");
  const quick = await call("/api/auth/dev-quick-login", { method: "POST", body: JSON.stringify({ role: "ADMIN" }) });
  check("dev quick login is disabled", quick.status === 404, `status ${quick.status}`);

  const anonLessons = await call("/api/lessons");
  const anonList: any[] = anonLessons.body?.data || [];
  check("anonymous lesson list contains only PUBLISHED lessons", anonLessons.status === 200 && anonList.every((l) => l.status === "PUBLISHED"));
  const anonDraft = await call("/api/lessons?status=DRAFT");
  check("anonymous request for drafts returns no drafts", (anonDraft.body?.data || []).every((l: any) => l.status === "PUBLISHED"));

  const anonCurriculum = await call("/api/curriculum");
  const curriculumLessons: any[] = [];
  for (const s of anonCurriculum.body?.data || [])
    for (const g of s.grades || [])
      for (const t of g.terms || []) for (const u of t.units || []) curriculumLessons.push(...(u.lessons || []));
  check("anonymous curriculum shows only PUBLISHED lessons", curriculumLessons.every((l) => l.status === "PUBLISHED"));

  const exposesKey = anonList.some((l) =>
    (l.contentBlocks || []).some((b: any) => (b.type === "CHECKPOINT" || b.type === "QUESTION") && /correctAnswer|explanation/.test(String(b.metadata || "")))
  );
  check("anonymous lessons do not contain checkpoint answer keys", !exposesKey);
  const exposesDocText = anonList.some((l) => (l.resources || []).some((r: any) => (r.type === "PDF" || r.type === "DOCUMENT") && r.notes));
  check("anonymous lessons do not contain teacher document text", !exposesDocText);

  check("admin user list is closed to anonymous callers", (await call("/api/admin/users")).status === 403);
  check("teacher class list is closed to anonymous callers", (await call("/api/teacher/classes")).status === 403);
  check("AI settings need a sign-in", (await call("/api/ai/settings")).status === 401);
  const bigUpload = await call("/api/lessons/lsn_01/documents", { method: "POST", body: JSON.stringify({ fileName: "x.pdf" }) });
  check("document upload is closed to anonymous callers", bigUpload.status === 403, `status ${bigUpload.status}`);

  console.log("\nStudent flow");
  const email = `smoke-${Math.random().toString(36).slice(2, 10)}@example.invalid`;
  const password = "Smoke-Test-9xQ!pilot";
  const reg = await call("/api/auth/register", {
    method: "POST",
    headers: { Origin: BASE },
    body: JSON.stringify({ name: "Smoke Test Student", email, password, role: "ADMIN" }),
  });
  check("registration succeeds", reg.status === 201 || reg.status === 200, `status ${reg.status}`);
  check("registration ignores a requested ADMIN role", reg.body?.user?.role === "STUDENT", `role ${reg.body?.user?.role}`);
  const token: string | undefined = reg.body?.token;
  if (!token) {
    check("registration returned a session token", false);
  } else {
    const me = await call("/api/auth/me", { token });
    check("session is recognised", me.status === 200 && me.body?.user?.email === email);

    const path = await call("/api/student/learning-path", { token });
    check("learning path loads", path.status === 200 && Array.isArray(path.body?.data?.learningPath));
    const nodes: any[] = path.body?.data?.learningPath || [];
    const open = nodes.find((n) => n.state === "AVAILABLE" || n.state === "IN_PROGRESS");
    check("at least one lesson is available to a new student", !!open);

    if (open) {
      const lesson = await call(`/api/lessons/${open.lessonId}`, { token });
      check("an available lesson loads", lesson.status === 200);
      const blocks: any[] = lesson.body?.data?.contentBlocks || [];
      const cp = blocks.find((b) => b.type === "CHECKPOINT" || b.type === "QUESTION");
      if (cp) {
        const options: string[] = JSON.parse(cp.metadata || "{}").options || [];
        const first = options[0] || "";
        const attempt = await call(`/api/student/lessons/${open.lessonId}/checkpoint`, {
          method: "POST",
          token,
          body: JSON.stringify({ blockId: cp.id, answer: first }),
        });
        check("a checkpoint answer is graded by the server", attempt.status === 200 && typeof attempt.body?.result?.isCorrect === "boolean");
        const key = attempt.body?.result?.correctAnswer;
        const second = await call(`/api/student/lessons/${open.lessonId}/checkpoint`, {
          method: "POST",
          token,
          body: JSON.stringify({ blockId: cp.id, answer: key }),
        });
        check("the correct answer is accepted", second.body?.result?.isCorrect === true);
        const forged = await call(`/api/student/lessons/${open.lessonId}/checkpoint`, {
          method: "POST",
          token,
          body: JSON.stringify({ blockId: cp.id, answer: "definitely wrong", isCorrect: true }),
        });
        check("a forged isCorrect flag is ignored", forged.body?.result?.isCorrect === false);
      }
    }

    check("a student cannot list accounts", (await call("/api/admin/users", { token })).status === 403);
    check("a student cannot create a class", (await call("/api/teacher/classes", { method: "POST", token, body: JSON.stringify({ name: "x" }) })).status === 403);
    const crossSite = await call("/api/auth/logout", { method: "POST", headers: { Origin: "https://evil.example" } });
    check("a cross-site POST is refused", crossSite.status === 403, `status ${crossSite.status}`);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("Failed: " + failures.join("; "));
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error("Smoke test could not run:", e);
  process.exitCode = 1;
});
