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

  const baseSize = compact ? "h-9 w-9 shrink-0 p-0 rounded-xl" : "min-h-[44px] min-w-[44px] px-3 py-2 rounded-xl text-xs sm:text-sm";

  if (!isSupported) {
    return (
      <button
        type="button"
        disabled
        title="Voice input is not available in this browser. You can continue with text."
        aria-label="Voice input not available in this browser"
        className={`${baseSize} inline-flex items-center justify-center gap-1.5 text-slate-400 bg-slate-100 cursor-not-allowed opacity-60 border border-slate-200 transition-colors ${className}`}
      >
        <MicOff className="w-4 h-4 text-slate-400 shrink-0" />
        {!compact && <span>Voice Unavailable</span>}
      </button>
    );
  }

  if (isSpeaking) {
    return (
      <button
        type="button"
        onClick={onStopSpeaking}
        title="Stop reading response aloud"
        aria-label="Stop reading response aloud"
        className={`${baseSize} inline-flex items-center justify-center gap-1.5 text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 font-semibold transition-all shadow-2xs animate-pulse ${className}`}
      >
        <Square className="w-4 h-4 text-emerald-700 fill-emerald-700 shrink-0" />
        {!compact && <span>Stop Speaking</span>}
      </button>
    );
  }

  if (isRequesting) {
    return (
      <button
        type="button"
        disabled
        title="Requesting microphone permission..."
        aria-label="Requesting microphone permission"
        className={`${baseSize} inline-flex items-center justify-center gap-1.5 text-blue-800 bg-blue-50 border border-blue-200 font-medium animate-pulse ${className}`}
      >
        <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
        {!compact && <span>Allow Microphone...</span>}
      </button>
    );
  }

  if (isProcessing) {
    return (
      <button
        type="button"
        disabled
        title="Processing your spoken question..."
        aria-label="Processing your spoken question"
        className={`${baseSize} inline-flex items-center justify-center gap-1.5 text-amber-800 bg-amber-50 border border-amber-200 font-medium ${className}`}
      >
        <Loader2 className="w-4 h-4 text-amber-600 animate-spin shrink-0" />
        {!compact && <span>Processing...</span>}
      </button>
    );
  }

  if (voiceState === "ERROR") {
    return (
      <button
        type="button"
        onClick={() => {
          console.log("[TUKLAS_MIC_DIAG] MIC_BUTTON_CLICKED (RETRY)", { voiceState, isSupported });
          onToggleVoice();
        }}
        title="Microphone error. Tap to retry"
        aria-label="Microphone error, tap to retry"
        className={`${baseSize} inline-flex items-center justify-center gap-1.5 text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 font-medium transition-all shadow-2xs ${className}`}
      >
        <MicOff className="w-4 h-4 text-amber-600 shrink-0" />
        {!compact && <span>Mic Error (Tap to retry)</span>}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        console.log("[TUKLAS_MIC_DIAG] MIC_BUTTON_CLICKED", { isListening, voiceState, isSupported });
        onToggleVoice();
      }}
      aria-pressed={isListening}
      title={isListening ? "Listening... Tap to stop" : "Use microphone to ask Tuklas"}
      aria-label={isListening ? "Stop listening to voice" : "Talk to Tuklas with microphone"}
      className={`${baseSize} inline-flex items-center justify-center gap-1.5 font-medium transition-all shadow-2xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 ${
        isListening
          ? "bg-rose-500 text-white hover:bg-rose-600 ring-2 ring-rose-400 ring-offset-1 animate-pulse border border-rose-600"
          : "bg-slate-50 text-slate-700 border border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 active:bg-emerald-100"
      } ${className}`}
    >
      <Mic className={`w-4 h-4 shrink-0 ${isListening ? "text-white animate-bounce" : "text-slate-600 hover:text-emerald-700"}`} />
      {!compact && <span>{isListening ? "Listening... (Tap to stop)" : "Talk to Tuklas"}</span>}
    </button>
  );
}
