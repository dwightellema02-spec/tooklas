/**
 * Grade 7 Mathematics, Term 1, Weeks 1-7: skills and the practice question bank.
 *
 * Mastery in Tuklas is evidence-based (master plan section 14): a skill needs many attempts, in more
 * than one question type, at more than one difficulty, including hard and application questions.
 * So every skill has 18 questions in three practice sets:
 *   1. Guided practice   (6 questions, EASY)    - recall and one step
 *   2. Mixed practice    (6 questions, MEDIUM)  - several steps, more question types
 *   3. Challenge         (6 questions, HARD)    - application and transfer
 *
 * Answers are computed in code from the parameters (master plan rule 9: deterministic correctness) and
 * every item is checked by scripts/seed-q1-question-bank.ts before it is written. Wrong choices are the
 * mistakes students really make, and each one carries its own feedback.
 */

export type QType = "MULTIPLE_CHOICE" | "NUMERIC_INPUT" | "TRUE_FALSE";
export type Cognitive = "KNOWLEDGE" | "PROCEDURAL" | "APPLICATION" | "HIGHER_ORDER";
export type Tier = "basic" | "mixed" | "challenge";

export interface BankItem {
  type: QType;
  prompt: string;
  explanation: string;
  cognitive: Cognitive;
  data: Record<string, unknown>;
  correctFeedback: string;
  incorrectFeedback: string;
}

export interface SkillDef {
  /** Short code, also used to build ids. */
  code: string;
  lessonId: string;
  title: string;
  description: string;
  /** 1.0 to 5.0 */
  difficulty: number;
  /** Codes of the skills that must come first. */
  prerequisites: string[];
  /** Budget of Work competency statement this skill serves. */
  competency: string;
  items: () => BankItem[];
}

// ------------------------------------------------------------------ helpers
const hash = (s: string) => {
  let h = 7;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
};
const round = (x: number, dp = 4) => Math.round(x * 10 ** dp) / 10 ** dp;
const fmt = (x: number) => String(round(x));
const num = (x: number) => x.toLocaleString("en-US", { maximumFractionDigits: 4 });
const peso = (x: number) => `₱${num(x)}`;

const IDS = ["opt_a", "opt_b", "opt_c", "opt_d"];

const praise = (explanation: string) => "Correct! " + explanation.split(". ")[0].replace(/.$/, "") + ".";

function mc(
  key: string,
  prompt: string,
  correct: string,
  wrongs: Array<[string, string]>,
  explanation: string,
  cognitive: Cognitive = "PROCEDURAL"
): BankItem {
  const texts = [correct, ...wrongs.map((w) => w[0])];
  if (new Set(texts).size !== texts.length) throw new Error(`Duplicate choices in ${key}`);
  if (wrongs.length !== 3) throw new Error(`${key} needs exactly 3 wrong choices`);
  const shift = hash(key) % 4;
  const order = [0, 1, 2, 3].map((i) => (i + shift) % 4);
  const choices = order.map((srcIndex, pos) => ({ id: IDS[pos], text: texts[srcIndex] }));
  const correctId = choices.find((c) => c.text === correct)!.id;
  const feedbackByChoice: Record<string, string> = {};
  for (const [text, why] of wrongs) feedbackByChoice[choices.find((c) => c.text === text)!.id] = why;
  return {
    type: "MULTIPLE_CHOICE",
    prompt,
    explanation,
    cognitive,
    data: { choices, correctAnswer: correctId, feedbackByChoice },
    correctFeedback: praise(explanation),
    incorrectFeedback: "Not quite. Read the question again and check each step.",
  };
}

/**
 * The method hint shown when a numeric answer is wrong. It names the rule to use and never the answer.
 * The rules are strict on purpose: a hint for the wrong method would mislead, so unmatched prompts get a
 * general hint.
 */
const GENERAL_HINT = "Work it out step by step, then check your answer.";
const HINT_RULES: Array<[RegExp, string]> = [
  // ---- polygons and angles
  [/interior angle of a regular polygon is.*how many sides/, "Subtract from 180° to get the exterior angle, then divide 360° by it."],
  [/exterior angle (of a (regular )?polygon )?is.*how many sides|using that the exterior angles.*how many sides/, "The number of sides is n = 360° ÷ the exterior angle."],
  [/marked every \d+°|every \d+° around/, "The number of sides is 360° ÷ the angle between the points."],
  [/at what angle around the center|angle around the center/, "The angle at the center is 360° ÷ the number of sides."],
  [/how many degrees larger/, "Look up each angle in the table of regular polygons, then subtract."],
  [/each exterior angle/, "Each exterior angle of a regular polygon is 360° ÷ n."],
  [/each interior angle of a regular|each interior angle\?|what is each interior angle/, "Find the exterior angle (360° ÷ n), then subtract it from 180°."],
  [/total of its interior angles/, "Multiply the number of angles by the size of each angle."],
  [/sum of the interior angles/, "Use (n − 2) × 180°, where n is the number of sides."],
  [/add up to 1,?260/, "Divide the total by 180°, then add 2 to get the number of sides."],
  [/three right angles and two equal angles/, "The sum for a pentagon is 540°. Subtract the three right angles, then share what is left between the two equal angles."],
  [/missing angle|sixth angle|fourth angle|third (interior )?angle|fifth angle|angle c|one more angle|what should angle/, "Find the total for this shape, then subtract the angles you already know."],
  [/supplement/, "Supplementary angles add up to 180°."],
  [/complement/, "Complementary angles add up to 90°."],
  [/vertical to it/, "Vertical angles are equal."],
  [/sum of the other three angles/, "The four angles around the intersection add up to 360°. Subtract the angle you know."],
  [/adjacent to it|other angle|next to it/, "Angles in a linear pair add up to 180°."],
  [/adjacent (interior|exterior) angle|exterior angle next to|sum, in degrees/, "An exterior angle and its adjacent interior angle add up to 180°."],
  [/how many (interior|exterior) angles|how many sides does (an? )?(octagon|heptagon)|vertices\. how many sides|more sides than|twice as many sides|interior angles\. how many sides/, "A polygon has the same number of sides, vertices and interior angles. The name tells the number: tri 3, quad 4, penta 5, hexa 6, hepta 7, octa 8, nona 9, deca 10."],
  [/how many of them are greater than 180/, "Check each angle one by one: is it more than 180°?"],
  // ---- percentages and money
  [/percentage increase/, "Subtract to find the increase, divide it by the ORIGINAL value, then multiply by 100."],
  [/percentage decrease/, "Subtract to find the decrease, divide it by the ORIGINAL value, then multiply by 100."],
  [/increases by .*new price|after a \d+% increase/, "Find the percent of the original price, then add it to the original price."],
  [/reduced by .*new price|after a \d+% decrease/, "Find the percent of the original price, then subtract it from the original price."],
  [/rate of discount/, "Divide the discount by the original price, then multiply by 100."],
  [/original price/, "The sale price is (100% − the discount rate) of the original price. Divide the sale price by that decimal."],
  [/how much is the discount/, "Discount = original price × rate of discount."],
  [/sale price/, "Find the discount first, then subtract it from the original price."],
  [/commission rate/, "Commission rate = commission ÷ sales. Then multiply by 100 for a percent."],
  [/how much is the commission/, "Commission = commission rate × total sales."],
  [/before tax/, "The total is (100% + the tax rate) of the price. Divide the total by that decimal."],
  [/how much is the sales tax/, "Sales tax = tax rate × price."],
  [/total cost/, "Find the sales tax first, then add it to the price."],
  [/principal/, "P = I ÷ (r × t). Write the rate as a decimal."],
  [/interest rate per year/, "r = I ÷ (P × t). Then multiply by 100 for a percent."],
  [/for how many years/, "t = I ÷ (P × r). Write the rate as a decimal."],
  [/how much simple interest/, "I = P × r × t. Write the rate as a decimal and use the time in years."],
  [/how many pesos are left/, "Add the percents that are used, subtract from 100%, then find that percent of the allowance."],
  [/how much can he spend/, "Find the savings first (25% of the income), then subtract it from the income."],
  [/percent is left/, "Add the percents, then subtract the total from 100."],
  [/how much is left for savings/, "Savings = income − expenses."],
  [/how much is that/, "Amount = percent × income. Write the percent as a decimal."],
  // ---- rates
  [/different units/, "Count the kinds of unit in the rate, for example pesos and kilograms are two."],
  [/what is the rate in/, "Divide the first quantity by the second to get the amount for one unit."],
  [/how far does it travel|how far does it go|how far can/, "Distance = speed × time, or find the rate for one unit and multiply."],
  [/how many km can it travel on|full tank/, "Find how far it goes on 1 liter, then multiply by the number of liters."],
  [/how many hours does it take/, "Time = distance ÷ speed."],
  [/what is its speed|speed in km/, "Speed = distance ÷ time."],
  [/same rate|same speed/, "Find the rate for ONE unit first, then multiply by the new amount."],
  // ---- rational numbers
  [/\d+% as a decimal/, "Divide the percent by 100."],
  [/as a decimal/, "Divide the numerator by the denominator."],
  [/what percentage is correct/, "Divide the number correct by the number of items, then multiply by 100."],
  [/as a percentage/, "Change it to a decimal first, then multiply by 100."],
  [/halfway between/, "Add the two numbers and divide by 2."],
  [/how much more sugar/, "Write 3/4 as a decimal, then subtract."],
  [/number line.*(third mark|between 0 and 1)|split into/, "Split the line from 0 to 1 into equal parts and count the marks. Write each as a decimal."],
];
const methodHint = (prompt: string) => {
  const p = prompt.toLowerCase();
  const hit = HINT_RULES.find(([re]) => re.test(p));
  return hit ? hit[1] : GENERAL_HINT;
};

function numeric(
  prompt: string,
  answer: number,
  explanation: string,
  cognitive: Cognitive = "PROCEDURAL",
  hint = methodHint(prompt)
): BankItem {
  return {
    type: "NUMERIC_INPUT",
    prompt,
    explanation,
    cognitive,
    data: { correctAnswer: fmt(answer), tolerance: 0 },
    correctFeedback: praise(explanation),
    incorrectFeedback: hint,
  };
}

function tf(prompt: string, answer: boolean, explanation: string, cognitive: Cognitive = "KNOWLEDGE"): BankItem {
  return {
    type: "TRUE_FALSE",
    prompt,
    explanation,
    cognitive,
    data: { correctAnswer: answer },
    correctFeedback: praise(explanation),
    incorrectFeedback: "Not quite. Think about the definition again.",
  };
}

const NAMES: Record<number, string> = {
  3: "Triangle",
  4: "Quadrilateral",
  5: "Pentagon",
  6: "Hexagon",
  7: "Heptagon",
  8: "Octagon",
  9: "Nonagon",
  10: "Decagon",
};
const others = (n: number, count = 3) =>
  Object.keys(NAMES)
    .map(Number)
    .filter((k) => k !== n)
    .sort((a, b) => Math.abs(a - n) - Math.abs(b - n))
    .slice(0, count);

// percent change helper texts
const pct = (x: number) => `${fmt(x)}%`;

