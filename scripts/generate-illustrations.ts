/**
 * Generates the lesson illustrations as SVG files in public/illustrations.
 *
 *   npx tsx scripts/generate-illustrations.ts
 *
 * Every figure is drawn from the numbers in the lesson (angles are computed from the coordinates, side
 * marks and arcs are placed by code), so the pictures match the mathematics exactly. Re-running the script
 * rewrites the files; nothing else is touched.
 */

import fs from "fs";
import path from "path";

const OUT = path.resolve(import.meta.dirname, "../public/illustrations");

// ------------------------------------------------------------------ palette and primitives
const C = {
  ink: "#1e293b",
  soft: "#64748b",
  line: "#94a3b8",
  teal: "#0f766e",
  tealL: "#99f6e4",
  amber: "#b45309",
  amberL: "#fde68a",
  red: "#b91c1c",
  redL: "#fecaca",
  blue: "#1d4ed8",
  blueL: "#bfdbfe",
  green: "#15803d",
  paper: "#ffffff",
  panel: "#f1f5f9",
};
type Pt = [number, number];
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const f = (n: number) => +n.toFixed(1);
const pol = (cx: number, cy: number, r: number, a: number): Pt => [cx + r * Math.cos(rad(a)), cy - r * Math.sin(rad(a))];
/** Direction (math degrees, counterclockwise from +x) of the ray from p to q. */
const dir = (p: Pt, q: Pt) => (deg(Math.atan2(-(q[1] - p[1]), q[0] - p[0])) + 360) % 360;
const dist = (p: Pt, q: Pt) => Math.hypot(q[0] - p[0], q[1] - p[1]);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

interface TextOpts { size?: number; fill?: string; anchor?: "start" | "middle" | "end"; weight?: number | string; italic?: boolean }
const text = (x: number, y: number, s: string, o: TextOpts = {}) =>
  `<text x="${f(x)}" y="${f(y)}" font-size="${o.size ?? 14}" fill="${o.fill ?? C.ink}" text-anchor="${o.anchor ?? "middle"}" font-weight="${o.weight ?? 400}"${o.italic ? ' font-style="italic"' : ""} dominant-baseline="middle">${esc(s)}</text>`;
interface LineOpts { stroke?: string; width?: number; dash?: string; cap?: string }
const line = (a: Pt, b: Pt, o: LineOpts = {}) =>
  `<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}" stroke="${o.stroke ?? C.ink}" stroke-width="${o.width ?? 2.5}"${o.dash ? ` stroke-dasharray="${o.dash}"` : ""} stroke-linecap="${o.cap ?? "round"}"/>`;
const polygon = (pts: Pt[], fill = "none", stroke = C.ink, width = 2.5) =>
  `<polygon points="${pts.map((p) => `${f(p[0])},${f(p[1])}`).join(" ")}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round"/>`;
const circle = (c: Pt, r: number, fill = "none", stroke = C.ink, width = 2, dash?: string) =>
  `<circle cx="${f(c[0])}" cy="${f(c[1])}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`;
const dot = (p: Pt, r = 4, fill = C.ink) => circle(p, r, fill, fill, 1);
const rect = (x: number, y: number, w: number, h: number, fill: string, stroke = "none", rx = 4, width = 1.5, dash?: string) =>
  `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`;

const arcD = (c: Pt, r: number, from: number, to: number) => {
  const a = pol(c[0], c[1], r, from);
  const b = pol(c[0], c[1], r, to);
  return `M ${f(a[0])} ${f(a[1])} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 0 ${f(b[0])} ${f(b[1])}`;
};
const wedgeD = (c: Pt, r: number, from: number, to: number) => {
  const a = pol(c[0], c[1], r, from);
  const b = pol(c[0], c[1], r, to);
  return `M ${f(c[0])} ${f(c[1])} L ${f(a[0])} ${f(a[1])} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 0 ${f(b[0])} ${f(b[1])} Z`;
};

/** Angle between the rays at `v` toward `a` and `b`. Returns the sweep from..to (math degrees) and its size. */
function between(v: Pt, a: Pt, b: Pt, reflex = false) {
  const da = dir(v, a);
  const db = dir(v, b);
  const d = (db - da + 360) % 360;
  const small = d <= 180;
  const useAB = reflex ? !small : small;
  const from = useAB ? da : db;
  const sweep = useAB ? (small ? d : d) : small ? 360 - d : 360 - d;
  const size = reflex ? 360 - Math.min(d, 360 - d) : Math.min(d, 360 - d);
  const to = useAB ? from + (small ? d : d) : from + (small ? 360 - d : 360 - d);
  void sweep;
  return { from, to, size };
}
function angleAt(v: Pt, a: Pt, b: Pt, o: { r?: number; color?: string; fill?: string; label?: string | null; reflex?: boolean; labelR?: number; size?: number; weight?: number } = {}) {
  const { from, to, size } = between(v, a, b, o.reflex);
  const r = o.r ?? 26;
  const color = o.color ?? C.teal;
  const mid = (from + to) / 2;
  const lp = pol(v[0], v[1], o.labelR ?? r + 17, mid);
  const label = o.label === undefined ? `${Math.round(size)}°` : o.label;
  return (
    `<path d="${wedgeD(v, r, from, to)}" fill="${o.fill ?? color}" fill-opacity="0.28" stroke="none"/>` +
    `<path d="${arcD(v, r, from, to)}" fill="none" stroke="${color}" stroke-width="2.5"/>` +
    (label ? text(lp[0], lp[1], label, { size: o.size ?? 14, fill: color, weight: o.weight ?? 700 }) : "")
  );
}
/** A small square marking a right angle at v between directions a and b (math degrees). */
function rightMark(v: Pt, a: number, size = 14, color = C.ink) {
  const p1 = pol(v[0], v[1], size, a);
  const p2 = pol(v[0], v[1], size, a + 90);
  const p3: Pt = [p1[0] + p2[0] - v[0], p1[1] + p2[1] - v[1]];
  return `<polyline points="${f(p1[0])},${f(p1[1])} ${f(p3[0])},${f(p3[1])} ${f(p2[0])},${f(p2[1])}" fill="none" stroke="${color}" stroke-width="2"/>`;
}
/** Short tick across a segment to mark equal sides. */
function tick(a: Pt, b: Pt, n = 1, color = C.ink) {
  const m: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const d = dir(a, b);
  let out = "";
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * 6;
    const c = pol(m[0], m[1], off, d);
    const p = pol(c[0], c[1], 7, d + 90);
    const q = pol(c[0], c[1], 7, d - 90);
    out += line(p, q, { stroke: color, width: 2 });
  }
  return out;
}
const regular = (cx: number, cy: number, r: number, n: number, start = 90): Pt[] =>
  Array.from({ length: n }, (_, k) => pol(cx, cy, r, start + (k * 360) / n));
const NAMES: Record<number, string> = { 3: "Triangle", 4: "Quadrilateral", 5: "Pentagon", 6: "Hexagon", 7: "Heptagon", 8: "Octagon", 9: "Nonagon", 10: "Decagon" };

function write(name: string, w: number, h: number, title: string, desc: string, body: string) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-labelledby="t d" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif">` +
    `<title id="t">${esc(title)}</title><desc id="d">${esc(desc)}</desc>` +
    `<rect width="${w}" height="${h}" fill="${C.paper}"/>${body}</svg>\n`;
  fs.writeFileSync(path.join(OUT, name + ".svg"), svg);
  console.log("  wrote", name + ".svg");
}

fs.mkdirSync(OUT, { recursive: true });

