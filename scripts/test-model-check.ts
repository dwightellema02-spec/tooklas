import dotenv from "dotenv";
dotenv.config();
import { GoogleGenAI } from "@google/genai";

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  console.log("Testing with API Key present:", !!apiKey);
  if (!apiKey) return;
  const ai = new GoogleGenAI({ apiKey });
  const models = ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.5-flash"];
  for (const m of models) {
    try {
      const r = await ai.models.generateContent({ model: m, contents: "Say hi in one word" });
      console.log(m, "SUCCESS:", r.text?.trim());
    } catch (e: any) {
      console.log(m, "FAILED:", e.message?.slice(0, 120));
    }
  }
}

main().catch(console.error);
