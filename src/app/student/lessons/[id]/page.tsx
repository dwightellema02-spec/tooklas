import React, { useState, useEffect } from "react";
import { useAuth, authFetch } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Lock,
  List,
  Sparkles,
  Award,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Layers,
  Lightbulb,
  Compass,
  HelpCircle,
  Target,
  Play,
  RotateCcw,
} from "lucide-react";
import { ContentBlockRenderer, LessonContentBlockData } from "@/components/lesson/ContentBlockRenderer";
import type { CheckpointResult } from "@/components/lesson/blocks/CheckpointBlock";
import {
  LearningStageStepper,
  LearningStageDef,
  LearningStageId,
} from "@/components/lesson/LearningStageStepper";
import { LessonMasteryReview } from "@/components/lesson/LessonMasteryReview";
import { AITutorPanel } from "@/components/ai/AITutorPanel";
import { AITutorHintButton } from "@/components/ai/AITutorHintButton";
import { YouTubeVideo } from "@/components/video/YouTubeVideo";
import { parseYouTubeUrl } from "@/lib/youtube/youtube-parser";

export interface StudentLessonPageProps {
  lessonId: string;
  onNavigate?: (path: string) => void;
}

function getStageIdForBlock(type: string): LearningStageId {
  switch (type) {
    case "TEXT":
    case "IMAGE":
    case "VIDEO":
      return "concept";
    case "INTERACTIVE":
      return "explore";
    case "EXAMPLE":
      return "example";
    case "CHECKPOINT":
    case "QUESTION":
    case "HINT":
      return "guided";
    case "PRACTICE":
      return "practice";
    case "SUMMARY":
    default:
      return "mastery";
  }
}