// ====================================================================== WEEK 1
// 1. polygon or not
{
  const xs = [65, 200, 335, 470];
  let b = "";
  // closed straight sides
  b += polygon([[35, 60], [93, 40], [105, 100], [65, 135], [27, 105]], C.tealL, C.teal);
  // open zigzag
  b += `<polyline points="160,125 180,50 210,115 235,60" fill="none" stroke="${C.ink}" stroke-width="2.5" stroke-linejoin="round"/>`;
  b += dot([160, 125], 4, C.red) + dot([235, 60], 4, C.red);
  // curved side
  b += `<path d="M 297 120 L 297 55 L 373 55 Q 387 120 297 120 Z" fill="${C.amberL}" stroke="${C.amber}" stroke-width="2.5" stroke-linejoin="round"/>`;
  // crossing sides (bow tie)
  b += polygon([[435, 55], [505, 125], [505, 55], [435, 125]], C.redL, C.red);
  const labels = [
    ["Polygon", "closed, straight sides", true],
    ["Not a polygon", "open (not closed)", false],
    ["Not a polygon", "has a curved side", false],
    ["Not a polygon", "sides cross in the middle", false],
  ] as const;
  labels.forEach(([t1, t2, ok], i) => {
    b += text(xs[i], 168, ok ? "✓" : "✗", { size: 26, fill: ok ? C.green : C.red, weight: 700 });
    b += text(xs[i], 198, t1, { size: 14, weight: 700, fill: ok ? C.green : C.red });
    b += text(xs[i], 218, t2, { size: 12, fill: C.soft });
  });
  write("poly-vs-not", 540, 240, "Polygon or not a polygon", "One closed figure with straight sides is a polygon. An open figure, a figure with a curved side and a figure whose sides cross are not polygons.", b);
}

// 2. parts of a polygon (triangle ABC)
{
  const A: Pt = [90, 220], B: Pt = [330, 220], Cc: Pt = [230, 55];
  let b = polygon([A, B, Cc], C.panel, C.ink, 3);
  b += angleAt(A, B, Cc, { r: 30, color: C.teal, label: "∠A" });
  b += angleAt(B, Cc, A, { r: 30, color: C.teal, label: "∠B" });
  b += angleAt(Cc, A, B, { r: 30, color: C.teal, label: "∠C" });
  [A, B, Cc].forEach((p) => (b += dot(p, 6, C.red)));
  b += text(70, 240, "A", { size: 18, weight: 700 }) + text(352, 240, "B", { size: 18, weight: 700 }) + text(230, 33, "C", { size: 18, weight: 700 });
  b += text(210, 238, "side AB", { size: 13, fill: C.amber, weight: 700 });
  b += text(298, 130, "side BC", { size: 13, fill: C.amber, weight: 700 });
  b += text(135, 126, "side AC", { size: 13, fill: C.amber, weight: 700 });
  // legend
  b += dot([410, 70], 6, C.red) + text(424, 70, "vertex", { size: 13, anchor: "start" });
  b += line([402, 105], [418, 105], { stroke: C.amber, width: 4 }) + text(424, 105, "side", { size: 13, anchor: "start" });
  b += `<path d="${arcD([402, 140], 13, 0, 90)}" fill="none" stroke="${C.teal}" stroke-width="3"/>` + text(424, 140, "interior angle", { size: 13, anchor: "start" });
  write("polygon-parts", 540, 260, "Parts of a polygon: triangle ABC", "Triangle ABC with three vertices A, B and C, three sides AB, BC and AC, and three interior angles at the vertices.", b);
}

// 3. names of polygons 3..10
{
  let b = "";
  for (let n = 3; n <= 10; n++) {
    const i = n - 3;
    const cx = 60 + (i % 4) * 120;
    const cy = i < 4 ? 70 : 205;
    b += polygon(regular(cx, cy, 42, n, n % 2 === 0 ? 90 + 180 / n : 90), i % 2 ? C.blueL : C.tealL, i % 2 ? C.blue : C.teal);
    b += text(cx, cy + 62, NAMES[n], { size: 14, weight: 700 });
    b += text(cx, cy + 80, `${n} sides`, { size: 12, fill: C.soft });
  }
  write("polygon-names", 480, 320, "Polygons named by their number of sides", "Regular polygons from the triangle with 3 sides to the decagon with 10 sides, each with its name.", b);
}

// 4. regular vs irregular pentagon
{
  let b = "";
  const R = regular(125, 125, 80, 5);
  b += polygon(R, C.tealL, C.teal, 3);
  for (let k = 0; k < 5; k++) b += tick(R[k], R[(k + 1) % 5], 1, C.teal);
  for (let k = 0; k < 5; k++) b += angleAt(R[k], R[(k + 4) % 5], R[(k + 1) % 5], { r: 20, color: C.amber, label: k === 0 ? "108°" : null, labelR: 36, size: 13 });
  b += text(125, 236, "Regular pentagon", { size: 15, weight: 700, fill: C.teal });
  b += text(125, 256, "5 equal sides, 5 equal angles", { size: 12, fill: C.soft });
  const I: Pt[] = [[355, 38], [450, 95], [420, 205], [310, 215], [262, 112]];
  b += polygon(I, C.amberL, C.amber, 3);
  [0, 1, 2, 3, 4].forEach((k) => (b += angleAt(I[k], I[(k + 4) % 5], I[(k + 1) % 5], { r: 18, color: C.red, label: `${Math.round(between(I[k], I[(k + 4) % 5], I[(k + 1) % 5]).size)}°`, labelR: 34, size: 12 })));
  b += text(357, 236, "Irregular pentagon", { size: 15, weight: 700, fill: C.amber });
  b += text(357, 256, "sides and angles are not all equal", { size: 12, fill: C.soft });
  write("regular-vs-irregular", 480, 275, "Regular and irregular pentagons", "A regular pentagon has five equal sides and five equal angles of 108 degrees. An irregular pentagon has sides and angles that are not all equal.", b);
}

// 5. angles of regular polygons
{
  const items = [[5, 108, 540], [6, 120, 720], [8, 135, 1080], [10, 144, 1440]] as const;
  let b = "";
  items.forEach(([n, each, sum], i) => {
    const cx = 60 + i * 120;
    const cy = 85;
    const P = regular(cx, cy, 46, n, 90 + 180 / n);
    b += polygon(P, C.panel, C.ink, 2.5);
    b += angleAt(P[0], P[n - 1], P[1], { r: 20, color: C.teal, label: `${each}°`, labelR: 37, size: 13 });
    b += text(cx, cy + 68, NAMES[n], { size: 13, weight: 700 });
    b += text(cx, cy + 86, `each angle ${each}°`, { size: 12, fill: C.teal, weight: 700 });
    b += text(cx, cy + 104, `sum ${num(sum)}°`, { size: 12, fill: C.soft });
  });
  write("regular-angles", 480, 215, "Angles of regular polygons", "A regular pentagon has interior angles of 108 degrees, a regular hexagon 120, a regular octagon 135 and a regular decagon 144.", b);
}
function num(n: number) {
  return n.toLocaleString("en-US");
}

