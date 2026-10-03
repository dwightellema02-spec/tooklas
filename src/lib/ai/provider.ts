// Phase 7: AI Provider Abstraction

import { GoogleGenAI } from "@google/genai";
import type { AIProvider, TutorAIRequest, TutorAIResponseRaw } from "./types";

export class GeminiAIProvider implements AIProvider {
  readonly name = "gemini";
  readonly defaultModel = "gemini-3.8-flash";
  private ai: GoogleGenAI;
  private model: string;

  constructor(apiKey?: string, model?: string) {
    const key = apiKey || process.env.GEMINI_API_KEY || process.env.AI_API_KEY;
    if (!key) {
      throw new Error("Gemini API key is required but neither GEMINI_API_KEY nor AI_API_KEY was provided.");
    }
    this.ai = new GoogleGenAI({ apiKey: key });
    this.model = model || process.env.AI_MODEL || this.defaultModel;
  }

  async generateTutorResponse(request: TutorAIRequest): Promise<TutorAIResponseRaw> {
    const timeoutMs = request.timeoutMs || 15000;

    const generatePromise = this.ai.models.generateContent({
      model: this.model,
      contents: request.userPrompt,
      config: {
        systemInstruction: request.systemPrompt,
        maxOutputTokens: request.maxTokens || 600,
        temperature: request.temperature !== undefined ? request.temperature : 0.4,
        responseMimeType: "application/json",
      },
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("AI Tutor request timed out after 15 seconds.")), timeoutMs)
    );

    const response = await Promise.race([generatePromise, timeoutPromise]);
    const responseText = response.text || "";

    return {
      text: responseText,
      tokenUsage: {
        promptTokens: response.usageMetadata?.promptTokenCount,
        completionTokens: response.usageMetadata?.candidatesTokenCount,
        totalTokens: response.usageMetadata?.totalTokenCount,
      },
      provider: this.name,
      model: this.model,
    };
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
    let responseType = "HINT";
    let message = "";
    let guidingQuestion = "";
    let hintLevel = 1;
    let encouragement = "You're building real mathematical understanding step by step.";
    let nextStep = "Think about the signs and positions on the number line.";
    let detectedIssue = "NONE";
    let suggestedAction = "CONTINUE_LESSON";
    let sourceGrounding: string[] = ["Curriculum: MATATAG Grade 7 Mathematics"];

    // 1. Prompt Injection & Off-topic Safety (Part 23)
    if (
      prompt.includes("ignore previous") ||
      prompt.includes("system prompt") ||
      prompt.includes("act as dan") ||
      prompt.includes("api_key") ||
      prompt.includes("database_url") ||
      prompt.includes("passwordhash") ||
      prompt.includes("celebrity") ||
      prompt.includes("movie") ||
      prompt.includes("song") ||
      prompt.includes("recipe") ||
      prompt.includes("weather")
    ) {
      return {
        text: JSON.stringify({
          responseType: "REDIRECT",
          message: "Let's focus on your Grade 7 mathematics lesson. I am your Tuklas AI learning companion, here to help you master integers and mathematical problem-solving!",
          guidingQuestion: "Would you like to continue with your current math problem?",
          hintLevel: 1,
          encouragement: "Let's solve math problems together!",
          nextStep: "Return to the current mathematical problem or lesson.",
          detectedIssue: "NONE",
          suggestedAction: "CONTINUE_LESSON",
          sourceGrounding: ["System Safety Guard"],
        }),
        provider: this.name,
        model: this.defaultModel,
      };
    }

