import React, { useState } from "react";
import { Mic, Square, AlertCircle, Volume2, VolumeX, Sparkles, Loader2, X, Sliders, Radio } from "lucide-react";
import { VoiceWaveform } from "./VoiceWaveform";
import { VoiceHardwareLab } from "./VoiceHardwareLab";
import { VoiceState, VoiceError } from "@/lib/voice";

export interface VoiceTutorPanelProps {
  voiceState: VoiceState;
  interimTranscript: string;
  error: VoiceError | null;
  autoSpeak: boolean;
  onToggleAutoSpeak: () => void;
  onStopListening: () => void;
  onStopSpeaking: () => void;
  onRetry: () => void;
  onDismissError?: () => void;
  className?: string;
}

export function VoiceTutorPanel({
  voiceState,
  interimTranscript,
  error,
  autoSpeak,
  onToggleAutoSpeak,
  onStopListening,
  onStopSpeaking,
  onRetry,
  onDismissError,
  className = "",
}: VoiceTutorPanelProps) {
  const [showLabModal, setShowLabModal] = useState(false);
  const isListening = voiceState === "LISTENING";
  const isSpeaking = voiceState === "SPEAKING";
  const isProcessing = voiceState === "PROCESSING";
  const isRequesting = voiceState === "REQUESTING_PERMISSION";

  if (voiceState === "IDLE" && !error && !showLabModal) {
    return null;
  }

  return (
    <div
      role="region"
      aria-live="polite"
      aria-label="Voice Tutor status and controls"
      className={`p-3 bg-gradient-to-r from-emerald-50/80 via-teal-50/80 to-slate-50 border-y border-emerald-100 transition-all ${className}`}
    >
      {/* Requesting Permission State */}
      {isRequesting && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
            <span className="text-xs font-semibold text-blue-800">
              Please click "Allow" on the microphone prompt in your browser...
            </span>
          </div>
          <VoiceWaveform state="REQUESTING_PERMISSION" />
        </div>
      )}

      {/* Listening State */}
      {isListening && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
              <span className="text-xs font-bold text-rose-700 tracking-tight">
                Listening... Speak your question now
              </span>
            </div>
            <div className="flex items-center gap-2">
              <VoiceWaveform state="LISTENING" />
              <button
                type="button"
                onClick={onStopListening}
                aria-label="Done speaking, send message"
                className="text-[11px] font-semibold px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors shadow-2xs"
              >
                Done
              </button>
            </div>
          </div>

          {interimTranscript && (
            <p className="text-xs text-slate-700 italic bg-white/70 p-2 rounded-lg border border-emerald-200/50">
              "{interimTranscript}"
            </p>
          )}
        </div>
      )}

      {/* Processing State */}
      {isProcessing && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600 animate-spin" />
            <span className="text-xs font-semibold text-emerald-800">
              Processing your question...
            </span>
          </div>
          <VoiceWaveform state="PROCESSING" />
        </div>
      )}

      {/* Speaking State */}
      {isSpeaking && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-emerald-700 animate-pulse" />
            <span className="text-xs font-bold text-emerald-800">
              Tuklas is speaking...
            </span>
          </div>
          <div className="flex items-center gap-2">
            <VoiceWaveform state="SPEAKING" />
            <button
              type="button"
              onClick={onStopSpeaking}
              aria-label="Stop reading response aloud"
              className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-2xs"
            >
              <Square className="w-3 h-3 fill-white" />
              <span>Stop</span>
            </button>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="flex items-start gap-2 bg-amber-50 p-2.5 rounded-xl border border-amber-200 text-xs text-amber-900">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">{error.userMessage}</p>
            <div className="flex items-center gap-3 mt-1.5">
              {error.type !== "PERMISSION_DENIED" && error.type !== "NOT_SUPPORTED" && (
                <>
                  <button
                    type="button"
                    onClick={onRetry}
                    className="font-bold underline text-amber-800 hover:text-amber-950"
                  >
                    Try speaking again
                  </button>
                  <span className="text-slate-400">·</span>
                </>
              )}
              <span className="text-slate-600 font-medium">Continue using text tutor below</span>
            </div>
          </div>
          {onDismissError && (
            <button
              type="button"
              onClick={onDismissError}
              aria-label="Dismiss error"
              className="text-amber-600 hover:text-amber-800 p-0.5 rounded-md"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Voice Options (Footer) */}
      <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-emerald-100/60 text-[11px] text-slate-500">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onToggleAutoSpeak}
            aria-label={autoSpeak ? "Disable auto read aloud" : "Enable auto read aloud"}
            className="flex items-center gap-1 hover:text-emerald-700 transition-colors cursor-pointer"
          >
            {autoSpeak ? (
              <Volume2 className="w-3 h-3 text-emerald-600" />
            ) : (
              <VolumeX className="w-3 h-3 text-slate-400" />
            )}
            <span>Auto-read responses: {autoSpeak ? "On" : "Off"}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowLabModal(true)}
            className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
          >
            <Radio className="w-3 h-3" />
            <span>Audio Diagnostic Lab</span>
          </button>
        </div>

        <span className="text-[10px] text-slate-400">Voice Interface v1.2</span>
      </div>

      {/* Voice Lab Diagnostic Modal */}
      {showLabModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl border border-slate-200">
            <VoiceHardwareLab isModal onClose={() => setShowLabModal(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
