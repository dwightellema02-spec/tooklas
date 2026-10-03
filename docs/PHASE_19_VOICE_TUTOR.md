# TUKLAS AI — PHASE 19 VOICE TUTOR & CONVERSATIONAL AI ASSISTANT

**Evaluation Phase:** Phase 19 — Voice Tutor & Conversational AI Assistant (Hardened in Phase 20)  
**Platform Version:** v0.1.0  
**Status:** COMPLETED & PRODUCTION-HARDENED  
**Architecture:** Web Speech API Interface layer wrapping Central Socratic AI Tutor  
**Date:** October 2, 2026  
**Hardening Reference:** See [PHASE_20_VOICE_VALIDATION.md](file:///c:/Users/dwight/Downloads/tuklas-ai/docs/PHASE_20_VOICE_VALIDATION.md)  

---

## 1. Architecture

Phase 19 introduces a voice interface around the existing central Tuklas AI Tutor. It is deliberately designed not as a secondary, disconnected chatbot or competing LLM pipeline, but as an accessible multi-modal input/output interface strictly integrated with the existing educational brain:

```
                  Student (Microphone Speech)
                              │
                              ▼
                 Browser SpeechRecognition API
                              │
                              ▼
                   Sanitized Text Transcript
                              │
                              ▼
          Existing Authenticated /api/ai/tutor Pipeline
                              │
          ┌───────────────────┴───────────────────┐
          ▼                                       ▼
Existing Lesson/Practice Context       Student Profile & Rate Limiting
          │                                       │
          └───────────────────┬───────────────────┘
                              ▼
        Socratic Prompt Engine / Gemini / Local Fallback
                              │
                              ▼
           Deterministic Output Validation & Storage
                              │
          ┌───────────────────┴───────────────────┐
          ▼                                       ▼
 Visual Math Display (UI)            Browser SpeechSynthesis (TTS)
(KaTeX Markdown in Panel)               (Natural Voice Readout)
```

### Module Organization
- `src/lib/voice/voice-types.ts`: Core type definitions for voice states (`IDLE`, `LISTENING`, `PROCESSING`, `SPEAKING`, `ERROR`, `UNSUPPORTED`), options, and error categories.
- `src/lib/voice/voice-utils.ts`: Capability detection, error code mapping, transcript sanitization, and mathematical text formatting for natural speech synthesis.
- `src/lib/voice/speech-recognition.ts`: Browser `SpeechRecognition` controller with lifecycle hooks, auto-stop, and error handling.
- `src/lib/voice/speech-synthesis.ts`: Browser `SpeechSynthesis` controller for reading responses aloud with natural cadence and math translation.
- `src/components/ai/VoiceWaveform.tsx`: Visual animated waveform indicator reflecting listening/speaking states.
- `src/components/ai/VoiceTutorButton.tsx`: Student-facing microphone toggle button adhering to WCAG 44×44px touch target guidelines.
- `src/components/ai/VoiceTutorPanel.tsx`: Floating status, live interim transcript preview, and auto-read toggle controls.
- `src/components/ai/AITutorPanel.tsx`: Seamlessly integrates voice controls into the existing Socratic AI Tutor modal.

---

## 2. Speech-to-Text (STT)

1. **API Integration:** Utilizes the standard browser Web Speech Recognition API (`SpeechRecognition` or `webkitSpeechRecognition`).
2. **Intentional Activation:** Microphone access is never requested on page load. It is only requested when the student explicitly clicks "Talk to Tuklas".
3. **State Management:**
   - `IDLE`: Microphone inactive.
   - `LISTENING`: Microphone capturing student speech; live waveform animated in rose red.
   - `PROCESSING`: Final transcript submitted to AI Tutor; loading indicator displayed.
   - `SPEAKING`: Tutor response being read aloud; waveform animated in emerald green.
   - `ERROR`: Friendly, non-blocking error display with retry and text fallback options.
   - `UNSUPPORTED`: Graceful fallback explaining voice input is unavailable in the current browser.
4. **Interim and Final Transcripts:** Displays real-time speech preview as the student speaks, finalizing upon completion of utterance.

---

## 3. Text-to-Speech (TTS)

1. **API Integration:** Utilizes browser `window.speechSynthesis` and `SpeechSynthesisUtterance`.
2. **Mathematical Audio Translation:** Mathematical expressions and LaTeX formulas are translated into natural conversational English prior to synthesis via `formatTextForSpeech`:
   - `$(-3) + 5$` is spoken as *"negative 3 plus 5"*
   - `\frac{1}{2}` is spoken as *"1 over 2"*
   - `\times` / `\cdot` are spoken as *"times"*
   - `\sqrt{x}` is spoken as *"square root of x"*
3. **Control & Muting:** 
   - Audible readout occurs when Voice Tutor mode is engaged or when the student clicks the "Read aloud" speaker icon on any specific AI message.
   - A visible "Stop Speaking" button is available at all times to halt speech immediately.
   - Automatic cleanup cancels active speech when the tutor panel is closed or minimized.

---

## 4. Existing AI Tutor Integration

The voice system reuses the existing backend pipeline without altering core educational engines:
- Spoken transcripts are sent to `POST /api/ai/tutor`.
- Multi-turn conversation history is maintained via persistent `conversationId`.
- Context from active lesson, skill, question, and practice session is preserved.
- Socratic non-disclosure of answers remains enforced: the tutor provides hints, questions, and guidance rather than direct solutions.

---

## 5. Authentication

- Voice interactions require a valid user session.
- Protected requests transmit cryptographic session tokens via HTTP-only cookies or `Authorization: Bearer <token>` headers.
- Unauthenticated requests are rejected with HTTP 401 Unauthorized.

---

## 6. Authorization & Data Isolation (IDOR)

- **Student Isolation:** Student A cannot query or read AI conversations belonging to Student B (HTTP 404/403 enforced).
- **Mastery Integrity:** Spoken queries cannot manipulate mastery levels, scores, or progression status. Field injections are stripped server-side.
- **Teacher Controls:** Respects instructor settings: if an instructor disables AI Tutor assistance for a classroom, voice requests are blocked with HTTP 403.

---

## 7. Privacy & Audio Handling

- **Zero Audio Storage:** Raw audio streams from the student's microphone are processed in-memory by the browser and discarded immediately.
- **Database Schema Integrity:** No audio tables, recording files, or voice biometrics are persisted.
- Spoken transcripts are stored solely as text messages within the existing `AITutorMessage` table for instructional continuity.

---

## 8. Browser Compatibility

| Browser | Speech Recognition (STT) | Speech Synthesis (TTS) | Experience |
| :--- | :---: | :---: | :--- |
| **Google Chrome / Chromium** | Native Support | Native Support | Full Voice Tutor (Speech In + Speech Out) |
| **Microsoft Edge** | Native Support | Native Support | Full Voice Tutor (Speech In + Speech Out) |
| **Apple Safari (macOS / iOS)** | Native Support (`webkitSpeechRecognition`) | Native Support | Full Voice Tutor (Speech In + Speech Out) |
| **Mozilla Firefox** | Unsupported (Flags required) | Native Support | Text-to-Speech + Standard Keyboard Input Fallback |

---

## 9. Fallback Behavior

1. **Unsupported Browser:** Clear message: *"Voice input is not supported in this browser. You can still type your question."* The chat text box and suggestion pills remain fully functional.
2. **Permission Denied:** Friendly guidance: *"Microphone access was denied. Please allow microphone permissions in your browser or type your question."*
3. **No Speech Detected:** Reassures student: *"No speech was detected. Please tap the microphone and try speaking again."*
4. **AI Outage:** If external LLM calls fail, the system automatically falls back to the local deterministic Socratic engine without interrupting the voice session.

---

## 10. Accessibility (a11y)

- All buttons feature descriptive `aria-label` attributes (e.g., `aria-label="Talk to Tuklas with microphone"`, `aria-label="Stop reading response aloud"`).
- Touch target sizes meet standard WCAG guidelines (minimum 44×44px).
- Dynamic voice states announce changes via `aria-live="polite"` regions.
- Visual waveforms include `aria-hidden="true"` to prevent screen reader clutter.
- High-contrast visual focus rings for keyboard navigation.

---

## 11. Rate Limiting

- Voice messages are subject to the same student rate-limiting sliding window (20 requests per minute) as text queries.
- Exceeding the threshold triggers HTTP 429 Too Many Requests with a safe, polite retry countdown.

---

## 12. Testing & Verification

- **Automated Test Suite:** `scripts/test-phase19-voice-tutor.ts` (38 assertions covering capability detection, math speech formatting, controllers, AI Tutor integration, multi-turn history, authentication, IDOR isolation, and rate limiting).
- **Smoke Test Script:** `scripts/smoke-test-voice-tutor.ts` (validates API flow and documents manual verification procedure).
- **Regression Suite:** All 356 previous assertions from Phases 1–18 remain 100% passing.
- **Combined Test Count:** **394/394 assertions PASS (100%)**.
- **Static Analysis:** `npx tsc --noEmit` reports **0 errors**.
- **Build Status:** `npm run build` completes cleanly with production bundles emitted.

---

## 13. Known Limitations

1. **Headless / Node.js CI Limitations:** Headless command-line runners lack physical microphone and audio speaker hardware; automated tests utilize deterministic adapters and API simulations. Real audio input requires interactive browser testing.
2. **Firefox Web Speech Recognition:** Mozilla Firefox does not support the Web Speech Recognition API by default; Firefox users utilize standard keyboard input alongside Speech Synthesis.
3. **Dialect / Accent Variations:** Browser speech recognition accuracy may vary across regional accents or rapid code-switching between Tagalog and English (Taglish).

---

## 14. Future Provider Architecture (Phase 20+)

Future enhancements may introduce:
- Server-side streaming speech synthesis using neural voices.
- Filipino (`fil-PH`) localized speech models for bilingual Taglish mathematical explanations.
- Whisper-based transcription fallback for unsupported browsers.