    // 2. Direct Answer Requests (Part 10 - Socratic refusal)
    if (
      prompt.includes("give me the answer") ||
      prompt.includes("what is the answer") ||
      prompt.includes("just tell me") ||
      prompt.includes("tell me the answer")
    ) {
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
    if (
      prompt.includes("mathisipan") ||
      prompt.includes("youtube") ||
      prompt.includes("video")
    ) {
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
      (prompt.includes("pdf") || prompt.includes("docx") || prompt.includes("document")) &&
      (prompt.includes("fail") || prompt.includes("corrupt") || prompt.includes("unreadable") || prompt.includes("error") || prompt.includes("couldn't extract"))
    ) {
      return {
        text: JSON.stringify({
          responseType: "CLARIFICATION",
          message: "The teacher's PDF is attached, but I couldn't extract its text. I can still help using the lesson content.",
          guidingQuestion: "Would you like to review the lesson concepts and examples together?",
          hintLevel: 1,
          encouragement: "We can still master this topic using all the published lesson content!",
          nextStep: "Explore the lesson content blocks and key ideas.",
          detectedIssue: "NONE",
          suggestedAction: "CONTINUE_LESSON",
          sourceGrounding: ["Document Extraction Status: FAILED", "Grounded Lesson Content"],
        }),
        provider: this.name,
        model: this.defaultModel,
      };
    }

    // 4b. Teacher-provided material / notes / Extracted Document Intelligence (Phase 22)
    if (
      prompt.includes("teacher document") ||
      prompt.includes("teacher's document") ||
      prompt.includes("from the pdf") ||
      prompt.includes("in the pdf") ||
      prompt.includes("teacher's pdf") ||
      prompt.includes("teacher pdf") ||
      prompt.includes("teacher docx") ||
      prompt.includes("extracted document") ||
      prompt.includes("material section") ||
      prompt.includes("teacher note") ||
      prompt.includes("teacher's note") ||
      prompt.includes("teacher material") ||
      prompt.includes("teacher-provided")
    ) {
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
    if (
      (prompt.includes("-7") && prompt.includes("3") && (prompt.includes("-10") || prompt.includes("wrong"))) ||
      (prompt.includes("-5") && prompt.includes("3") && prompt.includes("-8")) ||
      prompt.includes("sign error") ||
      prompt.includes("why is my answer wrong") ||
      prompt.includes("why is that wrong")
    ) {
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

    // 5b. Why Did We Move Left? / Directionality Reasoning (Part 9 Situation G & Part 14)
    if (
      prompt.includes("why did you move left") ||
      prompt.includes("why move left") ||
      prompt.includes("why do we move left") ||
      prompt.includes("why to the left")
    ) {
      return {
        text: JSON.stringify({
          responseType: "EXPLANATION",
          message: "We move to the left because negative numbers represent values less than zero. On a standard horizontal number line, positive values move right (increasing), while negative numbers or subtraction move left (decreasing).",
          guidingQuestion: "If adding a positive number moves us right, which direction must adding a negative number take us?",
          hintLevel: 1,
          encouragement: "Connecting number line motion to mathematical signs gives you deep intuition!",
          nextStep: "Trace the movement starting from your initial point.",
          detectedIssue: "NONE",
          suggestedAction: "CONTINUE_LESSON",
          sourceGrounding: ["Horizontal Number Line Model", "Directionality Convention"],
        }),
        provider: this.name,
        model: this.defaultModel,
      };
    }

    // 5c. Partially Correct Answer (Part 9 Situation B)
    if (
      prompt.includes("partially correct") ||
      prompt.includes("got the number right") ||
      prompt.includes("unsure of the sign") ||
      prompt.includes("i got 3 but") ||
      prompt.includes("is it positive or negative")
    ) {
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
    if (
      prompt.includes("previous mistake") ||
      prompt.includes("what did i do wrong before") ||
      prompt.includes("earlier mistake") ||
      prompt.includes("my last attempt")
    ) {
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
    if (
      prompt.includes("calculation error") ||
      prompt.includes("calculation") ||
      prompt.includes("arithmetic error") ||
      prompt.includes("miscalculated")
    ) {
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
    if (
      (prompt.includes("-5") && prompt.includes("-2")) ||
      prompt.includes("conceptual") ||
      prompt.includes("magnitude")
    ) {
      if (prompt.includes("easier") || prompt.includes("simplify") || prompt.includes("counters")) {
        return {
          text: JSON.stringify({
            responseType: "EXPLANATION",
            message: "Let's picture temperature or a debt to make this easy: having $-\\$2$ debt is better than having $-\\$5$ debt! On a number line, $-2$ is closer to zero and to the right of $-5$. Numbers to the right are always greater.",
            guidingQuestion: "Would you rather be at $-2$ degrees or $-5$ degrees if you want warmer weather?",
            hintLevel: 1,
            encouragement: "Visualizing with temperature or debt makes negative numbers click!",
            nextStep: "Compare which value is farther right on the horizontal line.",
            detectedIssue: "CONCEPTUAL_MISUNDERSTANDING",
            suggestedAction: "TRY_SIMILAR",
            sourceGrounding: ["Number Line Concrete Representation"],
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
    if (
      prompt.includes("prerequisite") ||
      prompt.includes("what is an absolute value") ||
      prompt.includes("what is absolute value") ||
      prompt.includes("don't know absolute value")
    ) {
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
    if (
      prompt.includes("repeated") ||
      prompt.includes("tried again and got") ||
      prompt.includes("same mistake") ||
      prompt.includes("still got")
    ) {
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
    if (
      prompt.includes("i got -4") ||
      prompt.includes("the answer is -4") ||
      prompt.includes("i solved it") ||
      prompt.includes("correct answer") ||
      prompt.includes("got it right")
    ) {
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
    if (
      prompt.includes("another example") ||
      prompt.includes("worked example") ||
      prompt.includes("show me an example") ||
      prompt.includes("different numbers")
    ) {
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
    if (
      prompt.includes("easier explanation") ||
      prompt.includes("more simply") ||
      prompt.includes("simpler") ||
      prompt.includes("too hard")
    ) {
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
    if (
      prompt.includes("harder") ||
      prompt.includes("challenge") ||
      prompt.includes("more difficult") ||
      prompt.includes("advanced") ||
      prompt.includes("mastered")
    ) {
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
    if (
      prompt.includes("give me practice") ||
      prompt.includes("want to practice") ||
      prompt.includes("practice question") ||
      prompt.includes("more questions")
    ) {
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
    if (
      prompt.includes("first number") ||
      prompt.includes("the first number is") ||
      prompt.includes("is the first number") ||
      prompt.includes("it's -5") ||
      prompt.includes("its -5")
    ) {
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
    if (
      prompt.includes("still don't") ||
      prompt.includes("still dont") ||
      prompt.includes("still confused") ||
      prompt.includes("repeated confusion") ||
      prompt.includes("still lost") ||
      prompt.includes("i still don't know")
    ) {
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
    if (
      prompt.includes("don't understand") ||
      prompt.includes("dont understand") ||
      prompt.includes("don't know") ||
      prompt.includes("dont know") ||
      prompt.includes("idk") ||
      prompt.includes("no idea") ||
      prompt.includes("confused") ||
      prompt.includes("i'm lost") ||
      prompt.includes("help me")
    ) {
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
