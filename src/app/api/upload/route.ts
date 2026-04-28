import { NextResponse } from "next/server";
import OpenAI from "openai";
import pdfParse from "pdf-parse";

// Check if API key is provided
const apiKey = process.env.OPENAI_API_KEY;
const openai = apiKey ? new OpenAI({ apiKey }) : null;

// Use gpt-4o-mini as the default model
const MODEL = "gpt-4o-mini";

// Helper: check if an error is retryable (503, 429, etc.)
function isRetryableError(error: any): boolean {
  const status = error?.status;
  if (status === 429 || status === 503 || status === 502 || status === 500) return true;
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

    if (!openai) {
      return NextResponse.json({ 
        error: "Server configuration missing (OPENAI_API_KEY). Please set this environment variable." 
      }, { status: 500 });
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let parsedText = "";
    const isPDF = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

    if (isPDF) {
      // Use pdf-parse to extract text from the PDF buffer
      try {
        const pdfData = await pdfParse(buffer);
        parsedText = pdfData.text;
      } catch (e) {
        console.error("PDF Parsing Error:", e);
        return NextResponse.json({ error: "Failed to read the PDF file. It might be encrypted or corrupted." }, { status: 400 });
      }
    }

    const systemInstruction = `
You are the intelligence behind ClearLab, an educational tool that helps patients understand their lab reports. 
You are NOT a doctor. You MUST NOT provide medical diagnoses or suggest medications/dosages.
Your goal is to parse and analyze the provided medical lab report text or image and return it in a structured JSON format.

MANDATORY RULES:
1. Translate medical jargon into simple, plain ${language}.
2. For each test value, explain what it measures in ${language}.
3. Categorize risk strictly as: Green (Normal), Yellow (Watch/Slightly abnormal), Red (Discuss soon/Significantly abnormal).
4. Do NOT use panic-inducing language (e.g. avoid "dangerous", "disease", "failure"). Instead use "slightly outside the usual range", "may happen due to common reasons".
5. Provide a friendly overall summary in ${language}.
6. Generate questions the patient can ask their doctor in ${language}.
    `;

    console.log(`[Upload] Sending request to OpenAI using ${MODEL}`);

    let messages: any[] = [
      { role: "system", content: systemInstruction }
    ];

    if (isPDF) {
      messages.push({
        role: "user",
        content: `Here is the text extracted from the lab report. Please analyze it and translate the explanations into ${language}.\n\n--- REPORT TEXT ---\n${parsedText}`
      });
    } else {
      // It's an image, send as base64
      const base64Image = buffer.toString('base64');
      const mimeType = file.type || "image/jpeg";
      messages.push({
        role: "user",
        content: [
          { type: "text", text: `Here is the lab report image. Please analyze it and translate the explanations into ${language}.` },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } }
        ]
      });
    }

    // Call OpenAI
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages,
      temperature: 0.2,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "lab_report_schema",
          strict: true,
          schema: {
            type: "object",
            properties: {
              summary: {
                type: "string",
                description: "A friendly, plain-English summary of the overall lab report. Do not provide medical advice or diagnosis."
              },
              results: {
                type: "array",
                description: "List of individual lab test results found in the report.",
                items: {
                  type: "object",
                  properties: {
                    testName: { type: "string", description: "Name of the test (e.g., eGFR, Hemoglobin)" },
                    value: { type: "string", description: "The patient's result value" },
                    unit: { type: "string", description: "Unit of measurement (e.g., mg/dL)" },
                    referenceRange: { type: "string", description: "The normal reference range" },
                    riskLevel: {
                      type: "string",
                      enum: ["Green", "Yellow", "Red"],
                      description: "Green if normal. Yellow if slightly outside normal or watch carefully. Red if significantly abnormal or requires discussion soon."
                    },
                    explanation: {
                      type: "string",
                      description: "Plain-English explanation of what this test measures and what the value might generally indicate. Do NOT diagnose. Use cautious language ('may indicate', 'could suggest')."
                    }
                  },
                  required: ["testName", "value", "unit", "referenceRange", "riskLevel", "explanation"],
                  additionalProperties: false
                }
              },
              doctorQuestions: {
                type: "array",
                description: "3-5 suggested questions for the patient to ask their doctor based on abnormal or notable results.",
                items: { type: "string" }
              }
            },
            required: ["summary", "results", "doctorQuestions"],
            additionalProperties: false
          }
        }
      }
    });

    const outputText = response.choices[0]?.message?.content;
    if (!outputText) {
      throw new Error("No response generated from AI.");
    }

    // Parse the JSON response
    const parsedData = JSON.parse(outputText);
    return NextResponse.json({ success: true, data: parsedData });

  } catch (error: any) {
    console.error("Upload API Error:", error);
    
    const userMessage = isRetryableError(error)
      ? "Our AI service is experiencing high demand right now. Please wait a moment and try again."
      : error?.message || "An error occurred while processing your request.";

    return NextResponse.json(
      { error: userMessage },
      { status: error?.status >= 500 ? 503 : 500 }
    );
  }
}
