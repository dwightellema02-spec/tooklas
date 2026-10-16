import { isFilipinoText } from "../src/lib/voice/voice-utils";

async function testEnglishResponseDirectly() {
  const loginRes = await fetch("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "student@tuklas.ai", password: "Tuklas2026!" })
  });
  const { token } = await loginRes.json();
  const tutorRes = await fetch("http://localhost:3000/api/ai/tutor", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({
      lessonId: "lsn_01",
      helpLevel: "LEVEL_1_HINT",
      studentQuery: "explain in english what is an integer?"
    })
  });
  const data = await tutorRes.json();
  const text = data.data?.message?.content;
  console.log("TUTOR ENGLISH RESPONSE:", text);
  console.log("isFilipinoText(response):", isFilipinoText(text));
}

testEnglishResponseDirectly();
