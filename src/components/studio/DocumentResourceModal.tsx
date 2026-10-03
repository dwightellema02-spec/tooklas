import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { validateDocumentMetadata } from "@/lib/storage";
import { FileText, X, AlertCircle, UploadCloud, StickyNote, CheckCircle2, Loader2, BookOpen } from "lucide-react";

export interface DocumentResourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddResource: (resource: {
    type: "PDF" | "DOCUMENT" | "IMAGE" | "TEACHER_NOTE";
    title: string;
    notes?: string;
    fileName?: string;
    fileSize?: number;
    fileContent?: string;
    storagePath?: string;
    extractionStatus?: "PENDING" | "PROCESSING" | "READY" | "FAILED";
  }) => void;
}

export function DocumentResourceModal({
  isOpen,
  onClose,
  onAddResource,
}: DocumentResourceModalProps) {
  const [activeTab, setActiveTab] = useState<"DOCUMENT" | "TEACHER_NOTE">("DOCUMENT");
  const [title, setTitle] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState<number>(0);
  const [fileContent, setFileContent] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [readingFile, setReadingFile] = useState(false);
  const [fileSelected, setFileSelected] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const val = validateDocumentMetadata({
      name: file.name,
      type: file.type || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
      size: file.size,
    });

    if (!val.isValid) {
      setError(val.error || "Invalid file format.");
      return;
    }

    setFileName(file.name);
    setFileSize(file.size);
    if (!title.trim()) {
      const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      setTitle(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
    }

    setReadingFile(true);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setFileContent(result);
      setReadingFile(false);
      setFileSelected(true);
    };
    reader.onerror = () => {
      setError("Failed to read file from disk.");
      setReadingFile(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (activeTab === "DOCUMENT") {
      if (!fileName.trim()) {
        setError("Please choose a file to upload.");
        return;
      }

      const ext = fileName.toLowerCase().split(".").pop() || "";
      const allowedExts = ["pdf", "docx", "pptx", "xlsx", "csv", "tsv", "txt", "text", "md", "markdown", "png", "jpg", "jpeg"];
      if (!allowedExts.includes(ext)) {
        setError("Supported file types: .pdf, .docx, .pptx, .xlsx, .csv, .txt, .md, .png, .jpg");
        return;
      }

      const docType = ext === "pdf" ? "PDF" : ["png", "jpg", "jpeg", "webp"].includes(ext) ? "IMAGE" : "DOCUMENT";

      onAddResource({
        type: docType,
        title: title.trim() || fileName.trim(),
        fileName: fileName.trim(),
        fileSize: fileSize || 1024,
        fileContent: fileContent || undefined,
        storagePath: `/storage/curriculum/documents/${fileName.trim()}`,
        notes: notes.trim() || undefined,
        extractionStatus: "PROCESSING",
      });
    } else {
      if (!title.trim() || !notes.trim()) {
        setError("Note title and content are required.");
        return;
      }
      onAddResource({
        type: "TEACHER_NOTE",
        title: title.trim(),
        notes: notes.trim(),
      });
    }

    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
    >
      <div className="relative w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              {activeTab === "DOCUMENT" ? <FileText className="w-5 h-5" /> : <StickyNote className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {activeTab === "DOCUMENT" ? "Attach & Extract Teacher Document" : "Add Instructional Teacher Note"}
              </h2>
              <p className="text-xs text-slate-500">PDF & DOCX text extraction grounded in AI Tutor</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Toggle */}
        <div className="flex border-b border-slate-100 px-6 pt-3 bg-slate-50/50">
          <button
            type="button"
            onClick={() => {
              setActiveTab("DOCUMENT");
              setError(null);
            }}
            className={`pb-2.5 text-xs font-semibold border-b-2 mr-4 transition-colors cursor-pointer ${
              activeTab === "DOCUMENT"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            Teacher Material (PDF / Docs / Slides / Data)
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("TEACHER_NOTE");
              setError(null);
            }}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === "TEACHER_NOTE"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            Instructional Note
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {activeTab === "DOCUMENT" ? (
            <>
              {/* File Upload Drop Area */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Upload Material (PDF, DOCX, PPTX, XLSX, CSV, TXT, MD, Image)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.pptx,.xlsx,.csv,.tsv,.txt,.md,.png,.jpg,.jpeg,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/csv,text/markdown,image/png,image/jpeg"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-xl p-4 text-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-blue-50/20"
                >
                  {readingFile ? (
                    <div className="flex flex-col items-center gap-1.5 py-2">
                      <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                      <span className="text-xs text-slate-600">Reading document...</span>
                    </div>
                  ) : fileSelected ? (
                    <div className="flex items-center justify-center gap-2 text-xs text-slate-700 py-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span className="font-semibold text-slate-800">{fileName}</span>
                      <span className="text-slate-400">({(fileSize / 1024).toFixed(1)} KB)</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1 py-1">
                      <UploadCloud className="w-6 h-6 text-slate-400" />
                      <span className="text-xs font-semibold text-slate-700">Click to select PDF or DOCX</span>
                      <span className="text-[11px] text-slate-400">Supports standard DepEd MATATAG modules (up to 25MB)</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Document Title (Displayed in Lesson)
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Grade 7 Integers & Sign Conventions"
                  className="w-full text-xs sm:text-sm px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Teacher Notes / Pedagogical Context (Optional)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Focus on Section 2 for horizontal number line comparisons."
                  className="w-full text-xs sm:text-sm p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-100 flex items-start gap-2 text-[11px] text-blue-700">
                <BookOpen className="w-4 h-4 shrink-0 mt-0.5 text-blue-600" />
                <span>
                  Tuklas AI will extract text, normalize math notation ($...$), and split the document into logical sections. Extracted content is grounded directly in the AI Tutor.
                </span>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Note Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Lesson Pacing & Misconception Alert"
                  className="w-full text-xs sm:text-sm px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Instructional Content
                </label>
                <textarea
                  rows={4}
                  required
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Explain pedagogical steps, common traps students fall into, or classroom discussion prompts..."
                  className="w-full text-xs sm:text-sm p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}

          {/* Footer CTAs */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={readingFile}>
              {activeTab === "DOCUMENT" ? "Attach & Extract Document" : "Save Note"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
