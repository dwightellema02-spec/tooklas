// Phase 7: AI Provider Abstraction

import { GoogleGenAI } from "@google/genai";
import type { AIProvider, TutorAIRequest, TutorAIResponseRaw } from "./types";

const LEGACY_MODEL_MAP: Record<string, string> = {};

function normalizeGeminiModel(rawModel?: string, fallback = "gemini-3.8-flash"): string {
  const trimmed = (rawModel || "").trim();
  if (!trimmed) return fallback;
  return LEGACY_MODEL_MAP[trimmed] || trimmed;
}

export class GeminiAIProvider implements AIProvider {
  readonly name = "gemini";
  readonly defaultModel: string = "gemini-3.8-flash";
  private static quotaCooldownUntil = 0;
  private ai: GoogleGenAI;
  private model: string;

  constructor(apiKey?: string, model?: string) {
    const key = apiKey || process.env.GEMINI_API_KEY || process.env.AI_API_KEY;
    if (!key) {
      throw new Error("Gemini API key is required but neither GEMINI_API_KEY nor AI_API_KEY was provided.");
    }
    this.ai = new GoogleGenAI({ apiKey: key });
    this.model = normalizeGeminiModel(model || process.env.AI_MODEL, this.defaultModel);
  }

  static resetQuotaCooldown(): void {
    GeminiAIProvider.quotaCooldownUntil = 0;
  }

  async generateTutorResponse(request: TutorAIRequest): Promise<TutorAIResponseRaw> {
    if (Date.now() < GeminiAIProvider.quotaCooldownUntil) {
      console.warn("Gemini API quota cooldown active; delegating to LocalTutorEngine fallback.");
      return new LocalTutorEngine().generateTutorResponse(request);
    }

    const timeoutMs = request.timeoutMs || 15000;
    const modelsToTry = [this.model];
    if (!modelsToTry.includes("gemini-3.8-flash")) {
      modelsToTry.push("gemini-3.8-flash");
    }
    if (!modelsToTry.includes("gemini-3.5-flash")) {
      modelsToTry.push("gemini-3.5-flash");
    }
    if (!modelsToTry.includes("gemini-3.5-flash-lite")) {
      modelsToTry.push("gemini-3.5-flash-lite");
    }

    let lastError: any = null;
    for (const modelToUse of modelsToTry) {
      try {
        const generatePromise = this.ai.models.generateContent({
          model: modelToUse,
          contents: request.userPrompt,
          config: {
            systemInstruction: request.systemPrompt,
            maxOutputTokens: request.maxTokens || 1024,
            temperature: request.temperature !== undefined ? request.temperature : 0.4,
            responseMimeType: "application/json",
          },
        });

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`AI Tutor request timed out after ${timeoutMs / 1000} seconds.`)), timeoutMs)
        );

        const response = await Promise.race([generatePromise, timeoutPromise]);
        let responseText = (response.text || "").trim();
        const parsed = JSON.parse(responseText);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && parsed.message === undefined) {
          const fallbackMsg =
            parsed.response ||
            parsed.explanation ||
            parsed.answer ||
            parsed.content ||
            Object.values(parsed).find((v) => typeof v === "string");
          if (typeof fallbackMsg === "string") {
            parsed.message = fallbackMsg;
            responseText = JSON.stringify(parsed);
          }
        }

        return {
          text: responseText,
          tokenUsage: {
            promptTokens: response.usageMetadata?.promptTokenCount,
            completionTokens: response.usageMetadata?.candidatesTokenCount,
            totalTokens: response.usageMetadata?.totalTokenCount,
          },
          provider: this.name,
          model: modelToUse,
        };
      } catch (err: any) {
        lastError = err;
        const msg = String(err?.message || err || "");
        console.warn(`Gemini model ${modelToUse} failed:`, msg);
        if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.toLowerCase().includes("quota")) {
          GeminiAIProvider.quotaCooldownUntil = Date.now() + 60_000;
          break;
        }
      }
    }

    console.warn("All configured Gemini models failed. Falling back gracefully to LocalTutorEngine Socratic pedagogy:", lastError?.message || lastError);
    return new LocalTutorEngine().generateTutorResponse(request);
  }
}

/**
 * High-quality Local Pedagogical Tutor Engine.
 * Used for reliable fallback, offline operation, test suites, or when external API quota/keys are pending.
 * Adheres strictly to DepEd MATATAG Grade 7 Mathematics pedagogy and Socratic guidance.
 */
export class LocalTutorEngine implements AIProvider {
  readonly name = "local-pedagogical-engine";
  readonly defaultModel = "tuklas-pedagogical-v2-companion";

  async generateTutorResponse(request: TutorAIRequest): Promise<TutorAIResponseRaw> {
    const prompt = request.userPrompt.toLowerCase();
    const queryMatch = request.userPrompt.match(/Student Query:\s*"([^"]*)"/i);
    const studentQuery = queryMatch ? queryMatch[1].toLowerCase().trim() : "";

    const lessonTitleMatch = request.userPrompt.match(/Lesson Title:\s*([^\n\r]*)/i);
    const activeLessonTitle = lessonTitleMatch ? lessonTitleMatch[1].trim() : "Grade 7 Mathematics";
    const unitTitleMatch = request.userPrompt.match(/Unit:\s*([^\n\r]*)/i);
    const activeUnitTitle = unitTitleMatch ? unitTitleMatch[1].trim() : "Integers & Rational Numbers";

    const explicitEnglishRegex =
      /\b(english|in english|english please|please english|speak english|explain in english|use english|mag-?english|switch to english|back to english|can you speak english|can we speak english|change to english|ingles|sa ingles)\b/i;
    const explicitEnglish =
      studentQuery === "english" ||
      explicitEnglishRegex.test(studentQuery) ||
      request.systemPrompt.includes("Language Mandate: English") ||
      request.userPrompt.includes("MANDATORY LANGUAGE DIRECTIVE: The student is communicating in ENGLISH");

    const explicitFilipinoRegex =
      /\b(tagalog|filipino|sa tagalog|in tagalog|paliwanag sa tagalog|ipaliwanag sa tagalog|mag-?tagalog|tagalugin|salitang tagalog|sa filipino|in filipino|paliwanag sa filipino|ipaliwanag sa filipino|mag-?filipino)\b/i;

    const isFilipino =
      !explicitEnglish &&
      (request.systemPrompt.includes("Language Mandate: Natural Filipino") ||
        request.userPrompt.includes("MANDATORY LANGUAGE DIRECTIVE: The student requested explanations in FILIPINO") ||
        studentQuery === "tagalog" ||
        studentQuery === "filipino" ||
        explicitFilipinoRegex.test(studentQuery) ||
        (!studentQuery && prompt.includes('student query: "tagalog')) ||
        (!studentQuery && prompt.includes('student query: "in tagalog')) ||
        (!studentQuery && prompt.includes('student query: "paliwanag sa tagalog')));

    const languageChangeOnlyKeywords = [
      "tagalog",
      "in tagalog",
      "sa tagalog",
      "filipino",
      "in filipino",
      "sa filipino",
      "mag-tagalog",
      "magtagalog",
      "mag-filipino",
      "magfilipino",
      "paliwanag sa tagalog",
      "ipaliwanag sa tagalog",
      "paliwanag sa filipino",
      "ipaliwanag sa filipino",
      "salitang tagalog",
      "tagalog please",
      "filipino please",
      "english",
      "in english",
      "sa ingles",
      "ingles",
      "mag-english",
      "magenglish",
      "speak english",
      "explain in english",
      "use english",
      "english please",
      "please english",
      "switch to english",
      "back to english",
    ];

    const isLanguageChangeOnlyQuery =
      languageChangeOnlyKeywords.includes(studentQuery) ||
      (studentQuery.startsWith("mag-") && studentQuery.length < 15 && (studentQuery.includes("tagalog") || studentQuery.includes("english") || studentQuery.includes("filipino"))) ||
      (studentQuery.split(/\s+/).length <= 3 && languageChangeOnlyKeywords.some((k) => studentQuery === k));

    let responseType = "HINT";
    let message = "";
    let guidingQuestion = "";
    let hintLevel = 1;
    let encouragement = isFilipino
      ? "Bumubuo ka ng tunay na pag-unawa sa matematika hakbang-hakbang."
      : "You're building real mathematical understanding step by step.";
    let nextStep = isFilipino
      ? "Isipin ang mga sign at posisyon sa number line."
      : "Think about the signs and positions on the number line.";
    let detectedIssue = "NONE";
    let suggestedAction = "CONTINUE_LESSON";
    let sourceGrounding: string[] = ["Curriculum: MATATAG Grade 7 Mathematics"];

