import { spawn } from "child_process";
import WebSocket from "ws";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const DEBUG_PORT = 9251;

async function testVoicesComparison() {
  console.log("==================================================================");
  console.log("   EDGE VOICE QUALITY & RATE COMPARISON TEST");
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

    const res = await sendCommand("Runtime.evaluate", {
      expression: `(async () => {
        // Wait for voices
        let voices = window.speechSynthesis.getVoices();
        if (voices.length === 0) {
          await new Promise(r => {
            window.speechSynthesis.onvoiceschanged = () => r();
            setTimeout(r, 2000);
          });
          voices = window.speechSynthesis.getVoices();
        }

        const angelo = voices.find(v => v.name.toLowerCase().includes("angelo"));
        const blessica = voices.find(v => v.name.toLowerCase().includes("blessica"));
        const rosa = voices.find(v => v.name.toLowerCase().includes("rosa"));
        const englishUS = voices.find(v => v.lang === "en-US" && v.name.toLowerCase().includes("natural"));

        const tagalogSample = "Magtulungan tayo para masagot ito! Ang integer ay isang buong numero.";
        const englishSample = "Let us solve this step by step. What is an integer?";

        function testSpeak(text, voice, rate, lang) {
          return new Promise(resolve => {
            const utt = new SpeechSynthesisUtterance(text);
            if (voice) utt.voice = voice;
            utt.lang = lang;
            utt.rate = rate;
            let events = [];
            utt.onstart = () => events.push("onstart");
            utt.onend = () => { events.push("onend"); resolve({ voice: voice?.name, rate, lang, events, success: true }); };
            utt.onerror = (e) => { events.push("onerror: " + e.error); resolve({ voice: voice?.name, rate, lang, events, success: false }); };
            window.speechSynthesis.speak(utt);
          });
        }

        const results = [];
        // Test Angelo (Filipino Male)
        if (angelo) {
          const r = await testSpeak(tagalogSample, angelo, 1.0, "fil-PH");
          results.push(r);
        }
        // Test Blessica (Filipino Female)
        if (blessica) {
          const r = await testSpeak(tagalogSample, blessica, 1.0, "fil-PH");
          results.push(r);
        }
        // Test Rosa (Philippine English)
        if (rosa) {
          const r = await testSpeak(englishSample, rosa, 1.0, "en-PH");
          results.push(r);
        }
        // Test English US
        if (englishUS) {
          const r = await testSpeak(englishSample, englishUS, 1.0, "en-US");
          results.push(r);
        }

        return {
          totalVoices: voices.length,
          hasAngelo: Boolean(angelo),
          hasBlessica: Boolean(blessica),
          hasRosa: Boolean(rosa),
          results,
        };
      })()`,
      awaitPromise: true,
      returnByValue: true,
    });

    console.log("[DIAG] Comparison results in Microsoft Edge:");
    console.log(JSON.stringify(res?.result?.value, null, 2));

    ws.close();
  } catch (err: any) {
    console.error("Test failed:", err);
  } finally {
    try { edgeProc.kill(); } catch {}
  }
}

testVoicesComparison();
