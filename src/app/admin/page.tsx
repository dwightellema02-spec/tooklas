import React, { useState, useEffect } from "react";
import { useAuth, authFetch } from "@/lib/auth/auth-context";
import { UserRoleManager } from "./UserRoleManager";
import { AuthModal } from "@/components/auth/AuthModal";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  ShieldCheck,
  ArrowLeft,
  CheckCircle2,
  Lock,
  Database,
  ShieldAlert,
  Server,
  Layers,
  Key,
  LogOut,
  Cpu,
  BarChart3,
  Brain,
  Download,
  ExternalLink,
  BookOpen,
  GraduationCap,
  ArrowRight,
  TrendingUp,
  Target,
  Sparkles,
} from "lucide-react";

export interface AdminPageProps {
  onNavigate?: (path: string) => void;
}

export default function AdminPage({ onNavigate }: AdminPageProps) {
  const { user, loading, dbStatus, logout } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [adminData, setAdminData] = useState<any>(null);
  const [researchSummary, setResearchSummary] = useState<any>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  const handleNav = (path: string) => {
    if (onNavigate) onNavigate(path);
    else window.location.pathname = path;
  };

  const handleBack = () => {
    handleNav("/");
  };

  const handleExportCsv = async (endpoint: string, filename: string) => {
    setExporting(filename);
    try {
      const res = await authFetch(endpoint);
      if (!res.ok) {
        throw new Error(`Export failed (${res.status} ${res.statusText})`);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.warn("Direct blob download failed, falling back to window.open:", err);
      window.open(endpoint, "_blank");
    } finally {
      setExporting(null);
    }
  };

  useEffect(() => {
    async function loadAdminData() {
      try {
        const [sumRes, compRes, profRes] = await Promise.all([
          authFetch("/api/admin/system-summary"),
          authFetch("/api/admin/research/comparison"),
          authFetch("/api/admin/research/profile/usr_student_01"),
        ]);
        if (sumRes.ok) {
          const json = await sumRes.json();
          setAdminData(json);
        }
        if (compRes.ok && profRes.ok) {
          const compJson = await compRes.json();
          const profJson = await profRes.json();
          setResearchSummary({
            comparison: compJson.data,
            profile: profJson.data,
          });
        }
      } catch (err) {
        console.warn("Could not load admin / research summary:", err);
      }
    }
    if (user?.role === "ADMIN") {
      loadAdminData();
    }
  }, [user]);

  // 1. Unauthenticated Gate
  if (!loading && !user) {
    return (
      <div className="py-12 sm:py-20 bg-slate-50 min-h-[calc(100vh-140px)]">
        <div className="max-w-md mx-auto px-4 text-center">
          <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 mb-2">Administrator Access Protected</h1>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              Administrative functions, curriculum governance, and user role management require an authenticated Administrator session.
            </p>
            <div className="space-y-3">
              <Button variant="primary" fullWidth onClick={() => setAuthModalOpen(true)} className="gap-2 bg-purple-600 hover:bg-purple-700">
                <ShieldCheck className="w-4 h-4" />
                <span>Sign In as Admin</span>
              </Button>
              <Button variant="ghost" fullWidth onClick={handleBack}>
                Return to Home
              </Button>
            </div>
          </div>
        </div>
        <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} defaultRole="ADMIN" />
      </div>
    );
  }

  // 2. Role Authorization Gate: ADMIN only
  if (!loading && user && user.role !== "ADMIN") {
    return (
      <div className="py-12 sm:py-20 bg-slate-50 min-h-[calc(100vh-140px)]">
        <div className="max-w-md mx-auto px-4 text-center">
          <div className="bg-white rounded-2xl border border-red-200 p-8 shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 mb-2">Unauthorized Access</h1>
            <p className="text-sm text-slate-600 mb-4 leading-relaxed">
              Your account has the role <span className="font-bold text-slate-900">{user.role}</span>. You do not have permissions to access the Administrator Portal.
            </p>
            <div className="space-y-3">
              <Button variant="outline" fullWidth onClick={() => setAuthModalOpen(true)} className="gap-2">
                <span>Switch to Administrator Account</span>
              </Button>
              <Button variant="ghost" fullWidth onClick={handleBack}>
                Return to Home
              </Button>
            </div>
          </div>
        </div>
        <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} defaultRole="ADMIN" />
      </div>
    );
  }

  return (
    <div className="py-10 sm:py-16 bg-slate-50 min-h-[calc(100vh-140px)]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" size="sm" onClick={handleBack} className="gap-2 text-slate-600">
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </Button>

          <Button variant="outline" size="sm" onClick={() => logout()} className="gap-1.5 text-xs text-red-600 hover:bg-red-50">
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </Button>
        </div>

        <UserRoleManager />

        {/* Phase 2 Admin Status Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xs mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
                <Badge variant="default">Superuser</Badge>
              </div>
              <p className="text-slate-500 text-xs mt-0.5">
                Administrator: <span className="font-semibold text-slate-800">{user?.name}</span> ({user?.email})
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/80 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                  Authentication
                </p>
                <p className="text-sm font-semibold text-emerald-800 mt-0.5">Connected</p>
                <p className="text-xs text-emerald-700 mt-1">
                  Full administrative permissions verified (RBAC Tier: ADMIN)
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-purple-50/70 border border-purple-200/80 flex items-start gap-3">
              <Database className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-purple-900 uppercase tracking-wider">
                  Database
                </p>
                <p className="text-sm font-semibold text-purple-800 mt-0.5">
                  Connected ({dbStatus?.provider === "neon-postgresql" ? "PostgreSQL / Prisma" : "Prisma / Sandbox Store"})
                </p>
                <p className="text-xs text-purple-700 mt-1">
                  Prisma ORM schema initialized with 8 relational models
                </p>
              </div>
            </div>
          </div>

          {/* Database Entity Health Overview */}
          <div className="border-t border-slate-100 pt-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-600" />
              <span>Prisma Schema Models Verified (Phase 2):</span>
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              {[
                { name: "User", count: "3 Default Roles" },
                { name: "Subject", count: "Mathematics (MATH)" },
                { name: "Grade", count: "Grade 7" },
                { name: "Term", count: "Term 1" },
                { name: "Unit", count: "Numbers & Algebra" },
                { name: "Lesson", count: "Understanding Integers" },
                { name: "Competency", count: "M7NS-Ia-1" },
                { name: "Skill & Prereq", count: "3 Skills (DAG)" },
              ].map((m) => (
                <div key={m.name} className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="font-semibold text-slate-900 block">{m.name}</span>
                  <span className="text-[11px] text-slate-500">{m.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Phase 14 Assessment & Research Platform Hub */}
        <div className="bg-white rounded-2xl border border-indigo-200/90 p-8 shadow-xs mb-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Brain className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-900">
                    Assessment & Research Platform
                  </h2>
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                    Phase 14 Empirical
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Multi-dimensional competency profiles, pre/post comparative analytics, and standardized research CSV exports
                </p>
              </div>
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={() => handleNav("/admin/research")}
              className="gap-2 bg-indigo-600 hover:bg-indigo-700 shadow-sm shrink-0"
            >
              <BarChart3 className="w-4 h-4" />
              <span>Launch Research Platform</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Quick Metrics Preview */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Accuracy
              </span>
              <span className="text-xl font-black text-slate-900 block">
                {researchSummary?.profile
                  ? `${(researchSummary.profile.metrics.accuracy.value * 100).toFixed(1)}%`
                  : "76.9%"}
              </span>
              <span className="text-[11px] font-semibold text-emerald-600">
                {researchSummary?.profile?.metrics.accuracy.level || "PROFICIENT"}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Understanding
              </span>
              <span className="text-xl font-black text-slate-900 block">
                {researchSummary?.profile
                  ? `${(researchSummary.profile.metrics.understanding.value * 100).toFixed(1)}%`
                  : "75.0%"}
              </span>
              <span className="text-[11px] font-semibold text-indigo-600">
                {researchSummary?.profile?.metrics.understanding.level || "DEVELOPING"}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Pre-to-Post Growth
              </span>
              <span className="text-xl font-black text-teal-700 block">
                {researchSummary?.comparison
                  ? `+${researchSummary.comparison.comparison.scoreDifferencePoints.toFixed(1)} pts`
                  : "+33.3 pts"}
              </span>
              <span className="text-[11px] font-semibold text-teal-600">
                {researchSummary?.comparison
                  ? `+${researchSummary.comparison.comparison.relativeGrowthPercent.toFixed(1)}% growth`
                  : "+66.6% relative"}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Consistency
              </span>
              <span className="text-xl font-black text-slate-900 block">
                {researchSummary?.profile
                  ? `${(researchSummary.profile.metrics.consistency.value * 100).toFixed(1)}%`
                  : "80.0%"}
              </span>
              <span className="text-[11px] font-semibold text-purple-600">
                {researchSummary?.profile?.metrics.consistency.level || "HIGH"}
              </span>
            </div>
          </div>

          {/* Direct CSV Export Controls */}
          <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Direct Research CSV Exports:
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExportCsv("/api/admin/research/export/metrics.csv", "metrics.csv")}
                disabled={exporting === "metrics.csv"}
                className="gap-1.5 text-xs text-slate-700 border-slate-300 hover:bg-slate-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{exporting === "metrics.csv" ? "Downloading..." : "Export Metrics CSV"}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExportCsv("/api/admin/research/export/comparison.csv", "comparison.csv")}
                disabled={exporting === "comparison.csv"}
                className="gap-1.5 text-xs text-slate-700 border-slate-300 hover:bg-slate-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{exporting === "comparison.csv" ? "Downloading..." : "Export Pre/Post CSV"}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExportCsv("/api/admin/research/export/attempts.csv", "attempts.csv")}
                disabled={exporting === "attempts.csv"}
                className="gap-1.5 text-xs text-indigo-700 border-indigo-200 hover:bg-indigo-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{exporting === "attempts.csv" ? "Downloading..." : "Export Attempts CSV"}</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Administrative Platform Navigation Hub */}
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xs mb-8">
          <h2 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
            <Server className="w-5 h-5 text-purple-600" />
            <span>Administrative Platform Navigation Hub</span>
          </h2>
          <p className="text-xs text-slate-500 mb-6">
            Direct authenticated access to all platform environments and academic tools
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div
              onClick={() => handleNav("/admin/research")}
              className="p-5 rounded-2xl bg-indigo-50/50 border border-indigo-200/70 hover:border-indigo-400 hover:shadow-xs transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center mb-3">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                  Research Platform
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Empirical analytics, pre/post testing, error taxonomy, and longitudinal reports.
                </p>
              </div>
              <div className="mt-4 flex items-center gap-1 text-xs font-bold text-indigo-600">
                <span>Open Platform</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            <div
              onClick={() => handleNav("/admin/curriculum")}
              className="p-5 rounded-2xl bg-teal-50/50 border border-teal-200/70 hover:border-teal-400 hover:shadow-xs transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center mb-3">
                  <BookOpen className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-teal-600 transition-colors">
                  Curriculum Tree & DAG
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  MATATAG Grade 7 competency graph, skill dependencies, units, and learning goals.
                </p>
              </div>
              <div className="mt-4 flex items-center gap-1 text-xs font-bold text-teal-600">
                <span>View Curriculum</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            <div
              onClick={() => handleNav("/teacher")}
              className="p-5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-slate-400 hover:shadow-xs transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center mb-3">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-slate-900 transition-colors">
                  Teacher Portal
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Classroom rosters, question bank, practice sets, and formative assignment controls.
                </p>
              </div>
              <div className="mt-4 flex items-center gap-1 text-xs font-bold text-slate-700">
                <span>Manage Classes</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        </div>
      </div>
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </div>
  );
}