// 6. drawing regular polygons with the angle at the centre
{
  let b = "";
  const O1: Pt = [125, 130];
  const P5 = regular(O1[0], O1[1], 85, 5);
  b += circle(O1, 85, "none", C.line, 1.5, "5 4");
  P5.forEach((p) => (b += line(O1, p, { stroke: C.line, width: 1.5, dash: "4 3" })));
  b += polygon(P5, "none", C.teal, 3);
  b += angleAt(O1, P5[0], P5[1], { r: 26, color: C.amber, label: "72°", labelR: 44, size: 14 });
  P5.forEach((p) => (b += dot(p, 4, C.red)));
  b += dot(O1, 4, C.ink) + text(O1[0] + 2, O1[1] + 14, "O", { size: 13, weight: 700 });
  b += text(125, 238, "Regular pentagon", { size: 14, weight: 700 }) + text(125, 258, "a point every 360° ÷ 5 = 72°", { size: 12, fill: C.soft });

  const O2: Pt = [365, 130];
  const P6 = regular(O2[0], O2[1], 85, 6);
  b += circle(O2, 85, "none", C.line, 1.5, "5 4");
  P6.forEach((p) => (b += line(O2, p, { stroke: C.line, width: 1.5, dash: "4 3" })));
  b += polygon(P6, "none", C.blue, 3);
  b += line(O2, P6[0], { stroke: C.amber, width: 3.5 }) + line(P6[0], P6[1], { stroke: C.red, width: 4 });
  b += angleAt(O2, P6[0], P6[1], { r: 24, color: C.amber, label: "60°", labelR: 41, size: 14 });
  P6.forEach((p) => (b += dot(p, 4, C.red)));
  b += dot(O2, 4, C.ink) + text(O2[0] - 2, O2[1] + 14, "O", { size: 13, weight: 700 });
  b += text(O2[0] + 22, O2[1] - 50, "r", { size: 14, fill: C.amber, weight: 700 }) + text(O2[0] + 50, O2[1] - 92, "side = r", { size: 12, fill: C.red, weight: 700 });
  b += text(365, 238, "Regular hexagon", { size: 14, weight: 700 }) + text(365, 258, "360° ÷ 6 = 60°; side = radius", { size: 12, fill: C.soft });
  write("draw-regular-polygon", 500, 275, "Drawing regular polygons with the angle at the centre", "Points are marked on a circle every 72 degrees to draw a regular pentagon, and every 60 degrees to draw a regular hexagon, where each side equals the radius.", b);
}

// 7. protractor
{
  const O: Pt = [260, 235];
  const R = 195;
  let b = `<path d="M ${O[0] - R} ${O[1]} A ${R} ${R} 0 0 1 ${O[0] + R} ${O[1]} Z" fill="${C.blueL}" fill-opacity="0.35" stroke="${C.blue}" stroke-width="2.5"/>`;
  b += line([O[0] - R - 12, O[1]], [O[0] + R + 12, O[1]], { stroke: C.ink, width: 2.5 });
  for (let a = 0; a <= 180; a += 5) {
    const len = a % 10 === 0 ? 14 : 8;
    b += line(pol(O[0], O[1], R, a), pol(O[0], O[1], R - len, a), { stroke: C.blue, width: a % 10 === 0 ? 1.8 : 1 });
  }
  for (let a = 10; a <= 170; a += 10) {
    const p = pol(O[0], O[1], R - 28, a);
    b += text(p[0], p[1], String(a), { size: 11, fill: C.blue });
  }
  b += dot(O, 5, C.red);
  b += line(O, pol(O[0], O[1], R + 25, 50), { stroke: C.amber, width: 3.5 });
  b += `<path d="${arcD(O, 62, 0, 50)}" fill="none" stroke="${C.teal}" stroke-width="3"/>`;
  const lp = pol(O[0], O[1], 86, 25);
  b += text(lp[0], lp[1], "50°", { size: 16, fill: C.teal, weight: 700 });
  b += text(O[0], O[1] + 18, "center of the protractor on the vertex", { size: 12, fill: C.soft });
  b += text(O[0] + 80, 36, "read where the ray crosses the scale", { size: 12, fill: C.amber, weight: 700 });
  write("protractor", 520, 270, "Measuring an angle with a protractor", "The center of the protractor sits on the vertex, one side of the angle lies along the zero line, and the other side crosses the scale at 50 degrees.", b);
}

// 8. angle sums of triangle and quadrilateral
{
  let b = "";
  const T: Pt[] = [[40, 190], [220, 190], [130, 50]];
  b += polygon(T, C.panel, C.ink, 3);
  b += angleAt(T[0], T[1], T[2], { r: 24, color: C.teal, label: "a", labelR: 40 });
  b += angleAt(T[1], T[2], T[0], { r: 24, color: C.amber, label: "b", labelR: 40 });
  b += angleAt(T[2], T[0], T[1], { r: 24, color: C.blue, label: "c", labelR: 40 });
  b += text(130, 232, "a + b + c = 180°", { size: 15, weight: 700 }) + text(130, 252, "triangle", { size: 12, fill: C.soft });
  const Q: Pt[] = [[290, 195], [460, 195], [470, 80], [310, 50]];
  b += polygon(Q, C.panel, C.ink, 3);
  const cols = [C.teal, C.amber, C.blue, C.red];
  const lab = ["a", "b", "c", "d"];
  Q.forEach((p, k) => (b += angleAt(p, Q[(k + 3) % 4], Q[(k + 1) % 4], { r: 22, color: cols[k], label: lab[k], labelR: 38 })));
  b += text(380, 232, "a + b + c + d = 360°", { size: 15, weight: 700 }) + text(380, 252, "quadrilateral", { size: 12, fill: C.soft });
  write("angle-sums", 510, 270, "Angle sums of a triangle and a quadrilateral", "The three angles of a triangle add up to 180 degrees. The four angles of a quadrilateral add up to 360 degrees.", b);
}

// 9. drawing a triangle with given angles
{
  const A: Pt = [60, 215];
  const B: Pt = [310, 215];
  const AC = (250 * Math.sin(rad(60))) / Math.sin(rad(70));
  const Cc = pol(A[0], A[1], AC, 50);
  let b = line(A, [A[0] + 290, A[1]], { stroke: C.line, width: 1.5, dash: "5 4" });
  b += line(A, pol(A[0], A[1], AC + 30, 50), { stroke: C.line, width: 1.5, dash: "5 4" });
  b += polygon([A, B, Cc], C.panel, C.ink, 3);
  b += angleAt(A, B, Cc, { r: 34, color: C.teal, label: "50°", labelR: 56 });
  b += angleAt(B, Cc, A, { r: 30, color: C.amber, label: "60°", labelR: 52 });
  b += angleAt(Cc, A, B, { r: 28, color: C.blue, label: "70°", labelR: 48 });
  [A, B, Cc].forEach((p) => (b += dot(p, 5, C.red)));
  b += text(A[0] - 14, A[1] + 12, "A", { size: 17, weight: 700 }) + text(B[0] + 14, B[1] + 12, "B", { size: 17, weight: 700 }) + text(Cc[0] + 4, Cc[1] - 16, "C", { size: 17, weight: 700 });
  b += text(185, 244, "AB = 5 cm", { size: 13, weight: 700 });
  const steps = ["1  Draw AB = 5 cm.", "2  At A, mark 50°.", "3  At B, mark 60°.", "4  The rays meet at C.", "5  Check: angle C = 70°."];
  steps.forEach((s, i) => (b += text(365, 70 + i * 28, s, { size: 13, anchor: "start", fill: i === 4 ? C.blue : C.ink, weight: i === 4 ? 700 : 400 })));
  write("draw-triangle", 540, 270, "Drawing a triangle with given angles", "Triangle ABC with AB equal to 5 centimeters, angle A equal to 50 degrees and angle B equal to 60 degrees. The third angle C is 70 degrees. Steps are listed beside the figure.", b);
}

