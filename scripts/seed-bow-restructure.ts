/**
 * Restructures Grade 7 Mathematics to the DepEd MATATAG Three-Term Budget of Work (April 2026)
 * and adds the six Quarter 1 draft lessons.
 *
 *   npx tsx scripts/seed-bow-restructure.ts --pdf-dir "C:\Users\you\Downloads"          # dry run
 *   npx tsx scripts/seed-bow-restructure.ts --pdf-dir "C:\Users\you\Downloads" --apply  # write
 *
 * Add --refresh-drafts to replace the content of draft lessons created by an earlier run.
 * The dry run performs every step inside a transaction and rolls it back, so it reports exactly
 * what --apply would do. The script is idempotent: a second run changes nothing.
 * Existing lessons are never overwritten, and nothing that holds lessons is ever deleted.
 */

import "dotenv/config";
import fs from "fs";
import path from "path";
import { PrismaClient, Prisma } from "@prisma/client";
import { extractDocumentContent } from "../src/lib/documents/document-extractor.ts";
import { BOW_GRADE7_TERMS, INTEGER_LESSON_PLACEMENT, Q1_DRAFT_LESSONS } from "../prisma/g7-bow-curriculum.ts";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");
const refreshDrafts = process.argv.includes("--refresh-drafts");
const pdfDirArg = process.argv.indexOf("--pdf-dir");
const pdfDir = pdfDirArg > -1 ? process.argv[pdfDirArg + 1] : undefined;

class DryRunRollback extends Error {}

