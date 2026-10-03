import React, { useState, useEffect, useRef } from "react";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Radio,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  Square,
  RefreshCw,
  Sliders,
  Sparkles,
  X,
} from "lucide-react";
import {
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
} from "@/lib/voice";

export interface VoiceHardwareLabProps {
  onClose?: () => void;
  className?: string;
  isModal?: boolean;
}

export function VoiceHardwareLab({ onClose, className = "", isModal }: VoiceHardwareLabProps) {
  // Web Audio Context & Analyzer references
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Speech Recognition reference
  const recognitionRef = useRef<any>(null);

  // Component States
  const [isMicTesting, setIsMicTesting] = useState(false);
  const [micVolume, setMicVolume] = useState(0);
  const [micPeak, setMicPeak] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

  // Speech Recognition state
  const [isSpeechTesting, setIsSpeechTesting] = useState(false);
  const [speechLang, setSpeechLang] = useState<"fil-PH" | "en-US">("fil-PH");
  const [transcribedText, setTranscribedText] = useState<string>("");
  const [speechConfidence, setSpeechConfidence] = useState<number | null>(null);

  // Speaker & Tone state
  const [isPlayingChime, setIsPlayingChime] = useState(false);
  const [isSpeakingTts, setIsSpeakingTts] = useState(false);
  const [ttsVolume, setTtsVolume] = useState(1);

  // Capability checks
  const hasAudioContext = typeof window !== "undefined" && !!(window.AudioContext || (window as any).webkitAudioContext);
  const hasGetUserMedia = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
  const hasRecognition = isSpeechRecognitionSupported();
  const hasSynthesis = isSpeechSynthesisSupported();

  // Enumerate input devices
  const refreshDevices = async () => {
    try {
      if (navigator.mediaDevices?.enumerateDevices) {
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = allDevices.filter((d) => d.kind === "audioinput");
        setDevices(audioInputs);
      }
    } catch (err: any) {
      console.warn("Could not enumerate audio devices:", err);
    }
  };

  useEffect(() => {
    refreshDevices();
    return () => {
      stopMicrophoneTest();
      stopSpeechTest();
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  // 1. Microphone Hardware Test & Live Visualizer
  const startMicrophoneTest = async () => {
    setMicError(null);
    try {
      if (!hasGetUserMedia) {
        throw new Error("getUserMedia is not supported by your browser");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      microphoneStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;

      setIsMicTesting(true);
      await refreshDevices();

      // Start canvas render loop
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      let currentPeak = 0;

      const draw = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        // Compute average volume level (0-100)
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const normalizedVol = Math.min(100, Math.round((average / 128) * 100));
        setMicVolume(normalizedVol);

        if (normalizedVol > currentPeak) {
          currentPeak = normalizedVol;
          setMicPeak(currentPeak);
        } else {
          currentPeak = Math.max(0, currentPeak - 0.5);
          setMicPeak(Math.round(currentPeak));
        }

        // Draw frequency spectrum on canvas
        const canvas = canvasRef.current;
        if (canvas) {
          const canvasCtx = canvas.getContext("2d");
          if (canvasCtx) {
            const width = canvas.width;
            const height = canvas.height;
            canvasCtx.clearRect(0, 0, width, height);

            const barWidth = (width / bufferLength) * 2.5;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
              const barHeight = (dataArray[i] / 255) * height;
              // Gradient emerald to cyan
              const hue = 150 + (i / bufferLength) * 40;
              canvasCtx.fillStyle = `hsl(${hue}, 80%, 45%)`;
              canvasCtx.fillRect(x, height - barHeight, barWidth, barHeight);
              x += barWidth + 1;
            }
          }
        }

        animFrameRef.current = requestAnimationFrame(draw);
      };

      draw();
    } catch (err: any) {
      const msg =
        err.name === "NotAllowedError" || err.name === "PermissionDeniedError"
          ? "Microphone access blocked. Please click the lock or camera icon in your URL bar to allow microphone permissions."
          : err.name === "NotFoundError" || err.name === "DevicesNotFoundError"
          ? "No physical microphone found. Please connect a microphone or headset."
          : err.message || "Failed to initialize microphone hardware test.";
      setMicError(msg);
      setIsMicTesting(false);
    }
  };

  const stopMicrophoneTest = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (microphoneStreamRef.current) {
      microphoneStreamRef.current.getTracks().forEach((t) => t.stop());
      microphoneStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setIsMicTesting(false);
    setMicVolume(0);
  };

  // 2. Speech-to-Text Live Transcriber Test
  const startSpeechTest = () => {
    if (!hasRecognition) {
      alert("Web Speech API is not supported in this browser. Please test in Google Chrome, Microsoft Edge, or Safari.");
      return;
    }

    try {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = speechLang;

      rec.onstart = () => {
        setIsSpeechTesting(true);
      };

      rec.onresult = (event: any) => {
        let finalTrans = "";
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTrans += event.results[i][0].transcript;
            if (event.results[i][0].confidence) {
              setSpeechConfidence(Math.round(event.results[i][0].confidence * 100));
            }
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        setTranscribedText((prev) => (finalTrans ? prev + " " + finalTrans : interim));
      };

      rec.onerror = (e: any) => {
        console.warn("Speech test error:", e.error);
        if (e.error === "not-allowed") {
          setIsSpeechTesting(false);
        }
      };

      rec.onend = () => {
        setIsSpeechTesting(false);
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (err: any) {
      console.error("Failed to start speech recognition:", err);
      setIsSpeechTesting(false);
    }
  };

  const stopSpeechTest = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsSpeechTesting(false);
  };

  // 3. Audio Output & Speaker Test (Web Audio Chime + TTS)
  const playChimeTone = () => {
    if (isPlayingChime) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(440, ctx.currentTime); // Concert A (440 Hz)
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3); // Arpeggio octave

      gain.gain.setValueAtTime(0.3 * ttsVolume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      setIsPlayingChime(true);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);

      osc.onended = () => {
        setIsPlayingChime(false);
        ctx.close().catch(() => {});
      };
    } catch (err: any) {
      console.error("Failed to play chime:", err);
      setIsPlayingChime(false);
    }
  };

  const playTtsSample = () => {
    if (!hasSynthesis) {
      alert("Speech Synthesis is not supported in this browser.");
      return;
    }
    if (isSpeakingTts) {
      window.speechSynthesis.cancel();
      setIsSpeakingTts(false);
      return;
    }

    window.speechSynthesis.cancel();
    const sampleText =
      speechLang === "fil-PH"
        ? "Kumusta! Ako si Tuklas, ang iyong AI Math Companion. Naririnig mo ba ako nang malinaw?"
        : "Hello! I am Tuklas, your AI Math Companion. Can you hear my voice clearly?";

    const utterance = new SpeechSynthesisUtterance(sampleText);
    utterance.lang = speechLang;
    utterance.volume = ttsVolume;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => setIsSpeakingTts(true);
    utterance.onend = () => setIsSpeakingTts(false);
    utterance.onerror = () => setIsSpeakingTts(false);

    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className={`bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 text-white p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30">
              <Radio className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">Voice Hardware Diagnostic Lab</h2>
              <p className="text-xs text-emerald-100">
                Real-device microphone VU meter, frequency visualizer, and speaker calibration
              </p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              aria-label="Close Hardware Lab"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Capability Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center gap-3">
            {hasGetUserMedia ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 text-rose-500 shrink-0" />
            )}
            <div>
              <div className="text-xs font-semibold text-slate-700">Audio Stream</div>
              <div className="text-[11px] text-slate-500">getUserMedia API</div>
            </div>
          </div>

          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center gap-3">
            {hasAudioContext ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 text-rose-500 shrink-0" />
            )}
            <div>
              <div className="text-xs font-semibold text-slate-700">Web Audio API</div>
              <div className="text-[11px] text-slate-500">AudioContext Analyser</div>
            </div>
          </div>

          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center gap-3">
            {hasRecognition ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 text-rose-500 shrink-0" />
            )}
            <div>
              <div className="text-xs font-semibold text-slate-700">Speech Recog</div>
              <div className="text-[11px] text-slate-500">Speech-to-Text</div>
            </div>
          </div>

          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center gap-3">
            {hasSynthesis ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 text-rose-500 shrink-0" />
            )}
            <div>
              <div className="text-xs font-semibold text-slate-700">Speech Synth</div>
              <div className="text-[11px] text-slate-500">Text-to-Speech (TTS)</div>
            </div>
          </div>
        </div>

        {/* Section 1: Microphone Hardware Test & Frequency Visualizer */}
        <div className="p-5 rounded-xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Mic className="w-4 h-4 text-emerald-600" />
                Live Microphone VU Meter & Spectrum
              </h3>
              <p className="text-xs text-slate-500">
                Measure physical acoustic volume and frequency waveforms in decibels
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!isMicTesting ? (
                <button
                  onClick={startMicrophoneTest}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-2"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Test Microphone
                </button>
              ) : (
                <button
                  onClick={stopMicrophoneTest}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-2"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  Stop Testing
                </button>
              )}
            </div>
          </div>

          {micError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{micError}</span>
            </div>
          )}

          {/* VU Meter Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-medium text-slate-600">
              <span>Input Level: {micVolume}%</span>
              <span>Peak: {micPeak}%</span>
            </div>
            <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden flex">
              <div
                className={`h-full transition-all duration-75 ${
                  micVolume > 85 ? "bg-rose-500" : micVolume > 60 ? "bg-amber-500" : "bg-emerald-500"
                }`}
                style={{ width: `${micVolume}%` }}
              />
            </div>
          </div>

          {/* Canvas Spectrum Display */}
          <div className="relative rounded-lg bg-slate-900 overflow-hidden h-28 flex items-center justify-center border border-slate-800">
            <canvas ref={canvasRef} width={600} height={112} className="w-full h-full object-cover" />
            {!isMicTesting && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs text-slate-400 text-xs gap-2">
                <MicOff className="w-4 h-4 text-slate-500" />
                Click "Test Microphone" to activate live audio visualizer
              </div>
            )}
          </div>

          {/* Detected Microphones List */}
          {devices.length > 0 && (
            <div className="text-xs text-slate-600">
              <span className="font-semibold text-slate-700">Detected Input Devices ({devices.length}): </span>
              {devices.map((d, i) => (
                <span key={d.deviceId || i} className="inline-block bg-slate-100 px-2 py-0.5 rounded text-[11px] mr-1 mt-1 border border-slate-200">
                  {d.label || `Microphone ${i + 1}`}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Section 2: Real-time Speech Recognition Transcriber */}
        <div className="p-5 rounded-xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-600" />
                Live Speech Recognition Transcriber
              </h3>
              <p className="text-xs text-slate-500">
                Speak directly into your microphone to verify speech-to-text accuracy and confidence
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={speechLang}
                onChange={(e) => setSpeechLang(e.target.value as any)}
                className="text-xs font-semibold px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700"
              >
                <option value="fil-PH">Filipino (fil-PH)</option>
                <option value="en-US">English (en-US)</option>
              </select>

              {!isSpeechTesting ? (
                <button
                  onClick={startSpeechTest}
                  disabled={!hasRecognition}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-300 text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-2"
                >
                  <Mic className="w-3.5 h-3.5" />
                  Start Listening
                </button>
              ) : (
                <button
                  onClick={stopSpeechTest}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-2"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  Stop Transcribing
                </button>
              )}
            </div>
          </div>

          <div className="min-h-20 p-3 bg-slate-100 rounded-lg border border-slate-200 font-mono text-xs text-slate-800">
            {transcribedText ? (
              <div>
                <p>{transcribedText}</p>
                {speechConfidence !== null && (
                  <div className="mt-2 text-[11px] text-slate-500 font-sans font-semibold">
                    Confidence Score: <span className="text-cyan-700">{speechConfidence}%</span>
                  </div>
                )}
              </div>
            ) : (
              <span className="text-slate-400 italic font-sans">
                {isSpeechTesting ? "Listening... Speak a math statement like: 'Ano ang additive inverse ng negative five?'" : "Transcript will appear here once you click 'Start Listening'..."}
              </span>
            )}
          </div>
        </div>

        {/* Section 3: Speaker Output & Audio Synthesis Tester */}
        <div className="p-5 rounded-xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-indigo-600" />
                Speaker & Text-to-Speech Calibration
              </h3>
              <p className="text-xs text-slate-500">
                Play acoustic tone chime and spoken Socratic voice sample
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={playChimeTone}
                disabled={isPlayingChime}
                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <Radio className={`w-3.5 h-3.5 ${isPlayingChime ? "animate-spin text-indigo-600" : ""}`} />
                {isPlayingChime ? "Playing Chime..." : "Test Chime (440Hz)"}
              </button>

              <button
                onClick={playTtsSample}
                disabled={!hasSynthesis}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
              >
                {isSpeakingTts ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                {isSpeakingTts ? "Stop Speaking" : "Play Voice Sample"}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-600">Volume:</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={ttsVolume}
              onChange={(e) => setTtsVolume(parseFloat(e.target.value))}
              className="w-36 accent-indigo-600 cursor-pointer"
            />
            <span className="text-xs font-mono text-slate-500">{Math.round(ttsVolume * 100)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