// 10. drawing a quadrilateral with given angles
{
  const A: Pt = [90, 250];
  const B: Pt = [330, 250];
  const D: Pt = [90, 90];
  const Cc: Pt = [330, 90 - 240 * Math.tan(rad(10))];
  let b = polygon([A, B, Cc, D], C.panel, C.ink, 3);
  b += rightMark(A, 0) + rightMark(B, 90);
  b += angleAt(D, A, Cc, { r: 26, color: C.teal, label: "100°", labelR: 46 });
  b += angleAt(Cc, D, B, { r: 26, color: C.amber, label: "80°", labelR: 46 });
  b += text(A[0] + 28, A[1] - 12, "90°", { size: 12, weight: 700 }) + text(B[0] - 30, B[1] - 12, "90°", { size: 12, weight: 700 });
  [A, B, Cc, D].forEach((p) => (b += dot(p, 5, C.red)));
  b += text(A[0] - 14, A[1] + 12, "A", { size: 17, weight: 700 }) + text(B[0] + 14, B[1] + 12, "B", { size: 17, weight: 700 });
  b += text(Cc[0] + 14, Cc[1] - 10, "C", { size: 17, weight: 700 }) + text(D[0] - 14, D[1] - 8, "D", { size: 17, weight: 700 });
  b += text(210, 270, "AB = 6 cm", { size: 13, weight: 700 }) + text(80, 170, "AD = 4 cm", { size: 13, weight: 700, anchor: "end" });
  const steps = ["1  Draw AB = 6 cm.", "2  At A and B, draw 90°.", "3  Mark D so AD = 4 cm.", "4  At D, draw 100°.", "5  It meets the line at B in C.", "6  Check: angle C = 80°."];
  steps.forEach((s, i) => (b += text(385, 70 + i * 26, s, { size: 13, anchor: "start", fill: i === 5 ? C.amber : C.ink, weight: i === 5 ? 700 : 400 })));
  write("draw-quadrilateral", 590, 290, "Drawing a quadrilateral with given angles", "Quadrilateral ABCD with AB equal to 6 centimeters, AD equal to 4 centimeters, right angles at A and B, 100 degrees at D and 80 degrees at C. Steps are listed beside the figure.", b);
}

// ====================================================================== WEEK 2
// convex vs concave
{
  let b = "";
  const V: Pt[] = regular(120, 130, 78, 5);
  b += polygon(V, C.tealL, C.teal, 3);
  V.forEach((p, k) => (b += angleAt(p, V[(k + 4) % 5], V[(k + 1) % 5], { r: 16, color: C.amber, label: null })));
  const s1: Pt = [V[1][0] - 14, V[1][1] + 4];
  const s2: Pt = [V[3][0] + 14, V[3][1] - 6];
  b += line(s1, s2, { stroke: C.green, width: 2.5, dash: "6 4" }) + dot(s1, 4, C.green) + dot(s2, 4, C.green);
  b += text(120, 228, "Convex", { size: 16, weight: 700, fill: C.teal });
  b += text(120, 248, "all angles less than 180°", { size: 12, fill: C.soft });
  b += text(120, 266, "a line between two points stays inside", { size: 12, fill: C.green });

  const A: Pt = [360, 38], B: Pt = [455, 200], Cc: Pt = [360, 140], D: Pt = [265, 200];
  b += polygon([A, B, Cc, D], C.amberL, C.amber, 3);
  b += angleAt(Cc, B, D, { r: 22, color: C.red, reflex: true, label: `${Math.round(between(Cc, B, D, true).size)}°`, labelR: 40, size: 13 });
  b += line(B, D, { stroke: C.red, width: 2.5, dash: "6 4" }) + dot(B, 4, C.red) + dot(D, 4, C.red);
  b += text(360, 222, "outside the shape", { size: 11, fill: C.red });
  b += text(360, 248, "Non-convex (concave)", { size: 16, weight: 700, fill: C.amber });
  b += text(360, 266, "one angle greater than 180°", { size: 12, fill: C.soft });
  write("convex-vs-concave", 480, 285, "Convex and non-convex polygons", "A convex pentagon has all angles less than 180 degrees and any line between two inside points stays inside. A non-convex arrowhead has one angle greater than 180 degrees and a line between two points can leave the shape.", b);
}

// classify three ways
{
  let b = rect(15, 15, 215, 235, C.panel, C.line, 12) + rect(250, 15, 215, 235, C.panel, C.line, 12);
  b += polygon(regular(122, 95, 52, 6, 0), C.tealL, C.teal, 3);
  const chips1 = [["6 sides: hexagon", C.blue], ["regular: all equal", C.teal], ["convex: angles < 180°", C.green]] as const;
  chips1.forEach(([t, c], i) => (b += rect(40, 165 + i * 26, 165, 21, "#ffffff", c, 10, 1.8) + text(122, 176 + i * 26, t, { size: 12, fill: c, weight: 700 })));
  const dart: Pt[] = [[357, 42], [425, 140], [357, 108], [289, 140]];
  b += polygon(dart, C.amberL, C.amber, 3);
  const chips2 = [["4 sides: quadrilateral", C.blue], ["irregular: not all equal", C.amber], ["non-convex: angle > 180°", C.red]] as const;
  chips2.forEach(([t, c], i) => (b += rect(275, 165 + i * 26, 165, 21, "#ffffff", c, 10, 1.8) + text(357, 176 + i * 26, t, { size: 12, fill: c, weight: 700 })));
  write("classify-three-ways", 480, 265, "Classifying polygons in three ways", "A regular convex hexagon and an irregular non-convex quadrilateral, each described by its number of sides, whether it is regular or irregular, and whether it is convex or non-convex.", b);
}

// angle pairs: complementary
{
  const O: Pt = [110, 215];
  let b = line(O, [O[0] + 250, O[1]], { stroke: C.ink, width: 3 }) + line(O, [O[0], O[1] - 190], { stroke: C.ink, width: 3 });
  b += line(O, pol(O[0], O[1], 185, 35), { stroke: C.ink, width: 3 });
  b += rightMark(O, 0, 16, C.soft);
  b += `<path d="${wedgeD(O, 110, 0, 35)}" fill="${C.teal}" fill-opacity="0.28"/><path d="${arcD(O, 110, 0, 35)}" fill="none" stroke="${C.teal}" stroke-width="3"/>`;
  b += `<path d="${wedgeD(O, 90, 35, 90)}" fill="${C.amber}" fill-opacity="0.28"/><path d="${arcD(O, 90, 35, 90)}" fill="none" stroke="${C.amber}" stroke-width="3"/>`;
  const l1 = pol(O[0], O[1], 135, 14), l2 = pol(O[0], O[1], 112, 64);
  b += text(l1[0], l1[1], "35°", { size: 17, fill: C.teal, weight: 700 }) + text(l2[0], l2[1], "55°", { size: 17, fill: C.amber, weight: 700 });
  b += dot(O, 5, C.red);
  b += text(395, 90, "Complementary angles", { size: 16, weight: 700, anchor: "middle" });
  b += text(395, 118, "35° + 55° = 90°", { size: 18, fill: C.teal, weight: 700 });
  b += text(395, 146, "together they make a right angle", { size: 12, fill: C.soft });
  write("complementary", 530, 240, "Complementary angles", "A right angle of 90 degrees is split into an angle of 35 degrees and an angle of 55 degrees. Complementary angles add up to 90 degrees.", b);
}

