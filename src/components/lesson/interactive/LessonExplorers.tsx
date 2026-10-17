import React, { useRef, useState } from "react";
import { Compass } from "lucide-react";

/**
 * Small "change the number and watch the picture change" explorers for Term 1. Each one is driven by the
 * block's metadata.model, see EXPLORER_MODELS. They only show mathematics; nothing here is graded.
 */

export const EXPLORER_MODELS = ["polygon-explorer", "angle-pairs", "percent-change", "unit-rate", "hundred-grid"] as const;
export type ExplorerModel = (typeof EXPLORER_MODELS)[number];

export interface ExplorerBlockProps {
  title?: string;
  content?: string;
  metadata?: string;
  onComplete?: () => void;
}

type Pt = [number, number];
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const f = (n: number) => Math.round(n * 10) / 10;
const pol = (c: Pt, r: number, a: number): Pt => [c[0] + r * Math.cos(rad(a)), c[1] - r * Math.sin(rad(a))];
const dirTo = (p: Pt, q: Pt) => (deg(Math.atan2(-(q[1] - p[1]), q[0] - p[0])) + 360) % 360;
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
const peso = (n: number) => "₱" + n.toLocaleString("en-US", { maximumFractionDigits: 2 });
const num = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

/** Path of a wedge (pie slice) at c from math angle `from` counterclockwise to `to`. */
function wedge(c: Pt, r: number, from: number, to: number) {
  const sweep = (to - from + 360) % 360;
  const a = pol(c, r, from);
  const b = pol(c, r, from + sweep);
  return `M ${f(c[0])} ${f(c[1])} L ${f(a[0])} ${f(a[1])} A ${r} ${r} 0 ${sweep > 180 ? 1 : 0} 0 ${f(b[0])} ${f(b[1])} Z`;
}

const HintContext = React.createContext<{ hint?: string; heading?: string }>({});

function Shell({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  const custom = React.useContext(HintContext);
  const heading = custom.heading || title;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
        <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
          <Compass className="w-5 h-5" />
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 block">Try it yourself</span>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">{heading}</h2>
        </div>
      </div>
      <p className="text-sm text-slate-600 leading-relaxed">{custom.hint || hint}</p>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-xs">{children}</div>
    </div>
  );
}

function Slider(props: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void }) {
  const id = React.useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="flex justify-between text-xs font-bold text-slate-700">
        <span>{props.label}</span>
        <span className="font-mono text-teal-800">
          {num(props.value)}
          {props.unit ?? ""}
        </span>
      </label>
      <input
        id={id}
        type="range"
        min={props.min}
        max={props.max}
        step={props.step ?? 1}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className="w-full accent-teal-600 cursor-pointer"
      />
    </div>
  );
}

