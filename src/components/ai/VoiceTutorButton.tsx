import React from "react";
import { Mic, MicOff, Square, Loader2 } from "lucide-react";
import { VoiceState } from "@/lib/voice";

export interface VoiceTutorButtonProps {
  voiceState: VoiceState;
  isSupported: boolean;
  onToggleVoice: () => void;
  onStopSpeaking?: () => void;
  className?: string;
  compact?: boolean;
}

export function VoiceTutorButton({
  voiceState,
  isSupported,
  onToggleVoice,
  onStopSpeaking,
  className = "",
  compact = false,
}: VoiceTutorButtonProps) {
  const isListening = voiceState === "LISTENING";
  const isSpeaking = voiceState === "SPEAKING";
  const isProcessing = voiceState === "PROCESSING";
  const isRequesting = voiceState === "REQUESTING_PERMISSION";

  if (!isSupported) {
    return (
      <button
        type="button"
        disabled
        title="Voice input is not available in this browser. You can continue with text."
        aria-label="Voice input not available in this browser"
        className={`min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-slate-400 bg-slate-100 cursor-not-allowed opacity-60 text-xs sm:text-sm ${className}`}
      >
        <MicOff className="w-4 h-4 text-slate-400" />
        {!compact && <span>Voice Unavailable</span>}
      </button>
    );
  }

  if (isSpeaking) {
    return (
      <button
        type="button"
        onClick={onStopSpeaking}
        aria-label="Stop reading response aloud"
        className={`min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 font-semibold text-xs sm:text-sm transition-all shadow-xs animate-pulse ${className}`}
      >
        <Square className="w-4 h-4 text-emerald-700 fill-emerald-700" />
        {!compact && <span>Stop Speaking</span>}
      </button>
    );
  }

  if (isRequesting) {
    return (
      <button
        type="button"
        disabled
        aria-label="Requesting microphone permission"
        className={`min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-blue-800 bg-blue-50 border border-blue-200 text-xs sm:text-sm font-medium animate-pulse ${className}`}
      >
        <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
        {!compact && <span>Allow Microphone...</span>}
      </button>
    );
  }

  if (isProcessing) {
    return (
      <button
        type="button"
        disabled
        aria-label="Processing your question"
        className={`min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-amber-800 bg-amber-50 border border-amber-200 text-xs sm:text-sm font-medium ${className}`}
      >
        <Loader2 className="w-4 h-4 text-amber-600 animate-spin" />
        {!compact && <span>Processing...</span>}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggleVoice}
      aria-pressed={isListening}
      aria-label={isListening ? "Stop listening to voice" : "Talk to Tuklas with microphone"}
      className={`min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl font-medium text-xs sm:text-sm transition-all shadow-xs ${
        isListening
          ? "bg-rose-500 text-white hover:bg-rose-600 ring-2 ring-rose-400 ring-offset-1 animate-pulse"
          : "bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300"
      } ${className}`}
    >
      <Mic className={`w-4 h-4 ${isListening ? "text-white animate-bounce" : "text-emerald-600"}`} />
      {!compact && <span>{isListening ? "Listening... (Tap to stop)" : "Talk to Tuklas"}</span>}
    </button>
  );
}
