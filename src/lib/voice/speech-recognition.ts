/**
 * Tuklas AI - Speech Recognition Controller
 * Phase 19 & Phase 20: Conversational AI Voice Interface & Hardened Lifecycle
 */

import {
  SpeechRecognitionOptions,
  VoiceError,
  VoiceTranscriptResult,
} from "./voice-types";
import {
  isSpeechRecognitionSupported,
  mapRecognitionError,
  sanitizeTranscript,
} from "./voice-utils";

export interface SpeechRecognitionCallbacks {
  onRequestingPermission?: () => void;
  onStart?: () => void;
  onResult?: (result: VoiceTranscriptResult) => void;
  onError?: (error: VoiceError) => void;
  onEnd?: () => void;
}

export class SpeechRecognitionController {
  private recognitionInstance: any = null;
  private listening: boolean = false;
  private requestingPermission: boolean = false;
  private starting: boolean = false;
  private callbacks: SpeechRecognitionCallbacks;
  private defaultLanguage: string = "fil-PH"; // Philippine national language & MATATAG aligned
  private visibilityHandler: (() => void) | null = null;
  private lastSanitizedTranscript: string = "";

  constructor(callbacks: SpeechRecognitionCallbacks = {}) {
    this.callbacks = callbacks;
    this.setupVisibilityListener();
    if (typeof window !== "undefined") {
      (window as any).__TUKLAS_SPEECH_CONTROLLER__ = this;
    }
  }

  /**
   * Programmatically deliver a transcript (useful for testing or fallback accessibility input)
   */
  public deliverTranscript(transcript: string, isFinal: boolean = true) {
    const sanitized = sanitizeTranscript(transcript);
    if (sanitized) {
      this.lastSanitizedTranscript = sanitized;
      this.callbacks.onResult?.({
        transcript: sanitized,
        isFinal,
        confidence: 1.0,
      });
    }
  }

  private setupVisibilityListener() {
    if (typeof document !== "undefined") {
      this.visibilityHandler = () => {
        if (document.hidden && this.listening) {
          // Cleanly stop listening if user navigates away or switches tabs
          this.stop();
        }
      };
      document.addEventListener("visibilitychange", this.visibilityHandler);
    }
  }

  public setCallbacks(callbacks: SpeechRecognitionCallbacks) {
    this.callbacks = callbacks;
  }

  public isSupported(): boolean {
    return isSpeechRecognitionSupported();
  }

  public isListening(): boolean {
    return this.listening;
  }

  public isRequestingPermission(): boolean {
    return this.requestingPermission;
  }

