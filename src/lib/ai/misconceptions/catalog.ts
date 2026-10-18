// A catalog of common Grade 7 Term 1 misconceptions, written so that a computer can check them.
//
// Each entry says what a student who holds that idea would ANSWER on a question of a given shape. That is what makes
// the claim testable: an entry only counts as an explanation for a wrong answer when it predicts exactly that answer.
// Several entries often predict the same wrong answer (80 -> 100 answered "20" is both "reported the increase" and
// "divided by the new value"), which is why the system keeps ALTERNATIVES and picks a follow-up question on which the
// entries disagree.
//
// THIS CATALOG IS DRAFT CONTENT. It was written from the Term 1 question bank and common errors in the topic, and it has
// not been reviewed by a teacher. See docs/TUTOR_EDUCATOR_REVIEW.md. Every entry has an id so a reviewer can accept,
// change or remove it by id.

export interface MisconceptionEntry {
  id: string;
  /** Skill codes (the part after "skl_g7q1_") whose questions this entry applies to. */
  skills: string[];
  /** The idea the student may hold, for teachers (English). */
  belief: string;
  /** Short name for students and teachers. */
  name: { en: string; fil: string };
  /** A clear correction to teach, in the student's words. Never contains a final answer to a specific question. */
  correction: { en: string; fil: string };
  /** The answer this idea would give for a question, or null when the question is not of this shape. */
  predict: (prompt: string) => number | null;
}