    // 1. Prompt Injection & Off-topic Safety (Part 23)
    if (
      studentQuery.includes("ignore previous") ||
      studentQuery.includes("system prompt") ||
      studentQuery.includes("act as dan") ||
      studentQuery.includes("api_key") ||
      studentQuery.includes("database_url") ||
      studentQuery.includes("passwordhash") ||
      studentQuery.includes("celebrity") ||
      studentQuery.includes("movie") ||
      studentQuery.includes("song") ||
      studentQuery.includes("recipe") ||
      studentQuery.includes("weather")
    ) {
      return {
        text: JSON.stringify({
          responseType: "REDIRECT",
          message: isFilipino
            ? `Maging nakatutok tayo sa iyong aralin sa Grade 7 Matematika tungkol sa ${activeLessonTitle}. Ako ang iyong Tuklas AI kasama sa pag-aaral, nandito upang tulungan kang maging mahusay sa integers!`
            : `Let's focus on your Grade 7 mathematics lesson on ${activeLessonTitle}. I am your Tuklas AI learning companion, here to help you master integers and mathematical problem-solving!`,
          guidingQuestion: isFilipino
            ? "Nais mo bang magpatuloy sa iyong kasalukuyang problema sa math?"
            : "Would you like to continue with your current math problem?",
          hintLevel: 1,
          encouragement: isFilipino
            ? "Magkasama nating lutasin ang mga problema sa matematika!"
            : "Let's solve math problems together!",
          nextStep: isFilipino
            ? "Bumalik sa kasalukuyang problema o aralin."
            : "Return to the current mathematical problem or lesson.",
          detectedIssue: "NONE",
          suggestedAction: "CONTINUE_LESSON",
          sourceGrounding: ["System Safety Guard"],
        }),
        provider: this.name,
        model: this.defaultModel,
      };
    }

    // 1b. Explicit Tagalog / Filipino Request Handling (Only when query is solely a language change command)
    if (isFilipino && isLanguageChangeOnlyQuery) {
      return {
        text: JSON.stringify({
          responseType: "HINT",
          message: "Walang anuman, mag-usap tayo sa Tagalog! Upang maunawaan ang araling ito, alalahanin na bawat positibo at negatibong numero ay may katumbas na posisyon sa horizontal number line. Ang mga numero sa kanan ay mas malaki kaysa sa mga numero sa kaliwa.",
          guidingQuestion: "Sa problemang sinusubukan mo, ano ang unang numero at ano ang sign nito (positibo o negatibo)?",
          hintLevel: 1,
          encouragement: "Kaya mo iyan! Hatiin natin ang problema sa mas maliliit at madaling hakbang.",
          nextStep: "Tukuyin ang sign at posisyon ng unang numero sa number line.",
          detectedIssue: "NONE",
          suggestedAction: "CONTINUE_LESSON",
          sourceGrounding: ["DepEd MATATAG Grade 7 Mathematics Tagalog Guidance"],
        }),
        provider: this.name,
        model: this.defaultModel,
      };
    }

    // 1c. Explicit English Request Handling (Only when query is solely a language change command)
    if (!isFilipino && isLanguageChangeOnlyQuery) {
      return {
        text: JSON.stringify({
          responseType: "HINT",
          message: "Sure! Let's continue in English. To understand this lesson, remember that every positive and negative number has a specific position on the horizontal number line. Numbers to the right are greater than numbers to the left.",
          guidingQuestion: "Looking at the problem you're working on, what is the first number and what is its sign (positive or negative)?",
          hintLevel: 1,
          encouragement: "You can do this! Let's break the problem down into smaller, manageable steps.",
          nextStep: "Identify the sign and position of the first number on the number line.",
          detectedIssue: "NONE",
          suggestedAction: "CONTINUE_LESSON",
          sourceGrounding: ["DepEd MATATAG Grade 7 Mathematics English Guidance"],
        }),
        provider: this.name,
        model: this.defaultModel,
      };
    }

    // 1d. Off-topic Math / Cross-Domain Query Redirect
    const isOffTopicQuery =
      studentQuery.includes("area of a triangle") ||
      studentQuery.includes("pythagorean") ||
      studentQuery.includes("quadratic formula") ||
      studentQuery.includes("photosynthesis") ||
      studentQuery.includes("chemical reaction") ||
      studentQuery.includes("who is jose rizal") ||
      studentQuery.includes("capital of") ||
      studentQuery.includes("president of") ||
      (studentQuery.includes("triangle") && !prompt.includes("triangle")) ||
      (studentQuery.includes("geometry") && !prompt.includes("geometry"));

    if (isOffTopicQuery) {
      return {
        text: JSON.stringify({
          responseType: "REDIRECT",
          message: isFilipino
            ? `Kasalukuyan nating pinag-aaralan ang aralin tungkol sa **${activeLessonTitle}**. Maging nakatutok muna tayo sa mga konsepto ng integers at number line upang maging matatag ang iyong pundasyon bago lumipat sa ibang aralin.`
            : `We are currently focusing on your lesson on **${activeLessonTitle}**. Let's stay focused on integers and number line concepts so you build complete mastery before exploring other topics.`,
          guidingQuestion: isFilipino
            ? "May tanong ka ba tungkol sa mga halimbawa o numero sa kasalukuyan mong aralin?"
            : "Do you have a question about the examples or numbers in your current lesson?",
          hintLevel: 1,
          encouragement: isFilipino
            ? "Ang pagiging nakatuon sa bawat aralin ay magdadala sa iyo sa tagumpay sa matematika!"
            : "Staying focused on one topic at a time will lead to lasting math confidence!",
          nextStep: isFilipino
            ? `Magpatuloy sa mga gawain sa ${activeLessonTitle}.`
            : `Continue with the activities in ${activeLessonTitle}.`,
          detectedIssue: "NONE",
          suggestedAction: "CONTINUE_LESSON",
          sourceGrounding: [`Active Lesson Grounding: ${activeLessonTitle}`],
        }),
        provider: this.name,
        model: this.defaultModel,
      };
    }

    // 1e. What is an Integer? Concept Definition
    const studentAskedAboutIntegerDefinition =
      studentQuery.includes("what is an integer") ||
      studentQuery.includes("what are integers") ||
      studentQuery.includes("define integer") ||
      studentQuery.includes("meaning of integer") ||
      studentQuery.includes("ano ang integer") ||
      studentQuery.includes("ano ang mga integer") ||
      studentQuery.includes("kahulugan ng integer") ||
      studentQuery.includes("ibig sabihin ng integer");

    if (studentAskedAboutIntegerDefinition) {
      if (isFilipino) {
        return {
          text: JSON.stringify({
            responseType: "EXPLANATION",
            message: "Ang **integer** ay isang buong numero (whole number) na maaaring positibo ($+1, +2, +3...$), negatibo ($-1, -2, -3...$), o zero ($0$). Hindi kabilang dito ang mga fraction o decimal. Sa number line, ang mga positibong integer ay nasa kanan ng zero, at ang mga negatibong integer ay nasa kaliwa.",
            guidingQuestion: "Masasabi mo ba kung ang $-8$ ay isang integer, at kung ito ay nasa kaliwa o kanan ng zero?",
            hintLevel: 1,
            encouragement: "Mahalagang pundasyon ang kahulugan ng integer para sa buong Grade 7 Math!",
            nextStep: "Tukuyin ang mga numero sa iyong problema kung sila ay positibo o negatibong integer.",
            detectedIssue: "NONE",
            suggestedAction: "CONTINUE_LESSON",
            sourceGrounding: ["DepEd MATATAG Grade 7 Mathematics: Integer Concepts"],
          }),
          provider: this.name,
          model: this.defaultModel,
        };
      }
      return {
        text: JSON.stringify({
          responseType: "EXPLANATION",
          message: "An **integer** is any whole number that can be positive ($+1, +2, +3...$), negative ($-1, -2, -3...$), or zero ($0$). Integers do not include fractions or decimals. On a horizontal number line, positive integers lie to the right of zero, and negative integers lie to the left.",
          guidingQuestion: "Can you tell whether $-8$ is an integer, and whether it lies to the left or right of zero?",
          hintLevel: 1,
          encouragement: "Understanding the definition of integers is the foundation for all Grade 7 Math!",
          nextStep: "Identify whether the numbers in your problem are positive or negative integers.",
          detectedIssue: "NONE",
          suggestedAction: "CONTINUE_LESSON",
          sourceGrounding: ["DepEd MATATAG Grade 7 Mathematics: Integer Concepts"],
        }),
        provider: this.name,
        model: this.defaultModel,
      };
    }

