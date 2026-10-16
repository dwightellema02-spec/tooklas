/**
 * Diagnostic Script: Test Speech Recognition in real Microsoft Edge
 */
import { spawn } from "child_process";
import WebSocket from "ws";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const DEBUG_PORT = 9224;

async function diagnoseEdge() {
  console.log("==================================================================");
  console.log("   TUKLAS AI — MICROSOFT EDGE SPEECH RECOGNITION DIAGNOSIS");
  console.log("==================================================================");

  // 1. Launch Microsoft Edge with remote debugging port
  console.log("[DIAG] Launching Microsoft Edge...");
  const edgeProc = spawn(EDGE_PATH, [
    `--remote-debugging-port=${DEBUG_PORT}`,
    "--headless=new",
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    "http://localhost:3000",
  ], { stdio: "ignore" });

  await new Promise((r) => setTimeout(r, 2500));

  try {
    // 2. Fetch Edge targets
    const versionRes = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
    const versionJson = await versionRes.json();
    console.log("[DIAG] Edge Browser Version:", versionJson["Browser"]);
    console.log("[DIAG] Edge User Agent:", versionJson["User-Agent"]);

    const targetsRes = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
    const targets = await targetsRes.json();
    const pageTarget = targets.find((t: any) => t.type === "page");

    if (!pageTarget) {
      throw new Error("No page target found in Microsoft Edge");
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

    ws.onmessage = (event: any) => {
      const data = JSON.parse(event.data.toString());
      if (data.id && pendingPromises.has(data.id)) {
        const resolver = pendingPromises.get(data.id)!;
        pendingPromises.delete(data.id);
        resolver(data.result !== undefined ? data.result : data);
      }
    };

    await sendCommand("Runtime.enable");
    await sendCommand("Page.enable");
    await sendCommand("Console.enable");

    // 3. Test Web Speech API availability directly in Edge
    console.log("\n[CHECKPOINT 1] Edge Web Speech API Primitive Check:");
    const primitivesRes = await sendCommand("Runtime.evaluate", {
      expression: `(() => {
        return {
          hasSpeechRecognition: 'SpeechRecognition' in window,
          hasWebkitSpeechRecognition: 'webkitSpeechRecognition' in window,
          hasMediaDevices: Boolean(navigator.mediaDevices),
          hasGetUserMedia: Boolean(navigator.mediaDevices?.getUserMedia),
          isSecureContext: window.isSecureContext,
          origin: window.location.origin,
        };
      })()`,
      returnByValue: true,
    });
    console.log("  API Primitives:", JSON.stringify(primitivesRes?.result?.value, null, 2));

    // 4. Test creating SpeechRecognition and starting with "fil-PH" in Edge
    console.log("\n[CHECKPOINT 2] Edge SpeechRecognition with 'fil-PH' Lifecycle Check:");
    const filLangRes = await sendCommand("Runtime.evaluate", {
      expression: `(async () => {
        const SpeechClass = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechClass) return { error: "NO_SPEECH_CLASS" };

        const rec = new SpeechClass();
        rec.lang = "fil-PH";
        rec.continuous = true;
        rec.interimResults = true;

        const events = [];
        rec.onstart = () => events.push("onstart");
        rec.onaudiostart = () => events.push("onaudiostart");
        rec.onspeechstart = () => events.push("onspeechstart");
        rec.onerror = (e) => events.push({ error: e.error, message: e.message });
        rec.onend = () => events.push("onend");

        try {
          rec.start();
          events.push("start_called");
        } catch (err) {
          events.push({ thrownError: err.name + ": " + err.message });
        }

        await new Promise(r => setTimeout(r, 1500));
        try { rec.abort(); } catch {}

        return { lang: "fil-PH", events };
      })()`,
      awaitPromise: true,
      returnByValue: true,
    });
    console.log("  'fil-PH' Result:", JSON.stringify(filLangRes?.result?.value, null, 2));

    // 5. Test creating SpeechRecognition and starting with "en-US" in Edge
    console.log("\n[CHECKPOINT 3] Edge SpeechRecognition with 'en-US' Lifecycle Check:");
    const enLangRes = await sendCommand("Runtime.evaluate", {
      expression: `(async () => {
        const SpeechClass = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechClass) return { error: "NO_SPEECH_CLASS" };

        const rec = new SpeechClass();
        rec.lang = "en-US";
        rec.continuous = true;
        rec.interimResults = true;

        const events = [];
        rec.onstart = () => events.push("onstart");
        rec.onaudiostart = () => events.push("onaudiostart");
        rec.onspeechstart = () => events.push("onspeechstart");
        rec.onerror = (e) => events.push({ error: e.error, message: e.message });
        rec.onend = () => events.push("onend");

        try {
          rec.start();
          events.push("start_called");
        } catch (err) {
          events.push({ thrownError: err.name + ": " + err.message });
        }

        await new Promise(r => setTimeout(r, 1500));
        try { rec.abort(); } catch {}

        return { lang: "en-US", events };
      })()`,
      awaitPromise: true,
      returnByValue: true,
    });
    console.log("  'en-US' Result:", JSON.stringify(enLangRes?.result?.value, null, 2));

    // 6. Navigate to the Tuklas AI Tutor page in Edge, log in, and test clicking the actual button
    console.log("\n[CHECKPOINT 4] Edge Live Click on Talk to Tuklas Button in AITutorPanel:");
    const loginRes = await fetch("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "student@tuklas.ai", password: "Tuklas2026!" }),
    });
    const loginJson = await loginRes.json();
    const token = loginJson.token || loginJson.data?.token;

    await sendCommand("Page.navigate", { url: "http://localhost:3000/student/lessons/lsn_01" });
    await new Promise((r) => setTimeout(r, 1500));

    await sendCommand("Runtime.evaluate", {
      expression: `localStorage.setItem("tuklas_session_token", ${JSON.stringify(token)})`,
    });
    await sendCommand("Page.navigate", { url: "http://localhost:3000/student/lessons/lsn_01" });
    await new Promise((r) => setTimeout(r, 3000));

    // Collect console logs
    const consoleLogs: string[] = [];
    ws.onmessage = (event: any) => {
      const data = JSON.parse(event.data.toString());
      if (data.method === "Runtime.consoleAPICalled") {
        const text = data.params?.args?.map((a: any) => a.value || a.description || JSON.stringify(a)).join(" ");
        consoleLogs.push(text);
      }
      if (data.id && pendingPromises.has(data.id)) {
        const resolver = pendingPromises.get(data.id)!;
        pendingPromises.delete(data.id);
        resolver(data.result !== undefined ? data.result : data);
      }
    };

    // Open AI Tutor panel
    await sendCommand("Runtime.evaluate", {
      expression: `(() => {
        const tutorBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('AI Tutor'));
        if (tutorBtn) tutorBtn.click();
      })()`,
    });
    await new Promise((r) => setTimeout(r, 1500));

    // Check button state before click
    const beforeClickRes = await sendCommand("Runtime.evaluate", {
      expression: `(() => {
        const micBtn = Array.from(document.querySelectorAll('button')).find(b =>
          b.getAttribute('aria-label')?.includes('Talk to Tuklas') || b.getAttribute('title')?.includes('microphone')
        );
        return {
          micBtnFound: Boolean(micBtn),
          outerHTML: micBtn?.outerHTML,
          disabled: micBtn?.disabled,
          style: micBtn?.getAttribute('style'),
          className: micBtn?.className,
        };
      })()`,
      returnByValue: true,
    });
    console.log("  Button before click:", JSON.stringify(beforeClickRes?.result?.value, null, 2));

    // Click the microphone button in Edge
    console.log("[DIAG] Triggering click on microphone button in Edge...");
    const clickRes = await sendCommand("Runtime.evaluate", {
      expression: `(async () => {
        const micBtn = Array.from(document.querySelectorAll('button')).find(b =>
          b.getAttribute('aria-label')?.includes('Talk to Tuklas') || b.getAttribute('title')?.includes('microphone')
        );
        if (!micBtn) return { error: "NO_MIC_BUTTON" };

        micBtn.click();
        await new Promise(r => setTimeout(r, 2000));

        const micBtnAfter = Array.from(document.querySelectorAll('button')).find(b =>
          b.getAttribute('aria-label')?.includes('voice') ||
          b.getAttribute('aria-label')?.includes('listening') ||
          b.getAttribute('title')?.includes('Listening') ||
          b.getAttribute('aria-label')?.includes('Talk to Tuklas')
        );

        const controller = window.__TUKLAS_SPEECH_CONTROLLER__;

        return {
          afterAriaLabel: micBtnAfter?.getAttribute('aria-label'),
          afterTitle: micBtnAfter?.getAttribute('title'),
          afterDisabled: micBtnAfter?.disabled,
          afterClassName: micBtnAfter?.className,
          controllerListening: controller ? controller.isListening() : null,
          controllerStarting: controller ? controller.starting : null,
        };
      })()`,
      awaitPromise: true,
      returnByValue: true,
    });
    console.log("  Button after click:", JSON.stringify(clickRes?.result?.value, null, 2));

    console.log("\n[CHECKPOINT 5] Console Logs Captured During Click:");
    consoleLogs.forEach((log) => console.log("   ", log));

    ws.close();
  } catch (err: any) {
    console.error("Diagnosis error:", err);
  } finally {
    try {
      edgeProc.kill();
    } catch {}
  }
}

diagnoseEdge();