// adjacent angles
{
  const O: Pt = [90, 200];
  let b = "";
  const dirs = [0, 40, 105];
  dirs.forEach((a) => (b += line(O, pol(O[0], O[1], a === 105 ? 150 : 230, a), { stroke: C.ink, width: 3 })));
  b += `<path d="${wedgeD(O, 100, 0, 40)}" fill="${C.teal}" fill-opacity="0.28"/><path d="${arcD(O, 100, 0, 40)}" fill="none" stroke="${C.teal}" stroke-width="3"/>`;
  b += `<path d="${wedgeD(O, 80, 40, 105)}" fill="${C.amber}" fill-opacity="0.28"/><path d="${arcD(O, 80, 40, 105)}" fill="none" stroke="${C.amber}" stroke-width="3"/>`;
  const l1 = pol(O[0], O[1], 125, 20), l2 = pol(O[0], O[1], 108, 72);
  b += text(l1[0], l1[1], "40°", { size: 16, fill: C.teal, weight: 700 }) + text(l2[0], l2[1], "65°", { size: 16, fill: C.amber, weight: 700 });
  b += dot(O, 5, C.red) + text(O[0] - 12, O[1] + 14, "vertex", { size: 12, anchor: "end", fill: C.red });
  const mid = pol(O[0], O[1], 205, 40);
  b += text(mid[0] + 42, mid[1] + 30, "common side", { size: 12, fill: C.ink, weight: 700 });
  b += text(380, 85, "Adjacent angles", { size: 16, weight: 700 });
  b += text(380, 113, "share a vertex and a side,", { size: 12, fill: C.soft }) + text(380, 131, "and do not overlap", { size: 12, fill: C.soft });
  write("adjacent-angles", 510, 235, "Adjacent angles", "Two angles that share a vertex and one common side without overlapping: an angle of 40 degrees next to an angle of 65 degrees.", b);
}

// linear pair (supplementary)
{
  const O: Pt = [240, 190];
  let b = line([40, O[1]], [440, O[1]], { stroke: C.ink, width: 3 }) + line(O, pol(O[0], O[1], 105, 110), { stroke: C.ink, width: 3 });
  b += `<path d="${wedgeD(O, 70, 0, 110)}" fill="${C.teal}" fill-opacity="0.25"/><path d="${arcD(O, 70, 0, 110)}" fill="none" stroke="${C.teal}" stroke-width="3"/>`;
  b += `<path d="${wedgeD(O, 90, 110, 180)}" fill="${C.amber}" fill-opacity="0.25"/><path d="${arcD(O, 90, 110, 180)}" fill="none" stroke="${C.amber}" stroke-width="3"/>`;
  const l1 = pol(O[0], O[1], 100, 45), l2 = pol(O[0], O[1], 116, 148);
  b += text(l1[0], l1[1], "110°", { size: 17, fill: C.teal, weight: 700 }) + text(l2[0], l2[1], "70°", { size: 17, fill: C.amber, weight: 700 });
  b += dot(O, 5, C.red);
  b += text(240, 30, "Linear pair: supplementary angles", { size: 16, weight: 700 });
  b += text(240, 56, "110° + 70° = 180°", { size: 17, fill: C.teal, weight: 700 });
  b += text(240, 222, "the two angles make a straight line", { size: 12, fill: C.soft });
  write("linear-pair", 480, 240, "A linear pair of supplementary angles", "Two adjacent angles of 110 degrees and 70 degrees form a straight line, so they add up to 180 degrees.", b);
}

// vertical angles
{
  const O: Pt = [240, 140];
  const a1 = 20, a2 = 84;
  let b = line(pol(O[0], O[1], 190, a1), pol(O[0], O[1], 190, a1 + 180), { stroke: C.ink, width: 3 });
  b += line(pol(O[0], O[1], 100, a2), pol(O[0], O[1], 100, a2 + 180), { stroke: C.ink, width: 3 });
  const segs: Array<[number, number, string, string]> = [[a1, a2, "64°", C.teal], [a2, a1 + 180, "116°", C.amber], [a1 + 180, a2 + 180, "64°", C.teal], [a2 + 180, a1 + 360, "116°", C.amber]];
  segs.forEach(([from, to, label, color], i) => {
    const r = 46 + (i % 2 === 0 ? 0 : 6);
    b += `<path d="${wedgeD(O, r, from, to)}" fill="${color}" fill-opacity="0.25"/><path d="${arcD(O, r, from, to)}" fill="none" stroke="${color}" stroke-width="3"/>`;
    const lp = pol(O[0], O[1], r + 26, (from + to) / 2);
    b += text(lp[0], lp[1], label, { size: 16, fill: color, weight: 700 });
  });
  b += dot(O, 5, C.red);
  b += text(240, 20, "Vertical angles are equal", { size: 16, weight: 700 });
  b += text(240, 258, "opposite angles: 64° = 64° and 116° = 116°", { size: 12, fill: C.soft });
  write("vertical-angles", 480, 275, "Vertical angles", "Two lines cross. The opposite angles are equal: two angles of 64 degrees and two angles of 116 degrees.", b);
}

// ====================================================================== WEEK 3
// interior and exterior angles
{
  const V = regular(220, 150, 95, 5);
  let b = polygon(V, C.panel, C.ink, 3);
  const v1 = V[1], v2 = V[2], v3 = V[3];
  const d = dir(v1, v2);
  const ext = pol(v2[0], v2[1], 75, d);
  b += line(v2, ext, { stroke: C.red, width: 3, dash: "7 5" });
  const iAng = between(v2, v1, v3);
  b += `<path d="${wedgeD(v2, 34, iAng.from, iAng.to)}" fill="${C.teal}" fill-opacity="0.3"/><path d="${arcD(v2, 34, iAng.from, iAng.to)}" fill="none" stroke="${C.teal}" stroke-width="3"/>`;
  const eAng = between(v2, ext, v3);
  b += `<path d="${wedgeD(v2, 40, eAng.from, eAng.to)}" fill="${C.amber}" fill-opacity="0.3"/><path d="${arcD(v2, 40, eAng.from, eAng.to)}" fill="none" stroke="${C.amber}" stroke-width="3"/>`;
  const ip = pol(v2[0], v2[1], 60, (iAng.from + iAng.to) / 2), ep = pol(v2[0], v2[1], 66, (eAng.from + eAng.to) / 2);
  b += text(ip[0], ip[1], "interior", { size: 12, fill: C.teal, weight: 700 }) + text(ep[0] + 14, ep[1] + 8, "exterior", { size: 12, fill: C.amber, weight: 700 });
  V.forEach((p) => (b += dot(p, 4, C.ink)));
  b += text(ext[0] + 6, ext[1] - 12, "side extended", { size: 12, fill: C.red, anchor: "start" });
  b += text(240, 20, "Interior and exterior angles at a vertex", { size: 15, weight: 700 });
  write("interior-exterior", 480, 280, "Interior and exterior angles of a polygon", "A pentagon with one side extended past a vertex. The angle inside the polygon at that vertex is the interior angle. The angle between the extension and the next side is the exterior angle.", b);
}

// exterior + adjacent interior = 180
{
  let b = "";
  const V: Pt = [210, 190];
  b += line([30, V[1]], V, { stroke: C.ink, width: 3 }) + line(V, [440, V[1]], { stroke: C.red, width: 3, dash: "7 5" });
  b += line(V, pol(V[0], V[1], 100, 100), { stroke: C.ink, width: 3 });
  b += `<path d="${wedgeD(V, 60, 100, 180)}" fill="${C.teal}" fill-opacity="0.28"/><path d="${arcD(V, 60, 100, 180)}" fill="none" stroke="${C.teal}" stroke-width="3"/>`;
  b += `<path d="${wedgeD(V, 78, 0, 100)}" fill="${C.amber}" fill-opacity="0.28"/><path d="${arcD(V, 78, 0, 100)}" fill="none" stroke="${C.amber}" stroke-width="3"/>`;
  const l1 = pol(V[0], V[1], 100, 140), l2 = pol(V[0], V[1], 104, 45);
  b += text(l1[0], l1[1], "80°", { size: 17, fill: C.teal, weight: 700 }) + text(l2[0], l2[1], "100°", { size: 17, fill: C.amber, weight: 700 });
  b += text(l1[0] - 8, l1[1] + 22, "interior", { size: 11, fill: C.teal }) + text(l2[0] + 6, l2[1] + 20, "exterior", { size: 11, fill: C.amber });
  b += dot(V, 5, C.red);
  b += text(240, 24, "exterior + adjacent interior = 180°", { size: 16, weight: 700 });
  b += text(240, 52, "100° + 80° = 180°", { size: 17, fill: C.amber, weight: 700 });
  b += text(240, 232, "they form a linear pair along the extended side", { size: 12, fill: C.soft });
  write("ext-int-180", 480, 250, "An exterior angle and its adjacent interior angle", "At a vertex of a polygon the interior angle of 80 degrees and the exterior angle of 100 degrees lie along a straight line, so they add up to 180 degrees.", b);
}

