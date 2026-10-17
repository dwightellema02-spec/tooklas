/**
 * Which illustration goes where in the Term 1 lessons. The pictures themselves are drawn by
 * scripts/generate-illustrations.ts into public/illustrations/<file>.svg.
 *
 * `after` is the title of the lesson block (without its number) that the figure follows.
 */

export interface LessonFigure {
  /** Title of the block (without its leading number) that this figure is placed after. */
  after: string;
  /** File name in public/illustrations, without ".svg". */
  file: string;
  title: string;
  alt: string;
  caption: string;
}

const fig = (after: string, file: string, title: string, alt: string, caption: string): LessonFigure => ({ after, file, title, alt, caption });

export interface LessonExplorer {
  after: string;
  slug: string;
  title: string;
  /** One line telling the student what to try. */
  hint: string;
  /** Block metadata: { model, ...settings }, see src/components/lesson/interactive/LessonExplorers.tsx */
  metadata: Record<string, unknown>;
}

const exp = (after: string, slug: string, title: string, hint: string, metadata: Record<string, unknown>): LessonExplorer => ({ after, slug, title, hint, metadata });

export const LESSON_EXPLORERS: Record<string, LessonExplorer[]> = {
  lsn_g7q1_w2_l2: [
    exp(
      "Linear pairs and vertical angles",
      "angle-pairs",
      "Try it: angle pairs",
      "Switch between the three pairs and drag the slider. Which pair always adds up to 180°? Which pair is always equal? Which adds up to 90°?",
      { model: "angle-pairs" }
    ),
  ],
  lsn_g7q1_w3_l3: [
    exp(
      "Sum of the angles of a polygon",
      "polygon-explorer",
      "Try it: sum of the angles",
      "Change the number of sides. How many triangles fit inside? Check that the sum of the angles is always (n − 2) × 180°.",
      { model: "polygon-explorer" }
    ),
  ],
  lsn_g7q1_w3_l4: [
    exp(
      "Regular polygons",
      "polygon-explorer",
      "Try it: each angle of a regular polygon",
      "Change the number of sides. Watch the exterior angle (360° ÷ n) shrink while the interior angle grows. Do they always add up to 180°?",
      { model: "polygon-explorer" }
    ),
  ],
  lsn_g7q1_w4_l1: [
    exp(
      "Measuring an increase with percentages",
      "percent-change",
      "Try it: percentage increase",
      "Change the original amount and the percent. Does the percent change if only the original amount changes?",
      { model: "percent-change", mode: "increase", original: 200, percent: 40 }
    ),
  ],
  lsn_g7q1_w4_l2: [
    exp(
      "Measuring a decrease with percentages",
      "percent-change",
      "Try it: percentage decrease",
      "Change the original amount and the percent. The percent is always taken from the ORIGINAL amount.",
      { model: "percent-change", mode: "decrease", original: 500, percent: 20 }
    ),
  ],
  lsn_g7q1_w4_l3: [
    exp(
      "Discount and sale price",
      "percent-change",
      "Try it: discount and sale price",
      "Move the discount rate. The sale price is the original price minus the discount.",
      { model: "percent-change", mode: "decrease", original: 800, percent: 25, labels: { original: "Original price", change: "Discount", result: "Sale price" } }
    ),
  ],
  lsn_g7q1_w6_l2: [
    exp(
      "Unit rate",
      "unit-rate",
      "Try it: unit rate",
      "Change the total price and the number of kilograms. The price for ONE kilogram is the unit rate: divide the total by the quantity.",
      { model: "unit-rate", unit: "kg", quantity: 3, total: 120 }
    ),
  ],
  lsn_g7q1_w7_l1: [
    exp(
      "Changing forms",
      "hundred-grid",
      "Try it: fraction, decimal and percent",
      "Slide to shade squares. Every picture is one rational number written as a fraction, a decimal and a percent.",
      { model: "hundred-grid" }
    ),
  ],
};

