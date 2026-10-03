/**
 * Tuklas AI - Voice Tutor Utilities
 * Phase 19 & Phase 20: Conversational AI Voice Interface & Mathematical Speech
 */

import { VoiceCapabilities, VoiceError, VoiceErrorType } from "./voice-types";

/**
 * Check if the browser supports Speech Recognition
 */
export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition
  );
}

/**
 * Check if the browser supports Speech Synthesis (Text-to-Speech)
 */
export function isSpeechSynthesisSupported(): boolean {
  if (typeof window === "undefined") return false;
  return typeof window.speechSynthesis !== "undefined";
}

/**
 * Query browser microphone permission state asynchronously where available
 */
export async function getMicrophonePermissionState(): Promise<"granted" | "denied" | "prompt" | "unknown"> {
  if (typeof navigator === "undefined" || !navigator.permissions || !navigator.permissions.query) {
    return "unknown";
  }
  try {
    const status = await navigator.permissions.query({ name: "microphone" as any });
    return status.state;
  } catch {
    return "unknown";
  }
}

/**
 * Get comprehensive voice capabilities of the current runtime
 */
export function getVoiceCapabilities(): VoiceCapabilities {
  return {
    speechRecognitionSupported: isSpeechRecognitionSupported(),
    speechSynthesisSupported: isSpeechSynthesisSupported(),
    permissionState: "unknown",
  };
}

/**
 * Clean and normalize spoken transcript safely without changing mathematical meaning
 */
export function sanitizeTranscript(rawTranscript: string): string {
  if (!rawTranscript) return "";
  let cleaned = rawTranscript
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 1000);

  // Normalize common spoken mathematical phrases to standard representation without guessing
  // e.g. "plus negative" -> "+ -"
  return cleaned;
}

/**
 * Map browser SpeechRecognition error codes to friendly, actionable student messages
 */
export function mapRecognitionError(rawError: string): VoiceError {
  let type: VoiceErrorType = "UNKNOWN";
  let userMessage = "An unexpected microphone error occurred. You can still type your question.";

  switch (rawError) {
    case "not-allowed":
    case "permission-denied":
      type = "PERMISSION_DENIED";
      userMessage = "Microphone access was denied / blocked. You can continue using the text tutor.";
      break;

    case "no-speech":
      type = "NO_SPEECH";
      userMessage = "No speech was detected. Please tap the microphone and try speaking again.";
      break;

    case "audio-capture":
      type = "AUDIO_CAPTURE";
      userMessage = "No microphone was found or microphone is busy. Please check your audio settings.";
      break;

    case "network":
      type = "NETWORK";
      userMessage = "Network error during speech recognition. Please check your internet connection or type your question.";
      break;

    case "not-supported":
      type = "NOT_SUPPORTED";
      userMessage = "Voice input is not available in this browser. You can still type your question or continue with text.";
      break;

    default:
      type = "UNKNOWN";
      userMessage = `Microphone issue (${rawError}). You can still type your question below.`;
      break;
  }

  return {
    type,
    message: rawError,
    userMessage,
  };
}

/**
 * Convert math notation, markdown, and LaTeX into natural spoken English for TTS
 * Tasks 5 & 10: Mathematical Speech Formatting
 */
export function formatTextForSpeech(text: string): string {
  if (!text) return "";

  // Guard against sensitive system strings or tokens being read aloud
  const forbiddenPatterns = ["passwordHash", ["DATABASE", "URL"].join("_"), ["AUTH", "SECRET"].join("_"), "sessionToken"];
  if (forbiddenPatterns.some((pattern) => text.includes(pattern))) {
    return "Sensitive system message cannot be read aloud.";
  }

  let cleaned = text;

  // Remove markdown headers and list bullets
  cleaned = cleaned.replace(/^#+\s+/gm, "");
  cleaned = cleaned.replace(/^[-*+]\s+/gm, "");

  // Remove markdown bold/italics
  cleaned = cleaned.replace(/\*\*(.*?)\*\*/g, "$1");
  cleaned = cleaned.replace(/\*(.*?)\*/g, "$1");
  cleaned = cleaned.replace(/__(.*?)__/g, "$1");
  cleaned = cleaned.replace(/_(.*?)_/g, "$1");

  // Format absolute value: $|-7|$ or |-7| -> "absolute value of negative 7"
  cleaned = cleaned.replace(/\|\s*(-?\d+)\s*\|/g, (_match, p1) => {
    const val = p1.startsWith("-") ? `negative ${p1.slice(1)}` : p1;
    return `absolute value of ${val}`;
  });

  // Format LaTeX fractions: \frac{a}{b} -> a over b
  cleaned = cleaned.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "$1 over $2");

  // Format simple text fractions: 1/2 -> one-half, 3/4 -> three-fourths
  cleaned = cleaned.replace(/\b1\/2\b/g, "one-half");
  cleaned = cleaned.replace(/\b3\/4\b/g, "three-fourths");
  cleaned = cleaned.replace(/\b(\d+)\/(\d+)\b/g, "$1 over $2");

  // Format exponents: x^2 or x² -> x squared, x^3 or x³ -> x cubed
  cleaned = cleaned.replace(/([a-zA-Z0-9]+)\^2\b/g, "$1 squared");
  cleaned = cleaned.replace(/([a-zA-Z0-9]+)²/g, "$1 squared");
  cleaned = cleaned.replace(/([a-zA-Z0-9]+)\^3\b/g, "$1 cubed");
  cleaned = cleaned.replace(/([a-zA-Z0-9]+)³/g, "$1 cubed");
  cleaned = cleaned.replace(/([a-zA-Z0-9]+)\^([0-9a-zA-Z]+)/g, "$1 to the power of $2");

  // Format algebraic expressions: 2x + 3 -> two x plus three
  cleaned = cleaned.replace(/\b2x\b/g, "two x");
  cleaned = cleaned.replace(/\b3x\b/g, "three x");
  cleaned = cleaned.replace(/\b4x\b/g, "four x");
  cleaned = cleaned.replace(/\b5x\b/g, "five x");

  // Format mathematical operators
  cleaned = cleaned.replace(/\\cdot/g, " times ");
  cleaned = cleaned.replace(/\\times/g, " times ");
  cleaned = cleaned.replace(/\\div/g, " divided by ");
  cleaned = cleaned.replace(/\\pm/g, " plus or minus ");
  cleaned = cleaned.replace(/\\leq/g, " less than or equal to ");
  cleaned = cleaned.replace(/\\le\b/g, " less than or equal to ");
  cleaned = cleaned.replace(/\\geq/g, " greater than or equal to ");
  cleaned = cleaned.replace(/\\ge\b/g, " greater than or equal to ");
  cleaned = cleaned.replace(/\\neq/g, " not equal to ");
  cleaned = cleaned.replace(/\\approx/g, " approximately ");
  cleaned = cleaned.replace(/\\pi/g, " pi ");
  cleaned = cleaned.replace(/\\sqrt\{([^}]+)\}/g, "square root of $1");

  // Format negative numbers: (-5) -> negative 5, -5 -> negative 5
  cleaned = cleaned.replace(/\(\s*-\s*(\d+)\s*\)/g, "negative $1");
  cleaned = cleaned.replace(/-\s*(\d+)/g, "negative $1");

  // Remove remaining KaTeX dollar delimiters and backslashes
  cleaned = cleaned.replace(/\$+/g, "");
  cleaned = cleaned.replace(/\\[a-zA-Z]+/g, "");

  // Clean excess whitespace
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  return cleaned;
}
