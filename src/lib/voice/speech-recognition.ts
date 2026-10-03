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
  private callbacks: SpeechRecognitionCallbacks;
  private defaultLanguage: string = "en-PH"; // Philippine English / MATATAG aligned
  private visibilityHandler: (() => void) | null = null;

  constructor(callbacks: SpeechRecognitionCallbacks = {}) {
    this.callbacks = callbacks;
    this.setupVisibilityListener();
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
  public start(options: SpeechRecognitionOptions = {}): boolean {
    if (!this.isSupported()) {
      this.callbacks.onError?.({
        type: "NOT_SUPPORTED",
        message: "SpeechRecognition API not available in this browser environment.",
        userMessage: "Voice input is not available in this browser. You can continue with text.",
      });
      return false;
    }

    if (this.listening) {
      return true;
    }

    try {
      this.requestingPermission = true;
      this.callbacks.onRequestingPermission?.();

      const SpeechRecognitionClass =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      const recognition = new SpeechRecognitionClass();
      this.recognitionInstance = recognition;

      recognition.continuous = options.continuous ?? false;
      recognition.interimResults = options.interimResults ?? true;
      recognition.maxAlternatives = options.maxAlternatives ?? 1;
      recognition.lang = options.lang || this.defaultLanguage;

      recognition.onstart = () => {
        this.requestingPermission = false;
        this.listening = true;
        this.callbacks.onStart?.();
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = "";
        let finalTranscript = "";
        let confidence = 1;

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          const transcriptText = item[0].transcript;
          if (item[0].confidence !== undefined) {
            confidence = item[0].confidence;
          }

          if (item.isFinal) {
            finalTranscript += transcriptText;
          } else {
            interimTranscript += transcriptText;
          }
        }

        if (finalTranscript) {
          const sanitized = sanitizeTranscript(finalTranscript);
          this.callbacks.onResult?.({
            transcript: sanitized,
            isFinal: true,
            confidence,
          });
        } else if (interimTranscript) {
          this.callbacks.onResult?.({
            transcript: interimTranscript,
            isFinal: false,
            confidence,
          });
        }
      };

      recognition.onerror = (event: any) => {
        this.requestingPermission = false;
        this.listening = false;
        const errorDetail = event.error || "unknown";
        const voiceError = mapRecognitionError(errorDetail);
        this.callbacks.onError?.(voiceError);
      };

      recognition.onend = () => {
        this.requestingPermission = false;
        this.listening = false;
        this.callbacks.onEnd?.();
      };

      recognition.start();
      return true;
    } catch (err: any) {
      this.requestingPermission = false;
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
    if (this.recognitionInstance && this.listening) {
      try {
        this.recognitionInstance.stop();
      } catch {
        // Ignore if already stopped
      }
    }
    this.listening = false;
    this.requestingPermission = false;
  }

  /**
   * Abort listening immediately, discarding results
   */
  public abort(): void {
    if (this.recognitionInstance) {
      try {
        this.recognitionInstance.abort();
      } catch {
        // Ignore
      }
    }
    this.listening = false;
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
  }
}
