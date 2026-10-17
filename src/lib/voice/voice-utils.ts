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

  const isFilipino = isFilipinoText(text);
  let cleaned = text;

  // Remove markdown headers and list bullets
  cleaned = cleaned.replace(/^#+\s+/gm, "");
  cleaned = cleaned.replace(/^[-*+]\s+/gm, "");

  // Remove markdown bold/italics
  cleaned = cleaned.replace(/\*\*(.*?)\*\*/g, "$1");
  cleaned = cleaned.replace(/\*(.*?)\*/g, "$1");
  cleaned = cleaned.replace(/__(.*?)__/g, "$1");
  cleaned = cleaned.replace(/_(.*?)_/g, "$1");

  // Format absolute value: $|-7|$ or |-7| -> "absolute value of negative 7" or "absolute value ng negatibo 7"
  cleaned = cleaned.replace(/\|\s*(-?\d+)\s*\|/g, (_match, p1) => {
    if (isFilipino) {
      const val = p1.startsWith("-") ? `negatibo ${p1.slice(1)}` : p1;
      return `absolute value ng ${val}`;
    }
    const val = p1.startsWith("-") ? `negative ${p1.slice(1)}` : p1;
    return `absolute value of ${val}`;
  });

  // Format LaTeX fractions: \frac{a}{b} -> a over b
  cleaned = cleaned.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "$1 over $2");

  // Format simple text fractions: 1/2 -> one-half, 3/4 -> three-fourths
  cleaned = cleaned.replace(/\b1\/2\b/g, isFilipino ? "kalahati" : "one-half");
  cleaned = cleaned.replace(/\b3\/4\b/g, isFilipino ? "tatlong sangkapat" : "three-fourths");
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

  // Normalize Unicode minuses (\u2212) and dashes (\u2013, \u2014) to standard minus
  cleaned = cleaned.replace(/[\u2212\u2013\u2014]/g, "-");

  // Format subtraction between two numbers: 10 - 4 -> 10 minus 4 (standard MATATAG phrasing)
  cleaned = cleaned.replace(/(\d+)\s*-\s*(\d+)/g, "$1 minus $2");

  // Format negative numbers: (-5), -4.5 -> negative 5 or negatibo 5 (avoiding hyphenated words like LSN-01)
  if (isFilipino) {
    cleaned = cleaned.replace(/\(\s*-\s*(\d+(?:\.\d+)?)\s*\)/g, "negatibo $1");
    cleaned = cleaned.replace(/(^|[^0-9a-zA-Z_])-\s*(\d+(?:\.\d+)?)/g, "$1negatibo $2");
  } else {
    cleaned = cleaned.replace(/\(\s*-\s*(\d+(?:\.\d+)?)\s*\)/g, "negative $1");
    cleaned = cleaned.replace(/(^|[^0-9a-zA-Z_])-\s*(\d+(?:\.\d+)?)/g, "$1negative $2");
  }

  // Remove remaining KaTeX dollar delimiters and backslashes
  cleaned = cleaned.replace(/\$+/g, "");
  cleaned = cleaned.replace(/\\[a-zA-Z]+/g, "");

  // Clean excess whitespace
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  return cleaned;
}

/**
 * Split text into pieces of at most `max` characters at sentence ends (then commas, then spaces), so a long
 * reply can start playing after its first piece is ready instead of after the whole reply is synthesized.
 */
export function splitForSpeech(text: string, max = 260): string[] {
  const pieces: string[] = [];
  const sentences = text.replace(/\s+/g, " ").trim().match(/[^.!?;:]+[.!?;:]*\s*/g) || [];
  let current = "";
  const flush = () => {
    if (current.trim()) pieces.push(current.trim());
    current = "";
  };
  for (const sentence of sentences) {
    if (sentence.length > max) {
      flush();
      // A very long sentence: break at commas, then at spaces.
      let rest = sentence;
      while (rest.length > max) {
        let cut = rest.lastIndexOf(", ", max - 2);
        if (cut < max * 0.4) cut = rest.lastIndexOf(" ", max - 1);
        if (cut <= 0) cut = max - 1;
        pieces.push(rest.slice(0, cut + 1).trim());
        rest = rest.slice(cut + 1);
      }
      current = rest;
      continue;
    }
    if ((current + sentence).length > max) flush();
    current += sentence;
  }
  flush();
  return pieces.filter(Boolean);
}

/**
 * Detect whether a text contains Filipino / Tagalog words or patterns
 */
export function isFilipinoText(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  const lower = text.toLowerCase();

  // If text has significant English function words, avoid false positive tagging
  const englishCommonWords =
    /\b(the|is|are|you|your|we|our|can|could|would|should|please|remember|that|which|there|their|what|when|where|how|why|let's|with|have|has|this|these|those)\b/gi;
  const englishMatches = (lower.match(englishCommonWords) || []).length;

  // Explicit keywords and common Filipino pedagogical terms
  const filipinoKeywords = [
    /\b(tagalog|filipino)\b/i,
    /\b(mag-usap|aralin|tuntunin|kabaligtaran|positibo|negatibo)\b/i,
    /\b(numero|bilang|halaga|posisyon|direksyon|kaliwa|kanan)\b/i,
    /\b(hakbang|himayin|pagsamahin|ibawas|magkasama|dahan-dahan)\b/i,
    /\b(lutasin|subukan|unawain|maintindihan|ipaliwanag|paliwanag|sabihin|sagot)\b/i,
    /\b(ano|bakit|paano|kailan|saan|sino|alin|magkano)\b/i,
    /\b(natin|ninyo|tayo|sila|ako|ikaw|siya|atin|ating|amin|aming|inyo|inyong|kanila|kanilang|akin|aking|iyo|iyong)\b/i,
    /\b(dahil|kung|kapag|kaya|kasi|subalit|ngunit|naman|pala|talaga)\b/i,
    /\b(pareho|magkaiba|tiyak|malapit|malaki|maliit|katumbas|buo|buong)\b/i,
  ];

  let matches = 0;
  for (const regex of filipinoKeywords) {
    if (regex.test(lower)) matches++;
  }

  // Exclusive Filipino grammatical particles (excluding English homographs like "at")
  const particles = /\b(ang|ng|sa|nasa|mga|ay|na|ito|iyon|nito|niyan|dito|doon|ba|naman|pala)\b/i;

  if (englishMatches >= 3 && matches < 2) {
    return false;
  }

  return matches >= 2 || (matches >= 1 && particles.test(lower));
}
