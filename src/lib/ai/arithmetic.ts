// Checks the arithmetic a student wrote out, for example "100+110+120+90 = 430".
// It only reports what can be computed. It never decides why the student made the slip.

export interface ArithmeticSlip {
  /** The student's expression, tidied, for example "100 + 110 + 120 + 90". */
  expression: string;
  claimed: number;
  actual: number;
}

const NUM = String.raw`\d+(?:[.,]\d+)?`;
// numbers joined by + - × x * ÷ /, optional parentheses, then "=" and the number the student claims
const EXPR = new RegExp(String.raw`(\(?\s*${NUM}(?:\s*[+\-−–×x*÷/]\s*\(?\s*${NUM}\s*\)?)+)\s*=\s*(-?${NUM})`, "gi");

function toNumber(raw: string): number {
  // "1,260" is a thousands separator, "2,5" is a decimal comma
  const t = /^\d{1,3}(,\d{3})+$/.test(raw) ? raw.replace(/,/g, "") : raw.replace(",", ".");
  return Number(t);
}

/** Tiny recursive-descent evaluator for + - * / and parentheses. Returns null when it cannot parse. */
function evaluate(expr: string): number | null {
  const s = expr
    .replace(/[−–]/g, "-")
    .replace(/([\d)])\s*[x×]\s*([\d(])/gi, "$1*$2")
    .replace(/÷/g, "/")
    .replace(/\s+/g, "");
  let i = 0;
  const peek = () => s[i];
  function number(): number | null {
    const m = /^\d+(?:[.,]\d+)?/.exec(s.slice(i));
    if (!m) return null;
    i += m[0].length;
    return toNumber(m[0]);
  }
  function factor(): number | null {
    if (peek() === "-") {
      i++;
      const v = factor();
      return v === null ? null : -v;
    }
    if (peek() === "(") {
      i++;
      const v = sum();
      if (v === null || peek() !== ")") return null;
      i++;
      return v;
    }
    return number();
  }
  function product(): number | null {
    let v = factor();
    while (v !== null && (peek() === "*" || peek() === "/")) {
      const op = s[i++];
      const r = factor();
      if (r === null) return null;
      if (op === "/" && r === 0) return null;
      v = op === "*" ? v * r : v / r;
    }
    return v;
  }
  function sum(): number | null {
    let v = product();
    while (v !== null && (peek() === "+" || peek() === "-")) {
      const op = s[i++];
      const r = product();
      if (r === null) return null;
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }
  const v = sum();
  return v !== null && i === s.length && Number.isFinite(v) ? v : null;
}

const balanced = (s: string) => {
  let d = 0;
  for (const c of s) {
    if (c === "(") d++;
    if (c === ")") d--;
    if (d < 0) return false;
  }
  return d === 0;
};

/** Finds written equations whose result does not match what the left side computes to. */
export function findArithmeticSlips(text: string): ArithmeticSlip[] {
  const slips: ArithmeticSlip[] = [];
  if (!text) return slips;
  EXPR.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = EXPR.exec(text))) {
    const left = m[1].trim();
    if (!balanced(left)) continue;
    const actual = evaluate(left);
    const claimed = toNumber(m[2]);
    if (actual === null || !Number.isFinite(claimed)) continue;
    // allow for rounding the student did on purpose, for example 0.333 versus 1/3
    if (Math.abs(actual - claimed) > Math.max(0.011, Math.abs(actual) * 0.0005)) {
      slips.push({ expression: left.replace(/\s*([+\-−–×x*÷/])\s*/gi, " $1 ").replace(/\s+/g, " "), claimed, actual });
    }
  }
  return slips;
}
