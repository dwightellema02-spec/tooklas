import React, { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/lib/auth/auth-context";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

interface MisconceptionRow {
  id: string;
  skillTitle: string | null;
  concept: string;
  belief: string;
  status: string;
  confidence: number;
  observation: string;
  observedAnswers: Array<{ questionId: string; answer: string; predicted: number }>;
  alternatives: Array<{ id: string; text: string; kind: string }>;
  checks: Array<{ kind: string; questionId: string; answer: string; outcome: string; at: string }>;
  teacherNote: string | null;
  updatedAt: string;
}

const STATUS_TEXT: Record<string, string> = {
  SUSPECTED: "Suspected (from answers only)",
  CHECKING: "Waiting for the student's answer to a check question",
  SUPPORTED: "Supported by the student's own follow-up answer",
  NOT_SUPPORTED: "Not supported (the follow-up answer did not match)",
  CORRECTING: "Correction given, verification question waiting",
  RESOLVED: "Resolved (verification answered correctly)",
  PERSISTING: "Still showing after the correction",
  DISMISSED: "Dismissed by a teacher",
};

const OUTCOME_TEXT: Record<string, string> = {
  CORRECT: "answered correctly",
  PREDICTED_ERROR: "gave the answer this idea predicts",
  OTHER_ERROR: "gave a different wrong answer",
};

/**
 * Suspected misconceptions for one student. These are hypotheses with the evidence behind them, not diagnoses: the
 * catalog they come from was written as a draft and has not been reviewed by a teacher yet.
 */
export function MisconceptionList({ studentId }: { studentId: string }) {
  const [rows, setRows] = useState<MisconceptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`/api/teacher/students/${studentId}/misconceptions`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not load suspected misconceptions.");
      setRows(json.data || []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load suspected misconceptions.");
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (id: string, body: { status?: string; teacherNote?: string }) => {
    const res = await authFetch(`/api/teacher/students/${studentId}/misconceptions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) load();
    else setError("Could not save your decision.");
  };

  return (
    <section className="space-y-3" data-testid="misconception-list">
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Suspected misconceptions ({rows.length})</h3>
        <p className="text-[11px] text-slate-500 mt-1">
          Hypotheses built from the student's wrong answers and their follow-up answers. The list of ideas is an AI-written draft that has not been reviewed
          by a teacher yet, so check each one against what you know of the student.
        </p>
      </div>
      {error && <p className="text-xs text-amber-700">{error}</p>}
      {loading ? (
        <div className="py-4 text-center text-xs text-slate-400">Loading...</div>
      ) : rows.length === 0 ? (
        <div className="py-4 text-center text-xs text-slate-400 bg-white rounded-xl border border-slate-200">None suspected so far.</div>
      ) : (
        rows.map((r) => (
          <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-4 text-xs space-y-2" data-testid="misconception-row">
            <div className="flex flex-wrap items-center gap-2 justify-between">
              <span className="font-bold text-slate-900">{r.concept}</span>
              <div className="flex items-center gap-2">
                <Badge variant={r.status === "RESOLVED" ? "success" : r.status === "PERSISTING" ? "warning" : r.status === "DISMISSED" || r.status === "NOT_SUPPORTED" ? "secondary" : "info"}>
                  {r.status.replace("_", " ")}
                </Badge>
                <span className="text-slate-500">confidence {Math.round(r.confidence * 100)}%</span>
              </div>
            </div>
            {r.skillTitle && <p className="text-slate-500">{r.skillTitle}</p>}
            <p className="text-slate-700">
              <span className="font-semibold">Possible idea: </span>
              {r.belief}
            </p>
            <p className="text-slate-600">
              <span className="font-semibold">Evidence: </span>
              {r.observation} {STATUS_TEXT[r.status] ? `Status: ${STATUS_TEXT[r.status]}.` : ""}
            </p>
            {r.checks.length > 0 && (
              <ul className="list-disc pl-5 text-slate-600">
                {r.checks.map((c, i) => (
                  <li key={i}>
                    {c.kind === "DIAGNOSTIC" ? "Check question" : "Verification question"}: the student {OUTCOME_TEXT[c.outcome] || c.outcome} ("{c.answer}").
                  </li>
                ))}
              </ul>
            )}
            {r.alternatives.length > 0 && (
              <p className="text-slate-500">
                <span className="font-semibold">Not ruled out: </span>
                {r.alternatives.map((a) => a.text).join("; ")}.
              </p>
            )}
            {r.teacherNote && <p className="text-slate-700">Teacher note: {r.teacherNote}</p>}
            <div className="flex flex-wrap gap-2 pt-1">
              {r.status !== "DISMISSED" && (
                <Button size="sm" variant="outline" onClick={() => act(r.id, { status: "DISMISSED" })}>
                  Dismiss
                </Button>
              )}
              {r.status !== "SUPPORTED" && r.status !== "DISMISSED" && (
                <Button size="sm" variant="outline" onClick={() => act(r.id, { status: "SUPPORTED" })}>
                  Confirm
                </Button>
              )}
              {r.status === "DISMISSED" && (
                <Button size="sm" variant="outline" onClick={() => act(r.id, { status: "SUSPECTED" })}>
                  Reopen
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const note = window.prompt("Note about this student and this idea:", r.teacherNote || "");
                  if (note !== null) act(r.id, { teacherNote: note });
                }}
              >
                Add note
              </Button>
            </div>
          </div>
        ))
      )}
    </section>
  );
}