// ---------------------------------------------------------------- reading numbers out of a question
export const normalizePrompt = (p: string) =>
  p
    .replace(/(\d),(?=\d{3}\b)/g, "$1")
    .replace(/[₱]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const POLYGON_SIDES: Record<string, number> = {
  triangle: 3, quadrilateral: 4, pentagon: 5, hexagon: 6, heptagon: 7, octagon: 8, nonagon: 9, decagon: 10,
};

/** Number of sides named in a question: "with 6 sides", "has 9 vertices" or a polygon name. */
export function sidesIn(p: string): number | null {
  const n = /\bwith (\d+) sides\b|\bhas (\d+) (?:sides|vertices)\b|\b(\d+)-sided\b|\b(\d+) sides\b/i.exec(p);
  if (n) return Number(n[1] || n[2] || n[3] || n[4]);
  const name = /\b(triangle|quadrilateral|pentagon|hexagon|heptagon|octagon|nonagon|decagon)\b/i.exec(p);
  return name ? POLYGON_SIDES[name[1].toLowerCase()] : null;
}

/** Numbers followed by a degree sign, in order. */
const degrees = (p: string): number[] => [...p.matchAll(/(\d+(?:\.\d+)?)\s*°/g)].map((m) => Number(m[1]));
/** The first number in the question that is not part of a word, in order. */
const numbers = (p: string): number[] => [...normalizePrompt(p).matchAll(/\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));

/** "from A to B" with a percentage question: [A, B, isIncrease]. */
function change(p: string): { a: number; b: number; up: boolean } | null {
  const q = normalizePrompt(p);
  if (!/percentage (increase|decrease)/i.test(q)) return null;
  const m = /from\s*(\d+(?:\.\d+)?)\s*to\s*(\d+(?:\.\d+)?)/i.exec(q);
  if (!m) return null;
  return { a: Number(m[1]), b: Number(m[2]), up: /percentage increase/i.test(q) };
}

/** "price of P increases/is reduced by p%" or "After a p% increase/decrease": [P, p, isIncrease]. */
function newPrice(p: string): { price: number; pct: number; up: boolean } | null {
  const q = normalizePrompt(p);
  if (!/(new price|how much is it)/i.test(q)) return null;
  const by = /(\d+(?:\.\d+)?)\s+(?:increases|rises|is increased|is reduced|decreases|falls)\s+by\s+(\d+(?:\.\d+)?)%/i.exec(q);
  if (by) return { price: Number(by[1]), pct: Number(by[2]), up: /increases|rises|is increased/i.test(q) };
  const after = /costs\s+(\d+(?:\.\d+)?).*?after a (\d+(?:\.\d+)?)% (increase|decrease)/i.exec(q);
  if (after) return { price: Number(after[1]), pct: Number(after[2]), up: after[3].toLowerCase() === "increase" };
  return null;
}

/** A discount/sale question with an original price and a rate: [P, p]. */
function priceAndRate(p: string): { price: number; pct: number } | null {
  const q = normalizePrompt(p);
  const m = /(\d+(?:\.\d+)?)\s+(?:item|shirt|bag)?[^.]*?(\d+(?:\.\d+)?)%/i.exec(q);
  if (!m) return null;
  return { price: Number(m[1]), pct: Number(m[2]) };
}

// ---------------------------------------------------------------- the entries
export const MISCONCEPTIONS: MisconceptionEntry[] = [
  // ======================================================= polygons and angle sums
  {
    id: "poly.sum.n-times-180",
    skills: ["w3l3", "w1l2"],
    belief: "Takes the angle sum of a polygon to be n × 180° (forgets to subtract 2 first).",
    name: { en: "uses n × 180° for the angle sum", fil: "gumagamit ng n × 180° sa kabuuan ng mga anggulo" },
    correction: {
      en: "The sum of the interior angles is (n − 2) × 180°. Drawing diagonals from one vertex cuts the polygon into (n − 2) triangles, and each triangle has 180°.",
      fil: "Ang kabuuan ng mga interior angle ay (n − 2) × 180°. Kapag gumuhit ka ng mga diagonal mula sa isang vertex, nahahati ang polygon sa (n − 2) na triangle, at 180° ang bawat triangle.",
    },
    predict: (p) => (/sum of the interior angles/i.test(p) && !/regular|each/i.test(p) ? (sidesIn(p) ? sidesIn(p)! * 180 : null) : null),
  },
  {
    id: "poly.sum.n-minus-1",
    skills: ["w3l3", "w1l2"],
    belief: "Uses (n − 1) × 180° for the angle sum.",
    name: { en: "uses (n − 1) × 180° for the angle sum", fil: "gumagamit ng (n − 1) × 180° sa kabuuan ng mga anggulo" },
    correction: {
      en: "Subtract 2, not 1: a polygon with n sides splits into (n − 2) triangles, so the sum is (n − 2) × 180°.",
      fil: "Ibawas ang 2, hindi 1: ang polygon na may n na gilid ay nahahati sa (n − 2) na triangle, kaya (n − 2) × 180° ang kabuuan.",
    },
    predict: (p) => (/sum of the interior angles/i.test(p) && !/regular|each/i.test(p) ? (sidesIn(p) ? (sidesIn(p)! - 1) * 180 : null) : null),
  },
  {
    id: "poly.sum.exterior-total",
    skills: ["w3l3", "w1l2"],
    belief: "Gives 360° as the sum of the interior angles, mixing it up with the sum of the exterior angles.",
    name: { en: "gives 360° (the exterior total) for the interior sum", fil: "360° ang sagot (kabuuan ng exterior) para sa interior" },
    correction: {
      en: "The exterior angles of any polygon add up to 360°. The interior angles add up to (n − 2) × 180°, which depends on the number of sides.",
      fil: "Laging 360° ang kabuuan ng mga exterior angle ng anumang polygon. Ang kabuuan ng mga interior angle ay (n − 2) × 180°, na depende sa bilang ng gilid.",
    },
    predict: (p) => (/sum of the interior angles/i.test(p) && !/regular|each|quadrilateral/i.test(p) && sidesIn(p) ? 360 : null),
  },
  {
    id: "poly.sides.from-sum-divide-only",
    skills: ["w3l3"],
    belief: "Finds the number of sides by dividing the angle sum by 180° and stops (forgets to add 2).",
    name: { en: "divides the angle sum by 180° and forgets to add 2", fil: "hinahati ang kabuuan sa 180° at nakakalimutang idagdag ang 2" },
    correction: {
      en: "Since the sum is (n − 2) × 180°, dividing by 180° gives n − 2. Add 2 to get n.",
      fil: "Dahil (n − 2) × 180° ang kabuuan, n − 2 ang makukuha kapag hinati sa 180°. Idagdag ang 2 para makuha ang n.",
    },
    predict: (p) => {
      const m = /interior angles that add up to (\d+(?:\.\d+)?)°?.*how many sides/i.exec(normalizePrompt(p));
      return m ? Number(m[1]) / 180 : null;
    },
  },

  // ======================================================= regular polygons
  {
    id: "poly.regular.interior-is-360-over-n",
    skills: ["w1l2", "w3l4"],
    belief: "Divides 360° by n to get each interior angle of a regular polygon (that is the exterior angle).",
    name: { en: "gives the exterior angle (360° ÷ n) for the interior angle", fil: "exterior angle (360° ÷ n) ang ibinibigay para sa interior" },
    correction: {
      en: "360° ÷ n is each EXTERIOR angle. Each interior angle is 180° minus the exterior angle, or (n − 2) × 180° ÷ n.",
      fil: "Ang 360° ÷ n ay ang bawat EXTERIOR angle. Ang bawat interior angle ay 180° bawas ang exterior angle, o (n − 2) × 180° ÷ n.",
    },
    predict: (p) => (/each interior angle/i.test(p) && /regular/i.test(p) && sidesIn(p) ? 360 / sidesIn(p)! : null),
  },
  {
    id: "poly.regular.exterior-gives-interior",
    skills: ["w3l4"],
    belief: "Gives the interior angle when asked for each exterior angle of a regular polygon.",
    name: { en: "gives the interior angle for the exterior angle", fil: "interior angle ang ibinibigay para sa exterior" },
    correction: {
      en: "Each exterior angle of a regular polygon is 360° ÷ n, because all the exterior angles together make one full turn of 360°.",
      fil: "Ang bawat exterior angle ng regular polygon ay 360° ÷ n, dahil ang lahat ng exterior angle ay bumubuo ng isang buong ikot na 360°.",
    },
    predict: (p) => (/each exterior angle/i.test(p) && /regular/i.test(p) && /how many sides/i.test(p) === false && sidesIn(p) ? ((sidesIn(p)! - 2) * 180) / sidesIn(p)! : null),
  },
  {
    id: "poly.regular.sides-from-interior-360",
    skills: ["w3l4"],
    belief: "Finds the number of sides from an interior angle by dividing 360° by that interior angle.",
    name: { en: "divides 360° by the interior angle to find the sides", fil: "hinahati ang 360° sa interior angle para hanapin ang gilid" },
    correction: {
      en: "360° ÷ angle works for the EXTERIOR angle. From an interior angle, first find the exterior angle (180° − interior), then divide 360° by it.",
      fil: "Gumagana ang 360° ÷ anggulo sa EXTERIOR angle. Kung interior angle ang ibinigay, hanapin muna ang exterior (180° − interior), saka hatiin ang 360° dito.",
    },
    predict: (p) => {
      const m = /each interior angle of a regular polygon is (\d+(?:\.\d+)?)°.*how many sides/i.exec(normalizePrompt(p));
      return m ? 360 / Number(m[1]) : null;
    },
  },

  // ======================================================= angles at a vertex and angle pairs
  {
    id: "angle.adjacent-int-ext.assumes-equal",
    skills: ["w3l2", "w3l4"],
    belief: "Thinks an exterior angle and its adjacent interior angle are equal.",
    name: { en: "assumes the interior and exterior angle are equal", fil: "inaakalang magkapantay ang interior at exterior angle" },
    correction: {
      en: "An exterior angle and its adjacent interior angle lie on a straight line, so they add up to 180°. They are equal only when both are 90°.",
      fil: "Ang exterior angle at ang katabing interior angle ay nasa isang tuwid na linya, kaya 180° ang kabuuan nila. Magkapantay lang sila kapag parehong 90°.",
    },
    predict: (p) => {
      const q = normalizePrompt(p);
      const m =
        /(?:exterior|interior) angle of a polygon (?:measures|is) (\d+(?:\.\d+)?)°.*adjacent (?:interior|exterior)/i.exec(q) ||
        /has an exterior angle of (\d+(?:\.\d+)?)°\. what is each interior angle/i.exec(q);
      return m ? Number(m[1]) : null;
    },
  },
  {
    id: "poly.missing.uses-360",
    skills: ["w3l3", "w2l1"],
    belief: "Subtracts the known angles from 360° whatever the polygon (treats every polygon like a quadrilateral).",
    name: { en: "subtracts from 360° instead of the polygon's angle sum", fil: "ibinabawas sa 360° sa halip na sa kabuuan ng polygon" },
    correction: {
      en: "360° is the angle sum of a quadrilateral only. Find this polygon's sum with (n − 2) × 180° first, then subtract the angles you know.",
      fil: "Para sa quadrilateral lang ang 360°. Hanapin muna ang kabuuan ng polygon na ito gamit ang (n − 2) × 180°, saka ibawas ang mga alam mong anggulo.",
    },
    predict: (p) => {
      if (!/(missing angle|sixth angle|fifth angle|fourth angle)/i.test(p)) return null;
      const n = sidesIn(p);
      const angles = degrees(p);
      // all the angles but one are given, and the polygon is not a quadrilateral (where 360° is right)
      if (!n || n === 4 || angles.length < 3 || angles.length !== n - 1) return null;
      return Math.abs(360 - angles.reduce((a, b) => a + b, 0));
    },
  },
  {
    id: "angle.complement.uses-180",
    skills: ["w2l2"],
    belief: "Mixes up complement and supplement: gives 180° − x for the complement.",
    name: { en: "uses 180° for the complement", fil: "gumagamit ng 180° sa complement" },
    correction: {
      en: "Complementary angles add up to 90°. Supplementary angles add up to 180°.",
      fil: "Ang complementary angles ay may kabuuang 90°. Ang supplementary angles ay may kabuuang 180°.",
    },
    predict: (p) => {
      const m = /complement of (\d+(?:\.\d+)?)°/i.exec(p);
      return m && !/supplement of the complement/i.test(p) ? 180 - Number(m[1]) : null;
    },
  },
  {
    id: "angle.supplement.uses-90",
    skills: ["w2l2"],
    belief: "Mixes up supplement and complement: gives 90° − x for the supplement.",
    name: { en: "uses 90° for the supplement", fil: "gumagamit ng 90° sa supplement" },
    correction: {
      en: "Supplementary angles add up to 180° (a straight line). Complementary angles add up to 90°.",
      fil: "Ang supplementary angles ay may kabuuang 180° (tuwid na linya). Ang complementary angles ay may kabuuang 90°.",
    },
    predict: (p) => {
      const m = /supplement of (\d+(?:\.\d+)?)°/i.exec(p);
      return m && !/supplement of the complement/i.test(p) ? 90 - Number(m[1]) : null;
    },
  },
  {
    id: "angle.vertical.uses-supplement",
    skills: ["w2l2"],
    belief: "Confuses vertical angles with adjacent angles: gives 180° − x for the vertical angle.",
    name: { en: "gives the supplement for the vertical angle", fil: "supplement ang ibinibigay para sa vertical angle" },
    correction: {
      en: "Vertical angles are opposite each other and are EQUAL. The angles next to an angle (adjacent, in a linear pair) add up with it to 180°.",
      fil: "Ang vertical angles ay magkatapat at PANTAY. Ang mga katabing anggulo (linear pair) ay may kabuuang 180° kasama ang anggulo.",
    },
    predict: (p) => {
      const m = /one angle is (\d+(?:\.\d+)?)°.*(?:angle vertical to it)/i.exec(p);
      return m ? 180 - Number(m[1]) : null;
    },
  },
  {
    id: "angle.triangle.third.uses-360",
    skills: ["w1l3", "w3l2"],
    belief: "Uses 360° instead of 180° for the angles of a triangle.",
    name: { en: "uses 360° for a triangle's angles", fil: "gumagamit ng 360° sa mga anggulo ng triangle" },
    correction: {
      en: "The three angles of a triangle add up to 180°. The four angles of a quadrilateral add up to 360°.",
      fil: "Ang tatlong anggulo ng triangle ay may kabuuang 180°. Ang apat na anggulo ng quadrilateral ay may kabuuang 360°.",
    },
    predict: (p) => {
      if (!/third (interior )?angle/i.test(p) || /exterior angle next/i.test(p)) return null;
      const a = degrees(p);
      return a.length === 2 ? 360 - a[0] - a[1] : null;
    },
  },

  // ======================================================= percentage change
  {
    id: "pct.change.reports-amount",
    skills: ["w4l1", "w4l2"],
    belief: "Gives the amount of the increase or decrease (new − original) as the percentage.",
    name: { en: "gives the amount of change instead of the percent", fil: "ang halaga ng pagbabago ang ibinibigay sa halip na porsyento" },
    correction: {
      en: "The change (new − original) is an amount. To make it a percent, divide it by the ORIGINAL value and multiply by 100.",
      fil: "Ang pagbabago (bago − orihinal) ay halaga. Para maging porsyento, hatiin ito sa ORIHINAL na halaga at i-multiply sa 100.",
    },
    predict: (p) => {
      const c = change(p);
      return c ? Math.abs(c.b - c.a) : null;
    },
  },
  {
    id: "pct.change.divides-by-new",
    skills: ["w4l1", "w4l2"],
    belief: "Divides the change by the NEW value instead of the original value.",
    name: { en: "divides the change by the new value", fil: "hinahati ang pagbabago sa bagong halaga" },
    correction: {
      en: "A percentage change always compares the change with the ORIGINAL value, the starting point, not with the new one.",
      fil: "Ang porsyento ng pagbabago ay laging inihahambing sa ORIHINAL na halaga, ang panimulang punto, hindi sa bago.",
    },
    predict: (p) => {
      const c = change(p);
      return c && c.b !== 0 ? (Math.abs(c.b - c.a) / c.b) * 100 : null;
    },
  },
  {
    id: "pct.change.forgets-times-100",
    skills: ["w4l1", "w4l2"],
    belief: "Divides the change by the original value but leaves the answer as a decimal (forgets × 100).",
    name: { en: "leaves the answer as a decimal (forgets × 100)", fil: "iniiwang decimal ang sagot (nakalimutan ang × 100)" },
    correction: {
      en: "Dividing the change by the original value gives a decimal. Multiply by 100 to write it as a percent.",
      fil: "Decimal ang makukuha kapag hinati ang pagbabago sa orihinal na halaga. I-multiply sa 100 para gawing porsyento.",
    },
    predict: (p) => {
      const c = change(p);
      return c && c.a !== 0 ? Math.abs(c.b - c.a) / c.a : null;
    },
  },

  // ======================================================= new price, discount, tax
  {
    id: "pct.newprice.adds-percent-as-amount",
    skills: ["w4l1", "w4l2"],
    belief: "Adds (or subtracts) the percent NUMBER itself to the price, as if it were pesos.",
    name: { en: "adds the percent number to the price as if it were pesos", fil: "idinadagdag ang numero ng porsyento sa presyo na parang piso" },
    correction: {
      en: "A percent is a part of the price. Find that part first (price × rate ÷ 100), then add it or subtract it.",
      fil: "Ang porsyento ay bahagi ng presyo. Hanapin muna ang bahaging iyon (presyo × rate ÷ 100), saka idagdag o ibawas.",
    },
    predict: (p) => {
      const n = newPrice(p);
      return n ? (n.up ? n.price + n.pct : n.price - n.pct) : null;
    },
  },
  {
    id: "pct.newprice.gives-only-change",
    skills: ["w4l1", "w4l2"],
    belief: "Stops after finding the percent of the price and gives that as the new price.",
    name: { en: "gives only the amount of change as the new price", fil: "ang halaga lang ng pagbabago ang ibinibigay bilang bagong presyo" },
    correction: {
      en: "The percent of the price is only the change. The new price is the original price plus the increase, or minus the decrease.",
      fil: "Ang porsyento ng presyo ay ang pagbabago lang. Ang bagong presyo ay orihinal na presyo kasama ang dagdag, o bawas ang tinanggal.",
    },
    predict: (p) => {
      const n = newPrice(p);
      return n ? (n.price * n.pct) / 100 : null;
    },
  },
  {
    id: "pct.newprice.wrong-direction",
    skills: ["w4l1", "w4l2"],
    belief: "Applies the change in the wrong direction (increases for a decrease or the other way round).",
    name: { en: "applies the change in the wrong direction", fil: "mali ang direksyon ng pagbabago (dagdag sa halip na bawas, o kabaligtaran)" },
    correction: {
      en: "Check the words: an increase makes the price larger (add), a decrease or reduction makes it smaller (subtract).",
      fil: "Basahin ang salita: ang increase ay nagpapalaki sa presyo (idagdag), ang decrease o reduction ay nagpapaliit (ibawas).",
    },
    predict: (p) => {
      const n = newPrice(p);
      return n ? (n.up ? n.price * (1 - n.pct / 100) : n.price * (1 + n.pct / 100)) : null;
    },
  },
  {
    id: "pct.discount.gives-sale-price",
    skills: ["w4l3"],
    belief: "Gives the sale price when asked for the amount of the discount.",
    name: { en: "gives the sale price when asked for the discount", fil: "sale price ang ibinibigay kapag discount ang tinatanong" },
    correction: {
      en: "The discount is the part taken off: original price × rate of discount. The sale price is what is left after that.",
      fil: "Ang discount ay ang bahaging tinanggal: orihinal na presyo × rate ng discount. Ang sale price ay ang natira pagkatapos nito.",
    },
    predict: (p) => {
      if (!/how much is the discount/i.test(p)) return null;
      const r = priceAndRate(p);
      return r ? r.price - (r.price * r.pct) / 100 : null;
    },
  },
  {
    id: "pct.sale.gives-discount",
    skills: ["w4l3"],
    belief: "Gives the amount of the discount when asked for the sale price.",
    name: { en: "gives the discount when asked for the sale price", fil: "discount ang ibinibigay kapag sale price ang tinatanong" },
    correction: {
      en: "The sale price is the original price minus the discount. Finding the discount is only the first step.",
      fil: "Ang sale price ay orihinal na presyo bawas ang discount. Ang paghahanap ng discount ay unang hakbang lang.",
    },
    predict: (p) => {
      if (!/sale price/i.test(p) || /original price|what was/i.test(p)) return null;
      const r = priceAndRate(p);
      return r ? (r.price * r.pct) / 100 : null;
    },
  },
  {
    id: "pct.original.adds-discount",
    skills: ["w4l3", "w4l4"],
    belief: "Finds the original price by adding the percent of the SALE price to it.",
    name: { en: "adds the percent of the given price to find the original", fil: "idinadagdag ang porsyento ng ibinigay na presyo para hanapin ang orihinal" },
    correction: {
      en: "After a 20% discount the student pays 80% of the original. So divide the sale price by 0.80. The same idea works for tax: total = 112% of the price.",
      fil: "Pagkatapos ng 20% na discount, 80% ng orihinal ang binabayaran. Kaya hatiin ang sale price sa 0.80. Ganito rin sa tax: 112% ng presyo ang total.",
    },
    predict: (p) => {
      const q = normalizePrompt(p);
      const m = /after a (\d+(?:\.\d+)?)% discount an item costs (\d+(?:\.\d+)?)\. what was the original price/i.exec(q);
      return m ? Number(m[2]) + (Number(m[2]) * Number(m[1])) / 100 : null;
    },
  },
  {
    id: "pct.total.gives-tax-only",
    skills: ["w4l4"],
    belief: "Gives only the sales tax when asked for the total cost.",
    name: { en: "gives the tax alone as the total cost", fil: "ang tax lang ang ibinibigay bilang total cost" },
    correction: {
      en: "Total cost = price + sales tax. The tax alone is only the extra part.",
      fil: "Total cost = presyo + sales tax. Ang tax lang ay ang dagdag na bahagi.",
    },
    predict: (p) => {
      const q = normalizePrompt(p);
      const m = /costs (\d+(?:\.\d+)?) before a (\d+(?:\.\d+)?)% sales tax\. what is the total cost/i.exec(q);
      return m ? (Number(m[1]) * Number(m[2])) / 100 : null;
    },
  },
  {
    id: "pct.of.forgets-divide-100",
    skills: ["w4l3", "w4l4", "w5l1"],
    belief: "Multiplies by the percent number without dividing by 100.",
    name: { en: "multiplies by the percent number (forgets ÷ 100)", fil: "minu-multiply sa numero ng porsyento (nakalimutan ang ÷ 100)" },
    correction: {
      en: "A percent means 'out of 100'. To find 12% of an amount, multiply by 12 and divide by 100, or multiply by 0.12.",
      fil: "Ang porsyento ay 'sa bawat 100'. Para sa 12% ng isang halaga, i-multiply sa 12 at hatiin sa 100, o i-multiply sa 0.12.",
    },
    predict: (p) => {
      const q = normalizePrompt(p);
      if (!/(how much is the (discount|commission|sales tax)|how much is that\?)/i.test(q) || !/%/.test(q)) return null;
      const n = numbers(q);
      return n.length === 2 ? n[0] * n[1] : null;
    },
  },

  // ======================================================= simple interest
  {
    id: "interest.forgets-time",
    skills: ["w4l5"],
    belief: "Ignores the number of years: I = P × r (as a decimal) only.",
    name: { en: "leaves out the number of years", fil: "hindi isinasama ang bilang ng taon" },
    correction: {
      en: "Simple interest is earned every year, so I = P × r × t. Multiply by the number of years.",
      fil: "Bawat taon ang kinikita ng simple interest, kaya I = P × r × t. I-multiply sa bilang ng taon.",
    },
    predict: (p) => {
      const m = /how much simple interest does (\d+(?:\.\d+)?) earn at (\d+(?:\.\d+)?)% per year in (\d+(?:\.\d+)?) years?/i.exec(normalizePrompt(p));
      return m ? (Number(m[1]) * Number(m[2])) / 100 : null;
    },
  },
  {
    id: "interest.forgets-percent",
    skills: ["w4l5"],
    belief: "Multiplies P × r × t using the rate as a whole number (forgets to write the percent as a decimal).",
    name: { en: "uses the rate as a whole number (forgets ÷ 100)", fil: "buong numero ang gamit na rate (nakalimutan ang ÷ 100)" },
    correction: {
      en: "Write the rate as a decimal first: 5% = 0.05. Then I = P × 0.05 × t.",
      fil: "Isulat muna ang rate bilang decimal: 5% = 0.05. Saka I = P × 0.05 × t.",
    },
    predict: (p) => {
      const m = /how much simple interest does (\d+(?:\.\d+)?) earn at (\d+(?:\.\d+)?)% per year in (\d+(?:\.\d+)?) years?/i.exec(normalizePrompt(p));
      return m ? Number(m[1]) * Number(m[2]) * Number(m[3]) : null;
    },
  },

  // ======================================================= budget
  {
    id: "budget.percent-left.sums",
    skills: ["w5l1"],
    belief: "Gives the total of the percents that are used instead of the percent that is left.",
    name: { en: "adds the percents but does not subtract from 100%", fil: "idinadagdag ang mga porsyento pero hindi ibinabawas sa 100%" },
    correction: {
      en: "The whole is 100%. Add the percents that are used, then subtract that total from 100% to find what is left.",
      fil: "100% ang kabuuan. Idagdag ang mga porsyentong nagamit, saka ibawas ang kabuuan sa 100% para makuha ang natira.",
    },
    predict: (p) => {
      const q = normalizePrompt(p);
      if (!/what percent is left/i.test(q)) return null;
      const parts = [...q.matchAll(/(\d+(?:\.\d+)?)%/g)].map((m) => Number(m[1]));
      return parts.length >= 2 ? parts.reduce((a, b) => a + b, 0) : null;
    },
  },

  // ======================================================= rates
  {
    id: "rate.unit.inverts",
    skills: ["w6l2"],
    belief: "Divides the second quantity by the first (upside down) when finding a unit rate.",
    name: { en: "divides upside down (second ÷ first)", fil: "baligtad ang paghahati (pangalawa ÷ una)" },
    correction: {
      en: "A rate 'A per B' means A ÷ B. For pesos per kilogram, divide the pesos by the kilograms.",
      fil: "Ang rate na 'A bawat B' ay A ÷ B. Para sa piso bawat kilo, hatiin ang piso sa kilo.",
    },
    predict: (p) => {
      const m = /^(\d+(?:\.\d+)?) \w+ for (\d+(?:\.\d+)?) \w+\. what is the rate in/i.exec(normalizePrompt(p));
      return m ? Number(m[2]) / Number(m[1]) : null;
    },
  },
  {
    id: "rate.distance.divides",
    skills: ["w6l3"],
    belief: "Divides speed by time to find distance.",
    name: { en: "divides speed by time to find the distance", fil: "hinahati ang bilis sa oras para hanapin ang layo" },
    correction: {
      en: "Distance = speed × time. In 2 hours at 45 km per hour you cover 45 km two times.",
      fil: "Layo = bilis × oras. Sa 2 oras na 45 km bawat oras, dalawang beses mong nilalakbay ang 45 km.",
    },
    predict: (p) => {
      const m = /travels at (\d+(?:\.\d+)?) km\/h for (\d+(?:\.\d+)?) hours\. how far/i.exec(normalizePrompt(p));
      return m ? Number(m[1]) / Number(m[2]) : null;
    },
  },
  {
    id: "rate.time.multiplies",
    skills: ["w6l3"],
    belief: "Multiplies distance by speed to find time.",
    name: { en: "multiplies distance and speed to find the time", fil: "minu-multiply ang layo at bilis para hanapin ang oras" },
    correction: {
      en: "Time = distance ÷ speed. Ask: how many 60-km pieces fit in 120 km?",
      fil: "Oras = layo ÷ bilis. Itanong: ilang piraso ng 60 km ang kasya sa 120 km?",
    },
    predict: (p) => {
      const m = /how many hours does it take to travel (\d+(?:\.\d+)?) km at (\d+(?:\.\d+)?) km\/h/i.exec(normalizePrompt(p));
      return m ? Number(m[1]) * Number(m[2]) : null;
    },
  },

  // ======================================================= rational numbers
  {
    id: "rational.frac-to-pct.forgets-times-100",
    skills: ["w7l1"],
    belief: "Divides the numerator by the denominator and stops (does not multiply by 100 to make a percentage).",
    name: { en: "leaves the fraction as a decimal (forgets × 100)", fil: "iniiwang decimal ang fraction (nakalimutan ang × 100)" },
    correction: {
      en: "Numerator ÷ denominator gives the decimal. Multiply by 100 to write it as a percentage.",
      fil: "Ang numerator ÷ denominator ay decimal. I-multiply sa 100 para gawing porsyento.",
    },
    predict: (p) => {
      const m = /write (\d+)\/(\d+) as a percentage/i.exec(p);
      return m ? Number(m[1]) / Number(m[2]) : null;
    },
  },
  {
    id: "rational.frac-to-dec.inverts",
    skills: ["w7l1"],
    belief: "Divides the denominator by the numerator when changing a fraction to a decimal.",
    name: { en: "divides the denominator by the numerator", fil: "hinahati ang denominator sa numerator" },
    correction: {
      en: "A fraction means numerator ÷ denominator. For 3/5, divide 3 by 5.",
      fil: "Ang fraction ay numerator ÷ denominator. Para sa 3/5, hatiin ang 3 sa 5.",
    },
    predict: (p) => {
      const m = /write (\d+)\/(\d+) as a decimal/i.exec(p);
      return m ? Number(m[2]) / Number(m[1]) : null;
    },
  },
];

export const MISCONCEPTION_BY_ID = new Map(MISCONCEPTIONS.map((m) => [m.id, m]));
