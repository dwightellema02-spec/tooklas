/**
 * Tuklas AI - Voice Tutor Type Definitions
 * Phase 19 & Phase 20: Conversational AI Voice Interface & Hardening
 */

export type VoiceState =
  | "IDLE"
  | "REQUESTING_PERMISSION"
  | "LISTENING"
  | "PROCESSING"
  | "SPEAKING"
  | "ERROR"
  | "UNSUPPORTED";

export type VoiceErrorType =
  | "PERMISSION_DENIED"
  | "NOT_SUPPORTED"
  | "NO_SPEECH"
  | "NETWORK"
  | "AUDIO_CAPTURE"
  | "UNKNOWN";

export interface VoiceError {
  type: VoiceErrorType;
  message: string;
  userMessage: string;
  isFatal?: boolean;
}

export interface SpeechRecognitionOptions {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
}

export interface SpeechSynthesisOptions {
  lang?: string;
  pitch?: number;
  rate?: number;
  volume?: number;
  voiceName?: string;
}

export interface VoiceCapabilities {
  speechRecognitionSupported: boolean;
  speechSynthesisSupported: boolean;
  permissionState?: "granted" | "denied" | "prompt" | "unknown";
}

export interface VoiceTranscriptResult {
  transcript: string;
  isFinal: boolean;
  confidence?: number;
}

export interface VoiceTutorState {
  state: VoiceState;
  transcript: string;
  interimTranscript: string;
  error: VoiceError | null;
  isSpeaking: boolean;
  isListening: boolean;
  isSupported: boolean;
  autoSpeakResponse: boolean;
}
