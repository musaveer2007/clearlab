import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

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

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
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
        temperature: 0.1, // very low temperature for strict definitions
      }
    });

    const reply = response.text;
    
    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error("Chat API Error:", error);
    return NextResponse.json({ error: "An error occurred while getting the definition." }, { status: 500 });
  }
}
