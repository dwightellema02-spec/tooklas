import React, { useState } from "react";
import { BookOpen, Eye, EyeOff, CheckCircle, ChevronLeft, ChevronRight, ListOrdered, HelpCircle } from "lucide-react";
import { MathText } from "@/components/ui/MathText";
import { Button } from "@/components/ui/Button";

export interface ExampleBlockProps {
  title?: string;
  content: string; // Plain markdown or formatted with Problem, Steps, Answer
  metadata?: string; // JSON with problem, steps[], answer
}

interface StepItem {
  number: number;
  text: string;
  rationale?: string;
}

export function ExampleBlock({ title, content, metadata }: ExampleBlockProps) {
  const [showAnswer, setShowAnswer] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [revealMode, setRevealMode] = useState<"stepper" | "all">("stepper");

  let parsed: {
    problem?: string;
    steps?: Array<string | { text: string; rationale?: string }>;
    answer?: string;
  } = {};

  if (metadata) {
    try {
      parsed = JSON.parse(metadata);
    } catch {}
  }

  // Parse if structured metadata is missing but content contains "Problem:", "Steps:" or "Answer:"
  let problem = parsed.problem || "";
  let rawSteps: any[] = parsed.steps || [];
  let answer = parsed.answer || "";

  if (!problem && content) {
    const problemMatch = content.match(/Problem:\s*([\s\S]*?)(?=Steps:|Solution:|Answer:|$)/i);
    const stepsMatch = content.match(/(?:Steps|Solution):\s*([\s\S]*?)(?=Answer:|$)/i);
    const answerMatch = content.match(/Answer:\s*([\s\S]*?)$/i);

    if (problemMatch || answerMatch) {
      problem = problemMatch ? problemMatch[1].trim() : "";
      if (stepsMatch) {
        rawSteps = stepsMatch[1]
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean);
      }
      answer = answerMatch ? answerMatch[1].trim() : "";
    } else {
      problem = content;
    }
  }

  // Normalize steps into StepItem
  const steps: StepItem[] = rawSteps.map((s, idx) => {
    if (typeof s === "object" && s !== null) {
      return {
        number: idx + 1,
        text: s.text || "",
        rationale: s.rationale,
      };
    }
    const str = String(s);
    // Check if step includes a "Why:" or "Reason:"
    const whyMatch = str.match(/(?:(?:Why|Reason|Because|Note):\s*)([\s\S]+)$/i);
    let text = str.replace(/^(?:Step\s*\d+:|•|\*|-)\s*/i, "");
    let rationale: string | undefined;

    if (whyMatch) {
      rationale = whyMatch[1].trim();
      text = text.replace(/(?:(?:Why|Reason|Because|Note):\s*)([\s\S]+)$/i, "").trim();
    }

    return {
      number: idx + 1,
      text,
      rationale,
    };
  });

  const totalSteps = steps.length;
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex >= totalSteps - 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800 block">
              Step-by-Step Worked Example
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {title || "Guided Solution Walkthrough"}
            </h2>
          </div>
        </div>

        {totalSteps > 1 && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setRevealMode(revealMode === "stepper" ? "all" : "stepper")}
              className="text-xs font-semibold text-teal-800 hover:text-teal-900 bg-teal-50 hover:bg-teal-100/80 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 min-h-[36px] cursor-pointer"
            >
              <ListOrdered className="w-3.5 h-3.5" />
              <span>{revealMode === "stepper" ? "Show All Steps" : "Step-by-Step Mode"}</span>
            </button>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs divide-y divide-slate-100">
        {/* 1. Problem Statement */}
        <div className="p-5 sm:p-6 bg-slate-50/70">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-2">
            Problem Statement
          </span>
          <div className="text-base sm:text-lg font-semibold text-slate-900 leading-relaxed">
            <MathText content={problem || content} />
          </div>
        </div>

        {/* 2. Step-by-Step Guidance */}
        {totalSteps > 0 && (
          <div className="p-5 sm:p-6 space-y-4">
            {revealMode === "stepper" ? (
              /* STEPPER PROGRESSIVE DISCLOSURE */
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 text-xs">
                  <span className="font-bold text-teal-900 uppercase tracking-wider">
                    Step {currentStepIndex + 1} of {totalSteps}
                  </span>
                  <div className="flex items-center gap-1">
                    {steps.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setCurrentStepIndex(idx)}
                        className={`w-6 h-6 rounded-md font-bold text-[10px] transition-all cursor-pointer ${
                          idx === currentStepIndex
                            ? "bg-teal-600 text-white shadow-xs"
                            : idx < currentStepIndex
                            ? "bg-teal-100 text-teal-800"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {idx + 1}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Active Step Content */}
                <div className="p-5 rounded-2xl bg-teal-50/40 border border-teal-200/80 space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-start gap-3">
                    <span className="w-7 h-7 rounded-xl bg-teal-600 text-white font-extrabold text-xs flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                      {currentStepIndex + 1}
                    </span>
                    <div className="flex-1 text-slate-900 font-medium text-sm sm:text-base leading-relaxed">
                      <MathText content={steps[currentStepIndex].text} />
                    </div>
                  </div>

                  {/* Pedagogical Rationale: "Why this step was taken" */}
                  <div className="p-3.5 rounded-xl bg-white border border-teal-100 text-xs text-slate-700 flex items-start gap-2.5">
                    <HelpCircle className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-teal-950 block mb-0.5">
                        Why take this step?
                      </span>
                      <p className="text-slate-600 leading-relaxed">
                        {steps[currentStepIndex].rationale ||
                          (currentStepIndex === 0
                            ? "Identify the key components and determine whether the numbers share the same signs or opposite signs."
                            : isLastStep
                            ? "Combine the processed parts to reach the verified solution."
                            : "Apply the mathematical property to simplify the expression systematically.")}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Stepper Navigation Buttons */}
                <div className="flex items-center justify-between pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isFirstStep}
                    onClick={() => setCurrentStepIndex((p) => Math.max(0, p - 1))}
                    className="gap-1 min-h-[40px] text-xs"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Previous Step</span>
                  </Button>

                  <Button
                    variant="primary"
                    size="sm"
                    disabled={isLastStep}
                    onClick={() => setCurrentStepIndex((p) => Math.min(totalSteps - 1, p + 1))}
                    className="gap-1 min-h-[40px] text-xs"
                  >
                    <span>Next Step</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ) : (
              /* ALL STEPS CONTINUOUS VIEW */
              <div className="space-y-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                  Complete Step-by-Step Solution
                </span>
                <div className="space-y-3">
                  {steps.map((step, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2"
                    >
                      <div className="flex items-start gap-3 text-sm text-slate-800">
                        <span className="w-6 h-6 rounded-lg bg-teal-100 text-teal-900 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <div className="flex-1 font-medium">
                          <MathText content={step.text} />
                        </div>
                      </div>

                      {step.rationale && (
                        <div className="ml-9 text-xs text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200">
                          <span className="font-semibold text-teal-900">Why: </span>
                          {step.rationale}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. Progressive Reveal Answer */}
        {answer && (
          <div className="p-5 sm:p-6 bg-teal-50/30">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-teal-900 block">
                  Final Result Verification
                </span>
                <p className="text-xs text-slate-500">
                  Verify your answer after analyzing each step of the process.
                </p>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAnswer(!showAnswer)}
                className="gap-2 text-xs min-h-[40px] self-start sm:self-auto border-teal-300 text-teal-900 hover:bg-teal-50"
              >
                {showAnswer ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showAnswer ? "Hide Result" : "Reveal Result"}</span>
              </Button>
            </div>

            {showAnswer && (
              <div className="mt-4 p-4 rounded-xl bg-white border border-teal-200 text-slate-900 shadow-2xs animate-in fade-in slide-in-from-top-1 duration-200 flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
                <div className="font-semibold text-base sm:text-lg">
                  <MathText content={answer} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
