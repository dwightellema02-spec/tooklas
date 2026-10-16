import { spawn } from "child_process";
import WebSocket from "ws";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const DEBUG_PORT = 9248;

async function diagnoseChromeVoices() {
  console.log("==================================================================");
  console.log("   GOOGLE CHROME VOICE INVENTORY & SYNTHESIS CHECK");
  console.log("==================================================================");

  const proc = spawn(CHROME_PATH, [
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

    const res = await sendCommand("Runtime.evaluate", {
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
          voices: asyncVoices.map((v) => ({ name: v.name, lang: v.lang, default: v.default, localService: v.localService })),
        };
      })()`,
      awaitPromise: true,
      returnByValue: true,
    });

    const val = res?.result?.value;
    console.log("[CHROME] Immediate voices:", val?.immediateCount);
    console.log("[CHROME] Async voices count:", val?.asyncCount);
    console.log("[CHROME] Voices list:");
    val?.voices?.forEach((v: any) => {
      console.log(`  - ${v.name} (${v.lang})`);
    });

    ws.close();
  } catch (err: any) {
    console.error("Chrome error:", err);
  } finally {
    try { proc.kill(); } catch {}
  }
}

diagnoseChromeVoices();