// ------------------------------------------------------------------ skills
export const SKILLS: SkillDef[] = [
  // =============================================================== WEEK 1
  {
    code: "w1l1",
    lessonId: "lsn_g7q1_w1_l1",
    title: "Define a polygon and name its parts",
    description: "Tell polygons from non-polygons, name polygons by their sides, and name their sides and angles.",
    difficulty: 1.0,
    prerequisites: [],
    competency: "Draw and describe regular and irregular polygons",
    items: () => {
      const nameQ = (n: number, key: string) =>
        mc(
          key,
          `A polygon has ${n} sides. What is it called?`,
          NAMES[n],
          others(n).map((k) => [NAMES[k], `${NAMES[k]} has ${k} sides, not ${n}.`] as [string, string]),
          `A polygon with ${n} sides is a ${NAMES[n].toLowerCase()}. The prefix tells the number of sides.`
        );
      return [
        nameQ(5, "w1l1-1"),
        numeric("How many sides does an octagon have?", 8, "Octa- means eight, so an octagon has 8 sides."),
        tf("A circle is a polygon.", false, "A polygon is made only of straight sides. A circle is curved, so it is not a polygon."),
        mc(
          "w1l1-4",
          "A polygon has 4 sides. What is the general name for it?",
          "Quadrilateral",
          [
            ["Triangle", "A triangle has 3 sides."],
            ["Pentagon", "A pentagon has 5 sides."],
            ["Square", "A square is only one kind of 4-sided polygon. The general name for any 4-sided polygon is quadrilateral."],
          ],
          "Any polygon with 4 sides is a quadrilateral. A square is one special kind."
        ),
        numeric("How many interior angles does a hexagon have?", 6, "A polygon has as many interior angles as sides. A hexagon has 6 sides, so 6 angles."),
        tf("Triangle ABC has sides AB, BC and AC.", true, "The sides join the vertices: AB, BC and AC are the three sides of triangle ABC."),

        mc(
          "w1l1-7",
          "Which of the following is a polygon?",
          "A closed figure with 7 straight sides that meet only at their endpoints",
          [
            ["A figure with 3 straight sides that is not closed", "A polygon must be closed."],
            ["A figure with 5 sides, one of them curved", "A polygon has only straight sides."],
            ["A circle", "A circle is curved, so it is not a polygon."],
          ],
          "A polygon is closed and has only straight sides that meet at endpoints."
        ),
        numeric("A polygon has 9 vertices. How many sides does it have?", 9, "A polygon has the same number of vertices and sides, so it has 9 sides."),
        nameQ(10, "w1l1-9"),
        tf("A polygon always has the same number of sides and interior angles.", true, "Each vertex has one interior angle, so the number of angles equals the number of sides."),
        mc(
          "w1l1-11",
          "Which are the interior angles of triangle PQR?",
          "∠QPR, ∠PQR and ∠PRQ",
          [
            ["PQ, QR and PR", "Those are the sides, not the angles."],
            ["P, Q and R", "Those are the vertices (the corners)."],
            ["∠P only", "A triangle has three interior angles, one at each vertex."],
          ],
          "The interior angles are named by their vertices: ∠QPR, ∠PQR and ∠PRQ."
        ),
        numeric("How many sides does a heptagon have?", 7, "Hepta- means seven, so a heptagon has 7 sides."),

        mc(
          "w1l1-13",
          "A road sign has 8 straight sides that meet at 8 corners. Which statement describes it?",
          "It is an octagon with 8 interior angles",
          [
            ["It is a hexagon with 8 interior angles", "A hexagon has 6 sides."],
            ["It is an octagon with 6 interior angles", "A polygon has as many interior angles as sides, so 8 angles."],
            ["It is a heptagon with 8 interior angles", "A heptagon has 7 sides."],
          ],
          "8 sides make an octagon, and an octagon has 8 interior angles.",
          "APPLICATION"
        ),
        numeric("A polygon has 5 more sides than a triangle. How many interior angles does it have?", 8, "A triangle has 3 sides, so the polygon has 3 + 5 = 8 sides and 8 interior angles.", "APPLICATION"),
        mc(
          "w1l1-15",
          "Which figure is NOT a polygon?",
          "A figure with 5 straight sides that cross each other in the middle",
          [
            ["A kite", "A kite is a closed figure with 4 straight sides, so it is a polygon."],
            ["A triangle", "A triangle is a polygon."],
            ["A decagon", "A decagon is a polygon with 10 sides."],
          ],
          "A polygon's sides meet only at their endpoints. Sides that cross in the middle do not make a polygon.",
          "HIGHER_ORDER"
        ),
        numeric("A polygon has twice as many sides as a triangle. How many interior angles does it have?", 6, "A triangle has 3 sides, so the polygon has 2 × 3 = 6 sides and 6 interior angles.", "APPLICATION"),
        mc(
          "w1l1-17",
          "Which statement is correct?",
          "A polygon with 6 sides has 6 vertices and 6 interior angles",
          [
            ["A polygon with 6 sides has 5 vertices", "The number of vertices equals the number of sides."],
            ["A polygon with 6 sides has 12 interior angles", "There is one interior angle at each vertex, so 6."],
            ["A polygon with 6 sides is a pentagon", "A pentagon has 5 sides. Six sides make a hexagon."],
          ],
          "Sides, vertices and interior angles are always equal in number.",
          "HIGHER_ORDER"
        ),
        tf("A figure with 4 straight sides and one curved side is a quadrilateral.", false, "A quadrilateral is a polygon, and a polygon has only straight sides.", "HIGHER_ORDER"),
      ];
    },
  },

  {
    code: "w1l2",
    lessonId: "lsn_g7q1_w1_l2",
    title: "Classify regular and irregular polygons",
    description: "Tell regular from irregular polygons and use the angles of regular polygons with 5, 6, 8 or 10 sides.",
    difficulty: 1.5,
    prerequisites: ["w1l1"],
    competency: "Draw and describe regular and irregular polygons",
    items: () => {
      const EACH: Record<number, number> = { 5: 108, 6: 120, 8: 135, 10: 144 };
      const SUM: Record<number, number> = { 5: 540, 6: 720, 8: 1080, 10: 1440 };
      const eachMc = (n: number, key: string) =>
        mc(
          key,
          `What is the measure of each interior angle of a regular ${NAMES[n].toLowerCase()}?`,
          `${EACH[n]}°`,
          Object.keys(EACH)
            .map(Number)
            .filter((k) => k !== n)
            .slice(0, 3)
            .map((k) => [`${EACH[k]}°`, `${EACH[k]}° is each angle of a regular ${NAMES[k].toLowerCase()}.`] as [string, string]),
          `Each interior angle of a regular ${NAMES[n].toLowerCase()} measures ${EACH[n]}°.`
        );
      return [
        eachMc(5, "w1l2-1"),
        tf("A regular polygon has all sides equal and all angles equal.", true, "That is the definition: a regular polygon is both equilateral and equiangular."),
        mc(
          "w1l2-3",
          "A polygon whose sides and angles are not all equal is called",
          "an irregular polygon",
          [
            ["a regular polygon", "A regular polygon has all sides and all angles equal."],
            ["a convex polygon", "Convex describes the angles being less than 180°, not whether sides are equal."],
            ["a closed polygon", "Every polygon is closed. That does not tell us about equal sides."],
          ],
          "A polygon that is not regular is irregular."
        ),
        numeric("What is the measure of each interior angle of a regular octagon, in degrees?", EACH[8], "Each interior angle of a regular octagon measures 135°."),
        mc(
          "w1l2-5",
          "What is a regular quadrilateral called?",
          "A square",
          [
            ["A rectangle", "A rectangle has equal angles but its sides are not all equal."],
            ["A rhombus", "A rhombus has equal sides but its angles are not all equal."],
            ["A trapezoid", "A trapezoid has neither all sides nor all angles equal."],
          ],
          "A regular quadrilateral has 4 equal sides and 4 equal angles. That is a square."
        ),
        tf("A regular triangle is called an equilateral triangle.", true, "All three sides and all three angles are equal, so it is an equilateral triangle."),

        numeric("What is the sum of the interior angles of a pentagon, in degrees?", SUM[5], "The interior angles of a pentagon add up to 540°."),
        mc(
          "w1l2-8",
          "A pentagon has five sides of 3 cm each and five angles of 108° each. Which describes it?",
          "A regular pentagon",
          [
            ["An irregular pentagon", "Its sides are all equal and its angles are all equal, so it is regular."],
            ["A regular hexagon", "It has 5 sides, so it is a pentagon."],
            ["An irregular hexagon", "It has 5 sides, so it is a pentagon."],
          ],
          "All sides equal and all angles equal means it is regular."
        ),
        mc(
          "w1l2-9",
          "A quadrilateral has four sides of 4 cm and angles of 80°, 100°, 80° and 100°. Which describes it?",
          "An irregular quadrilateral",
          [
            ["A regular quadrilateral", "The sides are equal but the angles are not, so it is not regular."],
            ["A square", "A square has four 90° angles."],
            ["A regular pentagon", "It has 4 sides."],
          ],
          "A regular polygon needs both equal sides and equal angles. Here the angles are not equal."
        ),
        numeric("What is the measure of each interior angle of a regular decagon, in degrees?", EACH[10], "Each interior angle of a regular decagon measures 144°."),
        mc(
          "w1l2-11",
          "A regular polygon has interior angles of 120° each. Which polygon is it?",
          "Regular hexagon",
          [
            ["Regular pentagon", "A regular pentagon has 108° angles."],
            ["Regular octagon", "A regular octagon has 135° angles."],
            ["Regular decagon", "A regular decagon has 144° angles."],
          ],
          "120° is each interior angle of a regular hexagon."
        ),
        tf("A rectangle that is not a square is a regular polygon.", false, "All of its angles are equal, but its sides are not all equal, so it is irregular."),

        numeric("A regular hexagon has six interior angles. What is the total of its interior angles, in degrees?", SUM[6], "6 × 120° = 720°, which is the sum for a hexagon.", "APPLICATION"),
        mc(
          "w1l2-14",
          "Which statement about hexagons is true?",
          "A hexagon with all angles 120° but sides of 2, 4, 2, 4, 2 and 4 cm is irregular",
          [
            ["A hexagon with all angles 120° is always regular", "Regular also needs all sides equal."],
            ["A hexagon with equal sides is always regular", "Regular also needs all angles equal."],
            ["An irregular hexagon cannot have equal angles", "It can: its sides may be unequal while its angles are equal."],
          ],
          "A polygon is regular only when both its sides and its angles are all equal.",
          "HIGHER_ORDER"
        ),
        numeric("Each interior angle of a regular polygon is 135°. How many sides does it have?", 8, "From the table of regular polygons, 135° belongs to the octagon, which has 8 sides.", "APPLICATION"),
        mc(
          "w1l2-16",
          "How does the sum of the interior angles of an irregular pentagon compare with that of a regular pentagon?",
          "They are the same, 540°",
          [
            ["The irregular one is smaller", "The sum depends only on the number of sides."],
            ["The irregular one is larger", "The sum depends only on the number of sides."],
            ["It cannot be found for an irregular pentagon", "It can: every pentagon's angles add up to 540°."],
          ],
          "Every pentagon has an angle sum of 540°, regular or irregular.",
          "HIGHER_ORDER"
        ),
        tf("An irregular polygon always has a different angle sum from a regular polygon with the same number of sides.", false, "The angle sum depends only on the number of sides.", "HIGHER_ORDER"),
        numeric("How many degrees larger is each interior angle of a regular hexagon than each interior angle of a regular pentagon?", EACH[6] - EACH[5], "120° − 108° = 12°.", "APPLICATION"),
      ];
    },
  },

  {
    code: "w1l3",
    lessonId: "lsn_g7q1_w1_l3",
    title: "Draw polygons using angle measures",
    description: "Use the angle at the center to draw regular polygons, and use angle sums to draw triangles and quadrilaterals.",
    difficulty: 2.0,
    prerequisites: ["w1l2"],
    competency: "Draw triangles, quadrilaterals, and regular polygons with given angle measures",
    items: () => [
      numeric("To draw a regular pentagon, at what angle around the center do you mark each point, in degrees?", 72, "360° ÷ 5 = 72°."),
      numeric("To draw a regular hexagon, at what angle around the center do you mark each point, in degrees?", 60, "360° ÷ 6 = 60°."),
      mc(
        "w1l3-3",
        "Which tool do you use to measure and draw angles?",
        "A protractor",
        [
          ["A compass", "A compass draws circles and arcs."],
          ["A ruler", "A ruler measures lengths, not angles."],
          ["A pencil", "A pencil only marks. It cannot measure."],
        ],
        "A protractor measures and draws angles."
      ),
      numeric("A triangle has angles of 40° and 60°. What is the third angle, in degrees?", 80, "180° − 40° − 60° = 80°."),
      tf("The three angles of a triangle add up to 180°.", true, "That is the angle sum of every triangle."),
      numeric("To draw a regular octagon, at what angle around the center do you mark each point, in degrees?", 45, "360° ÷ 8 = 45°."),

      numeric("To draw a regular decagon, at what angle around the center do you mark each point, in degrees?", 36, "360° ÷ 10 = 36°."),
      numeric("Three angles of a quadrilateral are 90°, 90° and 70°. What is the fourth angle, in degrees?", 110, "360° − 90° − 90° − 70° = 110°."),
      mc(
        "w1l3-9",
        "You draw a regular hexagon with sides of 5 cm inside a circle. What radius should the circle have?",
        "5 cm",
        [
          ["2.5 cm", "That is half of the side. In a regular hexagon the radius equals the side."],
          ["10 cm", "That is twice the side. In a regular hexagon the radius equals the side."],
          ["6 cm", "The number of sides does not give the radius. The side and the radius are equal."],
        ],
        "In a regular hexagon the side is equal to the radius of the circle around it."
      ),
      numeric("A triangle has angles of 35° and 85°. What is the third angle, in degrees?", 60, "180° − 35° − 85° = 60°."),
      tf("The four angles of a quadrilateral add up to 360°.", true, "That is the angle sum of every quadrilateral."),
      mc(
        "w1l3-12",
        "What is the first step in drawing a regular polygon with a compass and protractor?",
        "Draw a circle and mark its center",
        [
          ["Join the points with a ruler", "You can only join points after you have marked them."],
          ["Mark points every 90°", "The angle depends on the number of sides, and you first need the circle."],
          ["Measure the sides", "The sides come from the points you mark on the circle."],
        ],
        "Draw a circle first, then mark equal angles around its center."
      ),

      numeric("Three angles of a quadrilateral are 85°, 95° and 110°. What is the fourth angle, in degrees?", 70, "360° − 85° − 95° − 110° = 70°.", "APPLICATION"),
      numeric("Points are marked every 40° around a center and joined to make a regular polygon. How many sides does it have?", 9, "360° ÷ 40° = 9 sides.", "APPLICATION"),
      mc(
        "w1l3-15",
        "A student marks points every 72° around the center of a circle and joins them in order. Which polygon is drawn?",
        "A regular pentagon",
        [
          ["A regular hexagon", "A regular hexagon needs points every 60°."],
          ["A regular octagon", "A regular octagon needs points every 45°."],
          ["A regular decagon", "A regular decagon needs points every 36°."],
        ],
        "360° ÷ 72° = 5, so the polygon has 5 sides.",
        "APPLICATION"
      ),
      numeric("You draw triangle ABC with AB = 5 cm, angle A = 50° and angle B = 60°. What should angle C measure, in degrees?", 70, "180° − 50° − 60° = 70°.", "APPLICATION"),
      tf("In a regular hexagon drawn inside a circle, the length of each side equals the radius of the circle.", true, "The six equal triangles around the center are equilateral, so side = radius.", "HIGHER_ORDER"),
      numeric("A regular polygon has 12 sides. At what angle around the center is each point marked, in degrees?", 30, "360° ÷ 12 = 30°.", "APPLICATION"),
    ],
  },

  // =============================================================== WEEK 2
  {
    code: "w2l1",
    lessonId: "lsn_g7q1_w2_l1",
    title: "Classify polygons as convex or non-convex",
    description: "Tell convex from non-convex polygons, and classify polygons by sides, regularity and convexity.",
    difficulty: 2.0,
    prerequisites: ["w1l2"],
    competency: "Classify polygons according to the number of sides, regular or irregular, and convex or non-convex",
    items: () => [
      mc(
        "w2l1-1",
        "Which describes a convex polygon?",
        "All of its interior angles are less than 180°",
        [
          ["It has at least one interior angle greater than 180°", "That describes a non-convex polygon."],
          ["All of its sides are equal", "That is about regular polygons, not convex."],
          ["It has exactly four sides", "The number of sides does not decide convexity."],
        ],
        "A convex polygon has every interior angle less than 180°."
      ),
      tf("A convex polygon has all interior angles less than 180°.", true, "That is the definition of a convex polygon."),
      mc(
        "w2l1-3",
        "A polygon has an interior angle of 220°. How is it classified?",
        "Non-convex",
        [
          ["Convex", "A convex polygon has no angle greater than 180°."],
          ["Regular", "A polygon with such an angle cannot have all angles equal."],
          ["It is not a polygon", "It is a polygon. It is non-convex."],
        ],
        "An interior angle greater than 180° makes a polygon non-convex."
      ),
      tf("Regular polygons are convex.", true, "All the interior angles of a regular polygon are less than 180°."),
      mc(
        "w2l1-5",
        "A quadrilateral has angles of 90°, 100°, 110° and 60°. How is it classified?",
        "Convex",
        [
          ["Non-convex", "None of its angles is greater than 180°."],
          ["Regular", "Its angles are not all equal."],
          ["It is not a polygon", "It has 4 sides, so it is a quadrilateral."],
        ],
        "Every angle is less than 180°, so it is convex."
      ),
      tf("A non-convex polygon has all its interior angles less than 180°.", false, "A non-convex polygon has at least one interior angle greater than 180°."),

      mc(
        "w2l1-7",
        "A figure has 6 equal sides and 6 equal angles of 120°. Which classification is correct?",
        "A regular, convex hexagon",
        [
          ["An irregular, convex hexagon", "Its sides and angles are all equal, so it is regular."],
          ["A regular, non-convex hexagon", "All its angles are less than 180°, so it is convex."],
          ["A regular, convex pentagon", "It has 6 sides, so it is a hexagon."],
        ],
        "6 sides make a hexagon, equal sides and angles make it regular, and angles below 180° make it convex."
      ),
      mc(
        "w2l1-8",
        "An arrowhead shape has 4 sides and one angle of 200°. Which classification is correct?",
        "An irregular, non-convex quadrilateral",
        [
          ["A regular, convex quadrilateral", "It has an angle greater than 180°."],
          ["An irregular, convex quadrilateral", "An angle of 200° makes it non-convex."],
          ["A regular, non-convex quadrilateral", "Its angles are not all equal."],
        ],
        "It has 4 sides, unequal angles and one angle greater than 180°."
      ),
      numeric("The interior angles of a polygon are 120°, 95°, 210°, 70° and 45°. How many of them are greater than 180°?", 1, "Only 210° is greater than 180°, so there is 1.", "PROCEDURAL"),
      mc(
        "w2l1-10",
        "Can an irregular polygon be convex?",
        "Yes, if all of its angles are less than 180°",
        [
          ["No, every irregular polygon is non-convex", "Convex only depends on the angles being less than 180°."],
          ["No, only regular polygons can be convex", "Many irregular polygons, such as a scalene triangle, are convex."],
          ["Yes, but only if it has 4 sides", "The number of sides does not matter."],
        ],
        "A scalene triangle is irregular and convex."
      ),
      tf("A polygon with a vertex that points inward is non-convex.", true, "A vertex pointing inward has an interior angle greater than 180°."),
      mc(
        "w2l1-12",
        "How is a scalene triangle classified?",
        "An irregular, convex triangle",
        [
          ["A regular, convex triangle", "Its sides and angles are not all equal."],
          ["An irregular, non-convex triangle", "All the angles of a triangle are less than 180°."],
          ["A regular, non-convex triangle", "A triangle can never be non-convex."],
        ],
        "A scalene triangle has unequal sides and angles, and all its angles are less than 180°."
      ),

      mc(
        "w2l1-13",
        "A pentagon has angles of 60°, 70°, 80°, 100° and 230°. How is it classified?",
        "Non-convex, because of the 230° angle",
        [
          ["Convex, because the angles add up to 540°", "The sum does not decide it. One angle is greater than 180°."],
          ["Regular, because it has 5 angles", "Its angles are not all equal."],
          ["Convex, because most angles are less than 180°", "Every angle must be less than 180° for a convex polygon."],
        ],
        "230° is greater than 180°, so the pentagon is non-convex.",
        "APPLICATION"
      ),
      numeric("A quadrilateral has angles of 40°, 50° and 60°, and one more angle x. Find x in degrees.", 210, "The angles of a quadrilateral add up to 360°. 360° − 40° − 50° − 60° = 210°, so it is non-convex.", "APPLICATION"),
      mc(
        "w2l1-15",
        "Which statement about regular decagons is true?",
        "A regular decagon is convex",
        [
          ["A regular decagon is non-convex because it has many sides", "Its angles are 144°, all less than 180°."],
          ["Every non-convex polygon is regular", "A non-convex polygon cannot have all angles equal and below 180°."],
          ["Every polygon with equal sides is convex", "Equal sides do not decide it. The angles do."],
        ],
        "Each angle of a regular decagon is 144°, which is less than 180°.",
        "HIGHER_ORDER"
      ),
      tf("Every convex polygon is regular.", false, "A convex polygon can have unequal sides and angles. A scalene triangle is an example.", "HIGHER_ORDER"),
      numeric("A hexagon has five angles of 100° each. Its angles add up to 720°. What is the sixth angle, in degrees?", 220, "720° − 5 × 100° = 220°. It is greater than 180°, so the hexagon is non-convex.", "APPLICATION"),
      mc(
        "w2l1-18",
        "Which polygon must be convex?",
        "A regular octagon",
        [
          ["An arrowhead quadrilateral", "It has an angle greater than 180°."],
          ["A hexagon with one angle of 200°", "An angle greater than 180° makes it non-convex."],
          ["A pentagon with a vertex pointing inward", "A vertex pointing inward means non-convex."],
        ],
        "All the angles of a regular octagon are 135°.",
        "HIGHER_ORDER"
      ),
    ],
  },

  {
    code: "w2l2",
    lessonId: "lsn_g7q1_w2_l2",
    title: "Describe and use angle pairs",
    description: "Use complementary, supplementary, adjacent and vertical angles and linear pairs to find unknown angles.",
    difficulty: 2.0,
    prerequisites: [],
    competency: "Describe and explain the relationships between angle pairs based on their measures",
    items: () => [
      numeric("What is the complement of 30°, in degrees?", 60, "Complementary angles add up to 90°. 90° − 30° = 60°."),
      numeric("What is the supplement of 120°, in degrees?", 60, "Supplementary angles add up to 180°. 180° − 120° = 60°."),
      tf("Vertical angles are equal.", true, "When two lines intersect, the opposite (vertical) angles are equal."),
      mc(
        "w2l2-4",
        "The angles of a linear pair add up to",
        "180°",
        [
          ["90°", "That is the sum of complementary angles."],
          ["360°", "That is a full turn."],
          ["100°", "A linear pair is on a straight line, which is 180°."],
        ],
        "A linear pair forms a straight line, so the angles add up to 180°."
      ),
      numeric("One angle of a linear pair is 140°. What is the other angle, in degrees?", 40, "180° − 140° = 40°."),
      mc(
        "w2l2-6",
        "Two angles add up to 90°. What are they called?",
        "Complementary angles",
        [
          ["Supplementary angles", "Supplementary angles add up to 180°."],
          ["Vertical angles", "Vertical angles are equal. They are opposite each other."],
          ["A linear pair", "A linear pair adds up to 180°."],
        ],
        "Angles that add up to 90° are complementary."
      ),

      numeric("What is the complement of 57°, in degrees?", 33, "90° − 57° = 33°."),
      numeric("What is the supplement of 83°, in degrees?", 97, "180° − 83° = 97°."),
      numeric("Two lines intersect and one angle is 64°. What is the angle vertical to it, in degrees?", 64, "Vertical angles are equal, so it is 64°."),
      numeric("Two lines intersect and one angle is 112°. What is an angle adjacent to it, in degrees?", 68, "An adjacent angle forms a linear pair with it. 180° − 112° = 68°."),
      mc(
        "w2l2-11",
        "Two angles measure 35° and 55°. What are they?",
        "Complementary angles",
        [
          ["Supplementary angles", "35° + 55° = 90°, not 180°."],
          ["Vertical angles", "Vertical angles are equal, and 35° ≠ 55°."],
          ["A linear pair", "A linear pair adds up to 180°."],
        ],
        "35° + 55° = 90°, so they are complementary."
      ),
      tf("Complementary angles must be next to each other.", false, "Complementary angles only need to add up to 90°. They do not have to be adjacent."),

      numeric("Two lines intersect and one angle is 38°. What is the sum of the other three angles, in degrees?", 322, "The four angles add up to 360°. 360° − 38° = 322°.", "APPLICATION"),
      numeric("Two lines intersect and one angle is 65°. Find the measure of one of the angles next to it, in degrees.", 115, "It forms a linear pair with 65°. 180° − 65° = 115°.", "APPLICATION"),
      mc(
        "w2l2-15",
        "Which pair of angles is both adjacent and supplementary?",
        "A linear pair",
        [
          ["Vertical angles", "Vertical angles are not next to each other."],
          ["Two complementary angles", "Complementary angles add up to 90°."],
          ["Two equal angles", "Equal angles do not have to add up to 180°."],
        ],
        "A linear pair is adjacent and adds up to 180°.",
        "HIGHER_ORDER"
      ),
      tf("Vertical angles are always supplementary.", false, "Vertical angles are equal. They are supplementary only when each is 90°.", "HIGHER_ORDER"),
      numeric("What is the supplement of the complement of 70°? First find the complement, then its supplement, in degrees.", 160, "The complement of 70° is 20°. The supplement of 20° is 160°.", "HIGHER_ORDER"),
      mc(
        "w2l2-18",
        "Which two angles could be complementary?",
        "22° and 68°",
        [
          ["22° and 158°", "These add up to 180°, so they are supplementary."],
          ["45° and 55°", "These add up to 100°."],
          ["60° and 60°", "These add up to 120°."],
        ],
        "22° + 68° = 90°.",
        "APPLICATION"
      ),
    ],
  },

  // =============================================================== WEEK 3
  {
    code: "w3l1",
    lessonId: "lsn_g7q1_w3_l1",
    title: "Identify interior and exterior angles",
    description: "Tell the interior angles of a polygon from its exterior angles.",
    difficulty: 1.5,
    prerequisites: ["w2l2"],
    competency: "Deduce the relationship between the exterior angle and adjacent interior angle of a polygon",
    items: () => [
      mc(
        "w3l1-1",
        "An angle formed inside a polygon by two sides that meet at a vertex is a(n)",
        "interior angle",
        [
          ["exterior angle", "An exterior angle is formed outside, by extending a side."],
          ["vertical angle", "Vertical angles are formed by two intersecting lines."],
          ["complementary angle", "Complementary angles add up to 90°."],
        ],
        "An angle inside the polygon at a vertex is an interior angle."
      ),
      mc(
        "w3l1-2",
        "A side of a polygon is extended past a vertex. The angle between the extension and the next side is a(n)",
        "exterior angle",
        [
          ["interior angle", "An interior angle is inside the polygon."],
          ["vertical angle", "Vertical angles are formed by two intersecting lines."],
          ["supplementary angle", "It is supplementary to the adjacent interior angle, but its name is exterior angle."],
        ],
        "An angle formed outside by extending a side is an exterior angle."
      ),
      numeric("How many interior angles does a pentagon have?", 5, "There is one interior angle at each of the 5 vertices."),
      tf("An exterior angle is formed inside the polygon.", false, "An exterior angle is formed outside the polygon."),
      numeric("A polygon has one exterior angle at each vertex. How many exterior angles does a hexagon have?", 6, "A hexagon has 6 vertices, so 6 exterior angles."),
      tf("At a vertex, the interior angle and the exterior angle next to it are adjacent.", true, "They share the vertex and a side, so they are adjacent."),

      numeric("How many interior angles does an octagon have?", 8, "An octagon has 8 vertices, so 8 interior angles."),
      mc(
        "w3l1-8",
        "How is an exterior angle of a polygon formed?",
        "By extending one side past a vertex",
        [
          ["By joining two vertices", "Joining two vertices makes a diagonal."],
          ["By measuring inside the polygon", "That gives an interior angle."],
          ["By drawing a circle around the polygon", "Circles do not form exterior angles."],
        ],
        "Extend a side past a vertex and measure from the extension to the next side."
      ),
      tf("A triangle has three exterior angles, one at each vertex.", true, "There is one exterior angle at each vertex when one side is extended at each."),
      numeric("A decagon has an interior angle and an exterior angle at each vertex. How many interior angles does it have?", 10, "A decagon has 10 vertices, so 10 interior angles."),
      mc(
        "w3l1-11",
        "Which angle is next to an interior angle at the same vertex?",
        "The exterior angle at that vertex",
        [
          ["The interior angle at the opposite vertex", "That is at a different vertex."],
          ["The sum of all the angles", "That is not an angle at the vertex."],
          ["The center angle of the circle", "That is not part of the polygon."],
        ],
        "The exterior angle at the same vertex is adjacent to the interior angle."
      ),
      tf("Exterior angles are measured inside a polygon.", false, "Exterior angles are measured outside, between an extended side and the next side."),

      numeric("A regular polygon has 12 sides. How many interior angles does it have?", 12, "A polygon has as many interior angles as sides.", "APPLICATION"),
      mc(
        "w3l1-14",
        "In a polygon with 7 sides, how many interior and exterior angles are there when you extend one side at each vertex?",
        "7 interior and 7 exterior",
        [
          ["7 interior and 14 exterior", "There is one exterior angle at each vertex when one side is extended at each."],
          ["14 interior and 7 exterior", "There is one interior angle at each vertex."],
          ["7 interior and 0 exterior", "Extending the sides gives exterior angles."],
        ],
        "One of each at every vertex, and a heptagon has 7 vertices.",
        "APPLICATION"
      ),
      tf("The interior angle and the exterior angle at the same vertex can never be adjacent.", false, "They are always adjacent. They share the vertex and a side.", "HIGHER_ORDER"),
      numeric("A polygon has 9 interior angles. How many sides does it have?", 9, "The number of interior angles equals the number of sides.", "APPLICATION"),
      mc(
        "w3l1-18",
        "Which statement about the angles at each vertex of a polygon is true?",
        "Each vertex of a polygon has one interior angle and one exterior angle (when one side is extended)",
        [
          ["Each vertex has two interior angles", "Each vertex has exactly one interior angle."],
          ["Exterior angles are inside the polygon", "Exterior angles are outside the polygon."],
          ["Only triangles have exterior angles", "Every polygon has them."],
        ],
        "One interior and one exterior angle at each vertex.",
        "HIGHER_ORDER"
      ),
      numeric("A polygon has 15 exterior angles, one at each vertex. How many interior angles does it have?", 15, "There is one interior angle at each vertex, so 15.", "APPLICATION"),
    ],
  },

  {
    code: "w3l2",
    lessonId: "lsn_g7q1_w3_l2",
    title: "Use an exterior angle and its adjacent interior angle",
    description: "Use the fact that an exterior angle and its adjacent interior angle add up to 180°.",
    difficulty: 2.0,
    prerequisites: ["w3l1", "w2l2"],
    competency: "Deduce the relationship between the exterior angle and adjacent interior angle of a polygon",
    items: () => {
      const adj = (known: number, kind: "exterior" | "interior", key: string, diff: Cognitive = "PROCEDURAL") =>
        numeric(
          `${kind === "exterior" ? "An exterior" : "An interior"} angle of a polygon measures ${known}°. What is the adjacent ${kind === "exterior" ? "interior" : "exterior"} angle, in degrees?`,
          180 - known,
          `They are supplementary. 180° − ${known}° = ${180 - known}°.`,
          diff
        );
      return [
        adj(100, "exterior", "a"),
        adj(55, "exterior", "b"),
        tf("An exterior angle and its adjacent interior angle add up to 180°.", true, "They form a linear pair, so they are supplementary."),
        adj(135, "interior", "d"),
        mc(
          "w3l2-5",
          "An exterior angle and its adjacent interior angle form a",
          "linear pair",
          [
            ["pair of vertical angles", "Vertical angles are opposite each other."],
            ["pair of complementary angles", "Complementary angles add up to 90°."],
            ["pair of equal angles", "They are equal only when each is 90°."],
          ],
          "They share a vertex and a side, and their other sides form a straight line."
        ),
        adj(90, "exterior", "f"),

        adj(72, "exterior", "g"),
        adj(143, "interior", "h"),
        numeric("A triangle has angles of 38° and 60°. What is the third interior angle, in degrees?", 82, "180° − 38° − 60° = 82°."),
        numeric("A triangle has angles of 38° and 60°. What is the exterior angle next to the third interior angle, in degrees?", 98, "The third interior angle is 82°. 180° − 82° = 98°."),
        mc(
          "w3l2-11",
          "An interior angle of a polygon is 107°. What is the adjacent exterior angle?",
          "73°",
          [
            ["63°", "180° − 107° is 73°, not 63°."],
            ["83°", "180° − 107° is 73°, not 83°."],
            ["107°", "The exterior angle is the supplement of the interior angle, not equal to it."],
          ],
          "180° − 107° = 73°."
        ),
        tf("If the interior angle of a polygon is 90°, its adjacent exterior angle is also 90°.", true, "180° − 90° = 90°."),

        adj(28, "exterior", "m", "APPLICATION"),
        numeric("A triangle has angles of 45° and 65°. What is the exterior angle next to the third interior angle, in degrees?", 110, "The third angle is 180° − 45° − 65° = 70°. Its exterior angle is 180° − 70° = 110°.", "APPLICATION"),
        mc(
          "w3l2-15",
          "The exterior angle of a polygon at a vertex is 118°. Which statement about the interior angle at that vertex is true?",
          "It measures 62°",
          [
            ["It measures 118°", "The interior and exterior angles are supplementary, not equal."],
            ["It measures 72°", "180° − 118° is 62°."],
            ["It measures 242°", "That is 360° − 118°, which is not the adjacent interior angle."],
          ],
          "180° − 118° = 62°.",
          "APPLICATION"
        ),
        numeric("At one vertex of a polygon the exterior angle is 120° and the adjacent interior angle is 60°. What is their sum, in degrees?", 180, "60° + 120° = 180°, which agrees with the rule that they are supplementary.", "HIGHER_ORDER"),
        tf("An exterior angle can be larger than 180° at a convex polygon's vertex.", false, "Its adjacent interior angle is more than 0° and less than 180°, so the exterior angle is less than 180°.", "HIGHER_ORDER"),
        adj(161, "interior", "r", "APPLICATION"),
      ];
    },
  },

  {
    code: "w3l3",
    lessonId: "lsn_g7q1_w3_l3",
    title: "Find the angle measures of a polygon",
    description: "Use the sum of the interior angles of a polygon to find a missing angle.",
    difficulty: 2.5,
    prerequisites: ["w3l2"],
    competency: "Determine the measures of angles and the number of sides of polygons",
    items: () => {
      const sumQ = (n: number) =>
        numeric(
          `What is the sum of the interior angles of a polygon with ${n} sides, in degrees?`,
          (n - 2) * 180,
          `(n − 2) × 180° = (${n} − 2) × 180° = ${(n - 2) * 180}°.`
        );
      const missing = (n: number, known: number[], key: string, cog: Cognitive = "PROCEDURAL") => {
        const total = (n - 2) * 180;
        const rest = total - known.reduce((a, b) => a + b, 0);
        return numeric(
          `${known.length} interior angles of a ${NAMES[n]?.toLowerCase() ?? `${n}-sided polygon`} measure ${known.join("°, ")}°. The polygon has ${n} sides. What is the missing angle, in degrees?`,
          rest,
          `The sum for ${n} sides is ${total}°. ${total}° − ${known.reduce((a, b) => a + b, 0)}° = ${rest}°.`,
          cog
        );
      };
      return [
        sumQ(5),
        sumQ(6),
        tf("The exterior angles of any polygon, one at each vertex, add up to 360°.", true, "This is true for every polygon."),
        numeric("What is the sum of the interior angles of a quadrilateral, in degrees?", 360, "(4 − 2) × 180° = 360°."),
        mc(
          "w3l3-5",
          "Which formula gives the sum of the interior angles of a polygon with n sides?",
          "(n − 2) × 180°",
          [
            ["n × 180°", "That is too large. You must subtract 2 from n first."],
            ["(n − 2) × 360°", "The factor is 180°, not 360°."],
            ["n × 360°", "The sum of the exterior angles is 360°, not this."],
          ],
          "A polygon with n sides can be split into (n − 2) triangles of 180° each."
        ),
        sumQ(8),

        sumQ(9),
        missing(5, [100, 110, 120, 90], "m1"),
        missing(6, [100, 110, 120, 130, 140], "m2"),
        numeric("A pentagon has three right angles and two equal angles x. Find x in degrees.", 135, "540° − 3 × 90° = 270°. Dividing between two equal angles gives 135°."),
        mc(
          "w3l3-11",
          "Into how many triangles can a hexagon be divided by drawing diagonals from one vertex?",
          "4",
          [
            ["6", "That would be n triangles. The number is n − 2."],
            ["5", "That would be n − 1. The number is n − 2."],
            ["3", "That is the number for a pentagon."],
          ],
          "A hexagon splits into 6 − 2 = 4 triangles, which is why its angle sum is 4 × 180° = 720°."
        ),
        tf("The interior angles of an octagon add up to 1,080°.", true, "(8 − 2) × 180° = 1,080°."),

        missing(7, [120, 130, 140, 150, 100, 110], "m3", "APPLICATION"),
        numeric("A polygon has interior angles that add up to 1,260°. How many sides does it have?", 9, "1,260° ÷ 180° = 7, and 7 + 2 = 9 sides.", "APPLICATION"),
        mc(
          "w3l3-15",
          "Four angles of a pentagon are 110°, 100°, 120° and 90°. A student says the fifth angle is 130°. What is wrong?",
          "The sum for a pentagon is 540°, so the fifth angle is 120°",
          [
            ["Nothing, 130° is correct", "540° − 420° = 120°, not 130°."],
            ["The sum for a pentagon is 360°, so the angle is −60°", "360° is the sum for a quadrilateral."],
            ["The sum for a pentagon is 720°, so the angle is 300°", "720° is the sum for a hexagon."],
          ],
          "110° + 100° + 120° + 90° = 420°, and 540° − 420° = 120°.",
          "APPLICATION"
        ),
        numeric("Each exterior angle of a polygon is 30° (the same at every vertex). Using that the exterior angles add up to 360°, how many sides does it have?", 12, "360° ÷ 30° = 12 sides.", "APPLICATION"),
        tf("A polygon with 12 sides has an interior angle sum of 1,800°.", true, "(12 − 2) × 180° = 1,800°.", "HIGHER_ORDER"),
        numeric("Five angles of a hexagon are 150°, 130°, 90°, 140° and 120°. What is the sixth angle, in degrees?", 90, "The sum is 720°. 150 + 130 + 90 + 140 + 120 = 630, and 720° − 630° = 90°.", "APPLICATION"),
      ];
    },
  },

  {
    code: "w3l4",
    lessonId: "lsn_g7q1_w3_l4",
    title: "Find the angles and sides of regular polygons",
    description: "Find each angle of a regular polygon and the number of its sides.",
    difficulty: 3.0,
    prerequisites: ["w3l3"],
    competency: "Determine the measures of angles and the number of sides of polygons",
    items: () => {
      const ext = (n: number) =>
        numeric(`What is each exterior angle of a regular polygon with ${n} sides, in degrees?`, 360 / n, `360° ÷ ${n} = ${fmt(360 / n)}°.`);
      const intr = (n: number) =>
        numeric(
          `What is each interior angle of a regular polygon with ${n} sides, in degrees?`,
          ((n - 2) * 180) / n,
          `Each exterior angle is 360° ÷ ${n} = ${fmt(360 / n)}°, so each interior angle is 180° − ${fmt(360 / n)}° = ${fmt(180 - 360 / n)}°.`
        );
      const sidesFromExt = (e: number) =>
        numeric(`Each exterior angle of a regular polygon is ${e}°. How many sides does it have?`, 360 / e, `360° ÷ ${e}° = ${fmt(360 / e)} sides.`);
      const sidesFromInt = (i: number) =>
        numeric(
          `Each interior angle of a regular polygon is ${i}°. How many sides does it have?`,
          360 / (180 - i),
          `The exterior angle is 180° − ${i}° = ${180 - i}°. 360° ÷ ${180 - i}° = ${fmt(360 / (180 - i))} sides.`
        );
      return [
        ext(8),
        ext(6),
        tf("Each exterior angle of a regular polygon with n sides is 360° ÷ n.", true, "The exterior angles add up to 360° and are all equal."),
        intr(8),
        sidesFromExt(60),
        mc(
          "w3l4-6",
          "What is each exterior angle of a regular pentagon?",
          "72°",
          [
            ["108°", "108° is each interior angle."],
            ["90°", "That would be a square."],
            ["60°", "That would be a hexagon."],
          ],
          "360° ÷ 5 = 72°."
        ),

        intr(10),
        sidesFromExt(40),
        sidesFromInt(150),
        ext(15),
        mc(
          "w3l4-11",
          "Each interior angle of a regular polygon is 144°. How many sides does it have?",
          "10",
          [
            ["8", "A regular octagon has interior angles of 135°."],
            ["12", "A regular 12-sided polygon has interior angles of 150°."],
            ["9", "A regular nonagon has interior angles of 140°."],
          ],
          "Exterior angle 180° − 144° = 36°, and 360° ÷ 36° = 10."
        ),
        tf("In a regular polygon, each interior angle plus each exterior angle equals 180°.", true, "They form a linear pair at each vertex."),

        sidesFromExt(20),
        sidesFromInt(160),
        numeric("A regular polygon has an exterior angle of 24°. What is each interior angle, in degrees?", 156, "180° − 24° = 156°.", "APPLICATION"),
        mc(
          "w3l4-16",
          "Is there a regular polygon with each exterior angle of 25°?",
          "No, because 360° ÷ 25° = 14.4, which is not a whole number",
          [
            ["Yes, it has 14 sides", "14 × 25° = 350°, not 360°."],
            ["Yes, it has 15 sides", "15 × 25° = 375°, not 360°."],
            ["No, because 25° is less than 30°", "The size alone does not decide it. The number of sides must be a whole number."],
          ],
          "The number of sides n = 360° ÷ 25° = 14.4, so no regular polygon has that exterior angle.",
          "HIGHER_ORDER"
        ),
        tf("A regular polygon can have an interior angle of 170° and 36 sides.", true, "The exterior angle is 10°, and 360° ÷ 10° = 36 sides.", "HIGHER_ORDER"),
        numeric("A regular polygon has 18 sides. What is each interior angle, in degrees?", 160, "Each exterior angle is 360° ÷ 18 = 20°, so each interior angle is 160°.", "APPLICATION"),
      ];
    },
  },

  // =============================================================== WEEK 4
  {
    code: "w4l1",
    lessonId: "lsn_g7q1_w4_l1",
    title: "Solve percentage increase problems",
    description: "Find a percentage increase and the new value after an increase.",
    difficulty: 2.0,
    prerequisites: [],
    competency: "Solve problems involving percentage increase",
    items: () => {
      const rate = (o: number, nw: number, key: string, cog: Cognitive = "PROCEDURAL") =>
        numeric(
          `A value increases from ${num(o)} to ${num(nw)}. What is the percentage increase? (Answer in %, without the % sign.)`,
          ((nw - o) / o) * 100,
          `Increase = ${num(nw)} − ${num(o)} = ${num(nw - o)}. ${num(nw - o)} ÷ ${num(o)} × 100% = ${pct(((nw - o) / o) * 100)}.`,
          cog
        );
      const newVal = (o: number, p: number, key: string, cog: Cognitive = "PROCEDURAL") =>
        numeric(
          `A price of ${peso(o)} increases by ${p}%. What is the new price? (Answer in pesos, without the ₱ sign.)`,
          o * (1 + p / 100),
          `Increase = ${p}% of ${num(o)} = ${num((o * p) / 100)}. New price = ${num(o)} + ${num((o * p) / 100)} = ${num(o * (1 + p / 100))}.`,
          cog
        );
      return [
        rate(80, 100, "a"),
        rate(50, 65, "b"),
        tf("Percentage increase is found by dividing the increase by the original value.", true, "Percentage increase = (new − original) ÷ original × 100%."),
        newVal(350, 20, "d"),
        mc(
          "w4l1-5",
          "A product costs ₱200 and rises to ₱280. How do you find the percentage increase?",
          "(280 − 200) ÷ 200 × 100%",
          [
            ["(280 − 200) ÷ 280 × 100%", "You must divide by the original value (₱200), not the new one."],
            ["280 ÷ 200 × 100%", "You must subtract the original value first to find the increase."],
            ["(280 + 200) ÷ 200 × 100%", "Subtract the original from the new value, do not add."],
          ],
          "The increase is 80, and 80 ÷ 200 × 100% = 40%."
        ),
        rate(200, 250, "f"),

        rate(40, 46, "g"),
        newVal(250, 12, "h"),
        rate(60, 90, "i"),
        newVal(900, 10, "j"),
        mc(
          "w4l1-11",
          "A seller says a ₱200 item will cost ₱280 because of a 30% increase. Is the seller right?",
          "No, the increase is 40%",
          [
            ["Yes, 30% of 200 is 80", "30% of 200 is 60, not 80."],
            ["No, the increase is 14%", "80 ÷ 280 is about 29%, and the correct base is 200."],
            ["Yes, 280 is 30% more than 200", "30% more than 200 is 260."],
          ],
          "The increase is 80 and 80 ÷ 200 = 0.40 = 40%."
        ),
        tf("A 25% increase on ₱400 gives ₱500.", true, "25% of 400 is 100, and 400 + 100 = 500."),

        newVal(1200, 5, "m", "APPLICATION"),
        numeric("A town's population grows from 8,000 to 9,200. What is the percentage increase? (Answer in %, without the % sign.)", 15, "The increase is 1,200. 1,200 ÷ 8,000 × 100% = 15%.", "APPLICATION"),
        mc(
          "w4l1-15",
          "The price of rice goes from ₱50 to ₱56 a kilogram. What is the percentage increase?",
          "12%",
          [
            ["6%", "6 is the increase in pesos, not the percentage."],
            ["10.7%", "That divides by the new price (56). Divide by the original, 50."],
            ["112%", "That is 56 ÷ 50 × 100%. You must subtract first."],
          ],
          "The increase is 6, and 6 ÷ 50 × 100% = 12%.",
          "APPLICATION"
        ),
        numeric("A phone costs ₱8,000. After a 15% increase, how much is it? (Answer in pesos, without the ₱ sign.)", 9200, "15% of 8,000 is 1,200, and 8,000 + 1,200 = 9,200.", "APPLICATION"),
        tf("An increase from 100 to 150 and an increase from 200 to 250 are the same percentage.", false, "The first is 50% and the second is 25%, because the original values differ.", "HIGHER_ORDER"),
        numeric("An item rose from ₱150 to ₱225. What is the percentage increase? (Answer in %, without the % sign.)", 50, "The increase is 75. 75 ÷ 150 × 100% = 50%.", "APPLICATION"),
      ];
    },
  },

  {
    code: "w4l2",
    lessonId: "lsn_g7q1_w4_l2",
    title: "Solve percentage decrease problems",
    description: "Find a percentage decrease and the new value after a decrease.",
    difficulty: 2.0,
    prerequisites: ["w4l1"],
    competency: "Solve problems involving percentage decrease",
    items: () => {
      const rate = (o: number, nw: number, cog: Cognitive = "PROCEDURAL") =>
        numeric(
          `A value decreases from ${num(o)} to ${num(nw)}. What is the percentage decrease? (Answer in %, without the % sign.)`,
          ((o - nw) / o) * 100,
          `Decrease = ${num(o)} − ${num(nw)} = ${num(o - nw)}. ${num(o - nw)} ÷ ${num(o)} × 100% = ${pct(((o - nw) / o) * 100)}.`,
          cog
        );
      const newVal = (o: number, p: number, cog: Cognitive = "PROCEDURAL") =>
        numeric(
          `A price of ${peso(o)} is reduced by ${p}%. What is the new price? (Answer in pesos, without the ₱ sign.)`,
          o * (1 - p / 100),
          `Decrease = ${p}% of ${num(o)} = ${num((o * p) / 100)}. New price = ${num(o)} − ${num((o * p) / 100)} = ${num(o * (1 - p / 100))}.`,
          cog
        );
      return [
        rate(500, 400),
        rate(1200, 900),
        tf("Percentage decrease is found by dividing the decrease by the original value.", true, "Percentage decrease = (original − new) ÷ original × 100%."),
        newVal(350, 20),
        mc(
          "w4l2-5",
          "A bag falls from ₱500 to ₱400. How do you find the percentage decrease?",
          "(500 − 400) ÷ 500 × 100%",
          [
            ["(500 − 400) ÷ 400 × 100%", "You must divide by the original value (₱500), not the new one."],
            ["400 ÷ 500 × 100%", "That is the new price as a percent of the old. Subtract first to find the decrease."],
            ["(500 + 400) ÷ 500 × 100%", "Subtract the new from the original value, do not add."],
          ],
          "The decrease is 100, and 100 ÷ 500 × 100% = 20%."
        ),
        rate(80, 60),

        rate(250, 200),
        newVal(800, 25),
        rate(60, 54),
        newVal(1500, 40),
        mc(
          "w4l2-11",
          "A price rises from ₱50 to ₱75, then falls back to ₱50. What is the percentage decrease from ₱75 to ₱50?",
          "About 33%",
          [
            ["50%", "The decrease is divided by the original price of this fall, which is 75, not 50."],
            ["25%", "25 is the change in pesos, not the percentage."],
            ["150%", "A decrease cannot be more than 100% of the original."],
          ],
          "The decrease is 25 and 25 ÷ 75 × 100% is about 33%."
        ),
        tf("A 20% decrease on ₱500 gives ₱400.", true, "20% of 500 is 100, and 500 − 100 = 400."),

        newVal(2400, 15, "APPLICATION"),
        numeric("A shop's daily sales fall from ₱12,000 to ₱9,000. What is the percentage decrease? (Answer in %, without the % sign.)", 25, "The decrease is 3,000. 3,000 ÷ 12,000 × 100% = 25%.", "APPLICATION"),
        mc(
          "w4l2-15",
          "A shirt priced at ₱600 is reduced to ₱480. What is the percentage decrease?",
          "20%",
          [
            ["25%", "That divides the decrease (120) by the new price (480). Divide by the original, 600."],
            ["120%", "120 is the decrease in pesos, not the percentage."],
            ["80%", "80% is the new price as a percent of the old. The decrease is 20%."],
          ],
          "120 ÷ 600 × 100% = 20%.",
          "APPLICATION"
        ),
        numeric("A bicycle costs ₱5,000. After a 12% decrease, how much is it? (Answer in pesos, without the ₱ sign.)", 4400, "12% of 5,000 is 600, and 5,000 − 600 = 4,400.", "APPLICATION"),
        tf("A 50% increase followed by a 50% decrease returns a value to its original amount.", false, "100 increases to 150, and 50% of 150 is 75, so it falls to 75.", "HIGHER_ORDER"),
        rate(90, 72, "APPLICATION"),
      ];
    },
  },

  {
    code: "w4l3",
    lessonId: "lsn_g7q1_w4_l3",
    title: "Solve discount and sale price problems",
    description: "Find a discount, a sale price, or the original price.",
    difficulty: 2.5,
    prerequisites: ["w4l2"],
    competency: "Solve money problems involving percentages (discount)",
    items: () => {
      const disc = (o: number, p: number, cog: Cognitive = "PROCEDURAL") =>
        numeric(
          `A ${peso(o)} item has a ${p}% discount. How much is the discount? (Answer in pesos, without the ₱ sign.)`,
          (o * p) / 100,
          `Discount = ${p}% of ${num(o)} = ${num((o * p) / 100)}.`,
          cog
        );
      const sale = (o: number, p: number, cog: Cognitive = "PROCEDURAL") =>
        numeric(
          `A ${peso(o)} item is on sale at ${p}% off. What is the sale price? (Answer in pesos, without the ₱ sign.)`,
          o * (1 - p / 100),
          `Discount = ${num((o * p) / 100)}. Sale price = ${num(o)} − ${num((o * p) / 100)} = ${num(o * (1 - p / 100))}.`,
          cog
        );
      const orig = (s: number, p: number, cog: Cognitive = "APPLICATION") =>
        numeric(
          `After a ${p}% discount an item costs ${peso(s)}. What was the original price? (Answer in pesos, without the ₱ sign.)`,
          s / (1 - p / 100),
          `The sale price is ${100 - p}% of the original price. ${num(s)} ÷ ${fmt(1 - p / 100)} = ${num(s / (1 - p / 100))}.`,
          cog
        );
      return [
        disc(600, 30),
        sale(800, 25),
        tf("Sale price = original price − discount.", true, "The discount is taken off the original price."),
        disc(1000, 15),
        mc(
          "w4l3-5",
          "A shirt costs ₱800 and is 25% off. Which is the sale price?",
          "₱600",
          [
            ["₱200", "₱200 is the discount, not the sale price."],
            ["₱825", "That adds 25 to the price. Take 25% of the price off."],
            ["₱775", "That subtracts 25 pesos, not 25 percent."],
          ],
          "25% of 800 is 200, and 800 − 200 = 600."
        ),
        sale(400, 10),

        sale(1200, 15),
        disc(2500, 20),
        sale(950, 20),
        mc(
          "w4l3-10",
          "Which formula gives the discount?",
          "Discount = original price × rate of discount",
          [
            ["Discount = sale price × rate of discount", "The discount is a percentage of the original price."],
            ["Discount = original price ÷ rate of discount", "Multiply by the rate. Do not divide."],
            ["Discount = original price + sale price", "That is not a discount."],
          ],
          "Discount = original price × rate."
        ),
        tf("A 50% discount on ₱700 gives a sale price of ₱350.", true, "50% of 700 is 350, and 700 − 350 = 350."),
        sale(5600, 35),

        orig(720, 20),
        orig(630, 30),
        mc(
          "w4l3-15",
          "After a 20% discount, a pair of shoes costs ₱720. A student answers ₱864. What went wrong?",
          "The student added 20% instead of finding what 720 is 80% of",
          [
            ["Nothing, ₱864 is correct", "720 is 80% of the original, so the original is 720 ÷ 0.80 = 900."],
            ["The student should have subtracted 20% from 720", "720 is already the price after the discount."],
            ["The discount should be 25%", "The discount is given as 20%."],
          ],
          "The sale price is 80% of the original price, so the original is 720 ÷ 0.80 = ₱900.",
          "HIGHER_ORDER"
        ),
        numeric("An item's original price is ₱1,500 and its sale price is ₱1,200. What is the rate of discount? (Answer in %, without the % sign.)", 20, "The discount is 300. 300 ÷ 1,500 × 100% = 20%.", "APPLICATION"),
        tf("A 10% discount followed by another 10% discount equals a 20% discount.", false, "10% off 100 gives 90, and 10% off 90 gives 81. That is a 19% discount.", "HIGHER_ORDER"),
        sale(3750, 12, "APPLICATION"),
      ];
    },
  },

  {
    code: "w4l4",
    lessonId: "lsn_g7q1_w4_l4",
    title: "Solve commission and sales tax problems",
    description: "Find a commission, a commission rate, a sales tax or a total cost.",
    difficulty: 2.5,
    prerequisites: ["w4l3"],
    competency: "Solve money problems involving percentages (commission, sales tax)",
    items: () => {
      const com = (s: number, p: number, cog: Cognitive = "PROCEDURAL") =>
        numeric(
          `A seller earns ${p}% commission on ${peso(s)} of sales. How much is the commission? (Answer in pesos, without the ₱ sign.)`,
          (s * p) / 100,
          `Commission = ${p}% of ${num(s)} = ${num((s * p) / 100)}.`,
          cog
        );
      const comRate = (c: number, s: number, cog: Cognitive = "APPLICATION") =>
        numeric(
          `An agent received ${peso(c)} after selling an item for ${peso(s)}. What is the commission rate? (Answer in %, without the % sign.)`,
          (c / s) * 100,
          `Commission rate = commission ÷ sales = ${num(c)} ÷ ${num(s)} = ${fmt(c / s)}, which is ${pct((c / s) * 100)}.`,
          cog
        );
      const tax = (p: number, t: number, cog: Cognitive = "PROCEDURAL") =>
        numeric(
          `An item costs ${peso(p)} before a ${t}% sales tax. How much is the sales tax? (Answer in pesos, without the ₱ sign.)`,
          (p * t) / 100,
          `Sales tax = ${t}% of ${num(p)} = ${num((p * t) / 100)}.`,
          cog
        );
      const total = (p: number, t: number, cog: Cognitive = "PROCEDURAL") =>
        numeric(
          `An item costs ${peso(p)} before a ${t}% sales tax. What is the total cost? (Answer in pesos, without the ₱ sign.)`,
          p * (1 + t / 100),
          `Sales tax = ${num((p * t) / 100)}. Total cost = ${num(p)} + ${num((p * t) / 100)} = ${num(p * (1 + t / 100))}.`,
          cog
        );
      return [
        com(20000, 5),
        com(45000, 8),
        tf("Total cost = price + sales tax.", true, "The sales tax is added to the price."),
        tax(500, 12),
        mc(
          "w4l4-5",
          "Which formula gives a commission?",
          "Commission = commission rate × total sales",
          [
            ["Commission = total sales ÷ commission rate", "Multiply the rate by the sales. Do not divide."],
            ["Commission = total sales − commission rate", "Subtracting a percent from pesos is not meaningful."],
            ["Commission = total sales + commission rate", "Adding a percent to pesos is not meaningful."],
          ],
          "Commission = rate × sales."
        ),
        total(500, 12),

        com(30000, 5),
        tax(25000, 12),
        total(25000, 12),
        comRate(2400, 30000, "PROCEDURAL"),
        mc(
          "w4l4-11",
          "A laptop is priced at ₱40,000 plus 12% VAT. How much do you pay in total?",
          "₱44,800",
          [
            ["₱4,800", "₱4,800 is only the VAT. Add it to the price."],
            ["₱40,012", "VAT is 12 percent, not 12 pesos."],
            ["₱35,200", "VAT is added to the price. It is not taken off."],
          ],
          "VAT = 4,800, and 40,000 + 4,800 = 44,800."
        ),
        tf("A seller who earns ₱1,500 on ₱30,000 of sales has a commission rate of 5%.", true, "1,500 ÷ 30,000 = 0.05 = 5%."),

        com(86500, 4, "APPLICATION"),
        comRate(1800, 24000, "APPLICATION"),
        numeric("A total cost of ₱560 includes a 12% sales tax. What was the price before tax? (Answer in pesos, without the ₱ sign.)", 500, "The total is 112% of the price. 560 ÷ 1.12 = 500.", "APPLICATION"),
        mc(
          "w4l4-15",
          "A seller earns 8% commission and received ₱2,000. How much did the seller sell?",
          "₱25,000",
          [
            ["₱160", "That is 8% of 2,000, but ₱2,000 is the commission, not the sales."],
            ["₱2,160", "Adding 8% of 2,000 does not give the sales."],
            ["₱16,000", "That is 2,000 × 8. The sales = commission ÷ rate."],
          ],
          "Sales = commission ÷ rate = 2,000 ÷ 0.08 = 25,000.",
          "HIGHER_ORDER"
        ),
        tf("A 12% sales tax on ₱1,000 is ₱120.", true, "12% of 1,000 is 120.", "APPLICATION"),
        total(3480, 12, "APPLICATION"),
      ];
    },
  },

  {
    code: "w4l5",
    lessonId: "lsn_g7q1_w4_l5",
    title: "Solve simple interest problems",
    description: "Find simple interest, and find the principal, rate or time.",
    difficulty: 3.0,
    prerequisites: ["w4l4"],
    competency: "Solve money problems involving percentages (simple interest)",
    items: () => {
      const interest = (P: number, r: number, t: number, cog: Cognitive = "PROCEDURAL") =>
        numeric(
          `How much simple interest does ${peso(P)} earn at ${r}% per year in ${t} year${t === 1 ? "" : "s"}? (Answer in pesos, without the ₱ sign.)`,
          (P * r * t) / 100,
          `I = P × r × t = ${num(P)} × ${fmt(r / 100)} × ${t} = ${num((P * r * t) / 100)}.`,
          cog
        );
      const principal = (I: number, r: number, t: number, cog: Cognitive = "APPLICATION") =>
        numeric(
          `A savings account at ${r}% simple interest per year earns ${peso(I)} in ${t} year${t === 1 ? "" : "s"}. What is the principal? (Answer in pesos, without the ₱ sign.)`,
          (I * 100) / (r * t),
          `P = I ÷ (r × t) = ${num(I)} ÷ (${fmt(r / 100)} × ${t}) = ${num((I * 100) / (r * t))}.`,
          cog
        );
      const rate = (I: number, P: number, t: number, cog: Cognitive = "APPLICATION") =>
        numeric(
          `${peso(P)} earns ${peso(I)} simple interest in ${t} years. What is the interest rate per year? (Answer in %, without the % sign.)`,
          (I / (P * t)) * 100,
          `r = I ÷ (P × t) = ${num(I)} ÷ (${num(P)} × ${t}) = ${fmt(I / (P * t))}, which is ${pct((I / (P * t)) * 100)}.`,
          cog
        );
      const time = (I: number, P: number, r: number, cog: Cognitive = "APPLICATION") =>
        numeric(
          `${peso(P)} is invested at ${r}% simple interest per year and earns ${peso(I)}. For how many years? (Answer in years.)`,
          (I * 100) / (P * r),
          `t = I ÷ (P × r) = ${num(I)} ÷ (${num(P)} × ${fmt(r / 100)}) = ${fmt((I * 100) / (P * r))}.`,
          cog
        );
      return [
        interest(2000, 5, 2),
        interest(10000, 2, 1),
        tf("In I = P × r × t, the time t is measured in years.", true, "The rate is a yearly rate, so t is in years."),
        interest(5000, 4, 3),
        mc(
          "w4l5-5",
          "Which formula gives the principal when I, r and t are known?",
          "P = I ÷ (r × t)",
          [
            ["P = I × r × t", "That is the formula for the interest."],
            ["P = (r × t) ÷ I", "The interest is on top, divided by r × t."],
            ["P = I + r + t", "The quantities are multiplied and divided, not added."],
          ],
          "Rearranging I = P × r × t gives P = I ÷ (r × t)."
        ),
        interest(8000, 3, 2),

        principal(900, 5, 3),
        rate(1500, 10000, 3),
        time(1440, 12000, 4),
        interest(35500, 7, 3),
        mc(
          "w4l5-11",
          "Mia saves ₱5,000 at 4% simple interest for 3 years. What is her total money at the end?",
          "₱5,600",
          [
            ["₱600", "₱600 is only the interest. Add it to the principal."],
            ["₱5,200", "That is the amount after one year only."],
            ["₱6,000", "That adds 4% three times to a larger amount. Simple interest is on the principal only."],
          ],
          "Interest = 5,000 × 0.04 × 3 = 600, and 5,000 + 600 = 5,600."
        ),
        tf("₱1,000 at 6% simple interest earns ₱60 in one year.", true, "1,000 × 0.06 × 1 = 60."),

        principal(480, 4, 2),
        rate(2700, 15000, 3),
        time(20400, 85000, 6),
        mc(
          "w4l5-15",
          "Which investment earns more simple interest in 2 years?",
          "₱6,000 at 5% per year",
          [
            ["₱5,000 at 5% per year", "That earns 5,000 × 0.05 × 2 = ₱500, less than ₱600."],
            ["₱6,000 at 4% per year", "That earns 6,000 × 0.04 × 2 = ₱480, less than ₱600."],
            ["₱4,000 at 6% per year", "That earns 4,000 × 0.06 × 2 = ₱480, less than ₱600."],
          ],
          "₱6,000 at 5% earns 6,000 × 0.05 × 2 = ₱600, the most.",
          "HIGHER_ORDER"
        ),
        interest(16000, 3.5, 2, "APPLICATION"),
        tf("Doubling the time doubles the simple interest.", true, "I = P × r × t, so I is proportional to t.", "HIGHER_ORDER"),
      ];
    },
  },

  // =============================================================== WEEK 5
  {
    code: "w5l1",
    lessonId: "lsn_g7q1_w5_l1",
    title: "Create a financial plan",
    description: "Plan the use of a daily income with percentages, and check that the plan is balanced.",
    difficulty: 2.5,
    prerequisites: ["w4l3"],
    competency: "Create a financial plan",
    items: () => {
      const amt = (I: number, p: number, use: string, cog: Cognitive = "PROCEDURAL") =>
        numeric(
          `Your daily allowance is ${peso(I)}. You plan ${p}% for ${use}. How much is that? (Answer in pesos, without the ₱ sign.)`,
          (I * p) / 100,
          `Amount = percent × income = ${fmt(p / 100)} × ${num(I)} = ${num((I * p) / 100)}.`,
          cog
        );
      const left = (parts: number[], cog: Cognitive = "PROCEDURAL") =>
        numeric(
          `A plan gives ${parts.map((p) => p + "%").join(", ")} to different uses. What percent is left? (Answer in %, without the % sign.)`,
          100 - parts.reduce((a, b) => a + b, 0),
          `${parts.join(" + ")} = ${parts.reduce((a, b) => a + b, 0)}, and 100 − ${parts.reduce((a, b) => a + b, 0)} = ${100 - parts.reduce((a, b) => a + b, 0)}.`,
          cog
        );
      const sav = (I: number, E: number, cog: Cognitive = "PROCEDURAL") =>
        numeric(
          `A student has an income of ${peso(I)} and expenses of ${peso(E)}. How much is left for savings? (Answer in pesos, without the ₱ sign.)`,
          I - E,
          `Savings = income − expenses = ${num(I)} − ${num(E)} = ${num(I - E)}.`,
          cog
        );
      return [
        sav(200, 140),
        amt(200, 25, "transportation"),
        tf("The percentages in a complete plan should add up to 100%.", true, "100% means all of the money has been planned."),
        mc(
          "w5l1-4",
          "Which formula gives savings?",
          "Savings = income − expenses",
          [
            ["Savings = income + expenses", "Adding the expenses to the income does not give what is left."],
            ["Savings = expenses − income", "That would be negative when you spend less than you earn."],
            ["Savings = income × expenses", "Savings is what is left over, found by subtracting."],
          ],
          "What is left after spending is income − expenses."
        ),
        amt(150, 50, "food"),
        sav(150, 105),

        left([40, 25, 15]),
        amt(120, 25, "savings"),
        left([50, 20, 20]),
        mc(
          "w5l1-10",
          "A plan for ₱100 gives food 45%, transportation 30% and savings 30%. What is wrong?",
          "The percentages add up to 105%, which is more than the income",
          [
            ["Nothing is wrong", "45 + 30 + 30 = 105, which is more than 100."],
            ["The percentages add up to 95%, so money is wasted", "They add up to 105%, not 95%."],
            ["Savings cannot be 30%", "Any percent is allowed. The problem is the total."],
          ],
          "45% + 30% + 30% = 105%, so the plan spends ₱5 more than the income."
        ),
        tf("A plan whose percentages add up to 95% leaves 5% of the income unplanned.", true, "100% − 95% = 5% has not been given a use."),
        amt(250, 10, "other uses"),

        sav(300, 255, "APPLICATION"),
        numeric("Your daily allowance is ₱180. You plan 20% for savings, 50% for food and 20% for transportation. How many pesos are left for other uses?", 18, "20 + 50 + 20 = 90%, so 10% is left. 10% of 180 = 18.", "APPLICATION"),
        mc(
          "w5l1-15",
          "Your allowance is ₱200. You want to save 25%. How much will you save each day?",
          "₱50",
          [
            ["₱25", "25 is the percent, not the pesos. 25% of 200 is 50."],
            ["₱150", "₱150 is what is left to spend."],
            ["₱225", "That adds the percent to the allowance."],
          ],
          "Savings = 0.25 × 200 = 50.",
          "APPLICATION"
        ),
        numeric("Ben earns ₱120 a day and wants to save 25%. How much can he spend each day? (Answer in pesos, without the ₱ sign.)", 90, "Savings = 25% of 120 = 30. Spending = 120 − 30 = 90.", "APPLICATION"),
        tf("If your plan uses 110% of your income, you have planned to spend more than you have.", true, "110% is more than the whole income.", "HIGHER_ORDER"),
        amt(175, 40, "food", "APPLICATION"),
      ];
    },
  },

  // =============================================================== WEEK 6
  {
    code: "w6l1",
    lessonId: "lsn_g7q1_w6_l1",
    title: "Identify rates and explain their uses",
    description: "Tell rates from ratios and explain where rates are used.",
    difficulty: 1.5,
    prerequisites: [],
    competency: "Identify and explain the uses of rates",
    items: () => [
      mc(
        "w6l1-1",
        "Which of the following is a rate?",
        "5 kilometers per hour",
        [
          ["3 boys to 5 girls", "Both quantities are counts of people. A rate compares different units."],
          ["2 red pens to 3 blue pens", "Both quantities are pens. A rate compares different units."],
          ["4 cm to 9 cm", "Both quantities are lengths in the same unit."],
        ],
        "A rate compares quantities with different units, here distance and time."
      ),
      tf("A rate compares two quantities that have different units.", true, "That is the definition of a rate."),
      mc(
        "w6l1-3",
        "Which situation uses a rate?",
        "A tricycle travels 30 kilometers per hour",
        [
          ["Counting the students in a room", "A count is a single quantity."],
          ["Naming a polygon", "That is not about comparing quantities."],
          ["Measuring one angle", "That is a single measurement."],
        ],
        "Kilometers per hour compares distance with time."
      ),
      tf("₱45 per kilogram is a rate.", true, "It compares pesos with kilograms."),
      numeric("A rate compares quantities with how many different units? (Answer with a number.)", 2, "A rate compares two quantities with different units, such as pesos and kilograms."),
      mc(
        "w6l1-6",
        "What is the difference between a rate and a ratio?",
        "A rate compares different units, a ratio compares the same unit",
        [
          ["A rate is always bigger than a ratio", "The size is not what makes them different."],
          ["A rate uses percent, a ratio does not", "Neither needs percent."],
          ["There is no difference", "They differ in the units compared."],
        ],
        "Rate: pesos per kilogram. Ratio: 3 boys to 5 girls."
      ),

      mc(
        "w6l1-7",
        "Which is NOT a rate?",
        "The ratio of 4 apples to 6 apples",
        [
          ["60 kilometers per hour", "Kilometers and hours are different units, so it is a rate."],
          ["₱120 for 3 kilograms", "Pesos and kilograms are different units, so it is a rate."],
          ["240 words in 4 minutes", "Words and minutes are different units, so it is a rate."],
        ],
        "4 apples to 6 apples compares the same unit, so it is a ratio."
      ),
      tf("Speed is an example of a rate.", true, "Speed compares distance with time."),
      mc(
        "w6l1-9",
        "Which unit shows a rate used for pay?",
        "Pesos per hour",
        [
          ["Pesos", "That is a single amount."],
          ["Hours", "That is a single quantity."],
          ["Kilometers", "That measures distance, not pay."],
        ],
        "Pay is often given as pesos per hour."
      ),
      tf("Kilometers per liter is a rate that describes fuel use.", true, "It compares the distance traveled with the fuel used."),
      mc(
        "w6l1-11",
        "What does the rate '240 words in 4 minutes' tell you?",
        "How fast someone types",
        [
          ["How long a word is", "It compares words to minutes."],
          ["How many minutes are in a word", "It compares words to minutes, not the other way around."],
          ["The number of students typing", "It does not describe students."],
        ],
        "It compares the number of words typed with the time taken."
      ),
      tf("A rate can have the same unit in both quantities.", false, "When both units are the same it is a ratio, not a rate."),

      mc(
        "w6l1-13",
        "A store sells 3 kg of rice for ₱120. Which statement is a rate?",
        "₱120 for 3 kg",
        [
          ["3 kg to 3 kg", "Both quantities are kilograms."],
          ["Rice is sold by weight", "That is a sentence, not a comparison of quantities."],
          ["120 pesos is bigger than 3 pesos", "That compares two amounts of the same unit."],
        ],
        "₱120 for 3 kg compares pesos with kilograms.",
        "APPLICATION"
      ),
      numeric("A runner covers 300 meters in 60 seconds. How many different units are compared in this rate? (Answer with a number.)", 2, "Meters and seconds are two different units.", "APPLICATION"),
      mc(
        "w6l1-15",
        "Which pair of quantities gives a rate?",
        "Liters of gasoline and kilometers traveled",
        [
          ["Two lengths in centimeters", "Both have the same unit."],
          ["Two counts of students", "Both have the same unit."],
          ["Two heights in meters", "Both have the same unit."],
        ],
        "Liters and kilometers are different units.",
        "APPLICATION"
      ),
      tf("A rate of 5 pesos per candy tells you the cost of one candy.", true, "Per means for each one, so it is the cost of one candy.", "APPLICATION"),
      mc(
        "w6l1-17",
        "Why are rates useful?",
        "They let us compare things such as prices, speeds and pay fairly",
        [
          ["They make numbers smaller", "Rates do not shrink numbers. They compare quantities."],
          ["They replace the need to measure", "Rates come from measurements."],
          ["They only work for money", "Rates also describe speed, fuel use and more."],
        ],
        "A rate puts different situations on a comparable footing.",
        "HIGHER_ORDER"
      ),
      tf("The ratio 3 : 5 of boys to girls is a rate.", false, "Both quantities are numbers of children, the same unit, so it is a ratio.", "HIGHER_ORDER"),
    ],
  },

  {
    code: "w6l2",
    lessonId: "lsn_g7q1_w6_l2",
    title: "Express rates as unit rates",
    description: "Find a unit rate and use it to compare.",
    difficulty: 2.0,
    prerequisites: ["w6l1"],
    competency: "Identify and explain the uses of rates",
    items: () => {
      const unit = (a: number, ua: string, b: number, ub: string, per: string, cog: Cognitive = "PROCEDURAL") =>
        numeric(
          `${num(a)} ${ua} for ${num(b)} ${ub}. What is the rate in ${ua} per ${per}? (Answer with a number.)`,
          a / b,
          `Unit rate = ${num(a)} ÷ ${num(b)} = ${fmt(a / b)} ${ua} per ${per}.`,
          cog
        );
      return [
        unit(120, "pesos", 3, "kilograms", "kilogram"),
        unit(240, "words", 4, "minutes", "minute"),
        tf("To find a unit rate, divide the first quantity by the second.", true, "A unit rate is the rate for 1 unit of the second quantity."),
        unit(150, "kilometers", 3, "hours", "hour"),
        mc(
          "w6l2-5",
          "A 3 kg bag of rice costs ₱120. How do you find the price per kilogram?",
          "Divide 120 by 3",
          [
            ["Multiply 120 by 3", "Multiplying gives the price of 9 bags' worth, not one kilogram."],
            ["Divide 3 by 120", "That gives kilograms per peso."],
            ["Subtract 3 from 120", "Subtraction does not give a rate."],
          ],
          "₱120 ÷ 3 kg = ₱40 per kilogram."
        ),
        unit(90, "pesos", 2, "liters", "liter"),

        unit(63, "pesos", 750, "grams", "gram"),
        unit(45, "pesos", 500, "grams", "gram"),
        mc(
          "w6l2-9",
          "A 500 g pack of noodles costs ₱45 and a 750 g pack costs ₱63. Which is the better buy?",
          "The 750 g pack (₱0.084 per gram)",
          [
            ["The 500 g pack (₱0.09 per gram)", "₱0.09 per gram is higher than ₱0.084 per gram."],
            ["Both cost the same per gram", "₱45 ÷ 500 = 0.09 and ₱63 ÷ 750 = 0.084."],
            ["The 750 g pack because it costs more", "A higher total price does not mean a better buy. Compare the unit prices."],
          ],
          "The smaller price per gram is the better buy."
        ),
        unit(350, "pesos", 2, "hours", "hour"),
        tf("A smaller unit price means a better buy.", true, "You pay less for each unit."),
        unit(180, "kilometers", 4, "liters", "liter"),

        mc(
          "w6l2-13",
          "A 2-liter bottle costs ₱90 and a 3-liter bottle costs ₱120. Which is the better buy?",
          "The 3-liter bottle (₱40 per liter)",
          [
            ["The 2-liter bottle (₱45 per liter)", "₱45 per liter is more than ₱40 per liter."],
            ["Both are the same", "₱90 ÷ 2 = 45 and ₱120 ÷ 3 = 40."],
            ["The 2-liter bottle because it costs less", "A lower total price does not make a better buy."],
          ],
          "₱40 per liter is less than ₱45 per liter.",
          "APPLICATION"
        ),
        unit(640, "pesos", 8, "hours", "hour", "APPLICATION"),
        unit(2400, "meters", 6, "minutes", "minute", "APPLICATION"),
        mc(
          "w6l2-16",
          "Store A sells 4 pencils for ₱28. Store B sells 6 pencils for ₱39. Which has the lower price per pencil?",
          "Store B (₱6.50 per pencil)",
          [
            ["Store A (₱7 per pencil)", "₱7 is more than ₱6.50."],
            ["They are the same", "28 ÷ 4 = 7 and 39 ÷ 6 = 6.5."],
            ["Store A because 28 is less than 39", "Compare the unit prices, not the totals."],
          ],
          "₱6.50 per pencil is lower than ₱7.",
          "APPLICATION"
        ),
        tf("A unit rate always has 1 as its second quantity.", true, "That is what makes it a rate per one unit.", "HIGHER_ORDER"),
        unit(1260, "pesos", 6, "meters", "meter", "APPLICATION"),
      ];
    },
  },

  {
    code: "w6l3",
    lessonId: "lsn_g7q1_w6_l3",
    title: "Solve problems involving rates",
    description: "Solve speed, distance, time, pay and fuel problems with rates.",
    difficulty: 2.5,
    prerequisites: ["w6l2"],
    competency: "Solve problems involving rates (for example speed)",
    items: () => {
      const dist = (s: number, t: number, cog: Cognitive = "PROCEDURAL") =>
        numeric(`A car travels at ${s} km/h for ${t} hours. How far does it travel, in kilometers?`, s * t, `Distance = speed × time = ${s} × ${t} = ${num(s * t)} km.`, cog);
      const time = (d: number, s: number, cog: Cognitive = "PROCEDURAL") =>
        numeric(`How many hours does it take to travel ${d} km at ${s} km/h?`, d / s, `Time = distance ÷ speed = ${d} ÷ ${s} = ${fmt(d / s)} hours.`, cog);
      const speed = (d: number, t: number, cog: Cognitive = "PROCEDURAL") =>
        numeric(`A bus travels ${d} km in ${t} hours. What is its speed in km/h?`, d / t, `Speed = distance ÷ time = ${d} ÷ ${t} = ${fmt(d / t)} km/h.`, cog);
      const work = (earn: number, h1: number, h2: number, cog: Cognitive = "APPLICATION") =>
        numeric(
          `A worker earns ${peso(earn)} for ${h1} hours. At the same rate, how much is earned in ${h2} hours? (Answer in pesos, without the ₱ sign.)`,
          (earn / h1) * h2,
          `Rate = ${num(earn)} ÷ ${h1} = ${num(earn / h1)} per hour. ${num(earn / h1)} × ${h2} = ${num((earn / h1) * h2)}.`,
          cog
        );
      return [
        dist(45, 2),
        time(120, 60),
        tf("Speed = distance ÷ time.", true, "Speed is the distance traveled in one unit of time."),
        speed(150, 2.5),
        mc(
          "w6l3-5",
          "Which formula gives distance?",
          "Distance = speed × time",
          [
            ["Distance = speed ÷ time", "Dividing speed by time does not give a distance."],
            ["Distance = time ÷ speed", "That gives the time for one unit of distance."],
            ["Distance = speed + time", "Speed and time are multiplied."],
          ],
          "Distance = speed × time."
        ),
        dist(60, 3),

        time(100, 40),
        speed(240, 4),
        work(350, 2, 5),
        numeric("A motorcycle travels 180 km using 4 liters of gasoline. How many km can it travel on 7 liters?", 315, "Rate = 180 ÷ 4 = 45 km per liter. 45 × 7 = 315 km.", "APPLICATION"),
        mc(
          "w6l3-11",
          "A jeepney travels at 40 km/h. How far does it go in 3 hours?",
          "120 km",
          [
            ["13.3 km", "That divides 40 by 3. Distance = speed × time."],
            ["43 km", "That adds 40 and 3. Distance = speed × time."],
            ["80 km", "That is the distance for 2 hours."],
          ],
          "40 × 3 = 120 km."
        ),
        tf("A car that goes 90 km in 2 hours has a speed of 45 km/h.", true, "90 ÷ 2 = 45 km/h."),

        work(640, 8, 5),
        numeric("Maria walks 6 km in 90 minutes. At the same speed, how many km does she walk in 2 hours?", 8, "90 minutes is 1.5 hours. Speed = 6 ÷ 1.5 = 4 km/h. Distance in 2 hours = 8 km.", "APPLICATION"),
        mc(
          "w6l3-15",
          "Two cars race 120 km. Car A drives at 60 km/h and car B at 80 km/h. How much sooner does car B arrive?",
          "30 minutes",
          [
            ["20 minutes", "Car A takes 2 hours and car B takes 1.5 hours. The difference is 0.5 hour."],
            ["1 hour", "The difference is 2 − 1.5 = 0.5 hour."],
            ["0.5 minute", "0.5 is in hours, which is 30 minutes."],
          ],
          "Car A takes 120 ÷ 60 = 2 hours, car B takes 120 ÷ 80 = 1.5 hours. The difference is 0.5 hour = 30 minutes.",
          "HIGHER_ORDER"
        ),
        numeric("A tank holds 40 liters. A car uses 1 liter for every 12 km. How far can it travel on a full tank, in km?", 480, "Distance = 12 × 40 = 480 km.", "APPLICATION"),
        tf("If you double your speed, you travel the same distance in half the time.", true, "Time = distance ÷ speed, so doubling the speed halves the time.", "HIGHER_ORDER"),
        speed(135, 1.5, "APPLICATION"),
      ];
    },
  },

  // =============================================================== WEEK 7
  {
    code: "w7l1",
    lessonId: "lsn_g7q1_w7_l1",
    title: "Write rational numbers as fractions, decimals and percentages",
    description: "Change a rational number from one form to another.",
    difficulty: 2.0,
    prerequisites: [],
    competency: "Describe given rational numbers as fractions, decimals, or percentages",
    items: () => {
      const frac = (n: number, d: number) => `${n}/${d}`;
      const toDec = (n: number, d: number, cog: Cognitive = "PROCEDURAL") =>
        numeric(`Write ${frac(n, d)} as a decimal.`, n / d, `${n} ÷ ${d} = ${fmt(n / d)}.`, cog);
      const decToPct = (x: number, cog: Cognitive = "PROCEDURAL") =>
        numeric(`Write ${x} as a percentage. (Answer without the % sign.)`, x * 100, `${x} × 100% = ${pct(x * 100)}.`, cog);
      const pctToDec = (p: number, cog: Cognitive = "PROCEDURAL") =>
        numeric(`Write ${p}% as a decimal.`, p / 100, `${p}% = ${p} ÷ 100 = ${fmt(p / 100)}.`, cog);
      const fracToPct = (n: number, d: number, cog: Cognitive = "PROCEDURAL") =>
        numeric(`Write ${frac(n, d)} as a percentage. (Answer without the % sign.)`, (n / d) * 100, `${n} ÷ ${d} = ${fmt(n / d)}, and ${fmt(n / d)} × 100% = ${pct((n / d) * 100)}.`, cog);
      return [
        toDec(3, 5),
        decToPct(0.45),
        tf("0.75 and 75% are two forms of the same number.", true, "0.75 × 100% = 75%."),
        mc(
          "w7l1-4",
          "What is 60% as a fraction in simplest form?",
          "3/5",
          [
            ["6/10", "6/10 is correct but not in simplest form. Divide both by 2."],
            ["6/5", "60% is 60 out of 100, not 6 out of 5."],
            ["1/6", "60% is more than one half."],
          ],
          "60% = 60/100 = 3/5."
        ),
        toDec(1, 4),
        pctToDec(35),

        fracToPct(2, 5),
        toDec(7, 20),
        decToPct(0.125),
        mc(
          "w7l1-10",
          "What is 35% as a fraction in simplest form?",
          "7/20",
          [
            ["35/10", "35% is 35 out of 100, not out of 10."],
            ["3/5", "3/5 is 60%."],
            ["7/10", "7/10 is 70%."],
          ],
          "35% = 35/100 = 7/20."
        ),
        fracToPct(3, 20),
        tf("1/8 equals 12.5%.", true, "1 ÷ 8 = 0.125, and 0.125 × 100% = 12.5%."),

        fracToPct(7, 25, "APPLICATION"),
        numeric("A test has 40 items and a student gets 34 right. What percentage is correct? (Answer without the % sign.)", 85, "34 ÷ 40 = 0.85, and 0.85 × 100% = 85%.", "APPLICATION"),
        mc(
          "w7l1-15",
          "In a class of 25 students, 10 are boys. Which shows the boys as a rational number in three forms?",
          "2/5 = 0.4 = 40%",
          [
            ["10/25 = 0.04 = 4%", "10 ÷ 25 = 0.4, not 0.04."],
            ["2/5 = 0.25 = 25%", "2/5 is 0.4, not 0.25."],
            ["1/10 = 0.1 = 10%", "10 out of 25 is not 1 out of 10."],
          ],
          "10/25 = 2/5 = 0.4 = 40%.",
          "APPLICATION"
        ),
        numeric("Write 5/8 as a decimal.", 0.625, "5 ÷ 8 = 0.625.", "PROCEDURAL"),
        tf("2/3 is a rational number even though its decimal 0.666... does not end.", true, "A rational number can be written as a fraction. Its decimal may repeat.", "HIGHER_ORDER"),
        decToPct(0.06, "APPLICATION"),
      ];
    },
  },

  {
    code: "w7l2",
    lessonId: "lsn_g7q1_w7_l2",
    title: "Order rational numbers on a number line",
    description: "Place rational numbers on a number line and put them in order.",
    difficulty: 2.5,
    prerequisites: ["w7l1"],
    competency: "Order rational numbers on a number line",
    items: () => [
      mc(
        "w7l2-1",
        "Which is greater, 3/4 or 0.7?",
        "3/4",
        [
          ["0.7", "3/4 = 0.75, which is more than 0.70."],
          ["They are equal", "3/4 = 0.75, not 0.70."],
          ["It cannot be told", "Write both as decimals to compare."],
        ],
        "3/4 = 0.75 and 0.75 > 0.70."
      ),
      tf("On a number line, the number to the right is greater.", true, "Numbers increase from left to right."),
      numeric("What is the decimal for 1/2 on a number line between 0 and 1?", 0.5, "1 ÷ 2 = 0.5, which is the middle of the line."),
      mc(
        "w7l2-4",
        "Which is the least: 0.4, 1/2 or 0.45?",
        "0.4",
        [
          ["1/2", "1/2 = 0.5, the greatest of the three."],
          ["0.45", "0.45 is greater than 0.4."],
          ["They are equal", "The three numbers are different."],
        ],
        "0.4 < 0.45 < 0.5."
      ),
      tf("1/4 is to the left of 0.5 on a number line.", true, "1/4 = 0.25 and 0.25 < 0.5."),
      mc(
        "w7l2-6",
        "How can you compare a fraction and a decimal easily?",
        "Write both in the same form, such as decimals",
        [
          ["Compare the numerators only", "Different denominators make that unreliable."],
          ["Compare the denominators only", "That ignores the numerators."],
          ["Choose the longer number", "Length does not decide the size."],
        ],
        "Writing both as decimals lets you compare directly."
      ),

      mc(
        "w7l2-7",
        "Which is the greatest: 0.6, 5/8 or 60.5%?",
        "5/8",
        [
          ["0.6", "0.6 is less than 0.625."],
          ["60.5%", "60.5% = 0.605, which is less than 0.625."],
          ["They are equal", "They are 0.6, 0.625 and 0.605."],
        ],
        "5/8 = 0.625 is the greatest."
      ),
      mc(
        "w7l2-8",
        "Which is the least: 3/8, 0.35 or 36%?",
        "0.35",
        [
          ["3/8", "3/8 = 0.375, the greatest of the three."],
          ["36%", "36% = 0.36, which is more than 0.35."],
          ["They are equal", "They are 0.375, 0.35 and 0.36."],
        ],
        "0.35 < 0.36 < 0.375."
      ),
      mc(
        "w7l2-9",
        "Which list is in order from least to greatest?",
        "0.3, 2/5, 1/2, 0.75",
        [
          ["2/5, 0.3, 1/2, 0.75", "0.3 is less than 2/5 (0.4), so 0.3 comes first."],
          ["0.75, 1/2, 2/5, 0.3", "That list is from greatest to least."],
          ["0.3, 1/2, 2/5, 0.75", "2/5 = 0.4 is less than 1/2 = 0.5."],
        ],
        "In decimals: 0.3, 0.4, 0.5, 0.75."
      ),
      numeric("On a number line from 0 to 1 split into 4 equal parts, what decimal is at the third mark?", 0.75, "The marks are at 0.25, 0.5 and 0.75, so the third mark is 0.75."),
      tf("0.6 is greater than 5/8.", false, "5/8 = 0.625, and 0.625 > 0.6.", "PROCEDURAL"),
      mc(
        "w7l2-12",
        "Which number lies between 0.4 and 0.5?",
        "0.45",
        [
          ["0.35", "0.35 is less than 0.4."],
          ["0.55", "0.55 is greater than 0.5."],
          ["0.5", "0.5 is the right end, not between."],
        ],
        "0.4 < 0.45 < 0.5."
      ),

      mc(
        "w7l2-13",
        "Arrange 7/10, 65% and 0.68 from greatest to least.",
        "7/10, 0.68, 65%",
        [
          ["65%, 0.68, 7/10", "That is from least to greatest."],
          ["0.68, 7/10, 65%", "7/10 = 0.7 is greater than 0.68."],
          ["7/10, 65%, 0.68", "0.68 is greater than 0.65."],
        ],
        "In decimals: 0.7, 0.68, 0.65.",
        "APPLICATION"
      ),
      mc(
        "w7l2-14",
        "Ana ran 3/5 of a trail, Ben ran 0.55 of it and Carl ran 58%. Who ran the farthest?",
        "Ana",
        [
          ["Ben", "0.55 is less than 0.6."],
          ["Carl", "58% = 0.58, which is less than 0.6."],
          ["They ran the same", "They ran 0.6, 0.55 and 0.58."],
        ],
        "3/5 = 0.6 is the greatest.",
        "APPLICATION"
      ),
      numeric("Which decimal is halfway between 0.2 and 0.4 on a number line?", 0.3, "(0.2 + 0.4) ÷ 2 = 0.3.", "HIGHER_ORDER"),
      mc(
        "w7l2-16",
        "Between which two numbers does 5/8 lie on a number line?",
        "0.6 and 0.7",
        [
          ["0.5 and 0.6", "5/8 = 0.625, which is more than 0.6."],
          ["0.7 and 0.8", "5/8 = 0.625, which is less than 0.7."],
          ["0.4 and 0.5", "5/8 = 0.625 is well above 0.5."],
        ],
        "0.6 < 0.625 < 0.7.",
        "HIGHER_ORDER"
      ),
      tf("1/3 is greater than 0.33.", true, "1/3 = 0.3333..., which is greater than 0.33.", "HIGHER_ORDER"),
      numeric("A recipe needs 3/4 cup of sugar and a student measures 0.7 cup. How much more sugar is needed, in cups?", 0.05, "3/4 = 0.75. 0.75 − 0.7 = 0.05.", "APPLICATION"),
    ],
  },
];

export const TIER_DIFFICULTY: Record<Tier, "EASY" | "MEDIUM" | "HARD"> = {
  basic: "EASY",
  mixed: "MEDIUM",
  challenge: "HARD",
};

export function tierOf(index: number): Tier {
  return index < 6 ? "basic" : index < 12 ? "mixed" : "challenge";
}
