/**
 * Server-side natural speech with Gemini TTS, used for Filipino (Tagalog) because most devices have no
 * Filipino voice installed and read Tagalog with an English or Indonesian one.
 *
 * Server only: it uses the Gemini API key. Browsers call POST /api/ai/tts and get a WAV back.
 */
import { GoogleGenAI } from "@google/genai";
import { createHash } from "crypto";

export type TtsLang = "fil-PH" | "en-PH";

export class TtsError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const STYLE: Record<TtsLang, string> = {
  "fil-PH":
    "Read the text below aloud, exactly as written and nothing else. Speak as a warm, patient Filipino mathematics teacher: clear, natural Tagalog with an authentic Philippine accent, at a calm classroom pace. Say English math terms the way Filipinos naturally say them in class.",
  "en-PH":
    "Read the text below aloud, exactly as written and nothing else. Speak as a warm, patient Filipino mathematics teacher in clear English with a natural Philippine accent, at a calm classroom pace.",
};

export const TTS_MAX_CHARS = 600;
const CACHE_MAX_BYTES = 80 * 1024 * 1024;

const cache = new Map<string, Buffer>();
let cacheBytes = 0;
const inFlight = new Map<string, Promise<Buffer>>();
let client: GoogleGenAI | null = null;

export function isTtsEnabled(): boolean {
  if (process.env.AI_TTS === "off") return false;
  if ((process.env.AI_PROVIDER || "").toLowerCase() === "local") return false;
  return Boolean(process.env.GEMINI_API_KEY || process.env.AI_API_KEY);
}

function models(): string[] {
  const list = [process.env.AI_TTS_MODEL, "gemini-3.8-flash-tts", "gemini-3.8-flash-lite-tts", "gemini-2.5-flash-preview-tts"];
  return list.filter((m, i): m is string => Boolean(m) && list.indexOf(m) === i);
}

/** Gemini returns either a finished WAV or raw 16-bit PCM (audio/L16;rate=24000). Browsers need a WAV. */
function toWav(data: Buffer, mimeType: string): Buffer {
  if (/wav/i.test(mimeType) || data.subarray(0, 4).toString("ascii") === "RIFF") return data;
  const rate = Number(/rate=(\d+)/.exec(mimeType)?.[1] ?? 24000);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

/** Seconds of audio in a 16-bit mono WAV. */
function wavSeconds(wav: Buffer): number {
  const rate = wav.length > 28 ? wav.readUInt32LE(24) : 24000;
  return (wav.length - 44) / 2 / (rate || 24000);
}

/** Speech runs about 12 to 15 characters per second. Much longer audio means the model rambled or hung on silence. */
export function isPlausibleSpeech(text: string, wav: Buffer): boolean {
  return wav.length > 1000 && wavSeconds(wav) <= text.length * 0.2 + 4;
}

function remember(key: string, wav: Buffer) {
  cache.set(key, wav);
  cacheBytes += wav.length;
  for (const [k, v] of cache) {
    if (cacheBytes <= CACHE_MAX_BYTES) break;
    cache.delete(k);
    cacheBytes -= v.length;
  }
}

async function generate(text: string, lang: TtsLang): Promise<Buffer> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.AI_API_KEY;
  if (!apiKey) throw new TtsError("Speech is not configured.", 503);
  client ??= new GoogleGenAI({ apiKey });
  const voice = process.env.AI_TTS_VOICE || "Kore";
  let lastStatus = 502;
  let lastMessage = "Speech generation failed.";
  const tries = models().flatMap((m) => [{ m, attempt: 0 }, { m, attempt: 1 }]);
  let skip = "";
  for (const { m: model } of tries) {
    if (skip === model) continue;
    try {
      const res = await client.models.generateContent({
        model,
        contents: [{ parts: [{ text: `${STYLE[lang]}\n\n${text}` }] }],
        config: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } },
      });
      const part = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
      if (!part?.inlineData?.data) {
        lastMessage = `Model ${model} returned no audio.`;
        continue;
      }
      const wav = toWav(Buffer.from(part.inlineData.data, "base64"), part.inlineData.mimeType || "");
      if (!isPlausibleSpeech(text, wav)) {
        console.warn(`[tts] ${model} returned ${wavSeconds(wav).toFixed(1)}s of audio for ${text.length} characters; discarded`);
        lastMessage = "Speech generation failed.";
        lastStatus = 502;
        continue; // once more on the same model, then on the next one
      }
      return wav;
    } catch (err: any) {
      const raw = String(err?.message || err);
      lastStatus = /429|quota|RESOURCE_EXHAUSTED/i.test(raw) ? 429 : 502;
      lastMessage = lastStatus === 429 ? "Speech is busy right now. Please try again in a moment." : "Speech generation failed.";
      skip = model; // a quota or API error will not fix itself on an immediate retry; go to the next model
      console.warn(`[tts] ${model} failed (${lastStatus}):`, raw.slice(0, 160));
    }
  }
  throw new TtsError(lastMessage, lastStatus);
}

/** Returns a WAV for the text. Identical requests are served from memory and never call Gemini twice. */
export async function synthesizeSpeech(text: string, lang: TtsLang): Promise<Buffer> {
  const clean = text.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  if (!clean) throw new TtsError("Nothing to read.", 400);
  if (clean.length > TTS_MAX_CHARS) throw new TtsError(`Text is too long (max ${TTS_MAX_CHARS} characters).`, 413);
  const key = createHash("sha256").update([models()[0], process.env.AI_TTS_VOICE || "Kore", lang, clean].join("\u0001")).digest("hex");
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit); // most recently used
    return hit;
  }
  let pending = inFlight.get(key);
  if (!pending) {
    pending = generate(clean, lang)
      .then((wav) => {
        remember(key, wav);
        return wav;
      })
      .finally(() => inFlight.delete(key));
    inFlight.set(key, pending);
  }
  return pending;
}