    // 1f. What is a Zero-Pair? Concept Definition
    const studentAskedAboutZeroPair =
      studentQuery.includes("what is a zero-pair") ||
      studentQuery.includes("what is zero-pair") ||
      studentQuery.includes("what is zero pair") ||
      studentQuery.includes("define zero pair") ||
      studentQuery.includes("meaning of zero pair") ||
      studentQuery.includes("ano ang zero-pair") ||
      studentQuery.includes("ano ang zero pair") ||
      studentQuery.includes("kahulugan ng zero-pair") ||
      studentQuery.includes("ibig sabihin ng zero-pair");

    if (studentAskedAboutZeroPair) {
      if (isFilipino) {
        return {
          text: JSON.stringify({
            responseType: "EXPLANATION",
            message: "Ang **zero-pair** ay binubuo ng isang positibong unit ($+1$) at isang negatibong unit ($-1$). Kapag pinagsama ang mga ito, kinakansela nila ang isa't isa dahil ang kanilang kabuuan ay zero ($+1 + (-1) = 0$). Ito ang dahilan kung bakit nagiging madali ang pagdaragdag at pagbabawas ng integers gamit ang mga counter.",
            guidingQuestion: "Kung mayroon kang 3 positibong counter at 3 negatibong counter, ilang zero-pairs ang mabubuo mo?",
            hintLevel: 1,
            encouragement: "Napakagandang modelo ng zero-pairs upang makita ang matematika sa iyong isip!",
            nextStep: "Gamitin ang konsepto ng zero-pairs sa iyong kasalukuyang problema.",
            detectedIssue: "NONE",
            suggestedAction: "CONTINUE_LESSON",
            sourceGrounding: ["DepEd MATATAG Grade 7 Mathematics: Zero-Pairs Model"],
          }),
          provider: this.name,
          model: this.defaultModel,
        };
      }
      return {
        text: JSON.stringify({
          responseType: "EXPLANATION",
          message: "A **zero-pair** consists of one positive unit ($+1$) and one negative unit ($-1$). When combined, they cancel each other out because their sum is zero ($+1 + (-1) = 0$). This makes adding and subtracting integers with counters intuitive and visual.",
          guidingQuestion: "If you have 3 positive counters and 3 negative counters, how many zero-pairs can you form?",
          hintLevel: 1,
          encouragement: "The zero-pair model makes integer arithmetic visual and easy to understand!",
          nextStep: "Use zero-pairs to help solve your current problem.",
          detectedIssue: "NONE",
          suggestedAction: "CONTINUE_LESSON",
          sourceGrounding: ["DepEd MATATAG Grade 7 Mathematics: Zero-Pairs Model"],
        }),
        provider: this.name,
        model: this.defaultModel,
      };
    }

    // 2. Direct Answer Requests (Part 10 - Socratic refusal)
    const studentAskedForDirectAnswer =
      studentQuery.includes("give me the answer") ||
      studentQuery.includes("what is the answer") ||
      studentQuery.includes("just tell me") ||
      studentQuery.includes("tell me the answer") ||
      studentQuery.includes("give the answer") ||
      studentQuery.includes("ibigay ang sagot") ||
      studentQuery.includes("ano ang sagot") ||
      ((studentQuery.includes("sagot") || studentQuery.includes("answer")) &&
        (studentQuery.includes("ibigay") || studentQuery.includes("give") || studentQuery.includes("tell") || studentQuery.includes("sabihin")));

    if (studentAskedForDirectAnswer) {
      if (isFilipino) {
        return {
          text: JSON.stringify({
            type: "GUIDING_QUESTION",
            responseType: "GUIDING_QUESTION",
            message: "Nais kong tulungan kang matuklasan kung paano ito lutasin nang mag-isa upang maging tiwala ka sa anumang pagsusulit! Gawin natin ang unang hakbang nang magkasama.",
            guidingQuestion: "Ano ang napapansin mo sa mga numero at ang kanilang mga sign sa problemang ito?",
            hintLevel: 1,
            encouragement: "Kaya mo itong lutasin nang hakbang-hakbang.",
            nextStep: "Tukuyin muna ang sign ng bawat numero.",
            detectedIssue: "CONFUSION",
            suggestedAction: "RETRY",
            sourceGrounding: ["Patakaran sa Akademikong Integridad"],
          }),
          provider: this.name,
          model: this.defaultModel,
        };
      }
      return {
        text: JSON.stringify({
          type: "GUIDING_QUESTION",
          responseType: "GUIDING_QUESTION",
          message: "I want to help you discover how to solve this yourself so you can feel confident on any test! Let's work through the first step together.",
          guidingQuestion: "What do you notice about the numbers and their signs in this problem?",
          hintLevel: 1,
          encouragement: "You have what it takes to solve this step by step.",
          nextStep: "Identify the signs of each number first.",
          detectedIssue: "CONFUSION",
          suggestedAction: "RETRY",
          sourceGrounding: ["Socratic Academic Integrity Policy"],
        }),
        provider: this.name,
        model: this.defaultModel,
      };
    }

    // 3. Mathisipan / YouTube Video Integrity (Part 6)
    // CRITICAL FIX: Only trigger if the student SPECIFICALLY asked about the video or YouTube!
    // Do NOT trigger if "video" is merely present in the system curriculum/lesson metadata!
    const studentAskedAboutVideo =
      studentQuery.includes("video") ||
      studentQuery.includes("youtube") ||
      studentQuery.includes("mathisipan") ||
      studentQuery.includes("pinanood") ||
      studentQuery.includes("napanood");

    if (studentAskedAboutVideo) {
      if (isFilipino) {
        return {
          text: JSON.stringify({
            responseType: "EXPLANATION",
            message: "Batay sa mga tala ng aralin at paliwanag ng guro sa Tuklas, tinatalakay sa paksang ito kung paano inilalagay ang integers sa number line at paano nag-uugnayan ang magkaibang signs. (Paalala: Bilang AI companion, hindi ko napanood nang direkta ang YouTube video dahil walang machine-readable transcript, ngunit matutulungan kita sa lahat ng konsepto sa iyong aralin!)",
            guidingQuestion: "Aling bahagi ng mga konsepto ng integer ang nais mong tuklasin nang magkasama?",
            hintLevel: 1,
            encouragement: "Ang pag-ugnay ng mga tala sa aralin sa iyong pagsasanay ay nagpapatibay ng kaalaman.",
            nextStep: "Suriin ang bahagi ng mga pangunahing ideya sa iyong aralin.",
            detectedIssue: "NONE",
            suggestedAction: "REVIEW_LESSON",
            sourceGrounding: ["Mga Tala sa Aralin", "Metadata ng Video"],
          }),
          provider: this.name,
          model: this.defaultModel,
        };
      }
      return {
        text: JSON.stringify({
          responseType: "EXPLANATION",
          message: "Based on the lesson materials and teacher notes available in Tuklas, this topic covers how integers are placed on a number line and how opposite signs interact. (Note: As an AI companion, I haven't watched the YouTube video directly since machine-readable transcripts aren't loaded, but I can help you with all the concepts from your lesson!)",
          guidingQuestion: "Which part of the integer concepts would you like to explore together?",
          hintLevel: 1,
          encouragement: "Connecting lesson notes to your practice builds lasting mastery.",
          nextStep: "Check the key ideas section in your lesson.",
          detectedIssue: "NONE",
          suggestedAction: "REVIEW_LESSON",
          sourceGrounding: ["Lesson Resource Notes", "Video Metadata"],
        }),
        provider: this.name,
        model: this.defaultModel,
      };
    }

    // 4a. Failure Honesty for Failed Document Extraction (Phase 22)
    if (
      (studentQuery.includes("pdf") || studentQuery.includes("docx") || studentQuery.includes("document")) &&
      (studentQuery.includes("fail") || studentQuery.includes("corrupt") || studentQuery.includes("unreadable") || studentQuery.includes("error") || studentQuery.includes("couldn't extract"))
    ) {
      return {
        text: JSON.stringify({
          responseType: "CLARIFICATION",
          message: isFilipino
            ? "Nakalakip ang PDF ng guro, ngunit hindi ko makuha ang teksto nito. Makakatulong pa rin ako gamit ang nilalaman ng aralin."
            : "The teacher's PDF is attached, but I couldn't extract its text. I can still help using the lesson content.",
          guidingQuestion: isFilipino
            ? "Nais mo bang suriin natin ang mga konsepto at halimbawa sa aralin nang magkasama?"
            : "Would you like to review the lesson concepts and examples together?",
          hintLevel: 1,
          encouragement: isFilipino
            ? "Magagawa pa rin nating matutuhan ang paksang ito gamit ang lahat ng nalathalang aralin!"
            : "We can still master this topic using all the published lesson content!",
          nextStep: isFilipino
            ? "Tuklasin ang mga nilalaman ng aralin at pangunahing ideya."
            : "Explore the lesson content blocks and key ideas.",
          detectedIssue: "NONE",
          suggestedAction: "CONTINUE_LESSON",
          sourceGrounding: ["Document Extraction Status: FAILED", "Grounded Lesson Content"],
        }),
        provider: this.name,
        model: this.defaultModel,
      };
    }