function Readout({ items }: { items: Array<[string, string, string?]> }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {items.map(([label, value, tone]) => (
        <div key={label} className={`rounded-xl border p-3 ${tone ?? "border-slate-200 bg-slate-50"}`}>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
          <div className="text-base font-bold text-slate-900 font-mono whitespace-nowrap">{value}</div>
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ polygon explorer
function PolygonExplorer({ touch }: { touch: () => void }) {
  const [n, setN] = useState(5);
  const [fan, setFan] = useState(true);
  const c: Pt = [160, 135];
  const R = 100;
  const V: Pt[] = Array.from({ length: n }, (_, k) => pol(c, R, 90 + (360 * k) / n));
  const interior = ((n - 2) * 180) / n;
  const exterior = 360 / n;
  const v0 = V[0], v1 = V[1], v2 = V[2 % n];
  const e = dirTo(v0, v1); // direction of the extended side
  const extEnd = pol(v1, 52, e);
  const iFrom = dirTo(v1, v2);
  const iTo = dirTo(v1, v0);
  return (
    <Shell title="Polygon angle explorer" hint="Drag the slider to change the number of sides. Watch the triangles, the interior angle (teal) and the exterior angle (amber).">
      <div className="grid gap-5">
        <svg viewBox="0 0 320 270" className="w-full max-w-[340px] mx-auto" role="img" aria-label={`A regular polygon with ${n} sides`}>
          {fan &&
            V.slice(1, n - 1).map((p, k) => (
              <polygon key={k} points={[v0, p, V[k + 2]].map((q) => `${f(q[0])},${f(q[1])}`).join(" ")} fill={["#99f6e4", "#fde68a", "#bfdbfe", "#fecaca"][k % 4]} fillOpacity={0.7} stroke="#475569" strokeWidth={1.2} />
            ))}
          <polygon points={V.map((q) => `${f(q[0])},${f(q[1])}`).join(" ")} fill="none" stroke="#1e293b" strokeWidth={3} strokeLinejoin="round" />
          <line x1={f(v1[0])} y1={f(v1[1])} x2={f(extEnd[0])} y2={f(extEnd[1])} stroke="#b91c1c" strokeWidth={2.5} strokeDasharray="6 4" />
          <path d={wedge(v1, 34, iFrom, iTo)} fill="#0f766e" fillOpacity={0.35} stroke="#0f766e" strokeWidth={2} />
          <path d={wedge(v1, 44, e, e + exterior)} fill="#b45309" fillOpacity={0.35} stroke="#b45309" strokeWidth={2} />
          {V.map((p, k) => (
            <circle key={k} cx={f(p[0])} cy={f(p[1])} r={3.5} fill="#1e293b" />
          ))}
        </svg>
        <div className="space-y-4">
          <Slider
            label="Number of sides (n)"
            value={n}
            min={3}
            max={12}
            onChange={(v) => {
              setN(v);
              touch();
            }}
          />
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={fan} onChange={(e) => setFan(e.target.checked)} className="accent-teal-600" />
            Cut into triangles from one vertex
          </label>
          <Readout
            items={[
              ["Triangles (n − 2)", String(n - 2)],
              ["Sum of interior angles", `${num((n - 2) * 180)}°`],
              ["Each interior angle", `${num(interior)}°`, "border-teal-200 bg-teal-50"],
              ["Each exterior angle", `${num(exterior)}°`, "border-amber-200 bg-amber-50"],
              ["Interior + exterior", `${num(interior + exterior)}°`],
              ["All exterior angles", `${num(exterior * n)}°`],
            ]}
          />
          <p className="text-xs text-slate-500">This shows a REGULAR polygon, so all its angles are equal.</p>
        </div>
      </div>
    </Shell>
  );
}

// ------------------------------------------------------------------ angle pairs
function AnglePairs({ touch }: { touch: () => void }) {
  const [mode, setMode] = useState<"complementary" | "linear" | "vertical">("linear");
  const [x, setX] = useState(65);
  const lim = mode === "complementary" ? { min: 5, max: 85 } : { min: 10, max: 170 };
  const a = Math.min(Math.max(x, lim.min), lim.max);
  const O: Pt = [150, 190];
  const arm = (ang: number, len: number) => pol(O, len, ang);
  const line = (p: Pt, q: Pt, w = 3) => <line x1={f(p[0])} y1={f(p[1])} x2={f(q[0])} y2={f(q[1])} stroke="#1e293b" strokeWidth={w} strokeLinecap="round" />;
  const label = (ang: number, r: number, t: string, color: string) => {
    const p = pol(O, r, ang);
    return (
      <text x={f(p[0])} y={f(p[1])} textAnchor="middle" dominantBaseline="middle" fontSize={15} fontWeight={700} fill={color}>
        {t}
      </text>
    );
  };
  const modes = [
    ["linear", "Linear pair"],
    ["complementary", "Complementary"],
    ["vertical", "Vertical angles"],
  ] as const;
  let figure: React.ReactNode;
  let facts: Array<[string, string, string?]>;
  if (mode === "complementary") {
    figure = (
      <>
        {line(O, arm(0, 190))}
        {line(O, arm(90, 160))}
        {line(O, arm(a, 190))}
        <path d={wedge(O, 95, 0, a)} fill="#0f766e" fillOpacity={0.3} stroke="#0f766e" strokeWidth={2.5} />
        <path d={wedge(O, 80, a, 90)} fill="#b45309" fillOpacity={0.3} stroke="#b45309" strokeWidth={2.5} />
        {label(a / 2, 125, `${a}°`, "#0f766e")}
        {label(a + (90 - a) / 2, 110, `${90 - a}°`, "#b45309")}
      </>
    );
    facts = [["First angle", `${a}°`, "border-teal-200 bg-teal-50"], ["Second angle", `${90 - a}°`, "border-amber-200 bg-amber-50"], ["Sum", `${a + (90 - a)}°`]];
  } else if (mode === "linear") {
    figure = (
      <>
        {line([20, O[1]], [280, O[1]])}
        {line(O, arm(a, 160))}
        <path d={wedge(O, 70, 0, a)} fill="#0f766e" fillOpacity={0.3} stroke="#0f766e" strokeWidth={2.5} />
        <path d={wedge(O, 85, a, 180)} fill="#b45309" fillOpacity={0.3} stroke="#b45309" strokeWidth={2.5} />
        {label(a / 2, 105, `${a}°`, "#0f766e")}
        {label(a + (180 - a) / 2, 112, `${180 - a}°`, "#b45309")}
      </>
    );
    facts = [["First angle", `${a}°`, "border-teal-200 bg-teal-50"], ["Second angle", `${180 - a}°`, "border-amber-200 bg-amber-50"], ["Sum", "180°"]];
  } else {
    const O2: Pt = [150, 135];
    const at = (ang: number, r: number) => pol(O2, r, ang);
    const seg = (from: number, to: number, color: string, t: string, r: number) => (
      <g key={from}>
        <path d={wedge(O2, r, from, to)} fill={color} fillOpacity={0.3} stroke={color} strokeWidth={2.5} />
        <text x={f(at((from + to) / 2, r + 22)[0])} y={f(at((from + to) / 2, r + 22)[1])} textAnchor="middle" dominantBaseline="middle" fontSize={15} fontWeight={700} fill={color}>
          {t}
        </text>
      </g>
    );
    figure = (
      <>
        {line(at(10, 135), at(190, 135))}
        {line(at(10 + a, 120), at(190 + a, 120))}
        {seg(10, 10 + a, "#0f766e", `${a}°`, 40)}
        {seg(10 + a, 190, "#b45309", `${180 - a}°`, 46)}
        {seg(190, 190 + a, "#0f766e", `${a}°`, 40)}
        {seg(190 + a, 370, "#b45309", `${180 - a}°`, 46)}
      </>
    );
    facts = [["Opposite pair", `${a}° = ${a}°`, "border-teal-200 bg-teal-50"], ["Other pair", `${180 - a}° = ${180 - a}°`, "border-amber-200 bg-amber-50"], ["Next to each other", "180°"]];
  }
  return (
    <Shell title="Angle pairs explorer" hint="Pick a pair, then drag the slider. Notice which numbers stay the same and which change.">
      <div className="flex flex-wrap gap-2 mb-4">
        {modes.map(([m, t]) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              touch();
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold min-h-[36px] cursor-pointer ${mode === m ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="grid gap-5">
        <svg viewBox="0 0 300 250" className="w-full max-w-[340px] mx-auto" role="img" aria-label="Two angles that change as you move the slider">
          {figure}
          <circle cx={mode === "vertical" ? 150 : O[0]} cy={mode === "vertical" ? 135 : O[1]} r={4.5} fill="#b91c1c" />
        </svg>
        <div className="space-y-4">
          <Slider
            label="Size of the first angle"
            value={a}
            min={lim.min}
            max={lim.max}
            unit="°"
            onChange={(v) => {
              setX(v);
              touch();
            }}
          />
          <Readout items={facts} />
        </div>
      </div>
    </Shell>
  );
}

// ------------------------------------------------------------------ percent change
function PercentChange({ meta, touch }: { meta: any; touch: () => void }) {
  const mode: "increase" | "decrease" = meta?.mode === "decrease" ? "decrease" : "increase";
  const labels = { original: meta?.labels?.original ?? "Original", change: meta?.labels?.change ?? (mode === "increase" ? "Increase" : "Decrease"), result: meta?.labels?.result ?? "New value" };
  const [orig, setOrig] = useState<number>(meta?.original ?? 500);
  const [pct, setPct] = useState<number>(meta?.percent ?? 20);
  const change = (orig * pct) / 100;
  const result = mode === "increase" ? orig + change : orig - change;
  const max = Math.max(orig, result);
  const W = 100;
  const origW = (orig / max) * W;
  const resW = (result / max) * W;
  const changeW = (change / max) * W;
  return (
    <Shell
      title={mode === "increase" ? "Percentage increase explorer" : "Percentage decrease explorer"}
      hint={`Change the ${labels.original.toLowerCase()} and the percent. The percent is always taken from the ORIGINAL amount.`}
    >
      <div className="space-y-5">
        <div className="space-y-3">
          <div>
            <div className="text-xs font-semibold text-slate-500 mb-1">{labels.original}</div>
            <div className="h-10 rounded-lg bg-teal-100 border-2 border-teal-600 flex items-center justify-center text-sm font-bold text-teal-900" style={{ width: `${origW}%` }}>
              {peso(orig)} = 100%
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 mb-1">{labels.result}</div>
            <div className="flex h-10">
              <div className="h-10 rounded-l-lg bg-teal-100 border-2 border-teal-600 flex items-center justify-center text-sm font-bold text-teal-900 overflow-hidden" style={{ width: `${mode === "increase" ? origW : resW}%` }}>
                {mode === "increase" ? peso(orig) : peso(result)}
              </div>
              {change > 0 && (
                <div
                  className={`h-10 rounded-r-lg border-2 flex items-center justify-center text-xs font-bold overflow-hidden ${mode === "increase" ? "bg-amber-100 border-amber-600 text-amber-900" : "bg-red-100 border-red-600 text-red-800 border-dashed"}`}
                  style={{ width: `${changeW}%` }}
                >
                  {mode === "increase" ? "+" : "−"}
                  {peso(change)}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Slider label={labels.original} value={orig} min={100} max={2000} step={50} onChange={(v) => { setOrig(v); touch(); }} />
          <Slider label="Percent" value={pct} min={0} max={100} step={5} unit="%" onChange={(v) => { setPct(v); touch(); }} />
        </div>
        <Readout
          items={[
            [`${labels.change} (${pct}% of ${peso(orig)})`, peso(change), mode === "increase" ? "border-amber-200 bg-amber-50" : "border-red-200 bg-red-50"],
            [labels.result, peso(result), "border-teal-200 bg-teal-50"],
            ["Check: change ÷ original", `${num(orig ? (change / orig) * 100 : 0)}%`],
          ]}
        />
      </div>
    </Shell>
  );
}

// ------------------------------------------------------------------ unit rate
function UnitRate({ meta, touch }: { meta: any; touch: () => void }) {
  const unit: string = meta?.unit ?? "kg";
  const [qty, setQty] = useState<number>(meta?.quantity ?? 3);
  const [total, setTotal] = useState<number>(meta?.total ?? 120);
  const rate = total / qty;
  const x0 = 50, step = (300 - 50) / qty;
  return (
    <Shell title="Unit rate explorer" hint={`Change the total price and the number of ${unit}. The price for ONE ${unit} is the unit rate.`}>
      <div className="grid gap-5">
        <svg viewBox="0 0 330 200" className="w-full max-w-[400px] mx-auto" role="img" aria-label="A double number line of quantity and price">
          <text x={14} y={58} fontSize={13} fontWeight={700} fill="#1e293b">{unit}</text>
          <text x={14} y={138} fontSize={14} fontWeight={700} fill="#0f766e">₱</text>
          <line x1={x0} y1={55} x2={310} y2={55} stroke="#1e293b" strokeWidth={3} strokeLinecap="round" />
          <line x1={x0} y1={135} x2={310} y2={135} stroke="#0f766e" strokeWidth={3} strokeLinecap="round" />
          {Array.from({ length: qty + 1 }, (_, i) => {
            const x = x0 + i * step;
            const hot = i === 1;
            return (
              <g key={i}>
                <line x1={x} y1={47} x2={x} y2={63} stroke="#1e293b" strokeWidth={2} />
                <line x1={x} y1={127} x2={x} y2={143} stroke="#0f766e" strokeWidth={2} />
                <line x1={x} y1={63} x2={x} y2={127} stroke={hot ? "#b45309" : "#cbd5e1"} strokeWidth={hot ? 3 : 1.2} strokeDasharray={hot ? undefined : "3 3"} />
                {qty <= 10 && (
                  <>
                    <text x={x} y={34} textAnchor="middle" fontSize={12} fontWeight={700} fill="#1e293b">{i}</text>
                    <text x={x} y={162} textAnchor="middle" fontSize={11} fontWeight={700} fill="#0f766e">{num(rate * i)}</text>
                  </>
                )}
              </g>
            );
          })}
          <rect x={x0 + step / 2 - 36} y={86} width={72} height={26} rx={8} fill="#fde68a" stroke="#b45309" strokeWidth={2} />
          <text x={x0 + step / 2} y={99} textAnchor="middle" dominantBaseline="middle" fontSize={12} fontWeight={700} fill="#b45309">
            1 {unit} = {peso(rate)}
          </text>
        </svg>
        <div className="space-y-4">
          <Slider label={`Number of ${unit}`} value={qty} min={2} max={10} onChange={(v) => { setQty(v); touch(); }} />
          <Slider label="Total price" value={total} min={20} max={500} step={10} unit=" pesos" onChange={(v) => { setTotal(v); touch(); }} />
          <Readout items={[["Total ÷ quantity", `${peso(total)} ÷ ${qty}`], ["Unit rate", `${peso(rate)} per ${unit}`, "border-amber-200 bg-amber-50"]]} />
        </div>
      </div>
    </Shell>
  );
}

// ------------------------------------------------------------------ hundred grid
function HundredGrid({ touch }: { touch: () => void }) {
  const [p, setP] = useState(75);
  const g = gcd(p, 100) || 1;
  const frac = p === 0 ? "0" : `${p / g}/${100 / g}`;
  return (
    <Shell title="Fraction, decimal and percent explorer" hint="Shade squares with the slider. Every picture is ONE rational number written three ways.">
      <div className="grid gap-5">
        <svg viewBox="0 0 230 230" className="w-full max-w-[280px] mx-auto" role="img" aria-label={`${p} of 100 squares shaded`}>
          {Array.from({ length: 100 }, (_, i) => (
            <rect key={i} x={5 + (i % 10) * 22} y={5 + Math.floor(i / 10) * 22} width={20} height={20} rx={3} fill={i < p ? "#0f766e" : "#e2e8f0"} />
          ))}
        </svg>
        <div className="space-y-4">
          <Slider label="Squares shaded out of 100" value={p} min={0} max={100} onChange={(v) => { setP(v); touch(); }} />
          <Readout items={[["Fraction", frac, "border-blue-200 bg-blue-50"], ["Decimal", (p / 100).toString(), "border-amber-200 bg-amber-50"], ["Percent", `${p}%`, "border-teal-200 bg-teal-50"]]} />
        </div>
      </div>
    </Shell>
  );
}

export function ExplorerBlock({ title, content, metadata, onComplete }: ExplorerBlockProps) {
  let meta: any = {};
  try {
    meta = metadata ? JSON.parse(metadata) : {};
  } catch {
    meta = {};
  }
  const done = useRef(false);
  const touch = () => {
    if (!done.current) {
      done.current = true;
      onComplete?.();
    }
  };
  const model = meta?.model as ExplorerModel;
  let body: React.ReactNode = null;
  if (model === "polygon-explorer") body = <PolygonExplorer touch={touch} />;
  else if (model === "angle-pairs") body = <AnglePairs touch={touch} />;
  else if (model === "percent-change") body = <PercentChange meta={meta} touch={touch} />;
  else if (model === "unit-rate") body = <UnitRate meta={meta} touch={touch} />;
  else if (model === "hundred-grid") body = <HundredGrid touch={touch} />;
  const heading = title ? title.replace(/^\d+\.\s+/, "") : undefined;
  return <HintContext.Provider value={{ hint: content || undefined, heading }}>{body}</HintContext.Provider>;
}