export const LESSON_FIGURES: Record<string, LessonFigure[]> = {
  // ---------------------------------------------------------------- Week 1
  lsn_g7q1_w1_l1: [
    fig(
      "What is a polygon?",
      "poly-vs-not",
      "Polygon or not?",
      "One closed figure with straight sides is a polygon. An open zigzag, a figure with a curved side and a figure whose sides cross are not polygons.",
      "Only the first figure is a polygon: it is closed and every side is straight. Look at why each of the others fails."
    ),
    fig(
      "Naming a polygon and its parts",
      "polygon-parts",
      "The parts of triangle ABC",
      "Triangle ABC with vertices A, B and C, sides AB, BC and AC, and the interior angles at A, B and C.",
      "Vertices are the corners, sides join the vertices, and each interior angle sits at a vertex."
    ),
    fig(
      "Naming polygons by their sides",
      "polygon-names",
      "Polygons from 3 to 10 sides",
      "Regular polygons with 3 to 10 sides: triangle, quadrilateral, pentagon, hexagon, heptagon, octagon, nonagon and decagon.",
      "Count the sides to name the polygon. The number of sides, vertices and interior angles is always the same."
    ),
  ],
  lsn_g7q1_w1_l2: [
    fig(
      "Regular and irregular polygons",
      "regular-vs-irregular",
      "Regular or irregular?",
      "A regular pentagon with five equal sides and five 108 degree angles, next to an irregular pentagon whose sides and angles differ.",
      "A polygon is regular only when all its sides AND all its angles are equal."
    ),
    fig(
      "Angles of the regular polygons",
      "regular-angles",
      "Angles of regular polygons",
      "A regular pentagon, hexagon, octagon and decagon with each interior angle: 108, 120, 135 and 144 degrees.",
      "As the number of sides grows, each interior angle gets bigger."
    ),
  ],
  lsn_g7q1_w1_l3: [
    fig(
      "What you need",
      "protractor",
      "Reading a protractor",
      "A protractor with its center on the vertex and one ray crossing the scale at 50 degrees.",
      "Put the center on the vertex, line up one side with 0°, and read the number where the other side crosses the scale."
    ),
    fig(
      "Worked example: Drawing a regular hexagon",
      "draw-regular-polygon",
      "Marking points around the center",
      "A regular pentagon with points every 72 degrees around a circle, and a regular hexagon with points every 60 degrees where each side equals the radius.",
      "Divide 360° by the number of sides to find the angle at the center, then mark a point every time."
    ),
    fig(
      "Angles in triangles and quadrilaterals",
      "angle-sums",
      "Angle sums",
      "A triangle whose angles a, b and c add up to 180 degrees, and a quadrilateral whose angles a, b, c and d add up to 360 degrees.",
      "Use these totals to check a drawing."
    ),
    fig(
      "Worked example: A triangle with given angles",
      "draw-triangle",
      "Drawing the triangle step by step",
      "Triangle ABC with AB equal to 5 centimeters, angle A of 50 degrees, angle B of 60 degrees and angle C of 70 degrees, with the drawing steps listed.",
      "Follow the five steps. The third angle comes out as 70°, as the sum rule says."
    ),
    fig(
      "Worked example: A quadrilateral with given angles",
      "draw-quadrilateral",
      "Drawing the quadrilateral step by step",
      "Quadrilateral ABCD with AB equal to 6 centimeters, AD equal to 4 centimeters, right angles at A and B, 100 degrees at D and 80 degrees at C, with the drawing steps listed.",
      "Two right angles give two parallel sides to start from. The last angle is 80°."
    ),
  ],

  // ---------------------------------------------------------------- Week 2
  lsn_g7q1_w2_l1: [
    fig(
      "Convex and non-convex polygons",
      "convex-vs-concave",
      "Convex or non-convex?",
      "A convex pentagon where a line between two inside points stays inside, and a non-convex arrowhead with one angle greater than 180 degrees where a line can leave the shape.",
      "In a convex polygon every angle is less than 180°. A non-convex polygon has at least one angle greater than 180°."
    ),
    fig(
      "Three ways to classify",
      "classify-three-ways",
      "Classify in three ways",
      "A regular convex hexagon and an irregular non-convex quadrilateral, each described by number of sides, regular or irregular, and convex or non-convex.",
      "Ask three questions about every polygon: how many sides? regular or irregular? convex or non-convex?"
    ),
  ],
  lsn_g7q1_w2_l2: [
    fig(
      "Angle pairs",
      "complementary",
      "Complementary angles",
      "A right angle split into 35 degrees and 55 degrees, which are complementary angles that add up to 90 degrees.",
      "Complementary angles add up to 90°."
    ),
    fig(
      "Angle pairs",
      "adjacent-angles",
      "Adjacent angles",
      "Two angles of 40 degrees and 65 degrees that share a vertex and one common side without overlapping.",
      "Adjacent angles share a vertex and a side and do not overlap."
    ),
    fig(
      "Linear pairs and vertical angles",
      "linear-pair",
      "A linear pair",
      "Two adjacent angles of 110 degrees and 70 degrees that form a straight line and add up to 180 degrees.",
      "A linear pair makes a straight line, so the two angles are supplementary: they add up to 180°."
    ),
    fig(
      "Linear pairs and vertical angles",
      "vertical-angles",
      "Vertical angles",
      "Two lines cross and make opposite angles that are equal: two of 64 degrees and two of 116 degrees.",
      "Vertical angles are opposite each other, and they are always equal."
    ),
  ],

  // ---------------------------------------------------------------- Week 3
  lsn_g7q1_w3_l1: [
    fig(
      "Interior and exterior angles",
      "interior-exterior",
      "Interior and exterior angle",
      "A pentagon with one side extended past a vertex. The angle inside is the interior angle and the angle between the extension and the next side is the exterior angle.",
      "Extend one side past a vertex. The angle between that extension and the next side is the exterior angle."
    ),
  ],
  lsn_g7q1_w3_l2: [
    fig(
      "The relationship",
      "ext-int-180",
      "Exterior plus interior is 180°",
      "At a vertex the interior angle of 80 degrees and the exterior angle of 100 degrees lie along a straight line and add up to 180 degrees.",
      "They form a linear pair, so an exterior angle and its adjacent interior angle always add up to 180°."
    ),
  ],
  lsn_g7q1_w3_l3: [
    fig(
      "Sum of the angles of a polygon",
      "polygon-triangles",
      "Cut the polygon into triangles",
      "A pentagon cut into 3 triangles, so its angles add up to 540 degrees, and a hexagon cut into 4 triangles, so its angles add up to 720 degrees.",
      "From one vertex you can draw (n − 2) triangles. Each triangle has 180°, so the sum is (n − 2) × 180°."
    ),
  ],
  lsn_g7q1_w3_l4: [
    fig(
      "Regular polygons",
      "exterior-sum",
      "Exterior angles make a full turn",
      "A hexagon with one exterior angle marked at each vertex. All six exterior angles together make one full turn of 360 degrees.",
      "The exterior angles of any polygon add up to 360°. In a regular polygon they are all equal, so each is 360° ÷ n."
    ),
    fig(
      "Worked example: Regular octagon",
      "regular-octagon",
      "Angles of a regular octagon",
      "A regular octagon with each exterior angle 45 degrees, each interior angle 135 degrees and each angle at the center 45 degrees.",
      "Exterior angle 360° ÷ 8 = 45°. Interior angle 180° − 45° = 135°."
    ),
  ],

  // ---------------------------------------------------------------- Week 4
  lsn_g7q1_w4_l1: [
    fig(
      "Measuring an increase with percentages",
      "percent-increase",
      "A percentage increase",
      "A bar for the original 200 pesos is 100 percent. The new bar is the same plus 80 pesos, which is 40 percent of the original.",
      "Compare the extra amount with the ORIGINAL amount: 80 ÷ 200 = 40%."
    ),
  ],
  lsn_g7q1_w4_l2: [
    fig(
      "Measuring a decrease with percentages",
      "percent-decrease",
      "A percentage decrease",
      "A bar for the original 500 pesos is 100 percent. The new bar is 400 pesos and the missing 100 pesos is 20 percent of the original.",
      "Compare the amount taken away with the ORIGINAL amount: 100 ÷ 500 = 20%."
    ),
  ],
  lsn_g7q1_w4_l3: [
    fig(
      "Discount and sale price",
      "discount-bar",
      "Discount and sale price",
      "An 800 peso price is 100 percent. A 25 percent discount takes off 200 pesos and the sale price is 600 pesos, which is 75 percent.",
      "Sale price = original price − discount. A 25% discount means you pay 75%."
    ),
  ],
  lsn_g7q1_w4_l4: [
    fig(
      "Commission and sales tax",
      "tax-commission",
      "Sales tax and commission",
      "A price of 25,000 pesos plus 12 percent tax of 3,000 pesos is 28,000 pesos. Sales of 45,000 pesos at 8 percent commission earn 3,600 pesos.",
      "Tax is added on top of the price. Commission is a percent of the sales."
    ),
  ],
  lsn_g7q1_w4_l5: [
    fig(
      "Simple interest",
      "simple-interest",
      "Simple interest year by year",
      "5,000 pesos at 4 percent simple interest earns 200 pesos each year and grows to 5,200, 5,400 and 5,600 pesos in three years.",
      "Simple interest is always figured on the original principal, so the same amount is earned every year."
    ),
  ],

  // ---------------------------------------------------------------- Week 5
  lsn_g7q1_w5_l1: [
    fig(
      "A plan in percentages",
      "budget-bar",
      "A budget as a bar",
      "A 150 peso daily allowance shown as a bar split into food 50 percent, transportation 20 percent, savings 20 percent and other uses 10 percent.",
      "The parts of a plan add up to 100% of your income. Each part's amount = its percent × income."
    ),
  ],

  // ---------------------------------------------------------------- Week 6
  lsn_g7q1_w6_l1: [
    fig(
      "Rates and ratios",
      "rate-vs-ratio",
      "Rate or ratio?",
      "A ratio compares 3 boys to 5 girls, which are the same kind of thing. A rate compares 120 pesos for 3 kilograms, which are different units.",
      "A ratio compares quantities with the same unit. A rate compares quantities with different units."
    ),
  ],
  lsn_g7q1_w6_l2: [
    fig(
      "Unit rate",
      "unit-rate-doubleline",
      "A double number line",
      "Two number lines side by side: 0, 1, 2 and 3 kilograms line up with 0, 40, 80 and 120 pesos, so 1 kilogram costs 40 pesos.",
      "A unit rate is the amount for ONE unit. Divide: 120 ÷ 3 = 40 pesos for 1 kilogram."
    ),
  ],
  lsn_g7q1_w6_l3: [
    fig(
      "Speed is a rate",
      "distance-speed-time",
      "Distance, speed and time",
      "The D, S, T triangle: distance equals speed times time, speed equals distance divided by time, and time equals distance divided by speed. 60 kilometers per hour for 2 hours is 120 kilometers.",
      "Cover the letter you want to find. The other two show how to compute it."
    ),
  ],

  // ---------------------------------------------------------------- Week 7
  lsn_g7q1_w7_l1: [
    fig(
      "Changing forms",
      "hundred-grid",
      "One number, three forms",
      "A grid of 100 squares with 75 shaded shows that 3 over 4, 0.75 and 75 percent are the same number.",
      "75 of 100 squares are shaded: that is 3/4, 0.75 and 75%."
    ),
  ],
  lsn_g7q1_w7_l2: [
    fig(
      "The number line",
      "number-line-0-1",
      "Fractions and decimals on one line",
      "A number line from 0 to 1 with 0.3, 2/5, 1/2 and 3/4 marked in order from left to right.",
      "The number farther to the right is greater: 0.3 < 2/5 < 1/2 < 3/4."
    ),
  ],
};
