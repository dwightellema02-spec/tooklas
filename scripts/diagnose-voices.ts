import { spawn } from "child_process";
import WebSocket from "ws";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const DEBUG_PORT = 9245;

async function diagnoseVoices() {
  console.log("==================================================================");
  console.log("   TUKLAS AI — VOICE INVENTORY & SYNTHESIS TIMING DIAGNOSIS");
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

    // 1. Check getVoices() immediately vs onvoiceschanged
    const result = await sendCommand("Runtime.evaluate", {
      expression: `(async () => {
        const immediateVoices = window.speechSynthesis.getVoices();
        
        const asyncVoices = await new Promise((resolve) => {
          let list = window.speechSynthesis.getVoices();
          if (list.length > 0) return resolve(list);
          window.speechSynthesis.onvoiceschanged = () => {
            resolve(window.speechSynthesis.getVoices());
          };
          setTimeout(() => resolve(window.speechSynthesis.getVoices()), 2000);
        });

        return {
          immediateCount: immediateVoices.length,
          asyncCount: asyncVoices.length,
          voices: asyncVoices.map((v) => ({
            name: v.name,
            lang: v.lang,
            default: v.default,
            localService: v.localService,
            voiceURI: v.voiceURI,
          })),
        };
      })()`,
      awaitPromise: true,
      returnByValue: true,
    });

    const val = result?.result?.value;
    console.log("[DIAG] Immediate getVoices() count:", val?.immediateCount);
    console.log("[DIAG] Async onvoiceschanged count:", val?.asyncCount);
    console.log("\n[DIAG] Relevant Filipino & English Voices in Edge:");
    if (val?.voices) {
      for (const v of val.voices) {
        if (
          v.lang.toLowerCase().includes("fil") ||
          v.lang.toLowerCase().includes("tl") ||
          v.lang.toLowerCase().includes("ph") ||
          v.name.toLowerCase().includes("angelo") ||
          v.name.toLowerCase().includes("blessica") ||
          v.name.toLowerCase().includes("natural") && v.lang.startsWith("en")
        ) {
          console.log(`  - ${v.name} (${v.lang}) [default=${v.default}, local=${v.localService}]`);
        }
      }
    }

    // 2. Test how SpeechSynthesisController selects voice currently
    const testSelection = await sendCommand("Runtime.evaluate", {
      expression: `(() => {
        const voices = window.speechSynthesis.getVoices();
        
        // Emulate current selection logic in speech-synthesis.ts
        function selectFor(isFilipino, targetLang) {
          if (isFilipino) {
            const filipinoVoice =
              voices.find(
                (v) =>
                  v.name.toLowerCase().includes("angelo") ||
                  v.name.toLowerCase().includes("blessica") ||
                  v.name.toLowerCase().includes("filipino") ||
                  v.name.toLowerCase().includes("tagalog")
              ) ||
              voices.find(
                (v) =>
                  v.lang.toLowerCase().startsWith("fil") ||
                  v.lang.toLowerCase().startsWith("tl")
              ) ||
              voices.find((v) => v.lang.toLowerCase().startsWith("en-ph"));
            return filipinoVoice ? { name: filipinoVoice.name, lang: filipinoVoice.lang } : null;
          } else {
            const preferred =
              voices.find((v) => v.lang.startsWith("en-PH")) ||
              voices.find((v) => v.lang.startsWith("en-US") || v.lang.startsWith("en-GB")) ||
              voices[0];
            return preferred ? { name: preferred.name, lang: preferred.lang } : null;
          }
        }

        return {
          tagalogSelected: selectFor(true, "fil-PH"),
          englishSelected: selectFor(false, "en-US"),
        };
      })()`,
      returnByValue: true,
    });

    console.log("\n[DIAG] Current Voice Selection Result:");
    console.log("  Tagalog Voice Selected:", testSelection?.result?.value?.tagalogSelected);
    console.log("  English Voice Selected:", testSelection?.result?.value?.englishSelected);

    ws.close();
  } catch (err: any) {
    console.error("Diagnosis error:", err);
  } finally {
    try { edgeProc.kill(); } catch {}
  }
}

diagnoseVoices();
