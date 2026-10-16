import { isFilipinoText, formatTextForSpeech } from "../src/lib/voice/voice-utils";

const texts = [
  "Pag-isipan: Sa number line, bakit kaya ang mga negatibong numero ay nasa kaliwa ng zero, at ang mga positibong numero ay nasa kanan?",
  "Subukan nating sagutin ito nang dahan-dahan. Ano ang ibig sabihin ng integer?",
  "Pag-isipan:Sa mga numerong 5, −4.5, at 1/2, alin ang integer?",
  "Great job! Let us think about what an integer is.",
  "Ano ang zero-pair? Kapag pinagsama ang (+1) at (-1), ano ang magiging resulta?",
  "Tuklas AI: Pag-isipan natin ang rule ng 10 - 4.",
  "Ang aralin ay LSN-01 para sa Grade 7."
];

for (const t of texts) {
  console.log("-----------------------------------------");
  console.log("TEXT:", t);
  console.log("isFilipinoText:", isFilipinoText(t));
  console.log("formatTextForSpeech:", formatTextForSpeech(t));
}
