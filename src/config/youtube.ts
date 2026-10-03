/**
 * Tuklas AI - YouTube & Mathisipan Integration Configuration
 * Phase 13: Mathisipan / YouTube Educational Video Integration
 *
 * Centralized configuration for educational video embedding,
 * channel verification, search limits, and curated MATATAG curriculum directory.
 */

export interface MathisipanCuratedVideo {
  id: string;
  videoId: string;
  title: string;
  description: string;
  channelName: string;
  channelId: string;
  channelHandle: string;
  gradeLevel: number;
  termNumber: number;
  unitCode: string;
  skillId?: string;
  duration: string;
  tags: string[];
}

export const YOUTUBE_CONFIG = {
  provider: "YOUTUBE" as const,
  mathisipan: {
    channelName: "Mathisipan",
    channelHandle: "@mathisipan",
    channelId: "UC_mathisipan_official_deped",
    attributionLabel: "Video source: Mathisipan",
    youtubeBaseUrl: "https://www.youtube.com",
    embedBaseUrl: "https://www.youtube-nocookie.com/embed",
    thumbnailBaseUrl: "https://img.youtube.com/vi",
  },
  search: {
    maxResults: 12,
    debounceMs: 350,
    cacheTtlMs: 10 * 60 * 1000, // 10 minutes memory cache
    defaultQuery: "Mathisipan Grade 7 Mathematics",
  },
  quotas: {
    maxQueriesPerMinute: 30,
  },
};

/**
 * Curated directory of approved Mathisipan MATATAG Mathematics videos.
 * Provides instant search and preview across Grade 7 to Grade 10 without
 * exhausting external YouTube Data API quotas.
 */
