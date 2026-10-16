import { spawn } from "child_process";
import WebSocket from "ws";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const DEBUG_PORT = 9252;

async function testEdgeTTSEnglish() {
  console.log("==================================================================");
  console.log("   EDGE ENGLISH SPEECH SYNTHESIS REAL RUNTIME TEST");
  console.log("==================================================================");

  const edgeProc = spawn(EDGE_PATH, [
    `--remote-debugging-port=${DEBUG_PORT}`,
    "--headless=new",
    "http://localhost:3000/student/lessons/lsn_01",
  ], { stdio: "ignore" });

  await new Promise((r) => setTimeout(r, 2000));

  try {
    const listRes = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
    const targets = await listRes.json();
    const pageTarget = targets.find((t: any) => t.type === "page" && t.url.includes("localhost:3000"));

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

    // Login student
    const loginRes = await fetch("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "student@tuklas.ai", password: "Tuklas2026!" }),
    });
    const { token } = await loginRes.json();

    await sendCommand("Runtime.evaluate", {
      expression: `localStorage.setItem("tuklas_session_token", ${JSON.stringify(token)})`,
    });
    await sendCommand("Page.navigate", { url: "http://localhost:3000/student/lessons/lsn_01" });
    await new Promise((r) => setTimeout(r, 3000));

    // Open AI Tutor Panel
    await sendCommand("Runtime.evaluate", {
      expression: `(() => {
        const tutorBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('AI Tutor'));
        if (tutorBtn) tutorBtn.click();
      })()`,
    });
    await new Promise((r) => setTimeout(r, 2000));

    // Attach speak interceptor
    await sendCommand("Runtime.evaluate", {
      expression: `(() => {
        window.__CAPTURED_UTTERANCES__ = [];
        const origSpeak = window.speechSynthesis.speak.bind(window.speechSynthesis);
        window.speechSynthesis.speak = (utt) => {
          window.__CAPTURED_UTTERANCES__.push({
            text: utt.text,
            lang: utt.lang,
            rate: utt.rate,
            pitch: utt.pitch,
            voiceName: utt.voice ? utt.voice.name : null,
            voiceLang: utt.voice ? utt.voice.lang : null,
          });
          origSpeak(utt);
        };
      })()`,
    });

    // Type English query into input using React native value setter and submit
    console.log("[TEST] Sending English question to AI Tutor...");
    await sendCommand("Runtime.evaluate", {
      expression: `(async () => {
        const input = document.querySelector('input[aria-label="Ask a question to Tuklas AI Tutor"]');
        if (input) {
          const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          nativeSetter.call(input, "Please explain in English: what is an integer?");
          input.dispatchEvent(new Event('input', { bubbles: true }));
          await new Promise(r => setTimeout(r, 200));
          const form = document.querySelector('form');
          form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }
      })()`,
    });

    // Wait for the new response to arrive
    await new Promise((r) => setTimeout(r, 4000));

    // Click the read aloud button on the newest message
    const clickRes = await sendCommand("Runtime.evaluate", {
      expression: `(async () => {
        const readBtns = Array.from(document.querySelectorAll('button')).filter(b =>
          b.getAttribute('aria-label') === 'Read response aloud' || b.getAttribute('title') === 'Read aloud'
        );
        if (readBtns.length === 0) return { error: "NO_READ_BUTTONS" };
        
        // Click the latest message's button
        readBtns[readBtns.length - 1].click();
        await new Promise(r => setTimeout(r, 1200));

        return {
          clicked: true,
          captured: window.__CAPTURED_UTTERANCES__,
        };
      })()`,
      awaitPromise: true,
      returnByValue: true,
    });

    console.log("[DIAG] CLICKED ENGLISH READ ALOUD RESULT:");
    console.log(JSON.stringify(clickRes?.result?.value, null, 2));

    ws.close();
  } catch (err: any) {
    console.error("Test failed:", err);
  } finally {
    try { edgeProc.kill(); } catch {}
  }
}

testEdgeTTSEnglish();
