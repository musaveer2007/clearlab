import { NextResponse } from "next/server";
import { GoogleGenAI, Type, Schema } from "@google/genai";
// Check if API key is provided
const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// Models to try in order — using gemini-1.5-flash as it is the most stable, reliable, and has the best free tier.
const MODELS = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash"];
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1500; // 1.5 second initial delay

// Define the expected output schema for the LLM
const LabResultSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.STRING,
      description: "A friendly, plain-English summary of the overall lab report (e.g., 'Most values are within normal range. A few items may need discussion.'). Do not provide medical advice or diagnosis.",
    },
    results: {
      type: Type.ARRAY,
      description: "List of individual lab test results found in the report.",
      items: {
        type: Type.OBJECT,
        properties: {
          testName: { type: Type.STRING, description: "Name of the test (e.g., eGFR, Hemoglobin)" },
          value: { type: Type.STRING, description: "The patient's result value" },
          unit: { type: Type.STRING, description: "Unit of measurement (e.g., mg/dL)" },
          referenceRange: { type: Type.STRING, description: "The normal reference range" },
          riskLevel: {
            type: Type.STRING,
            enum: ["Green", "Yellow", "Red"],
            description: "Green if normal. Yellow if slightly outside normal or watch carefully. Red if significantly abnormal or requires discussion soon.",
          },
          explanation: {
            type: Type.STRING,
            description: "Plain-English explanation of what this test measures and what the value might generally indicate (e.g. 'Your kidney filtration is slightly lower than typical...'). Do NOT diagnose. Use cautious language ('may indicate', 'could suggest').",
          },
        },
        required: ["testName", "value", "riskLevel", "explanation"],
      },
    },
    doctorQuestions: {
      type: Type.ARRAY,
      description: "3-5 suggested questions for the patient to ask their doctor based on abnormal or notable results.",
      items: { type: Type.STRING },
    },
  },
  required: ["summary", "results", "doctorQuestions"],
};

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
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const language = formData.get("language") as string || "English";

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (!ai) {
      return NextResponse.json({ 
        error: "Server configuration missing (GEMINI_API_KEY). Please set this environment variable." 
      }, { status: 500 });
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Call Gemini to analyze the document (PDF or Image) natively
    const systemInstruction = `
You are the intelligence behind ClearLab, an educational tool that helps patients understand their lab reports. 
You are NOT a doctor. You MUST NOT provide medical diagnoses or suggest medications/dosages.
Your goal is to visually parse and analyze the provided medical lab report (image or PDF) and return it in a structured format.

MANDATORY RULES:
1. Translate medical jargon into simple, plain ${language}.
2. For each test value, explain what it measures in ${language}.
3. Categorize risk strictly as: Green (Normal), Yellow (Watch/Slightly abnormal), Red (Discuss soon/Significantly abnormal). The riskLevel value itself MUST remain exactly "Green", "Yellow", or "Red" to match the schema enum, but the explanation should be in ${language}.
4. Do NOT use panic-inducing language (e.g. avoid "dangerous", "disease", "failure"). Instead use "slightly outside the usual range", "may happen due to common reasons".
5. Provide a friendly overall summary in ${language}.
6. Generate questions the patient can ask their doctor in ${language}.
    `;

    // Retry loop with fallback models
    let lastError: any = null;

    for (const model of MODELS) {
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          console.log(`[Upload] Trying model "${model}", attempt ${attempt}/${MAX_RETRIES}`);

          const response = await ai.models.generateContent({
            model,
            contents: [
              { 
                role: "user", 
                parts: [
                  { text: `Here is the lab report. Please analyze it and translate the explanations into ${language}.` },
                  {
                    inlineData: {
                      data: buffer.toString("base64"),
                      mimeType: file.type || "application/pdf"
                    }
                  }
                ] 
              }
            ],
            config: {
              systemInstruction,
              responseMimeType: "application/json",
              responseSchema: LabResultSchema,
              temperature: 0.2,
            }
          });

          const outputText = response.text;
          if (!outputText) {
            throw new Error("No response generated from AI.");
          }

          // Parse the JSON response
          const parsedData = JSON.parse(outputText);
          return NextResponse.json({ success: true, data: parsedData });

        } catch (error: any) {
          lastError = error;
          console.error(`[Upload] Model "${model}" attempt ${attempt} failed:`, error?.message || error);

          if (isRetryableError(error) && attempt < MAX_RETRIES) {
            const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1); // 1.5s, 3s, 6s
            console.log(`[Upload] Retryable error detected. Waiting ${delay}ms before retry...`);
            await sleep(delay);
            continue;
          }

          // If not retryable, or final attempt for this model — break to try next model
          break;
        }
      }
      // If we reach here, the current model exhausted retries — try the next model
      console.log(`[Upload] Model "${model}" exhausted all retries. Trying next model...`);
    }

    // All models and retries exhausted
    console.error("[Upload] All models failed after retries:", lastError);
    
    const userMessage = isRetryableError(lastError)
      ? "Our AI service is experiencing high demand right now. Please wait a moment and try again."
      : lastError?.message || "An error occurred while processing your request.";

    return NextResponse.json(
      { error: userMessage },
      { status: 503 }
    );

  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
