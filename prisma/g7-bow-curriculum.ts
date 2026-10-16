/**
 * Tuklas AI - Grade 7 Mathematics curriculum blueprint from the DepEd MATATAG Three-Term
 * Budget of Work (last updated April 17, 2026). The Term 1 draft lessons live in g7-q1-lessons.ts.
 */

export interface BowUnit {
  title: string;
  description: string;
  /** Titles of older units this unit replaces (renamed in place, so their data is kept). */
  legacyTitles?: string[];
}

export interface BowTerm {
  termNumber: number;
  units: BowUnit[];
}

export const BOW_GRADE7_TERMS: BowTerm[] = [
  {
    termNumber: 1,
    units: [
      {
        title: "Polygons and Angle Relationships",
        description:
          "Regular and irregular polygons, convex and non-convex polygons, angle pairs, and interior and exterior angles (Weeks 1-3).",
      },
      {
        title: "Percentages and Rates",
        description:
          "Percentage increase and decrease, money problems involving percentages, financial planning, and rates (Weeks 4-6).",
      },
      {
        title: "Rational Numbers and Roots",
        description:
          "Rational numbers as fractions, decimals and percentages, operations on rational numbers, square and cube roots, and irrational numbers (Weeks 7-10).",
        legacyTitles: ["Rational Numbers and Real Number System"],
      },
    ],
  },
  {
    termNumber: 2,
    units: [
      {
        title: "Measurement: Units and Volume",
        description: "Unit conversion and the volumes of cylinders and pyramids (Weeks 1-4).",
        legacyTitles: ["Measurement and Unit Conversion"],
      },
      {
        title: "Sets and Real Numbers",
        description: "Sets, subsets, union and intersection, Venn diagrams, and subsets of the real numbers (Weeks 5-6).",
      },
      {
        title: "Data Collection and Graphs",
        description: "Sampling techniques, frequency distribution tables, and statistical graphs (Weeks 6-8).",
      },
      {
        title: "The Set of Integers",
        description: "Describing, locating, comparing and ordering integers on the number line (Weeks 9-10).",
        legacyTitles: ["Numbers and Algebraic Expressions"],
      },
    ],
  },
  {
    termNumber: 3,
    units: [
      {
        title: "Operations with Integers",
        description: "Adding, subtracting, multiplying and dividing integers; order of operations (Weeks 1-2).",
      },
      {
        title: "Absolute Value, Equations and Algebraic Expressions",
        description:
          "Absolute value, simple equations, variables and constants, evaluating and translating expressions, and formulas (Weeks 3-7).",
        legacyTitles: ["Algebraic Expressions and Polynomials"],
      },
      {
        title: "Experiments and Scientific Notation",
        description: "Outcomes of experiments, and scientific notation with its operations (Weeks 8-10).",
      },
    ],
  },
];

/** Existing seeded integer lessons, relocated to where the Budget of Work places them. */
export const INTEGER_LESSON_PLACEMENT: Array<{ lessonId: string; termNumber: number; unitTitle: string }> = [
  { lessonId: "lsn_01", termNumber: 2, unitTitle: "The Set of Integers" },
  { lessonId: "lsn_02", termNumber: 3, unitTitle: "Operations with Integers" },
  { lessonId: "lsn_03", termNumber: 3, unitTitle: "Operations with Integers" },
];

export { Q1_DRAFT_LESSONS } from "./g7-q1-lessons.ts";
export type { DraftBlock, DraftLesson } from "./g7-q1-lessons.ts";