// pentagon and hexagon cut into triangles
{
  let b = "";
  const P5 = regular(125, 135, 85, 5);
  const tri5: Array<[Pt, Pt, Pt]> = [[P5[0], P5[1], P5[2]], [P5[0], P5[2], P5[3]], [P5[0], P5[3], P5[4]]];
  const cols = [C.tealL, C.amberL, C.blueL, C.redL];
  tri5.forEach((t, i) => (b += polygon(t as Pt[], cols[i], C.ink, 2)));
  b += polygon(P5, "none", C.ink, 3);
  b += text(125, 250, "Pentagon: 5 − 2 = 3 triangles", { size: 13, weight: 700 }) + text(125, 270, "3 × 180° = 540°", { size: 14, fill: C.teal, weight: 700 });
  const P6 = regular(360, 135, 85, 6);
  const tri6: Array<[Pt, Pt, Pt]> = [[P6[0], P6[1], P6[2]], [P6[0], P6[2], P6[3]], [P6[0], P6[3], P6[4]], [P6[0], P6[4], P6[5]]];
  tri6.forEach((t, i) => (b += polygon(t as Pt[], cols[i], C.ink, 2)));
  b += polygon(P6, "none", C.ink, 3);
  b += text(360, 250, "Hexagon: 6 − 2 = 4 triangles", { size: 13, weight: 700 }) + text(360, 270, "4 × 180° = 720°", { size: 14, fill: C.teal, weight: 700 });
  write("polygon-triangles", 490, 290, "Cutting polygons into triangles", "A pentagon is cut into 3 triangles from one vertex, so its angles add up to 3 times 180 degrees, 540 degrees. A hexagon is cut into 4 triangles, so its angles add up to 720 degrees.", b);
}

// exterior angles add up to 360
{
  const n = 6;
  const V = regular(240, 145, 78, n);
  let b = polygon(V, C.panel, C.ink, 3);
  const cols = [C.teal, C.amber, C.blue, C.red, C.green, C.soft];
  for (let k = 0; k < n; k++) {
    const prev = V[(k + n - 1) % n], cur = V[k], next = V[(k + 1) % n];
    const ext = pol(cur[0], cur[1], 52, dir(prev, cur));
    b += line(cur, ext, { stroke: C.line, width: 2, dash: "5 4" });
    const e = between(cur, ext, next);
    b += `<path d="${wedgeD(cur, 34, e.from, e.to)}" fill="${cols[k]}" fill-opacity="0.45"/><path d="${arcD(cur, 34, e.from, e.to)}" fill="none" stroke="${cols[k]}" stroke-width="2.5"/>`;
  }
  b += text(240, 22, "One exterior angle at each vertex", { size: 15, weight: 700 });
  b += text(240, 262, "Add all six exterior angles: 360°, the full turn", { size: 14, fill: C.teal, weight: 700 });
  b += text(240, 282, "(this is true for every polygon)", { size: 12, fill: C.soft });
  write("exterior-sum", 480, 300, "The exterior angles of a polygon add up to 360 degrees", "A hexagon with one side extended at each vertex and one exterior angle marked at each vertex. All six exterior angles together make one full turn of 360 degrees.", b);
}

// regular octagon angles
{
  const V = regular(170, 140, 100, 8, 90 + 22.5);
  let b = polygon(V, C.panel, C.ink, 3);
  const O: Pt = [170, 140];
  [V[0], V[1]].forEach((p) => (b += line(O, p, { stroke: C.line, width: 1.5, dash: "4 3" })));
  b += angleAt(O, V[0], V[1], { r: 28, color: C.blue, label: "45°", labelR: 46, size: 13 });
  const v = V[3];
  const ext = pol(v[0], v[1], 60, dir(V[2], v));
  b += line(v, ext, { stroke: C.red, width: 3, dash: "7 5" });
  b += angleAt(v, V[2], V[4], { r: 30, color: C.teal, label: "135°", labelR: 52, size: 13 });
  b += angleAt(v, ext, V[4], { r: 36, color: C.amber, label: "45°", labelR: 56, size: 13 });
  b += dot(O, 4, C.ink);
  b += text(400, 70, "Regular octagon", { size: 16, weight: 700 });
  b += text(400, 100, "exterior angle", { size: 13, fill: C.amber, weight: 700 }) + text(400, 118, "360° ÷ 8 = 45°", { size: 13, fill: C.amber });
  b += text(400, 154, "interior angle", { size: 13, fill: C.teal, weight: 700 }) + text(400, 172, "180° − 45° = 135°", { size: 13, fill: C.teal });
  b += text(400, 208, "angle at the center", { size: 13, fill: C.blue, weight: 700 }) + text(400, 226, "360° ÷ 8 = 45°", { size: 13, fill: C.blue });
  write("regular-octagon", 520, 270, "Angles of a regular octagon", "A regular octagon with each exterior angle 45 degrees, each interior angle 135 degrees and each angle at the center 45 degrees.", b);
}

