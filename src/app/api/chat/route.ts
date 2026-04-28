import { NextResponse } from "next/server";
import OpenAI from "openai";

// Initialize OpenAI client
const apiKey = process.env.OPENAI_API_KEY;
const openai = apiKey ? new OpenAI({ apiKey }) : null;

// Use gpt-4o-mini as the default model
const MODEL = "gpt-4o-mini";

export async function POST(req: Request) {
  try {
    const { message, context } = await req.json();

    if (!message) {
      return NextResponse.json({ error: "No message provided." }, { status: 400 });
    }

    if (!openai) {
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

    console.log(`[Chat] Trying OpenAI model "${MODEL}"`);

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: `Context (if any): ${context || "None"}\n\nUser Question: ${message}` }
      ],
      temperature: 0.1,
    });

    const reply = response.choices[0]?.message?.content || "";
    
    return NextResponse.json({ reply });

  } catch (error: any) {
    console.error("Chat API Error:", error);
    
    const message = error?.message || "";
    const status = error?.status || 500;
    
    const userMessage = (status === 429 || status === 503) 
      ? "Our AI service is busy right now. Please try again in a moment."
      : "An error occurred while getting the definition.";

    return NextResponse.json({ error: userMessage }, { status: status >= 500 ? 503 : 500 });
  }
}
