import { NextRequest, NextResponse } from "next/server";
import { infographicSchema } from "@/lib/infographic-schema";

export const runtime = "nodejs";
export const maxDuration = 60;

const allowedModels = new Set(["gemini-2.5-flash", "gemini-2.5-pro"]);
type GeminiPart = { text?: string; inline_data?: { mime_type: string; data: string } };
type GeminiResponse = { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; groundingMetadata?: { groundingChunks?: Array<{ web?: { uri?: string; title?: string } }> } }>; error?: { message?: string } };

export async function POST(request: NextRequest) {
  if (!process.env.GEMINI_API_KEY) return NextResponse.json({ error: "AI generation is not configured. Add GEMINI_API_KEY on the server." }, { status: 503 });
  try {
    const body = await request.json() as { sourceText?: string; model?: string; template?: string; imageBase64?: string; imageMimeType?: string; searchGrounded?: boolean; language?: string };
    const sourceText = body.sourceText?.trim() ?? "";
    const imageBase64 = body.imageBase64 ?? "";
    if (sourceText.length > 15000 || (sourceText.length < 10 && !imageBase64)) return NextResponse.json({ error: "Provide 10–15,000 characters of text or an image." }, { status: 400 });
    if (imageBase64 && (imageBase64.length > 12_000_000 || !["image/jpeg", "image/png", "image/webp"].includes(body.imageMimeType ?? ""))) return NextResponse.json({ error: "Use a JPG, PNG or WebP image under 9 MB." }, { status: 400 });
    const model = body.model ?? "gemini-2.5-flash";
    if (!allowedModels.has(model)) return NextResponse.json({ error: "Unsupported model selection." }, { status: 400 });
    const template = ["KPI_STACK", "PROCESS_FLOW", "COMPARISON", "DIGEST"].includes(body.template ?? "") ? body.template : "DIGEST";
    const prompt = "You are InfoCraft's editorial data director. Create a factual infographic structure from the provided source. Never invent facts, dates or metrics; use an em dash when no defensible metric exists. Return JSON with title, subtitle, kickerTag, recommendedTemplate, heroStatValue, heroStatLabel, heroStatDelta, takeawayQuote and 3-6 sections. Each section has indexLabel, heading, summary, metricValue, metricUnit and barRatio (0 to 1). Preserve uncertainty. Preferred template: " + template + ". Output language: " + (body.language || "same language as source") + ".";
    const parts: GeminiPart[] = [{ text: prompt + (sourceText ? "\nSOURCE TEXT:\n" + sourceText : "\nAnalyze the attached image and extract only visible, supportable information.") }];
    if (imageBase64) parts.push({ inline_data: { mime_type: body.imageMimeType!, data: imageBase64 } });
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + encodeURIComponent(process.env.GEMINI_API_KEY), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: "application/json" }, ...(body.searchGrounded ? { tools: [{ google_search: {} }] } : {}) }),
      signal: AbortSignal.timeout(55000)
    });
    const payload = await response.json() as GeminiResponse;
    if (!response.ok) return NextResponse.json({ error: payload.error?.message ?? "Gemini generation failed." }, { status: 502 });
    const raw = payload.candidates?.[0]?.content?.parts?.map(part => part.text ?? "").join("") ?? "";
    let parsedJson: unknown;
    try { parsedJson = JSON.parse(raw); } catch { return NextResponse.json({ error: "The AI response was not valid JSON. Please retry." }, { status: 502 }); }
    const parsed = infographicSchema.safeParse(parsedJson);
    if (!parsed.success) return NextResponse.json({ error: "The AI response did not match the expected infographic format." }, { status: 502 });
    const citations = (payload.candidates?.[0]?.groundingMetadata?.groundingChunks ?? []).flatMap(chunk => chunk.web?.uri ? [{ title: chunk.web.title ?? chunk.web.uri, uri: chunk.web.uri }] : []);
    return NextResponse.json({ project: parsed.data, citations });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message.slice(0, 260) : "Generation failed." }, { status: 502 });
  }
}
