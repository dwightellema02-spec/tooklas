/**
 * Tuklas AI - Speech Synthesis Controller (Text-to-Speech)
 * Phase 19 & Phase 20: Conversational AI Voice Interface & Interruption Handling
 */

import { SpeechSynthesisOptions } from "./voice-types";
import { formatTextForSpeech, isSpeechSynthesisSupported } from "./voice-utils";

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

  constructor(callbacks: SpeechSynthesisCallbacks = {}) {
    this.callbacks = callbacks;
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
    return window.speechSynthesis.getVoices();
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

      utterance.rate = options.rate ?? 0.95; // Slightly slower for clear mathematical explanation
      utterance.pitch = options.pitch ?? 1.0;
      utterance.volume = options.volume ?? 1.0;
      utterance.lang = options.lang || "en-US";

      // Select preferred voice if available
      const voices = this.getVoices();
      if (voices.length > 0) {
        if (options.voiceName) {
          const match = voices.find((v) => v.name === options.voiceName);
          if (match) utterance.voice = match;
        } else {
          // Look for English or Filipino voice
          const preferred =
            voices.find((v) => v.lang.startsWith("en-PH") || v.lang.startsWith("fil")) ||
            voices.find((v) => v.lang.startsWith("en-US") || v.lang.startsWith("en-GB")) ||
            voices[0];
          if (preferred) utterance.voice = preferred;
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
  }
}
