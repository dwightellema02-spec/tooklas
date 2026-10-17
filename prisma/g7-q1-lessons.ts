/**
 * Grade 7 Mathematics, Term 1, Weeks 1-7: original draft lessons written from the learning
 * competencies of the DepEd MATATAG Three-Term Budget of Work (April 2026) and the sub-topics of the
 * weekly Lesson Exemplars.
 *
 * A week is several class days, so a week is NOT one lesson: each lesson covers one sub-topic of the
 * week and stays inside what the Budget of Work and the exemplar list for it.
 *
 * These are NOT copies of the DepEd Lesson Exemplars, which are restricted to teacher use. All lessons
 * are seeded as DRAFT for teacher review.
 */

import { LESSON_EXPLORERS, LESSON_FIGURES } from "./g7-q1-figures.ts";

export interface DraftBlock {
  /** Set for blocks added after the first release (figures), so their ids never change when blocks move. */
  id?: string;
  type: "TEXT" | "EXAMPLE" | "CHECKPOINT" | "SUMMARY" | "IMAGE" | "INTERACTIVE";
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface DraftVideo {
  youtubeId: string;
  title: string;
  channel: string;
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
  /** Supporting videos shown to students on the lesson page. */
  videos: DraftVideo[];
  blocks: DraftBlock[];
}

interface Day {
  focus: string;
  blocks: DraftBlock[];
}

interface LessonSpec extends Omit<DraftLesson, "blocks" | "estimatedMinutes"> {
  days: Day[];
}

const MINUTES_PER_DAY = 45;

const text = (title: string, content: string): DraftBlock => ({ type: "TEXT", title, content });

const summary = (title: string, content: string): DraftBlock => ({ type: "SUMMARY", title, content });

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

/** Flattens the days into numbered blocks. A lesson with more than one day gets day markers and a break. */
function buildLesson(spec: LessonSpec): DraftLesson {
  const { days, ...rest } = spec;
  const blocks: DraftBlock[] = [];
  const multiDay = days.length > 1;
  days.forEach((day, d) => {
    if (multiDay) {
      blocks.push(
        text(
          `Day ${d + 1}: ${day.focus}`,
          `**Day ${d + 1} of ${days.length}.** Today: ${day.focus.toLowerCase()}.\n\nPlan about ${MINUTES_PER_DAY} minutes. When you finish the checkpoints you can stop for today. Your progress is saved, so you can continue tomorrow.`
        )
      );
    }
    blocks.push(...day.blocks);
    if (multiDay && d < days.length - 1) {
      blocks.push(
        text(
          `End of Day ${d + 1}`,
          `You finished Day ${d + 1}. Rest, and review your notes before tomorrow.\n\n**Next: Day ${d + 2}, ${days[d + 1].focus.toLowerCase()}.**`
        )
      );
    }
  });
  // Illustrations: each figure goes right after the block it is anchored to, in the order they are listed.
  for (const f of LESSON_FIGURES[spec.id] ?? []) {
    let at = blocks.findIndex((b) => b.title === f.after);
    if (at < 0) throw new Error(`${spec.id}: figure "${f.file}" is anchored to "${f.after}", which is not a block of this lesson`);
    while (blocks[at + 1]?.id !== undefined) at++;
    blocks.splice(at + 1, 0, {
      id: `${spec.id}_fig_${f.file}`,
      type: "IMAGE",
      title: f.title,
      content: f.caption,
      metadata: { url: `/illustrations/${f.file}.svg`, alt: f.alt, caption: f.caption },
    });
  }
  for (const x of LESSON_EXPLORERS[spec.id] ?? []) {
    let at = blocks.findIndex((b) => b.title === x.after);
    if (at < 0) throw new Error(`${spec.id}: explorer "${x.slug}" is anchored to "${x.after}", which is not a block of this lesson`);
    while (blocks[at + 1]?.id !== undefined) at++;
    blocks.splice(at + 1, 0, {
      id: `${spec.id}_exp_${x.slug}`,
      type: "INTERACTIVE",
      title: x.title,
      content: x.hint,
      metadata: x.metadata,
    });
  }
  return {
    ...rest,
    estimatedMinutes: days.length * MINUTES_PER_DAY,
    blocks: blocks.map((b, i) => ({ ...b, title: `${i + 1}. ${b.title}` })),
  };
}

const BOW_DOC = {
  fileName: "G7-BOW-Mathematics-7-Three-Term-1 (1).pdf",
  title: "Grade 7 Mathematics Three-Term Budget of Work (Teacher Reference)",
};
const LE = (week: number, file: string) => ({
  fileName: file,
  title: `Lesson Exemplar Q1 Lesson ${week} (Teacher Reference)`,
});
const LE1 = LE(1, "Q1_LE_Mathematics-7_Lesson-1_Week-1.pdf");
const LE2 = LE(2, "LE_MATH-7-Q1_W2.pdf");
const LE3 = LE(3, "LE_MATH-7-Q1_W3.pdf");
const LE4 = LE(4, "LE_MATH-7-Q1_W4.pdf");
const LE5 = LE(5, "LE_MATH-7-Q1_W5.pdf");
const LE6 = LE(6, "LE_MATH-7-Q1_W6.pdf");

const ISIP = "Math Isip";
const video = (youtubeId: string, title: string): DraftVideo => ({ youtubeId, title, channel: ISIP });

const POLYGONS = "Polygons and Angle Relationships";
const PERCENT = "Percentages and Rates";
const RATIONAL = "Rational Numbers and Roots";

const SPECS: LessonSpec[] = [
  // ================================================================ WEEK 1
  {
    id: "lsn_g7q1_w1_l1",
    termNumber: 1,
    unitTitle: POLYGONS,
    sequenceOrder: 1,
    title: "Week 1 · Define a polygon and describe its properties",
    description: "Tell polygons from non-polygons, name polygons by their sides, and name their parts.",
    learningObjectives: [
      "Define a polygon",
      "Name polygons with 3 to 10 sides",
      "Name a polygon, its sides and its interior angles using its vertices",
    ],
    documents: [BOW_DOC, LE1],
    videos: [
      video("ea30OYqlJS8", "Grade 7 MATH Term 1 Week 1: Definition & Properties of a Polygon | MATATAG - Quarter 1 (Tagalog)"),
      video("dhOZ7Bg4QXc", "Grade 7 MATH Term 1 Week 1-2: Classification, Name & Parts of Polygon | MATATAG - Quarter 1 (Tagalog)"),
    ],
    days: [
      {
        focus: "Polygons and their parts",
        blocks: [
          text(
            "What is a polygon?",
            "A **polygon** is a closed flat figure made only of straight line segments. The segments meet only at their endpoints, which are called **vertices**.\n\nA figure is **not** a polygon if it is open, has a curved side, or if its sides cross each other in the middle.\n\nExamples of polygons: a triangle, a stop sign, a kite. Not polygons: a circle (curved), a letter V (open)."
          ),
          checkpoint(
            "Checkpoint: Is it a polygon?",
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
          text(
            "Naming a polygon and its parts",
            "A polygon is named using its vertices, in order. A triangle with vertices A, B and C may be called triangle ABC, triangle BCA or triangle ACB.\n\n- Its **sides** are AB, BC and AC.\n- Its **interior angles** are ∠BAC, ∠ABC and ∠BCA.\n\nA polygon always has the same number of sides, vertices and interior angles."
          ),
          text(
            "Naming polygons by their sides",
            "Polygons are named by their number of sides. The prefix tells the number: *tri-* is three, *quad-* is four, and so on.\n\n| Sides | Name | Interior angles |\n|---|---|---|\n| 3 | Triangle | 3 |\n| 4 | Quadrilateral | 4 |\n| 5 | Pentagon | 5 |\n| 6 | Hexagon | 6 |\n| 7 | Heptagon | 7 |\n| 8 | Octagon | 8 |\n| 9 | Nonagon | 9 |\n| 10 | Decagon | 10 |"
          ),
          checkpoint(
            "Checkpoint: Naming by sides",
            "A polygon has 8 sides. What is it called?",
            ["Hexagon", "Heptagon", "Octagon", "Nonagon"],
            "Octagon",
            "Octa- means eight. A hexagon has 6 sides, a heptagon 7 and a nonagon 9."
          ),
          checkpoint(
            "Checkpoint: Parts of a polygon",
            "How many interior angles does a hexagon have?",
            ["3", "5", "6", "8"],
            "6",
            "A polygon has as many interior angles as sides. A hexagon has 6 sides, so it has 6 interior angles."
          ),
          checkpoint(
            "Checkpoint: Naming sides",
            "Which are the sides of triangle ABC?",
            ["AB, BC and AC", "A, B and C", "∠A, ∠B and ∠C", "AB only"],
            "AB, BC and AC",
            "The sides join the vertices: AB, BC and AC. The letters A, B and C are the vertices."
          ),
          summary(
            "Lesson summary",
            "- A polygon is a closed figure made of straight sides that meet only at endpoints.\n- A polygon is named using its vertices and by its number of sides.\n- The number of sides, vertices and interior angles of a polygon is the same."
          ),
        ],
      },
    ],
  },
  {
    id: "lsn_g7q1_w1_l2",
    termNumber: 1,
    unitTitle: POLYGONS,
    sequenceOrder: 2,
    title: "Week 1 · Regular and irregular polygons",
    description: "Name, describe and compare regular and irregular polygons with 5, 6, 8 or 10 sides.",
    learningObjectives: [
      "Tell regular polygons from irregular polygons",
      "Describe polygons with 5, 6, 8 or 10 sides using the measures of their sides and angles",
    ],
    documents: [LE1],
    videos: [
      video("YrxFavYSiks", "Grade 7 MATH Term 1 Week 1 to 2: Regular and Irregular Polygons | MATATAG - Quarter 1 (Tagalog)"),
      video("jM084u-2e2k", "Grade 7 MATH Term 1 Week 1: Describing Regular & Irregular Polygons | MATATAG - Quarter 1 (Tagalog)"),
    ],
    days: [
      {
        focus: "Regular and irregular polygons",
        blocks: [
          text(
            "Regular and irregular polygons",
            "- A polygon is **equilateral** if all its sides are equal.\n- A polygon is **equiangular** if all its angles are equal.\n- A **regular polygon** is both equilateral and equiangular.\n- An **irregular polygon** is not regular: its sides or its angles are not all equal.\n\nA regular triangle is called an **equilateral triangle**, and a regular quadrilateral is a **square**. For other regular polygons we add the word regular: regular pentagon, regular hexagon, and so on."
          ),
          text(
            "Angles of the regular polygons",
            "Measure the angles of these regular polygons and you find:\n\n| Regular polygon | Each interior angle | Sum of the interior angles |\n|---|---|---|\n| Pentagon (5 sides) | 108° | 540° |\n| Hexagon (6 sides) | 120° | 720° |\n| Octagon (8 sides) | 135° | 1,080° |\n| Decagon (10 sides) | 144° | 1,440° |\n\nThe sum of the interior angles is the same for a regular and an irregular polygon with the same number of sides. In Week 3 you will see why."
          ),
          example(
            "Worked example: Regular or irregular?",
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
            "Checkpoint: Interior angle",
            "What is the measure of each interior angle of a regular hexagon?",
            ["90°", "108°", "120°", "135°"],
            "120°",
            "Each interior angle of a regular hexagon measures 120°. (108° is for a regular pentagon and 135° for a regular octagon.)"
          ),
          checkpoint(
            "Checkpoint: Name from the angle",
            "A regular polygon has interior angles of 135° each. Which polygon is it?",
            ["Regular pentagon", "Regular hexagon", "Regular octagon", "Regular decagon"],
            "Regular octagon",
            "From the table: pentagon 108°, hexagon 120°, octagon 135°, decagon 144°. So 135° is a regular octagon."
          ),
          checkpoint(
            "Checkpoint: Sum of the angles",
            "What is the sum of the interior angles of an octagon?",
            ["720°", "900°", "1,080°", "1,440°"],
            "1,080°",
            "From the table, an octagon's interior angles add up to 1,080°."
          ),
          summary(
            "Lesson summary",
            "- A regular polygon has all sides equal and all angles equal. Otherwise it is irregular.\n- A regular triangle is an equilateral triangle, and a regular quadrilateral is a square.\n- Each interior angle is 108° in a regular pentagon, 120° in a regular hexagon, 135° in a regular octagon and 144° in a regular decagon."
          ),
        ],
      },
    ],
  },
  {
    id: "lsn_g7q1_w1_l3",
    termNumber: 1,
    unitTitle: POLYGONS,
    sequenceOrder: 3,
    title: "Week 1 · Draw polygons",
    description:
      "Draw regular polygons with 5, 6, 8 or 10 sides, and triangles and quadrilaterals with given angle measures, using a ruler, protractor and compass.",
    learningObjectives: [
      "Draw regular polygons with 5, 6, 8 or 10 sides",
      "Draw triangles and quadrilaterals with given angle measures",
    ],
    documents: [LE1],
    videos: [
      video("0mw2ZRlxNQM", "Grade 7 & Grade 4 MATH: Review on How to Measure Angles Using Protractor | MATATAG T1/Q1 (Tagalog)"),
      video("hmmv9XtPPc0", "Grade 7 & Grade 4 MATH: Review on Drawing Angles Using Protractor | MATATAG - T1/Q1 (Tagalog)"),
      video("hlVgAIClhgM", "Grade 7 MATH Term 1 Week 1: How to Draw a Regular Pentagon | MATATAG - Quarter 1 (Tagalog)"),
      video("yNOdp3hfYfk", "Grade 7 MATH Term 1 Week 1: Drawing Triangles & Quadrilaterals | MATATAG - Quarter 1 (Tagalog)"),
    ],
    days: [
      {
        focus: "Drawing regular polygons",
        blocks: [
          text(
            "What you need",
            "For drawing you need a sharp pencil, a ruler, a protractor and a compass. If you are not sure how to measure or draw an angle with a protractor, watch the two protractor review videos first."
          ),
          example(
            "Worked example: Drawing a regular pentagon",
            "Draw a regular pentagon using a compass, ruler and protractor.",
            [
              "Use the compass to draw a circle. Mark its center O. The radius sets the size of the pentagon.",
              "A pentagon has 5 equal parts, so the angle at the center for each part is 360° ÷ 5 = 72°.",
              "Mark a starting point on the circle. Using the protractor at O, mark a new point every 72° around the circle.",
              "Connect each marked point to the next one with the ruler. Measure the sides to check they are equal.",
            ],
            "The 5 points joined in order form a regular pentagon."
          ),
          example(
            "Worked example: Drawing a regular hexagon",
            "Draw a regular hexagon with sides of 3 cm.",
            [
              "A hexagon has 6 equal parts, so the angle at the center is 360° ÷ 6 = 60°.",
              "Draw a circle with a radius of 3 cm. For a regular hexagon the side equals the radius.",
              "Mark a point on the circle, then mark a new point every 60° around the center.",
              "Join the six points in order and measure each side. They should all be 3 cm.",
            ],
            "A regular hexagon with sides of 3 cm. For an octagon use 45° at the center, and for a decagon 36°."
          ),
          checkpoint(
            "Checkpoint: The center angle",
            "To draw a regular decagon, at what angle around the center do you mark each point?",
            ["30°", "36°", "40°", "45°"],
            "36°",
            "A decagon has 10 sides, so the center angle is 360° ÷ 10 = 36°."
          ),
          checkpoint(
            "Checkpoint: Hexagon side",
            "A regular hexagon is drawn inside a circle of radius 4 cm. How long is each side?",
            ["2 cm", "4 cm", "6 cm", "8 cm"],
            "4 cm",
            "In a regular hexagon the side is equal to the radius of the circle around it, so each side is 4 cm."
          ),
        ],
      },
      {
        focus: "Drawing triangles and quadrilaterals",
        blocks: [
          text(
            "Angles in triangles and quadrilaterals",
            "- The three angles of a triangle add up to **180°**.\n- The four angles of a quadrilateral add up to **360°**.\n\nThese facts help you check a drawing. If the angles you measure do not add up, there is a drawing or measuring error."
          ),
          example(
            "Worked example: A triangle with given angles",
            "Draw triangle ABC with AB = 5 cm, angle A = 50° and angle B = 60°.",
            [
              "Draw the segment AB = 5 cm with the ruler.",
              "Place the protractor at A and mark 50°. Draw a long ray from A through the mark.",
              "Place the protractor at B and mark 60°. Draw a ray from B through the mark.",
              "The two rays meet at point C. Measure angle C: it should be 180° − 50° − 60° = 70°.",
            ],
            "Triangle ABC with angles 50°, 60° and 70°."
          ),
          example(
            "Worked example: A quadrilateral with given angles",
            "Draw quadrilateral ABCD with AB = 6 cm, AD = 4 cm, angle A = 90°, angle B = 90° and angle D = 100°.",
            [
              "Draw AB = 6 cm. At A and at B, draw lines at 90° to AB, on the same side.",
              "Mark D on the line at A so that AD = 4 cm.",
              "At D, use the protractor to draw a line so that angle ADC = 100°. It meets the line at B at point C.",
              "Check: angle C = 360° − 90° − 90° − 100° = 80°. Measure it to confirm.",
            ],
            "Quadrilateral ABCD with angles 90°, 90°, 80° and 100°."
          ),
          checkpoint(
            "Checkpoint: Third angle",
            "A triangle has angles of 50° and 60°. What is the third angle?",
            ["60°", "70°", "80°", "110°"],
            "70°",
            "The angles of a triangle add up to 180°, so the third angle is 180° − 50° − 60° = 70°."
          ),
          checkpoint(
            "Checkpoint: Fourth angle",
            "Three angles of a quadrilateral are 90°, 90° and 100°. What is the fourth angle?",
            ["70°", "80°", "90°", "100°"],
            "80°",
            "The angles of a quadrilateral add up to 360°, so the fourth angle is 360° − 90° − 90° − 100° = 80°."
          ),
          summary(
            "Lesson summary",
            "- To draw a regular polygon with n sides, mark points every 360° ÷ n around a circle and join them in order.\n- The angles of a triangle add to 180° and the angles of a quadrilateral add to 360°, which lets you check a drawing."
          ),
        ],
      },
    ],
  },

  // ================================================================ WEEK 2
  {
    id: "lsn_g7q1_w2_l1",
    termNumber: 1,
    unitTitle: POLYGONS,
    sequenceOrder: 4,
    title: "Week 2 · Convex and non-convex polygons",
    description: "Tell convex polygons from non-convex ones, and classify polygons by sides, regularity and convexity.",
    learningObjectives: [
      "Tell convex polygons from non-convex (concave) polygons",
      "Classify polygons by number of sides, as regular or irregular, and as convex or non-convex",
    ],
    documents: [LE2],
    videos: [
      video("g8Y_0BrWIlA", "Grade 7 MATH Term 1 Week 2: Concave and Convex Polygons | MATATAG - Quarter 1 (Tagalog)"),
      video("O-kpbzRTArY", "Grade 7 MATH Term 1 Week 1-2: Polygon Short Quiz | MATATAG - Quarter 1 (Tagalog)"),
      video("QXFU2-v0yXw", "Grade 7 MATH Term 1 Week 2: Measuring Convex & Concave Polygons | MATATAG - Quarter 1 (Tagalog)"),
    ],
    days: [
      {
        focus: "Convex and non-convex polygons",
        blocks: [
          text(
            "Convex and non-convex polygons",
            "A **convex polygon** has all interior angles less than 180°. If you pick any two points inside it, the straight line between them stays inside the polygon. No vertex points inward.\n\nA **non-convex (concave) polygon** has at least one interior angle greater than 180°. At least one vertex points inward, like the notch of an arrowhead, and some lines between two points inside go outside the polygon.\n\nRegular polygons are convex. A polygon can be irregular and still be convex."
          ),
          checkpoint(
            "Checkpoint: Convex or not?",
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
          text(
            "Three ways to classify",
            "Every polygon can be described in three ways:\n\n1. By its **number of sides** (triangle, quadrilateral, pentagon, ...).\n2. As **regular or irregular** (are all sides and all angles equal?).\n3. As **convex or non-convex** (are all interior angles less than 180°?)."
          ),
          example(
            "Worked example: Classify the polygons",
            "Classify (a) a figure with 6 equal sides and 6 equal angles of 120°, and (b) an arrowhead shape with 4 sides, one of its angles measuring 210°.",
            [
              "For (a): 6 sides, so it is a hexagon. All sides and angles are equal, so it is regular. All angles are 120°, less than 180°, so it is convex.",
              "For (b): 4 sides, so it is a quadrilateral. Its sides and angles are not all equal, so it is irregular.",
              "One angle is 210°, more than 180°, so it is non-convex.",
            ],
            "(a) a regular, convex hexagon. (b) an irregular, non-convex quadrilateral."
          ),
          checkpoint(
            "Checkpoint: Classify it",
            "A polygon has 5 equal sides and 5 equal angles of 108°. How is it classified?",
            [
              "Regular, convex pentagon",
              "Irregular, convex pentagon",
              "Regular, non-convex pentagon",
              "Irregular, non-convex hexagon",
            ],
            "Regular, convex pentagon",
            "It has 5 sides, so it is a pentagon. Its sides and angles are all equal, so it is regular. All angles are less than 180°, so it is convex."
          ),
          summary(
            "Lesson summary",
            "- Convex polygon: all interior angles are less than 180°. Non-convex polygon: at least one interior angle is greater than 180°.\n- Classify a polygon by its sides, as regular or irregular, and as convex or non-convex.\n- After this lesson you can try the Week 1 to 2 polygon quiz video."
          ),
        ],
      },
    ],
  },
  {
    id: "lsn_g7q1_w2_l2",
    termNumber: 1,
    unitTitle: POLYGONS,
    sequenceOrder: 5,
    title: "Week 2 · Angle pairs",
    description:
      "Describe complementary, supplementary and adjacent angles, linear pairs and vertical angles, and find unknown angles.",
    learningObjectives: [
      "Define complementary, supplementary and adjacent angles, linear pairs and vertical angles",
      "Describe the relationships between angle pairs based on their measures",
      "Find an unknown angle using these relationships",
    ],
    documents: [LE2],
    videos: [
      video("Ac1FTMGBQoI", "Grade 7 MATH Term 1 Week 2: Angle Pairs | MATATAG - First Term/1st Quarter 1 (Tagalog Tutorial)"),
    ],
    days: [
      {
        focus: "Complementary, supplementary and adjacent angles",
        blocks: [
          text(
            "Angle pairs",
            "- **Complementary angles** are two angles whose measures add up to **90°**.\n- **Supplementary angles** are two angles whose measures add up to **180°**.\n- **Adjacent angles** share a vertex and a side, and do not overlap.\n\nComplementary and supplementary angles do not have to be next to each other."
          ),
          example(
            "Worked example: Complement and supplement",
            "Find the complement of 35° and the supplement of 110°.",
            [
              "Complementary angles add up to 90°, so the complement of 35° is 90° − 35° = 55°.",
              "Supplementary angles add up to 180°, so the supplement of 110° is 180° − 110° = 70°.",
            ],
            "The complement of 35° is 55°. The supplement of 110° is 70°."
          ),
          checkpoint(
            "Checkpoint: Complementary",
            "Two angles add up to 90°. What are they called?",
            ["Supplementary angles", "Complementary angles", "Vertical angles", "A linear pair"],
            "Complementary angles",
            "Angles that add up to 90° are complementary. Angles that add up to 180° are supplementary."
          ),
          checkpoint(
            "Checkpoint: Find the complement",
            "What is the complement of 62°?",
            ["18°", "28°", "118°", "298°"],
            "28°",
            "The complement of 62° is 90° − 62° = 28°."
          ),
        ],
      },
      {
        focus: "Linear pairs and vertical angles",
        blocks: [
          text(
            "Linear pairs and vertical angles",
            "- A **linear pair** is two adjacent angles whose non-shared sides form a straight line. A linear pair is always supplementary (180°).\n- **Vertical angles** are the opposite angles formed when two lines intersect. Vertical angles are always equal."
          ),
          example(
            "Worked example: Two intersecting lines",
            "Two lines intersect. One of the four angles measures 75°. Find the other three angles.",
            [
              "The angle opposite 75° is its vertical angle, so it is also 75°.",
              "Each of the other two angles forms a linear pair with the 75° angle, so each is 180° − 75° = 105°.",
              "Check: 75° + 75° + 105° + 105° = 360°, the full turn around the point.",
            ],
            "The four angles are 75°, 105°, 75° and 105°."
          ),
          checkpoint(
            "Checkpoint: Linear pair",
            "One angle of a linear pair measures 125°. What is the other angle?",
            ["35°", "55°", "65°", "125°"],
            "55°",
            "The angles of a linear pair add up to 180°, so the other angle is 180° − 125° = 55°."
          ),
          checkpoint(
            "Checkpoint: Vertical angles",
            "Two lines intersect and one angle is 48°. What is the angle vertical to it?",
            ["42°", "48°", "132°", "312°"],
            "48°",
            "Vertical angles are equal, so the angle opposite 48° is also 48°."
          ),
          summary(
            "Lesson summary",
            "- Complementary angles add to 90°. Supplementary angles add to 180°.\n- A linear pair is two adjacent angles that form a straight line, so they add to 180°.\n- Vertical angles are opposite each other when two lines intersect, and they are equal."
          ),
        ],
      },
    ],
  },

  // ================================================================ WEEK 3
  {
    id: "lsn_g7q1_w3_l1",
    termNumber: 1,
    unitTitle: POLYGONS,
    sequenceOrder: 6,
    title: "Week 3 · Interior and exterior angles",
    description: "Identify the interior and exterior angles of a polygon.",
    learningObjectives: ["Define interior and exterior angles of a polygon", "Identify them in a polygon"],
    documents: [LE3],
    videos: [
      video("M0dH6YwWzbg", "Grade 7 MATH Term 1 Week 3: Interior and Exterior Angles in a Polygon | MATATAG - Quarter 1 Tagalog"),
    ],
    days: [
      {
        focus: "Interior and exterior angles",
        blocks: [
          text(
            "Interior and exterior angles",
            "An **interior angle** of a polygon is formed inside the polygon by two sides that meet at a vertex.\n\nAn **exterior angle** is formed outside the polygon when one side is extended past a vertex. It is the angle between that extension and the next side.\n\nAt each vertex there is one interior angle and, next to it, an exterior angle. The two are **adjacent**."
          ),
          checkpoint(
            "Checkpoint: Interior or exterior?",
            "A side of a polygon is extended past a vertex. The angle between the extension and the next side is called a(n):",
            ["Interior angle", "Exterior angle", "Vertical angle", "Complementary angle"],
            "Exterior angle",
            "An angle formed outside the polygon by extending a side is an exterior angle."
          ),
          checkpoint(
            "Checkpoint: How many?",
            "A pentagon has one interior angle at each vertex. How many interior angles does it have?",
            ["3", "4", "5", "10"],
            "5",
            "There is one interior angle at each of the 5 vertices."
          ),
          summary(
            "Lesson summary",
            "- An interior angle is inside the polygon at a vertex.\n- An exterior angle is outside the polygon, formed by extending a side.\n- The exterior angle and the interior angle at the same vertex are adjacent."
          ),
        ],
      },
    ],
  },
  {
    id: "lsn_g7q1_w3_l2",
    termNumber: 1,
    unitTitle: POLYGONS,
    sequenceOrder: 7,
    title: "Week 3 · An exterior angle and its adjacent interior angle",
    description: "Deduce that an exterior angle and its adjacent interior angle add up to 180°, and use it.",
    learningObjectives: [
      "Deduce the relationship between an exterior angle and its adjacent interior angle",
      "Use the relationship to find an unknown angle",
    ],
    documents: [LE3],
    videos: [
      video("M0dH6YwWzbg", "Grade 7 MATH Term 1 Week 3: Interior and Exterior Angles in a Polygon | MATATAG - Quarter 1 Tagalog"),
    ],
    days: [
      {
        focus: "The relationship",
        blocks: [
          text(
            "The relationship",
            "At each vertex, the exterior angle and the interior angle next to it form a **linear pair**, so\n\n**exterior angle + adjacent interior angle = 180°**.\n\nThey are supplementary angles."
          ),
          example(
            "Worked example: Exterior and adjacent interior",
            "An exterior angle of a polygon measures 100°. Find the adjacent interior angle.",
            [
              "An exterior angle and its adjacent interior angle are supplementary.",
              "Write the equation: 100° + interior = 180°.",
              "Subtract 100° from both sides: interior = 180° − 100° = 80°.",
            ],
            "The adjacent interior angle is 80°."
          ),
          example(
            "Worked example: Use a triangle",
            "A triangle has interior angles of 38° and 60°. Find its third interior angle and the exterior angle next to that third angle.",
            [
              "The interior angles of a triangle add up to 180°, so the third angle is 180° − 38° − 60° = 82°.",
              "The exterior angle next to it is supplementary: 180° − 82° = 98°.",
            ],
            "The third interior angle is 82° and its exterior angle is 98°."
          ),
          checkpoint(
            "Checkpoint: Adjacent interior angle",
            "An exterior angle of a polygon measures 55°. What is the adjacent interior angle?",
            ["35°", "125°", "135°", "305°"],
            "125°",
            "The exterior angle and its adjacent interior angle add up to 180°, so the interior angle is 180° − 55° = 125°."
          ),
          checkpoint(
            "Checkpoint: Adjacent exterior angle",
            "An interior angle of a polygon measures 107°. What is the adjacent exterior angle?",
            ["63°", "73°", "83°", "107°"],
            "73°",
            "The two angles add up to 180°, so the exterior angle is 180° − 107° = 73°."
          ),
          summary("Lesson summary", "- Exterior angle + adjacent interior angle = 180°. They form a linear pair."),
        ],
      },
    ],
  },
  {
    id: "lsn_g7q1_w3_l3",
    termNumber: 1,
    unitTitle: POLYGONS,
    sequenceOrder: 8,
    title: "Week 3 · Measures of the angles of a polygon",
    description: "Find the sum of the interior angles of a polygon and use it to find a missing angle.",
    learningObjectives: [
      "Find the sum of the interior angles of a polygon",
      "Recall that the exterior angles of a polygon add up to 360°",
      "Find a missing angle of a polygon",
    ],
    documents: [LE3],
    videos: [
      video("0KRMtjuJHg8", "Grade 7 MATH Term 1 Week 3: Determining Measures of Angles of a Polygon | MATATAG Quarter 1 Tagalog"),
    ],
    days: [
      {
        focus: "Sum of the interior angles and missing angles",
        blocks: [
          text(
            "Sum of the angles of a polygon",
            "For a polygon with **n** sides:\n\n- Sum of the interior angles = (n − 2) × 180°\n- Sum of the exterior angles (one at each vertex) = 360°, for every polygon\n\nThe formula works because a polygon with n sides can be cut into (n − 2) triangles, and each triangle has 180°."
          ),
          example(
            "Worked example: Sum of interior angles",
            "Find the sum of the interior angles of a nonagon.",
            ["A nonagon has n = 9 sides.", "Use (n − 2) × 180° = (9 − 2) × 180° = 7 × 180°."],
            "1,260°"
          ),
          example(
            "Worked example: Missing angle",
            "Four interior angles of a pentagon measure 100°, 110°, 120° and 90°. Find the fifth angle.",
            [
              "The sum of the interior angles of a pentagon is (5 − 2) × 180° = 540°.",
              "Add the four known angles: 100° + 110° + 120° + 90° = 420°.",
              "The fifth angle is 540° − 420° = 120°.",
            ],
            "The fifth angle is 120°."
          ),
          example(
            "Worked example: Equal unknown angles",
            "A pentagon has three right angles and two equal angles, each x. Find x.",
            [
              "The sum of the interior angles is 540°.",
              "Write the equation: x + x + 90° + 90° + 90° = 540°, so 2x + 270° = 540°.",
              "Subtract 270°: 2x = 270°, so x = 135°.",
            ],
            "x = 135°."
          ),
          checkpoint(
            "Checkpoint: Sum of interior angles",
            "What is the sum of the interior angles of a hexagon?",
            ["540°", "720°", "900°", "1,080°"],
            "720°",
            "A hexagon has n = 6 sides, so the sum is (6 − 2) × 180° = 4 × 180° = 720°."
          ),
          checkpoint(
            "Checkpoint: Sixth angle",
            "Five angles of a hexagon measure 100°, 110°, 120°, 130° and 140°. What is the sixth angle?",
            ["100°", "110°", "120°", "130°"],
            "120°",
            "The five angles add up to 600°. The sum for a hexagon is 720°, so the sixth angle is 720° − 600° = 120°."
          ),
          summary(
            "Lesson summary",
            "- The interior angles of an n-sided polygon add up to (n − 2) × 180°.\n- The exterior angles of any polygon add up to 360°.\n- To find a missing angle, subtract the known angles from the sum."
          ),
        ],
      },
    ],
  },
  {
    id: "lsn_g7q1_w3_l4",
    termNumber: 1,
    unitTitle: POLYGONS,
    sequenceOrder: 9,
    title: "Week 3 · Angles and sides of regular polygons",
    description: "Find each angle of a regular polygon and the number of sides of a regular polygon.",
    learningObjectives: [
      "Find each interior and exterior angle of a regular polygon",
      "Determine the number of sides of a regular polygon from its angle",
    ],
    documents: [LE3],
    videos: [
      video("0KRMtjuJHg8", "Grade 7 MATH Term 1 Week 3: Determining Measures of Angles of a Polygon | MATATAG Quarter 1 Tagalog"),
    ],
    days: [
      {
        focus: "Each angle of a regular polygon",
        blocks: [
          text(
            "Regular polygons",
            "For a **regular** polygon with n sides:\n\n- Each interior angle = (n − 2) × 180° ÷ n\n- Each exterior angle = 360° ÷ n\n- Each interior angle + each exterior angle = 180°."
          ),
          example(
            "Worked example: Regular octagon",
            "Find the measure of each interior angle of a regular octagon.",
            [
              "An octagon has n = 8 sides.",
              "The sum of the interior angles is (8 − 2) × 180° = 1,080°.",
              "Each angle is 1,080° ÷ 8 = 135°.",
            ],
            "Each interior angle is 135°."
          ),
          example(
            "Worked example: Regular decagon",
            "Find each interior angle and each exterior angle of a regular decagon.",
            [
              "A decagon has n = 10 sides.",
              "Each exterior angle = 360° ÷ 10 = 36°.",
              "Each interior angle = 180° − 36° = 144°. Check: (10 − 2) × 180° ÷ 10 = 1,440° ÷ 10 = 144°.",
            ],
            "Each exterior angle is 36° and each interior angle is 144°."
          ),
          checkpoint(
            "Checkpoint: Exterior angle of a regular octagon",
            "What is each exterior angle of a regular octagon?",
            ["36°", "40°", "45°", "135°"],
            "45°",
            "Each exterior angle of a regular polygon is 360° ÷ n = 360° ÷ 8 = 45°. (135° is each interior angle.)"
          ),
        ],
      },
      {
        focus: "The number of sides of a regular polygon",
        blocks: [
          example(
            "Worked example: From the exterior angle",
            "Each exterior angle of a regular polygon is 40°. How many sides does it have?",
            ["Use n = 360° ÷ (each exterior angle).", "n = 360° ÷ 40° = 9."],
            "The polygon has 9 sides (a regular nonagon)."
          ),
          example(
            "Worked example: From the interior angle",
            "Each interior angle of a regular polygon is 144°. How many sides does it have?",
            [
              "The exterior angle is 180° − 144° = 36°.",
              "n = 360° ÷ 36° = 10.",
              "Check with the formula: (10 − 2) × 180° ÷ 10 = 144°.",
            ],
            "The polygon has 10 sides, a regular decagon."
          ),
          checkpoint(
            "Checkpoint: Number of sides",
            "Each exterior angle of a regular polygon is 20°. How many sides does the polygon have?",
            ["9", "12", "18", "20"],
            "18",
            "n = 360° ÷ 20° = 18."
          ),
          checkpoint(
            "Checkpoint: From the interior angle",
            "Each interior angle of a regular polygon is 150°. How many sides does it have?",
            ["10", "12", "15", "18"],
            "12",
            "The exterior angle is 180° − 150° = 30°, so n = 360° ÷ 30° = 12."
          ),
          summary(
            "Lesson summary",
            "- In a regular polygon each exterior angle is 360° ÷ n, and each interior angle is 180° minus that.\n- The number of sides is n = 360° ÷ (each exterior angle)."
          ),
        ],
      },
    ],
  },

  // ================================================================ WEEK 4
  {
    id: "lsn_g7q1_w4_l1",
    termNumber: 1,
    unitTitle: PERCENT,
    sequenceOrder: 1,
    title: "Week 4 · Percentage increase",
    description: "Solve problems involving percentage increase.",
    learningObjectives: [
      "Calculate the percentage increase from an original value and a new value",
      "Find the new value after a given percentage increase",
    ],
    documents: [LE4],
    videos: [
      video("xwEsbQ_sx7U", "Grade 7 MATH Term 1 Week 4: Percentage Increase | MATATAG - First Term/Quarter 1 (Tagalog Tutorial)"),
    ],
    days: [
      {
        focus: "Percentage increase",
        blocks: [
          text(
            "Measuring an increase with percentages",
            "A **percentage increase** compares the amount of increase to the **original value**.\n\n**Percentage increase = (new value − original value) ÷ original value × 100%**\n\nAlways divide by the **original** value, not the new one."
          ),
          example(
            "Worked example: Is the claim true?",
            "A product costs ₱200. A salesman says that next week it will cost ₱280 because of a 30% increase. Is he right?",
            [
              "Find the increase: ₱280 − ₱200 = ₱80.",
              "Divide by the original value: 80 ÷ 200 = 0.40.",
              "Write it as a percent: 0.40 × 100% = 40%.",
            ],
            "The increase is 40%, not 30%, so the salesman is wrong. A 30% increase would give ₱200 + ₱60 = ₱260."
          ),
          example(
            "Worked example: Finding the new value",
            "A ₱350 item increases in price by 20%. What is the new price?",
            ["Find the increase: 20% of ₱350 = 0.20 × 350 = ₱70.", "Add it to the original price: ₱350 + ₱70 = ₱420."],
            "The new price is ₱420. (Shortcut: 350 × 1.20 = 420.)"
          ),
          checkpoint(
            "Checkpoint: Percentage increase",
            "A value changes from 80 to 100. What is the percentage increase?",
            ["20%", "25%", "80%", "125%"],
            "25%",
            "The increase is 100 − 80 = 20. Divide by the original value: 20 ÷ 80 = 0.25 = 25%."
          ),
          checkpoint(
            "Checkpoint: New value after an increase",
            "A ₱250 item increases in price by 12%. What is the new price?",
            ["₱262", "₱280", "₱300", "₱370"],
            "₱280",
            "The increase is 12% of 250 = 0.12 × 250 = ₱30, so the new price is ₱250 + ₱30 = ₱280."
          ),
          summary(
            "Lesson summary",
            "- Percentage increase = (new − original) ÷ original × 100%.\n- New value = original + (percent × original).\n- The percentage is always based on the original value."
          ),
        ],
      },
    ],
  },
  {
    id: "lsn_g7q1_w4_l2",
    termNumber: 1,
    unitTitle: PERCENT,
    sequenceOrder: 2,
    title: "Week 4 · Percentage decrease",
    description: "Solve problems involving percentage decrease.",
    learningObjectives: [
      "Calculate the percentage decrease from an original value and a new value",
      "Find the new value after a given percentage decrease",
    ],
    documents: [LE4],
    videos: [
      video("xxRPQ8cI9FQ", "Grade 7 MATH Term 1 Week 4: Percentage Decrease | MATATAG - First Term/Quarter 1 (Tagalog Tutorial)"),
    ],
    days: [
      {
        focus: "Percentage decrease",
        blocks: [
          text(
            "Measuring a decrease with percentages",
            "A **percentage decrease** compares the amount of decrease to the **original value**.\n\n**Percentage decrease = (original value − new value) ÷ original value × 100%**"
          ),
          example(
            "Worked example: Percentage decrease",
            "The price of a bag falls from ₱500 to ₱400. Find the percentage decrease.",
            [
              "Find the decrease: ₱500 − ₱400 = ₱100.",
              "Divide by the original value: 100 ÷ 500 = 0.20.",
              "Write it as a percent: 0.20 × 100% = 20%.",
            ],
            "The price decreased by 20%."
          ),
          example(
            "Worked example: Finding the new value",
            "A ₱350 item is reduced in price by 20%. What is the new price?",
            ["Find the decrease: 20% of ₱350 = 0.20 × 350 = ₱70.", "Subtract it from the original price: ₱350 − ₱70 = ₱280."],
            "The new price is ₱280. (Shortcut: 350 × 0.80 = 280.)"
          ),
          checkpoint(
            "Checkpoint: Percentage decrease",
            "A jacket's price goes from ₱1,200 to ₱900. What is the percentage decrease?",
            ["20%", "25%", "30%", "33%"],
            "25%",
            "The decrease is 1,200 − 900 = 300. Divide by the original value: 300 ÷ 1,200 = 0.25 = 25%."
          ),
          checkpoint(
            "Checkpoint: Common mistake",
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
          summary(
            "Lesson summary",
            "- Percentage decrease = (original − new) ÷ original × 100%.\n- New value = original − (percent × original).\n- The percentage is based on the original value, which is different each time."
          ),
        ],
      },
    ],
  },
  {
    id: "lsn_g7q1_w4_l3",
    termNumber: 1,
    unitTitle: PERCENT,
    sequenceOrder: 3,
    title: "Week 4 · Money problems: discount and sale price",
    description: "Find the discount and the sale price of an item using percentage.",
    learningObjectives: ["Define discount, sale price and original (selling) price", "Find the discount and the sale price"],
    documents: [LE5],
    videos: [
      video("8q7Iy45ReZ8", "Grade 7 MATH Term 1 Week 4: Discount & Sale Price Solving Money Problems | MATATAG Quarter 1 Tagalog"),
    ],
    days: [
      {
        focus: "Discount and sale price",
        blocks: [
          text(
            "Discount and sale price",
            "- The **original price** (selling price) is the price without a discount.\n- A **discount** is the reduction in the original price.\n- The **sale price** is the final price after the discount.\n\n**Discount = original price × rate of discount**\n\n**Sale price = original price − discount**"
          ),
          example(
            "Worked example: Discount",
            "A shirt costs ₱800 and is on sale at 25% off. Find the discount and the sale price.",
            ["Discount = 25% of ₱800 = 0.25 × 800 = ₱200.", "Sale price = ₱800 − ₱200 = ₱600."],
            "The discount is ₱200 and the sale price is ₱600."
          ),
          example(
            "Worked example: Find the original price",
            "After a 20% discount a pair of shoes costs ₱720. What was the original price?",
            [
              "The sale price is 100% − 20% = 80% of the original price.",
              "So 0.80 × original price = 720.",
              "Original price = 720 ÷ 0.80 = ₱900.",
            ],
            "The original price was ₱900."
          ),
          checkpoint(
            "Checkpoint: Sale price",
            "A pair of shoes costs ₱1,200 and has a 15% discount. What is the sale price?",
            ["₱180", "₱1,020", "₱1,185", "₱1,380"],
            "₱1,020",
            "Discount = 0.15 × 1,200 = ₱180. Sale price = 1,200 − 180 = ₱1,020."
          ),
          checkpoint(
            "Checkpoint: Discount",
            "A bag costs ₱600 and is sold at 30% off. How much is the discount?",
            ["₱30", "₱180", "₱420", "₱570"],
            "₱180",
            "Discount = 0.30 × 600 = ₱180. (The sale price would be ₱420.)"
          ),
          summary(
            "Lesson summary",
            "- Discount = original price × rate of discount.\n- Sale price = original price − discount.\n- If the sale price and rate are known, original price = sale price ÷ (1 − rate)."
          ),
        ],
      },
    ],
  },
  {
    id: "lsn_g7q1_w4_l4",
    termNumber: 1,
    unitTitle: PERCENT,
    sequenceOrder: 4,
    title: "Week 4 · Money problems: commission and sales tax",
    description: "Solve problems on commission and sales tax using percentage.",
    learningObjectives: ["Define commission, commission rate and sales tax (VAT)", "Solve problems on commission and sales tax"],
    documents: [LE5],
    videos: [
      video("SGBIughMGDA", "Grade 7 MATH Term 1 Week 4-5: Commission & Sales Tax Solving Money Problems MATATAG Quarter1 Tagalog"),
    ],
    days: [
      {
        focus: "Commission and sales tax",
        blocks: [
          text(
            "Commission and sales tax",
            "- **Commission** is the money a person earns from selling something.\n- The **commission rate** is the percent of the sales that the seller receives.\n- **Sales tax** is a percentage added to the price when you buy. It is commonly known as Value Added Tax (VAT).\n\n**Commission = commission rate × total sales**\n\n**Sales tax = tax rate × price**, and **total cost = price + sales tax**"
          ),
          example(
            "Worked example: Commission",
            "A sales agent earns 8% commission. She sells ₱45,000 worth of goods. How much is her commission?",
            ["Commission = 8% of ₱45,000 = 0.08 × 45,000."],
            "Her commission is ₱3,600."
          ),
          example(
            "Worked example: Commission rate",
            "An agent received ₱2,400 after selling a gadget for ₱30,000. What is the commission rate?",
            ["Commission rate = commission ÷ sales = 2,400 ÷ 30,000 = 0.08.", "Write it as a percent: 0.08 × 100% = 8%."],
            "The commission rate is 8%."
          ),
          example(
            "Worked example: Sales tax",
            "A laptop is priced at ₱25,000 plus 12% VAT. How much is the tax, and what is the total cost?",
            ["Sales tax = 12% of ₱25,000 = 0.12 × 25,000 = ₱3,000.", "Total cost = ₱25,000 + ₱3,000 = ₱28,000."],
            "The tax is ₱3,000 and the total cost is ₱28,000."
          ),
          checkpoint(
            "Checkpoint: Commission",
            "A seller earns 5% commission on ₱20,000 of sales. How much is the commission?",
            ["₱100", "₱500", "₱1,000", "₱4,000"],
            "₱1,000",
            "Commission = 0.05 × 20,000 = ₱1,000."
          ),
          checkpoint(
            "Checkpoint: Total cost with tax",
            "An item costs ₱500 and a 12% sales tax is added. What is the total cost?",
            ["₱512", "₱560", "₱600", "₱620"],
            "₱560",
            "Sales tax = 0.12 × 500 = ₱60, so the total cost is 500 + 60 = ₱560."
          ),
          summary(
            "Lesson summary",
            "- Commission = commission rate × total sales.\n- Commission rate = commission ÷ sales.\n- Sales tax = tax rate × price; total cost = price + sales tax."
          ),
        ],
      },
    ],
  },
  {
    id: "lsn_g7q1_w4_l5",
    termNumber: 1,
    unitTitle: PERCENT,
    sequenceOrder: 5,
    title: "Week 4 · Money problems: simple interest",
    description: "Solve for simple interest, and for the principal, the rate or the time.",
    learningObjectives: [
      "Define interest, interest rate, principal and time",
      "Solve for simple interest using I = Prt",
      "Solve for the principal, the rate or the time",
    ],
    documents: [LE5],
    videos: [
      video("ryili_70Et0", "Grade 7 MATH Term 1 Week 4-5: Simple Interest Rate Solving Money Problems MATATAG Quarter 1 Tagalog"),
    ],
    days: [
      {
        focus: "Simple interest",
        blocks: [
          text(
            "Simple interest",
            "- **Interest** is the money earned from investing, or paid for borrowing, money.\n- The **principal (P)** is the amount invested or borrowed.\n- The **interest rate (r)** is the percent of interest per year, written as a decimal.\n- The **time (t)** is the number of years.\n\n**I = P × r × t**\n\nRearranging gives **P = I ÷ (r × t)**, **r = I ÷ (P × t)** and **t = I ÷ (P × r)**."
          ),
          example(
            "Worked example: Find the interest",
            "Mia saves ₱5,000 in a bank at 4% simple interest per year. How much interest does she earn in 3 years, and what is her total?",
            [
              "P = ₱5,000, r = 4% = 0.04, t = 3 years.",
              "I = P × r × t = 5,000 × 0.04 × 3 = ₱600.",
              "Total = ₱5,000 + ₱600 = ₱5,600.",
            ],
            "She earns ₱600 interest and has ₱5,600 in total."
          ),
          example(
            "Worked example: Find the principal",
            "How much must be invested at 5% simple interest to earn ₱900 in 3 years?",
            ["P = I ÷ (r × t) = 900 ÷ (0.05 × 3).", "0.05 × 3 = 0.15, so P = 900 ÷ 0.15 = ₱6,000."],
            "₱6,000 must be invested."
          ),
          example(
            "Worked example: Find the rate",
            "₱10,000 earns ₱1,500 simple interest in 3 years. What is the interest rate per year?",
            ["r = I ÷ (P × t) = 1,500 ÷ (10,000 × 3) = 1,500 ÷ 30,000 = 0.05.", "Write it as a percent: 0.05 × 100% = 5%."],
            "The rate is 5% per year."
          ),
          example(
            "Worked example: Find the time",
            "₱12,000 is invested at 4% simple interest and earns ₱1,440. For how many years?",
            ["t = I ÷ (P × r) = 1,440 ÷ (12,000 × 0.04).", "12,000 × 0.04 = 480, so t = 1,440 ÷ 480 = 3."],
            "The money was invested for 3 years."
          ),
          checkpoint(
            "Checkpoint: Simple interest",
            "How much simple interest is earned on ₱2,000 at 5% per year for 2 years?",
            ["₱100", "₱200", "₱2,200", "₱4,000"],
            "₱200",
            "I = P × r × t = 2,000 × 0.05 × 2 = ₱200."
          ),
          checkpoint(
            "Checkpoint: Find the principal",
            "A savings account at 4% simple interest earns ₱480 in 2 years. What is the principal?",
            ["₱3,840", "₱6,000", "₱9,600", "₱12,000"],
            "₱6,000",
            "P = I ÷ (r × t) = 480 ÷ (0.04 × 2) = 480 ÷ 0.08 = ₱6,000."
          ),
          summary(
            "Lesson summary",
            "- Simple interest I = P × r × t, with r as a decimal and t in years.\n- P = I ÷ (r × t), r = I ÷ (P × t), t = I ÷ (P × r)."
          ),
        ],
      },
    ],
  },

  // ================================================================ WEEK 5
  {
    id: "lsn_g7q1_w5_l1",
    termNumber: 1,
    unitTitle: PERCENT,
    sequenceOrder: 6,
    title: "Week 5 · Create a financial plan",
    description: "Create a one-day personal budget and write a formula for a daily personal financial plan.",
    learningObjectives: [
      "Create a one-day financial (budget) plan",
      "Create a formula for a daily personal financial plan",
    ],
    documents: [LE5],
    videos: [
      video("VrX2fWUu_MM", "Grade 7 MATH Term 1 Week 5: Creating Financial Plan - Budget Pie Chart | MATATAG Quarter 1 Tagalog"),
    ],
    days: [
      {
        focus: "Your daily income, expenses and savings",
        blocks: [
          text(
            "Where does your money go?",
            "- **Income** is the money you receive, such as an allowance.\n- **Expenses** are the money you spend.\n- **Savings** are the money you keep.\n\nEven a student can plan how a daily allowance is used. **Savings = income − expenses.**"
          ),
          example(
            "Worked example: Savings from income and expenses",
            "Ana receives a daily allowance of ₱150. She spends ₱75 on food and ₱30 on transportation. How much is left to save?",
            ["Total expenses = ₱75 + ₱30 = ₱105.", "Savings = income − expenses = ₱150 − ₱105 = ₱45."],
            "Ana has ₱45 left to save."
          ),
          checkpoint(
            "Checkpoint: Savings",
            "A student has an income of ₱200 and expenses of ₱140. How much is left for savings?",
            ["₱40", "₱60", "₱340", "₱140"],
            "₱60",
            "Savings = income − expenses = 200 − 140 = ₱60."
          ),
        ],
      },
      {
        focus: "A one-day plan and its formula",
        blocks: [
          text(
            "A plan in percentages",
            "A **financial plan** gives each use of your money a percentage of your income. The percentages must add up to **100%** so that all of the money is planned.\n\n**Formula:** the amount for a use is **A = (p ÷ 100) × I**, where I is your daily income and p is the percent for that use.\n\nTogether with **S = I − E**, this lets you make a plan for any income by changing the value of I."
          ),
          example(
            "Worked example: A one-day plan",
            "Make a plan for a daily allowance of ₱150: food 50%, transportation 20%, savings 20% and other uses 10%.",
            [
              "Check the percentages: 50% + 20% + 20% + 10% = 100%.",
              "Food = 0.50 × 150 = ₱75.",
              "Transportation = 0.20 × 150 = ₱30. Savings = 0.20 × 150 = ₱30.",
              "Other uses = 0.10 × 150 = ₱15. Check: 75 + 30 + 30 + 15 = 150.",
            ],
            "Food ₱75, transportation ₱30, savings ₱30 and other uses ₱15."
          ),
          checkpoint(
            "Checkpoint: Amount from a percent",
            "Your daily allowance is ₱200. You plan 25% for transportation. How much is that?",
            ["₱25", "₱40", "₱50", "₱75"],
            "₱50",
            "Amount = percent × income = 0.25 × 200 = ₱50."
          ),
          checkpoint(
            "Checkpoint: What is left?",
            "Your daily allowance is ₱200. You plan 40% for food, 25% for transportation and 15% for savings. What percent is left for other uses?",
            ["10%", "20%", "25%", "80%"],
            "20%",
            "40% + 25% + 15% = 80%, so 100% − 80% = 20% is left. That is ₱40."
          ),
          text(
            "Try it yourself",
            "Create your own one-day financial plan:\n\n1. Choose a daily amount of money (your real allowance or an amount your teacher gives).\n2. List at least four uses, including savings.\n3. Give each use a percentage so that the total is exactly 100%.\n4. Compute the amount for each use and check that the amounts add up to your income.\n5. Write your formula using I, E and S."
          ),
          summary(
            "Lesson summary",
            "- Savings = income − expenses.\n- A plan gives each use a percentage of the income, and the percentages add up to 100%.\n- Amount for a use = percent × income."
          ),
        ],
      },
    ],
  },

  // ================================================================ WEEK 6
  {
    id: "lsn_g7q1_w6_l1",
    termNumber: 1,
    unitTitle: PERCENT,
    sequenceOrder: 7,
    title: "Week 6 · Identify rates and explain their uses",
    description: "Tell rates from ratios, and explain where rates are used.",
    learningObjectives: ["Define a rate and give examples", "Explain the uses of rates"],
    documents: [LE6],
    videos: [
      video("71ZGRMp6cK4", "Grade 7 MATH Term 1 Week 6: Uses of Rates & Expressing Rates to Unit Rates MATATAG Quarter1 Tagalog"),
    ],
    days: [
      {
        focus: "What a rate is and where it is used",
        blocks: [
          text(
            "Rates and ratios",
            "A **rate** compares two quantities that have **different units**. Examples: ₱45 per kilogram, 60 kilometers per hour, 240 words in 4 minutes.\n\nA **ratio** compares quantities that have the same unit, like 3 boys to 5 girls. A rate has two different units, like pesos and kilograms."
          ),
          text(
            "Uses of rates",
            "Rates are used to describe and compare things in everyday life:\n\n- **Speed**: kilometers per hour.\n- **Price**: pesos per kilogram or per liter.\n- **Pay**: pesos per hour.\n- **Fuel use**: kilometers per liter."
          ),
          checkpoint(
            "Checkpoint: Which is a rate?",
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
            "Checkpoint: A use of rates",
            "Which situation uses a rate?",
            [
              "Counting the students in a room",
              "Saying a tricycle travels 30 kilometers per hour",
              "Naming a polygon",
              "Measuring one angle",
            ],
            "Saying a tricycle travels 30 kilometers per hour",
            "Kilometers per hour compares distance with time, which are different units, so it is a rate (a speed)."
          ),
          summary(
            "Lesson summary",
            "- A rate compares two quantities with different units.\n- A ratio compares quantities with the same unit.\n- Rates are used for speed, price, pay and fuel use."
          ),
        ],
      },
    ],
  },
  {
    id: "lsn_g7q1_w6_l2",
    termNumber: 1,
    unitTitle: PERCENT,
    sequenceOrder: 8,
    title: "Week 6 · Express a rate as a unit rate",
    description: "Write a rate as a unit rate and use it to compare.",
    learningObjectives: ["Express a rate as a unit rate", "Compare two rates using unit rates"],
    documents: [LE6],
    videos: [
      video("71ZGRMp6cK4", "Grade 7 MATH Term 1 Week 6: Uses of Rates & Expressing Rates to Unit Rates MATATAG Quarter1 Tagalog"),
    ],
    days: [
      {
        focus: "Unit rates",
        blocks: [
          text(
            "Unit rate",
            "A **unit rate** is a rate whose second quantity is 1, such as ₱40 per 1 kilogram. To find a unit rate, divide the first quantity by the second.\n\nUnit rates make it easy to compare."
          ),
          example(
            "Worked example: Unit rate",
            "A 3 kg bag of rice costs ₱120. What is the price per kilogram?",
            ["Divide the cost by the number of kilograms: 120 ÷ 3 = 40."],
            "₱40 per kilogram."
          ),
          example(
            "Worked example: The better buy",
            "A 500 g pack of noodles costs ₱45 and a 750 g pack costs ₱63. Which is the better buy?",
            [
              "Find the price per gram of the 500 g pack: 45 ÷ 500 = ₱0.09 per gram.",
              "Find the price per gram of the 750 g pack: 63 ÷ 750 = ₱0.084 per gram.",
              "The smaller unit price is the better buy.",
            ],
            "The 750 g pack is the better buy (₱0.084 per gram compared with ₱0.09 per gram)."
          ),
          checkpoint(
            "Checkpoint: Unit rate",
            "A typist types 240 words in 4 minutes. What is the unit rate?",
            ["16 words per minute", "40 words per minute", "60 words per minute", "244 words per minute"],
            "60 words per minute",
            "Divide the words by the minutes: 240 ÷ 4 = 60 words per minute."
          ),
          checkpoint(
            "Checkpoint: Better buy",
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
          summary(
            "Lesson summary",
            "- A unit rate is a rate per 1 unit: divide the first quantity by the second.\n- Compare prices by finding unit rates; the smaller unit price is the better buy."
          ),
        ],
      },
    ],
  },
  {
    id: "lsn_g7q1_w6_l3",
    termNumber: 1,
    unitTitle: PERCENT,
    sequenceOrder: 9,
    title: "Week 6 · Solve problems involving rates",
    description: "Solve rate problems, such as speed, distance and time, pay and fuel use.",
    learningObjectives: ["Solve problems involving rates, such as speed"],
    documents: [LE6],
    videos: [
      video("_Q7LzlTr3SM", "Grade 7 MATH Term 1 Week 6: Solving Problems Involving Rates & Unit Rates MATATAG Quarter1 Tagalog"),
    ],
    days: [
      {
        focus: "Speed, distance and time",
        blocks: [
          text(
            "Speed is a rate",
            "**Speed** is the distance traveled in one unit of time.\n\n- speed = distance ÷ time\n- distance = speed × time\n- time = distance ÷ speed"
          ),
          example(
            "Worked example: Speed",
            "A bus travels 150 kilometers in 2.5 hours. What is its speed?",
            ["Speed = distance ÷ time = 150 ÷ 2.5 = 60."],
            "60 kilometers per hour."
          ),
          example(
            "Worked example: Distance and time",
            "A jeepney travels at 40 km/h. How far does it go in 3 hours? How long does it take to go 100 km?",
            ["Distance = speed × time = 40 × 3 = 120 km.", "Time = distance ÷ speed = 100 ÷ 40 = 2.5 hours."],
            "It goes 120 km in 3 hours and needs 2.5 hours to travel 100 km."
          ),
          checkpoint(
            "Checkpoint: Distance",
            "A car travels at 45 km/h for 2 hours. How far does it travel?",
            ["22.5 km", "47 km", "90 km", "180 km"],
            "90 km",
            "Distance = speed × time = 45 × 2 = 90 km."
          ),
          checkpoint(
            "Checkpoint: Time",
            "How long does it take to travel 120 km at 60 km/h?",
            ["0.5 hour", "2 hours", "60 hours", "7,200 hours"],
            "2 hours",
            "Time = distance ÷ speed = 120 ÷ 60 = 2 hours."
          ),
        ],
      },
      {
        focus: "Other rate problems",
        blocks: [
          text(
            "Find the unit rate first",
            "To solve a rate problem, find the unit rate, then multiply it by the amount you need."
          ),
          example(
            "Worked example: Pay rate",
            "A tutor earns ₱350 for 2 hours of tutoring. At the same rate, how much will the tutor earn in 5 hours?",
            ["Find the unit rate: 350 ÷ 2 = ₱175 per hour.", "Multiply by the hours: 175 × 5 = ₱875."],
            "₱875."
          ),
          example(
            "Worked example: Fuel use",
            "A motorcycle travels 180 km using 4 liters of gasoline. How far can it travel on 1 liter, and on 7 liters?",
            ["Unit rate: 180 ÷ 4 = 45 km per liter.", "On 7 liters: 45 × 7 = 315 km."],
            "45 km per liter, so 315 km on 7 liters."
          ),
          checkpoint(
            "Checkpoint: Fuel use",
            "A car travels 240 km on 20 liters of gasoline. How many kilometers per liter is that?",
            ["8 km per liter", "12 km per liter", "20 km per liter", "260 km per liter"],
            "12 km per liter",
            "Unit rate = 240 ÷ 20 = 12 kilometers per liter."
          ),
          checkpoint(
            "Checkpoint: Pay rate",
            "A worker earns ₱640 for 8 hours of work. At the same rate, how much is earned in 5 hours?",
            ["₱320", "₱400", "₱480", "₱512"],
            "₱400",
            "Unit rate = 640 ÷ 8 = ₱80 per hour, so 5 hours earns 80 × 5 = ₱400."
          ),
          summary(
            "Lesson summary",
            "- Speed = distance ÷ time, so distance = speed × time and time = distance ÷ speed.\n- To solve a rate problem, find the unit rate first, then multiply."
          ),
        ],
      },
    ],
  },

  // ================================================================ WEEK 7
  // Written from the Budget of Work competencies for Week 7 only: no Lesson Exemplar was provided.
  // Negative numbers and integers are not used here: the Budget of Work introduces them in Term 2 (Weeks 9-10).
  {
    id: "lsn_g7q1_w7_l1",
    termNumber: 1,
    unitTitle: RATIONAL,
    sequenceOrder: 1,
    title: "Week 7 · Rational numbers as fractions, decimals and percentages",
    description: "Describe a rational number as a fraction, a decimal or a percentage, and change from one form to another.",
    learningObjectives: [
      "Describe a given rational number as a fraction, a decimal or a percentage",
      "Change a rational number from one form to another",
    ],
    documents: [BOW_DOC],
    videos: [
      video("-8PmHV9nWsE", "Grade 7 MATH Term 1 Week 7: Rational Numbers | MATATAG - First Term/Quarter 1 (Tagalog Tutorial)"),
    ],
    days: [
      {
        focus: "Fractions, decimals and percentages",
        blocks: [
          text(
            "Rational numbers",
            "A **rational number** is a number that can be written as a fraction, such as ³⁄₄ or ⁷⁄₂₀. Whole numbers, fractions and decimals that end (like 0.75) or repeat (like 0.333...) are rational numbers.\n\nThe same rational number can be written as a **fraction**, a **decimal** or a **percentage**. For example, ³⁄₄ = 0.75 = 75%."
          ),
          text(
            "Changing forms",
            "- **Fraction to decimal:** divide the numerator by the denominator. ³⁄₅ = 3 ÷ 5 = 0.6.\n- **Decimal to percentage:** multiply by 100%. 0.6 × 100% = 60%.\n- **Percentage to decimal:** divide by 100. 60% = 0.60.\n- **Percentage to fraction:** write it over 100 and simplify. 60% = ⁶⁰⁄₁₀₀ = ³⁄₅."
          ),
          example(
            "Worked example: One number, three forms",
            "Write ²⁄₅ as a decimal and as a percentage.",
            ["Divide the numerator by the denominator: 2 ÷ 5 = 0.4.", "Multiply by 100%: 0.4 × 100% = 40%."],
            "²⁄₅ = 0.4 = 40%."
          ),
          example(
            "Worked example: From a percentage to a fraction",
            "Write 35% as a fraction in simplest form and as a decimal.",
            ["35% = ³⁵⁄₁₀₀. Divide the numerator and denominator by 5 to get ⁷⁄₂₀.", "As a decimal, 35 ÷ 100 = 0.35."],
            "35% = ⁷⁄₂₀ = 0.35."
          ),
          checkpoint(
            "Checkpoint: Fraction to decimal",
            "What is ³⁄₅ as a decimal?",
            ["0.35", "0.5", "0.6", "1.6"],
            "0.6",
            "Divide the numerator by the denominator: 3 ÷ 5 = 0.6."
          ),
          checkpoint(
            "Checkpoint: Decimal to percentage",
            "What is 0.45 as a percentage?",
            ["0.45%", "4.5%", "45%", "450%"],
            "45%",
            "Multiply by 100%: 0.45 × 100% = 45%."
          ),
          checkpoint(
            "Checkpoint: Percentage to fraction",
            "What is 60% as a fraction in simplest form?",
            ["⁶⁄₁₀", "³⁄₅", "⁶⁄₅", "¹⁄₆"],
            "³⁄₅",
            "60% = ⁶⁰⁄₁₀₀. Dividing the numerator and denominator by 20 gives ³⁄₅."
          ),
          summary(
            "Lesson summary",
            "- A rational number can be written as a fraction. It can also be written as a decimal or a percentage.\n- Fraction to decimal: divide. Decimal to percentage: multiply by 100%. Percentage to decimal: divide by 100.\n- ³⁄₄ = 0.75 = 75% are three forms of one number."
          ),
        ],
      },
    ],
  },
  {
    id: "lsn_g7q1_w7_l2",
    termNumber: 1,
    unitTitle: RATIONAL,
    sequenceOrder: 2,
    title: "Week 7 · Order rational numbers on a number line",
    description: "Place rational numbers on a number line and put them in order.",
    learningObjectives: ["Place rational numbers on a number line", "Order rational numbers"],
    documents: [],
    videos: [
      video("lz4d_qN4F4E", "Grade 7 MATH Term 1 Week 7: Arranging Rational Numbers on Number Line | MATATAG Quarter 1 (Tagalog)"),
    ],
    days: [
      {
        focus: "Placing and ordering rational numbers",
        blocks: [
          text(
            "The number line",
            "On a number line, numbers to the right are greater and numbers to the left are less.\n\nTo place or compare rational numbers, write them all in the **same form**, usually decimals, then compare. Between 0 and 1, the number line can be split into equal parts: halves at 0.5, quarters at 0.25, 0.5 and 0.75."
          ),
          example(
            "Worked example: Place on a number line",
            "Place ¼, 0.5 and ¾ on a number line from 0 to 1.",
            [
              "Write each as a decimal: ¼ = 0.25, 0.5 and ¾ = 0.75.",
              "Split the line from 0 to 1 into four equal parts. The marks are at 0.25, 0.5 and 0.75.",
              "Put ¼ on the first mark, 0.5 on the second and ¾ on the third.",
            ],
            "¼ is at 0.25, 0.5 is at the middle, and ¾ is at 0.75."
          ),
          example(
            "Worked example: Order from least to greatest",
            "Order ½, 0.3, ²⁄₅ and 0.75 from least to greatest.",
            [
              "Write each as a decimal: ½ = 0.5, 0.3, ²⁄₅ = 0.4 and 0.75.",
              "Compare the decimals: 0.3 < 0.4 < 0.5 < 0.75.",
              "Write the numbers in their original forms in that order.",
            ],
            "0.3, ²⁄₅, ½, 0.75."
          ),
          example(
            "Worked example: Compare two numbers",
            "Which is greater, ³⁄₄ or 0.7?",
            ["Write ³⁄₄ as a decimal: 3 ÷ 4 = 0.75.", "Compare 0.75 and 0.70. 0.75 is greater."],
            "³⁄₄ is greater than 0.7."
          ),
          checkpoint(
            "Checkpoint: Greatest",
            "Which is the greatest: 0.6, ⁵⁄₈ or 60.5%?",
            ["0.6", "⁵⁄₈", "60.5%", "They are equal"],
            "⁵⁄₈",
            "Write each as a decimal: 0.6, 0.625 and 0.605. The greatest is 0.625, which is ⁵⁄₈."
          ),
          checkpoint(
            "Checkpoint: Least",
            "Which is the least: ³⁄₈, 0.35 or 36%?",
            ["³⁄₈", "0.35", "36%", "They are equal"],
            "0.35",
            "Write each as a decimal: 0.375, 0.35 and 0.36. The least is 0.35."
          ),
          summary(
            "Lesson summary",
            "- Write rational numbers in the same form, usually decimals, to compare and order them.\n- On a number line, the number on the right is greater.\n- Split the space between 0 and 1 into equal parts to place fractions and decimals."
          ),
        ],
      },
    ],
  },
];

export const Q1_DRAFT_LESSONS: DraftLesson[] = SPECS.map(buildLesson);
