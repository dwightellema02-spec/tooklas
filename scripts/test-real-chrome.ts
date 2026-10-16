import { spawn } from "child_process";

async function runBrowserTest() {
  console.log("=== LAUNCHING REAL CHROME TO TEST MICROPHONE FLOW ===");

  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const chromeProcess = spawn(chromePath, [
    "--remote-debugging-port=9222",
    "--headless=new",
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    "--no-first-run",
    "--no-default-browser-check",
    "http://localhost:3000",
  ]);

  // Give Chrome 2 seconds to bind port 9222
  await new Promise((r) => setTimeout(r, 2000));

  try {
    const listRes = await fetch("http://127.0.0.1:9222/json/list");
    const targets = await listRes.json();
    console.log("Chrome targets found:", targets.length);

    const pageTarget = targets.find((t: any) => t.type === "page");
    if (!pageTarget || !pageTarget.webSocketDebuggerUrl) {
      throw new Error("No page target with webSocketDebuggerUrl found");
    }

    console.log("Connecting CDP to:", pageTarget.webSocketDebuggerUrl);
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

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data.toString());
      if (data.id && pendingPromises.has(data.id)) {
        const resolver = pendingPromises.get(data.id)!;
        pendingPromises.delete(data.id);
        resolver(data.result !== undefined ? data.result : data);
      } else if (data.method === "Runtime.consoleAPICalled") {
        console.log("[Chrome Console]", data.params.type, data.params.args.map((a: any) => a.value || a.description).join(" "));
      } else if (data.method === "Runtime.exceptionThrown") {
        console.error("[Chrome Exception]", data.params.exceptionDetails?.text, data.params.exceptionDetails?.exception?.description);
      }
    };

    // Enable Runtime and Page domains
    await sendCommand("Runtime.enable");
    await sendCommand("Page.enable");
    await sendCommand("DOM.enable");

    // Login as student first
    const loginRes = await fetch("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "student@tuklas.ai", password: "Tuklas2026!" }),
    });
    const loginJson = await loginRes.json();
    const token = loginJson.token || loginJson.data?.token;
    console.log("Got student token:", token ? "YES (len: " + token.length + ")" : "NO", JSON.stringify(loginJson));

    // Navigate to student lesson page
    console.log("Navigating to http://localhost:3000/student/lessons/lsn_01...");
    await sendCommand("Page.navigate", { url: "http://localhost:3000/student/lessons/lsn_01" });
    await new Promise((r) => setTimeout(r, 1500));

    // Set token in localStorage on the target origin and reload
    await sendCommand("Runtime.evaluate", {
      expression: `localStorage.setItem("tuklas_session_token", ${JSON.stringify(token)})`,
    });
    await sendCommand("Page.navigate", { url: "http://localhost:3000/student/lessons/lsn_01" });
    await new Promise((r) => setTimeout(r, 4000));

    // Check current URL and DOM
    const urlRes = await sendCommand("Runtime.evaluate", {
      expression: "window.location.href",
      returnByValue: true,
    });
    console.log("Current URL after navigation:", urlRes);

    // Open AI Tutor Panel by clicking "AI Tutor" button
    const openPanelRes = await sendCommand("Runtime.evaluate", {
      expression: `(async () => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const tutorBtn = buttons.find(b => b.textContent && b.textContent.includes('AI Tutor'));
        if (tutorBtn) {
          tutorBtn.click();
          await new Promise(r => setTimeout(r, 1000));
        }

        const micBtn = Array.from(document.querySelectorAll('button')).find(
          b => b.getAttribute('aria-label')?.includes('Talk to Tuklas') || b.getAttribute('title')?.includes('microphone')
        );
        const inputElem = document.querySelector('input[aria-label*="Ask a question"]');

        return {
          panelOpened: !!micBtn,
          micBtnLabel: micBtn?.getAttribute('aria-label'),
          micBtnDisabled: Boolean(micBtn?.disabled),
          inputPlaceholder: inputElem?.placeholder,
        };
      })()`,
      awaitPromise: true,
      returnByValue: true,
    });
    console.log("Panel Open Result:", JSON.stringify(openPanelRes));

    // Click the microphone button and observe the voiceState and input transitions
    const clickMicRes = await sendCommand("Runtime.evaluate", {
      expression: `(async () => {
        const micBtn = Array.from(document.querySelectorAll('button')).find(
          b => b.getAttribute('aria-label')?.includes('Talk to Tuklas') || b.getAttribute('title')?.includes('microphone')
        );
        if (!micBtn) return { error: 'NO_MIC_BUTTON' };

        console.log("CLICKING MIC BUTTON in real browser...");
        micBtn.click();

        // Check immediate state after click
        await new Promise(r => setTimeout(r, 500));
        const allBtns = Array.from(document.querySelectorAll('button'));
        const activeMic = allBtns.find(b => b.getAttribute('aria-label')?.includes('voice') || b.getAttribute('aria-label')?.includes('listening') || b.getAttribute('title')?.includes('Listening') || b.getAttribute('aria-label')?.includes('Stop'));
        const inputElem = document.querySelector('input[aria-label*="Ask a question"]');
        const bannerText = document.querySelector('[role="region"][aria-label*="Voice Tutor"]')?.textContent;

        // Check state after 2 seconds
        await new Promise(r => setTimeout(r, 2000));
        const after2sBtns = Array.from(document.querySelectorAll('button'));
        const after2sMic = after2sBtns.find(b => b.getAttribute('aria-label')?.includes('voice') || b.getAttribute('aria-label')?.includes('listening') || b.getAttribute('title')?.includes('Listening') || b.getAttribute('aria-label')?.includes('Stop'));
        const after2sInput = document.querySelector('input[aria-label*="Ask a question"]');
        const after2sBanner = document.querySelector('[role="region"][aria-label*="Voice Tutor"]')?.textContent;

        return {
          immediate: {
            activeMicLabel: activeMic?.getAttribute('aria-label'),
            activeMicTitle: activeMic?.getAttribute('title'),
            inputPlaceholder: inputElem?.placeholder,
            banner: bannerText,
          },
          after2s: {
            activeMicLabel: after2sMic?.getAttribute('aria-label'),
            activeMicTitle: after2sMic?.getAttribute('title'),
            inputPlaceholder: after2sInput?.placeholder,
            inputValue: after2sInput?.value,
            banner: after2sBanner,
          }
        };
      })()`,
      awaitPromise: true,
      returnByValue: true,
    });
    console.log("Microphone Click Interaction Result:", JSON.stringify(clickMicRes));

    // Wait an additional 2 seconds to see if any errors or events fire
    await new Promise((r) => setTimeout(r, 2000));

    ws.close();
  } catch (err: any) {
    console.error("CDP error:", err.message);
  } finally {
    chromeProcess.kill();
  }
}

runBrowserTest().catch(console.error);
