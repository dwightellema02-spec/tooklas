/**
 * Test whether webkitSpeechRecognition prompts natively in Edge
 */
import { spawn } from "child_process";
import WebSocket from "ws";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const DEBUG_PORT = 9231;
const FRESH_PROFILE = "C:\\Users\\dwight\\AppData\\Local\\Microsoft\\Edge\\TestPromptProfile";

async function testNativePrompt() {
  const edgeProc = spawn(EDGE_PATH, [
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${FRESH_PROFILE}`,
    "--no-first-run",
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

    // Test calling start() directly on fresh profile
    const promptTest = await sendCommand("Runtime.evaluate", {
      expression: `(async () => {
        const SpeechClass = window.SpeechRecognition || window.webkitSpeechRecognition;
        const rec = new SpeechClass();
        const log = [];
        rec.onstart = () => log.push("onstart");
        rec.onerror = (e) => log.push("error:" + e.error);
        rec.onend = () => log.push("onend");

        try {
          rec.start();
          log.push("start_ok");
        } catch (e) {
          log.push("thrown:" + e.message);
        }

        await new Promise(r => setTimeout(r, 2000));
        return log;
      })()`,
      awaitPromise: true,
      returnByValue: true,
    });

    console.log("Fresh profile start() result in Edge:", promptTest?.result?.value);
    ws.close();
  } catch (err: any) {
    console.error("Error:", err);
  } finally {
    try { edgeProc.kill(); } catch {}
  }
}

testNativePrompt();
