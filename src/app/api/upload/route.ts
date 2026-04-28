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

// Exponential backoff helper
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function callGroqWithRetry(options: any, maxRetries = 3) {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      if (!groq) throw new Error("Groq client not initialized");
      return await groq.chat.completions.create(options);
    } catch (error: any) {
      lastError = error;
      if (isRetryableError(error) && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
        console.warn(`[Upload] Groq API error (${error.status}). Retrying in ${Math.round(delay)}ms... (Attempt ${i + 1}/${maxRetries})`);
        await sleep(delay);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

export async function POST(req: Request) {
  try {
    console.log("[Upload] Received upload request");
    
    if (!apiKey) {
      console.error("[Upload] CRITICAL: GROQ_API_KEY is missing from environment variables");
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const language = formData.get("language") as string || "English";
    const pdfText = formData.get("pdfText") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (!groq) {
      return NextResponse.json({ 
        error: "Server configuration missing (GROQ_API_KEY). Please contact support or check environment variables." 
      }, { status: 500 });
    }

    const isPDF = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    console.log(`[Upload] Processing ${isPDF ? "PDF" : "Image"}: ${file.name} (${file.type})`);

    let parsedText = "";
    let buffer: Buffer | null = null;

    if (isPDF) {
      parsedText = pdfText || "";
      if (parsedText.trim().length < 10) {
        return NextResponse.json({ 
          error: "The PDF contains no readable text. Please try uploading a screenshot instead." 
        }, { status: 400 });
      }
    } else {
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    }

    // Model selection
    const MODEL = isPDF ? "llama-3.3-70b-versatile" : "llama-3.2-11b-vision-preview";
    console.log(`[Upload] Using model: ${MODEL}`);

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

    let messages: any[] = [{ role: "system", content: systemInstruction }];

    if (isPDF) {
      messages.push({
        role: "user",
        content: `Analyze this report text and translate into ${language}:\n\n${parsedText}`
      });
    } else {
      const base64Image = buffer!.toString('base64');
      const mimeType = file.type || "image/jpeg";
      messages.push({
        role: "user",
        content: [
          { type: "text", text: `Analyze this lab report image and translate into ${language}.` },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } }
        ]
      });
    }

    let requestOptions: any = {
      model: MODEL,
      messages,
      temperature: 0.1,
    };

    if (isPDF) {
      requestOptions.response_format = { type: "json_object" };
    }

    console.log(`[Upload] Calling Groq API...`);
    const response = await callGroqWithRetry(requestOptions, 4);
    console.log(`[Upload] Groq API call successful`);

    const outputText = response.choices[0]?.message?.content;
    if (!outputText) {
      throw new Error("The AI service returned an empty response.");
    }

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
      console.error("[Upload] JSON Parse Error:", outputText);
      throw new Error("The AI returned an invalid format. Please try again.");
    }

    return NextResponse.json({ success: true, data: parsedData });

  } catch (error: any) {
    console.error("[Upload] API Error Details:", {
      status: error?.status,
      message: error?.message,
      name: error?.name,
      code: error?.code
    });
    
    let userMessage = error?.message || "An unexpected error occurred.";
    if (isRetryableError(error)) {
      userMessage = "The AI service is currently overloaded. Please wait 10-20 seconds and try again.";
    } else if (error?.status === 401) {
      userMessage = "Invalid API Key. Please check your GROQ_API_KEY environment variable.";
    }

    return NextResponse.json(
      { error: userMessage },
      { status: error?.status || 500 }
    );
  }
}
