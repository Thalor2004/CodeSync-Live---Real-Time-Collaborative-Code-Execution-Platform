import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

const client = new Groq({
  apiKey: process.env.GROQ_API_KEY!,
});

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();

    const response = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",  // ✅ Your available model
      messages: [
        {
          role: "system",
          content: "You are an expert programming tutor. Analyze, debug, and explain code clearly."
        },
        {
          role: "user",
          content: `Here is some code:\n\n${code}\n\nExplain what it does, find bugs, and suggest improvements.`
        }
      ],
      max_tokens: 800,
    });

    const text = response.choices?.[0]?.message?.content || "No AI response.";

    return NextResponse.json({ suggestions: text });

  } catch (error: any) {
    console.error("Groq AI Error:", error?.response?.data || error);
    return NextResponse.json(
      { suggestions: "AI Error: " + (error?.response?.data?.error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}
