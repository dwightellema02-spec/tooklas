/**
 * Checks how SpeechSynthesisController uses the natural Filipino voice and falls back to the device voice.
 * No server, no network and no Gemini: the browser (speechSynthesis, Audio) and the fetcher are fakes.
 *   npx tsx scripts/test-natural-voice-controller.ts
 */
import { SpeechSynthesisController, resetNaturalVoiceAvailability } from "../src/lib/voice/speech-synthesis.ts";

let pass = 0, fail = 0;
const t = (n: string, ok: boolean, d = "") => { ok ? pass++ : fail++; console.log((ok ? "  PASS  " : "  FAIL  ") + n + (ok ? "" : ` (${d})`)); };
const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));

// ---- fake browser
const spoken: string[] = [];
const g: any = globalThis;
class FakeUtterance { text: string; lang = ""; rate = 1; pitch = 1; volume = 1; voice: any = null; onstart: any; onend: any; onerror: any; onpause: any; onresume: any; constructor(text: string) { this.text = text; } }
g.SpeechSynthesisUtterance = FakeUtterance;
g.window = {
  speechSynthesis: {
    speaking: false, paused: false,
    getVoices: () => [{ name: "Microsoft Zira - English (United States)", lang: "en-US" }],
    speak(u: FakeUtterance) { spoken.push(u.text); setTimeout(() => u.onend?.(), 1); },
    cancel() {}, pause() {}, resume() {}, addEventListener() {}, removeEventListener() {},
  },
};
let audioPlays: string[] = [];
let autoEnd = true;
class FakeAudio {
  src: string; volume = 1; playbackRate = 1; paused = true; ended = false;
  onended: any; onerror: any; onpause: any; onplay: any;
  constructor(src: string) { this.src = src; }
  play() { this.paused = false; audioPlays.push(this.src); if (autoEnd) setTimeout(() => { this.ended = true; this.onended?.(); }, 3); return Promise.resolve(); }
  pause() { this.paused = true; this.onpause?.(); }
}
g.Audio = FakeAudio;

const wav = () => new Response(new Blob([new Uint8Array(2000)], { type: "audio/wav" }), { status: 200 });
const text = "Ang kabuuan ng mga interior angle ng pentagon ay 540 degrees. Hatiin natin ito sa tatlong triangle mula sa isang vertex. Ang bawat triangle ay may 180 degrees, kaya ang kabuuan ay tatlong beses na 180. Subukan mo naman ang hexagon at sabihin mo sa akin kung ilang triangle ang makikita mo. Pagkatapos, kunin mo ang kabuuan ng mga anggulo nito at ihambing sa pentagon.";

function make(fetcher: (...a: any[]) => Promise<Response>) {
  resetNaturalVoiceAvailability();
  const ev = { start: 0, end: 0, error: 0 };
  const c = new SpeechSynthesisController({ onStart: () => ev.start++, onEnd: () => ev.end++, onError: () => ev.error++ }, { fetcher: fetcher as any });
  return { c, ev };
}

// 1. natural voice plays every piece in order and reports start and end once
{
  const calls: string[] = [];
  const { c, ev } = make(async (_u, init) => { calls.push(JSON.parse(init.body).text); return wav(); });
  spoken.length = 0; audioPlays = [];
  c.speak(text, { lang: "fil-PH" });
  await tick(80);
  t("Filipino speech asks the server for natural audio", calls.length >= 1 && calls.every((x) => x.length <= 260), JSON.stringify(calls));
  t("it is split into several pieces that are all played", calls.length >= 2 && audioPlays.length === calls.length && calls.join(" ") === text, `${audioPlays.length} played of ${calls.length}`);
  t("the device voice is not used when natural speech works", spoken.length === 0);
  t("start and end are each reported once", ev.start === 1 && ev.end === 1, JSON.stringify(ev));
}

// 3. English also uses the natural voice, asked for as Philippine English
{
  const langs: string[] = [];
  const { c } = make(async (_u, init) => { langs.push(JSON.parse(init.body).lang); return wav(); });
  spoken.length = 0;
  c.speak("Let us study the angles of a polygon.", { lang: "en-US" });
  await tick(20);
  await tick(40);
  t("English text uses the natural voice (en-PH) and not the device voice", langs.length === 1 && langs[0] === "en-PH" && spoken.length === 0, JSON.stringify({ langs, spoken: spoken.length }));
}

// 4. engine "browser" forces the device voice
{
  let fetches = 0;
  const { c } = make(async () => { fetches++; return wav(); });
  spoken.length = 0;
  c.speak("Kumusta ka na? Tara, mag-aral tayo.", { lang: "fil-PH", engine: "browser" });
  await tick(20);
  t('engine "browser" skips the server', fetches === 0 && spoken.length === 1);
}

// 5. stop() while natural audio is playing silences it and does not fall back to the device voice
{
  autoEnd = false;
  const { c, ev } = make(async () => wav());
  spoken.length = 0; audioPlays = [];
  c.speak(text, { lang: "fil-PH" });
  await tick(30);
  const playing = audioPlays.length === 1 && c.isSpeaking();
  c.stop();
  await tick(30);
  t("natural audio is playing and reported as speaking", playing);
  t("stop() ends it, reports the end, and the device voice stays silent", !c.isSpeaking() && ev.end === 1 && spoken.length === 0 && audioPlays.length === 1, JSON.stringify({ ev, spoken: spoken.length, plays: audioPlays.length }));
  autoEnd = true;
}

// 6. a later piece fails: what was already heard is not repeated, the rest is read by the device voice
{
  let n = 0;
  const { c, ev } = make(async () => (++n === 2 ? new Response("{}", { status: 429 }) : wav()));
  spoken.length = 0; audioPlays = [];
  c.speak(text, { lang: "fil-PH" });
  await tick(120);
  t("piece 1 played naturally", audioPlays.length === 1, String(audioPlays.length));
  t("the rest is read by the device voice and starts where piece 1 ended", spoken.length === 1 && !spoken[0].startsWith("Ang kabuuan") && text.endsWith(spoken[0].slice(-20)), JSON.stringify(spoken));
  t("the end is reported once", ev.start === 1 && ev.end >= 1, JSON.stringify(ev));
}

// 7. the server refuses (not signed in or not configured): the device voice reads everything, and the server is skipped next time
{
  let fetches = 0;
  const { c, ev } = make(async () => { fetches++; return new Response("{}", { status: 503 }); });
  spoken.length = 0; audioPlays = [];
  c.speak("Magandang araw sa inyong lahat, pag-aralan natin ang mga anggulo.", { lang: "fil-PH" });
  await tick(60);
  t("when the server cannot speak, the device voice reads the whole text", spoken.length === 1 && audioPlays.length === 0 && spoken[0].startsWith("Magandang araw"), JSON.stringify(spoken));
  t("the end is still reported", ev.end >= 1, JSON.stringify(ev));
  const before = fetches;
  c.speak("Salamat po.", { lang: "fil-PH" });
  await tick(30);
  t("after a 503 the server is skipped for a while", fetches === before && spoken.length === 2, `${fetches} vs ${before}`);
}

console.log(`
${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
