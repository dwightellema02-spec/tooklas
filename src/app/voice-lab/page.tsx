import React from "react";
import { VoiceHardwareLab } from "@/components/ai/VoiceHardwareLab";
import { ArrowLeft } from "lucide-react";

interface VoiceLabPageProps {
  onNavigate?: (path: string) => void;
}

export default function VoiceLabPage({ onNavigate }: VoiceLabPageProps) {
  const handleBack = () => {
    if (onNavigate) {
      onNavigate("/");
    } else if (typeof window !== "undefined") {
      window.history.back();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
        </div>

        <VoiceHardwareLab />
      </div>
    </div>
  );
}

