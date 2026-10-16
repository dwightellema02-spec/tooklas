/**
 * Tuklas AI - Comprehensive Speech Recognition & Real Browser Verification Suite
 * Phase 21 Hardened Microphone Fix Verification
 */

import { spawn } from "child_process";
import { SpeechRecognitionController } from "../src/lib/voice/speech-recognition";
import { isSpeechRecognitionSupported, sanitizeTranscript, mapRecognitionError } from "../src/lib/voice/voice-utils";

async function main() {
  console.log("==================================================================");
  console.log("   TUKLAS AI — COMPREHENSIVE MICROPHONE & BROWSER VERIFICATION");
  console.log("==================================================================");

  let passedCount = 0;
  let totalCount = 0;

  function assert(desc: string, cond: boolean, details?: any) {
    totalCount++;
    if (cond) {
      console.log(`  [PASS] ${desc}`);
      passedCount++;
    } else {
      console.error(`  [FAIL] ${desc}`, details ? `-> ${JSON.stringify(details)}` : "");
    }
  }

  // -------------------------------------------------------------------------
  // SECTION 1: UNIT & LIFECYCLE TESTS (SIMULATED DOM ENVIRONMENT)
  // -------------------------------------------------------------------------
  console.log("\n[TEST SECTION 1] SpeechRecognitionController Lifecycle & Transcript Logic...");

  // Mock Window & SpeechRecognition for deterministic unit tests
  class MockSpeechRecognition {
    continuous = false;
    interimResults = false;
    maxAlternatives = 1;
    lang = "";
    onstart: (() => void) | null = null;
    onresult: ((event: any) => void) | null = null;
    onerror: ((event: any) => void) | null = null;
    onend: (() => void) | null = null;
    started = false;

    start() {
      if (this.started) throw new Error("Failed to execute 'start' on 'SpeechRecognition': recognition has already started.");
      this.started = true;
      setTimeout(() => this.onstart?.(), 10);
    }

    stop() {
      this.started = false;
      setTimeout(() => this.onend?.(), 10);
    }

    abort() {
      this.started = false;
      setTimeout(() => this.onend?.(), 10);
    }
  }

  // Set up mock window in node environment
  (globalThis as any).window = {
    SpeechRecognition: MockSpeechRecognition,
    webkitSpeechRecognition: MockSpeechRecognition,
  };

  // 1.1 Support check
  assert("SpeechRecognition is detected as supported", isSpeechRecognitionSupported());

  // 1.2 Controller initialization
  let startedFired: boolean = false;
  let transcriptReceived: string = "";
  let isFinalReceived: boolean = false;
  let errorFired: any = null;
  let endFired: boolean = false;

  const controller = new SpeechRecognitionController({
    onStart: () => { startedFired = true; },
    onResult: (res) => {
      transcriptReceived = res.transcript;
      isFinalReceived = res.isFinal;
    },
    onError: (err) => { errorFired = err; },
    onEnd: () => { endFired = true; },
  });

  // 1.3 Start recognition
  await controller.start({ continuous: true, interimResults: true, lang: "fil-PH" });
  await new Promise((r) => setTimeout(r, 30));
  assert("Recognition started successfully (onStart fired)", startedFired);
  assert("Controller reports isListening() = true", controller.isListening());

  // 1.4 Interim Transcript Received
  const recInstance = (controller as any).recognitionInstance;
  recInstance.onresult({
    results: [
      [{ transcript: "Ano ang" }],
    ],
  });
  assert("Interim transcript processed without error", transcriptReceived === "Ano ang");
  assert("Interim result marked isFinal = false", isFinalReceived === false);

  // 1.5 Continuous Accumulation: Final + Second Interim Segment
  recInstance.onresult({
    results: [
      Object.assign([{ transcript: "Ano ang" }], { isFinal: true }),
      [{ transcript: "integer" }],
    ],
  });
  assert("Accumulated continuous transcript combines final and interim phrases", transcriptReceived === "Ano ang integer");
  assert("Composite result is not final while interim phrase continues", isFinalReceived === false);

  // 1.6 Fully Finalized Phrase
  recInstance.onresult({
    results: [
      Object.assign([{ transcript: "Ano ang" }], { isFinal: true }),
      Object.assign([{ transcript: "integer" }], { isFinal: true }),
    ],
  });
  assert("Final composite transcript preserved intact", transcriptReceived === "Ano ang integer");
  assert("Complete result marked isFinal = true", Boolean(isFinalReceived));

  // 1.7 Prevent duplicate start while listening
  const duplicateStart = await controller.start();
  assert("Duplicate start() call safely returns true without throwing", duplicateStart === true);

  // 1.8 Clean stop toggle
  controller.stop();
  await new Promise((r) => setTimeout(r, 30));
  assert("Controller reports isListening() = false after stop()", controller.isListening() === false);
  assert("onEnd fired on clean stop", endFired);

  // 1.9 Error Mapping & Recovery
  const errMap1 = mapRecognitionError("not-allowed");
  assert("not-allowed maps to PERMISSION_DENIED with friendly guidance", errMap1.type === "PERMISSION_DENIED" && errMap1.userMessage.includes("blocked"));

  const errMap2 = mapRecognitionError("no-speech");
  assert("no-speech maps to NO_SPEECH with retry guidance", errMap2.type === "NO_SPEECH" && errMap2.userMessage.includes("try speaking"));

  // 1.10 Sanitize transcript retains math content
  const cleaned = sanitizeTranscript("  ano   ang    negative  3  ");
  assert("Sanitize transcript normalizes whitespace", cleaned === "ano ang negative 3");

  // -------------------------------------------------------------------------
  // SECTION 2: REAL GOOGLE CHROME BROWSER E2E TEST (VIA CDP)
  // -------------------------------------------------------------------------
  console.log("\n[TEST SECTION 2] Real Google Chrome E2E Verification on http://localhost:3000...");

  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const chromeProcess = spawn(chromePath, [
    "--remote-debugging-port=9222",
    "--headless=new",
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    "--no-first-run",
    "--no-default-browser-check",
    "http://localhost:3000",
  ]);

  await new Promise((r) => setTimeout(r, 2000));

  try {
    const listRes = await fetch("http://127.0.0.1:9222/json/list");
    const targets = await listRes.json();
    const pageTarget = targets.find((t: any) => t.type === "page");
    if (!pageTarget || !pageTarget.webSocketDebuggerUrl) {
      throw new Error("No page target found on Chrome remote debugging port");
    }

    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    let msgId = 1;
    const pendingPromises = new Map<number, (res: any) => void>();

    function sendCommand(method: string, params: any = {}): Promise<any> {
      return new Promise((resolve) => {
        const id = msgId++;
        pendingPromises.set(id, resolve);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data.toString());
      if (data.id && pendingPromises.has(data.id)) {
        const resolver = pendingPromises.get(data.id)!;
        pendingPromises.delete(data.id);
        resolver(data.result !== undefined ? data.result : data);
      }
    };

    await sendCommand("Runtime.enable");
    await sendCommand("Page.enable");
    await sendCommand("DOM.enable");

    // 2.1 Authenticate student via login API
    const loginRes = await fetch("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "student@tuklas.ai", password: "Tuklas2026!" }),
    });
    const loginJson = await loginRes.json();
    const token = loginJson.token || loginJson.data?.token;

    assert("Student successfully authenticated (JWT token received)", Boolean(token && token.length > 20));

    // 2.2 Authenticate inside the browser context (sets HttpOnly SameSite=Lax cookie) and navigate to lesson page
    await sendCommand("Runtime.evaluate", {
      expression: `(async () => {
        await fetch("/api/auth/dev-quick-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ role: "STUDENT" }),
        });
      })()`,
      awaitPromise: true,
    });
    await sendCommand("Page.navigate", { url: "http://localhost:3000/student/lessons/lsn_01" });
    await new Promise((r) => setTimeout(r, 3500));

    // 2.3 Open AI Tutor Panel
    const openRes = await sendCommand("Runtime.evaluate", {
      expression: `(async () => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const tutorBtn = buttons.find(b => b.textContent && b.textContent.includes('AI Tutor'));
        if (tutorBtn) {
          tutorBtn.click();
          await new Promise(r => setTimeout(r, 1000));
        }
        const micBtn = Array.from(document.querySelectorAll('button')).find(
          b => b.getAttribute('aria-label')?.includes('Talk to Tuklas') || b.getAttribute('title')?.includes('microphone')
        );
        const inputElem = document.querySelector('input[aria-label*="Ask a question"]');
        return {
          panelOpened: Boolean(micBtn),
          micAriaLabel: micBtn?.getAttribute('aria-label'),
          inputPlaceholder: inputElem ? inputElem.placeholder : null,
        };
      })()`,
      awaitPromise: true,
      returnByValue: true,
    });
    const openData = openRes?.value !== undefined ? openRes.value : openRes?.result?.value;
    assert("AI Tutor panel opened on student lesson page", openData?.panelOpened === true);
    assert("Compact microphone button rendered with accessible label", Boolean(openData?.micAriaLabel?.includes("Talk to Tuklas")));

    // 2.4 Click the microphone button and verify real browser speech recognition transition
    const clickRes = await sendCommand("Runtime.evaluate", {
      expression: `(async () => {
        const micBtn = Array.from(document.querySelectorAll('button')).find(
          b => b.getAttribute('aria-label')?.includes('Talk to Tuklas') || b.getAttribute('title')?.includes('microphone')
        );
        if (!micBtn) return { error: 'NO_MIC_BTN' };
        micBtn.click();
        await new Promise(r => setTimeout(r, 1200));

        const allBtns = Array.from(document.querySelectorAll('button'));
        const activeMic = allBtns.find(b =>
          b.getAttribute('aria-label')?.includes('voice') ||
          b.getAttribute('aria-label')?.includes('listening') ||
          b.getAttribute('title')?.includes('Listening') ||
          b.getAttribute('aria-label')?.includes('Stop')
        );
        const inputElem = document.querySelector('input[aria-label*="Ask a question"]');
        const bannerText = document.querySelector('[role="region"][aria-label*="Voice Tutor"]')?.textContent;

        return {
          isListeningButton: Boolean(activeMic),
          activeMicTitle: activeMic?.getAttribute('title'),
          activeMicLabel: activeMic?.getAttribute('aria-label'),
          inputPlaceholder: inputElem ? inputElem.placeholder : null,
          hasListeningBanner: Boolean(bannerText && bannerText.includes("Listening")),
        };
      })()`,
      awaitPromise: true,
      returnByValue: true,
    });
    const clickData = clickRes?.value !== undefined ? clickRes.value : clickRes?.result?.value;
    assert("Microphone button transitions to LISTENING state", clickData?.isListeningButton === true);
    assert("Microphone button title displays 'Listening... Tap to stop'", Boolean(clickData?.activeMicTitle?.includes("Listening")));
    assert("Chat input placeholder displays 'Listening to your voice...'", Boolean(clickData?.inputPlaceholder?.includes("Listening")));
    assert("Voice status banner displays active listening indicator", clickData?.hasListeningBanner === true);

    // 2.5 Deliver speech transcript into input field and verify update
    const transcriptDeliveryRes = await sendCommand("Runtime.evaluate", {
      expression: `(async () => {
        const controller = window.__TUKLAS_SPEECH_CONTROLLER__;
        if (controller && typeof controller.deliverTranscript === 'function') {
          controller.deliverTranscript("Ano ang integer?", true);
        }
        await new Promise(r => setTimeout(r, 600));

        let submitBtn = Array.from(document.querySelectorAll('button')).find(b => b.getAttribute('aria-label')?.includes('Send question'));
        // Wait up to 10s if initial auto-hint was still loading from network/AI
        for (let i = 0; i < 100; i++) {
          submitBtn = Array.from(document.querySelectorAll('button')).find(b => b.getAttribute('aria-label')?.includes('Send question'));
          if (submitBtn && !submitBtn.disabled) break;
          await new Promise(r => setTimeout(r, 100));
        }

        const inputElem = document.querySelector('input[aria-label*="Ask a question"]');
        return {
          hasController: Boolean(controller),
          inputValue: inputElem ? inputElem.value : null,
          submitBtnFound: Boolean(submitBtn),
          submitDisabled: submitBtn ? submitBtn.disabled : null,
          submitOuterHTML: submitBtn ? submitBtn.outerHTML : null,
          submitEnabled: Boolean(submitBtn && !submitBtn.disabled),
        };
      })()`,
      awaitPromise: true,
      returnByValue: true,
    });
    const transcriptData = transcriptDeliveryRes?.value !== undefined ? transcriptDeliveryRes.value : transcriptDeliveryRes?.result?.value;
    if (!transcriptData?.submitEnabled) {
      console.log("   [DEBUG transcriptData]:", JSON.stringify(transcriptData));
    }
    assert("Chat input contains recognized student words ('Ano ang integer?')", transcriptData?.inputValue === "Ano ang integer?");
    assert("Send button is enabled for student query submission", transcriptData?.submitEnabled === true);

    // 2.6 Stop listening via microphone toggle and ensure transcript is preserved
    const toggleStopRes = await sendCommand("Runtime.evaluate", {
      expression: `(async () => {
        const activeMic = Array.from(document.querySelectorAll('button')).find(b =>
          b.getAttribute('aria-label')?.includes('voice') ||
          b.getAttribute('aria-label')?.includes('listening') ||
          b.getAttribute('title')?.includes('Listening') ||
          b.getAttribute('aria-label')?.includes('Stop')
        );
        if (activeMic) {
          activeMic.click();
          await new Promise(r => setTimeout(r, 800));
        }

        const idleMic = Array.from(document.querySelectorAll('button')).find(b =>
          b.getAttribute('aria-label')?.includes('Talk to Tuklas')
        );
        const inputElem = document.querySelector('input[aria-label*="Ask a question"]');

        return {
          micReturnedToIdle: Boolean(idleMic),
          inputPreserved: inputElem ? inputElem.value : null,
        };
      })()`,
      awaitPromise: true,
      returnByValue: true,
    });
    const toggleData = toggleStopRes?.value !== undefined ? toggleStopRes.value : toggleStopRes?.result?.value;
    assert("Microphone button toggles cleanly back to IDLE state", toggleData?.micReturnedToIdle === true);
    assert("Recognized text remains fully preserved and editable in chat input", toggleData?.inputPreserved === "Ano ang integer?");

    // 2.7 Subsequent session restart test
    const restartRes = await sendCommand("Runtime.evaluate", {
      expression: `(async () => {
        const idleMic = Array.from(document.querySelectorAll('button')).find(b =>
          b.getAttribute('aria-label')?.includes('Talk to Tuklas')
        );
        if (!idleMic) return { error: 'NO_IDLE_MIC' };
        idleMic.click();

        const controller = window.__TUKLAS_SPEECH_CONTROLLER__;
        let canRestartCleanly = false;
        let foundLabel = null;

        for (let i = 0; i < 50; i++) {
          const activeMic = Array.from(document.querySelectorAll('button')).find(b =>
            b.getAttribute('aria-label')?.includes('voice') ||
            b.getAttribute('aria-label')?.includes('listening') ||
            b.getAttribute('title')?.includes('Listening') ||
            b.getAttribute('aria-label')?.includes('Stop')
          );
          if (activeMic || (controller && controller.isListening())) {
            canRestartCleanly = true;
            foundLabel = activeMic ? activeMic.getAttribute('aria-label') : 'controller:listening';
            break;
          }
          await new Promise(r => setTimeout(r, 100));
        }

        return {
          canRestartCleanly,
          found: foundLabel,
          controllerListening: controller ? controller.isListening() : null,
        };
      })()`,
      awaitPromise: true,
      returnByValue: true,
    });
    const restartData = restartRes?.result?.value !== undefined ? restartRes.result.value : restartRes?.value;
    assert("Subsequent recording session starts successfully after stopping", restartData?.canRestartCleanly === true);

    ws.close();
  } catch (err: any) {
    console.error("Browser test error:", err.message);
  } finally {
    chromeProcess.kill();
  }

  console.log("\n==================================================================");
  console.log(`   MICROPHONE VERIFICATION COMPLETE: ${passedCount}/${totalCount} TESTS PASSED`);
  console.log("==================================================================");
}

main().catch(console.error);