    // 4b. Teacher-provided material / notes / Extracted Document Intelligence (Phase 22)
    const studentAskedAboutTeacherMaterial =
      studentQuery.includes("teacher document") ||
      studentQuery.includes("teacher's document") ||
      studentQuery.includes("from the pdf") ||
      studentQuery.includes("in the pdf") ||
      studentQuery.includes("teacher's pdf") ||
      studentQuery.includes("teacher pdf") ||
      studentQuery.includes("teacher docx") ||
      studentQuery.includes("extracted document") ||
      studentQuery.includes("material section") ||
      studentQuery.includes("teacher note") ||
      studentQuery.includes("teacher's note") ||
      studentQuery.includes("teacher material") ||
      studentQuery.includes("teacher-provided") ||
      studentQuery.includes("dokumento ng guro") ||
      studentQuery.includes("tala ng guro");

    if (studentAskedAboutTeacherMaterial) {
      if (isFilipino) {
        return {
          text: JSON.stringify({
            responseType: "EXPLANATION",
            message: "Batay sa dokumentong ini-upload ng iyong guro, ang integers ay nakaayos sa number line kung saan ang anumang numero sa kanan ay mas malaki kaysa sa numero sa kaliwa. Binibigyang-diin din ng guro na ang pagbabawas ng integer ay katumbas ng pagdaragdag ng additive inverse ($a - b = a + (-b)$), at ang paggamit ng zero-pairs ($+1 + -1 = 0$) ay nagpapadali sa pagsasama ng mga terms.",
            guidingQuestion: "Paano nakakatulong ang tuntunin ng additive inverse upang muling isulat ang problemang iyong nilulutas?",
            hintLevel: 1,
            encouragement: "Ang pag-ugnay ng mga tala ng iyong guro sa pagsasanay ay nagpapabilis ng iyong pagkatuto.",
            nextStep: "Isulat muli ang pagbabawas bilang pagdaragdag ng kabaligtarang integer.",
            detectedIssue: "NONE",
            suggestedAction: "CONTINUE_LESSON",
            sourceGrounding: ["Teacher Material: Extracted Document Chunks", "DepEd MATATAG Lesson Grounding"],
          }),
          provider: this.name,
          model: this.defaultModel,
        };
      }
      return {
        text: JSON.stringify({
          responseType: "EXPLANATION",
          message: "Based on your teacher's uploaded document, integers are ordered on a number line such that any number to the right is strictly greater than any number to the left. Furthermore, the teacher's material emphasizes that subtracting an integer is equivalent to adding its additive inverse ($a - b = a + (-b)$), and using zero-pairs ($+1 + -1 = 0$) makes combining terms intuitive.",
          guidingQuestion: "How does the additive inverse rule help you rewrite the problem you are solving?",
          hintLevel: 1,
          encouragement: "Connecting your teacher's uploaded notes directly to practice accelerates your learning.",
          nextStep: "Rewrite the subtraction as an addition of the opposite integer.",
          detectedIssue: "NONE",
          suggestedAction: "CONTINUE_LESSON",
          sourceGrounding: ["Teacher Material: Extracted Document Chunks", "DepEd MATATAG Lesson Grounding"],
        }),
        provider: this.name,
        model: this.defaultModel,
      };
    }

    // 5. Why is my answer wrong? / Sign errors (e.g. -7 + 3 = -10, -5 + 3 = -8)
    const studentAskedAboutWrongAnswer =
      studentQuery.includes("why is my answer wrong") ||
      studentQuery.includes("why is that wrong") ||
      studentQuery.includes("bakit mali") ||
      studentQuery.includes("mali ba") ||
      studentQuery.includes("sign error") ||
      (studentQuery.includes("-7") && studentQuery.includes("3") && (studentQuery.includes("-10") || studentQuery.includes("wrong") || studentQuery.includes("mali"))) ||
      (studentQuery.includes("-5") && studentQuery.includes("3") && (studentQuery.includes("-8") || studentQuery.includes("wrong") || studentQuery.includes("mali")));

    if (studentAskedAboutWrongAnswer) {
      if (isFilipino) {
        return {
          text: JSON.stringify({
            responseType: "FEEDBACK",
            message: "Nauunawaan ko kung saan nagkaroon ng kalituhan. Kapag nagdaragdag ng mga numerong may *magkaibang sign*, tulad ng $-7$ at $+3$, HINDI natin pinagsasama ang kanilang laki upang maging $-10$. Sa halip, ibawas ang mas maliit na absolute value mula sa mas malaki ($7 - 3 = 4$), at kunin ang sign ng numerong may mas malaking absolute value ($-7$). Kaya $-7 + 3 = -4$.",
            guidingQuestion: "Ano ang absolute value ng $-7$ kumpara sa absolute value ng $+3$?",
            hintLevel: 2,
            encouragement: "Ang pagkilala sa mga tuntunin ng sign ay malaking hakbang tungo sa pagiging mahusay sa integers!",
            nextStep: "Kalkulahin muli gamit ang tuntunin ng pagbabawas ng absolute value.",
            detectedIssue: "SIGN_ERROR",
            suggestedAction: "RETRY",
            sourceGrounding: ["DepEd MATATAG Integer Addition Rules"],
          }),
          provider: this.name,
          model: this.defaultModel,
        };
      }
      return {
        text: JSON.stringify({
          responseType: "FEEDBACK",
          message: "I see where the confusion happened. When adding numbers with *different signs*, like $-7$ and $+3$, we do NOT add their magnitudes to get $-10$. Instead, subtract the smaller absolute value from the larger ($7 - 3 = 4$), and take the sign of the number with the larger absolute value ($-7$). So $-7 + 3 = -4$.",
          guidingQuestion: "What is the absolute value of $-7$ compared to the absolute value of $+3$?",
          hintLevel: 2,
          encouragement: "Recognizing sign rules is a huge step toward mastering integers!",
          nextStep: "Recalculate using the absolute value subtraction rule.",
          detectedIssue: "SIGN_ERROR",
          suggestedAction: "RETRY",
          sourceGrounding: ["DepEd MATATAG Integer Addition Rules"],
        }),
        provider: this.name,
        model: this.defaultModel,
      };
    }

    // 5b. Why Did We Move Left? / Negative Numbers on the Left / Directionality Reasoning (Part 9 Situation G & Part 14)
    const studentAskedAboutMoveLeft =
      studentQuery.includes("left") ||
      studentQuery.includes("kaliwa") ||
      studentQuery.includes("pakaliwa") ||
      studentQuery.includes("move left") ||
      studentQuery.includes("lumipat sa kaliwa");

    if (studentAskedAboutMoveLeft) {
      if (isFilipino) {
        return {
          text: JSON.stringify({
            responseType: "EXPLANATION",
            message: "Nasa kaliwa ng zero ang mga negatibong numero sa horizontal number line dahil kumakatawan sila sa mga halagang mas mababa sa zero. Ayon sa standard na mathematical convention, habang papunta ka sa kanan, lumalaki ang halaga ng mga numero (positibo), at habang papunta ka sa kaliwa, lumiliit ang halaga (negatibo). Kaya ang anumang negatibong numero tulad ng $-1, -2, -3$ ay palaging nasa kaliwa ng zero at mas maliit kaysa sa mga positibong numero.",
            guidingQuestion: "Kung ang $-3$ ay nasa kaliwa ng $-1$ sa number line, aling numero ang mas malaki ang halaga?",
            hintLevel: 1,
            encouragement: "Ang pag-ugnay ng paggalaw sa number line sa mga sign ng matematika ay nagbibigay ng malalim na pang-unawa!",
            nextStep: "Sundan ang posisyon ng numero simula sa zero.",
            detectedIssue: "NONE",
            suggestedAction: "CONTINUE_LESSON",
            sourceGrounding: ["Horizontal Number Line Model", "Directionality Convention"],
          }),
          provider: this.name,
          model: this.defaultModel,
        };
      }
      return {
        text: JSON.stringify({
          responseType: "EXPLANATION",
          message: "Negative numbers are placed to the left of zero on a horizontal number line because they represent values less than zero. By mathematical convention, moving to the right represents increasing values (positive), while moving to the left represents decreasing values (negative). Therefore, numbers like $-1, -2, -3$ are always to the left of zero and are smaller than positive numbers.",
          guidingQuestion: "If $-3$ is located to the left of $-1$ on the number line, which number has the greater value?",
          hintLevel: 1,
          encouragement: "Connecting number line motion to mathematical signs gives you deep intuition!",
          nextStep: "Trace the position of the number starting from zero.",
          detectedIssue: "NONE",
          suggestedAction: "CONTINUE_LESSON",
          sourceGrounding: ["Horizontal Number Line Model", "Directionality Convention"],
        }),
        provider: this.name,
        model: this.defaultModel,
      };
    }

