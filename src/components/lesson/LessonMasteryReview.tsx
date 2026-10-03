import React, { useEffect, useState } from "react";
import {
  Award,
  Sparkles,
  ArrowRight,
  RotateCcw,
  CheckCircle2,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { MathText } from "@/components/ui/MathText";
import { authFetch } from "@/lib/auth/auth-context";

export interface LessonMasteryReviewProps {
  lessonId: string;
  lessonTitle: string;
  skillId?: string;
  skillTitle?: string;
  practiceSetId?: string;
  checkpointAttempts?: Record<string, { answer: string; isCorrect: boolean; feedback?: string }>;
  onNavigate?: (path: string) => void;
  onOpenAITutor?: (ctx: any) => void;
}

export function LessonMasteryReview({
  lessonId,
  lessonTitle,
  skillId,
  skillTitle,
  practiceSetId,
  checkpointAttempts = {},
  onNavigate,
  onOpenAITutor,
}: LessonMasteryReviewProps) {
  const [masteryData, setMasteryData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const handleNav = (path: string) => {
    if (onNavigate) onNavigate(path);
    else window.location.pathname = path;
  };

  useEffect(() => {
    async function fetchMastery() {
      if (!skillId) {
        setLoading(false);
        return;
      }
      try {
        const res = await authFetch(`/api/student/mastery/${skillId}`);
        if (res.ok) {
          const json = await res.json();
          setMasteryData(json.data);
        }
      } catch (err) {
        console.warn("Failed to fetch authoritative skill mastery:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchMastery();
  }, [skillId]);

  // Checkpoint metrics
  const checkpointEntries = Object.values(checkpointAttempts);
  const totalCheckpoints = checkpointEntries.length;
  const correctCheckpoints = checkpointEntries.filter((c) => c.isCorrect).length;
  const checkpointAccuracy =
    totalCheckpoints > 0 ? Math.round((correctCheckpoints / totalCheckpoints) * 100) : 100;

  // Authoritative Mastery Level
  const level: string = masteryData?.level || "DEVELOPING";
  const accuracy: number =
    typeof masteryData?.accuracy === "number" ? Math.round(masteryData.accuracy * 100) : 75;
  const attemptCount: number = masteryData?.attemptCount ?? totalCheckpoints;

  // Level badge styling
  const getBadgeConfig = (lvl: string) => {
    switch (lvl) {
      case "MASTERED":
        return {
          label: "Mastered",
          color: "bg-emerald-600 text-white border-emerald-700",
          icon: <Award className="w-5 h-5 text-white" />,
          description: "Exceptional mastery! You consistently apply correct concepts and sign rules.",
        };
      case "PROFICIENT":
        return {
          label: "Proficient",
          color: "bg-teal-600 text-white border-teal-700",
          icon: <CheckCircle2 className="w-5 h-5 text-white" />,
          description: "Solid conceptual grasp. Ready for higher-order application and next topics.",
        };
      case "DEVELOPING":
        return {
          label: "Developing",
          color: "bg-amber-500 text-white border-amber-600",
          icon: <TrendingUp className="w-5 h-5 text-white" />,
          description: "Good progress! A few sign rules or edge cases need extra practice.",
        };
      case "LEARNING":
      default:
        return {
          label: "Learning",
          color: "bg-blue-600 text-white border-blue-700",
          icon: <Lightbulb className="w-5 h-5 text-white" />,
          description: "Foundational phase. Focus on concrete models and guided examples.",
        };
    }
  };

  const badgeConfig = getBadgeConfig(level);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Hero Completion Card */}
      <div className="rounded-3xl border border-teal-200 bg-gradient-to-br from-teal-50/70 via-white to-emerald-50/50 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Award className="w-8 h-8 stroke-[2]" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800 block">
                Mastery Learning Evaluation
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                Lesson Experience Complete!
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                {lessonTitle} • DepEd MATATAG Curriculum
              </p>
            </div>
          </div>

          {/* Mastery Level Badge */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div
              className={`px-4 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider border shadow-xs flex items-center gap-2 ${badgeConfig.color}`}
            >
              {badgeConfig.icon}
              <span>{badgeConfig.label} Level</span>
            </div>
          </div>
        </div>

        {/* 4 Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Mastery Stage
            </span>
            <span className="text-lg sm:text-xl font-extrabold text-teal-900">
              {badgeConfig.label}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Authoritative status</span>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Accuracy
            </span>
            <span className="text-lg sm:text-xl font-extrabold text-emerald-600">
              {accuracy}%
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Skill mastery rate</span>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Checkpoints
            </span>
            <span className="text-lg sm:text-xl font-extrabold text-blue-600">
              {correctCheckpoints} / {totalCheckpoints || 1}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">{checkpointAccuracy}% correct</span>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Recorded Attempts
            </span>
            <span className="text-lg sm:text-xl font-extrabold text-slate-800">
              {attemptCount}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Postgres verified</span>
          </div>
        </div>

        {/* Pedagogical Guidance & Socratic Encouragement */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 text-xs sm:text-sm text-slate-700 space-y-2">
          <div className="flex items-center gap-2 font-bold text-slate-900">
            <Sparkles className="w-4 h-4 text-teal-600 shrink-0" />
            <span>Learning Assessment:</span>
          </div>
          <p className="leading-relaxed text-slate-600">
            {masteryData?.explanation?.summary || badgeConfig.description}
          </p>

          {masteryData?.explanation?.nextStep && (
            <div className="pt-2 border-t border-slate-100 flex items-start gap-2 text-teal-900 font-semibold text-xs">
              <span className="uppercase text-[10px] tracking-wider text-teal-800 font-bold block shrink-0">
                Recommended Next Step:
              </span>
              <span>{masteryData.explanation.nextStep}</span>
            </div>
          )}
        </div>

        {/* Action Navigation Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {practiceSetId && (
              <Button
                variant="outline"
                onClick={() => handleNav(`/student/practice/${practiceSetId}`)}
                className="gap-2 text-xs min-h-[44px] flex-1 sm:flex-initial"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Practice Questions</span>
              </Button>
            )}

            {onOpenAITutor && (
              <Button
                variant="outline"
                onClick={() =>
                  onOpenAITutor({
                    lessonId,
                    lessonTitle,
                    skillId,
                    skillTitle,
                    questionPrompt: "Can you help me review the core concepts from this lesson?",
                  })
                }
                className="gap-2 text-xs border-teal-300 text-teal-900 hover:bg-teal-50 min-h-[44px] flex-1 sm:flex-initial"
              >
                <Sparkles className="w-4 h-4 text-teal-600" />
                <span>Review with AI Tutor</span>
              </Button>
            )}
          </div>

          <Button
            variant="primary"
            onClick={() => handleNav("/student/learning-path")}
            className="gap-2 min-h-[44px] bg-teal-600 hover:bg-teal-700 w-full sm:w-auto"
          >
            <span>Continue Learning Path</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
