/**
 * Tuklas AI - Grade 7 Mathematics curriculum blueprint (DepEd MATATAG Three-Term Budget of Work,
 * last updated April 17, 2026) and the original Quarter 1 draft lessons (Weeks 1-6).
 *
 * Lessons are written from the published learning competencies. They are NOT copies of the
 * DepEd Lesson Exemplars, which are restricted to teacher use. All lessons are seeded as DRAFT
 * so a teacher reviews them before students see them.
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

export interface DraftBlock {
  type: "TEXT" | "EXAMPLE" | "CHECKPOINT" | "SUMMARY";
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface DraftLesson {
  id: string;
  termNumber: number;
  unitTitle: string;
  sequenceOrder: number;
  title: string;
  description: string;
  learningObjectives: string[];
  estimatedMinutes: number;
  /** File names of the DepEd PDFs attached to this lesson as teacher documents. */
  documents: Array<{ fileName: string; title: string }>;
  blocks: DraftBlock[];
}

const checkpoint = (
  title: string,
  question: string,
  options: string[],
  correctAnswer: string,
  explanation: string
): DraftBlock => ({
  type: "CHECKPOINT",
  title,
  content: question,
  metadata: { question, options, correctAnswer, explanation },
});

const example = (title: string, problem: string, steps: string[], answer: string): DraftBlock => ({
  type: "EXAMPLE",
  title,
  content: `Problem: ${problem}\n\n${steps.map((s, i) => `Step ${i + 1}: ${s}`).join("\n")}\n\nAnswer: ${answer}`,
  metadata: { problem, steps, answer },
});