export default function StudentLessonPage({ lessonId, onNavigate }: StudentLessonPageProps) {
  const { user } = useAuth();
  const [lesson, setLesson] = useState<any>(null);
  const [access, setAccess] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Lesson Engine State
  const [activeSectionIndex, setActiveSectionIndex] = useState<number>(0);
  const [completedBlockIds, setCompletedBlockIds] = useState<string[]>([]);
  const [attemptsMap, setAttemptsMap] = useState<Record<string, any>>({});
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [nextLessonInfo, setNextLessonInfo] = useState<any>(null);
  const [completing, setCompleting] = useState<boolean>(false);
  const [showOutline, setShowOutline] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<"step" | "scroll">("step");
  const [isAITutorOpen, setIsAITutorOpen] = useState<boolean>(false);
  const [tutorContext, setTutorContext] = useState<any>(null);
  // The video that is open (a lesson can have several supporting videos)
  const [openVideoKey, setOpenVideoKey] = useState<string | null>(null);

  const handleNav = (path: string) => {
    if (onNavigate) onNavigate(path);
    else window.location.pathname = path;
  };

  useEffect(() => {
    async function initLesson() {
      setLoading(true);
      try {
        // 1. Verify access & prerequisite satisfaction
        const accessRes = await authFetch(`/api/student/lessons/${lessonId}/access`);
        const accessJson = await accessRes.json();

        // If this is an aliased legacy ID, seamlessly navigate to the canonical lesson URL
        if (accessJson.data?.canonicalLessonId && accessJson.data.canonicalLessonId !== lessonId) {
          handleNav(`/student/lessons/${accessJson.data.canonicalLessonId}`);
          return;
        }

        if (!accessRes.ok || !accessJson.data?.allowed) {
          setAccess(accessJson.data || { allowed: false, reason: "Lesson is locked by prerequisites." });
          setLoading(false);
          return;
        }
        setAccess(accessJson.data);

        // 2. Load published lesson content
        const lessonRes = await authFetch(`/api/lessons/${lessonId}`);
        const lessonJson = await lessonRes.json();
        if (!lessonRes.ok) {
          setError(lessonJson.error || "Failed to load lesson.");
          setLoading(false);
          return;
        }
        setLesson(lessonJson.data);

        // 3. Load or restore student lesson session (Resume Engine)
        const sessionRes = await authFetch(`/api/student/lessons/${lessonId}/session`);
        if (sessionRes.ok) {
          const sessionJson = await sessionRes.json();
          const sess = sessionJson.data?.session;
          const attempts = sessionJson.data?.attempts || [];

          if (sess) {
            const restoredIndex = sess.currentSectionIndex || 0;
            const blocks = lessonJson.data?.contentBlocks || [];
            setActiveSectionIndex(Math.min(restoredIndex, Math.max(0, blocks.length - 1)));
            setCompletedBlockIds(sess.completedBlockIds || []);
            if (sess.completedAt) {
              setIsCompleted(true);
            }
          }

          if (sessionJson.data?.nextLesson) {
            setNextLessonInfo(sessionJson.data.nextLesson);
          }

          // Build attempts dictionary
          const attMap: Record<string, any> = {};
          attempts.forEach((a: any) => {
            if (!attMap[a.blockId] || attMap[a.blockId].createdAt < a.createdAt) {
              attMap[a.blockId] = a;
            }
          });
          setAttemptsMap(attMap);
        }

        // 4. Mark START on progress record if first load
        authFetch("/api/student/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lessonId, action: "START" }),
        }).catch(console.warn);
      } catch (err) {
        setError("Network error loading lesson experience.");
      } finally {
        setLoading(false);
      }
    }

    initLesson();
  }, [lessonId]);

  // Sync session state to server
  const syncSession = async (newIndex: number, newCompletedIds: string[], completeFlag = false) => {
    try {
      const res = await authFetch(`/api/student/lessons/${lessonId}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentSectionIndex: newIndex,
          completedBlockIds: newCompletedIds,
          isCompleted: completeFlag,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.data?.nextLesson) {
          setNextLessonInfo(json.data.nextLesson);
        }
      }
    } catch (e) {
      console.warn("Session sync error:", e);
    }
  };

  // Section completion handler
  const markBlockComplete = (blockId: string) => {
    if (!completedBlockIds.includes(blockId)) {
      const updated = [...completedBlockIds, blockId];
      setCompletedBlockIds(updated);
      syncSession(activeSectionIndex, updated);
    }
  };

  // Checkpoint attempt handler: the server grades the answer and returns the result.
  const handleCheckpointAttempt = async (
    blockId: string,
    answer: string
  ): Promise<CheckpointResult | null> => {
    try {
      const res = await authFetch(`/api/student/lessons/${lessonId}/checkpoint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blockId, answer }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const result: CheckpointResult | undefined = data.result;
      if (!result) return null;

      setAttemptsMap((prev) => ({
        ...prev,
        [blockId]: { answer, isCorrect: result.isCorrect, feedback: result.feedback },
      }));
      const updated = completedBlockIds.includes(blockId)
        ? completedBlockIds
        : [...completedBlockIds, blockId];
      setCompletedBlockIds(updated);
      syncSession(activeSectionIndex, updated);
      return result;
    } catch (e) {
      console.warn("Checkpoint submit error:", e);
      return null;
    }
  };

  // Socratic AI Tutor trigger from question / checkpoint
  const handleAskAITutorFromBlock = (ctx: {
    questionPrompt: string;
    studentAnswer?: string;
    explanation?: string;
  }) => {
    setTutorContext({
      lessonId: lesson?.id,
      lessonTitle: lesson?.title,
      skillId: lesson?.skills?.[0]?.skill?.id,
      skillTitle: lesson?.skills?.[0]?.skill?.title,
      questionPrompt: ctx.questionPrompt,
      studentAnswer: ctx.studentAnswer,
      explanation: ctx.explanation,
      hasFailedAttempt: true,
    });
    setIsAITutorOpen(true);
  };

  const blocks: LessonContentBlockData[] = lesson?.contentBlocks || [];
  const currentBlock = blocks[activeSectionIndex];
  const totalBlocks = blocks.length;

  // Build the 6 unified mastery learning stages
  const STAGE_ORDER: Array<{
    id: LearningStageId;
    label: string;
    shortLabel: string;
    icon: React.ReactNode;
  }> = [
    {
      id: "concept",
      label: "Concept Introduction",
      shortLabel: "Concept",
      icon: <Lightbulb className="w-4 h-4 stroke-[2]" />,
    },
    {
      id: "explore",
      label: "Interactive Model",
      shortLabel: "Explore",
      icon: <Compass className="w-4 h-4 stroke-[2]" />,
    },
    {
      id: "example",
      label: "Worked Example",
      shortLabel: "Example",
      icon: <BookOpen className="w-4 h-4 stroke-[2]" />,
    },
    {
      id: "guided",
      label: "Guided Practice",
      shortLabel: "Guided",
      icon: <HelpCircle className="w-4 h-4 stroke-[2]" />,
    },
    {
      id: "practice",
      label: "Independent Practice",
      shortLabel: "Practice",
      icon: <Target className="w-4 h-4 stroke-[2]" />,
    },
    {
      id: "mastery",
      label: "Mastery & Review",
      shortLabel: "Mastery",
      icon: <Award className="w-4 h-4 stroke-[2]" />,
    },
  ];

  const currentStageId: LearningStageId = currentBlock
    ? getStageIdForBlock(currentBlock.type)
    : "concept";

  const stagesDef: LearningStageDef[] = STAGE_ORDER.map((stage) => {
    const matchingBlockIndices = blocks
      .map((b, idx) => ({ type: b.type, idx, id: b.id }))
      .filter((b) => getStageIdForBlock(b.type) === stage.id);

    const firstBlockIndex =
      matchingBlockIndices.length > 0 ? matchingBlockIndices[0].idx : 0;
    const isCompletedStage =
      matchingBlockIndices.length > 0 &&
      matchingBlockIndices.every((b) => completedBlockIds.includes(b.id));

    return {
      id: stage.id,
      label: stage.label,
      shortLabel: stage.shortLabel,
      icon: stage.icon,
      firstBlockIndex,
      blockCount: matchingBlockIndices.length,
      isCompleted: isCompletedStage,
      isActive: stage.id === currentStageId,
    };
  }).filter((s) => s.blockCount > 0);

  // Attached Mathisipan YouTube video resource
  const attachedVideos: any[] = (lesson?.resources || []).filter((r: any) => r.type === "YOUTUBE");
  if (attachedVideos.length === 0 && lesson?.videoUrl) {
    const parsed = parseYouTubeUrl(lesson.videoUrl);
    if (parsed.isValid && parsed.videoId) {
      attachedVideos.push({
        youtubeId: parsed.videoId,
        title: `${lesson.title} - Mathisipan Concept Video`,
        url: lesson.videoUrl,
      });
    }
  }

  const handleNextSection = () => {
    if (activeSectionIndex < totalBlocks - 1) {
      if (currentBlock && !completedBlockIds.includes(currentBlock.id)) {
        markBlockComplete(currentBlock.id);
      }
      const nextIndex = activeSectionIndex + 1;
      setActiveSectionIndex(nextIndex);
      syncSession(nextIndex, completedBlockIds);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      handleCompleteLesson();
    }
  };

  const handlePrevSection = () => {
    if (activeSectionIndex > 0) {
      const prevIndex = activeSectionIndex - 1;
      setActiveSectionIndex(prevIndex);
      syncSession(prevIndex, completedBlockIds);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleJumpToSection = (index: number) => {
    setActiveSectionIndex(index);
    syncSession(index, completedBlockIds);
    setShowOutline(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCompleteLesson = async () => {
    try {
      setCompleting(true);
      const allIds = blocks.map((b) => b.id);
      setCompletedBlockIds(allIds);
      setIsCompleted(true);
      await syncSession(activeSectionIndex, allIds, true);
    } finally {
      setCompleting(false);
    }
  };

  const completedCount = completedBlockIds.length;
  const progressPercent =
    totalBlocks > 0 ? Math.min(100, Math.round((completedCount / totalBlocks) * 100)) : 0;

  if (loading) {
    return (
      <div className="py-24 text-center text-xs text-slate-500 flex flex-col items-center justify-center space-y-2">
        <div className="w-8 h-8 rounded-xl bg-teal-50 border border-teal-200 animate-spin" />
        <p>Loading interactive mastery lesson...</p>
      </div>
    );
  }

  if (access && !access.allowed) {
    return (
      <div className="py-16 max-w-md mx-auto px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-200 shadow-xs">
          <Lock className="w-8 h-8" />
        </div>
        <Badge variant="outline" className="mb-2 text-slate-500 text-xs">
          Prerequisite Required
        </Badge>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Lesson Locked</h1>
        <p className="text-xs sm:text-sm text-slate-600 mb-6 leading-relaxed">
          {access.reason || "Complete the required previous lesson and prerequisite skills first before advancing."}
        </p>

        <div className="space-y-3">
          {user?.role === "TEACHER" || user?.role === "ADMIN" ? (
            <>
              <Button variant="primary" fullWidth onClick={() => handleNav("/teacher/curriculum")}>
                <span>Return to Curriculum Explorer</span>
              </Button>
              <Button variant="ghost" fullWidth onClick={() => handleNav("/teacher")}>
                Return to Teacher Dashboard
              </Button>
            </>
          ) : (
            <>
              {access.gate?.lessonId && (
                <Button variant="primary" fullWidth onClick={() => handleNav(`/student/lessons/${access.gate.lessonId}`)}>
                  <span>Go to the practice for &ldquo;{access.gate.skillTitle}&rdquo;</span>
                </Button>
              )}
              <Button variant={access.gate?.lessonId ? "outline" : "primary"} fullWidth onClick={() => handleNav("/student/learning-path")}>
                <span>View Learning Path Roadmap</span>
              </Button>
              <Button variant="ghost" fullWidth onClick={() => handleNav("/student")}>
                Return to Dashboard
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div className="py-16 max-w-md mx-auto px-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-7 h-7" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">Lesson Unavailable</h1>
        <p className="text-xs sm:text-sm text-slate-600 mb-6 leading-relaxed">
          {error || "This lesson has not been published yet or is undergoing curriculum review."}
        </p>
        <Button variant="primary" onClick={() => handleNav("/student/learning-path")}>
          Return to Learning Path
        </Button>
      </div>
    );
  }

  const primarySkill = lesson.skills?.[0]?.skill;
  const practiceSetId = lesson.practiceSets?.[0]?.id || "ps_integers_basics";

  return (
    <div className="min-h-[calc(100vh-140px)] bg-slate-50 flex flex-col">
      {/* Sticky Top Header Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 py-3 shadow-2xs">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => {
                if (user?.role === "TEACHER" || user?.role === "ADMIN") {
                  handleNav("/teacher/curriculum");
                } else {
                  handleNav("/student/learning-path");
                }
              }}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              title={user?.role === "TEACHER" || user?.role === "ADMIN" ? "Return to Curriculum Explorer" : "Return to Learning Path"}
              aria-label={user?.role === "TEACHER" || user?.role === "ADMIN" ? "Return to Curriculum Explorer" : "Return to Learning Path"}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800 block truncate">
                {lesson.unit?.title || "Grade 7 Mathematics"}
              </span>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                  {lesson.title}
                </h1>
                {(access?.isStaffBypass || user?.role === "TEACHER" || user?.role === "ADMIN") && (
                  <Badge variant="secondary" className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200 shrink-0 font-medium">
                    Staff Preview
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            {/* View Mode Toggle */}
            <div className="hidden sm:flex items-center p-1 bg-slate-100 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setViewMode("step")}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  viewMode === "step"
                    ? "bg-white text-slate-900 shadow-2xs font-semibold"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Guided Step
              </button>
              <button
                type="button"
                onClick={() => setViewMode("scroll")}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  viewMode === "scroll"
                    ? "bg-white text-slate-900 shadow-2xs font-semibold"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                All Sections
              </button>
            </div>

            {/* Outline Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowOutline(!showOutline)}
              className="text-xs gap-1.5 min-h-[40px]"
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sections</span>
              <span className="text-slate-400 font-normal">
                ({activeSectionIndex + 1}/{totalBlocks})
              </span>
            </Button>

            {/* AI Tutor Button */}
            <AITutorHintButton
              onClick={() => {
                setTutorContext({
                  lessonId: lesson.id,
                  lessonTitle: lesson.title,
                  skillId: primarySkill?.id,
                  skillTitle: primarySkill?.title,
                });
                setIsAITutorOpen(true);
              }}
              label="AI Tutor"
            />

            {/* Percentage Bar */}
            <div className="hidden md:flex items-center gap-2">
              <div className="w-20 bg-slate-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-teal-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-xs font-bold text-slate-700 w-8 text-right tabular-nums">
                {progressPercent}%
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Unified 6-Stage Mastery Progression Stepper */}
      <LearningStageStepper
        stages={stagesDef}
        activeStageId={currentStageId}
        onSelectStage={handleJumpToSection}
      />

      {/* Main Container */}
      <div className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col md:flex-row gap-8">
        <main className="flex-1 min-w-0 space-y-6">
          {/* Supportive Mathisipan Video Card (Contextually Placed, Non-Blocking) */}
          {attachedVideos.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-red-700 block">
                Supportive Video Tutorial{attachedVideos.length > 1 ? "s" : ""} • Mathisipan
              </span>
              <ul className="space-y-3">
                {attachedVideos.map((video: any) => {
                  const key = video.youtubeId || video.url;
                  const isOpen = openVideoKey === key;
                  return (
                    <li key={key} className="space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-100">
                            <Play className="w-4 h-4 fill-red-600" />
                          </div>
                          <h3 className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-2">{video.title}</h3>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setOpenVideoKey(isOpen ? null : key);
                            if (!isOpen) {
                              authFetch(`/api/student/lessons/${lessonId}/video-event`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ videoId: key }),
                              }).catch(console.warn);
                            }
                          }}
                          className="text-xs self-start sm:self-auto min-h-[38px] gap-1.5 shrink-0"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>{isOpen ? "Hide Video" : "Watch Video"}</span>
                        </Button>
                      </div>
                      {isOpen && (
                        <div className="pt-1 animate-in fade-in duration-200">
                          <YouTubeVideo
                            videoId={video.youtubeId}
                            url={video.url}
                            title={video.title}
                            description={video.notes}
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {viewMode === "step" ? (
            /* STEP-BY-STEP GUIDED VIEW */
            <div className="space-y-6">
              {currentBlock ? (
                <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-10 shadow-xs space-y-6">
                  {/* Section Breadcrumb Indicator */}
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100 text-xs text-slate-400">
                    <span className="font-semibold uppercase tracking-wider text-[11px] text-teal-800">
                      Section {activeSectionIndex + 1} of {totalBlocks} • {currentBlock.type}
                    </span>
                    {completedBlockIds.includes(currentBlock.id) && (
                      <span className="flex items-center gap-1 text-emerald-600 font-semibold text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Completed</span>
                      </span>
                    )}
                  </div>

                  {/* Render Current Content Block */}
                  <div className="pt-2">
                    <ContentBlockRenderer
                      block={currentBlock}
                      isCompleted={completedBlockIds.includes(currentBlock.id)}
                      onComplete={() => markBlockComplete(currentBlock.id)}
                      onAttemptCheckpoint={handleCheckpointAttempt}
                      previousAttempt={attemptsMap[currentBlock.id]}
                      onAskAITutor={handleAskAITutorFromBlock}
                      onNavigate={handleNav}
                    />
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 text-xs text-slate-400">
                  No sections in this lesson.
                </div>
              )}

              {/* Bottom Navigation Control Bar */}
              <div className="flex items-center justify-between gap-3 pt-2">
                <Button
                  variant="outline"
                  disabled={activeSectionIndex === 0}
                  onClick={handlePrevSection}
                  className="gap-2 min-h-[44px] px-5"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous</span>
                </Button>

                <div className="flex items-center gap-2">
                  {activeSectionIndex === totalBlocks - 1 ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="primary"
                        onClick={handleCompleteLesson}
                        disabled={completing}
                        className="gap-2 min-h-[44px] px-6 bg-teal-600 hover:bg-teal-700"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{completing ? "Saving..." : isCompleted ? "Lesson Completed" : "Complete Lesson"}</span>
                      </Button>
                      {isCompleted && nextLessonInfo && (
                        nextLessonInfo.eligible ? (
                          <Button
                            variant="primary"
                            onClick={() => handleNav(`/student/lessons/${nextLessonInfo.lessonId}`)}
                            className="gap-2 min-h-[44px] px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs"
                          >
                            <span>Proceed to Next: {nextLessonInfo.title}</span>
                            <ArrowRight className="w-4 h-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            onClick={() => handleNav("/student/learning-path")}
                            className="gap-2 min-h-[44px] px-4 text-amber-700 border-amber-200 bg-amber-50"
                            title={nextLessonInfo.lockReasons?.join(", ") || "Prerequisites required"}
                          >
                            <Lock className="w-4 h-4 text-amber-600" />
                            <span className="text-xs">Next Lesson Locked • Learning Path</span>
                          </Button>
                        )
                      )}
                    </div>
                  ) : (
                    <Button
                      variant="primary"
                      onClick={handleNextSection}
                      className="gap-2 min-h-[44px] px-6 bg-teal-600 hover:bg-teal-700"
                    >
                      <span>Next Section</span>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* ALL SECTIONS CONTINUOUS VIEW */
            <div className="space-y-8">
              {blocks.map((block, idx) => (
                <div
                  key={block.id}
                  id={`section-${idx}`}
                  className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-10 shadow-xs space-y-4"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 text-xs text-slate-400">
                    <span className="font-semibold uppercase tracking-wider text-[11px] text-teal-800">
                      Section {idx + 1} • {block.type}
                    </span>
                    {completedBlockIds.includes(block.id) && (
                      <span className="flex items-center gap-1 text-emerald-600 font-semibold text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Completed</span>
                      </span>
                    )}
                  </div>
                  <ContentBlockRenderer
                    block={block}
                    isCompleted={completedBlockIds.includes(block.id)}
                    onComplete={() => markBlockComplete(block.id)}
                    onAttemptCheckpoint={handleCheckpointAttempt}
                    previousAttempt={attemptsMap[block.id]}
                    onAskAITutor={handleAskAITutorFromBlock}
                    onNavigate={handleNav}
                  />
                </div>
              ))}

              <div className="p-6 bg-white rounded-3xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Completed All Sections?</h3>
                  <p className="text-xs text-slate-500">Record your progress and evaluate your skill mastery.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="primary"
                    onClick={handleCompleteLesson}
                    disabled={completing}
                    className="gap-2 bg-teal-600 hover:bg-teal-700 min-h-[44px]"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{completing ? "Saving..." : isCompleted ? "Lesson Completed" : "Mark Lesson Complete"}</span>
                  </Button>
                  {isCompleted && nextLessonInfo?.eligible && (
                    <Button
                      variant="primary"
                      onClick={() => handleNav(`/student/lessons/${nextLessonInfo.lessonId}`)}
                      className="gap-2 min-h-[44px] px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                    >
                      <span>Proceed to Next: {nextLessonInfo.title}</span>
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Celebratory Mastery Review Card */}
          {(isCompleted || currentBlock?.type === "SUMMARY") && (
            <div className="mt-8">
              <LessonMasteryReview
                lessonId={lesson.id}
                lessonTitle={lesson.title}
                skillId={primarySkill?.id}
                skillTitle={primarySkill?.title}
                practiceSetId={practiceSetId}
                checkpointAttempts={attemptsMap}
                nextLesson={nextLessonInfo}
                onNavigate={handleNav}
                onOpenAITutor={(ctx) => {
                  setTutorContext(ctx);
                  setIsAITutorOpen(true);
                }}
              />
            </div>
          )}
        </main>

        {/* Lesson Outline Sidebar / Drawer */}
        <aside
          className={`md:w-72 shrink-0 ${
            showOutline
              ? "fixed inset-y-0 right-0 z-40 w-80 bg-white p-6 shadow-2xl overflow-y-auto block"
              : "hidden md:block"
          }`}
        >
          <div className="sticky top-20 bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-teal-600" />
                <span>Lesson Outline</span>
              </h2>
              {showOutline && (
                <button
                  type="button"
                  onClick={() => setShowOutline(false)}
                  className="md:hidden text-slate-400 hover:text-slate-700 text-lg font-bold p-1 cursor-pointer"
                  aria-label="Close outline"
                >
                  ×
                </button>
              )}
            </div>

            <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
              {blocks.map((block, idx) => {
                const isActive = activeSectionIndex === idx;
                const isBlockDone = completedBlockIds.includes(block.id);

                return (
                  <button
                    key={block.id}
                    type="button"
                    onClick={() => handleJumpToSection(idx)}
                    className={`w-full text-left p-2.5 rounded-xl border text-xs transition-all flex items-center justify-between gap-2 min-h-[44px] cursor-pointer ${
                      isActive
                        ? "bg-teal-50 border-teal-400 font-bold text-teal-950 shadow-2xs"
                        : isBlockDone
                        ? "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                        : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-5 h-5 rounded-md bg-slate-200 text-slate-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="truncate">{block.title || `${block.type} section`}</span>
                    </div>

                    <div className="shrink-0">
                      {isBlockDone ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      ) : isActive ? (
                        <span className="w-2 h-2 rounded-full bg-teal-600" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-slate-300" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Quick Session Stats */}
            <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 space-y-1">
              <div className="flex justify-between">
                <span>Completed:</span>
                <span className="font-semibold text-slate-700">
                  {completedCount} / {totalBlocks} sections
                </span>
              </div>
              <div className="flex justify-between">
                <span>Checkpoints:</span>
                <span className="font-semibold text-slate-700">
                  {Object.keys(attemptsMap).length} recorded
                </span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Embedded Socratic AI Tutor Panel */}
      <AITutorPanel
        isOpen={isAITutorOpen}
        onClose={() => setIsAITutorOpen(false)}
        context={
          tutorContext || {
            lessonId: lesson.id,
            lessonTitle: lesson.title,
            skillId: primarySkill?.id,
            skillTitle: primarySkill?.title,
          }
        }
        initialHelpLevel="CONCEPT_EXPLANATION"
      />
    </div>
  );
}