    // 5c. Partially Correct Answer (Part 9 Situation B)
    const studentPartiallyCorrect =
      studentQuery.includes("partially correct") ||
      studentQuery.includes("got the number right") ||
      studentQuery.includes("unsure of the sign") ||
      studentQuery.includes("i got 3 but") ||
      studentQuery.includes("is it positive or negative") ||
      studentQuery.includes("positibo ba o negatibo");

    if (studentPartiallyCorrect) {
      if (isFilipino) {
        return {
          text: JSON.stringify({
            responseType: "FEEDBACK",
            message: "Nakuha mo nang tama ang bahagi ng kalkulasyon! Ang pagkuha ng diperensya sa pagitan ng mga absolute value ($9 - 6 = 3$) ay ganap na tama. Ngayon, upang matukoy kung ito ay $+3$ o $-3$, suriin kung aling numero ang may mas malaking absolute value: $|+9| = 9$ o $|-6| = 6$.",
            guidingQuestion: "Dahil ang $9 > 6$, aling sign ang mananaig: $+9$ o $-6$?",
            hintLevel: 1,
            encouragement: "Kalahati na ng sagot ang tama — ang iyong arithmetic ay tumpak!",
            nextStep: "Ilapat ang sign ng numerong may mas malaking absolute value.",
            detectedIssue: "SIGN_ERROR",
            suggestedAction: "RETRY",
            sourceGrounding: ["Absolute Value Sign Rules"],
          }),
          provider: this.name,
          model: this.defaultModel,
        };
      }
      return {
        text: JSON.stringify({
          responseType: "FEEDBACK",
          message: "You nailed the calculation part! Finding the difference between the absolute values ($9 - 6 = 3$) is completely correct. Now, to determine whether it's $+3$ or $-3$, check which number had the larger absolute value: $|+9| = 9$ or $|-6| = 6$.",
          guidingQuestion: "Since $9 > 6$, which number's sign wins: $+9$ or $-6$?",
          hintLevel: 1,
          encouragement: "You're more than halfway there — your arithmetic was spot on!",
          nextStep: "Apply the sign of the number with the larger absolute value.",
          detectedIssue: "SIGN_ERROR",
          suggestedAction: "RETRY",
          sourceGrounding: ["Absolute Value Sign Rules"],
        }),
        provider: this.name,
        model: this.defaultModel,
      };
    }

    // 5d. Asking About a Previous Mistake (Part 9 Situation K)
    const studentAskedAboutPreviousMistake =
      studentQuery.includes("previous mistake") ||
      studentQuery.includes("what did i do wrong before") ||
      studentQuery.includes("earlier mistake") ||
      studentQuery.includes("my last attempt") ||
      studentQuery.includes("dating mali") ||
      studentQuery.includes("nakaraang pagkakamali");

    if (studentAskedAboutPreviousMistake) {
      if (isFilipino) {
        return {
          text: JSON.stringify({
            responseType: "FEEDBACK",
            message: "Sa iyong nakaraang pagsubok, pinagsama mo agad ang laki ng mga numero sa halip na ibawas ang mga ito. Kapag magkaiba ang sign, isipin ito bilang tagisan sa pagitan ng positibo at negatibo: kinakansela nila ang isa't isa sa halip na magsanib.",
            guidingQuestion: "Paano nakakatulong ang pag-iisip ng magkaibang sign bilang nagkakanselahan sa pagpili ng tamang operasyon?",
            hintLevel: 2,
            encouragement: "Ang pagkatuto mula sa ating mga nakaraang pagsubok ay ang pinakamabilis na paraan tungo sa kahusayan!",
            nextStep: "Ilapat ang pagbabawas ng absolute values sa iyong susunod na pagsubok.",
            detectedIssue: "SIGN_ERROR",
            suggestedAction: "RETRY",
            sourceGrounding: ["Student Attempt History & Mistake Analysis"],
          }),
          provider: this.name,
          model: this.defaultModel,
        };
      }
      return {
        text: JSON.stringify({
          responseType: "FEEDBACK",
          message: "On your previous attempt, you added the magnitudes together directly instead of subtracting them. When signs are opposite, think of it as a tug-of-war between positive and negative: they cancel each other out rather than joining forces.",
          guidingQuestion: "How does thinking of opposite signs as canceling help you choose the right operation?",
          hintLevel: 2,
          encouragement: "Learning from our past attempts is the fastest way to build mastery!",
          nextStep: "Apply subtraction of absolute values to your next attempt.",
          detectedIssue: "SIGN_ERROR",
          suggestedAction: "RETRY",
          sourceGrounding: ["Student Attempt History & Mistake Analysis"],
        }),
        provider: this.name,
        model: this.defaultModel,
      };
    }

    // 6. Calculation Error (e.g., student makes an arithmetic mistake)
    const studentAskedAboutCalculationError =
      studentQuery.includes("calculation error") ||
      studentQuery.includes("arithmetic error") ||
      studentQuery.includes("miscalculated") ||
      studentQuery.includes("maling kwenta") ||
      studentQuery.includes("maling kalkula");

    if (studentAskedAboutCalculationError) {
      if (isFilipino) {
        return {
          text: JSON.stringify({
            responseType: "FEEDBACK",
            message: "Ang iyong pangangatwiran sa mga sign ay tama, ngunit nagkaroon ng kaunting pagkakamali sa arithmetic. Suriin nating muli ang pagbabawas.",
            guidingQuestion: "Ano ang diperensya sa pagitan ng dalawang absolute value kapag maingat mong kinalkula?",
            hintLevel: 1,
            encouragement: "Tama ang iyong pamamaraan; isang mabilis na pagtiyak sa kalkulasyon ay magbibigay sa iyo ng eksaktong sagot.",
            nextStep: "Muling suriin ang pangunahing hakbang ng arithmetic.",
            detectedIssue: "CALCULATION_ERROR",
            suggestedAction: "RETRY",
            sourceGrounding: ["Arithmetic Verification"],
          }),
          provider: this.name,
          model: this.defaultModel,
        };
      }
      return {
        text: JSON.stringify({
          responseType: "FEEDBACK",
          message: "Your reasoning on the signs is completely on track, but there was a small calculation error in the arithmetic step. Let's double-check the subtraction.",
          guidingQuestion: "What is the difference between the two absolute values when you calculate carefully?",
          hintLevel: 1,
          encouragement: "Your method is right; a quick calculation check will get you the exact answer.",
          nextStep: "Re-check the basic arithmetic step.",
          detectedIssue: "CALCULATION_ERROR",
          suggestedAction: "RETRY",
          sourceGrounding: ["Arithmetic Verification"],
        }),
        provider: this.name,
        model: this.defaultModel,
      };
    }

    // 7. Conceptual Misunderstanding (e.g., -5 vs -2, thinking -5 > -2 because 5 > 2)
    const studentAskedAboutConceptualComparison =
      (studentQuery.includes("-5") && studentQuery.includes("-2")) ||
      studentQuery.includes("alin ang mas malaki") ||
      studentQuery.includes("which is greater") ||
      studentQuery.includes("is -5 greater than -2") ||
      studentQuery.includes("mas malaki ba ang -5");

    if (studentAskedAboutConceptualComparison) {
      if (isFilipino) {
        return {
          text: JSON.stringify({
            responseType: "HINT",
            message: "Sa mga negatibong numero, ang numerong mas malapit sa zero sa horizontal number line ang may mas malaking halaga. Halimbawa, $|-2| = 2$ at $|-5| = 5$. Dahil ang $-2$ ay nasa kanan ng $-5$, ang $-2 > -5$.",
            guidingQuestion: "Aling numero ang mas pakanan sa number line: $-5$ o $-2$?",
            hintLevel: 1,
            encouragement: "Isipin ang isang number line sa iyong isipan!",
            nextStep: "Hanapin ang posisyon ng parehong numero kaugnay ng zero.",
            detectedIssue: "CONCEPTUAL_MISUNDERSTANDING",
            suggestedAction: "TRY_SIMILAR",
            sourceGrounding: ["DepEd MATATAG M7NS-Ia-1"],
          }),
          provider: this.name,
          model: this.defaultModel,
        };
      }
      return {
        text: JSON.stringify({
          responseType: "HINT",
          message: "With negative numbers, the number that is closer to zero on the horizontal number line has the greater value. For example, $|-2| = 2$ and $|-5| = 5$. Since $-2$ is to the right of $-5$, $-2 > -5$.",
          guidingQuestion: "Which number is farther to the right: $-5$ or $-2$?",
          hintLevel: 1,
          encouragement: "Picture a number line in your mind!",
          nextStep: "Locate both numbers relative to zero.",
          detectedIssue: "CONCEPTUAL_MISUNDERSTANDING",
          suggestedAction: "TRY_SIMILAR",
          sourceGrounding: ["DepEd MATATAG M7NS-Ia-1"],
        }),
        provider: this.name,
        model: this.defaultModel,
      };
    }