const log = (msg: string) => console.log(msg);

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set.");

  for (const l of Q1_DRAFT_LESSONS) {
    for (const b of l.blocks) {
      if (b.type !== "CHECKPOINT") continue;
      const m = b.metadata as { options: string[]; correctAnswer: string };
      if (!m.options.includes(m.correctAnswer)) {
        throw new Error(`Checkpoint "${b.title}" in ${l.id} has a correctAnswer that is not one of its options.`);
      }
    }
  }

  // Extract the teacher-reference PDFs first (CPU-bound, kept outside the transaction).
  const extractions = new Map<string, { fileSize: number; data: unknown }>();
  if (pdfDir) {
    for (const l of Q1_DRAFT_LESSONS) {
      for (const d of l.documents) {
        if (extractions.has(d.fileName)) continue;
        const full = path.join(pdfDir, d.fileName);
        if (!fs.existsSync(full)) {
          log(`  ! PDF not found, skipping: ${full}`);
          continue;
        }
        const buffer = fs.readFileSync(full);
        const result = await extractDocumentContent({ buffer, fileName: d.fileName, mimeType: "application/pdf" });
        if (!result.success || !result.data) {
          log(`  ! Text extraction failed for ${d.fileName}: ${result.error}`);
          continue;
        }
        extractions.set(d.fileName, { fileSize: buffer.length, data: result.data });
      }
    }
  } else {
    log("  (no --pdf-dir given: PDFs will not be attached)");
  }

  log(apply ? "== APPLY: changes will be committed ==" : "== DRY RUN: changes will be rolled back ==");

  try {
    await prisma.$transaction(
      async (tx) => {
        const grade = await tx.grade.findFirst({ where: { level: 7, subject: { code: "MATH" } } });
        if (!grade) throw new Error("Grade 7 Mathematics was not found. Run the base seed first.");

        // ---- 1. Terms 1-3
        const terms = new Map<number, { id: string }>();
        for (const t of BOW_GRADE7_TERMS) {
          let term = await tx.term.findFirst({ where: { gradeId: grade.id, termNumber: t.termNumber } });
          if (!term) {
            term = await tx.term.create({
              data: { gradeId: grade.id, termNumber: t.termNumber, name: `Term ${t.termNumber}` },
            });
            log(`  + term ${t.termNumber} created`);
          }
          terms.set(t.termNumber, term);
        }

        const blueprintCount = (n: number) => BOW_GRADE7_TERMS.find((t) => t.termNumber === n)!.units.length;
        const unitIdByKey = new Map<string, string>();
        const key = (termNumber: number, title: string) => `${termNumber}|${title}`;

        // ---- 2. Move the unit that holds the integer lessons into Term 2
        const lsn01 = await tx.lesson.findUnique({ where: { id: "lsn_01" }, include: { unit: true } });
        if (lsn01) {
          const target = INTEGER_LESSON_PLACEMENT.find((p) => p.lessonId === "lsn_01")!;
          const bp = BOW_GRADE7_TERMS.find((t) => t.termNumber === target.termNumber)!.units.find(
            (u) => u.title === target.unitTitle
          )!;
          const toTermId = terms.get(target.termNumber)!.id;
          if (lsn01.unit.termId !== toTermId) {
            // Duplicate seed units with the same title in the same term move together,
            // so the curriculum view keeps hiding the duplicate.
            const group = await tx.unit.findMany({
              where: { termId: lsn01.unit.termId, title: lsn01.unit.title },
            });
            const seq = BOW_GRADE7_TERMS.find((t) => t.termNumber === target.termNumber)!.units.indexOf(bp) + 1;
            for (const u of group) {
              await tx.unit.update({
                where: { id: u.id },
                data: { termId: toTermId, title: bp.title, description: bp.description, sequenceOrder: seq },
              });
              log(`  ~ unit ${u.id} moved to Term ${target.termNumber} as "${bp.title}"`);
            }
          }
        }

        // ---- 3. Units per term: reuse by title or legacy title, otherwise create
        for (const t of BOW_GRADE7_TERMS) {
          const termId = terms.get(t.termNumber)!.id;
          for (let i = 0; i < t.units.length; i++) {
            const bp = t.units[i];
            const titles = [bp.title, ...(bp.legacyTitles ?? [])];
            const candidates = await tx.unit.findMany({
              where: { termId, title: { in: titles } },
              orderBy: { createdAt: "asc" },
            });
            // When duplicates exist, keep the unit that holds the lessons.
            let unit = candidates.find((u) => u.id === lsn01?.unitId) ?? candidates[0];
            if (!unit) {
              unit = await tx.unit.create({
                data: { termId, title: bp.title, description: bp.description, sequenceOrder: i + 1 },
              });
              log(`  + unit created: Term ${t.termNumber} / "${bp.title}"`);
            } else if (unit.title !== bp.title || unit.sequenceOrder !== i + 1) {
              await tx.unit.update({
                where: { id: unit.id },
                data: { title: bp.title, description: bp.description, sequenceOrder: i + 1 },
              });
              log(`  ~ unit renamed/reordered: Term ${t.termNumber} / "${bp.title}"`);
            }
            unitIdByKey.set(key(t.termNumber, bp.title), unit.id);
          }

          // Units that are not part of the Budget of Work keep their data; push them after the blueprint units.
          const others = await tx.unit.findMany({
            where: { termId, id: { notIn: t.units.map((u) => unitIdByKey.get(key(t.termNumber, u.title))!) } },
          });
          for (const u of others) {
            if (u.sequenceOrder <= blueprintCount(t.termNumber)) {
              await tx.unit.update({ where: { id: u.id }, data: { sequenceOrder: u.sequenceOrder + 100 } });
            }
          }
        }

        // ---- 4. Remove empty units that contradict the Budget of Work, and the empty Term 4
        const contradicting: Array<{ termNumber: number; title: string }> = [
          { termNumber: 2, title: "Geometric Shapes, Angles, and Polygons" },
          { termNumber: 4, title: "Data Collection and Frequency Distributions" },
          { termNumber: 4, title: "Measures of Central Tendency and Probability" },
        ];
        for (const c of contradicting) {
          const term = await tx.term.findFirst({ where: { gradeId: grade.id, termNumber: c.termNumber } });
          if (!term) continue;
          const units = await tx.unit.findMany({
            where: { termId: term.id, title: c.title },
            include: { _count: { select: { lessons: true, competencies: true } } },
          });
          for (const u of units) {
            if (u._count.lessons === 0 && u._count.competencies === 0) {
              await tx.unit.delete({ where: { id: u.id } });
              log(`  - empty unit removed: Term ${c.termNumber} / "${c.title}"`);
            } else {
              log(`  ! kept (has data): Term ${c.termNumber} / "${c.title}"`);
            }
          }
        }
        const term4 = await tx.term.findFirst({
          where: { gradeId: grade.id, termNumber: 4 },
          include: { _count: { select: { units: true } } },
        });
        if (term4) {
          if (term4._count.units === 0) {
            await tx.term.delete({ where: { id: term4.id } });
            log("  - empty Term 4 removed (the Budget of Work has three terms)");
          } else {
            log("  ! Term 4 kept: it still holds units that are not part of the Budget of Work");
          }
        }

        // ---- 5. Relocate lsn_02 and lsn_03 to where the Budget of Work places them
        let seq = 0;
        for (const p of INTEGER_LESSON_PLACEMENT.filter((x) => x.lessonId !== "lsn_01")) {
          seq += 1;
          const lesson = await tx.lesson.findUnique({ where: { id: p.lessonId } });
          const unitId = unitIdByKey.get(key(p.termNumber, p.unitTitle))!;
          if (lesson && lesson.unitId !== unitId) {
            await tx.lesson.update({ where: { id: lesson.id }, data: { unitId, sequenceOrder: seq } });
            log(`  ~ lesson ${p.lessonId} moved to Term ${p.termNumber} / "${p.unitTitle}"`);
          }
        }

        // ---- 6. Draft lessons, content blocks and teacher-reference documents
        const author = await tx.user.findUnique({ where: { id: "usr_teacher_01" } });
        for (const l of Q1_DRAFT_LESSONS) {
          const unitId = unitIdByKey.get(key(l.termNumber, l.unitTitle))!;
          let lesson = await tx.lesson.findUnique({ where: { id: l.id } });
          if (!lesson) {
            lesson = await tx.lesson.create({
              data: {
                id: l.id,
                unitId,
                authorId: author?.id ?? null,
                sequenceOrder: l.sequenceOrder,
                title: l.title,
                description: l.description,
                learningObjectives: l.learningObjectives,
                status: "DRAFT",
                estimatedMinutes: l.estimatedMinutes,
              },
            });
            await tx.lessonContentBlock.createMany({
              data: l.blocks.map((b, i) => ({
                id: `${l.id}_b${String(i + 1).padStart(2, "0")}`,
                lessonId: l.id,
                type: b.type,
                sequenceOrder: i + 1,
                title: b.title,
                content: b.content,
                metadata: b.metadata ? JSON.stringify(b.metadata) : null,
              })),
            });
            log(`  + lesson created (DRAFT): ${l.id} "${l.title}" with ${l.blocks.length} blocks`);
          } else if (refreshDrafts && lesson.status === "DRAFT") {
            // Only drafts are refreshed. A lesson a teacher has moved to review or published is never touched.
            await tx.lesson.update({
              where: { id: l.id },
              data: {
                title: l.title,
                description: l.description,
                learningObjectives: l.learningObjectives,
                estimatedMinutes: l.estimatedMinutes,
              },
            });
            await tx.lessonContentBlock.deleteMany({ where: { lessonId: l.id } });
            await tx.lessonContentBlock.createMany({
              data: l.blocks.map((b, i) => ({
                id: `${l.id}_b${String(i + 1).padStart(2, "0")}`,
                lessonId: l.id,
                type: b.type,
                sequenceOrder: i + 1,
                title: b.title,
                content: b.content,
                metadata: b.metadata ? JSON.stringify(b.metadata) : null,
              })),
            });
            log(`  ~ draft lesson refreshed: ${l.id} with ${l.blocks.length} blocks`);
          } else {
            log(`  = lesson exists, left untouched: ${l.id}`);
          }

          for (const d of l.documents) {
            const ext = extractions.get(d.fileName);
            if (!ext) continue;
            const existing = await tx.lessonResource.findFirst({ where: { lessonId: l.id, fileName: d.fileName } });
            if (existing) continue;
            const count = await tx.lessonResource.count({ where: { lessonId: l.id } });
            await tx.lessonResource.create({
              data: {
                lessonId: l.id,
                type: "PDF",
                title: d.title,
                fileName: d.fileName,
                fileSize: ext.fileSize,
                storagePath: `/storage/curriculum/documents/${d.fileName}`,
                status: "READY",
                addedBy: author?.id ?? null,
                notes: JSON.stringify(ext.data),
                sequenceOrder: count + 1,
              },
            });
            log(`  + document attached to ${l.id}: ${d.fileName}`);
          }
        }

        // ---- Report the resulting tree
        const tree = await tx.term.findMany({
          where: { gradeId: grade.id },
          orderBy: { termNumber: "asc" },
          include: {
            units: {
              orderBy: { sequenceOrder: "asc" },
              include: { _count: { select: { lessons: true } } },
            },
          },
        });
        log("\nGrade 7 Mathematics structure:");
        for (const t of tree) {
          log(`  Term ${t.termNumber} (${t.name})`);
          for (const u of t.units) log(`    ${String(u.sequenceOrder).padStart(3)}. ${u.title}  [${u._count.lessons} lessons]`);
        }

        if (!apply) throw new DryRunRollback();
      },
      { timeout: 120_000, maxWait: 20_000 }
    );
    log("\nChanges committed.");
  } catch (e) {
    if (e instanceof DryRunRollback) {
      log("\nDry run complete. Nothing was written. Re-run with --apply to commit.");
      return;
    }
    throw e;
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Prisma.PrismaClientKnownRequestError ? `${e.code}: ${e.message}` : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
