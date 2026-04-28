import { NextResponse } from "next/server";
import Groq from "groq-sdk";

// Check if API key is provided
const apiKey = process.env.GROQ_API_KEY;
const groq = apiKey ? new Groq({ apiKey }) : null;

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
    // Pre-extracted PDF text from the client (browser-side pdf.js)
    const pdfText = formData.get("pdfText") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (!groq) {
      return NextResponse.json({ 
        error: "Server configuration missing (GROQ_API_KEY). Please set this environment variable." 
      }, { status: 500 });
    }

    const isPDF = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

    // For PDFs: use pre-extracted text from the client
    // For images: read the buffer and send as base64 to vision model
    let parsedText = "";
    let buffer: Buffer | null = null;

    if (isPDF) {
      // Use client-extracted text
      parsedText = pdfText || "";

      if (parsedText.trim().length < 10) {
        return NextResponse.json({ 
          error: "The PDF appears to be a scanned image or contains no readable text. Please take a screenshot and upload it as an image (JPG/PNG) instead." 
        }, { status: 400 });
      }
    } else {
      // It's an image — read it into a buffer for base64 encoding
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    }

    // Determine the right model (vision for images, text for PDFs)
    const MODEL = isPDF ? "llama-3.3-70b-versatile" : "llama-3.2-90b-vision-preview";

    const systemInstruction = `
You are the intelligence behind ClearLab, an educational tool that helps patients understand their lab reports. 
You are NOT a doctor. You MUST NOT provide medical diagnoses or suggest medications/dosages.
Your goal is to parse and analyze the provided medical lab report text or image and return it ONLY as a raw JSON object.

MANDATORY RULES:
1. Translate medical jargon into simple, plain ${language}.
2. For each test value, explain what it measures in ${language}.
3. Categorize risk strictly as: Green (Normal), Yellow (Watch/Slightly abnormal), Red (Discuss soon/Significantly abnormal).
4. Do NOT use panic-inducing language (e.g. avoid "dangerous", "disease", "failure"). Instead use "slightly outside the usual range", "may happen due to common reasons".
5. Provide a friendly overall summary in ${language}.
6. Generate questions the patient can ask their doctor in ${language}.

YOU MUST RETURN EXACTLY THIS JSON STRUCTURE:
{
  "summary": "Your friendly summary in ${language}...",
  "results": [
    {
      "testName": "eGFR",
      "value": "58",
      "unit": "mL/min",
      "referenceRange": ">60",
      "riskLevel": "Yellow",
      "explanation": "Your kidney filtration is slightly lower than typical..."
    }
  ],
  "doctorQuestions": [
    "Should I repeat this test?",
    "Is this temporary or chronic?"
  ]
}
    `;

    console.log(`[Upload] Sending request to Groq using ${MODEL}`);

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
      const base64Image = buffer!.toString('base64');
      const mimeType = file.type || "image/jpeg";
      messages.push({
        role: "user",
        content: [
          { type: "text", text: `Here is the lab report image. Please analyze it and translate the explanations into ${language}.` },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } }
        ]
      });
    }

    let requestOptions: any = {
      model: MODEL,
      messages,
      temperature: 0.1,
    };

    // Groq's vision models currently do not support json_object response format
    if (isPDF) {
      requestOptions.response_format = { type: "json_object" };
    }

    // Call Groq
    const response = await groq.chat.completions.create(requestOptions);

    const outputText = response.choices[0]?.message?.content;
    if (!outputText) {
      throw new Error("No response generated from AI.");
    }

    // Parse the JSON response robustly
    let parsedData;
    try {
      const startIndex = outputText.indexOf('{');
      const endIndex = outputText.lastIndexOf('}');
      if (startIndex !== -1 && endIndex !== -1) {
        const jsonString = outputText.slice(startIndex, endIndex + 1);
        parsedData = JSON.parse(jsonString);
      } else {
        parsedData = JSON.parse(outputText);
      }
    } catch (parseError) {
      console.error("Failed to parse JSON:", outputText);
      throw new Error("The AI returned an invalid format. Please try again.");
    }

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
