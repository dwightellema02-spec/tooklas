/**
 * Adds the Term 1 skills and the practice question bank, so students can master each lesson (not only
 * read it). Run it after scripts/seed-bow-restructure.ts has created the lessons.
 *
 *   npx tsx scripts/seed-q1-question-bank.ts --validate   # checks every question, needs no database
 *   npx tsx scripts/seed-q1-question-bank.ts              # dry run against the database
 *   npx tsx scripts/seed-q1-question-bank.ts --apply      # writes
 *
 * For every lesson it creates one skill (linked to the Budget of Work competency and to the skills that
 * must come first), 18 questions, three practice sets (guided, mixed, challenge) and PRACTICE blocks at the
 * end of the lesson that open them. For every week it creates a quiz drawn from that week's questions.
 *
 * It is idempotent. Existing questions are never overwritten unless you pass --refresh-questions, so a
 * teacher's edits survive a re-run. Nothing is deleted.
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { QuestionValidator } from "../src/lib/question-validator.ts";
import { SKILLS, TIER_DIFFICULTY, tierOf, type BankItem, type SkillDef } from "../prisma/g7-q1-questions.ts";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const validateOnly = args.includes("--validate");
const refreshQuestions = args.includes("--refresh-questions");

class DryRunRollback extends Error {}

const weekOf = (code: string) => Number(code.match(/^w(\d)/)![1]);
const lessonNumberOf = (code: string) => Number(code.match(/l(\d)$/)![1]);
const qid = (code: string, i: number) => `qst_g7q1_${code}_${String(i + 1).padStart(2, "0")}`;
const setId = (code: string, kind: string) => `ps_g7q1_${code}_${kind}`;
const skillId = (code: string) => `skl_g7q1_${code}`;
const SET_KINDS = [
  { kind: "basic", label: "Guided practice", level: "Guided (Level 1)", from: 0 },
  { kind: "mixed", label: "Mixed practice", level: "Mixed (Level 2)", from: 6 },
  { kind: "challenge", label: "Challenge", level: "Challenge (Level 3)", from: 12 },
] as const;

// ---------------------------------------------------------------- validation (no database)
function checkItem(skill: SkillDef, item: BankItem, i: number, problems: string[]) {
  const where = `${skill.code} #${i + 1}`;
  const cfg = {
    type: item.type,
    prompt: item.prompt,
    explanation: item.explanation,
    correctFeedback: item.correctFeedback,
    incorrectFeedback: item.incorrectFeedback,
    questionData: item.data as Record<string, any>,
  };
  const data = item.data as any;

  if (!item.prompt.trim() || !item.explanation.trim()) problems.push(`${where}: empty prompt or explanation`);

  if (item.type === "MULTIPLE_CHOICE") {
    const choices: Array<{ id: string; text: string }> = data.choices;
    if (choices.length !== 4) problems.push(`${where}: needs 4 choices`);
    const correct = choices.find((c) => c.id === data.correctAnswer);
    if (!correct) return void problems.push(`${where}: correct answer id not among the choices`);
    if (!QuestionValidator.validate(cfg as any, correct.id).isCorrect) problems.push(`${where}: correct choice rejected`);
    for (const c of choices.filter((x) => x.id !== correct.id)) {
      if (QuestionValidator.validate(cfg as any, c.id).isCorrect) problems.push(`${where}: wrong choice "${c.text}" accepted`);
      if (!data.feedbackByChoice?.[c.id]) problems.push(`${where}: wrong choice "${c.text}" has no feedback`);
    }
    // answer leakage: the prompt must not contain the correct choice text when it is long and specific
    if (correct.text.length > 12 && item.prompt.includes(correct.text)) problems.push(`${where}: prompt contains the answer`);
  } else if (item.type === "NUMERIC_INPUT") {
    const ans = Number(data.correctAnswer);
    if (!Number.isFinite(ans)) return void problems.push(`${where}: numeric answer is not a number`);
    if (!QuestionValidator.validate(cfg as any, data.correctAnswer).isCorrect) problems.push(`${where}: correct answer rejected`);
    if (QuestionValidator.validate(cfg as any, String(ans + 1)).isCorrect) problems.push(`${where}: a wrong number was accepted`);
  } else if (item.type === "TRUE_FALSE") {
    if (typeof data.correctAnswer !== "boolean") return void problems.push(`${where}: true/false answer must be a boolean`);
    if (!QuestionValidator.validate(cfg as any, String(data.correctAnswer)).isCorrect) problems.push(`${where}: correct answer rejected`);
    if (QuestionValidator.validate(cfg as any, String(!data.correctAnswer)).isCorrect) problems.push(`${where}: the opposite answer was accepted`);
  }
}

function validateBank() {
  const problems: string[] = [];
  const prompts = new Map<string, string>();
  const codes = new Set(SKILLS.map((s) => s.code));
  const rows: string[] = [];

  for (const skill of SKILLS) {
    for (const pre of skill.prerequisites) if (!codes.has(pre)) problems.push(`${skill.code}: unknown prerequisite ${pre}`);
    const items = skill.items();
    if (items.length !== 18) problems.push(`${skill.code}: has ${items.length} questions, expected 18`);
    const types = new Set(items.map((i) => i.type));
    const application = items.filter((i) => i.cognitive === "APPLICATION" || i.cognitive === "HIGHER_ORDER").length;
    if (types.size < 2) problems.push(`${skill.code}: needs at least 2 question types for mastery`);
    if (application < 4) problems.push(`${skill.code}: needs application questions (found ${application})`);
    items.forEach((item, i) => {
      checkItem(skill, item, i, problems);
      const key = item.prompt.trim().toLowerCase();
      if (prompts.has(key)) problems.push(`${skill.code} #${i + 1}: duplicate of ${prompts.get(key)}`);
      prompts.set(key, `${skill.code} #${i + 1}`);
    });
    const count = (t: string) => items.filter((i) => i.type === t).length;
    rows.push(
      `  ${skill.code.padEnd(5)} ${String(items.length).padStart(2)} questions  MC ${String(count("MULTIPLE_CHOICE")).padStart(2)}  numeric ${String(count("NUMERIC_INPUT")).padStart(2)}  T/F ${String(count("TRUE_FALSE")).padStart(2)}  application ${String(application).padStart(2)}  ${skill.title}`
    );
  }
  console.log(`Question bank: ${SKILLS.length} skills, ${prompts.size} questions\n${rows.join("\n")}`);
  return problems;
}

// ---------------------------------------------------------------- database
const prisma = new PrismaClient();

async function seed() {
  const items = new Map<string, BankItem[]>(SKILLS.map((s) => [s.code, s.items()]));

  await prisma.$transaction(
    async (tx) => {
      const author = await tx.user.findUnique({ where: { id: "usr_teacher_01" } });
      const created = { competencies: 0, skills: 0, prerequisites: 0, links: 0, questions: 0, sets: 0, setQuestions: 0, blocks: 0 };

      // ---- competencies, skills, lesson links
      const competencyIdByKey = new Map<string, string>();
      let skillOrderInCompetency = new Map<string, number>();
      for (const skill of SKILLS) {
        const lesson = await tx.lesson.findUnique({ where: { id: skill.lessonId } });
        if (!lesson) throw new Error(`Lesson ${skill.lessonId} not found. Run scripts/seed-bow-restructure.ts first.`);

        const week = weekOf(skill.code);
        const compKey = `${lesson.unitId}|${week}`;
        let compId = competencyIdByKey.get(compKey);
        if (!compId) {
          const code = `BOW-T1-W${week}`;
          let comp = await tx.competency.findFirst({ where: { unitId: lesson.unitId, code } });
          if (!comp) {
            const existing = await tx.competency.count({ where: { unitId: lesson.unitId } });
            comp = await tx.competency.create({
              data: { unitId: lesson.unitId, code, statement: skill.competency, sequenceOrder: existing + 1 },
            });
            created.competencies++;
          }
          compId = comp.id;
          competencyIdByKey.set(compKey, compId);
        }

        const order = (skillOrderInCompetency.get(compId) ?? 0) + 1;
        skillOrderInCompetency.set(compId, order);
        const id = skillId(skill.code);
        const existing = await tx.skill.findUnique({ where: { id } });
        if (!existing) {
          await tx.skill.create({
            data: { id, competencyId: compId, title: skill.title, description: skill.description, sequenceOrder: order, difficulty: skill.difficulty },
          });
          created.skills++;
        }
        const link = await tx.lessonSkill.findFirst({ where: { lessonId: skill.lessonId, skillId: id } });
        if (!link) {
          await tx.lessonSkill.create({ data: { lessonId: skill.lessonId, skillId: id } });
          created.links++;
        }
      }
      for (const skill of SKILLS) {
        for (const pre of skill.prerequisites) {
          const have = await tx.skillPrerequisite.findFirst({ where: { skillId: skillId(skill.code), prerequisiteSkillId: skillId(pre) } });
          if (!have) {
            await tx.skillPrerequisite.create({ data: { skillId: skillId(skill.code), prerequisiteSkillId: skillId(pre) } });
            created.prerequisites++;
          }
        }
      }

      // ---- questions
      for (const skill of SKILLS) {
        const list = items.get(skill.code)!;
        for (let i = 0; i < list.length; i++) {
          const item = list[i];
          const tier = tierOf(i);
          const id = qid(skill.code, i);
          const payload = {
            lessonId: skill.lessonId,
            skillId: skillId(skill.code),
            type: item.type,
            prompt: item.prompt,
            explanation: item.explanation,
            difficulty: TIER_DIFFICULTY[tier],
            cognitiveLevel: item.cognitive,
            questionData: JSON.stringify(item.data),
            metadata: JSON.stringify({ tier, origin: "deterministic-template", bank: "g7-q1-v1" }),
            correctFeedback: item.correctFeedback,
            incorrectFeedback: item.incorrectFeedback,
          } as const;
          const have = await tx.question.findUnique({ where: { id } });
          if (!have) {
            await tx.question.create({
              data: { id, ...payload, status: "PUBLISHED", source: "SYSTEM", createdById: author?.id ?? null, allowRetry: true, maxAttempts: 3 },
            });
            created.questions++;
          } else if (refreshQuestions) {
            await tx.question.update({ where: { id }, data: payload });
          }
        }
      }

      // ---- practice sets
      const ensureSet = async (id: string, data: { title: string; description: string; lessonId: string; skillId: string | null }) => {
        const have = await tx.practiceSet.findUnique({ where: { id } });
        if (!have) {
          await tx.practiceSet.create({ data: { id, ...data, status: "PUBLISHED", createdById: author?.id ?? null } });
          created.sets++;
        }
      };
      const link = async (setId_: string, questionId: string, order: number) => {
        const have = await tx.practiceSetQuestion.findFirst({ where: { practiceSetId: setId_, questionId } });
        if (!have) {
          await tx.practiceSetQuestion.create({ data: { practiceSetId: setId_, questionId, order } });
          created.setQuestions++;
        }
      };

      for (const skill of SKILLS) {
        const week = weekOf(skill.code);
        for (const k of SET_KINDS) {
          const id = setId(skill.code, k.kind);
          await ensureSet(id, {
            title: `Week ${week} · ${skill.title}: ${k.label}`,
            description: `${k.level}. Six questions on "${skill.title}".`,
            lessonId: skill.lessonId,
            skillId: skillId(skill.code),
          });
          for (let j = 0; j < 6; j++) await link(id, qid(skill.code, k.from + j), j + 1);
          await tx.practiceSet.update({ where: { id }, data: { questionCount: 6 } });
        }
      }

      // ---- weekly quizzes: two questions per lesson of the week (one mixed, one challenge)
      const weeks = [...new Set(SKILLS.map((s) => weekOf(s.code)))];
      const quizByWeek = new Map<number, { id: string; lastLessonId: string }>();
      for (const week of weeks) {
        const skills = SKILLS.filter((s) => weekOf(s.code) === week);
        const id = `ps_g7q1_w${week}_quiz`;
        const last = skills[skills.length - 1];
        await ensureSet(id, {
          title: `Week ${week} Quiz: mastery check`,
          description: `Mixed questions from every lesson of Week ${week}. Do it after the practice sets.`,
          lessonId: last.lessonId,
          skillId: null,
        });
        let order = 1;
        for (const s of skills) {
          await link(id, qid(s.code, 8), order++);
          await link(id, qid(s.code, 14), order++);
        }
        await tx.practiceSet.update({ where: { id }, data: { questionCount: skills.length * 2 } });
        quizByWeek.set(week, { id, lastLessonId: last.lessonId });
      }

      // ---- PRACTICE blocks at the end of each lesson
      for (const skill of SKILLS) {
        const week = weekOf(skill.code);
        const wanted: Array<{ id: string; title: string; content: string; metadata: Record<string, unknown> }> = SET_KINDS.map((k, n) => ({
          id: `${skill.lessonId}_pr${n + 1}`,
          title: `Practice ${n + 1}: ${k.label}`,
          content:
            n === 0
              ? `Show what you learned. Do the three practice sets in order: guided, mixed, then challenge. You master "${skill.title}" when you answer most questions correctly across all three, including the hard ones. Wrong answers show you why.`
              : n === 1
              ? "Mixed practice has more steps and more kinds of questions."
              : "The challenge set has application and transfer questions. Take your time.",
          metadata: { skillName: skill.title, questionCount: 6, difficulty: k.level, practiceSetId: setId(skill.code, k.kind) },
        }));
        const quiz = quizByWeek.get(week)!;
        if (quiz.lastLessonId === skill.lessonId) {
          wanted.push({
            id: `${skill.lessonId}_quiz`,
            title: `Week ${week} Quiz`,
            content: `Check yourself on all of Week ${week}. Questions come from each lesson of the week.`,
            metadata: { skillName: `Week ${week} mastery check`, questionCount: SKILLS.filter((s) => weekOf(s.code) === week).length * 2, difficulty: "Quiz", practiceSetId: quiz.id },
          });
        }
        let next = ((await tx.lessonContentBlock.aggregate({ where: { lessonId: skill.lessonId }, _max: { sequenceOrder: true } }))._max.sequenceOrder ?? 0) + 1;
        for (const b of wanted) {
          const have = await tx.lessonContentBlock.findUnique({ where: { id: b.id } });
          if (have) continue;
          await tx.lessonContentBlock.create({
            data: { id: b.id, lessonId: skill.lessonId, type: "PRACTICE", sequenceOrder: next++, title: b.title, content: b.content, metadata: JSON.stringify(b.metadata) },
          });
          created.blocks++;
        }
      }

      console.log(`\n${apply ? "Written" : "Would write"}: ${Object.entries(created).map(([k, v]) => `${v} ${k}`).join(", ")}`);
      if (!apply) throw new DryRunRollback();
    },
    { timeout: 300_000, maxWait: 20_000 }
  );
}

async function main() {
  const problems = validateBank();
  if (problems.length) {
    console.error(`\n${problems.length} problem(s) in the question bank:\n` + problems.map((p) => "  - " + p).join("\n"));
    process.exitCode = 1;
    return;
  }
  console.log("\nAll questions pass validation.");
  if (validateOnly) return;
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set.");
  console.log(apply ? "== APPLY: changes will be committed ==" : "== DRY RUN: changes will be rolled back ==");
  try {
    await seed();
    console.log("Changes committed.");
  } catch (e) {
    if (e instanceof DryRunRollback) {
      console.log("Dry run complete. Nothing was written. Re-run with --apply to commit.");
      return;
    }
    throw e;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