export const MATHISIPAN_CURATED_VIDEOS: MathisipanCuratedVideo[] = [
  // Grade 7 Term 1 & 2: Numbers & Algebraic Expressions
  {
    id: "mth_g7_01",
    videoId: "ymKvqkWTrVU",
    title: "Understanding Integers: Introduction to Integers (Grade 7 Mathematics)",
    description: "Grade 7 MATH Term 2: Introduction to Integers | MATATAG. Positive and negative integers, real-world models, and representation on a horizontal number line.",
    channelName: "Mathisipan",
    channelId: "UC_mathisipan_official_deped",
    channelHandle: "@mathisipan",
    gradeLevel: 7,
    termNumber: 1,
    unitCode: "unt_01",
    skillId: "skl_01",
    duration: "12:45",
    tags: ["integers", "number line", "positive", "negative", "grade 7", "matatag", "introduction"],
  },
  {
    id: "mth_g7_02",
    videoId: "rRJsNeob8oo",
    title: "Absolute Value of Integers & Distance on the Number Line (Grade 7 Mathematics)",
    description: "Grade 7 MATH Term 3: Absolute Value of Integers | MATATAG. Conceptual understanding of distance from zero, comparing magnitude and inequalities.",
    channelName: "Mathisipan",
    channelId: "UC_mathisipan_official_deped",
    channelHandle: "@mathisipan",
    gradeLevel: 7,
    termNumber: 1,
    unitCode: "unt_01",
    skillId: "skl_02",
    duration: "10:15",
    tags: ["absolute value", "distance", "magnitude", "comparing integers", "grade 7", "matatag"],
  },
  {
    id: "mth_g7_03",
    videoId: "gLQoEzKKTyQ",
    title: "Addition of Integers: Same Signs and Different Signs (Grade 7 Mathematics)",
    description: "Grade 7 MATH Term 3: Addition of Integers | MATATAG. Visual counter method, zero pairs, and number line moves for adding integers.",
    channelName: "Mathisipan",
    channelId: "UC_mathisipan_official_deped",
    channelHandle: "@mathisipan",
    gradeLevel: 7,
    termNumber: 1,
    unitCode: "unt_01",
    skillId: "skl_03",
    duration: "15:20",
    tags: ["adding integers", "addition", "counters", "zero pairs", "grade 7", "matatag", "operations"],
  },
  {
    id: "mth_g7_04",
    videoId: "Er79fRnUK24",
    title: "Subtraction of Integers: Adding the Additive Inverse (Grade 7 Mathematics)",
    description: "Grade 7 MATH Term 3: Subtraction of Integers | MATATAG. Why subtracting a signed number is equivalent to adding its opposite.",
    channelName: "Mathisipan",
    channelId: "UC_mathisipan_official_deped",
    channelHandle: "@mathisipan",
    gradeLevel: 7,
    termNumber: 1,
    unitCode: "unt_01",
    skillId: "skl_04",
    duration: "14:10",
    tags: ["subtracting integers", "subtraction", "additive inverse", "opposite signs", "grade 7", "matatag"],
  },
  {
    id: "mth_g7_05",
    videoId: "qZzQ6fm8jks",
    title: "Multiplication and Division of Integers (Grade 7 Mathematics)",
    description: "Grade 7 MATH Term 3: Multiplication and Division of Integers | MATATAG. Rules for multiplying and dividing signed numbers.",
    channelName: "Mathisipan",
    channelId: "UC_mathisipan_official_deped",
    channelHandle: "@mathisipan",
    gradeLevel: 7,
    termNumber: 1,
    unitCode: "unt_01",
    duration: "13:30",
    tags: ["multiplying integers", "dividing integers", "sign rules", "grade 7", "matatag"],
  },
  {
    id: "mth_g7_06",
    videoId: "q2CjXUIILzQ",
    title: "Perfect Squares and Square Roots (Grade 7 Mathematics)",
    description: "Grade 7 MATH Term 1: Perfect Square & Square Root | MATATAG. Exploring square roots and rational exponents.",
    channelName: "Mathisipan",
    channelId: "UC_mathisipan_official_deped",
    channelHandle: "@mathisipan",
    gradeLevel: 7,
    termNumber: 1,
    unitCode: "unt_01",
    duration: "11:20",
    tags: ["square roots", "radicals", "perfect squares", "grade 7", "matatag"],
  },

  // Grade 8 Mathematics
  {
    id: "mth_g8_01",
    videoId: "QZtXMW7Bos0",
    title: "Linear Equation in One Variable (Grade 8 Mathematics)",
    description: "Grade 8 MATH Term 2: Linear Equation in One Variable | MATATAG. Solving linear equations systematically.",
    channelName: "Mathisipan",
    channelId: "UC_mathisipan_official_deped",
    channelHandle: "@mathisipan",
    gradeLevel: 8,
    termNumber: 1,
    unitCode: "unt_g8_01",
    duration: "16:40",
    tags: ["linear equations", "slope", "variables", "grade 8", "matatag"],
  },
  {
    id: "mth_g8_02",
    videoId: "crqXO792bNs",
    title: "Cartesian Coordinate Plane and Graphing (Grade 8 Mathematics)",
    description: "Grade 8 MATH Term 1: Cartesian Coordinate Plane | MATATAG. Plotting ordered pairs and understanding quadrants.",
    channelName: "Mathisipan",
    channelId: "UC_mathisipan_official_deped",
    channelHandle: "@mathisipan",
    gradeLevel: 8,
    termNumber: 1,
    unitCode: "unt_g8_01",
    duration: "18:15",
    tags: ["coordinate plane", "graphing", "quadrants", "ordered pairs", "grade 8"],
  },

  // Grade 9 Mathematics
  {
    id: "mth_g9_01",
    videoId: "gsz4EJF2aK0",
    title: "Triangle Congruence Postulates & Theorems (Grade 9 Mathematics)",
    description: "Grade 9 MATH Term 2: Triangle Congruence Postulates & Theorems & CPCTC | MATATAG. SAS, ASA, SSS, and AAS congruence.",
    channelName: "Mathisipan",
    channelId: "UC_mathisipan_official_deped",
    channelHandle: "@mathisipan",
    gradeLevel: 9,
    termNumber: 1,
    unitCode: "unt_g9_01",
    duration: "21:05",
    tags: ["triangle congruence", "postulates", "theorems", "cpctc", "grade 9"],
  },
  {
    id: "mth_g9_02",
    videoId: "rH1ejy2hD3U",
    title: "Inductive and Deductive Reasoning (Grade 9 Mathematics)",
    description: "Grade 9 MATH Term 2: Inductive and Deductive Reasoning | MATATAG. Mathematical logic, conjectures, and proofs.",
    channelName: "Mathisipan",
    channelId: "UC_mathisipan_official_deped",
    channelHandle: "@mathisipan",
    gradeLevel: 9,
    termNumber: 1,
    unitCode: "unt_g9_01",
    duration: "17:30",
    tags: ["reasoning", "logic", "proofs", "deductive", "grade 9"],
  },

  // Grade 10 Mathematics
  {
    id: "mth_g10_01",
    videoId: "prMVCkzNuVw",
    title: "Nature of Roots and Quadratic Equations (Grade 10 Mathematics)",
    description: "Grade 10 MATH Term 2: Nature of Roots and Reducible Quadratic Equations | MATATAG. Discriminant analysis and roots.",
    channelName: "Mathisipan",
    channelId: "UC_mathisipan_official_deped",
    channelHandle: "@mathisipan",
    gradeLevel: 10,
    termNumber: 1,
    unitCode: "unt_g10_01",
    duration: "19:30",
    tags: ["quadratic equations", "nature of roots", "discriminant", "grade 10"],
  },
  {
    id: "mth_g10_02",
    videoId: "R19QKzS_vY4",
    title: "Operations on Radical Expressions (Grade 10 Mathematics)",
    description: "Grade 10 MATH Term 2: Operations on Radical Expressions | MATATAG. Simplifying, adding, subtracting, and multiplying radicals.",
    channelName: "Mathisipan",
    channelId: "UC_mathisipan_official_deped",
    channelHandle: "@mathisipan",
    gradeLevel: 10,
    termNumber: 1,
    unitCode: "unt_g10_01",
    duration: "18:20",
    tags: ["radicals", "expressions", "operations", "grade 10"],
  },
];
