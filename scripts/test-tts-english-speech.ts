import { spawn } from "child_process";
import WebSocket from "ws";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const DEBUG_PORT = 9254;

async function testEdgeTTSEnglishResponse() {
  console.log("==================================================================");
  console.log("   EDGE ENGLISH SPEECH SYNTHESIS REAL RUNTIME TEST");
  console.log("==================================================================");

  const edgeProc = spawn(EDGE_PATH, [
    `--remote-debugging-port=${DEBUG_PORT}`,
    "--headless=new",
    "http://localhost:3000",
  ], { stdio: "ignore" });

  await new Promise((r) => setTimeout(r, 2000));

  try {
    const listRes = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
    const targets = await listRes.json();
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

    const englishText = "Let's explore what an integer is in English! Based on our lesson notes, an integer is any whole number that can be positive, negative, or zero. Notice that integers do not include fractions or decimals.";

    const res = await sendCommand("Runtime.evaluate", {
      expression: `(async () => {
        // Import our SpeechSynthesisController directly from app or test class
        const voices = window.speechSynthesis.getVoices();
        
        // Emulate SpeechSynthesisController voice selection for English
        const englishVoice =
          voices.find((v) => v.lang.toLowerCase().startsWith("en-ph") && v.name.toLowerCase().includes("natural")) ||
          voices.find((v) => v.lang.toLowerCase().startsWith("en-ph")) ||
          voices.find((v) => v.name.toLowerCase().includes("natural") && (v.lang.startsWith("en-US") || v.lang.startsWith("en-GB"))) ||
          voices.find((v) => v.lang.startsWith("en-US") || v.lang.startsWith("en-GB")) ||
          voices[0];

        return {
          totalVoices: voices.length,
          selectedVoiceName: englishVoice ? englishVoice.name : null,
          selectedVoiceLang: englishVoice ? englishVoice.lang : null,
          isLocal: englishVoice ? englishVoice.localService : null,
        };
      })()`,
      returnByValue: true,
    });

    console.log("[DIAG] English voice selection in Edge:");
    console.log(JSON.stringify(res?.result?.value, null, 2));

    ws.close();
  } catch (err: any) {
    console.error("Test failed:", err);
  } finally {
    try { edgeProc.kill(); } catch {}
  }
}

testEdgeTTSEnglishResponse();