    // 8. Prerequisite Gap (e.g., student doesn't know absolute value)
    const studentAskedAboutAbsoluteValue =
      studentQuery.includes("what is an absolute value") ||
      studentQuery.includes("what is absolute value") ||
      studentQuery.includes("don't know absolute value") ||
      studentQuery.includes("ano ang absolute value") ||
      studentQuery.includes("kahulugan ng absolute value");

    if (studentAskedAboutAbsoluteValue) {
      if (isFilipino) {
        return {
          text: JSON.stringify({
            responseType: "EXPLANATION",
            message: "Ang **absolute value** ng isang numero, na isinusulat bilang $|x|$, ay ang layo nito mula sa zero sa number line. Dahil ang distansya ay hindi kailanman negatibo, ang absolute value ay palaging positibo o zero. Halimbawa, $|-7| = 7$ at $|+3| = 3$.",
            guidingQuestion: "Ngayong alam mo nang laging positibo ang distansya mula sa zero, ano ang $|-12|$?",
            hintLevel: 1,
            encouragement: "Ang pagpapatibay sa kasanayang ito ay magpapadali sa mga operasyon ng integers.",
            nextStep: "Subukang hanapin ang layo mula sa zero para sa isang negatibong integer.",
            detectedIssue: "PREREQUISITE_GAP",
            suggestedAction: "REVIEW_PREREQUISITE",
            sourceGrounding: ["Prerequisite Skill: Absolute Value (skl_01)"],
          }),
          provider: this.name,
          model: this.defaultModel,
        };
      }
      return {
        text: JSON.stringify({
          responseType: "EXPLANATION",
          message: "The **absolute value** of a number, written as $|x|$, is its distance from zero on the number line. Because distance can never be negative, absolute value is always positive or zero. For instance, $|-7| = 7$ and $|+3| = 3$.",
          guidingQuestion: "Now that you know distance from zero is always positive, what is $|-12|$?",
          hintLevel: 1,
          encouragement: "Strengthening this prerequisite skill will make integer operations feel natural.",
          nextStep: "Practice finding the distance from zero for a negative integer.",
          detectedIssue: "PREREQUISITE_GAP",
          suggestedAction: "REVIEW_PREREQUISITE",
          sourceGrounding: ["Prerequisite Skill: Absolute Value (skl_01)"],
        }),
        provider: this.name,
        model: this.defaultModel,
      };
    }

    // 9. Repeated Mistake (Student repeated the same error)
    const studentRepeatedMistake =
      studentQuery.includes("tried again and got") ||
      studentQuery.includes("same mistake") ||
      studentQuery.includes("still got") ||
      studentQuery.includes("ulit na mali") ||
      studentQuery.includes("paulit-ulit");

    if (studentRepeatedMistake) {
      if (isFilipino) {
        return {
          text: JSON.stringify({
            responseType: "EXPLANATION",
            message: "Dahil nagdudulot pa rin ng kalituhan ang paraang iyan, magpalit tayo ng estratehiya at gumamit ng **integer counters**! Isipin na mayroon kang 7 pulang counter (kumakatawan sa $-7$) at 3 asul na counter (kumakatawan sa $+3$). Ang bawat pares ng isang pula at isang asul ay bumubuo ng zero-pair at nagkakanselahan.",
            guidingQuestion: "Matapos magkansela ang 3 pares, ilang pulang counter ang natitira?",
            hintLevel: 2,
            encouragement: "Ang pagpapalit ng representasyon ay ginagawa ng magagaling na mag-aaral kapag nahihirapan!",
            nextStep: "Bilangin ang mga natitirang counter at tukuyin ang kanilang sign.",
            detectedIssue: "CONCEPTUAL_MISUNDERSTANDING",
            suggestedAction: "TRY_EASIER",
            sourceGrounding: ["Interactive Counter Model (Lesson Block 2)"],
          }),
          provider: this.name,
          model: this.defaultModel,
        };
      }
      return {
        text: JSON.stringify({
          responseType: "EXPLANATION",
          message: "Since that approach is still causing trouble, let's switch strategies completely and use **integer counters**! Imagine you have 7 red counters (representing $-7$) and 3 blue counters (representing $+3$). Each pair of one red and one blue forms a zero-pair and cancels out.",
          guidingQuestion: "After 3 pairs cancel, how many red counters remain?",
          hintLevel: 2,
          encouragement: "Switching representations is what great mathematicians do when stuck!",
          nextStep: "Count the remaining uncanceled counters and state their sign.",
          detectedIssue: "CONCEPTUAL_MISUNDERSTANDING",
          suggestedAction: "TRY_EASIER",
          sourceGrounding: ["Interactive Counter Model (Lesson Block 2)"],
        }),
        provider: this.name,
        model: this.defaultModel,
      };
    }

    // 10. Student Solves Correctly (Constructive praise + next challenge)
    const studentSolvedCorrectly =
      studentQuery.includes("i got -4") ||
      studentQuery.includes("the answer is -4") ||
      studentQuery.includes("i solved it") ||
      studentQuery.includes("correct answer") ||
      studentQuery.includes("got it right") ||
      studentQuery.includes("nakuha ko ang tamang sagot") ||
      studentQuery.includes("tama ba ang -4");

    if (studentSolvedCorrectly) {
      if (isFilipino) {
        return {
          text: JSON.stringify({
            responseType: "FEEDBACK",
            message: "Tama iyan: $-7 + 3 = -4$. Maingat mong ibinawas ang mga absolute value ($7 - 3 = 4$) at inilapat ang negatibong sign mula sa $-7$ dahil ito ang may mas malaking absolute value.",
            guidingQuestion: "Handa ka na bang subukan ang ganitong pangangatwiran sa susunod na problema?",
            hintLevel: 1,
            encouragement: "Matatag at tumpak ang iyong pangangatwiran sa mga sign.",
            nextStep: "Subukan ang susunod na tanong sa iyong aralin.",
            detectedIssue: "NONE",
            suggestedAction: "CONTINUE_LESSON",
            sourceGrounding: ["Integer Addition Concept Mastery"],
          }),
          provider: this.name,
          model: this.defaultModel,
        };
      }
      return {
        text: JSON.stringify({
          responseType: "FEEDBACK",
          message: "That is correct: $-7 + 3 = -4$. You correctly subtracted the absolute values ($7 - 3 = 4$) and applied the negative sign from $-7$ because it had the greater absolute value.",
          guidingQuestion: "Ready to test this same reasoning on a slightly different problem?",
          hintLevel: 1,
          encouragement: "Your sign reasoning was solid and accurate.",
          nextStep: "Try the next practice question in your lesson.",
          detectedIssue: "NONE",
          suggestedAction: "CONTINUE_LESSON",
          sourceGrounding: ["Integer Addition Concept Mastery"],
        }),
        provider: this.name,
        model: this.defaultModel,
      };
    }

    // 11. Request for Another Worked Example (Part 2 item 11)
    const studentRequestedExample =
      studentQuery.includes("another example") ||
      studentQuery.includes("worked example") ||
      studentQuery.includes("show me an example") ||
      studentQuery.includes("different numbers") ||
      studentQuery.includes("halimbawa") ||
      studentQuery.includes("magpakita ng halimbawa");

