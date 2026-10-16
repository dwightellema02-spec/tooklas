/**
 * Verify whether track.stop() causes SpeechRecognition abort in Edge
 */
import { spawn } from "child_process";
import WebSocket from "ws";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const DEBUG_PORT = 9230;

async function testAbortCause() {
  console.log("==================================================================");
  console.log("   EDGE ABORT ROOT CAUSE VERIFICATION");
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

    const result = await sendCommand("Runtime.evaluate", {
      expression: `(async () => {
        const SpeechClass = window.SpeechRecognition || window.webkitSpeechRecognition;

        // Experiment 1: With track.stop()
        const log1 = [];
        const stream1 = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream1.getTracks().forEach(t => t.stop());

        const rec1 = new SpeechClass();
        rec1.lang = "fil-PH";
        rec1.onstart = () => log1.push("onstart");
        rec1.onaudiostart = () => log1.push("onaudiostart");
        rec1.onerror = (e) => log1.push("onerror:" + e.error);
        rec1.onend = () => log1.push("onend");
        rec1.start();

        await new Promise(r => setTimeout(r, 3000));
        try { rec1.abort(); } catch {}

        // Experiment 2: WITHOUT getUserMedia track.stop() (start directly)
        const log2 = [];
        const rec2 = new SpeechClass();
        rec2.lang = "fil-PH";
        rec2.onstart = () => log2.push("onstart");
        rec2.onaudiostart = () => log2.push("onaudiostart");
        rec2.onerror = (e) => log2.push("onerror:" + e.error);
        rec2.onend = () => log2.push("onend");
        rec2.start();

        await new Promise(r => setTimeout(r, 3000));
        try { rec2.abort(); } catch {}

        return { withTrackStop: log1, directStart: log2 };
      })()`,
      awaitPromise: true,
      returnByValue: true,
    });

    console.log("Results in Edge:");
    console.log(JSON.stringify(result?.result?.value, null, 2));

    ws.close();
  } catch (err: any) {
    console.error("Test error:", err);
  } finally {
    try { edgeProc.kill(); } catch {}
  }
}

testAbortCause();
