import React, { useState } from "react";
import { HelpCircle, CheckCircle2, AlertCircle, RefreshCw, Sparkles } from "lucide-react";
import { MathText } from "@/components/ui/MathText";
import { Button } from "@/components/ui/Button";

/** Result of an answer graded by the server. */
export interface CheckpointResult {
  isCorrect: boolean;
  feedback: string;
  correctAnswer: string;
}

export interface CheckpointBlockProps {
  blockId: string;
  title?: string;
  content: string; // Question prompt or description
  metadata?: string; // JSON with options[], correctAnswer, explanation
  /** Submits the answer to the server, which grades it. Without it (teacher preview) the answer is graded locally. */
  onAttempt?: (blockId: string, answer: string) => Promise<CheckpointResult | null>;
  previousAttempt?: { answer: string; isCorrect: boolean; feedback?: string };
  onAskAITutor?: (ctx: { questionPrompt: string; studentAnswer?: string; explanation?: string }) => void;
  readOnly?: boolean;
}

export function CheckpointBlock({
  blockId,
  title,
  content,
  metadata,
  onAttempt,
  previousAttempt,
  onAskAITutor,
  readOnly = false,
}: CheckpointBlockProps) {
  let parsed: {
    question?: string;
    options?: string[];
    correctAnswer?: string;
    explanation?: string;
  } = {};

  if (metadata) {
    try {
      parsed = JSON.parse(metadata);
    } catch {}
  }

  const question = parsed.question || content;
  const options = parsed.options || [];

  const [selectedOption, setSelectedOption] = useState<string>(previousAttempt?.answer || "");
  const [submitted, setSubmitted] = useState<boolean>(!!previousAttempt);
  const [isCorrect, setIsCorrect] = useState<boolean>(previousAttempt?.isCorrect ?? false);
  // The answer key and explanation come from the server after an attempt (or from the metadata in teacher preview).
  const [explanation, setExplanation] = useState<string>(previousAttempt?.feedback || "");
  const [revealedAnswer, setRevealedAnswer] = useState<string>(
    previousAttempt?.isCorrect ? previousAttempt.answer : ""
  );
  const [checking, setChecking] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const handleSubmit = async () => {
    if (!selectedOption || readOnly || checking) return;
    setError("");

    if (onAttempt) {
      setChecking(true);
      const result = await onAttempt(blockId, selectedOption);
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
      setIsCorrect(selectedOption.trim() === parsed.correctAnswer.trim());
      setExplanation(parsed.explanation || "");
      setRevealedAnswer(parsed.correctAnswer);
      setSubmitted(true);
    }
  };

  const handleRetry = () => {
    if (readOnly) return;
    setSubmitted(false);
  };

  const handleLaunchTutor = () => {
    if (onAskAITutor) {
      onAskAITutor({
        questionPrompt: question,
        studentAnswer: selectedOption,
        explanation: explanation,
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
          <HelpCircle className="w-5 h-5" />
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">
            Guided Practice Checkpoint
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            {title || "Quick Check for Understanding"}
          </h2>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 shadow-xs space-y-5">
        <div className="text-base sm:text-lg font-semibold text-slate-900 leading-snug">
          <MathText content={question} />
        </div>

        {/* Options Selection */}
        <div className="space-y-2.5">
          {options.map((opt, idx) => {
            const isSelected = selectedOption === opt;
            const isTargetCorrect = revealedAnswer !== "" && opt.trim() === revealedAnswer.trim();

            let optionStyle =
              "border-slate-200 bg-slate-50 hover:bg-slate-100/80 text-slate-800";
            if (submitted) {
              if (isTargetCorrect) {
                optionStyle = "border-emerald-500 bg-emerald-50/70 text-emerald-950 font-semibold";
              } else if (isSelected && !isTargetCorrect) {
                optionStyle = "border-red-400 bg-red-50/70 text-red-950 line-through";
              }
            } else if (isSelected) {
              optionStyle = "border-blue-500 bg-blue-50/80 text-blue-950 font-semibold ring-2 ring-blue-100";
            }

            return (
              <label
                key={idx}
                className={`flex items-center gap-3.5 p-3.5 sm:p-4 rounded-xl border text-sm sm:text-base cursor-pointer transition-all ${optionStyle}`}
              >
                <input
                  type="radio"
                  name={`checkpoint_${blockId}`}
                  value={opt}
                  checked={isSelected}
                  disabled={submitted || readOnly}
                  onChange={() => setSelectedOption(opt)}
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

        {/* Action Button */}
        {!submitted ? (
          <div className="pt-2 flex items-center justify-between">
            <Button
              variant="primary"
              disabled={!selectedOption || readOnly || checking}
              onClick={handleSubmit}
              className="gap-2 min-h-[44px]"
            >
              <span>{checking ? "Checking..." : "Submit Answer"}</span>
            </Button>

            {onAskAITutor && (
              <button
                type="button"
                onClick={handleLaunchTutor}
                className="text-xs text-teal-800 hover:text-teal-900 font-semibold flex items-center gap-1.5 p-2 rounded-lg hover:bg-teal-50 cursor-pointer min-h-[44px]"
              >
                <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                <span>Need a hint? Ask AI Tutor</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {/* Feedback alert */}
            <div
              className={`p-4 rounded-xl border flex items-start gap-3 text-sm ${
                isCorrect
                  ? "bg-emerald-50 border-emerald-200 text-emerald-950"
                  : "bg-amber-50 border-amber-200 text-amber-950"
              }`}
            >
              {isCorrect ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <span className="font-bold block">
                  {isCorrect ? "Correct! Excellent reasoning." : "Not quite, but good effort!"}
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
                  onClick={handleRetry}
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
                  className="gap-1.5 text-xs border-teal-300 text-teal-900 hover:bg-teal-50 min-h-[44px]"
                >
                  <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                  <span>Ask AI Tutor to Guide Me</span>
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