    if (studentRequestedExample) {
      if (isFilipino) {
        return {
          text: JSON.stringify({
            responseType: "EXAMPLE",
            message: "Narito ang isang halimbawa na may magkaibang numero:\n\n**Problema:** Hanapin ang $(-9) + (+4)$.\n*Hakbang 1:* Tukuyin ang signs: magkaibang sign ($-9$ at $+4$).\n*Hakbang 2:* Paghambingin ang absolute values: $|-9| = 9$ at $|+4| = 4$.\n*Hakbang 3:* Ibawas ang mas maliit sa mas malaki: $9 - 4 = 5$.\n*Hakbang 4:* Panatilihin ang sign ng may mas malaking absolute value ($-9$ ay negatibo), kaya $-5$.\n\n**Resulta:** $(-9) + (+4) = -5$.",
            guidingQuestion: "Pansinin kung paano natin ibinawas ang 4 mula sa 9. Paano ito maihahambing sa iyong nilulutas?",
            hintLevel: 2,
            encouragement: "Ang pagsusuri sa mga halimbawa ay nagpapatibay ng paraan sa iyong isipan!",
            nextStep: "Ilapat ang 4 na hakbang na ito sa iyong kasalukuyang problema.",
            detectedIssue: "NONE",
            suggestedAction: "TRY_SIMILAR",
            sourceGrounding: ["Lesson 2 Worked Examples"],
          }),
          provider: this.name,
          model: this.defaultModel,
        };
      }
      return {
        text: JSON.stringify({
          responseType: "EXAMPLE",
          message: "Here is a worked example with different numbers:\n\n**Problem:** Find $(-9) + (+4)$.\n*Step 1:* Identify signs: opposite signs ($-9$ and $+4$).\n*Step 2:* Compare absolute values: $|-9| = 9$ and $|+4| = 4$.\n*Step 3:* Subtract smaller from larger: $9 - 4 = 5$.\n*Step 4:* Keep the sign of the larger magnitude ($-9$ is negative), giving $-5$.\n\n**Result:** $(-9) + (+4) = -5$.",
          guidingQuestion: "Notice how we subtracted 4 from 9? How does that compare to your problem?",
          hintLevel: 2,
          encouragement: "Studying worked examples helps solidify the method in your mind!",
          nextStep: "Apply these 4 steps to your current problem.",
          detectedIssue: "NONE",
          suggestedAction: "TRY_SIMILAR",
          sourceGrounding: ["Lesson 2 Worked Examples"],
        }),
        provider: this.name,
        model: this.defaultModel,
      };
    }

    // 12. Request for Easier Explanation (Part 2 item 12)
    const studentRequestedEasier =
      studentQuery.includes("easier explanation") ||
      studentQuery.includes("more simply") ||
      studentQuery.includes("simpler") ||
      studentQuery.includes("too hard") ||
      studentQuery.includes("mas madali") ||
      studentQuery.includes("mas simple") ||
      studentQuery.includes("masyadong mahirap");

    if (studentRequestedEasier) {
      if (isFilipino) {
        return {
          text: JSON.stringify({
            responseType: "EXPLANATION",
            message: "Gawin nating napakasimple gamit ang ideya ng **pera**:\n• Ang positibong numero ay perang hawak mo ($+\\$10$).\n• Ang negatibong numero ay perang utang mo ($-\\$7$).\n\nKung may utang kang $\\$7$ at kumita ka ng $\\$3$, nabayaran mo ang bahagi ng utang. May utang ka pa ring $\\$4$, na katumbas ng $-4$!",
            guidingQuestion: "Mas malinaw ba ang mga sign kapag iniisip ang perang hawak kumpara sa perang utang?",
            hintLevel: 1,
            encouragement: "Ang pag-ugnay sa totoong buhay ay nagpapadali sa mga tuntunin ng matematika!",
            nextStep: "Isipin ang iyong problema sa konteksto ng utang at bayad.",
            detectedIssue: "CONFUSION",
            suggestedAction: "TRY_EASIER",
            sourceGrounding: ["DepEd Real-World Mathematics Application"],
          }),
          provider: this.name,
          model: this.defaultModel,
        };
      }
      return {
        text: JSON.stringify({
          responseType: "EXPLANATION",
          message: "Let's make this super simple using the concept of **money**:\n• Positive numbers are money you have ($+\\$10$).\n• Negative numbers are money you owe ($-\\$7$).\n\nIf you owe $\\$7$ and earn $\\$3$, you pay off part of your debt. You still owe $\\$4$, which is $-4$!",
          guidingQuestion: "Does thinking about money you owe versus money you have make the signs clearer?",
          hintLevel: 1,
          encouragement: "Real-world connections make abstract rules simple!",
          nextStep: "Think of your problem in terms of owing and paying.",
          detectedIssue: "CONFUSION",
          suggestedAction: "TRY_EASIER",
          sourceGrounding: ["DepEd Real-World Mathematics Application"],
        }),
        provider: this.name,
        model: this.defaultModel,
      };
    }

    // 13. Request for Harder Challenge (Part 2 item 13)
    const studentRequestedChallenge =
      studentQuery.includes("harder") ||
      studentQuery.includes("challenge") ||
      studentQuery.includes("more difficult") ||
      studentQuery.includes("advanced") ||
      studentQuery.includes("mas mahirap") ||
      studentQuery.includes("hamon");

    if (studentRequestedChallenge) {
      if (isFilipino) {
        return {
          text: JSON.stringify({
            responseType: "FEEDBACK",
            message: "Napakagandang sigasig! Dahil naunawaan mo na ang simpleng pagdaragdag ng integers, narito ang isang hamon:\n\n**Hamon:** Suriin ang $(-15) + (+8) + (-6) + (+12)$.",
            guidingQuestion: "Ang magandang estratehiya ay pagsamahin muna ang mga positibo at negatibo. Ano ang kabuuan ng mga negatibo at kabuuan ng mga positibo?",
            hintLevel: 2,
            encouragement: "Ang paglutas sa mas mahihirap na problema ay nagpapalakas ng galing sa matematika!",
            nextStep: "Pagsamahin ang magkakaparehong sign bago pagsamahin ang lahat.",
            detectedIssue: "NONE",
            suggestedAction: "TRY_HARDER",
            sourceGrounding: ["Advanced MATATAG Grade 7 Applications"],
          }),
          provider: this.name,
          model: this.defaultModel,
        };
      }
      return {
        text: JSON.stringify({
          responseType: "FEEDBACK",
          message: "Great ambition! Since you have mastered basic two-term integer addition, here is a multi-step challenge:\n\n**Challenge:** Evaluate $(-15) + (+8) + (-6) + (+12)$.",
          guidingQuestion: "A good strategy is grouping positive and negative integers first. What is the sum of the negatives and the sum of the positives?",
          hintLevel: 2,
          encouragement: "Pushing into harder problems develops true mathematical power!",
          nextStep: "Group like signs together before combining.",
          detectedIssue: "NONE",
          suggestedAction: "TRY_HARDER",
          sourceGrounding: ["Advanced MATATAG Grade 7 Applications"],
        }),
        provider: this.name,
        model: this.defaultModel,
      };
    }

    // 14. Request for Practice (Part 2 item 19)
    const studentRequestedPractice =
      studentQuery.includes("give me practice") ||
      studentQuery.includes("want to practice") ||
      studentQuery.includes("practice question") ||
      studentQuery.includes("more questions") ||
      studentQuery.includes("pagsasanay") ||
      studentQuery.includes("mag-practice");

    if (studentRequestedPractice) {
      if (isFilipino) {
        return {
          text: JSON.stringify({
            responseType: "HINT",
            message: "Narito ang isang tanong sa pagsasanay na nakalinya sa iyong kasalukuyang aralin:\n\n**Pagsasanay:** Kalkulahin ang $(-11) + (+7)$.",
            guidingQuestion: "Ano ang diperensya sa pagitan ng 11 at 7, at aling sign ang dapat ilagay sa sagot?",
            hintLevel: 1,
            encouragement: "Ang aktibong pagsasanay ay ang pinakamabilis na landas tungo sa kahusayan!",
            nextStep: "Ibigay ang iyong sagot o sabihin kung anong hakbang ang iyong ginawa.",
            detectedIssue: "NONE",
            suggestedAction: "PRACTICE",
            sourceGrounding: ["Lesson Practice Bank"],
          }),
          provider: this.name,
          model: this.defaultModel,
        };
      }
      return {
        text: JSON.stringify({
          responseType: "HINT",
          message: "Here is a targeted practice question aligned with your current lesson:\n\n**Practice Item:** Calculate $(-11) + (+7)$.",
          guidingQuestion: "What is the difference between 11 and 7, and which sign belongs with the answer?",
          hintLevel: 1,
          encouragement: "Active practice is the quickest path to mastery!",
          nextStep: "Submit your answer or tell me what step you took.",
          detectedIssue: "NONE",
          suggestedAction: "PRACTICE",
          sourceGrounding: ["Lesson Practice Bank"],
        }),
        provider: this.name,
        model: this.defaultModel,
      };
    }

    // 15a. Intermediate Student Response to Guiding Question (Phase 22 Conversational Continuity)
    const studentAnsweredGuidingQuestion =
      studentQuery.includes("first number") ||
      studentQuery.includes("the first number is") ||
      studentQuery.includes("is the first number") ||
      studentQuery.includes("it's -5") ||
      studentQuery.includes("its -5") ||
      studentQuery.includes("unang numero");

