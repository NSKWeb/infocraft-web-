import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "nodejs";
export const maxDuration = 45;

export async function POST(request: NextRequest) {
  const rateLimitResponse = await enforceRateLimit(request, { key: "ai-director", limit: 20, windowMs: 60_000 });
  if (rateLimitResponse) return rateLimitResponse;
  if (!process.env.GEMINI_API_KEY) return NextResponse.json({ error: "AI is not configured. Add GEMINI_API_KEY on the server." }, { status: 503 });
  try {
    const body = await request.json() as { message?: string; project?: { title?: string; subtitle?: string; templateType?: string; sections?: Array<{ heading?: string; summary?: string }> }; history?: Array<{ role: string; text: string }> };
    const message = body.message?.trim();
    if (!message || message.length > 4000) return NextResponse.json({ error: "Message must be between 1 and 4,000 characters." }, { status: 400 });
    const project = body.project ?? {};
    const history = (body.history ?? []).slice(-8).map(item => ({ role: item.role === "assistant" ? "model" : "user", parts: [{ text: String(item.text).slice(0, 3000) }] }));
    const model = new GoogleGenerativeAI(process.env.GEMINI_API_KEY).getGenerativeModel({ model: "gemini-2.5-flash" });
    const chat = model.startChat({ history });
    const result = await chat.sendMessage("You are InfoCraft's practical editorial art director. Give specific, concise advice about hierarchy, factual clarity, typography, layout and copy. Never invent facts. Current project: " + JSON.stringify(project).slice(0, 7000) + "\nUser request: " + message);
    return NextResponse.json({ reply: result.response.text() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message.slice(0, 240) : "Art Director request failed." }, { status: 502 });
  }
}
