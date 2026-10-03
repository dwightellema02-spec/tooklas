import React from "react";
import {
  Lightbulb,
  Compass,
  BookOpen,
  HelpCircle,
  Target,
  Award,
  CheckCircle2,
} from "lucide-react";

export type LearningStageId =
  | "concept"
  | "explore"
  | "example"
  | "guided"
  | "practice"
  | "mastery";

export interface LearningStageDef {
  id: LearningStageId;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  firstBlockIndex: number;
  blockCount: number;
  isCompleted: boolean;
  isActive: boolean;
}

export interface LearningStageStepperProps {
  stages: LearningStageDef[];
  activeStageId: LearningStageId;
  onSelectStage: (firstBlockIndex: number) => void;
}

export function LearningStageStepper({
  stages,
  activeStageId,
  onSelectStage,
}: LearningStageStepperProps) {
  if (!stages || stages.length === 0) return null;

  return (
    <nav
      aria-label="Interactive Mastery Learning Stages"
      className="bg-white border-b border-slate-200 px-4 py-2.5 overflow-x-auto shadow-2xs"
    >
      <div className="max-w-5xl mx-auto flex items-center justify-between min-w-[620px] gap-2">
        {stages.map((stage, idx) => {
          const isActive = stage.id === activeStageId;
          const isDone = stage.isCompleted;

          return (
            <React.Fragment key={stage.id}>
              <button
                type="button"
                onClick={() => onSelectStage(stage.firstBlockIndex)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all min-h-[44px] cursor-pointer ${
                  isActive
                    ? "bg-teal-50 text-teal-900 border border-teal-300 shadow-2xs"
                    : isDone
                    ? "text-emerald-800 hover:bg-emerald-50/60"
                    : "text-slate-600 hover:bg-slate-100/80"
                }`}
                aria-current={isActive ? "step" : undefined}
                aria-label={`Stage ${idx + 1}: ${stage.label}${isDone ? " (Completed)" : ""}`}
              >
                {/* Icon Marker */}
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    isActive
                      ? "bg-teal-600 text-white shadow-xs"
                      : isDone
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {isDone && !isActive ? (
                    <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                  ) : (
                    stage.icon
                  )}
                </div>

                <div className="text-left">
                  <span className="block text-[10px] uppercase font-bold text-slate-400">
                    Step {idx + 1}
                  </span>
                  <span className="block font-bold leading-tight truncate">
                    {stage.shortLabel}
                  </span>
                </div>
              </button>

              {idx < stages.length - 1 && (
                <div
                  className={`h-0.5 w-6 rounded-full shrink-0 ${
                    isDone ? "bg-emerald-300" : "bg-slate-200"
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </nav>
  );
}