export const Q1_DRAFT_LESSONS: DraftLesson[] = [
  // ---------------------------------------------------------------- Week 1
  {
    id: "lsn_g7q1_w1",
    termNumber: 1,
    unitTitle: "Polygons and Angle Relationships",
    sequenceOrder: 1,
    title: "Polygons: Naming, Classifying, and Drawing",
    description:
      "Define polygons, name them by their sides, tell regular from irregular polygons, and draw regular polygons with a ruler, protractor and compass.",
    learningObjectives: [
      "Define a polygon and tell polygons from non-polygons",
      "Name polygons with 3 to 10 sides and name them using their vertices",
      "Classify polygons as regular or irregular",
      "Draw triangles, quadrilaterals and regular polygons with 5, 6, 8 or 10 sides",
    ],
    estimatedMinutes: 40,
    documents: [
      { fileName: "G7-BOW-Mathematics-7-Three-Term-1 (1).pdf", title: "Grade 7 Mathematics Three-Term Budget of Work (Teacher Reference)" },
      { fileName: "Q1_LE_Mathematics-7_Lesson-1_Week-1.pdf", title: "Lesson Exemplar Q1 Lesson 1 (Teacher Reference)" },
    ],
    blocks: [
      {
        type: "TEXT",
        title: "1. What is a polygon?",
        content:
          "A **polygon** is a closed flat figure made only of straight line segments. The segments meet only at their endpoints, which are called **vertices**.\n\nA figure is **not** a polygon if it is open, has a curved side, or if its sides cross each other in the middle.\n\nExamples of polygons: a triangle, a stop sign, a kite. Not polygons: a circle (curved), a letter V (open).",
      },
      {
        type: "TEXT",
        title: "2. Naming polygons",
        content:
          "A polygon is named by its number of sides. A polygon always has the same number of sides, vertices and interior angles.\n\n| Sides | Name |\n|---|---|\n| 3 | Triangle |\n| 4 | Quadrilateral |\n| 5 | Pentagon |\n| 6 | Hexagon |\n| 7 | Heptagon |\n| 8 | Octagon |\n| 9 | Nonagon |\n| 10 | Decagon |\n\nWe also name a polygon using its vertices in order. A triangle with vertices A, B and C is triangle ABC. Its sides are AB, BC and AC.",
      },
      checkpoint(
        "3. Checkpoint: Is it a polygon?",
        "Which of the following is a polygon?",
        [
          "A circle",
          "Four line segments joined in a zigzag that does not close",
          "A closed figure with 6 straight sides that meet only at their endpoints",
          "A closed figure with 2 straight sides and 1 curved side",
        ],
        "A closed figure with 6 straight sides that meet only at their endpoints",
        "A polygon must be closed and made only of straight sides that meet at endpoints. Only the 6-sided closed figure satisfies all of these."
      ),
      checkpoint(
        "4. Checkpoint: Naming by sides",
        "A polygon has 8 sides. What is it called?",
        ["Hexagon", "Heptagon", "Octagon", "Nonagon"],
        "Octagon",
        "Octa- means eight. A hexagon has 6 sides, a heptagon 7 and a nonagon 9."
      ),
      {
        type: "TEXT",
        title: "5. Regular and irregular polygons",
        content:
          "- A polygon is **equilateral** if all its sides are equal.\n- A polygon is **equiangular** if all its angles are equal.\n- A **regular polygon** is both equilateral and equiangular.\n- An **irregular polygon** is not regular: its sides or its angles are not all equal.\n\nA regular triangle is called an **equilateral triangle**, and a regular quadrilateral is a **square**. For other regular polygons we add the word regular: regular pentagon, regular hexagon, and so on.\n\nEach interior angle of a regular pentagon is 108°, of a regular hexagon 120°, of a regular octagon 135° and of a regular decagon 144°.",
      },
      example(
        "6. Worked example: Regular or irregular?",
        "A pentagon has five sides of 3 cm each and five angles of 108° each. Another pentagon has sides of 3 cm, 4 cm, 3 cm, 4 cm and 2 cm. Classify each.",
        [
          "Check the sides of the first pentagon: all are 3 cm, so it is equilateral.",
          "Check its angles: all are 108°, so it is equiangular.",
          "It is both equilateral and equiangular, so it is a regular pentagon.",
          "In the second pentagon the sides are not all equal, so it cannot be regular.",
        ],
        "The first is a regular pentagon. The second is an irregular pentagon."
      ),
      checkpoint(
        "7. Checkpoint: Interior angle",
        "What is the measure of each interior angle of a regular hexagon?",
        ["90°", "108°", "120°", "135°"],
        "120°",
        "Each interior angle of a regular hexagon measures 120°. (108° is for a regular pentagon and 135° for a regular octagon.)"
      ),
      example(
        "8. Worked example: Drawing a regular polygon",
        "Draw a regular pentagon using a compass, ruler and protractor.",
        [
          "Use the compass to draw a circle. Mark its center O. The radius sets the size of the pentagon.",
          "A pentagon has 5 equal parts, so the angle at the center for each part is 360° ÷ 5 = 72°.",
          "Mark a starting point on the circle. Using the protractor at O, mark a new point every 72° around the circle.",
          "Connect each marked point to the next one with the ruler. Measure the sides to check they are equal.",
        ],
        "The 5 points joined in order form a regular pentagon. For a hexagon use 360° ÷ 6 = 60°, for an octagon 45°, and for a decagon 36°."
      ),
      checkpoint(
        "9. Checkpoint: The center angle",
        "To draw a regular decagon, at what angle around the center do you mark each point?",
        ["30°", "36°", "40°", "45°"],
        "36°",
        "A decagon has 10 sides, so the center angle is 360° ÷ 10 = 36°."
      ),
      {
        type: "SUMMARY",
        title: "10. Lesson summary",
        content:
          "- A polygon is a closed figure made of straight sides that meet only at endpoints.\n- Polygons are named by their number of sides (triangle, quadrilateral, pentagon, hexagon, heptagon, octagon, nonagon, decagon).\n- A regular polygon has all sides equal and all angles equal. Otherwise it is irregular.\n- To draw a regular polygon with n sides, mark points every 360° ÷ n around a circle and join them in order.",
      },
    ],
  },

  // ---------------------------------------------------------------- Week 2
  {
    id: "lsn_g7q1_w2",
    termNumber: 1,
    unitTitle: "Polygons and Angle Relationships",
    sequenceOrder: 2,
    title: "Convex and Non-Convex Polygons, and Angle Pairs",
    description:
      "Tell convex polygons from non-convex ones, and describe complementary, supplementary, adjacent and vertical angles and linear pairs.",
    learningObjectives: [
      "Classify polygons as convex or non-convex",
      "Define complementary, supplementary and adjacent angles, linear pairs and vertical angles",
      "Find the measure of an unknown angle using angle-pair relationships",
    ],
    estimatedMinutes: 40,
    documents: [{ fileName: "LE_MATH-7-Q1_W2.pdf", title: "Lesson Exemplar Q1 Lesson 2 (Teacher Reference)" }],
    blocks: [
      {
        type: "TEXT",
        title: "1. Convex and non-convex polygons",
        content:
          "A **convex polygon** has all interior angles less than 180°. If you pick any two points inside it, the straight line between them stays inside the polygon. No vertex points inward.\n\nA **non-convex (concave) polygon** has at least one interior angle greater than 180°. At least one vertex points inward, like the notch of an arrowhead, and some lines between two points inside go outside the polygon.\n\nRegular polygons are convex. A polygon can be irregular and still be convex.",
      },
      checkpoint(
        "2. Checkpoint: Convex or not?",
        "Which statement describes a non-convex (concave) polygon?",
        [
          "All of its interior angles are less than 180°",
          "It has at least one interior angle greater than 180°",
          "All of its sides have the same length",
          "It has exactly four sides",
        ],
        "It has at least one interior angle greater than 180°",
        "A non-convex polygon has an interior angle greater than 180°, which makes one vertex point inward."
      ),
      {
        type: "TEXT",
        title: "3. Angle pairs",
        content:
          "- **Complementary angles**: two angles whose measures add up to 90°.\n- **Supplementary angles**: two angles whose measures add up to 180°.\n- **Adjacent angles**: two angles that share a vertex and a side, and do not overlap.\n- **Linear pair**: two adjacent angles whose non-shared sides form a straight line. A linear pair is always supplementary (180°).\n- **Vertical angles**: the opposite angles formed when two lines intersect. Vertical angles are always equal.",
      },
      example(
        "4. Worked example: Complement and supplement",
        "Find the complement of 35° and the supplement of 110°.",
        [
          "Complementary angles add up to 90°, so the complement of 35° is 90° − 35° = 55°.",
          "Supplementary angles add up to 180°, so the supplement of 110° is 180° − 110° = 70°.",
        ],
        "The complement of 35° is 55°. The supplement of 110° is 70°."
      ),
      example(
        "5. Worked example: Two intersecting lines",
        "Two lines intersect. One of the four angles measures 75°. Find the other three angles.",
        [
          "The angle opposite 75° is its vertical angle, so it is also 75°.",
          "Each of the other two angles forms a linear pair with the 75° angle, so each is 180° − 75° = 105°.",
          "Check: 75° + 75° + 105° + 105° = 360°, the full turn around the point.",
        ],
        "The four angles are 75°, 105°, 75° and 105°."
      ),
      checkpoint(
        "6. Checkpoint: Complementary",
        "Two angles add up to 90°. What are they called?",
        ["Supplementary angles", "Complementary angles", "Vertical angles", "A linear pair"],
        "Complementary angles",
        "Angles that add up to 90° are complementary. Angles that add up to 180° are supplementary."
      ),
      checkpoint(
        "7. Checkpoint: Linear pair",
        "One angle of a linear pair measures 125°. What is the other angle?",
        ["35°", "55°", "65°", "125°"],
        "55°",
        "The angles of a linear pair add up to 180°, so the other angle is 180° − 125° = 55°."
      ),
      checkpoint(
        "8. Checkpoint: Vertical angles",
        "Two lines intersect and one angle is 48°. What is the angle vertical to it?",
        ["42°", "48°", "132°", "312°"],
        "48°",
        "Vertical angles are equal, so the angle opposite 48° is also 48°."
      ),
      {
        type: "SUMMARY",
        title: "9. Lesson summary",
        content:
          "- Convex polygon: all interior angles are less than 180°. Non-convex polygon: at least one interior angle is greater than 180°.\n- Complementary angles add to 90°. Supplementary angles add to 180°.\n- A linear pair is two adjacent angles that form a straight line, so they add to 180°.\n- Vertical angles are opposite each other when two lines intersect, and they are equal.",
      },
    ],
  },

  // ---------------------------------------------------------------- Week 3
  {
    id: "lsn_g7q1_w3",
    termNumber: 1,
    unitTitle: "Polygons and Angle Relationships",
    sequenceOrder: 3,
    title: "Interior and Exterior Angles of Polygons",
    description:
      "Relate an exterior angle to its adjacent interior angle, and find angle measures and the number of sides of a polygon.",
    learningObjectives: [
      "Identify the interior and exterior angles of a polygon",
      "Deduce that an exterior angle and its adjacent interior angle add up to 180°",
      "Find the sum of the interior angles and the sum of the exterior angles of a polygon",
      "Determine the angle measures and the number of sides of a regular polygon",
    ],
    estimatedMinutes: 45,
    documents: [{ fileName: "LE_MATH-7-Q1_W3.pdf", title: "Lesson Exemplar Q1 Lesson 3 (Teacher Reference)" }],
    blocks: [
      {
        type: "TEXT",
        title: "1. Interior and exterior angles",
        content:
          "An **interior angle** of a polygon is formed inside the polygon by two sides that meet at a vertex.\n\nAn **exterior angle** is formed outside the polygon when one side is extended past a vertex. It is the angle between that extension and the next side.\n\nAt each vertex, the exterior angle and the interior angle next to it form a **linear pair**, so\n\n**exterior angle + adjacent interior angle = 180°**.",
      },
      example(
        "2. Worked example: Exterior and adjacent interior",
        "An exterior angle of a polygon measures 100°. Find the adjacent interior angle.",
        [
          "An exterior angle and its adjacent interior angle are supplementary.",
          "Write the equation: 100° + interior = 180°.",
          "Subtract 100° from both sides: interior = 180° − 100° = 80°.",
        ],
        "The adjacent interior angle is 80°."
      ),
      {
        type: "TEXT",
        title: "3. Sum of the angles of a polygon",
        content:
          "For a polygon with **n** sides:\n\n- Sum of the interior angles = (n − 2) × 180°\n- Sum of the exterior angles (one at each vertex) = 360°, for every polygon\n\nFor a **regular** polygon with n sides:\n\n- Each interior angle = (n − 2) × 180° ÷ n\n- Each exterior angle = 360° ÷ n\n\nThe number of sides of a regular polygon is n = 360° ÷ (each exterior angle).",
      },
      example(
        "4. Worked example: Sum of interior angles",
        "Find the sum of the interior angles of a nonagon.",
        ["A nonagon has n = 9 sides.", "Use (n − 2) × 180° = (9 − 2) × 180° = 7 × 180°."],
        "1,260°"
      ),
      example(
        "5. Worked example: Regular decagon",
        "Find each interior angle and each exterior angle of a regular decagon.",
        [
          "A decagon has n = 10 sides.",
          "Each exterior angle = 360° ÷ 10 = 36°.",
          "Each interior angle = 180° − 36° = 144°. Check: (10 − 2) × 180° ÷ 10 = 1,440° ÷ 10 = 144°.",
        ],
        "Each exterior angle is 36° and each interior angle is 144°."
      ),
      example(
        "6. Worked example: How many sides?",
        "Each exterior angle of a regular polygon is 40°. How many sides does it have?",
        ["Use n = 360° ÷ (each exterior angle).", "n = 360° ÷ 40° = 9."],
        "The polygon has 9 sides (a regular nonagon)."
      ),
      example(
        "7. Worked example: Missing angle",
        "Four interior angles of a pentagon measure 100°, 110°, 120° and 90°. Find the fifth angle.",
        [
          "The sum of the interior angles of a pentagon is (5 − 2) × 180° = 540°.",
          "Add the four known angles: 100° + 110° + 120° + 90° = 420°.",
          "The fifth angle is 540° − 420° = 120°.",
        ],
        "The fifth angle is 120°."
      ),
      checkpoint(
        "8. Checkpoint: Sum of interior angles",
        "What is the sum of the interior angles of a hexagon?",
        ["540°", "720°", "900°", "1,080°"],
        "720°",
        "A hexagon has n = 6 sides, so the sum is (6 − 2) × 180° = 4 × 180° = 720°."
      ),
      checkpoint(
        "9. Checkpoint: Exterior angle of a regular octagon",
        "What is each exterior angle of a regular octagon?",
        ["36°", "40°", "45°", "135°"],
        "45°",
        "Each exterior angle of a regular polygon is 360° ÷ n = 360° ÷ 8 = 45°. (135° is each interior angle.)"
      ),
      checkpoint(
        "10. Checkpoint: Number of sides",
        "Each exterior angle of a regular polygon is 20°. How many sides does the polygon have?",
        ["9", "12", "18", "20"],
        "18",
        "n = 360° ÷ 20° = 18."
      ),
      checkpoint(
        "11. Checkpoint: Adjacent interior angle",
        "An exterior angle of a polygon measures 55°. What is the adjacent interior angle?",
        ["35°", "125°", "135°", "305°"],
        "125°",
        "The exterior angle and its adjacent interior angle add up to 180°, so the interior angle is 180° − 55° = 125°."
      ),
      {
        type: "SUMMARY",
        title: "12. Lesson summary",
        content:
          "- Exterior angle + adjacent interior angle = 180°.\n- The interior angles of an n-sided polygon add up to (n − 2) × 180°.\n- The exterior angles of any polygon add up to 360°.\n- In a regular polygon, each exterior angle is 360° ÷ n, and each interior angle is 180° minus that.",
      },
    ],
  },

  // ---------------------------------------------------------------- Week 4
  {
    id: "lsn_g7q1_w4",
    termNumber: 1,
    unitTitle: "Percentages and Rates",
    sequenceOrder: 1,
    title: "Percentage Increase and Percentage Decrease",
    description:
      "Find a percentage increase or decrease from an original and a new value, and use percentages to find a new value.",
    learningObjectives: [
      "Calculate the percentage increase from an original value and a new value",
      "Calculate the percentage decrease from an original value and a new value",
      "Find the new value after a given percentage increase or decrease",
      "Solve real-life problems involving percentage increase and decrease",
    ],
    estimatedMinutes: 40,
    documents: [{ fileName: "LE_MATH-7-Q1_W4.pdf", title: "Lesson Exemplar Q1 Lesson 4 (Teacher Reference)" }],
    blocks: [
      {
        type: "TEXT",
        title: "1. Measuring change with percentages",
        content:
          "A **percentage change** compares the amount of change to the **original value**.\n\n- **Percentage increase** = (new value − original value) ÷ original value × 100%\n- **Percentage decrease** = (original value − new value) ÷ original value × 100%\n\nAlways divide by the **original** value, not the new one.",
      },
      example(
        "2. Worked example: Is the claim true?",
        "A product costs ₱200. A salesman says that next week it will cost ₱280 because of a 30% increase. Is he right?",
        [
          "Find the increase: ₱280 − ₱200 = ₱80.",
          "Divide by the original value: 80 ÷ 200 = 0.40.",
          "Write it as a percent: 0.40 × 100% = 40%.",
        ],
        "The increase is 40%, not 30%, so the salesman is wrong. A 30% increase would give ₱200 + ₱60 = ₱260."
      ),
      example(
        "3. Worked example: Percentage decrease",
        "The price of a bag falls from ₱500 to ₱400. Find the percentage decrease.",
        [
          "Find the decrease: ₱500 − ₱400 = ₱100.",
          "Divide by the original value: 100 ÷ 500 = 0.20.",
          "Write it as a percent: 0.20 × 100% = 20%.",
        ],
        "The price decreased by 20%."
      ),
      example(
        "4. Worked example: Finding the new value",
        "A ₱350 item increases in price by 20%. What is the new price?",
        [
          "Find the increase: 20% of ₱350 = 0.20 × 350 = ₱70.",
          "Add it to the original price: ₱350 + ₱70 = ₱420.",
        ],
        "The new price is ₱420. (Shortcut: 350 × 1.20 = 420.)"
      ),
      checkpoint(
        "5. Checkpoint: Percentage increase",
        "A value changes from 80 to 100. What is the percentage increase?",
        ["20%", "25%", "80%", "125%"],
        "25%",
        "The increase is 100 − 80 = 20. Divide by the original value: 20 ÷ 80 = 0.25 = 25%."
      ),
      checkpoint(
        "6. Checkpoint: Percentage decrease",
        "A jacket's price goes from ₱1,200 to ₱900. What is the percentage decrease?",
        ["20%", "25%", "30%", "33%"],
        "25%",
        "The decrease is 1,200 − 900 = 300. Divide by the original value: 300 ÷ 1,200 = 0.25 = 25%."
      ),
      checkpoint(
        "7. Checkpoint: New value",
        "A ₱250 item increases in price by 12%. What is the new price?",
        ["₱262", "₱280", "₱300", "₱370"],
        "₱280",
        "The increase is 12% of 250 = 0.12 × 250 = ₱30, so the new price is ₱250 + ₱30 = ₱280."
      ),
      checkpoint(
        "8. Checkpoint: Common mistake",
        "A price rises from ₱50 to ₱75, then falls back from ₱75 to ₱50. Which statement is true?",
        [
          "The percentage increase and the percentage decrease are both 50%",
          "The percentage increase is 50% and the percentage decrease is about 33%",
          "The percentage increase is 33% and the percentage decrease is 50%",
          "Both are 25%",
        ],
        "The percentage increase is 50% and the percentage decrease is about 33%",
        "The increase is 25 ÷ 50 = 50% of the original ₱50. The decrease is 25 ÷ 75 = about 33% of the original ₱75. The original value is different each time."
      ),
      {
        type: "SUMMARY",
        title: "9. Lesson summary",
        content:
          "- Percentage increase = (new − original) ÷ original × 100%.\n- Percentage decrease = (original − new) ÷ original × 100%.\n- To find a new value: new = original ± (percent × original).\n- The percentage is always based on the original value.",
      },
    ],
  },

  // ---------------------------------------------------------------- Week 5
  {
    id: "lsn_g7q1_w5",
    termNumber: 1,
    unitTitle: "Percentages and Rates",
    sequenceOrder: 2,
    title: "Money Problems with Percentages and a Daily Financial Plan",
    description:
      "Solve problems on discount, sale price, commission, sales tax and simple interest, and create a one-day financial plan.",
    learningObjectives: [
      "Define discount, sale price, commission, sales tax and simple interest",
      "Solve money problems involving percentages",
      "Create a one-day budget plan and write a formula for it",
    ],
    estimatedMinutes: 45,
    documents: [{ fileName: "LE_MATH-7-Q1_W5.pdf", title: "Lesson Exemplar Q1 Lesson 5 (Teacher Reference)" }],
    blocks: [
      {
        type: "TEXT",
        title: "1. Money words and formulas",
        content:
          "- **Discount** is the amount taken off the original price. Discount = discount rate × original price.\n- **Sale price** = original price − discount.\n- **Commission** is a payment, usually a percentage of sales, that a seller earns. Commission = commission rate × total sales.\n- **Sales tax** is a percentage of the price that is added when you buy. Total cost = price + sales tax.\n- **Simple interest** is the money earned (or paid) on an amount over time: **I = P × r × t**, where P is the principal (the starting amount), r is the yearly rate written as a decimal, and t is the time in years.",
      },
      example(
        "2. Worked example: Discount",
        "A shirt costs ₱800 and is on sale at 25% off. Find the discount and the sale price.",
        [
          "Discount = 25% of ₱800 = 0.25 × 800 = ₱200.",
          "Sale price = ₱800 − ₱200 = ₱600.",
        ],
        "The discount is ₱200 and the sale price is ₱600."
      ),
      example(
        "3. Worked example: Commission",
        "A sales agent earns 8% commission. She sells ₱45,000 worth of goods. How much is her commission?",
        ["Commission = 8% of ₱45,000 = 0.08 × 45,000."],
        "Her commission is ₱3,600."
      ),
      example(
        "4. Worked example: Sales tax",
        "A bag costs ₱1,500. A 12% sales tax is added. What is the total cost?",
        ["Sales tax = 12% of ₱1,500 = 0.12 × 1,500 = ₱180.", "Total cost = ₱1,500 + ₱180 = ₱1,680."],
        "The total cost is ₱1,680."
      ),
      example(
        "5. Worked example: Simple interest",
        "Mia saves ₱5,000 in a bank at 4% simple interest per year. How much interest does she earn in 3 years, and what is her total?",
        [
          "P = ₱5,000, r = 4% = 0.04, t = 3 years.",
          "I = P × r × t = 5,000 × 0.04 × 3 = ₱600.",
          "Total = ₱5,000 + ₱600 = ₱5,600.",
        ],
        "She earns ₱600 interest and has ₱5,600 in total."
      ),
      {
        type: "TEXT",
        title: "6. A one-day financial plan",
        content:
          "A **financial plan** shows how you will use your money. For one day, start with your income (for example your allowance) and give each use of it a percentage.\n\nSample plan for a ₱150 allowance:\n\n| Use | Percent | Amount |\n|---|---|---|\n| Food | 50% | ₱75 |\n| Transportation | 20% | ₱30 |\n| Savings | 20% | ₱30 |\n| Others | 10% | ₱15 |\n\nThe percentages add up to 100%, so all of the money is planned.\n\n**Formula:** Amount for a use = percent × income. **Savings = income − total expenses.**\n\n**Try it yourself:** Choose a daily amount, list at least four uses, give each a percentage that adds up to 100%, and compute the amounts.",
      },
      checkpoint(
        "7. Checkpoint: Sale price",
        "A pair of shoes costs ₱1,200 and has a 15% discount. What is the sale price?",
        ["₱180", "₱1,020", "₱1,185", "₱1,380"],
        "₱1,020",
        "Discount = 0.15 × 1,200 = ₱180. Sale price = 1,200 − 180 = ₱1,020."
      ),
      checkpoint(
        "8. Checkpoint: Commission",
        "A seller earns 5% commission on ₱20,000 of sales. How much is the commission?",
        ["₱100", "₱500", "₱1,000", "₱4,000"],
        "₱1,000",
        "Commission = 0.05 × 20,000 = ₱1,000."
      ),
      checkpoint(
        "9. Checkpoint: Total cost with tax",
        "An item costs ₱500 and a 12% sales tax is added. What is the total cost?",
        ["₱512", "₱560", "₱600", "₱620"],
        "₱560",
        "Sales tax = 0.12 × 500 = ₱60, so the total cost is 500 + 60 = ₱560."
      ),
      checkpoint(
        "10. Checkpoint: Simple interest",
        "How much simple interest is earned on ₱2,000 at 5% per year for 2 years?",
        ["₱100", "₱200", "₱2,200", "₱4,000"],
        "₱200",
        "I = P × r × t = 2,000 × 0.05 × 2 = ₱200."
      ),
      checkpoint(
        "11. Checkpoint: Budget plan",
        "Your daily allowance is ₱200. You plan 40% for food, 25% for transportation and 15% for savings. What percent is left for other uses?",
        ["10%", "20%", "25%", "80%"],
        "20%",
        "40% + 25% + 15% = 80%, so 100% − 80% = 20% is left. That is ₱40."
      ),
      {
        type: "SUMMARY",
        title: "12. Lesson summary",
        content:
          "- Discount = rate × original price; sale price = original price − discount.\n- Commission = rate × sales.\n- Sales tax = rate × price; total cost = price + tax.\n- Simple interest I = P × r × t.\n- A financial plan gives each use of money a percentage that adds up to 100%; amount = percent × income, and savings = income − expenses.",
      },
    ],
  },

  // ---------------------------------------------------------------- Week 6
  {
    id: "lsn_g7q1_w6",
    termNumber: 1,
    unitTitle: "Percentages and Rates",
    sequenceOrder: 3,
    title: "Rates and Unit Rates",
    description: "Identify rates, express them as unit rates, and solve problems about speed and other rates.",
    learningObjectives: [
      "Define a rate and give examples of rates",
      "Explain the uses of rates",
      "Express a rate as a unit rate",
      "Solve problems involving rates such as speed",
    ],
    estimatedMinutes: 40,
    documents: [{ fileName: "LE_MATH-7-Q1_W6.pdf", title: "Lesson Exemplar Q1 Lesson 6 (Teacher Reference)" }],
    blocks: [
      {
        type: "TEXT",
        title: "1. What is a rate?",
        content:
          "A **rate** compares two quantities that have **different units**. Examples: ₱45 per kilogram, 60 kilometers per hour, 240 words in 4 minutes.\n\nA **ratio** compares quantities that have the same unit, like 3 boys to 5 girls. A rate has two different units, like pesos and kilograms.\n\nA **unit rate** is a rate whose second quantity is 1, such as ₱40 per 1 kilogram. To find a unit rate, divide the first quantity by the second.\n\n**Speed** is a rate: speed = distance ÷ time. Rates are used to compare prices, to compute speed, pay per hour, fuel use, and more.",
      },
      example(
        "2. Worked example: Unit rate",
        "A 3 kg bag of rice costs ₱120. What is the price per kilogram?",
        ["Divide the cost by the number of kilograms: 120 ÷ 3 = 40."],
        "₱40 per kilogram."
      ),
      example(
        "3. Worked example: Speed",
        "A bus travels 150 kilometers in 2.5 hours. What is its speed?",
        ["Speed = distance ÷ time = 150 ÷ 2.5 = 60."],
        "60 kilometers per hour."
      ),
      example(
        "4. Worked example: The better buy",
        "A 500 g pack of noodles costs ₱45 and a 750 g pack costs ₱63. Which is the better buy?",
        [
          "Find the price per gram of the 500 g pack: 45 ÷ 500 = ₱0.09 per gram.",
          "Find the price per gram of the 750 g pack: 63 ÷ 750 = ₱0.084 per gram.",
          "The smaller unit price is the better buy.",
        ],
        "The 750 g pack is the better buy (₱0.084 per gram compared with ₱0.09 per gram)."
      ),
      example(
        "5. Worked example: Distance and time",
        "A jeepney travels at 40 km/h. How far does it go in 3 hours? How long does it take to go 100 km?",
        [
          "Distance = speed × time = 40 × 3 = 120 km.",
          "Time = distance ÷ speed = 100 ÷ 40 = 2.5 hours.",
        ],
        "It goes 120 km in 3 hours and needs 2.5 hours to travel 100 km."
      ),
      checkpoint(
        "6. Checkpoint: Which is a rate?",
        "Which of the following is a rate?",
        [
          "3 boys to 5 girls",
          "5 kilometers per hour",
          "2 red pens to 3 blue pens",
          "The ratio 4 : 9 of two lengths in centimeters",
        ],
        "5 kilometers per hour",
        "A rate compares quantities with different units (kilometers and hours). The others compare quantities with the same unit."
      ),
      checkpoint(
        "7. Checkpoint: Unit rate",
        "A typist types 240 words in 4 minutes. What is the unit rate?",
        ["16 words per minute", "40 words per minute", "60 words per minute", "244 words per minute"],
        "60 words per minute",
        "Divide the words by the minutes: 240 ÷ 4 = 60 words per minute."
      ),
      checkpoint(
        "8. Checkpoint: Distance",
        "A car travels at 45 km/h for 2 hours. How far does it travel?",
        ["22.5 km", "47 km", "90 km", "180 km"],
        "90 km",
        "Distance = speed × time = 45 × 2 = 90 km."
      ),
      checkpoint(
        "9. Checkpoint: Time",
        "How long does it take to travel 120 km at 60 km/h?",
        ["0.5 hour", "2 hours", "60 hours", "7,200 hours"],
        "2 hours",
        "Time = distance ÷ speed = 120 ÷ 60 = 2 hours."
      ),
      checkpoint(
        "10. Checkpoint: Better buy",
        "A 2-liter bottle of juice costs ₱90 and a 3-liter bottle costs ₱120. Which statement is true?",
        [
          "The 2-liter bottle is cheaper per liter (₱45 per liter)",
          "The 3-liter bottle is cheaper per liter (₱40 per liter)",
          "Both cost ₱45 per liter",
          "You cannot compare them",
        ],
        "The 3-liter bottle is cheaper per liter (₱40 per liter)",
        "90 ÷ 2 = ₱45 per liter, and 120 ÷ 3 = ₱40 per liter. The smaller unit rate is the better buy."
      ),
      {
        type: "SUMMARY",
        title: "11. Lesson summary",
        content:
          "- A rate compares two quantities with different units.\n- A unit rate is a rate per 1 unit: divide the first quantity by the second.\n- Speed = distance ÷ time, so distance = speed × time and time = distance ÷ speed.\n- Compare prices by finding unit rates; the smaller unit price is the better buy.",
      },
    ],
  },
];
