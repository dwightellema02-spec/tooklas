// The lesson session reports the lesson just before this one, with only that lesson's own videos.
// Needs a running server on a review/test database (throwaway admin, @example.invalid).
//   APP_URL=http://localhost:3200 DATABASE_URL=<same database> npx tsx scripts/test-prior-lesson-videos.ts
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

const email = `priorvid-${Date.now()}@example.invalid`;
await j("/api/auth/register", { method: "POST", body: JSON.stringify({ name: "Prior Videos", email, password: PW }) });
await prisma.user.update({ where: { email }, data: { role: "ADMIN" } });
const tok = (await j("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password: PW }) })).b.token as string;

const path = (await j("/api/student/learning-path", {}, tok)).b.data.learningPath as any[];
t("the path has lessons", path.length > 3, String(path.length));

const sessionOf = async (id: string) => (await j(`/api/student/lessons/${id}/session`, {}, tok)).b.data;
const ytIds = async (id: string) => (((await j(`/api/lessons/${id}`, {}, tok)).b.data?.resources || []) as any[]).filter((r) => r.type === "YOUTUBE").map((r) => r.youtubeId).sort();

t("the first lesson has no previous lesson", (await sessionOf(path[0].lessonId)).previousLesson === null);

let checked = 0, wrong = 0, noVideos = 0, withVideos = 0;
for (let i = 1; i < path.length; i++) {
  const prev = (await sessionOf(path[i].lessonId)).previousLesson;
  const expectedVideos = await ytIds(path[i - 1].lessonId);
  const got = ((prev?.videos || []) as any[]).map((v) => v.youtubeId).sort();
  checked++;
  if (prev?.lessonId !== path[i - 1].lessonId || JSON.stringify(got) !== JSON.stringify(expectedVideos)) wrong++;
  expectedVideos.length ? withVideos++ : noVideos++;
}
t(`every other lesson points to the lesson right before it, with exactly that lesson's videos (${checked} lessons)`, wrong === 0, `${wrong} wrong`);
t("the previous lessons' videos are offered, not an empty list everywhere", withVideos > 0, `with=${withVideos} without=${noVideos}`);

console.log(`\n${pass} passed, ${fail} failed`);
await prisma.$disconnect();
process.exit(fail ? 1 : 0);