// ====================================================================== WEEK 4
function bar(x: number, y: number, w: number, h: number, fill: string, stroke: string, label?: string, lc = C.ink, dash?: string) {
  return rect(x, y, w, h, fill, stroke, 5, 2, dash) + (label ? text(x + w / 2, y + h / 2, label, { size: 13, fill: lc, weight: 700 }) : "");
}
// percentage increase
{
  let b = text(200, 24, "₱200 rises to ₱280", { size: 16, weight: 700 });
  b += text(40, 66, "Original", { size: 12, anchor: "start", fill: C.soft });
  b += bar(40, 76, 200, 38, C.tealL, C.teal, "₱200 = 100%");
  b += text(40, 146, "New", { size: 12, anchor: "start", fill: C.soft });
  b += bar(40, 156, 200, 38, C.tealL, C.teal, "₱200");
  b += bar(240, 156, 80, 38, C.amberL, C.amber, "+₱80", C.amber);
  b += `<path d="M 240 206 L 240 214 L 320 214 L 320 206" fill="none" stroke="${C.amber}" stroke-width="2"/>`;
  b += text(280, 232, "increase ÷ original", { size: 12, fill: C.amber });
  b += text(280, 252, "80 ÷ 200 = 0.40 = 40%", { size: 14, fill: C.amber, weight: 700 });
  write("percent-increase", 400, 275, "A percentage increase shown with bars", "A bar for the original price of 200 pesos is 100 percent. The new price bar is the same length plus an extra 80 pesos, which is 40 percent of the original, so the increase is 40 percent.", b);
}
// percentage decrease
{
  let b = text(200, 24, "₱500 falls to ₱400", { size: 16, weight: 700 });
  b += text(40, 66, "Original", { size: 12, anchor: "start", fill: C.soft });
  b += bar(40, 76, 300, 38, C.tealL, C.teal, "₱500 = 100%");
  b += text(40, 146, "New", { size: 12, anchor: "start", fill: C.soft });
  b += bar(40, 156, 240, 38, C.tealL, C.teal, "₱400");
  b += bar(280, 156, 60, 38, C.redL, C.red, "−₱100", C.red, "5 4");
  b += `<path d="M 280 206 L 280 214 L 340 214 L 340 206" fill="none" stroke="${C.red}" stroke-width="2"/>`;
  b += text(310, 232, "decrease ÷ original", { size: 12, fill: C.red });
  b += text(310, 252, "100 ÷ 500 = 0.20 = 20%", { size: 14, fill: C.red, weight: 700 });
  write("percent-decrease", 400, 275, "A percentage decrease shown with bars", "A bar for the original price of 500 pesos is 100 percent. The new price is 400 pesos, and the missing 100 pesos is 20 percent of the original, so the decrease is 20 percent.", b);
}
// discount
{
  let b = text(205, 24, "A ₱800 shirt at 25% off", { size: 16, weight: 700 });
  b += text(40, 66, "Original price", { size: 12, anchor: "start", fill: C.soft });
  b += bar(40, 76, 320, 40, C.panel, C.ink, "₱800 = 100%");
  b += bar(40, 140, 240, 40, C.tealL, C.teal, "sale price ₱600 (75%)", C.teal);
  b += bar(280, 140, 80, 40, C.amberL, C.amber, "₱200", C.amber);
  b += text(320, 196, "discount 25%", { size: 12, fill: C.amber, weight: 700 });
  b += text(40, 226, "Discount = 25% of ₱800 = ₱200", { size: 13, anchor: "start" });
  b += text(40, 248, "Sale price = ₱800 − ₱200 = ₱600", { size: 13, anchor: "start", fill: C.teal, weight: 700 });
  write("discount-bar", 410, 270, "Discount and sale price shown with bars", "An 800 peso shirt is 100 percent. A 25 percent discount takes off 200 pesos, so the sale price is 600 pesos, which is 75 percent of the original price.", b);
}
// tax and commission
{
  let b = text(210, 22, "Sales tax and commission", { size: 16, weight: 700 });
  b += text(30, 58, "Price ₱25,000 + 12% VAT", { size: 12, anchor: "start", fill: C.soft });
  b += bar(30, 68, 250, 36, C.tealL, C.teal, "price ₱25,000", C.teal);
  b += bar(280, 68, 30, 36, C.amberL, C.amber);
  b += text(295, 120, "tax ₱3,000", { size: 12, fill: C.amber, weight: 700 });
  b += text(30, 142, "Total = ₱25,000 + ₱3,000 = ₱28,000", { size: 13, anchor: "start", weight: 700 });
  b += text(30, 184, "Sales of ₱45,000 and 8% commission", { size: 12, anchor: "start", fill: C.soft });
  b += bar(30, 194, 270, 36, C.panel, C.ink, "sales ₱45,000");
  b += bar(300, 194, 22, 36, C.amberL, C.amber);
  b += text(311, 246, "commission ₱3,600", { size: 12, fill: C.amber, weight: 700 });
  b += text(30, 266, "Commission = 8% × ₱45,000 = ₱3,600", { size: 13, anchor: "start", weight: 700 });
  write("tax-commission", 420, 285, "Sales tax and commission shown with bars", "A price of 25,000 pesos plus a 12 percent tax of 3,000 pesos gives a total of 28,000 pesos. A seller with 45,000 pesos of sales and an 8 percent commission earns 3,600 pesos.", b);
}
// simple interest timeline
{
  let b = text(250, 22, "₱5,000 at 4% simple interest per year", { size: 16, weight: 700 });
  const xs = [50, 170, 290, 410];
  const labels = ["Start", "Year 1", "Year 2", "Year 3"];
  const totals = ["₱5,000", "₱5,200", "₱5,400", "₱5,600"];
  xs.forEach((x, i) => {
    b += rect(x - 45, 70, 90, 56, i === 3 ? C.tealL : C.panel, i === 3 ? C.teal : C.line, 8, 2);
    b += text(x, 88, labels[i], { size: 12, fill: C.soft }) + text(x, 108, totals[i], { size: 16, weight: 700, fill: i === 3 ? C.teal : C.ink });
    if (i > 0) {
      b += rect(x - 90, 150, 60, 28, C.amberL, C.amber, 8, 1.8) + text(x - 60, 164, "+₱200", { size: 13, fill: C.amber, weight: 700 });
      b += `<path d="M ${x - 72} 98 L ${x - 48} 98" stroke="${C.amber}" stroke-width="2.5" marker-end="url(#arrow)"/>`;
      b += line([x - 60, 104], [x - 60, 148], { stroke: C.amber, width: 1.2, dash: "3 3" });
    }
  });
  b = `<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="${C.amber}"/></marker></defs>` + b;
  b += text(250, 212, "I = P × r × t = 5,000 × 0.04 × 3 = ₱600", { size: 14, weight: 700, fill: C.amber });
  b += text(250, 236, "the same ₱200 is earned each year, because interest is on the principal only", { size: 12, fill: C.soft });
  write("simple-interest", 500, 255, "Simple interest over three years", "A principal of 5,000 pesos at 4 percent simple interest earns 200 pesos each year, so it grows to 5,200, 5,400 and 5,600 pesos in three years. The interest is 600 pesos.", b);
}

// ====================================================================== WEEK 5
{
  let b = text(240, 22, "A ₱150 daily allowance = 100%", { size: 16, weight: 700 });
  const parts: Array<[string, number, string, string, string]> = [
    ["Food", 50, "₱75", C.tealL, C.teal],
    ["Transport", 20, "₱30", C.blueL, C.blue],
    ["Savings", 20, "₱30", C.amberL, C.amber],
    ["Other", 10, "₱15", C.redL, C.red],
  ];
  let x = 40;
  parts.forEach(([name, pctv, amount, fill, stroke]) => {
    const w = pctv * 4;
    b += rect(x, 60, w, 56, fill, stroke, 4, 2);
    b += text(x + w / 2, 80, `${pctv}%`, { size: 15, weight: 700, fill: stroke });
    b += text(x + w / 2, 100, amount, { size: 13, fill: stroke, weight: 700 });
    b += text(x + w / 2, 136, name, { size: 12, fill: C.ink });
    x += w;
  });
  b += `<path d="M 40 150 L 40 158 L 440 158 L 440 150" fill="none" stroke="${C.ink}" stroke-width="2"/>`;
  b += text(240, 176, "50% + 20% + 20% + 10% = 100%", { size: 14, weight: 700 });
  b += text(240, 202, "amount = percent × income", { size: 12, fill: C.soft }) + text(240, 220, "savings = income − expenses", { size: 12, fill: C.soft });
  write("budget-bar", 480, 240, "A one-day budget plan as a bar", "A daily allowance of 150 pesos shown as a bar split into food 50 percent (75 pesos), transportation 20 percent (30 pesos), savings 20 percent (30 pesos) and other uses 10 percent (15 pesos). The percentages add up to 100 percent.", b);
}

