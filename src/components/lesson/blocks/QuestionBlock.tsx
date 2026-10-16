import React, { useState } from "react";
import type { CheckpointResult } from "./CheckpointBlock";
import { HelpCircle, CheckCircle2, AlertCircle, Lightbulb, RefreshCw, Sparkles } from "lucide-react";
import { MathText } from "@/components/ui/MathText";
import { Button } from "@/components/ui/Button";

export interface QuestionBlockProps {
  blockId: string;
  title?: string;
  content: string; // Question prompt
  metadata?: string; // JSON with question, options[], correctAnswer, explanation, hint
  /** Submits the answer to the server, which grades it. Without it (teacher preview) the answer is graded locally. */
  onAttempt?: (blockId: string, answer: string) => Promise<CheckpointResult | null>;
  previousAttempt?: { answer: string; isCorrect: boolean; feedback?: string };
  onAskAITutor?: (ctx: { questionPrompt: string; studentAnswer?: string; explanation?: string }) => void;
  readOnly?: boolean;
}

export function QuestionBlock({
  blockId,
  title,
  content,
  metadata,
  onAttempt,
  previousAttempt,
  onAskAITutor,
  readOnly = false,
}: QuestionBlockProps) {
  let parsed: {
    question?: string;
    options?: string[];
    correctAnswer?: string;
    explanation?: string;
    hint?: string;
  } = {};

  if (metadata) {
    try {
      parsed = JSON.parse(metadata);
    } catch {}
  }

  const question = parsed.question || content;
  const options = parsed.options || [];
  const hint = parsed.hint || "";

  const [selectedAnswer, setSelectedAnswer] = useState<string>(previousAttempt?.answer || "");
  const [submitted, setSubmitted] = useState<boolean>(!!previousAttempt);
  const [isCorrect, setIsCorrect] = useState<boolean>(previousAttempt?.isCorrect ?? false);
  const [showHint, setShowHint] = useState<boolean>(false);
  // The answer key and explanation come from the server after an attempt (or from the metadata in teacher preview).
  const [explanation, setExplanation] = useState<string>(previousAttempt?.feedback || "");
  const [revealedAnswer, setRevealedAnswer] = useState<string>(
    previousAttempt?.isCorrect ? previousAttempt.answer : ""
  );
  const [checking, setChecking] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const handleSubmit = async () => {
    if (!selectedAnswer || readOnly || checking) return;
    setError("");

    if (onAttempt) {
      setChecking(true);
      const result = await onAttempt(blockId, selectedAnswer);
      setChecking(false);
      if (!result) {
        setError("We could not check your answer. Please try again.");
        return;
      }
      setIsCorrect(result.isCorrect);
      setExplanation(result.feedback);
      setRevealedAnswer(result.correctAnswer);
      setSubmitted(true);
      return;
    }

    if (parsed.correctAnswer) {
      // Teacher preview: staff receive the answer key, so the answer is checked locally.
      setIsCorrect(selectedAnswer.trim().toLowerCase() === parsed.correctAnswer.trim().toLowerCase());
      setExplanation(parsed.explanation || "");
      setRevealedAnswer(parsed.correctAnswer);
      setSubmitted(true);
    }
  };

  const handleLaunchTutor = () => {
    if (onAskAITutor) {
      onAskAITutor({
        questionPrompt: question,
        studentAnswer: selectedAnswer,
        explanation: explanation,
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block">
              Active Question
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {title || "Check Your Understanding"}
            </h2>
          </div>
        </div>

        {hint && (
          <button
            type="button"
            onClick={() => setShowHint(!showHint)}
            className="text-xs text-amber-800 hover:text-amber-900 font-semibold flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 transition-colors min-h-[36px] cursor-pointer"
          >
            <Lightbulb className="w-3.5 h-3.5" />
            <span>{showHint ? "Hide Hint" : "Get Hint"}</span>
          </button>
        )}
      </div>

      {showHint && (
        <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs sm:text-sm text-amber-900 flex items-start gap-2.5 animate-in fade-in duration-200">
          <Lightbulb className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block mb-0.5">Instructional Hint:</span>
            <MathText content={hint} />
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 shadow-xs space-y-5">
        <div className="text-base sm:text-lg font-semibold text-slate-900 leading-snug">
          <MathText content={question} />
        </div>

        {/* Options */}
        <div className="space-y-2.5">
          {options.map((opt, idx) => {
            const isSelected = selectedAnswer === opt;
            const isTarget = revealedAnswer !== "" && opt.trim().toLowerCase() === revealedAnswer.trim().toLowerCase();

            let style = "border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800";
            if (submitted) {
              if (isTarget) {
                style = "border-emerald-500 bg-emerald-50 text-emerald-950 font-semibold";
              } else if (isSelected && !isTarget) {
                style = "border-red-400 bg-red-50 text-red-950";
              }
            } else if (isSelected) {
              style = "border-blue-500 bg-blue-50 text-blue-950 font-semibold ring-2 ring-blue-100";
            }

            return (
              <label
                key={idx}
                className={`flex items-center gap-3.5 p-3.5 sm:p-4 rounded-xl border text-sm sm:text-base cursor-pointer transition-all ${style}`}
              >
                <input
                  type="radio"
                  name={`question_${blockId}`}
                  value={opt}
                  checked={isSelected}
                  disabled={submitted || readOnly}
                  onChange={() => setSelectedAnswer(opt)}
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                />
                <div className="flex-1">
                  <MathText content={opt} />
                </div>
              </label>
            );
          })}
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}

        {!submitted ? (
          <div className="pt-2 flex items-center justify-between">
            <Button
              variant="primary"
              disabled={!selectedAnswer || readOnly || checking}
              onClick={handleSubmit}
              className="gap-2 min-h-[44px]"
            >
              <span>Submit Answer</span>
            </Button>

            {onAskAITutor && (
              <button
                type="button"
                onClick={handleLaunchTutor}
                className="text-xs text-blue-700 hover:text-blue-800 font-semibold flex items-center gap-1.5 p-2 rounded-lg hover:bg-blue-50 cursor-pointer min-h-[44px]"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>Ask AI Tutor</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div
              className={`p-4 rounded-xl border flex items-start gap-3 text-sm ${
                isCorrect
                  ? "bg-emerald-50 border-emerald-200 text-emerald-950"
                  : "bg-red-50 border-red-200 text-red-950"
              }`}
            >
              {isCorrect ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <span className="font-bold block">
                  {isCorrect ? "Correct! Well done." : "That's not correct."}
                </span>
                {explanation && (
                  <div className="text-xs sm:text-sm text-slate-700">
                    <MathText content={explanation} />
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {!isCorrect && !readOnly && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSubmitted(false)}
                  className="gap-1.5 text-xs min-h-[44px]"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Try Again</span>
                </Button>
              )}

              {onAskAITutor && !isCorrect && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLaunchTutor}
                  className="gap-1.5 text-xs border-blue-300 text-blue-800 hover:bg-blue-50 min-h-[44px]"
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>Ask AI Tutor for Explanation</span>
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
