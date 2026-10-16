/**
 * Test Edge with default user profile / real permissions flow (NO fake stream flags)
 */
import { spawn } from "child_process";
import WebSocket from "ws";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const DEBUG_PORT = 9226;

async function testRealEdge() {
  console.log("==================================================================");
  console.log("   EDGE REAL PERMISSION & INTERACTION TEST (NO FAKE FLAGS)");
  console.log("==================================================================");

  // Launch Edge WITHOUT --use-fake-ui-for-media-stream and WITHOUT --use-fake-device-for-media-stream
  const edgeProc = spawn(EDGE_PATH, [
    `--remote-debugging-port=${DEBUG_PORT}`,
    "--headless=new",
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

    const consoleMessages: any[] = [];
    ws.onmessage = (event: any) => {
      const data = JSON.parse(event.data.toString());
      if (data.method === "Runtime.consoleAPICalled") {
        consoleMessages.push(data.params);
      }
      if (data.id && pendingPromises.has(data.id)) {
        const resolver = pendingPromises.get(data.id)!;
        pendingPromises.delete(data.id);
        resolver(data.result !== undefined ? data.result : data);
      }
    };

    await sendCommand("Runtime.enable");
    await sendCommand("Page.enable");
    await sendCommand("Console.enable");

    // Test 1: Query permissions API in Edge
    console.log("\n[TEST 1] Query navigator.permissions.query({ name: 'microphone' }) in Edge:");
    const permRes = await sendCommand("Runtime.evaluate", {
      expression: `(async () => {
        try {
          const status = await navigator.permissions.query({ name: 'microphone' });
          return { state: status.state };
        } catch (err) {
          return { error: err.name + ': ' + err.message };
        }
      })()`,
      awaitPromise: true,
      returnByValue: true,
    });
    console.log("  Permission Status:", JSON.stringify(permRes?.result?.value, null, 2));

    // Test 2: Call navigator.mediaDevices.getUserMedia({ audio: true }) in Edge without fake UI
    console.log("\n[TEST 2] Call navigator.mediaDevices.getUserMedia in Edge without fake UI:");
    const gumRes = await sendCommand("Runtime.evaluate", {
      expression: `(async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const trackCount = stream.getTracks().length;
          stream.getTracks().forEach(t => t.stop());
          return { success: true, trackCount };
        } catch (err) {
          return { error: err.name + ': ' + err.message };
        }
      })()`,
      awaitPromise: true,
      returnByValue: true,
    });
    console.log("  getUserMedia Result:", JSON.stringify(gumRes?.result?.value, null, 2));

    // Test 3: What happens if webkitSpeechRecognition.start() is called directly without getUserMedia in Edge?
    console.log("\n[TEST 3] Call webkitSpeechRecognition.start() directly without getUserMedia in Edge:");
    const directStartRes = await sendCommand("Runtime.evaluate", {
      expression: `(async () => {
        const SpeechClass = window.SpeechRecognition || window.webkitSpeechRecognition;
        const rec = new SpeechClass();
        rec.lang = 'en-US';
        const log = [];
        rec.onstart = () => log.push('onstart');
        rec.onaudiostart = () => log.push('onaudiostart');
        rec.onerror = (e) => log.push({ error: e.error, message: e.message });
        rec.onend = () => log.push('onend');

        try {
          rec.start();
          log.push('start_called');
        } catch (err) {
          log.push({ thrown: err.name + ': ' + err.message });
        }

        await new Promise(r => setTimeout(r, 2000));
        try { rec.abort(); } catch {}
        return log;
      })()`,
      awaitPromise: true,
      returnByValue: true,
    });
    console.log("  Direct start() Result:", JSON.stringify(directStartRes?.result?.value, null, 2));

    ws.close();
  } catch (err: any) {
    console.error("Test error:", err);
  } finally {
    try { edgeProc.kill(); } catch {}
  }
}

testRealEdge();