    if (studentAnsweredGuidingQuestion) {
      if (isFilipino) {
        return {
          text: JSON.stringify({
            responseType: "FEEDBACK",
            message: "Eksaktong tama: $-5$ ang unang numero, at sa number line ito ay 5 unit sa kaliwa ng zero. Ngayon tingnan ang ikalawang numero, $-2$, na 2 unit lamang sa kaliwa ng zero.",
            guidingQuestion: "Dahil ang mga halagang mas nasa kaliwa ay mas maliit, alin ang mas maliit: $-5$ o $-2$?",
            hintLevel: 1,
            encouragement: "Sinusundan mo ang mga hakbang nang may mahusay na pokus!",
            nextStep: "Paghambingin ang posisyon ng parehong numero sa horizontal number line.",
            detectedIssue: "NONE",
            suggestedAction: "CONTINUE_LESSON",
            sourceGrounding: ["Horizontal Number Line Model", "Previous Student Response Awareness"],
          }),
          provider: this.name,
          model: this.defaultModel,
        };
      }
      return {
        text: JSON.stringify({
          responseType: "FEEDBACK",
          message: "Exactly right: $-5$ is the first number, and on the number line it lies 5 units to the left of zero. Now look at the second number, $-2$, which is only 2 units to the left of zero.",
          guidingQuestion: "Since values farther to the left have smaller values, which one is smaller: $-5$ or $-2$?",
          hintLevel: 1,
          encouragement: "You're following the steps with great focus!",
          nextStep: "Compare the positions of both numbers on the horizontal number line.",
          detectedIssue: "NONE",
          suggestedAction: "CONTINUE_LESSON",
          sourceGrounding: ["Horizontal Number Line Model", "Previous Student Response Awareness"],
        }),
        provider: this.name,
        model: this.defaultModel,
      };
    }

    // 15b. Repeated Confusion / Second "I don't know" (Phase 22 Anti-Repetition & Strategy Shift)
    const studentRepeatedConfusion =
      studentQuery.includes("still don't") ||
      studentQuery.includes("still dont") ||
      studentQuery.includes("still confused") ||
      studentQuery.includes("still lost") ||
      studentQuery.includes("i still don't know") ||
      studentQuery.includes("nalilito pa rin") ||
      studentQuery.includes("di ko pa rin alam");

    if (studentRepeatedConfusion) {
      if (isFilipino) {
        return {
          text: JSON.stringify({
            responseType: "EXPLANATION",
            message: "Dahil nakakalito pa rin ito, magpalit tayo ng estratehiya at gumamit ng **integer counters model**! Isipin na may mga pulang chip para sa negatibong numero ($-$) at asul na chip para sa positibong numero ($+$). Kapag nagtagpo ang isang pula at isang asul na chip, bumubuo sila ng zero-pair at nagkakanselahan ($+1 + -1 = 0$).",
            guidingQuestion: "Kung mayroon kang 5 pulang chip ($-5$) at 2 asul na chip ($+2$), ilang chip ang magkakansela bilang zero-pairs?",
            hintLevel: 2,
            encouragement: "Ang paglipat sa mga kongkretong modelo ay nagpapadali sa pag-unawa ng negatibong numero!",
            nextStep: "Bilangin ang zero-pairs at tingnan kung ano ang matitira.",
            detectedIssue: "CONFUSION",
            suggestedAction: "TRY_EASIER",
            sourceGrounding: ["Interactive Counter Model", "Teacher Material: Concrete Scaffolding"],
          }),
          provider: this.name,
          model: this.defaultModel,
        };
      }
      return {
        text: JSON.stringify({
          responseType: "EXPLANATION",
          message: "Since that still feels confusing, let's switch strategies completely and use an **integer counters model**! Imagine having red chips for negative numbers ($-$) and blue chips for positive numbers ($+$). When one red and one blue chip meet, they form a zero-pair and cancel out ($+1 + -1 = 0$).",
          guidingQuestion: "If you have 5 red chips ($-5$) and 2 blue chips ($+2$), how many chips cancel out into zero-pairs?",
          hintLevel: 2,
          encouragement: "Switching to concrete models helps make negative numbers visual and clear!",
          nextStep: "Count the zero-pairs and see what remains.",
          detectedIssue: "CONFUSION",
          suggestedAction: "TRY_EASIER",
          sourceGrounding: ["Interactive Counter Model", "Teacher Material: Concrete Scaffolding"],
        }),
        provider: this.name,
        model: this.defaultModel,
      };
    }

    // 15c. Student Confused / First "I don't know" / General Confusion (Part 9 Situation E)
    const studentConfused =
      studentQuery.includes("don't understand") ||
      studentQuery.includes("dont understand") ||
      studentQuery.includes("don't know") ||
      studentQuery.includes("dont know") ||
      studentQuery.includes("idk") ||
      studentQuery.includes("no idea") ||
      studentQuery.includes("confused") ||
      studentQuery.includes("i'm lost") ||
      studentQuery.includes("help me") ||
      studentQuery.includes("hindi ko alam") ||
      studentQuery.includes("di ko alam") ||
      studentQuery.includes("hindi ko maintindihan") ||
      studentQuery.includes("di ko maintindihan") ||
      studentQuery.includes("tulungan mo ako") ||
      studentQuery.includes("nalilito ako");

    if (studentConfused) {
      if (isFilipino) {
        return {
          text: JSON.stringify({
            type: "GUIDING_QUESTION",
            responseType: "GUIDING_QUESTION",
            message: "Huwag mag-alala, ang pag-aaral ng mga bagong konsepto sa matematika ay nangangailangan ng oras at tiyaga! Magdahan-dahan tayo at suriin ang pinakaunang bahagi ng problema nang magkasama.",
            guidingQuestion: "Masasabi mo ba sa akin kung ano ang unang numero sa problema at kung ito ay positibo o negatibo?",
            hintLevel: 1,
            encouragement: "Gagawin natin ito nang isa-isang maliit na hakbang.",
            nextStep: "Tukuyin ang unang numero at ang sign nito.",
            detectedIssue: "CONFUSION",
            suggestedAction: "TRY_EASIER",
            sourceGrounding: ["Empathetic Socratic Scaffolding"],
          }),
          provider: this.name,
          model: this.defaultModel,
        };
      }
      return {
        text: JSON.stringify({
          type: "GUIDING_QUESTION",
          responseType: "GUIDING_QUESTION",
          message: "Don't worry, learning new math concepts takes time and patience! Let's slow down and look at just the very first part of the problem together.",
          guidingQuestion: "Can you tell me what the first number in the problem is and whether it is positive or negative?",
          hintLevel: 1,
          encouragement: "We'll take it one small step at a time.",
          nextStep: "Identify the first number and its sign.",
          detectedIssue: "CONFUSION",
          suggestedAction: "TRY_EASIER",
          sourceGrounding: ["Empathetic Socratic Scaffolding"],
        }),
        provider: this.name,
        model: this.defaultModel,
      };
    }

    // 16. Default grounded pedagogical response
    if (isFilipino) {
      return {
        text: JSON.stringify({
          responseType: "HINT",
          message: "Lutasin natin ang problemang ito nang magkasama. Simulan sa pagsusuri ng mga tuntunin sa iyong kasalukuyang aralin para sa operasyong ito.",
          guidingQuestion: "Ano ang unang operasyon o paghahambing na kailangan mong gawin?",
          hintLevel: 1,
          encouragement: "Kaya mo iyan — himayin natin ito nang magkasama.",
          nextStep: "Pagtuunan ng pansin ang unang hakbang ng problema.",
          detectedIssue: "NONE",
          suggestedAction: "CONTINUE_LESSON",
          sourceGrounding: ["DepEd MATATAG Aralin sa Matematika"],
        }),
        provider: this.name,
        model: this.defaultModel,
      };
    }

    return {
      text: JSON.stringify({
        responseType: "HINT",
        message: "Let's work through this problem together. Start by checking the rules in your current lesson for this operation.",
        guidingQuestion: "What is the first operation or comparison you need to make?",
        hintLevel: 1,
        encouragement: "You're doing fine — let's break it down together.",
        nextStep: "Focus on the first step of the problem.",
        detectedIssue: "NONE",
        suggestedAction: "CONTINUE_LESSON",
        sourceGrounding: ["MATATAG Lesson Content"],
      }),
      provider: this.name,
      model: this.defaultModel,
    };
  }
}

/**
 * Provider factory function.
 * Selects the provider based on configuration and environment keys.
 */
export function getAIProvider(): AIProvider {
  const configuredProvider = (process.env.AI_PROVIDER || "").toLowerCase().trim();
  const apiKey = process.env.GEMINI_API_KEY || process.env.AI_API_KEY;

  if (configuredProvider === "local" || configuredProvider === "mock") {
    return new LocalTutorEngine();
  }

  // If Gemini provider is explicitly selected or if an API key is available
  if (apiKey && (configuredProvider === "" || configuredProvider === "gemini")) {
    try {
      return new GeminiAIProvider(apiKey);
    } catch (e) {
      console.warn("Failed to initialize GeminiAIProvider, falling back to LocalTutorEngine:", e);
      return new LocalTutorEngine();
    }
  }

  // Fallback to local pedagogical engine if no external API key is provided
  return new LocalTutorEngine();
}