  /**
   * Start speech recognition session on intentional user action
   */
  public async start(options: SpeechRecognitionOptions = {}): Promise<boolean> {
    if (!this.isSupported()) {
      this.callbacks.onError?.({
        type: "NOT_SUPPORTED",
        message: "SpeechRecognition API not available in this browser environment.",
        userMessage: "Voice input is not available in this browser. You can continue with text.",
      });
      return false;
    }

    // Prevent duplicate concurrent starts or invalid transitions
    if (this.listening || this.starting) {
      return true;
    }

    this.starting = true;
    this.lastSanitizedTranscript = "";

    try {
      // 1. Proactively check microphone permission state without terminating the media device
      if (typeof navigator !== "undefined" && navigator.permissions?.query) {
        try {
          const perm = await navigator.permissions.query({ name: "microphone" as any });
          if (perm.state === "denied") {
            this.starting = false;
            this.listening = false;
            const voiceErr: VoiceError = {
              type: "PERMISSION_DENIED",
              message: "Microphone access blocked in browser settings.",
              userMessage: "Microphone access was blocked. Please click the lock or camera icon in your address bar to allow microphone access, then try again.",
            };
            this.callbacks.onError?.(voiceErr);
            return false;
          }
        } catch {
          // Permissions API query not supported for microphone in some contexts; proceed directly
        }
      }

      // 2. Clean up any existing recognition instance to prevent state collisions
      if (this.recognitionInstance) {
        try {
          this.recognitionInstance.onstart = null;
          this.recognitionInstance.onaudiostart = null;
          this.recognitionInstance.onspeechstart = null;
          this.recognitionInstance.onresult = null;
          this.recognitionInstance.onerror = null;
          this.recognitionInstance.onend = null;
          this.recognitionInstance.abort();
        } catch {
          // ignore
        }
        this.recognitionInstance = null;
      }

      const SpeechRecognitionClass =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      const recognition = new SpeechRecognitionClass();
      this.recognitionInstance = recognition;
      console.log("[TUKLAS_MIC_DIAG] RECOGNITION_OBJECT_CREATED", {
        SpeechRecognitionClass: SpeechRecognitionClass.name || "webkitSpeechRecognition",
        defaultLanguage: this.defaultLanguage,
        optionsLang: options.lang,
      });

      recognition.continuous = options.continuous ?? true;
      recognition.interimResults = options.interimResults ?? true;
      recognition.maxAlternatives = options.maxAlternatives ?? 1;
      recognition.lang = options.lang || this.defaultLanguage;

      recognition.onstart = () => {
        console.log("[TUKLAS_MIC_DIAG] RECOGNITION_START_EVENT");
        this.starting = false;
        this.requestingPermission = false;
        this.listening = true;
        this.callbacks.onStart?.();
      };

      recognition.onaudiostart = () => {
        console.log("[TUKLAS_MIC_DIAG] AUDIO_START_EVENT");
      };

      recognition.onspeechstart = () => {
        console.log("[TUKLAS_MIC_DIAG] SPEECH_START_EVENT");
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = "";
        let interimTranscript = "";
        let confidence = 1;

        // Iterate through all results from index 0 to accumulate continuous transcript without losing earlier phrases
        for (let i = 0; i < event.results.length; ++i) {
          const res = event.results[i];
          const text = res[0].transcript;
          if (res[0].confidence !== undefined && res[0].confidence > 0) {
            confidence = res[0].confidence;
          }

          if (res.isFinal) {
            finalTranscript += text + " ";
          } else {
            interimTranscript += text;
          }
        }

        const sanitizedFinal = sanitizeTranscript(finalTranscript);
        const sanitizedInterim = sanitizeTranscript(interimTranscript);

        let fullTranscript = "";
        if (sanitizedFinal && sanitizedInterim) {
          fullTranscript = `${sanitizedFinal} ${sanitizedInterim}`;
        } else {
          fullTranscript = sanitizedFinal || sanitizedInterim;
        }

        if (fullTranscript) {
          this.lastSanitizedTranscript = fullTranscript;
          this.callbacks.onResult?.({
            transcript: fullTranscript,
            isFinal: !sanitizedInterim && Boolean(sanitizedFinal),
            confidence,
          });
        }
      };

      recognition.onerror = (event: any) => {
        const errorDetail = event.error || "unknown";
        // Ignore expected cancellation
        if (errorDetail === "aborted") {
          this.listening = false;
          this.starting = false;
          return;
        }

        // In continuous listening, if "no-speech" occurs after some transcript was already received,
        // do not clobber the session with an error
        if (errorDetail === "no-speech" && this.lastSanitizedTranscript) {
          return;
        }

        this.requestingPermission = false;
        this.starting = false;
        this.listening = false;
        const voiceError = mapRecognitionError(errorDetail);
        this.callbacks.onError?.(voiceError);
      };

      recognition.onend = () => {
        this.requestingPermission = false;
        this.starting = false;
        this.listening = false;
        this.callbacks.onEnd?.();
      };

      recognition.start();
      return true;
    } catch (err: any) {
      this.requestingPermission = false;
      this.starting = false;
      this.listening = false;
      const voiceError = mapRecognitionError(err.name || err.message || "start-failed");
      this.callbacks.onError?.(voiceError);
      return false;
    }
  }

  /**
   * Stop listening cleanly and await final result
   */
  public stop(): void {
    if (this.recognitionInstance) {
      const rec = this.recognitionInstance;
      this.recognitionInstance = null;
      try {
        rec.onstart = null;
        rec.onresult = null;
        rec.onerror = null;
        rec.onend = null;
        rec.stop();
      } catch {
        // Ignore if already stopped
      }
    }
    this.listening = false;
    this.starting = false;
    this.requestingPermission = false;
    this.callbacks.onEnd?.();
  }

  /**
   * Abort listening immediately, discarding results
   */
  public abort(): void {
    if (this.recognitionInstance) {
      try {
        this.recognitionInstance.onstart = null;
        this.recognitionInstance.onresult = null;
        this.recognitionInstance.onerror = null;
        this.recognitionInstance.onend = null;
        this.recognitionInstance.abort();
      } catch {
        // Ignore
      }
      this.recognitionInstance = null;
    }
    this.listening = false;
    this.starting = false;
    this.requestingPermission = false;
  }

  /**
   * Cleanup controller resources and listeners
   */
  public destroy(): void {
    this.abort();
    if (this.visibilityHandler && typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.visibilityHandler);
      this.visibilityHandler = null;
    }
    this.recognitionInstance = null;
    if (typeof window !== "undefined" && (window as any).__TUKLAS_SPEECH_CONTROLLER__ === this) {
      delete (window as any).__TUKLAS_SPEECH_CONTROLLER__;
    }
  }
}
