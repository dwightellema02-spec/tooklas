import { SpeechSynthesisController } from "../src/lib/voice/speech-synthesis";
import { isFilipinoText, formatTextForSpeech } from "../src/lib/voice/voice-utils";

console.log("==================================================================");
console.log("   UNIT TEST: BILINGUAL VOICE SELECTION & DETECTION");
console.log("==================================================================");

// 1. Tagalog sample response
const tagalogMsg = "Magtulungan tayo para masagot ito! Ang integer ay isang buong numero na maaaring positibo, negatibo, o zero.";
console.log("\n[TAGALOG MESSAGE]");
console.log("Text:", tagalogMsg);
console.log("isFilipinoText:", isFilipinoText(tagalogMsg));
console.log("Formatted:", formatTextForSpeech(tagalogMsg));

// 2. English sample response
const englishMsg = "Let us think through this together. An integer is a whole number that can be positive, negative, or zero, without any fractional or decimal parts.";
console.log("\n[ENGLISH MESSAGE]");
console.log("Text:", englishMsg);
console.log("isFilipinoText:", isFilipinoText(englishMsg));
console.log("Formatted:", formatTextForSpeech(englishMsg));

// 3. Taglish / mixed sample response
const taglishMsg = "Sa ating number line, ang positive numbers ay nasa right side at ang negative numbers ay nasa left side.";
console.log("\n[TAGLISH MESSAGE]");
console.log("Text:", taglishMsg);
console.log("isFilipinoText:", isFilipinoText(taglishMsg));
console.log("Formatted:", formatTextForSpeech(taglishMsg));
