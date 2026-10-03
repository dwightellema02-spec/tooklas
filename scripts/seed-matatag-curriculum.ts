import { prisma } from "../src/lib/db";

export const MATATAG_GRADE7_TERMS = [
  {
    termNumber: 1,
    name: "Term 1 (Quarter 1)",
    units: [
      {
        sequenceOrder: 1,
        title: "Numbers and Algebraic Expressions",
        description: "Foundational number concepts, integers, and operations for Grade 7 MATATAG.",
      },
      {
        sequenceOrder: 2,
        title: "Rational Numbers and Real Number System",
        description: "Operations on fractions, decimals, and subset classifications of real numbers.",
      },
    ],
  },
  {
    termNumber: 2,
    name: "Term 2 (Quarter 2)",
    units: [
      {
        sequenceOrder: 1,
        title: "Measurement and Unit Conversion",
        description: "Metric and English systems of measurement, dimensional analysis, and scale.",
      },
      {
        sequenceOrder: 2,
        title: "Geometric Shapes, Angles, and Polygons",
        description: "Properties of angles, triangles, quadrilaterals, polygons, perimeter, and area.",
      },
    ],
  },
  {
    termNumber: 3,
    name: "Term 3 (Quarter 3)",
    units: [
      {
        sequenceOrder: 1,
        title: "Algebraic Expressions and Polynomials",
        description: "Constants, variables, algebraic expressions, and operations on polynomials.",
      },
      {
        sequenceOrder: 2,
        title: "Linear Equations and Inequalities",
        description: "Solving one-variable linear equations, inequalities, and real-world mathematical modeling.",
      },
    ],
  },
  {
    termNumber: 4,
    name: "Term 4 (Quarter 4)",
    units: [
      {
        sequenceOrder: 1,
        title: "Data Collection and Frequency Distributions",
        description: "Formulating statistical questions, sampling, frequency distribution tables, and graphs.",
      },
      {
        sequenceOrder: 2,
        title: "Measures of Central Tendency and Probability",
        description: "Mean, median, mode, variability, and simple theoretical and experimental probability.",
      },
    ],
  },
];

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

  console.log("[MATATAG] Curriculum structure successfully verified and updated across Terms 1-4.");
}

ensureCurriculumStructure()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
