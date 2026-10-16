/**
 * Deep Edge Web Speech Investigation Script
 */
import { spawn } from "child_process";
import WebSocket from "ws";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const DEBUG_PORT = 9225;

async function testEdgeLanguagesAndLifecycle() {
  console.log("==================================================================");
  console.log("   EDGE WEB SPEECH API DEEP DIVE INVESTIGATION");
  console.log("==================================================================");

  const edgeProc = spawn(EDGE_PATH, [
    `--remote-debugging-port=${DEBUG_PORT}`,
    "--headless=new",
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    "http://localhost:3000",
  ], { stdio: "ignore" });

  await new Promise((r) => setTimeout(r, 2000));

  try {
    const targetsRes = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
    const targets = await targetsRes.json();
    const pageTarget = targets.find((t: any) => t.type === "page");

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

    // Test 1: Test multiple languages in Edge with a 4-second wait to observe all events
    console.log("\n[TEST 1] Testing language lifecycle in Edge for 4 seconds each:");
    const testLangs = ["fil-PH", "tl-PH", "en-PH", "en-US", ""];

    for (const lang of testLangs) {
      const res = await sendCommand("Runtime.evaluate", {
        expression: `(async () => {
          const SpeechClass = window.SpeechRecognition || window.webkitSpeechRecognition;
          const rec = new SpeechClass();
          if (${JSON.stringify(lang)}) {
            rec.lang = ${JSON.stringify(lang)};
          }
          rec.continuous = true;
          rec.interimResults = true;

          const log = [];
          rec.onstart = () => log.push("onstart");
          rec.onaudiostart = () => log.push("onaudiostart");
          rec.onspeechstart = () => log.push("onspeechstart");
          rec.onspeechend = () => log.push("onspeechend");
          rec.onaudioend = () => log.push("onaudioend");
          rec.onerror = (e) => log.push({ event: "onerror", error: e.error, message: e.message });
          rec.onend = () => log.push("onend");

          try {
            rec.start();
            log.push("start_ok");
          } catch (err) {
            log.push({ thrown: err.name + ": " + err.message });
          }

          await new Promise(r => setTimeout(r, 4000));
          try { rec.abort(); } catch {}
          return { lang: ${JSON.stringify(lang)} || "default", log };
        })()`,
        awaitPromise: true,
        returnByValue: true,
      });
      console.log(`  Language [${lang || "browser default"}]:`, JSON.stringify(res?.result?.value, null, 2));
    }

    // Test 2: Test what happens with getUserMedia track.stop() vs without track.stop() in Edge
    console.log("\n[TEST 2] Testing getUserMedia interaction with webkitSpeechRecognition in Edge:");
    const gumTestRes = await sendCommand("Runtime.evaluate", {
      expression: `(async () => {
        const log = [];
        // Scenario A: getUserMedia then stop track then start recognition
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(t => t.stop());
          log.push("gum_tracks_stopped");

          const SpeechClass = window.SpeechRecognition || window.webkitSpeechRecognition;
          const rec = new SpeechClass();
          rec.onstart = () => log.push("recA_onstart");
          rec.onaudiostart = () => log.push("recA_onaudiostart");
          rec.onerror = (e) => log.push({ recA_error: e.error });
          rec.onend = () => log.push("recA_onend");
          rec.start();
          await new Promise(r => setTimeout(r, 2000));
          try { rec.abort(); } catch {}
        } catch (err) {
          log.push({ errorA: err.message });
        }

        // Scenario B: start recognition directly WITHOUT getUserMedia track.stop()
        try {
          const SpeechClass = window.SpeechRecognition || window.webkitSpeechRecognition;
          const recB = new SpeechClass();
          recB.onstart = () => log.push("recB_onstart");
          recB.onaudiostart = () => log.push("recB_onaudiostart");
          recB.onerror = (e) => log.push({ recB_error: e.error });
          recB.onend = () => log.push("recB_onend");
          recB.start();
          await new Promise(r => setTimeout(r, 2000));
          try { recB.abort(); } catch {}
        } catch (err) {
          log.push({ errorB: err.message });
        }

        return log;
      })()`,
      awaitPromise: true,
      returnByValue: true,
    });
    console.log("  GUM Test Log:", JSON.stringify(gumTestRes?.result?.value, null, 2));

    ws.close();
  } catch (err: any) {
    console.error("Test error:", err);
  } finally {
    try { edgeProc.kill(); } catch {}
  }
}

testEdgeLanguagesAndLifecycle();
