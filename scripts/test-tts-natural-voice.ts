/**
 * Checks the natural Filipino voice: text splitting (no server needed) and, when APP_URL is set, the
 * /api/ai/tts endpoint (sign-in required, validation, WAV output, cache). It calls Gemini once or twice,
 * so it uses a little of the speech quota.
 *   APP_URL=http://localhost:3000 npx tsx scripts/test-tts-natural-voice.ts
 */
import { splitForSpeech } from "../src/lib/voice/voice-utils.ts";
import { isPlausibleSpeech } from "../src/lib/voice/gemini-tts.ts";

let pass = 0, fail = 0;
const t = (n: string, ok: boolean, d = "") => { ok ? pass++ : fail++; console.log((ok ? "  PASS  " : "  FAIL  ") + n + (ok ? "" : ` (${d})`)); };

const long = "Ang kabuuan ng mga interior angle ng isang pentagon ay 540 degrees. Hatiin natin ang pentagon sa tatlong triangle mula sa isang vertex. Ang bawat triangle ay may 180 degrees, kaya 3 × 180 = 540. Tama ba? Subukan mo ang hexagon naman, at sabihin mo sa akin kung ilan ang triangle.";
const pieces = splitForSpeech(long, 120);
t("a long reply is split into several pieces", pieces.length >= 3, String(pieces.length));
t("every piece is within the limit", pieces.every((p) => p.length <= 120), JSON.stringify(pieces.map((p) => p.length)));
t("no words are lost or reordered", pieces.join(" ").replace(/\s+/g, " ") === long.replace(/\s+/g, " "));
t("short text stays in one piece", splitForSpeech("Magandang araw!").length === 1);
const run = splitForSpeech("a".repeat(700), 260);
t("a very long unbroken text is still cut to the limit", run.length >= 3 && run.every((p) => p.length <= 260), JSON.stringify(run.map((p) => p.length)));

// A 49-character sentence should take about 4 seconds; 23 seconds of audio means the model rambled.
const fakeWav = (seconds: number) => { const b = Buffer.alloc(44 + seconds * 48000); b.writeUInt32LE(24000, 24); return b; };
t("normal-length speech is accepted", isPlausibleSpeech("a".repeat(49), fakeWav(5)));
t("23 seconds of audio for a short sentence is rejected", !isPlausibleSpeech("a".repeat(49), fakeWav(23)));
t("an empty clip is rejected", !isPlausibleSpeech("hello", Buffer.alloc(44)));

const B = process.env.APP_URL?.replace(/[/]$/, "");
if (B) {
  const post = (body: any, cookie?: string) => fetch(B + "/api/ai/tts", { method: "POST", headers: { "content-type": "application/json", ...(cookie ? { authorization: "Bearer " + cookie } : {}) }, body: JSON.stringify(body) });
  t("speech needs a signed-in user", (await post({ text: "Kumusta" })).status === 401);
  const reg = await (await fetch(B + "/api/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Tts Test", email: `tts-${Date.now()}@example.invalid`, password: "Tts-Pass-9xQ!pilot" }) })).json() as any;
  const tok = reg.token as string;
  t("empty text is refused", (await post({ text: "   " }, tok)).status === 400);
  t("over-long text is refused", (await post({ text: "a".repeat(601) }, tok)).status === 413);
  const phrase = "Magandang araw! Pag-aralan natin ang mga anggulo.";
  const t0 = Date.now();
  const r1 = await post({ text: phrase, lang: "fil-PH" }, tok);
  if (r1.status === 429 || r1.status === 502 || r1.status === 503) {
    console.log(`  SKIP  Gemini answered ${r1.status} (quota or not configured); audio checks not run`);
  } else {
    const buf = Buffer.from(await r1.arrayBuffer());
    t("a Filipino sentence comes back as a WAV", r1.status === 200 && r1.headers.get("content-type") === "audio/wav" && buf.subarray(0, 4).toString() === "RIFF" && buf.length > 20000, `${r1.status} ${buf.length}`);
    const ms1 = Date.now() - t0;
    const t1 = Date.now();
    const r2 = await post({ text: phrase, lang: "fil-PH" }, tok);
    const buf2 = Buffer.from(await r2.arrayBuffer());
    t("the same sentence again is served from the cache, identical and fast", r2.status === 200 && buf2.equals(buf) && Date.now() - t1 < Math.max(500, ms1 / 4), `${Date.now() - t1}ms vs ${ms1}ms`);
  }
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
