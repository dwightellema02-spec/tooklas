/**
 * Tuklas AI - Speech Synthesis Controller (Text-to-Speech)
 * Phase 19 & Phase 20: Conversational AI Voice Interface & Interruption Handling
 */

import { SpeechSynthesisOptions } from "./voice-types";
import { formatTextForSpeech, isSpeechSynthesisSupported, isFilipinoText, splitForSpeech } from "./voice-utils";

export interface SpeechSynthesisCallbacks {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: Error) => void;
  onPause?: () => void;
  onResume?: () => void;
}

/** After a 401/503 the natural-voice server is skipped for a while, so the browser voice answers at once. */
let naturalVoiceUnavailableUntil = 0;

/** Lets tests start from a clean state. */
export function resetNaturalVoiceAvailability(): void {
  naturalVoiceUnavailableUntil = 0;
}

export interface SpeechSynthesisControllerOptions {
  /** Fetch used for the natural-voice server (pass authFetch so the session token is sent). */
  fetcher?: typeof fetch;
}

export class SpeechSynthesisController {
  private serverToken = 0;
  private serverAudio: HTMLAudioElement | null = null;
  private serverAbort: AbortController | null = null;
  private serverUrls: string[] = [];
  private fetcher: typeof fetch;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private callbacks: SpeechSynthesisCallbacks;
  private cachedVoices: SpeechSynthesisVoice[] = [];
  private voicesLoaded: boolean = false;
  private onVoicesChangedHandler: (() => void) | null = null;

  constructor(callbacks: SpeechSynthesisCallbacks = {}, options: SpeechSynthesisControllerOptions = {}) {
    this.callbacks = callbacks;
    this.fetcher = options.fetcher ?? ((...args) => fetch(...args));
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
    if (this.serverAudio && !this.serverAudio.paused) return true;
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
    this.halt();

    const spokenText = formatTextForSpeech(rawText);
    if (!spokenText.trim()) {
      return false;
    }

    const isFilipino =
      Boolean(options.lang?.startsWith("fil") || options.lang?.startsWith("tl")) ||
      (!options.lang?.startsWith("en") && isFilipinoText(rawText));

    // Use the natural server voice when there is one, for Filipino and for English. Most devices have no
    // Filipino voice (Tagalog comes out in an English or Indonesian accent) and the built-in English voices
    // sound robotic. Any failure falls back to the browser voice below.
    if (!options.voiceName && options.engine !== "browser" && this.canUseNaturalVoice()) {
      void this.speakWithNaturalVoice(spokenText, options, isFilipino);
      return true;
    }
    return this.speakInBrowser(spokenText, options, isFilipino);
  }

  private canUseNaturalVoice(): boolean {
    return typeof Audio !== "undefined" && typeof URL !== "undefined" && typeof URL.createObjectURL === "function" && Date.now() >= naturalVoiceUnavailableUntil;
  }

  private releaseServerAudio(): void {
    this.serverAbort?.abort();
    this.serverAbort = null;
    if (this.serverAudio) {
      this.serverAudio.onended = null;
      this.serverAudio.onerror = null;
      try {
        this.serverAudio.pause();
      } catch {
        // Ignore
      }
      this.serverAudio = null;
    }
    for (const u of this.serverUrls) URL.revokeObjectURL(u);
    this.serverUrls = [];
  }

  private async speakWithNaturalVoice(spokenText: string, options: SpeechSynthesisOptions, isFilipino: boolean): Promise<void> {
    const token = ++this.serverToken;
    const pieces = splitForSpeech(spokenText);
    const abort = new AbortController();
    this.serverAbort = abort;
    const lang = isFilipino ? "fil-PH" : "en-PH";

    const fetchPiece = async (text: string): Promise<string> => {
      const res = await this.fetcher("/api/ai/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang }),
        signal: abort.signal,
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 503) naturalVoiceUnavailableUntil = Date.now() + 5 * 60 * 1000;
        else if (res.status === 429) naturalVoiceUnavailableUntil = Date.now() + 30 * 1000;
        throw new Error("natural voice unavailable: " + res.status);
      }
      const url = URL.createObjectURL(await res.blob());
      this.serverUrls.push(url);
      return url;
    };

    let index = 0;
    let played = 0; // pieces that finished playing
    let started = false;
    try {
      let pending = fetchPiece(pieces[0]);
      pending.catch(() => undefined);
      for (index = 0; index < pieces.length; index++) {
        const url = await pending;
        if (token !== this.serverToken) return;
        if (index + 1 < pieces.length) {
          pending = fetchPiece(pieces[index + 1]); // synthesize the next piece while this one plays
          pending.catch(() => undefined);
        }
        await new Promise<void>((resolve, reject) => {
          const audio = new Audio(url);
          audio.volume = options.volume ?? 1.0;
          audio.playbackRate = options.rate ?? 1.0;
          this.serverAudio = audio;
          audio.onended = () => resolve();
          audio.onerror = () => reject(new Error("audio playback failed"));
          audio.onpause = () => {
            if (!audio.ended && token === this.serverToken && this.serverAudio === audio) this.callbacks.onPause?.();
          };
          audio.onplay = () => {
            if (started) this.callbacks.onResume?.();
          };
          audio.play().then(() => {
            if (!started) {
              started = true;
              this.callbacks.onStart?.();
            }
          }, reject);
        });
        played++;
      }
      if (token === this.serverToken) {
        this.releaseServerAudio();
        this.callbacks.onEnd?.();
      }
    } catch (err) {
      if (token !== this.serverToken || abort.signal.aborted) return; // stopped or replaced: nothing to do
      // Read the rest (or everything, if nothing was played yet) with the browser voice.
      this.releaseServerAudio();
      const rest = pieces.slice(played).join(" ");
      if (rest.trim()) this.speakInBrowser(rest, options, isFilipino);
      else this.callbacks.onEnd?.();
    }
  }

  private speakInBrowser(spokenText: string, options: SpeechSynthesisOptions, isFilipino: boolean): boolean {
    try {
      const utterance = new SpeechSynthesisUtterance(spokenText);
      this.currentUtterance = utterance;

      utterance.rate = options.rate ?? 1.0; // 1.0 is native natural speed for Neural TTS voices
      utterance.pitch = options.pitch ?? 1.0;
      utterance.volume = options.volume ?? 1.0;

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
    const wasNatural = Boolean(this.serverAudio || this.serverAbort);
    this.halt();
    if (wasNatural) this.callbacks.onEnd?.(); // the browser voice reports its own end when cancelled
  }

  /** Silence everything without telling the caller (used when a new utterance replaces the old one). */
  private halt(): void {
    this.serverToken++;
    this.releaseServerAudio();
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
    this.serverAudio?.pause();
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
    void this.serverAudio?.play();
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
    this.halt();
    if (this.onVoicesChangedHandler && typeof window !== "undefined" && window.speechSynthesis?.removeEventListener) {
      window.speechSynthesis.removeEventListener("voiceschanged", this.onVoicesChangedHandler);
      this.onVoicesChangedHandler = null;
    }
  }
}
