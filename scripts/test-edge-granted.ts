/**
 * Test Microsoft Edge when permission is already GRANTED
 */
import { spawn } from "child_process";
import WebSocket from "ws";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const DEBUG_PORT = 9229;

async function testEdgeWithGrantedPermission() {
  console.log("==================================================================");
  console.log("   EDGE TEST WITH PRE-GRANTED MICROPHONE PERMISSION");
  console.log("==================================================================");

  // Launch Edge with pre-granted permission via command line
  const edgeProc = spawn(EDGE_PATH, [
    `--remote-debugging-port=${DEBUG_PORT}`,
    "--headless=new",
    "--use-fake-ui-for-media-stream",
    "http://localhost:3000/student/lessons/lsn_01",
  ], { stdio: "ignore" });

  await new Promise((r) => setTimeout(r, 2000));

  try {
    const targetsRes = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
    const targets = await targetsRes.json();
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
      if (data.method === "Runtime.consoleAPICalled") {
        const text = data.params?.args?.map((a: any) => a.value !== undefined ? a.value : (a.description || JSON.stringify(a))).join(" ");
        console.log("  [EDGE CONSOLE]:", text);
      }
      if (data.id && pendingPromises.has(data.id)) {
        const resolver = pendingPromises.get(data.id)!;
        pendingPromises.delete(data.id);
        resolver(data.result !== undefined ? data.result : data);
      }
    };

    await sendCommand("Runtime.enable");
    await sendCommand("Page.enable");

    // Authenticate student
    const loginRes = await fetch("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "student@tuklas.ai", password: "Tuklas2026!" }),
    });
    const loginJson = await loginRes.json();
    const token = loginJson.token || loginJson.data?.token;

    await sendCommand("Runtime.evaluate", {
      expression: `localStorage.setItem("tuklas_session_token", ${JSON.stringify(token)})`,
    });
    await sendCommand("Page.navigate", { url: "http://localhost:3000/student/lessons/lsn_01" });
    await new Promise((r) => setTimeout(r, 3500));

    // Open AI Tutor Panel
    await sendCommand("Runtime.evaluate", {
      expression: `(() => {
        const tutorBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('AI Tutor'));
        if (tutorBtn) tutorBtn.click();
      })()`,
    });
    await new Promise((r) => setTimeout(r, 2000));

    // Click microphone button and monitor for 5 seconds
    console.log("[DIAG] Clicking microphone button...");
    const clickRes = await sendCommand("Runtime.evaluate", {
      expression: `(async () => {
        const micBtn = Array.from(document.querySelectorAll('button')).find(b =>
          b.getAttribute('aria-label')?.includes('Talk to Tuklas') || b.getAttribute('title')?.includes('microphone')
        );
        if (!micBtn) return { error: "NO_MIC_BUTTON" };

        micBtn.click();

        const history = [];
        for (let i = 0; i < 50; i++) {
          const allBtns = Array.from(document.querySelectorAll('button'));
          const mic = allBtns.find(b =>
            b.getAttribute('aria-label')?.includes('voice') ||
            b.getAttribute('aria-label')?.includes('listening') ||
            b.getAttribute('aria-label')?.includes('permission') ||
            b.getAttribute('aria-label')?.includes('Talk to Tuklas')
          );
          const controller = window.__TUKLAS_SPEECH_CONTROLLER__;
          history.push({
            t: i * 100,
            ariaLabel: mic?.getAttribute('aria-label'),
            title: mic?.getAttribute('title'),
            disabled: mic?.disabled,
            isListening: controller ? controller.isListening() : null,
          });
          await new Promise(r => setTimeout(r, 100));
        }

        return history;
      })()`,
      awaitPromise: true,
      returnByValue: true,
    });

    const history = clickRes?.result?.value;
    // Print distinct state transitions
    console.log("[DIAG] Button state transitions:");
    let lastState = "";
    for (const h of history) {
      const stateStr = `t=${h.t}ms | label="${h.ariaLabel}" | disabled=${h.disabled} | controllerListening=${h.isListening}`;
      if (stateStr !== lastState) {
        console.log("   -->", stateStr);
        lastState = stateStr;
      }
    }

    ws.close();
  } catch (err: any) {
    console.error("Test error:", err);
  } finally {
    try { edgeProc.kill(); } catch {}
  }
}

testEdgeWithGrantedPermission();
