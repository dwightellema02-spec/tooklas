import { prisma } from "../src/lib/db";

import { BOW_GRADE7_TERMS } from "../prisma/g7-bow-curriculum.ts";

// Three-term structure from the DepEd MATATAG Budget of Work (April 2026).
export const MATATAG_GRADE7_TERMS = BOW_GRADE7_TERMS.map((t) => ({
  termNumber: t.termNumber,
  name: `Term ${t.termNumber}`,
  units: t.units.map((u, i) => ({ sequenceOrder: i + 1, title: u.title, description: u.description })),
}));

export async function ensureCurriculumStructure() {
  const grade = await prisma.grade.findFirst({ where: { level: 7 } });
  if (!grade) {
    console.error("Grade 7 record not found in PostgreSQL");
    return;
  }

  for (const t of MATATAG_GRADE7_TERMS) {
    const term = await prisma.term.upsert({
      where: {
        gradeId_termNumber: {
          gradeId: grade.id,
          termNumber: t.termNumber,
        },
      },
      update: { name: t.name },
      create: {
        gradeId: grade.id,
        termNumber: t.termNumber,
        name: t.name,
      },
    });

    for (const u of t.units) {
      const existing = await prisma.unit.findFirst({
        where: {
          termId: term.id,
          title: u.title,
        },
      });

      if (!existing) {
        await prisma.unit.create({
          data: {
            termId: term.id,
            sequenceOrder: u.sequenceOrder,
            title: u.title,
            description: u.description,
          },
        });
        console.log(`[MATATAG] Created unit: "${u.title}" under ${t.name}`);
      } else {
        console.log(`[MATATAG] Unit exists: "${existing.title}" under ${t.name}`);
      }
    }
  }

  console.log("[MATATAG] Curriculum structure successfully verified and updated across Terms 1-3.");
}

ensureCurriculumStructure()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
