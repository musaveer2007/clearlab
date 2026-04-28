import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// Models to try in order — if the primary is overloaded, fall back
const MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"];
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000; // 1 second initial delay

// Helper: sleep for ms
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Helper: check if an error is retryable (503, 429, etc.)
function isRetryableError(error: any): boolean {
  const message = error?.message || "";
  const status = error?.status || error?.code || error?.httpCode;
  
  if (status === 503 || status === 429) return true;
  if (message.includes("503") || message.includes("UNAVAILABLE")) return true;
  if (message.includes("429") || message.includes("RESOURCE_EXHAUSTED")) return true;
  if (message.includes("high demand")) return true;
  if (message.includes("overloaded")) return true;
  if (message.includes("temporarily")) return true;

  return false;
}

export async function POST(req: Request) {
  try {
    const { message, context } = await req.json();

    if (!message) {
      return NextResponse.json({ error: "No message provided." }, { status: 400 });
    }

    if (!ai) {
      return NextResponse.json({ error: "Server misconfiguration. API Key missing." }, { status: 500 });
    }

    const systemInstruction = `
You are a Medical Glossary Assistant for the ClearLab application.
Your ONLY purpose is to define and explain medical terms or acronyms.
You MUST follow these strict rules:
1. DO NOT provide medical advice, diagnoses, or treatment suggestions under any circumstances.
2. If the user asks about their specific condition or what they should do, politely decline and remind them to consult their doctor.
3. Keep definitions simple, educational, and easy to understand (plain English).
4. Do not panic the user. Use calm language.
5. You may use the provided context to understand what tests the user is looking at, but do not diagnose based on it.
    `;

    // Retry loop with fallback models
    let lastError: any = null;

    for (const model of MODELS) {
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          console.log(`[Chat] Trying model "${model}", attempt ${attempt}/${MAX_RETRIES}`);

          const response = await ai.models.generateContent({
            model,
            contents: [
              {
                role: "user",
                parts: [
                  { text: `Context (if any): ${context || "None"}\n\nUser Question: ${message}` }
                ]
              }
            ],
            config: {
              systemInstruction,
              temperature: 0.1,
            }
          });

          const reply = response.text;
          return NextResponse.json({ reply });

        } catch (error: any) {
          lastError = error;
          console.error(`[Chat] Model "${model}" attempt ${attempt} failed:`, error?.message || error);

          if (isRetryableError(error) && attempt < MAX_RETRIES) {
            const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
            console.log(`[Chat] Retryable error detected. Waiting ${delay}ms before retry...`);
            await sleep(delay);
            continue;
          }

          break;
        }
      }
      console.log(`[Chat] Model "${model}" exhausted all retries. Trying next model...`);
    }

    // All models and retries exhausted
    console.error("[Chat] All models failed after retries:", lastError);

    const userMessage = isRetryableError(lastError)
      ? "Our AI service is busy right now. Please try again in a moment."
      : "An error occurred while getting the definition.";

    return NextResponse.json({ error: userMessage }, { status: 503 });
  } catch (error: any) {
    console.error("Chat API Error:", error);
    return NextResponse.json({ error: "An unexpected error occurred. Please try again." }, { status: 500 });
  }
}
