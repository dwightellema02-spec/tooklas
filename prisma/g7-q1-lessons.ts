/**
 * Grade 7 Mathematics, Term 1, Weeks 1-6: original draft lessons written from the learning
 * competencies of the DepEd MATATAG Three-Term Budget of Work (April 2026).
 *
 * These are NOT copies of the DepEd Lesson Exemplars, which are restricted to teacher use.
 * Each weekly lesson is organised in "Day" sections that follow the number of class days the
 * exemplars plan for the week. A student can stop at the end of a day and continue later; the
 * lesson viewer saves progress. All lessons are seeded as DRAFT for teacher review.
 */

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

/** Flattens the days into numbered blocks, with a start-of-day block and an end-of-day break. */
function buildLesson(spec: LessonSpec): DraftLesson {
  const { days, ...rest } = spec;
  const blocks: DraftBlock[] = [];
  days.forEach((day, d) => {
    blocks.push(
      text(
        `Day ${d + 1}: ${day.focus}`,
        `**Day ${d + 1} of ${days.length}.** Today: ${day.focus.toLowerCase()}.\n\nPlan about ${MINUTES_PER_DAY} minutes. When you finish the checkpoints you can stop for today. Your progress is saved, so you can continue tomorrow.`
      )
    );
    blocks.push(...day.blocks);
    if (d < days.length - 1) {
      blocks.push(
        text(
          `End of Day ${d + 1}`,
          `You finished Day ${d + 1}. Rest, and review your notes before tomorrow.\n\n**Next: Day ${d + 2}, ${days[d + 1].focus.toLowerCase()}.**`
        )
      );
    }
  });
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

const SPECS: LessonSpec[] = [
  // ================================================================ Week 1
  {
    id: "lsn_g7q1_w1",
    termNumber: 1,
    unitTitle: "Polygons and Angle Relationships",
    sequenceOrder: 1,
    title: "Polygons: Naming, Classifying, and Drawing",
    description:
      "Define polygons, tell regular from irregular polygons, and draw triangles, quadrilaterals and regular polygons with a ruler, protractor and compass.",
    learningObjectives: [
      "Define a polygon and name polygons with 3 to 10 sides",
      "Describe regular and irregular polygons using the measures of their sides and angles",
      "Draw regular polygons with 5, 6, 8 or 10 sides",
      "Draw triangles and quadrilaterals with given angle measures",
    ],
    documents: [BOW_DOC, { fileName: "Q1_LE_Mathematics-7_Lesson-1_Week-1.pdf", title: "Lesson Exemplar Q1 Lesson 1 (Teacher Reference)" }],
    days: [
      {
        focus: "What a polygon is, and naming polygons",
        blocks: [
          text(
            "What is a polygon?",
            "A **polygon** is a closed flat figure made only of straight line segments. The segments meet only at their endpoints, which are called **vertices**.\n\nA figure is **not** a polygon if it is open, has a curved side, or if its sides cross each other in the middle.\n\nExamples of polygons: a triangle, a stop sign, a kite. Not polygons: a circle (curved), a letter V (open)."
          ),
          text(
            "Naming polygons",
            "A polygon is named by its number of sides. A polygon always has the same number of sides, vertices and interior angles.\n\n| Sides | Name |\n|---|---|\n| 3 | Triangle |\n| 4 | Quadrilateral |\n| 5 | Pentagon |\n| 6 | Hexagon |\n| 7 | Heptagon |\n| 8 | Octagon |\n| 9 | Nonagon |\n| 10 | Decagon |\n\nWe also name a polygon using its vertices in order. A triangle with vertices A, B and C is triangle ABC. Its sides are AB, BC and AC."
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
          checkpoint(
            "Checkpoint: Naming by sides",
            "A polygon has 8 sides. What is it called?",
            ["Hexagon", "Heptagon", "Octagon", "Nonagon"],
            "Octagon",
            "Octa- means eight. A hexagon has 6 sides, a heptagon 7 and a nonagon 9."
          ),
        ],
      },
      {
        focus: "Regular and irregular polygons",
        blocks: [
          text(
            "Regular and irregular polygons",
            "- A polygon is **equilateral** if all its sides are equal.\n- A polygon is **equiangular** if all its angles are equal.\n- A **regular polygon** is both equilateral and equiangular.\n- An **irregular polygon** is not regular: its sides or its angles are not all equal.\n\nA regular triangle is called an **equilateral triangle**, and a regular quadrilateral is a **square**. For other regular polygons we add the word regular: regular pentagon, regular hexagon, and so on.\n\nEach interior angle of a regular pentagon is 108°, of a regular hexagon 120°, of a regular octagon 135° and of a regular decagon 144°."
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
            "From the list of angles: pentagon 108°, hexagon 120°, octagon 135°, decagon 144°. So 135° is a regular octagon."
          ),
        ],
      },
      {
        focus: "Drawing regular polygons",
        blocks: [
          text(
            "What you need",
            "For drawing you need a sharp pencil, a ruler, a protractor and a compass. Measure and draw carefully, because small errors add up."
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
        focus: "Drawing triangles and quadrilaterals with given angles",
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
            "- A polygon is a closed figure made of straight sides that meet only at endpoints.\n- Polygons are named by their number of sides (triangle, quadrilateral, pentagon, hexagon, heptagon, octagon, nonagon, decagon).\n- A regular polygon has all sides equal and all angles equal. Otherwise it is irregular.\n- To draw a regular polygon with n sides, mark points every 360° ÷ n around a circle and join them in order.\n- The angles of a triangle add to 180° and the angles of a quadrilateral add to 360°, which lets you check a drawing."
          ),
        ],
      },
    ],
  },

  // ================================================================ Week 2
  {
    id: "lsn_g7q1_w2",
    termNumber: 1,
    unitTitle: "Polygons and Angle Relationships",
    sequenceOrder: 2,
    title: "Classifying Polygons, and Angle Pairs",
    description:
      "Classify polygons by sides, regularity and convexity, and describe complementary, supplementary, adjacent and vertical angles and linear pairs.",
    learningObjectives: [
      "Classify polygons by number of sides, as regular or irregular, and as convex or non-convex",
      "Define complementary, supplementary and adjacent angles, linear pairs and vertical angles",
      "Find the measure of an unknown angle using the relationships between angle pairs",
    ],
    documents: [{ fileName: "LE_MATH-7-Q1_W2.pdf", title: "Lesson Exemplar Q1 Lesson 2 (Teacher Reference)" }],
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
        ],
      },
      {
        focus: "Classifying polygons in three ways",
        blocks: [
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
            "A polygon has 5 equal sides, 5 equal angles of 108°. How is it classified?",
            [
              "Regular, convex pentagon",
              "Irregular, convex pentagon",
              "Regular, non-convex pentagon",
              "Irregular, non-convex hexagon",
            ],
            "Regular, convex pentagon",
            "It has 5 sides, so it is a pentagon. Its sides and angles are all equal, so it is regular. All angles are less than 180°, so it is convex."
          ),
          checkpoint(
            "Checkpoint: Can an irregular polygon be convex?",
            "Which statement is true?",
            [
              "Every irregular polygon is non-convex",
              "An irregular polygon can be convex if all its angles are less than 180°",
              "Every convex polygon is regular",
              "Convex polygons must have 4 sides",
            ],
            "An irregular polygon can be convex if all its angles are less than 180°",
            "Convex only depends on the angles being less than 180°. A scalene triangle is irregular and convex."
          ),
        ],
      },
      {
        focus: "Complementary and supplementary angles",
        blocks: [
          text(
            "Angle pairs: complementary and supplementary",
            "- **Complementary angles** are two angles whose measures add up to **90°**.\n- **Supplementary angles** are two angles whose measures add up to **180°**.\n\nThe two angles do not have to be next to each other."
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
        focus: "Adjacent angles, linear pairs and vertical angles",
        blocks: [
          text(
            "Adjacent angles, linear pairs, vertical angles",
            "- **Adjacent angles** share a vertex and a side, and do not overlap.\n- A **linear pair** is two adjacent angles whose non-shared sides form a straight line. A linear pair is always supplementary (180°).\n- **Vertical angles** are the opposite angles formed when two lines intersect. Vertical angles are always equal."
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
            "- Classify polygons by sides, as regular or irregular, and as convex (all angles less than 180°) or non-convex (an angle greater than 180°).\n- Complementary angles add to 90°. Supplementary angles add to 180°.\n- A linear pair is two adjacent angles that form a straight line, so they add to 180°.\n- Vertical angles are opposite each other when two lines intersect, and they are equal."
          ),
        ],
      },
    ],
  },

  // ================================================================ Week 3
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
    documents: [{ fileName: "LE_MATH-7-Q1_W3.pdf", title: "Lesson Exemplar Q1 Lesson 3 (Teacher Reference)" }],
    days: [
      {
        focus: "Interior and exterior angles",
        blocks: [
          text(
            "Interior and exterior angles",
            "An **interior angle** of a polygon is formed inside the polygon by two sides that meet at a vertex.\n\nAn **exterior angle** is formed outside the polygon when one side is extended past a vertex. It is the angle between that extension and the next side.\n\nAt each vertex there is one interior angle and, next to it, an exterior angle."
          ),
          checkpoint(
            "Checkpoint: Interior or exterior?",
            "A side of a polygon is extended past a vertex. The angle between the extension and the next side is called a(n):",
            ["Interior angle", "Exterior angle", "Vertical angle", "Complementary angle"],
            "Exterior angle",
            "An angle formed outside the polygon by extending a side is an exterior angle."
          ),
        ],
      },
      {
        focus: "Exterior angle and adjacent interior angle",
        blocks: [
          text(
            "The relationship",
            "At each vertex, the exterior angle and the interior angle next to it form a **linear pair**, so\n\n**exterior angle + adjacent interior angle = 180°**."
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
          checkpoint(
            "Checkpoint: Adjacent interior angle",
            "An exterior angle of a polygon measures 55°. What is the adjacent interior angle?",
            ["35°", "125°", "135°", "305°"],
            "125°",
            "The exterior angle and its adjacent interior angle add up to 180°, so the interior angle is 180° − 55° = 125°."
          ),
        ],
      },
      {
        focus: "Sum of the interior angles",
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
          checkpoint(
            "Checkpoint: Sum of interior angles",
            "What is the sum of the interior angles of a hexagon?",
            ["540°", "720°", "900°", "1,080°"],
            "720°",
            "A hexagon has n = 6 sides, so the sum is (6 − 2) × 180° = 4 × 180° = 720°."
          ),
        ],
      },
      {
        focus: "Regular polygons: each angle and the number of sides",
        blocks: [
          text(
            "Regular polygons",
            "For a **regular** polygon with n sides:\n\n- Each exterior angle = 360° ÷ n\n- Each interior angle = 180° − (each exterior angle), or (n − 2) × 180° ÷ n\n\nThe number of sides is n = 360° ÷ (each exterior angle)."
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
          example(
            "Worked example: How many sides?",
            "Each exterior angle of a regular polygon is 40°. How many sides does it have?",
            ["Use n = 360° ÷ (each exterior angle).", "n = 360° ÷ 40° = 9."],
            "The polygon has 9 sides (a regular nonagon)."
          ),
          checkpoint(
            "Checkpoint: Exterior angle of a regular octagon",
            "What is each exterior angle of a regular octagon?",
            ["36°", "40°", "45°", "135°"],
            "45°",
            "Each exterior angle of a regular polygon is 360° ÷ n = 360° ÷ 8 = 45°. (135° is each interior angle.)"
          ),
          checkpoint(
            "Checkpoint: Number of sides",
            "Each exterior angle of a regular polygon is 20°. How many sides does the polygon have?",
            ["9", "12", "18", "20"],
            "18",
            "n = 360° ÷ 20° = 18."
          ),
          summary(
            "Lesson summary",
            "- Exterior angle + adjacent interior angle = 180°.\n- The interior angles of an n-sided polygon add up to (n − 2) × 180°.\n- The exterior angles of any polygon add up to 360°.\n- In a regular polygon, each exterior angle is 360° ÷ n, and each interior angle is 180° minus that."
          ),
        ],
      },
    ],
  },

  // ================================================================ Week 4
  {
    id: "lsn_g7q1_w4",
    termNumber: 1,
    unitTitle: "Percentages and Rates",
    sequenceOrder: 1,
    title: "Percentage Change and Money Problems",
    description:
      "Solve problems on percentage increase and decrease, and money problems on discount, sale price, sales tax, commission and simple interest.",
    learningObjectives: [
      "Solve problems involving percentage increase",
      "Solve problems involving percentage decrease",
      "Solve money problems involving discount, sale price and sales tax",
      "Solve money problems involving commission and simple interest",
    ],
    documents: [{ fileName: "LE_MATH-7-Q1_W4.pdf", title: "Lesson Exemplar Q1 Lesson 4 (Teacher Reference)" }],
    days: [
      {
        focus: "Percentage increase",
        blocks: [
          text(
            "Measuring change with percentages",
            "A **percentage change** compares the amount of change to the **original value**.\n\n- **Percentage increase** = (new value − original value) ÷ original value × 100%\n- **Percentage decrease** = (original value − new value) ÷ original value × 100%\n\nAlways divide by the **original** value, not the new one."
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
        ],
      },
      {
        focus: "Percentage decrease",
        blocks: [
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
            [
              "Find the decrease: 20% of ₱350 = 0.20 × 350 = ₱70.",
              "Subtract it from the original price: ₱350 − ₱70 = ₱280.",
            ],
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
        ],
      },
      {
        focus: "Money problems: discount, sale price and sales tax",
        blocks: [
          text(
            "Discount, sale price and sales tax",
            "- **Discount** is the amount taken off the original price. Discount = discount rate × original price.\n- **Sale price** = original price − discount.\n- **Sales tax** is a percentage of the price that is added when you buy. Sales tax = tax rate × price, and total cost = price + sales tax."
          ),
          example(
            "Worked example: Discount",
            "A shirt costs ₱800 and is on sale at 25% off. Find the discount and the sale price.",
            ["Discount = 25% of ₱800 = 0.25 × 800 = ₱200.", "Sale price = ₱800 − ₱200 = ₱600."],
            "The discount is ₱200 and the sale price is ₱600."
          ),
          example(
            "Worked example: Sales tax",
            "A bag costs ₱1,500. A 12% sales tax is added. What is the total cost?",
            ["Sales tax = 12% of ₱1,500 = 0.12 × 1,500 = ₱180.", "Total cost = ₱1,500 + ₱180 = ₱1,680."],
            "The total cost is ₱1,680."
          ),
          checkpoint(
            "Checkpoint: Sale price",
            "A pair of shoes costs ₱1,200 and has a 15% discount. What is the sale price?",
            ["₱180", "₱1,020", "₱1,185", "₱1,380"],
            "₱1,020",
            "Discount = 0.15 × 1,200 = ₱180. Sale price = 1,200 − 180 = ₱1,020."
          ),
          checkpoint(
            "Checkpoint: Total cost with tax",
            "An item costs ₱500 and a 12% sales tax is added. What is the total cost?",
            ["₱512", "₱560", "₱600", "₱620"],
            "₱560",
            "Sales tax = 0.12 × 500 = ₱60, so the total cost is 500 + 60 = ₱560."
          ),
        ],
      },
      {
        focus: "Money problems: commission and simple interest",
        blocks: [
          text(
            "Commission and simple interest",
            "- **Commission** is a payment, usually a percentage of sales, that a seller earns. Commission = commission rate × total sales.\n- **Simple interest** is the money earned (or paid) on an amount over time: **I = P × r × t**, where P is the principal (the starting amount), r is the yearly rate written as a decimal, and t is the time in years."
          ),
          example(
            "Worked example: Commission",
            "A sales agent earns 8% commission. She sells ₱45,000 worth of goods. How much is her commission?",
            ["Commission = 8% of ₱45,000 = 0.08 × 45,000."],
            "Her commission is ₱3,600."
          ),
          example(
            "Worked example: Simple interest",
            "Mia saves ₱5,000 in a bank at 4% simple interest per year. How much interest does she earn in 3 years, and what is her total?",
            [
              "P = ₱5,000, r = 4% = 0.04, t = 3 years.",
              "I = P × r × t = 5,000 × 0.04 × 3 = ₱600.",
              "Total = ₱5,000 + ₱600 = ₱5,600.",
            ],
            "She earns ₱600 interest and has ₱5,600 in total."
          ),
          checkpoint(
            "Checkpoint: Commission",
            "A seller earns 5% commission on ₱20,000 of sales. How much is the commission?",
            ["₱100", "₱500", "₱1,000", "₱4,000"],
            "₱1,000",
            "Commission = 0.05 × 20,000 = ₱1,000."
          ),
          checkpoint(
            "Checkpoint: Simple interest",
            "How much simple interest is earned on ₱2,000 at 5% per year for 2 years?",
            ["₱100", "₱200", "₱2,200", "₱4,000"],
            "₱200",
            "I = P × r × t = 2,000 × 0.05 × 2 = ₱200."
          ),
          summary(
            "Lesson summary",
            "- Percentage increase = (new − original) ÷ original × 100%. Percentage decrease = (original − new) ÷ original × 100%. The percentage is always based on the original value.\n- Discount = rate × original price; sale price = original price − discount.\n- Sales tax = rate × price; total cost = price + tax.\n- Commission = rate × sales.\n- Simple interest I = P × r × t."
          ),
        ],
      },
    ],
  },

  // ================================================================ Week 5
  {
    id: "lsn_g7q1_w5",
    termNumber: 1,
    unitTitle: "Percentages and Rates",
    sequenceOrder: 2,
    title: "Creating a Financial Plan",
    description: "Use percentages to plan how to use money, and write a formula for a daily personal financial plan.",
    learningObjectives: [
      "Describe income, expenses and savings, and needs and wants",
      "Create a one-day budget plan using percentages of an income",
      "Write and use a formula for a daily personal financial plan",
      "Check whether a plan is balanced",
    ],
    documents: [{ fileName: "LE_MATH-7-Q1_W5.pdf", title: "Lesson Exemplar Q1 Lesson 5 (Teacher Reference)" }],
    days: [
      {
        focus: "Income, expenses and savings",
        blocks: [
          text(
            "Where does money go?",
            "- **Income** is the money you receive, such as an allowance.\n- **Expenses** are the money you spend.\n- **Savings** are the money you keep for later.\n\nExpenses can be **needs** (things you must have, such as food and transportation to school) or **wants** (things that are nice to have). A good plan pays for needs first and sets aside savings."
          ),
          example(
            "Worked example: Savings from income and expenses",
            "Ana receives a daily allowance of ₱150. She spends ₱75 on food and ₱30 on transportation. How much is left for savings?",
            ["Total expenses = ₱75 + ₱30 = ₱105.", "Savings = income − expenses = ₱150 − ₱105 = ₱45."],
            "Ana has ₱45 left for savings and other uses."
          ),
          checkpoint(
            "Checkpoint: Need or want?",
            "Which of these is a need?",
            ["A new video game", "Food for lunch", "A toy", "Concert tickets"],
            "Food for lunch",
            "Food is something you must have every day, so it is a need. The others are wants."
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
        focus: "Planning with percentages",
        blocks: [
          text(
            "A plan in percentages",
            "A **financial plan** gives each use of your money a percentage of your income. The percentages must add up to **100%** so that all of the money is planned.\n\nAmount for a use = percent × income."
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
        ],
      },
      {
        focus: "A formula for a daily plan",
        blocks: [
          text(
            "Writing a formula",
            "Let **I** be your daily income, **E** your total expenses and **S** your savings.\n\n- **S = I − E**\n- If a use gets p% of the income, its amount is **A = (p ÷ 100) × I**.\n- If you want to save s% of your income, then your spending limit is **E = (100 − s)% of I**.\n\nA formula lets you make a plan for any income by changing the value of I."
          ),
          example(
            "Worked example: Use the formula",
            "Ben receives ₱120 a day and wants to save 25%. How much can he spend, and how much will he save?",
            [
              "Savings = 25% of 120 = 0.25 × 120 = ₱30.",
              "Spending limit E = 120 − 30 = ₱90 (this is 75% of 120).",
              "Check with the formula S = I − E: 120 − 90 = ₱30.",
            ],
            "Ben can spend ₱90 and will save ₱30 each day."
          ),
          example(
            "Worked example: Savings that grow",
            "Ben puts his ₱30 daily savings in a jar for 20 school days. How much does he save, and how much will he have if he keeps saving the same amount for 3 months of 20 school days?",
            [
              "Savings in 20 days = 30 × 20 = ₱600.",
              "In 3 months of 20 school days each: 30 × 60 = ₱1,800.",
            ],
            "₱600 in one month and ₱1,800 in three months."
          ),
          checkpoint(
            "Checkpoint: Spending limit",
            "Your income is ₱160 a day and you want to save 25%. What is the most you can spend?",
            ["₱40", "₱120", "₱135", "₱160"],
            "₱120",
            "Savings = 0.25 × 160 = ₱40, so the spending limit is 160 − 40 = ₱120."
          ),
        ],
      },
      {
        focus: "Check and create your own plan",
        blocks: [
          example(
            "Worked example: Fix an unbalanced plan",
            "A plan for ₱100 gives food 45%, transportation 30% and savings 30%. What is wrong, and how can it be fixed?",
            [
              "Add the percentages: 45% + 30% + 30% = 105%.",
              "The plan is 5% over budget, which means it spends ₱5 more than the income.",
              "Reduce one use by 5%. For example, make savings 25%: now 45% + 30% + 25% = 100%.",
            ],
            "The plan was 105% of the income. Changing savings to 25% makes it 100%."
          ),
          checkpoint(
            "Checkpoint: Is the plan balanced?",
            "A plan uses 50% for food, 30% for transportation and 15% for savings. Which statement is true?",
            [
              "The plan is balanced because the percentages add up to 100%",
              "The plan leaves 5% of the income unplanned",
              "The plan is 5% over budget",
              "The plan saves half of the income",
            ],
            "The plan leaves 5% of the income unplanned",
            "50% + 30% + 15% = 95%, so 5% of the income has not been given a use yet."
          ),
          text(
            "Try it yourself",
            "Create your own one-day financial plan:\n\n1. Choose a daily amount of money (your real allowance or an amount your teacher gives).\n2. List at least four uses, including savings.\n3. Give each use a percentage so that the total is exactly 100%.\n4. Compute the amount for each use and check that the amounts add up to your income.\n5. Write your formula using I, E and S."
          ),
          summary(
            "Lesson summary",
            "- Income, expenses and savings: savings = income − expenses.\n- A plan gives each use a percentage of the income, and the percentages add up to 100%.\n- Amount for a use = percent × income.\n- A formula such as S = I − E lets you make a plan for any income.\n- Always check the total: more than 100% is over budget, and less than 100% leaves money unplanned."
          ),
        ],
      },
    ],
  },

  // ================================================================ Week 6
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
    documents: [{ fileName: "LE_MATH-7-Q1_W6.pdf", title: "Lesson Exemplar Q1 Lesson 6 (Teacher Reference)" }],
    days: [
      {
        focus: "What a rate is",
        blocks: [
          text(
            "Rates and ratios",
            "A **rate** compares two quantities that have **different units**. Examples: ₱45 per kilogram, 60 kilometers per hour, 240 words in 4 minutes.\n\nA **ratio** compares quantities that have the same unit, like 3 boys to 5 girls. A rate has two different units, like pesos and kilograms."
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
        ],
      },
      {
        focus: "Unit rates and their uses",
        blocks: [
          text(
            "Unit rate",
            "A **unit rate** is a rate whose second quantity is 1, such as ₱40 per 1 kilogram. To find a unit rate, divide the first quantity by the second.\n\nUnit rates make it easy to compare. They are used to compare prices, pay per hour, fuel use, typing speed, and more."
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
        ],
      },
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
        focus: "Word problems with rates",
        blocks: [
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
            "- A rate compares two quantities with different units.\n- A unit rate is a rate per 1 unit: divide the first quantity by the second.\n- Speed = distance ÷ time, so distance = speed × time and time = distance ÷ speed.\n- Compare prices by finding unit rates; the smaller unit price is the better buy.\n- To solve a rate problem, find the unit rate first, then multiply."
          ),
        ],
      },
    ],
  },
];

export const Q1_DRAFT_LESSONS: DraftLesson[] = SPECS.map(buildLesson);
