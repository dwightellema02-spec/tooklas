import React, { useState } from "react";
import { Plus, Minus, RotateCcw, Sparkles, CheckCircle2, Info } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { MathText } from "@/components/ui/MathText";

export interface IntegerCountersManipulativeProps {
  initialPositives?: number;
  initialNegatives?: number;
  title?: string;
  onComplete?: () => void;
  readOnly?: boolean;
}

interface CounterPreset {
  name: string;
  positives: number;
  negatives: number;
  problem: string;
  expectedResult: number;
  explanation: string;
}

const PRESETS: CounterPreset[] = [
  {
    name: "(+4) + (-2)",
    positives: 4,
    negatives: 2,
    problem: "(+4) + (-2)",
    expectedResult: 2,
    explanation: "4 positive counters combine with 2 negative counters. 2 zero-pairs cancel out, leaving 2 positive counters (+2).",
  },
  {
    name: "(-3) + (+5)",
    positives: 5,
    negatives: 3,
    problem: "(-3) + (+5)",
    expectedResult: 2,
    explanation: "3 negative counters cancel with 3 positive counters. 2 positive counters remain (+2).",
  },
  {
    name: "(-2) + (-3)",
    positives: 0,
    negatives: 5,
    problem: "(-2) + (-3)",
    expectedResult: -5,
    explanation: "Since both integers are negative, no zero-pairs are formed. All 5 negative counters combine to equal -5.",
  },
  {
    name: "(+3) + (-3)",
    positives: 3,
    negatives: 3,
    problem: "(+3) + (-3)",
    expectedResult: 0,
    explanation: "Every positive counter is cancelled by a negative counter, forming 3 zero-pairs. The net result is 0 (neutral).",
  },
];

