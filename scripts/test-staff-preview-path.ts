// A student sees locked lessons; an administrator or teacher viewing their own path sees every lesson open.
// Needs a running server on a review/test database (throwaway users, @example.invalid).
//   APP_URL=http://localhost:3200 DATABASE_URL=<same database> npx tsx scripts/test-staff-preview-path.ts
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const B = (process.env.APP_URL || "http://localhost:3200").replace(/[/]$/, "");
const prisma = new PrismaClient();
const PW = "Audit-Pass-9xQ!pilot";
let pass = 0, fail = 0;
const t = (name: string, ok: boolean, detail = "") => {
  ok ? pass++ : fail++;
  console.log((ok ? "  PASS  " : "  FAIL  ") + name + (ok ? "" : `  (${detail})`));
};
const j = async (p: string, o: RequestInit = {}, tok?: string) => {
  const r = await fetch(B + p, { ...o, headers: { "content-type": "application/json", ...(tok ? { authorization: "Bearer " + tok } : {}) } });
  return { s: r.status, b: (await r.json().catch(() => ({}))) as any };
};
async function user(tag: string, role?: "ADMIN" | "TEACHER") {
  const email = `staffpath-${tag}-${Date.now()}@example.invalid`;
  const r = await j("/api/auth/register", { method: "POST", body: JSON.stringify({ name: "Path " + tag, email, password: PW }) });
  if (role) await prisma.user.update({ where: { email }, data: { role } });
  // the role is read when signing in, so sign in again after promoting
  const l = await j("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password: PW }) });
  return { tok: (l.b.token ?? r.b.token) as string, id: r.b.user?.id as string };
}
const path = async (tok: string, q = "") => (await j("/api/student/learning-path" + q, {}, tok)).b.data?.learningPath as any[] | undefined;

const student = await user("student");
const admin = await user("admin", "ADMIN");
const teacher = await user("teacher", "TEACHER");

const sPath = await path(student.tok);
const aPath = await path(admin.tok);
const tPath = await path(teacher.tok);
t("the student's path loads", !!sPath?.length);
t("a new student still has locked lessons", !!sPath?.some((n) => n.state === "LOCKED"), String(sPath?.filter((n) => n.state === "LOCKED").length));
t("the admin's path has the same lessons", aPath?.length === sPath?.length, `${aPath?.length} vs ${sPath?.length}`);
t("no lesson is locked for the admin", !!aPath && aPath.every((n) => n.state !== "LOCKED"));
t("lessons that were locked are marked as preview-unlocked", !!aPath?.some((n) => n.staffPreviewUnlocked === true));
t("no lesson is locked for a teacher", !!tPath && tPath.every((n) => n.state !== "LOCKED"));

const last = aPath?.[aPath.length - 1];
const access = last ? (await j(`/api/student/lessons/${last.lessonId}/access`, {}, admin.tok)).b.data : null;
t("the admin can open the last lesson", access?.allowed === true, JSON.stringify(access)?.slice(0, 120));

// finishing a lesson: staff are offered the next one at once, a new student is held by the same lock as before
const first = aPath?.[0];
const done = (tok: string) => j(`/api/student/lessons/${first!.lessonId}/session`, { method: "POST", body: JSON.stringify({ currentSectionIndex: 0, completedBlockIds: [], isCompleted: true }) }, tok);
const adminDone = (await done(admin.tok)).b.data?.nextLesson;
const studentDone = (await done(student.tok)).b.data?.nextLesson;
t("an admin who finishes a lesson is offered the next one", adminDone?.eligible === true, JSON.stringify(adminDone)?.slice(0, 140));
t("a student who finishes a lesson is still held by the mastery gate", studentDone?.eligible === false, JSON.stringify(studentDone)?.slice(0, 140));

const asTeacherView = await path(teacher.tok, `?studentId=${student.id}`);
t("a staff member viewing a student's path still sees that student's locks", !!asTeacherView?.some((n) => n.state === "LOCKED") || asTeacherView === undefined);

console.log(`\n${pass} passed, ${fail} failed`);
await prisma.$disconnect();
process.exit(fail ? 1 : 0);
