/**
 * Test visible Microsoft Edge interaction with CDP attached
 */
import { spawn } from "child_process";
import WebSocket from "ws";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const DEBUG_PORT = 9228;
const USER_DATA = "C:\\Users\\dwight\\AppData\\Local\\Microsoft\\Edge\\TuklasTestProfile";

async function runVisibleEdgeTest() {
  console.log("==================================================================");
  console.log("   VISIBLE MICROSOFT EDGE INTERACTION & EVENT TRACE TEST");
  console.log("==================================================================");

  // 1. Launch visible Edge
  console.log("[1] Launching visible Microsoft Edge...");
  const edgeProc = spawn(EDGE_PATH, [
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${USER_DATA}`,
    "--no-first-run",
    "--no-default-browser-check",
    "http://localhost:3000/student/lessons/lsn_01",
  ], { stdio: "ignore" });

  await new Promise((r) => setTimeout(r, 3000));

  try {
    const targetsRes = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
    const targets = await targetsRes.json();
    const pageTarget = targets.find((t: any) => t.type === "page" && t.url.includes("localhost:3000"));

    if (!pageTarget) {
      console.log("Targets found:", targets);
      throw new Error("Could not find localhost:3000 page target in Edge");
    }

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

    const consoleLogs: string[] = [];
    ws.onmessage = (event: any) => {
      const data = JSON.parse(event.data.toString());
      if (data.method === "Runtime.consoleAPICalled") {
        const text = data.params?.args?.map((a: any) => a.value !== undefined ? a.value : (a.description || JSON.stringify(a))).join(" ");
        consoleLogs.push(text);
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
    console.log("[2] Opening AI Tutor panel in Edge...");
    await sendCommand("Runtime.evaluate", {
      expression: `(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const tutorBtn = buttons.find(b => b.textContent && b.textContent.includes('AI Tutor'));
        if (tutorBtn) tutorBtn.click();
      })()`,
    });
    await new Promise((r) => setTimeout(r, 2000));

    // Inspect microphone button in Edge
    console.log("[3] Inspecting microphone button in Edge...");
    const micInfo = await sendCommand("Runtime.evaluate", {
      expression: `(() => {
        const micBtn = Array.from(document.querySelectorAll('button')).find(b =>
          b.getAttribute('aria-label')?.includes('Talk to Tuklas') || b.getAttribute('title')?.includes('microphone')
        );
        const controller = window.__TUKLAS_SPEECH_CONTROLLER__;
        return {
          micBtnFound: Boolean(micBtn),
          outerHTML: micBtn?.outerHTML,
          disabled: micBtn?.disabled,
          hasController: Boolean(controller),
          controllerSupported: controller ? controller.isSupported() : null,
          controllerListening: controller ? controller.isListening() : null,
        };
      })()`,
      returnByValue: true,
    });
    console.log("  Mic Button State:", JSON.stringify(micInfo?.result?.value, null, 2));

    // Click microphone button
    console.log("[4] Clicking microphone button in Edge...");
    const clickResult = await sendCommand("Runtime.evaluate", {
      expression: `(async () => {
        const micBtn = Array.from(document.querySelectorAll('button')).find(b =>
          b.getAttribute('aria-label')?.includes('Talk to Tuklas') || b.getAttribute('title')?.includes('microphone')
        );
        if (!micBtn) return { error: "NO_MIC_BUTTON" };

        micBtn.click();
        await new Promise(r => setTimeout(r, 3000));

        const micBtnAfter = Array.from(document.querySelectorAll('button')).find(b =>
          b.getAttribute('aria-label')?.includes('voice') ||
          b.getAttribute('aria-label')?.includes('listening') ||
          b.getAttribute('title')?.includes('Listening') ||
          b.getAttribute('aria-label')?.includes('Talk to Tuklas')
        );

        const controller = window.__TUKLAS_SPEECH_CONTROLLER__;

        return {
          afterAriaLabel: micBtnAfter?.getAttribute('aria-label'),
          afterTitle: micBtnAfter?.getAttribute('title'),
          afterDisabled: micBtnAfter?.disabled,
          controllerListening: controller ? controller.isListening() : null,
          controllerStarting: controller ? controller.starting : null,
          controllerRequestingPermission: controller ? controller.isRequestingPermission() : null,
        };
      })()`,
      awaitPromise: true,
      returnByValue: true,
    });
    console.log("  After Click State:", JSON.stringify(clickResult?.result?.value, null, 2));

    await new Promise((r) => setTimeout(r, 2000));
    ws.close();
  } catch (err: any) {
    console.error("Visible Edge test error:", err);
  } finally {
    try { edgeProc.kill(); } catch {}
  }
}

runVisibleEdgeTest();
