import React from "react";

export interface VoiceWaveformProps {
  state: "REQUESTING_PERMISSION" | "LISTENING" | "SPEAKING" | "PROCESSING" | "IDLE";
  className?: string;
}

export function VoiceWaveform({ state, className = "" }: VoiceWaveformProps) {
  const isListening = state === "LISTENING";
  const isSpeaking = state === "SPEAKING";
  const isProcessing = state === "PROCESSING";
  const isRequesting = state === "REQUESTING_PERMISSION";

  if (state === "IDLE") return null;

  return (
    <div
      className={`flex items-center justify-center gap-1 h-6 px-3 py-1 rounded-full ${
        isListening
          ? "bg-rose-50 border border-rose-200"
          : isSpeaking
          ? "bg-emerald-50 border border-emerald-200"
          : isRequesting
          ? "bg-blue-50 border border-blue-200"
          : "bg-amber-50 border border-amber-200"
      } ${className}`}
      aria-hidden="true"
    >
      {[1, 2, 3, 4, 5].map((bar) => {
        let heightClass = "h-2";
        let animationClass = "";

        if (isListening) {
          animationClass = "animate-pulse bg-rose-500";
          if (bar === 1 || bar === 5) heightClass = "h-2";
          if (bar === 2 || bar === 4) heightClass = "h-4";
          if (bar === 3) heightClass = "h-5";
        } else if (isSpeaking) {
          animationClass = "animate-bounce bg-emerald-600";
          if (bar === 1 || bar === 5) heightClass = "h-2.5";
          if (bar === 2 || bar === 4) heightClass = "h-4";
          if (bar === 3) heightClass = "h-5";
        } else if (isProcessing) {
          animationClass = "animate-pulse bg-amber-500";
          heightClass = "h-2.5";
        } else if (isRequesting) {
          animationClass = "animate-pulse bg-blue-500";
          heightClass = "h-2";
        }

        return (
          <span
            key={bar}
            style={{
              animationDelay: `${bar * 120}ms`,
              animationDuration: isListening ? "0.8s" : isSpeaking ? "0.6s" : "1s",
            }}
            className={`w-1 rounded-full transition-all duration-150 ${heightClass} ${animationClass}`}
          />
        );
      })}
    </div>
  );
}
