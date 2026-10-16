/**
 * Tuklas AI - Speech Synthesis Controller (Text-to-Speech)
 * Phase 19 & Phase 20: Conversational AI Voice Interface & Interruption Handling
 */

import { SpeechSynthesisOptions } from "./voice-types";
import { formatTextForSpeech, isSpeechSynthesisSupported, isFilipinoText } from "./voice-utils";

export interface SpeechSynthesisCallbacks {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: Error) => void;
  onPause?: () => void;
  onResume?: () => void;
}

export class SpeechSynthesisController {
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private callbacks: SpeechSynthesisCallbacks;
  private cachedVoices: SpeechSynthesisVoice[] = [];
  private voicesLoaded: boolean = false;
  private onVoicesChangedHandler: (() => void) | null = null;

  constructor(callbacks: SpeechSynthesisCallbacks = {}) {
    this.callbacks = callbacks;
    this.initVoices();
  }

  private initVoices(): void {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const populate = () => {
      const v = window.speechSynthesis.getVoices();
      if (v && v.length > 0) {
        this.cachedVoices = v;
        this.voicesLoaded = true;
      }
    };
    populate();
    if (!this.voicesLoaded && window.speechSynthesis.addEventListener) {
      this.onVoicesChangedHandler = populate;
      window.speechSynthesis.addEventListener("voiceschanged", populate);
    }
  }

  public setCallbacks(callbacks: SpeechSynthesisCallbacks) {
    this.callbacks = callbacks;
  }

  public isSupported(): boolean {
    return isSpeechSynthesisSupported();
  }

  public isSpeaking(): boolean {
    if (!this.isSupported()) return false;
    return window.speechSynthesis.speaking;
  }

  public isPaused(): boolean {
    if (!this.isSupported()) return false;
    return window.speechSynthesis.paused;
  }

  /**
   * Get available speech synthesis voices in the browser
   */
  public getVoices(): SpeechSynthesisVoice[] {
    if (!this.isSupported()) return [];
    if (this.cachedVoices.length > 0) return this.cachedVoices;
    const v = window.speechSynthesis.getVoices();
    if (v && v.length > 0) {
      this.cachedVoices = v;
      this.voicesLoaded = true;
    }
    return v;
  }