export function IntegerCountersManipulative({
  initialPositives = 3,
  initialNegatives = 2,
  title,
  onComplete,
  readOnly = false,
}: IntegerCountersManipulativeProps) {
  const [positives, setPositives] = useState<number>(initialPositives);
  const [negatives, setNegatives] = useState<number>(initialNegatives);
  const [isPaired, setIsPaired] = useState<boolean>(true);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [hasInteracted, setHasInteracted] = useState<boolean>(false);

  const notifyInteraction = () => {
    if (!hasInteracted) {
      setHasInteracted(true);
      if (onComplete) onComplete();
    }
  };

  const handleAddPositive = () => {
    if (readOnly || positives >= 12) return;
    setPositives((p) => p + 1);
    setActivePreset(null);
    notifyInteraction();
  };

  const handleRemovePositive = () => {
    if (readOnly || positives <= 0) return;
    setPositives((p) => Math.max(0, p - 1));
    setActivePreset(null);
    notifyInteraction();
  };

  const handleAddNegative = () => {
    if (readOnly || negatives >= 12) return;
    setNegatives((n) => n + 1);
    setActivePreset(null);
    notifyInteraction();
  };

  const handleRemoveNegative = () => {
    if (readOnly || negatives <= 0) return;
    setNegatives((n) => Math.max(0, n - 1));
    setActivePreset(null);
    notifyInteraction();
  };

  const handleReset = () => {
    if (readOnly) return;
    setPositives(0);
    setNegatives(0);
    setActivePreset(null);
  };

  const handleSelectPreset = (preset: CounterPreset) => {
    if (readOnly) return;
    setPositives(preset.positives);
    setNegatives(preset.negatives);
    setActivePreset(preset.name);
    setIsPaired(true);
    notifyInteraction();
  };

  const zeroPairs = Math.min(positives, negatives);
  const remainingPositives = Math.max(0, positives - zeroPairs);
  const remainingNegatives = Math.max(0, negatives - zeroPairs);
  const netValue = positives - negatives;

  // Selected preset information if matched
  const currentPreset = PRESETS.find((p) => p.positives === positives && p.negatives === negatives);

  return (
    <div className="space-y-6">
      {/* Title & Preset Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 block">
            Concrete Math Manipulative • DepEd MATATAG
          </span>
          <h3 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
            {title || "Integer Counters & Zero-Pairs Model"}
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPaired(!isPaired)}
            className="text-xs min-h-[38px] gap-1.5"
            aria-label={isPaired ? "Separate counters view" : "Form zero-pairs view"}
          >
            <Sparkles className="w-3.5 h-3.5 text-teal-600" />
            <span>{isPaired ? "Unpair Counters" : "Pair & Cancel"}</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={positives === 0 && negatives === 0}
            className="text-xs min-h-[38px] text-slate-500 hover:text-slate-900 gap-1"
            aria-label="Reset counters"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </Button>
        </div>
      </div>

      {/* Preset Problem Buttons */}
      <div className="space-y-1.5">
        <span className="text-xs font-semibold text-slate-600 block">
          Try a Guided Problem or Build Your Own:
        </span>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => {
            const isSelected = activePreset === p.name || (positives === p.positives && negatives === p.negatives);
            return (
              <button
                key={p.name}
                type="button"
                onClick={() => handleSelectPreset(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all min-h-[44px] cursor-pointer border ${
                  isSelected
                    ? "bg-teal-600 text-white border-teal-700 shadow-xs"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {p.name}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => {
              setActivePreset(null);
              setPositives(4);
              setNegatives(3);
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 border border-transparent min-h-[44px] cursor-pointer transition-colors"
          >
            Custom Sandbox
          </button>
        </div>
      </div>

      {/* Counter Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Positive Counter Control (+1 Blue) */}
        <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-sm shadow-xs select-none">
              +1
            </div>
            <div>
              <span className="text-xs font-bold text-blue-950 uppercase tracking-wider block">
                Positive Counters
              </span>
              <span className="text-xs text-blue-800">
                Count: <strong>{positives}</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={positives <= 0 || readOnly}
              onClick={handleRemovePositive}
              aria-label="Remove one positive counter"
              className="w-11 h-11 rounded-xl bg-white border border-blue-200 hover:bg-blue-100/60 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center text-blue-800 transition-colors cursor-pointer shadow-2xs"
            >
              <Minus className="w-4 h-4 stroke-[2.5]" />
            </button>
            <button
              type="button"
              disabled={positives >= 12 || readOnly}
              onClick={handleAddPositive}
              aria-label="Add one positive counter"
              className="w-11 h-11 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center text-white transition-colors cursor-pointer shadow-2xs"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Negative Counter Control (-1 Red) */}
        <div className="p-4 rounded-2xl bg-red-50/70 border border-red-200 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-600 text-white font-bold flex items-center justify-center text-sm shadow-xs select-none">
              -1
            </div>
            <div>
              <span className="text-xs font-bold text-red-950 uppercase tracking-wider block">
                Negative Counters
              </span>
              <span className="text-xs text-red-800">
                Count: <strong>{negatives}</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={negatives <= 0 || readOnly}
              onClick={handleRemoveNegative}
              aria-label="Remove one negative counter"
              className="w-11 h-11 rounded-xl bg-white border border-red-200 hover:bg-red-100/60 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center text-red-800 transition-colors cursor-pointer shadow-2xs"
            >
              <Minus className="w-4 h-4 stroke-[2.5]" />
            </button>
            <button
              type="button"
              disabled={negatives >= 12 || readOnly}
              onClick={handleAddNegative}
              aria-label="Add one negative counter"
              className="w-11 h-11 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center text-white transition-colors cursor-pointer shadow-2xs"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>
      </div>

      {/* Visual Board Stage */}
      <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Work Mat (Interactive Stage)
            </span>
            {zeroPairs > 0 && isPaired && (
              <Badge variant="outline" className="text-[11px] bg-amber-50 text-amber-800 border-amber-200">
                {zeroPairs} Zero-Pair{zeroPairs > 1 ? "s" : ""} Formed (= 0)
              </Badge>
            )}
          </div>
          <span className="text-xs text-slate-400">
            Total chips: {positives + negatives}
          </span>
        </div>

        {positives === 0 && negatives === 0 ? (
          <div className="py-12 text-center text-slate-400 space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <Plus className="w-6 h-6 stroke-[1.5]" />
            </div>
            <p className="text-xs sm:text-sm font-medium">The work mat is empty.</p>
            <p className="text-xs text-slate-400">Add positive (+1) or negative (-1) counters above to visualize integer operations.</p>
          </div>
        ) : isPaired ? (
          /* PAIRED VIEW: Demonstrates Zero-Pairs Cancellation */
          <div className="space-y-6">
            {/* Zero Pairs Row */}
            {zeroPairs > 0 && (
              <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200/80 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-amber-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-amber-600" />
                    <span>Zero Pairs (These cancel each other out: $+1 + (-1) = 0$)</span>
                  </span>
                  <span className="text-amber-800 font-semibold">
                    Net: 0
                  </span>
                </div>

                <div className="flex flex-wrap gap-3">
                  {Array.from({ length: zeroPairs }).map((_, idx) => (
                    <div
                      key={`zp_${idx}`}
                      className="flex items-center gap-1.5 p-2 rounded-xl bg-white border border-amber-200 shadow-2xs relative"
                    >
                      <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 border border-blue-300 font-bold text-xs flex items-center justify-center select-none line-through">
                        +1
                      </div>
                      <span className="text-xs font-bold text-amber-500">+</span>
                      <div className="w-9 h-9 rounded-full bg-red-100 text-red-700 border border-red-300 font-bold text-xs flex items-center justify-center select-none line-through">
                        -1
                      </div>
                      <span className="text-xs font-bold text-slate-400 font-mono">= 0</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Remaining Unpaired Counters */}
            <div className="space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 block">
                Unpaired Counters (Determines the Final Answer):
              </span>

              {remainingPositives === 0 && remainingNegatives === 0 ? (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs sm:text-sm font-semibold text-slate-700">
                  All counters were cancelled by zero-pairs! The final answer is <strong>0</strong>.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2.5">
                  {Array.from({ length: remainingPositives }).map((_, idx) => (
                    <div
                      key={`rem_p_${idx}`}
                      className="w-11 h-11 rounded-full bg-blue-600 text-white font-extrabold text-sm flex items-center justify-center shadow-xs animate-in zoom-in-50 duration-200 select-none ring-2 ring-blue-200"
                    >
                      +1
                    </div>
                  ))}

                  {Array.from({ length: remainingNegatives }).map((_, idx) => (
                    <div
                      key={`rem_n_${idx}`}
                      className="w-11 h-11 rounded-full bg-red-600 text-white font-extrabold text-sm flex items-center justify-center shadow-xs animate-in zoom-in-50 duration-200 select-none ring-2 ring-red-200"
                    >
                      -1
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* UNPAIRED RAW VIEW */
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-blue-50/40 border border-blue-100 space-y-3">
              <span className="text-xs font-bold text-blue-900 uppercase tracking-wider block">
                Positive Chips ({positives})
              </span>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: positives }).map((_, idx) => (
                  <div
                    key={`p_${idx}`}
                    className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-2xs select-none"
                  >
                    +1
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-red-50/40 border border-red-100 space-y-3">
              <span className="text-xs font-bold text-red-900 uppercase tracking-wider block">
                Negative Chips ({negatives})
              </span>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: negatives }).map((_, idx) => (
                  <div
                    key={`n_${idx}`}
                    className="w-10 h-10 rounded-full bg-red-600 text-white font-bold text-xs flex items-center justify-center shadow-2xs select-none"
                  >
                    -1
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Pedagogical Explanation & Mathematical Net Result Box */}
        <div className="pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-700 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-slate-900">
              <Info className="w-4 h-4 text-teal-600 shrink-0" />
              <span>Mathematical Explanation:</span>
            </div>
            {currentPreset ? (
              <p className="leading-relaxed text-slate-700">
                {currentPreset.explanation}
              </p>
            ) : (
              <p className="leading-relaxed text-slate-700">
                We have <strong>{positives}</strong> positive counters and <strong>{negatives}</strong> negative counters.
                {zeroPairs > 0
                  ? ` By combining them, we create ${zeroPairs} zero-pair${zeroPairs > 1 ? "s" : ""} (each totaling 0). `
                  : " No opposite signs exist to form zero pairs. "}
                {remainingPositives > 0 && `There remain ${remainingPositives} positive counters.`}
                {remainingNegatives > 0 && `There remain ${remainingNegatives} negative counters.`}
                {remainingPositives === 0 && remainingNegatives === 0 && "All counters cancelled each other out!"}
              </p>
            )}
          </div>

          <div className="p-4 rounded-xl bg-teal-50 border border-teal-200 flex flex-col justify-center items-center text-center">
            <span className="text-[11px] font-bold uppercase tracking-wider text-teal-800 block">
              Net Expression Value
            </span>
            <span className="text-2xl sm:text-3xl font-extrabold text-teal-950 font-mono mt-1">
              {netValue > 0 ? `+${netValue}` : netValue}
            </span>
            <span className="text-[11px] text-teal-700 mt-1">
              ({positives > 0 ? `+${positives}` : 0}) + ({negatives > 0 ? `-${negatives}` : 0}) = {netValue > 0 ? `+${netValue}` : netValue}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
