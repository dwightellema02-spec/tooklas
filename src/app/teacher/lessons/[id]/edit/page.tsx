import React, { useState, useEffect } from "react";
import { useAuth, authFetch } from "@/lib/auth/auth-context";
import { YouTubeResourceModal } from "@/components/studio/YouTubeResourceModal";
import { DocumentResourceModal } from "@/components/studio/DocumentResourceModal";
import { ContentBlockEditor, ContentBlock } from "@/components/studio/ContentBlockEditor";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LessonStatus, ResourceType } from "@prisma/client";
import {
  BookOpen,
  ArrowLeft,
  Save,
  Send,
  CheckCircle,
  Globe,
  Trash2,
  Plus,
  Youtube,
  FileText,
  StickyNote,
  Eye,
  AlertCircle,
  CheckCircle2,
  Clock,
  Layers,
  Sparkles,
  X,
} from "lucide-react";

export interface TeacherLessonEditorPageProps {
  lessonId: string;
  onNavigate?: (path: string) => void;
}

export default function TeacherLessonEditorPage({
  lessonId,
  onNavigate,
}: TeacherLessonEditorPageProps) {
  const { user } = useAuth();
  const [lesson, setLesson] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Modals
  const [ytModalOpen, setYtModalOpen] = useState(false);
  const [docModalOpen, setDocModalOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);

  // Form Fields
  const [curriculum, setCurriculum] = useState<any[]>([]);
  const [unitId, setUnitId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [estimatedMinutes, setEstimatedMinutes] = useState(20);
  const [objectives, setObjectives] = useState<string[]>([]);
  const [newObjective, setNewObjective] = useState("");
  const [resources, setResources] = useState<any[]>([]);
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([]);
  const [allSkills, setAllSkills] = useState<any[]>([]);
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);

  const handleNav = (path: string) => {
    if (onNavigate) onNavigate(path);
    else window.location.pathname = path;
  };

  const loadLessonData = async () => {
    try {
      const [lRes, sRes, cRes] = await Promise.all([
        authFetch(`/api/lessons/${lessonId}`),
        authFetch("/api/skills"),
        authFetch("/api/curriculum"),
      ]);

      if (lRes.ok) {
        const lData = await lRes.json();
        const l = lData.data;
        setLesson(l);
        setTitle(l.title || "");
        setDescription(l.description || "");
        setUnitId(l.unitId || l.unit?.id || "");
        setEstimatedMinutes(l.estimatedMinutes || 20);
        setObjectives(l.learningObjectives || []);
        setResources(l.resources || []);
        setContentBlocks(l.contentBlocks || []);
        setSelectedSkillIds(l.skills?.map((s: any) => s.skillId || s.skill?.id) || l.skillIds || []);
      } else {
        setStatusMessage({ type: "error", text: "Lesson not found." });
      }

      if (sRes.ok) {
        const sData = await sRes.json();
        setAllSkills(sData.data || []);
      }

      if (cRes.ok) {
        const cData = await cRes.json();
        setCurriculum(cData.data || []);
      }
    } catch (e) {
      console.error("Error loading lesson:", e);
      setStatusMessage({ type: "error", text: "Failed to connect to lesson server." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLessonData();
  }, [lessonId]);

  const handleSaveDraft = async () => {
    setSaving(true);
    setStatusMessage(null);
    try {
      const res = await authFetch(`/api/lessons/${lessonId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          unitId: unitId || undefined,
          estimatedMinutes,
          learningObjectives: objectives,
          resources,
          contentBlocks,
          skillIds: selectedSkillIds,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setStatusMessage({ type: "error", text: data.error || "Save failed." });
      } else {
        setLesson(data.data);
        setStatusMessage({ type: "success", text: "Lesson draft saved successfully." });
      }
    } catch (err: unknown) {
      setStatusMessage({ type: "error", text: err instanceof Error ? err.message : "Error saving draft." });
    } finally {
      setSaving(false);
    }
  };

  const handleStatusTransition = async (targetStatus: LessonStatus) => {
    setStatusMessage(null);
    setSaving(true);
    try {
      // First save current content changes
      await authFetch(`/api/lessons/${lessonId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          unitId: unitId || undefined,
          estimatedMinutes,
          learningObjectives: objectives,
          resources,
          contentBlocks,
          skillIds: selectedSkillIds,
        }),
      });

      // Then transition status
      const res = await authFetch(`/api/lessons/${lessonId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetStatus }),
      });

      const data = await res.json();
      if (!res.ok) {
        setStatusMessage({ type: "error", text: data.error || "Status update failed." });
      } else {
        setLesson(data.data);
        setStatusMessage({
          type: "success",
          text: `Lesson status transitioned to ${targetStatus}!`,
        });
      }
    } catch (err: unknown) {
      setStatusMessage({ type: "error", text: err instanceof Error ? err.message : "Status error." });
    } finally {
      setSaving(false);
    }
  };

  const handleDirectPublish = async () => {
    setStatusMessage(null);
    setSaving(true);
    try {
      // 1. Save latest changes
      await authFetch(`/api/lessons/${lessonId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          unitId: unitId || undefined,
          estimatedMinutes,
          learningObjectives: objectives,
          resources,
          contentBlocks,
          skillIds: selectedSkillIds,
        }),
      });

      // 2. Advance through review and approval if in draft
      if (lesson?.status === "DRAFT") {
        await authFetch(`/api/lessons/${lessonId}/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetStatus: "REVIEW" }),
        });
      }

      if (lesson?.status === "DRAFT" || lesson?.status === "REVIEW") {
        await authFetch(`/api/lessons/${lessonId}/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetStatus: "APPROVED" }),
        });
      }

      const res = await authFetch(`/api/lessons/${lessonId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetStatus: "PUBLISHED" }),
      });

      const data = await res.json();
      if (!res.ok) {
        setStatusMessage({ type: "error", text: data.error || "Publish failed." });
      } else {
        setLesson(data.data);
        setStatusMessage({
          type: "success",
          text: "Lesson successfully published! It is now live and available to students.",
        });
      }
    } catch (err: unknown) {
      setStatusMessage({ type: "error", text: err instanceof Error ? err.message : "Publish error." });
    } finally {
      setSaving(false);
    }
  };

  const handleAddObjective = () => {
    if (!newObjective.trim()) return;
    setObjectives([...objectives, newObjective.trim()]);
    setNewObjective("");
  };

  const handleRemoveObjective = (idx: number) => {
    setObjectives(objectives.filter((_, i) => i !== idx));
  };

  const handleAddResource = async (r: any) => {
    const tempRes = { ...r, id: `res_temp_${Date.now()}` };
    setResources([...resources, tempRes]);

    if (r.type === "YOUTUBE") {
      try {
        const res = await authFetch(`/api/lessons/${lessonId}/video`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: r.title,
            url: r.url,
            youtubeId: r.youtubeId,
            channelName: r.channelName,
            thumbnailUrl: r.thumbnailUrl,
            description: r.description,
            duration: r.duration,
            notes: r.notes,
            metadata: r.metadata,
          }),
        });
        if (res.ok) {
          const json = await res.json();
          setResources((prev) =>
            prev.map((item) => (item.id === tempRes.id ? json.data : item))
          );
        }
      } catch (e) {
        console.warn("Direct video persist warning:", e);
      }
    } else if (r.type === "PDF" || r.type === "DOCUMENT") {
      try {
        const res = await authFetch(`/api/lessons/${lessonId}/documents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: r.title,
            fileName: r.fileName,
            fileSize: r.fileSize,
            fileContent: r.fileContent,
            description: r.description,
            notes: r.notes,
          }),
        });
        if (res.ok) {
          const json = await res.json();
          setResources((prev) =>
            prev.map((item) => (item.id === tempRes.id ? json.data : item))
          );
          setStatusMessage({
            type: "success",
            text: json.extraction?.extractionStatus === "READY"
              ? `Document extracted & grounded in AI Tutor! (${json.extraction.sectionCount} sections, ${json.extraction.charCount} characters)`
              : `Document attached with status: ${json.extraction?.extractionStatus || "FAILED"}.`,
          });
        } else {
          const err = await res.json();
          setStatusMessage({
            type: "error",
            text: err.error || "Failed to upload and extract document.",
          });
        }
      } catch (e) {
        console.warn("Direct document persist warning:", e);
      }
    }
  };

  const handleRemoveResource = async (index: number) => {
    const target = resources[index];
    setResources(resources.filter((_, i) => i !== index));
    if (target?.id && !target.id.startsWith("res_temp_")) {
      try {
        if (target.type === "PDF" || target.type === "DOCUMENT") {
          await authFetch(`/api/lessons/${lessonId}/documents/${target.id}`, { method: "DELETE" });
        } else {
          await authFetch(`/api/lessons/${lessonId}/video/${target.id}`, { method: "DELETE" });
        }
      } catch (e) {
        console.warn("Resource delete error:", e);
      }
    }
  };

  const toggleSkill = (sId: string) => {
    if (selectedSkillIds.includes(sId)) {
      setSelectedSkillIds(selectedSkillIds.filter((id) => id !== sId));
    } else {
      setSelectedSkillIds([...selectedSkillIds, sId]);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-xs text-slate-400">
        Loading Teacher Content Studio...
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="py-20 text-center max-w-md mx-auto px-4">
        <h2 className="text-lg font-bold text-slate-900 mb-2">Lesson Not Found</h2>
        <Button variant="primary" onClick={() => handleNav("/teacher/lessons")}>
          Return to Lessons
        </Button>
      </div>
    );
  }

  const currentStatus: LessonStatus = lesson.status;

  return (
    <div className="py-8 sm:py-12 bg-slate-50 min-h-[calc(100vh-140px)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Navigation Breadcrumb */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <button
              onClick={() => handleNav("/teacher/lessons")}
              className="hover:text-blue-600 transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Lessons List</span>
            </button>
            <span>/</span>
            <span className="text-slate-900 font-medium">Studio Editor</span>
          </div>

          {/* Quick Preview Button */}
          {currentStatus === "PUBLISHED" && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleNav(`/student/lessons/${lessonId}`)}
              className="gap-1.5"
            >
              <Eye className="w-4 h-4 text-blue-600" />
              <span>View Published Lesson (Student Side)</span>
            </Button>
          )}
        </div>

        {/* Studio Lifecycle Action Bar */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-900 truncate max-w-sm sm:max-w-md">
                  {title || "Untitled Lesson"}
                </h1>
                <Badge
                  variant={
                    currentStatus === "PUBLISHED"
                      ? "success"
                      : currentStatus === "APPROVED"
                      ? "info"
                      : currentStatus === "REVIEW"
                      ? "warning"
                      : "secondary"
                  }
                >
                  {currentStatus}
                </Badge>
              </div>
              <p className="text-xs text-slate-500">
                {lesson.unit?.term?.grade?.name || "Grade 7"} • {lesson.unit?.title || "Numbers & Algebra"}
              </p>
            </div>
          </div>

          {/* Status Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={handleSaveDraft}
              className="gap-1.5"
            >
              <Save className="w-3.5 h-3.5 text-slate-600" />
              <span>{saving ? "Saving..." : "Save Draft"}</span>
            </Button>

            {/* DRAFT -> REVIEW */}
            {currentStatus === "DRAFT" && (
              <Button
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={() => handleStatusTransition("REVIEW")}
                className="gap-1.5 text-amber-700 border-amber-200 hover:bg-amber-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit for Review</span>
              </Button>
            )}

            {/* REVIEW -> APPROVED */}
            {currentStatus === "REVIEW" && (
              <Button
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={() => handleStatusTransition("APPROVED")}
                className="gap-1.5 text-blue-700 border-blue-200 hover:bg-blue-50"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Approve Lesson</span>
              </Button>
            )}

            {/* Quick Publish for DRAFT / REVIEW / APPROVED */}
            {currentStatus !== "PUBLISHED" && currentStatus !== "ARCHIVED" && (
              <Button
                variant="accent"
                size="sm"
                disabled={saving}
                onClick={handleDirectPublish}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Publish to Students</span>
              </Button>
            )}

            {/* PUBLISHED -> ARCHIVED */}
            {currentStatus === "PUBLISHED" && (
              <Button
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={() => handleStatusTransition("ARCHIVED")}
                className="gap-1.5 text-xs text-slate-600"
              >
                <span>Archive</span>
              </Button>
            )}
          </div>
        </div>

        {/* Feedback Alert */}
        {statusMessage && (
          <div
            className={`mb-6 p-4 rounded-xl border text-xs flex items-center justify-between font-medium ${
              statusMessage.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-red-50 border-red-200 text-red-700"
            }`}
          >
            <span>{statusMessage.text}</span>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-slate-400 hover:text-slate-700 ml-4 font-bold"
            >
              ×
            </button>
          </div>
        )}

        {/* Main Content Studio Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column (2/3): Content Blocks & Objectives */}
          <div className="lg:col-span-2 space-y-6">
            {/* 1. Basic Info Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                1. Lesson Overview
              </h2>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Lesson Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-sm font-semibold px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full text-xs sm:text-sm p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Curriculum Unit & Academic Term
                  </label>
                  <select
                    value={unitId}
                    onChange={(e) => setUnitId(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-800"
                  >
                    {(curriculum[0]?.grades?.[0]?.terms || []).flatMap((t: any) =>
                      (t.units || []).map((u: any) => (
                        <option key={u.id} value={u.id}>
                          {t.name || `Term ${t.termNumber}`} • Unit {u.sequenceOrder}: {u.title}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Estimated Minutes
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={120}
                    value={estimatedMinutes}
                    onChange={(e) => setEstimatedMinutes(parseInt(e.target.value) || 20)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* 2. Interactive Lesson Content Blocks */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    2. Lesson Content Blocks ({contentBlocks.length})
                  </h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Structured modular sections delivered sequentially to students.
                  </p>
                </div>
              </div>

              <ContentBlockEditor blocks={contentBlocks} onChange={setContentBlocks} />
            </div>

            {/* 3. Learning Objectives */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                3. Learning Objectives ({objectives.length})
              </h2>

              <div className="space-y-2">
                {objectives.map((obj, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-md bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-[10px]">
                        {idx + 1}
                      </span>
                      <span className="text-slate-800">{obj}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveObjective(idx)}
                      className="text-slate-400 hover:text-red-600 p-1"
                      title="Remove objective"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newObjective}
                  onChange={(e) => setNewObjective(e.target.value)}
                  placeholder="Enter explicit learning objective..."
                  className="flex-1 text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddObjective}
                  className="gap-1 text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Right Column (1/3): Attached Resources & Skills */}
          <div className="space-y-6">
            {/* Attached Learning Resources */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Attached Resources ({resources.length})
                  </h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Official videos, documents, and notes
                  </p>
                </div>
              </div>

              {/* Resource action buttons */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setYtModalOpen(true)}
                  className="gap-1.5 text-xs border-red-200 hover:bg-red-50 text-red-700"
                >
                  <Youtube className="w-3.5 h-3.5 text-red-600" />
                  <span>Add YouTube</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDocModalOpen(true)}
                  className="gap-1.5 text-xs border-blue-200 hover:bg-blue-50 text-blue-700"
                >
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  <span>Add Document</span>
                </Button>
              </div>

              {/* Phase 22: AI Knowledge Status Indicator */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-bold text-slate-800">AI Knowledge Grounding Status</span>
                </div>
                <div className="grid grid-cols-1 gap-1.5 text-[11px] text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>✓ Lesson content blocks ({contentBlocks.length} active)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {resources.some((r) => r.type === "PDF" && (r.status === "READY" || (r.notes && r.notes.includes('"extractionStatus":"READY"')))) ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <div className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0" />
                    )}
                    <span>
                      {resources.some((r) => r.type === "PDF")
                        ? "✓ Teacher PDF (Extracted & Grounded in AI)"
                        : "Teacher PDF (None attached)"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {resources.some((r) => r.type === "DOCUMENT" && (r.status === "READY" || (r.notes && r.notes.includes('"extractionStatus":"READY"')))) ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <div className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0" />
                    )}
                    <span>
                      {resources.some((r) => r.type === "DOCUMENT")
                        ? "✓ Teacher DOCX (Extracted & Grounded in AI)"
                        : "Teacher DOCX (None attached)"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {resources.some((r) => r.type === "YOUTUBE") ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <div className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0" />
                    )}
                    <span>
                      {resources.some((r) => r.type === "YOUTUBE")
                        ? "✓ Mathisipan video metadata (Linked)"
                        : "Mathisipan video (None attached)"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>✓ Practice questions ({selectedSkillIds.length} skills aligned)</span>
                  </div>
                </div>
              </div>

              {/* Resources List */}
              {resources.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">
                  No resources attached yet. Attach a YouTube video or PDF above.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {resources.map((r, i) => {
                    let docMeta: any = null;
                    if (r.notes) {
                      try {
                        const parsed = JSON.parse(r.notes);
                        if (parsed && typeof parsed === "object") docMeta = parsed;
                      } catch {}
                    }
                    const isDoc = r.type === "PDF" || r.type === "DOCUMENT";
                    const isFailed = r.status === "FAILED" || docMeta?.extractionStatus === "FAILED";
                    const isReady = r.status === "READY" || docMeta?.extractionStatus === "READY";

                    return (
                      <div
                        key={r.id || i}
                        className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-2 text-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2">
                            {r.type === "YOUTUBE" ? (
                              <Youtube className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                            ) : isDoc ? (
                              <FileText className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                            ) : (
                              <StickyNote className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            )}
                            <div>
                              <p className="font-semibold text-slate-800 line-clamp-1">{r.title}</p>
                              {r.fileName && (
                                <p className="text-[10px] text-slate-400 font-mono mt-0.5">{r.fileName}</p>
                              )}
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] text-slate-400 uppercase">
                                  {r.type}
                                </span>
                                {isDoc && (
                                  <>
                                    {isReady ? (
                                      <span className="text-[10px] px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded font-semibold border border-emerald-200">
                                        READY
                                      </span>
                                    ) : isFailed ? (
                                      <span className="text-[10px] px-1.5 py-0.5 bg-red-50 text-red-700 rounded font-semibold border border-red-200">
                                        FAILED
                                      </span>
                                    ) : (
                                      <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded font-semibold border border-blue-200">
                                        PROCESSING...
                                      </span>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            {isDoc && (docMeta?.previewText || isReady) && (
                              <button
                                type="button"
                                onClick={() => setPreviewDoc({ ...r, docMeta })}
                                className="text-blue-600 hover:text-blue-800 p-1 text-[11px] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                                title="Preview extracted text"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Preview</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemoveResource(i)}
                              className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                              title="Remove Resource"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Extraction stats or failure message */}
                        {isDoc && (
                          <div className="mt-1 pt-1.5 border-t border-slate-100 text-[11px] text-slate-500">
                            {isReady ? (
                              <span>
                                Extracted: {docMeta?.charCount ? docMeta.charCount.toLocaleString() : "Text"} characters • {docMeta?.sectionCount || docMeta?.chunks?.length || 1} sections
                              </span>
                            ) : isFailed ? (
                              <span className="text-red-600">
                                Extraction failed — please upload again or provide lesson text.
                              </span>
                            ) : (
                              <span className="text-blue-600">Processing document text extraction...</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Target Skills Association */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Target MATATAG Skills ({selectedSkillIds.length})
              </h2>

              <div className="space-y-2">
                {allSkills.map((skill) => {
                  const isChecked = selectedSkillIds.includes(skill.id);
                  return (
                    <div
                      key={skill.id}
                      onClick={() => toggleSkill(skill.id)}
                      className={`p-2.5 rounded-xl border cursor-pointer text-xs flex items-center justify-between transition-colors ${
                        isChecked
                          ? "bg-blue-50/80 border-blue-500 font-semibold text-blue-900"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <span className="truncate pr-2">{skill.title}</span>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        Diff {skill.difficulty?.toFixed(1)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Resource Modals */}
      <YouTubeResourceModal
        isOpen={ytModalOpen}
        onClose={() => setYtModalOpen(false)}
        onAddResource={handleAddResource}
      />
      <DocumentResourceModal
        isOpen={docModalOpen}
        onClose={() => setDocModalOpen(false)}
        onAddResource={handleAddResource}
      />

      {/* Extracted Document Preview Modal */}
      {previewDoc && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
        >
          <div className="relative w-full max-w-xl bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{previewDoc.title}</h3>
                  <p className="text-xs text-slate-500 font-mono">{previewDoc.fileName}</p>
                </div>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded-xl text-center">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Status</span>
                  <span className="font-bold text-emerald-600">{previewDoc.docMeta?.extractionStatus || previewDoc.status || "READY"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Characters</span>
                  <span className="font-bold text-slate-800">{previewDoc.docMeta?.charCount ? previewDoc.docMeta.charCount.toLocaleString() : "—"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Sections</span>
                  <span className="font-bold text-slate-800">{previewDoc.docMeta?.sectionCount || previewDoc.docMeta?.chunks?.length || 1}</span>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-slate-700 mb-1.5 uppercase text-[10px] tracking-wider">
                  Extracted Content Preview (Grounded in AI Tutor)
                </h4>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-slate-700 whitespace-pre-wrap font-sans text-xs leading-relaxed max-h-60 overflow-y-auto">
                  {previewDoc.docMeta?.previewText || previewDoc.docMeta?.extractedText || previewDoc.notes || "No preview available."}
                </div>
              </div>

              {previewDoc.docMeta?.chunks && previewDoc.docMeta.chunks.length > 0 && (
                <div>
                  <h4 className="font-semibold text-slate-700 mb-1.5 uppercase text-[10px] tracking-wider">
                    Extracted Logical Chunks ({previewDoc.docMeta.chunks.length})
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {previewDoc.docMeta.chunks.slice(0, 5).map((chk: any, idx: number) => (
                      <div key={chk.id || idx} className="p-2.5 bg-slate-50/80 rounded-lg border border-slate-200/80 text-[11px]">
                        <p className="font-bold text-blue-900 mb-0.5">{chk.heading}</p>
                        <p className="text-slate-600 line-clamp-2">{chk.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setPreviewDoc(null)}>
                Close Preview
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
