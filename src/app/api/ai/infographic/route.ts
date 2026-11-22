import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { infographicSchema } from "@/lib/infographic-schema";

export const runtime = "nodejs";
export const maxDuration = 60;

const allowedModels = new Set(["gemini-2.5-flash", "gemini-2.5-pro"]);

export async function POST(request: NextRequest) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "AI generation is not configured yet." }, { status: 503 });
  }

  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    const { sourceText, model = "gemini-2.5-flash", template = "DIGEST" } = body as Record<string, unknown>;
    if (typeof sourceText !== "string" || sourceText.trim().length < 10 || sourceText.length > 15000) {
      return NextResponse.json({ error: "Source text must be between 10 and 15,000 characters." }, { status: 400 });
    }
    if (typeof model !== "string" || !allowedModels.has(model)) {
      return NextResponse.json({ error: "Unsupported model selection." }, { status: 400 });
    }
    const selectedTemplate = ["KPI_STACK", "PROCESS_FLOW", "COMPARISON", "DIGEST"].includes(String(template)) ? String(template) : "DIGEST";
    const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const generativeModel = client.getGenerativeModel({
      model,
      generationConfig: { responseMimeType: "application/json" }
    });
    const result = await generativeModel.generateContent([
      "You are InfoCraft's editorial data director. Turn the source into a factual, clear infographic structure. Do not invent facts or metrics; use an em dash when no defensible metric is present. Return only JSON with keys: title, subtitle, kickerTag, recommendedTemplate, heroStatValue, heroStatLabel, heroStatDelta, takeawayQuote, sections. Each section: indexLabel, heading, summary, metricValue, metricUnit, barRatio. Make 3-6 sections. Preserve uncertainty and dates. Preferred template: " + selectedTemplate + ".",
      sourceText.trim()
    ]);
    const raw = result.response.text();
    const parsed = infographicSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      return NextResponse.json({ error: "The AI response did not match the expected infographic format." }, { status: 502 });
    }
    return NextResponse.json({ project: parsed.data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown generation error";
    return NextResponse.json({ error: "Generation failed. Check model availability and server logs.", detail: message.slice(0, 300) }, { status: 502 });
  }
}