  /**
   * Speak a text response aloud using natural speech synthesis
   * Task 11: Immediately cancels any ongoing speech prior to starting new utterance
   */
  public speak(rawText: string, options: SpeechSynthesisOptions = {}): boolean {
    if (!this.isSupported()) {
      this.callbacks.onError?.(new Error("Text-to-speech is not supported in this browser."));
      return false;
    }

    // Task 11: Barge-in / Interruption handling: Cancel any previous utterance immediately
    this.stop();

    const spokenText = formatTextForSpeech(rawText);
    if (!spokenText.trim()) {
      return false;
    }

    try {
      const utterance = new SpeechSynthesisUtterance(spokenText);
      this.currentUtterance = utterance;

      utterance.rate = options.rate ?? 1.0; // 1.0 is native natural speed for Neural TTS voices
      utterance.pitch = options.pitch ?? 1.0;
      utterance.volume = options.volume ?? 1.0;

      const isFilipino =
        Boolean(options.lang?.startsWith("fil") || options.lang?.startsWith("tl")) ||
        (!options.lang?.startsWith("en") && isFilipinoText(rawText));
      const targetLang = options.lang || (isFilipino ? "fil-PH" : "en-US");
      utterance.lang = targetLang;

      // Select preferred voice if available (with fallback query if cache wasn't ready)
      let voices = this.getVoices();
      if (voices.length === 0 && typeof window !== "undefined" && window.speechSynthesis) {
        voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          this.cachedVoices = voices;
          this.voicesLoaded = true;
        }
      }

      if (voices.length > 0) {
        if (options.voiceName) {
          const match = voices.find((v) => v.name === options.voiceName);
          if (match) utterance.voice = match;
        } else if (isFilipino) {
          // Prioritize Filipino / Tagalog voices (Angelo first for natural instructional tone, then Blessica)
          const filipinoVoice =
            voices.find((v) => v.name.toLowerCase().includes("angelo") && (v.lang.startsWith("fil") || v.lang.startsWith("tl"))) ||
            voices.find((v) => v.name.toLowerCase().includes("blessica") && (v.lang.startsWith("fil") || v.lang.startsWith("tl"))) ||
            voices.find((v) => v.name.toLowerCase().includes("angelo")) ||
            voices.find((v) => v.name.toLowerCase().includes("blessica")) ||
            voices.find((v) => v.lang.toLowerCase().startsWith("fil") || v.lang.toLowerCase().startsWith("tl")) ||
            voices.find((v) => v.name.toLowerCase().includes("filipino") || v.name.toLowerCase().includes("tagalog")) ||
            voices.find((v) => v.lang.toLowerCase().startsWith("en-ph")) ||
            voices.find((v) => v.lang.toLowerCase().startsWith("id")); // Indonesian has phonetically close Austronesian vowel sounds as fallback in Chrome

          if (filipinoVoice) {
            utterance.voice = filipinoVoice;
          }
        } else {
          // Prioritize Philippine English (natural accent for Filipino learners), then US/GB Natural English
          const englishVoice =
            voices.find((v) => v.lang.toLowerCase().startsWith("en-ph") && v.name.toLowerCase().includes("natural")) ||
            voices.find((v) => v.lang.toLowerCase().startsWith("en-ph")) ||
            voices.find((v) => v.name.toLowerCase().includes("natural") && (v.lang.startsWith("en-US") || v.lang.startsWith("en-GB"))) ||
            voices.find((v) => v.lang.startsWith("en-US") || v.lang.startsWith("en-GB")) ||
            voices[0];

          if (englishVoice) {
            utterance.voice = englishVoice;
          }
        }
      }

      utterance.onstart = () => {
        this.callbacks.onStart?.();
      };

      utterance.onend = () => {
        this.currentUtterance = null;
        this.callbacks.onEnd?.();
      };

      utterance.onerror = (e) => {
        this.currentUtterance = null;
        // Do not treat 'canceled' or 'interrupted' as fatal errors
        if (e.error !== "canceled" && e.error !== "interrupted") {
          this.callbacks.onError?.(new Error(`Speech synthesis error: ${e.error}`));
        } else {
          this.callbacks.onEnd?.();
        }
      };

      utterance.onpause = () => {
        this.callbacks.onPause?.();
      };

      utterance.onresume = () => {
        this.callbacks.onResume?.();
      };

      window.speechSynthesis.speak(utterance);
      return true;
    } catch (err: any) {
      this.callbacks.onError?.(err instanceof Error ? err : new Error(String(err)));
      return false;
    }
  }

  /**
   * Stop any active speech readout immediately (barge-in or manual mute)
   */
  public stop(): void {
    if (this.isSupported()) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore
      }
    }
    this.currentUtterance = null;
  }

  /**
   * Pause active speech
   */
  public pause(): void {
    if (this.isSupported()) {
      try {
        window.speechSynthesis.pause();
      } catch {
        // Ignore
      }
    }
  }

  /**
   * Resume paused speech
   */
  public resume(): void {
    if (this.isSupported()) {
      try {
        window.speechSynthesis.resume();
      } catch {
        // Ignore
      }
    }
  }

  /**
   * Destroy and clean up speech synthesis
   */
  public destroy(): void {
    this.stop();
    if (this.onVoicesChangedHandler && typeof window !== "undefined" && window.speechSynthesis?.removeEventListener) {
      window.speechSynthesis.removeEventListener("voiceschanged", this.onVoicesChangedHandler);
      this.onVoicesChangedHandler = null;
    }
  }
}
