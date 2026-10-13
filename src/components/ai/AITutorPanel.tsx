import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Sparkles,
  X,
  Send,
  Lightbulb,
  HelpCircle,
  BookOpen,
  ArrowRight,
  RotateCcw,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Volume2,
  Square,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { MathText } from "@/components/ui/MathText";
import { authFetch } from "@/lib/auth/auth-context";
import type { TutorMessageDTO, AITutorHelpLevel } from "@/lib/ai/types";
import {
  SpeechRecognitionController,
  SpeechSynthesisController,
  VoiceState,
  VoiceError,
  VoiceTranscriptResult,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  isFilipinoText,
} from "@/lib/voice";
import { VoiceTutorButton } from "./VoiceTutorButton";
import { VoiceTutorPanel } from "./VoiceTutorPanel";

export interface AITutorPanelProps {
  isOpen: boolean;
  onClose: () => void;
  context: {
    lessonId?: string;
    lessonTitle?: string;
    skillId?: string;
    skillTitle?: string;
    questionId?: string;
    questionPrompt?: string;
    practiceSessionId?: string;
    studentAnswer?: any;
    hasFailedAttempt?: boolean;
  };
  initialHelpLevel?: AITutorHelpLevel;
}

export function AITutorPanel({
  isOpen,
  onClose,
  context,
  initialHelpLevel = "LEVEL_1_HINT",
}: AITutorPanelProps) {
  const [messages, setMessages] = useState<TutorMessageDTO[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [inputQuery, setInputQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [currentHintLevel, setCurrentHintLevel] = useState<number>(1);

  // Phase 19 & 20: Voice Interface States
  const [voiceState, setVoiceState] = useState<VoiceState>("IDLE");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [voiceError, setVoiceError] = useState<VoiceError | null>(null);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);

  const isVoiceSupported = isSpeechRecognitionSupported();
  const isTtsSupported = isSpeechSynthesisSupported();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasRequestedRef = useRef<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionController | null>(null);
  const synthesisRef = useRef<SpeechSynthesisController | null>(null);
  const autoSpeakRef = useRef(autoSpeak);
  autoSpeakRef.current = autoSpeak;

  // Auto-scroll messages
  useEffect(() => {
    if (!isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading, isMinimized]);

  // Request help from server (Central AI Tutor Pipeline)
  const requestTutorHelp = useCallback(
    async (helpLevel: AITutorHelpLevel, query?: string, isVoiceTriggered: boolean = false) => {
      if (loading) return;
      setLoading(true);
      setError(null);
      if (isVoiceTriggered) {
        setVoiceState("PROCESSING");
      }

      // Optimistically add student message if it was a user query
      if (query && query.trim().length > 0) {
        const studentOptimisticMsg: TutorMessageDTO = {
          id: `temp_${Date.now()}`,
          role: "STUDENT",
          content: query.trim(),
          messageType: "QUESTION",
          createdAt: new Date().toISOString(),
        };
        setMessages((prev: TutorMessageDTO[]) => [...prev, studentOptimisticMsg]);
        setInputQuery("");
      }

      try {
        const res = await authFetch("/api/ai/tutor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId,
            lessonId: context.lessonId,
            skillId: context.skillId,
            questionId: context.questionId,
            practiceSessionId: context.practiceSessionId,
            studentQuery: query,
            helpLevel,
            studentAnswer: context.studentAnswer,
          }),
        });

        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || "Failed to receive tutor guidance.");
        }

        if (json.data) {
          setConversationId(json.data.conversationId);
          setMessages((prev: TutorMessageDTO[]) => [...prev, json.data.message]);
          if (json.data.message.hintLevel) {
            setCurrentHintLevel(json.data.message.hintLevel);
          }

          // If voice mode triggered or auto-speak enabled, speak the answer aloud
          if ((isVoiceTriggered || autoSpeakRef.current) && isTtsSupported && synthesisRef.current) {
            setSpeakingMessageId(json.data.message.id);
            setVoiceState("SPEAKING");
            const isFil = isFilipinoText(json.data.message.content);
            synthesisRef.current.speak(json.data.message.content, {
              lang: isFil ? "fil-PH" : "en-US",
            });
          } else {
            setVoiceState("IDLE");
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "The AI Tutor is temporarily unavailable.";
        setError(msg);
        setVoiceState("IDLE");
      } finally {
        setLoading(false);
      }
    },
    [conversationId, context, isTtsSupported, loading]
  );

  // Initialize Speech Controllers with lifecycle management
  useEffect(() => {
    // Initialize Speech Recognition
    const recognition = new SpeechRecognitionController({
      onRequestingPermission: () => {
        setVoiceState("REQUESTING_PERMISSION");
        setVoiceError(null);
      },
      onStart: () => {
        setVoiceState("LISTENING");
        setVoiceError(null);
        setInterimTranscript("");
      },
      onResult: (result: VoiceTranscriptResult) => {
        if (result.isFinal) {
          setInterimTranscript("");
          setVoiceState("PROCESSING");
          if (result.transcript.trim()) {
            requestTutorHelp("LEVEL_1_HINT", result.transcript, true);
          } else {
            setVoiceState("IDLE");
          }
        } else {
          setInterimTranscript(result.transcript);
        }
      },
      onError: (err: VoiceError) => {
        setVoiceError(err);
        setVoiceState("ERROR");
        setInterimTranscript("");
      },
      onEnd: () => {
        setVoiceState((prev: VoiceState) => (prev === "LISTENING" || prev === "REQUESTING_PERMISSION" ? "IDLE" : prev));
      },
    });
    recognitionRef.current = recognition;

    // Initialize Speech Synthesis
    const synthesis = new SpeechSynthesisController({
      onStart: () => {
        setVoiceState("SPEAKING");
      },
      onEnd: () => {
        setSpeakingMessageId(null);
        setVoiceState((prev: VoiceState) => (prev === "SPEAKING" ? "IDLE" : prev));
      },
      onError: () => {
        setSpeakingMessageId(null);
        setVoiceState((prev: VoiceState) => (prev === "SPEAKING" ? "IDLE" : prev));
      },
    });
    synthesisRef.current = synthesis;

    return () => {
      recognition.destroy();
      synthesis.destroy();
    };
  }, [requestTutorHelp]);

  // Handle panel close / minimize cleanup
  useEffect(() => {
    if (!isOpen || isMinimized) {
      recognitionRef.current?.stop();
      synthesisRef.current?.stop();
      setVoiceState("IDLE");
      setSpeakingMessageId(null);
    }
  }, [isOpen, isMinimized]);

  // Voice Interaction Handlers with Task 11 Barge-in support
  const handleToggleVoice = () => {
    if (voiceState === "LISTENING" || voiceState === "REQUESTING_PERMISSION") {
      recognitionRef.current?.stop();
      setVoiceState("IDLE");
    } else if (voiceState === "SPEAKING") {
      // Barge-in: Student clicks mic while AI is speaking -> stop AI speech, start listening!
      synthesisRef.current?.stop();
      setSpeakingMessageId(null);
      setAutoSpeak(true);
      setVoiceError(null);
      recognitionRef.current?.start({ continuous: false, interimResults: true });
    } else {
      // Intentional student click: activate microphone and auto-speak
      setAutoSpeak(true);
      setVoiceError(null);
      recognitionRef.current?.start({ continuous: false, interimResults: true });
    }
  };

  const handleStopListening = () => {
    recognitionRef.current?.stop();
  };

  const handleStopSpeaking = () => {
    synthesisRef.current?.stop();
    setSpeakingMessageId(null);
    setVoiceState("IDLE");
  };

  const handleSpeakMessage = (msgId: string, content: string) => {
    if (speakingMessageId === msgId) {
      handleStopSpeaking();
    } else {
      if (synthesisRef.current) {
        setSpeakingMessageId(msgId);
        setVoiceState("SPEAKING");
        const isFil = isFilipinoText(content);
        synthesisRef.current.speak(content, {
          lang: isFil ? "fil-PH" : "en-US",
        });
      }
    }
  };

  // If opened fresh and no messages, automatically request a Level 1 Hint once
  useEffect(() => {
    const key = `${context.questionId || "general"}_${isOpen}`;
    if (isOpen && messages.length === 0 && !loading && !error && hasRequestedRef.current !== key) {
      hasRequestedRef.current = key;
      requestTutorHelp(initialHelpLevel);
    }
  }, [isOpen, context.questionId, initialHelpLevel, loading, error, requestTutorHelp]);

  if (!isOpen) return null;

  return (
    <div
      className={`fixed z-50 transition-all duration-300 ${
        isMinimized
          ? "bottom-4 right-4 w-80 h-14"
          : "bottom-4 right-4 w-96 sm:w-[420px] max-h-[85vh] h-[600px] flex flex-col"
      } bg-white rounded-2xl shadow-2xl border border-emerald-200 overflow-hidden`}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white p-3.5 flex items-center justify-between shadow-sm select-none">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-xs">
            <Sparkles className="w-4 h-4 text-emerald-100" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-bold text-sm tracking-tight leading-tight">Tuklas AI Tutor</h3>
              <span className="text-[10px] bg-emerald-500/40 px-1.5 py-0.5 rounded-full uppercase tracking-wider font-semibold">
                Socratic
              </span>
            </div>
            <p className="text-[11px] text-emerald-100/90 truncate max-w-[200px]">
              {context.skillTitle || context.lessonTitle || "Grade 7 Mathematics"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1.5 hover:bg-white/10 rounded-lg text-emerald-100 hover:text-white transition-colors"
            title={isMinimized ? "Expand" : "Minimize"}
            aria-label={isMinimized ? "Expand AI Tutor" : "Minimize AI Tutor"}
          >
            {isMinimized ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-lg text-emerald-100 hover:text-white transition-colors"
            title="Close"
            aria-label="Close AI Tutor"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Phase 19 & 20: Voice Tutor State & Controls Region */}
          <VoiceTutorPanel
            voiceState={voiceState}
            interimTranscript={interimTranscript}
            error={voiceError}
            autoSpeak={autoSpeak}
            onToggleAutoSpeak={() => setAutoSpeak(!autoSpeak)}
            onStopListening={handleStopListening}
            onStopSpeaking={handleStopSpeaking}
            onRetry={handleToggleVoice}
            onDismissError={() => setVoiceError(null)}
          />

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/60">
            {messages.length === 0 && !loading && (
              <div className="text-center py-8 px-4 text-slate-500">
                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Lightbulb className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-slate-800 text-sm mb-1">How can I help you?</h4>
                <p className="text-xs text-slate-500">
                  I will give you hints and guide your thinking step-by-step without giving away the answer.
                </p>
              </div>
            )}

            {messages.map((msg, i) => {
              const isStudent = msg.role === "STUDENT";
              const isCurrentSpeaking = speakingMessageId === msg.id;

              return (
                <div
                  key={msg.id || i}
                  className={`flex flex-col ${isStudent ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl p-3.5 shadow-xs text-xs sm:text-sm ${
                      isStudent
                        ? "bg-emerald-600 text-white rounded-br-xs"
                        : "bg-white border border-emerald-100 text-slate-800 rounded-bl-xs"
                    }`}
                  >
                    {!isStudent && (
                      <div className="flex items-center justify-between gap-1.5 mb-1.5">
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                          {msg.messageType === "HINT" && `Hint ${msg.hintLevel ? `Level ${msg.hintLevel}` : ""}`}
                          {msg.messageType === "GUIDING_QUESTION" && "Guiding Question"}
                          {msg.messageType === "EXPLANATION" && "Concept Review"}
                          {msg.messageType === "EXAMPLE" && "Worked Example"}
                          {msg.messageType === "REDIRECT" && "Guidance"}
                        </span>

                        {/* Read Aloud Button for AI messages */}
                        {isTtsSupported && (
                          <button
                            type="button"
                            onClick={() => handleSpeakMessage(msg.id, msg.content)}
                            aria-label={isCurrentSpeaking ? "Stop reading aloud" : "Read response aloud"}
                            title={isCurrentSpeaking ? "Stop reading" : "Read aloud"}
                            className="p-1 rounded-md text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 transition-colors"
                          >
                            {isCurrentSpeaking ? (
                              <Square className="w-3.5 h-3.5 fill-emerald-600 animate-pulse" />
                            ) : (
                              <Volume2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    )}

                    <div className="space-y-2 leading-relaxed">
                      <MathText content={msg.content} />
                    </div>

                    {!isStudent && msg.guidingQuestion && (
                      <div className="mt-2.5 pt-2 border-t border-emerald-100/70 bg-emerald-50/50 -mx-1 px-2.5 py-1.5 rounded-lg text-emerald-900 font-medium text-xs">
                        <span className="font-bold text-emerald-700 mr-1">
                          {isFilipinoText(msg.content) ? "Pag-isipan:" : "Think about:"}
                        </span>
                        <MathText content={msg.guidingQuestion} />
                      </div>
                    )}

                    {!isStudent && msg.encouragement && (
                      <div className="mt-2 text-[11px] font-semibold text-emerald-600 italic">
                        {msg.encouragement}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 px-1">
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              );
            })}

            {loading && (
              <div className="flex items-center gap-2 p-3 bg-white rounded-2xl border border-emerald-100 w-fit text-slate-600 text-xs shadow-xs animate-pulse">
                <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
                <span>Tuklas AI is thinking...</span>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p>{error}</p>
                  <button
                    onClick={() => requestTutorHelp("LEVEL_1_HINT")}
                    className="text-amber-800 font-bold underline mt-1 block hover:text-amber-900"
                  >
                    Try again
                  </button>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestions Action Pills with Voice Tutor Button */}
          <div className="p-2.5 bg-white border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {/* Phase 19 & 20: Voice Tutor Mic Button */}
            <VoiceTutorButton
              voiceState={voiceState}
              isSupported={isVoiceSupported}
              onToggleVoice={handleToggleVoice}
              onStopSpeaking={handleStopSpeaking}
            />

            <button
              disabled={loading}
              onClick={() => requestTutorHelp("LEVEL_1_HINT")}
              className="shrink-0 flex items-center gap-1 text-[11px] font-medium py-1 px-2.5 rounded-full bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/60 transition-colors disabled:opacity-50"
            >
              <Lightbulb className="w-3 h-3 text-emerald-600" />
              <span>Hint</span>
            </button>

            <button
              disabled={loading}
              onClick={() => requestTutorHelp("LEVEL_2_HINT")}
              className="shrink-0 flex items-center gap-1 text-[11px] font-medium py-1 px-2.5 rounded-full bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200/60 transition-colors disabled:opacity-50"
            >
              <RotateCcw className="w-3 h-3 text-teal-600" />
              <span>Stronger Hint</span>
            </button>

            <button
              disabled={loading}
              onClick={() => requestTutorHelp("GUIDING_QUESTION")}
              className="shrink-0 flex items-center gap-1 text-[11px] font-medium py-1 px-2.5 rounded-full bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200/60 transition-colors disabled:opacity-50"
            >
              <HelpCircle className="w-3 h-3 text-blue-600" />
              <span>Guiding Question</span>
            </button>

            <button
              disabled={loading}
              onClick={() => requestTutorHelp("CONCEPT_EXPLANATION")}
              className="shrink-0 flex items-center gap-1 text-[11px] font-medium py-1 px-2.5 rounded-full bg-indigo-50 text-indigo-800 hover:bg-indigo-100 border border-indigo-200/60 transition-colors disabled:opacity-50"
            >
              <BookOpen className="w-3 h-3 text-indigo-600" />
              <span>Rule</span>
            </button>
          </div>

          {/* Chat Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (inputQuery.trim().length > 0 && !loading) {
                requestTutorHelp("LEVEL_1_HINT", inputQuery);
              }
            }}
            className="p-3 bg-white border-t border-slate-100 flex items-center gap-2"
          >
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="Ask a question or tap 'Talk to Tuklas'..."
              maxLength={1000}
              disabled={loading}
              aria-label="Ask a question to Tuklas AI Tutor"
              className="flex-1 text-xs sm:text-sm px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400 disabled:opacity-50"
            />
            <Button
              type="submit"
              size="sm"
              disabled={loading || inputQuery.trim().length === 0}
              aria-label="Send question to AI Tutor"
              className="h-9 w-9 p-0 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 shadow-xs"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