// ====================================================================== WEEK 6
{
  let b = rect(15, 15, 220, 225, C.panel, C.line, 12) + rect(250, 15, 220, 225, C.panel, C.line, 12);
  b += text(125, 40, "Ratio", { size: 17, weight: 700, fill: C.blue }) + text(125, 60, "same unit", { size: 12, fill: C.soft });
  for (let i = 0; i < 3; i++) b += circle([60 + i * 30, 105], 11, C.blueL, C.blue, 2);
  for (let i = 0; i < 5; i++) b += circle([45 + i * 30, 145], 11, C.redL, C.red, 2);
  b += text(125, 185, "3 boys to 5 girls", { size: 14, weight: 700 }) + text(125, 207, "both are children", { size: 12, fill: C.soft });
  b += text(360, 40, "Rate", { size: 17, weight: 700, fill: C.teal }) + text(360, 60, "different units", { size: 12, fill: C.soft });
  for (let i = 0; i < 3; i++) b += rect(290 + i * 34, 90, 26, 34, C.amberL, C.amber, 5, 2) + text(303 + i * 34, 107, "kg", { size: 10, fill: C.amber, weight: 700 });
  b += circle([420, 107], 20, C.tealL, C.teal, 2.5) + text(420, 107, "₱120", { size: 12, fill: C.teal, weight: 700 });
  b += text(360, 160, "₱120 for 3 kg", { size: 14, weight: 700 }) + text(360, 182, "pesos and kilograms", { size: 12, fill: C.soft });
  b += text(360, 214, "per = for each one", { size: 12, fill: C.teal, weight: 700 });
  write("rate-vs-ratio", 485, 255, "A ratio and a rate", "A ratio compares 3 boys to 5 girls, which are both children and so the same unit. A rate compares 120 pesos for 3 kilograms, which are different units.", b);
}
{
  let b = text(250, 22, "₱120 for 3 kg: find the price for 1 kg", { size: 16, weight: 700 });
  const x0 = 70, step = 110;
  b += text(30, 82, "kg", { size: 13, weight: 700, anchor: "middle" }) + text(30, 172, "₱", { size: 15, weight: 700, anchor: "middle", fill: C.teal });
  b += line([x0, 82], [x0 + 3 * step + 20, 82], { stroke: C.ink, width: 3 }) + line([x0, 172], [x0 + 3 * step + 20, 172], { stroke: C.teal, width: 3 });
  const kg = [0, 1, 2, 3], peso = [0, 40, 80, 120];
  kg.forEach((k, i) => {
    const x = x0 + i * step;
    b += line([x, 74], [x, 90], { stroke: C.ink, width: 2.5 }) + line([x, 164], [x, 180], { stroke: C.teal, width: 2.5 });
    b += line([x, 90], [x, 164], { stroke: i === 1 ? C.amber : C.line, width: i === 1 ? 3 : 1.5, dash: i === 1 ? undefined : "4 4" });
    b += text(x, 62, String(k), { size: 14, weight: 700 }) + text(x, 196, i === 3 ? "120" : String(peso[i]), { size: 14, weight: 700, fill: C.teal });
  });
  b += rect(x0 + step - 38, 112, 76, 28, C.amberL, C.amber, 8, 2) + text(x0 + step, 126, "1 kg = ₱40", { size: 12, fill: C.amber, weight: 700 });
  b += text(250, 232, "120 ÷ 3 = 40   →   ₱40 per kilogram (the unit rate)", { size: 14, fill: C.amber, weight: 700 });
  write("unit-rate-doubleline", 500, 252, "A double number line for a unit rate", "Two number lines side by side. Kilograms 0, 1, 2 and 3 line up with pesos 0, 40, 80 and 120, so 1 kilogram costs 40 pesos, which is the unit rate.", b);
}
{
  let b = "";
  const T: Pt[] = [[140, 40], [60, 190], [220, 190]];
  b += polygon(T, C.panel, C.ink, 3);
  b += line([100, 115], [180, 115], { stroke: C.ink, width: 2 }) + line([140, 115], [140, 190], { stroke: C.ink, width: 2 });
  b += text(140, 85, "D", { size: 24, weight: 700, fill: C.teal }) + text(100, 158, "S", { size: 24, weight: 700, fill: C.blue }) + text(180, 158, "T", { size: 24, weight: 700, fill: C.amber });
  b += text(140, 212, "cover the one you want", { size: 12, fill: C.soft });
  const f1 = [["D = S × T", "distance = speed × time", C.teal], ["S = D ÷ T", "speed = distance ÷ time", C.blue], ["T = D ÷ S", "time = distance ÷ speed", C.amber]] as const;
  f1.forEach(([a, bb, c], i) => {
    b += text(300, 60 + i * 52, a, { size: 20, weight: 700, fill: c, anchor: "start" }) + text(300, 82 + i * 52, bb, { size: 12, fill: C.soft, anchor: "start" });
  });
  b += line([40, 292], [440, 292], { stroke: C.line, width: 6 }) + dot([40, 292], 6, C.green) + dot([440, 292], 6, C.red);
  b += `<path d="M 40 278 L 40 272 L 440 272 L 440 278" fill="none" stroke="${C.teal}" stroke-width="2"/>`;
  b += text(240, 256, "60 km/h × 2 h = 120 km", { size: 14, weight: 700, fill: C.teal });
  b += text(40, 312, "start", { size: 11, fill: C.green }) + text(440, 312, "120 km", { size: 11, fill: C.red });
  write("distance-speed-time", 480, 328, "Distance, speed and time", "The distance, speed and time triangle with D on top and S and T below, giving distance equals speed times time, speed equals distance divided by time and time equals distance divided by speed. Example: 60 kilometers per hour for 2 hours is 120 kilometers.", b);
}

// ====================================================================== WEEK 7
{
  let b = "";
  const size = 22, x0 = 40, y0 = 40;
  for (let r = 0; r < 10; r++)
    for (let c = 0; c < 10; c++) {
      const idx = r * 10 + c;
      b += rect(x0 + c * size, y0 + r * size, size - 2, size - 2, idx < 75 ? C.teal : "#e2e8f0", "none", 3);
    }
  b += text(x0 + 110, 24, "100 squares = 1 whole", { size: 14, weight: 700 });
  b += text(360, 80, "75 of 100 squares", { size: 15, weight: 700, fill: C.teal });
  b += text(360, 120, "3/4", { size: 26, weight: 700 }) + text(360, 146, "fraction", { size: 12, fill: C.soft });
  b += text(360, 180, "0.75", { size: 26, weight: 700 }) + text(360, 206, "decimal", { size: 12, fill: C.soft });
  b += text(360, 240, "75%", { size: 26, weight: 700, fill: C.teal }) + text(360, 266, "percentage", { size: 12, fill: C.soft });
  write("hundred-grid", 470, 280, "Three forms of one rational number", "A grid of 100 squares with 75 shaded shows that 3 over 4, 0.75 and 75 percent are three forms of the same number.", b);
}
{
  let b = text(250, 22, "Rational numbers on a number line from 0 to 1", { size: 15, weight: 700 });
  const x0 = 50, w = 400, y = 130;
  b += line([x0, y], [x0 + w, y], { stroke: C.ink, width: 3 });
  for (let i = 0; i <= 10; i++) {
    const x = x0 + (w * i) / 10;
    b += line([x, y - 9], [x, y + 9], { stroke: C.ink, width: 2 }) + text(x, y + 28, (i / 10).toString().replace(/^0$/, "0").replace(/^1$/, "1"), { size: 12, fill: C.soft });
  }
  const pts: Array<[number, string, string, number]> = [[0.3, "0.3", C.blue, 62], [0.4, "2/5", C.green, 90], [0.5, "1/2", C.amber, 62], [0.75, "3/4 = 0.75", C.teal, 90]];
  pts.forEach(([v, label, color, ly]) => {
    const x = x0 + w * v;
    b += line([x, y - 4], [x, ly + 14], { stroke: color, width: 2, dash: "3 3" }) + circle([x, y], 7, color, "#ffffff", 2.5) + text(x, ly, label, { size: 14, fill: color, weight: 700 });
  });
  b += `<defs><marker id="ar" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="${C.soft}"/></marker></defs>`;
  b += `<path d="M 60 200 L 440 200" stroke="${C.soft}" stroke-width="2" marker-end="url(#ar)"/>` + text(250, 222, "greater →  (to the right)", { size: 12, fill: C.soft });
  b += text(250, 252, "Order: 0.3  <  2/5  <  1/2  <  3/4", { size: 15, weight: 700 });
  write("number-line-0-1", 500, 270, "Ordering rational numbers on a number line", "A number line from 0 to 1 with 0.3, two fifths, one half and three quarters marked in order from left to right.", b);
}

console.log("Done.");
