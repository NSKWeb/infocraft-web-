import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  if (!process.env.GEMINI_API_KEY) return NextResponse.json({ error: "Poster generation needs GEMINI_API_KEY on the server." }, { status: 503 });
  try {
    const { prompt, ratio = "4:5", resolution = "2K" } = await request.json() as { prompt?: string; ratio?: string; resolution?: string };
    if (!prompt?.trim() || prompt.length > 2500) return NextResponse.json({ error: "Add a poster brief (up to 2,500 characters)." }, { status: 400 });
    if (!["1:1", "4:5", "9:16", "16:9"].includes(ratio) || !["1K", "2K", "4K"].includes(resolution)) return NextResponse.json({ error: "Unsupported poster size." }, { status: 400 });
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=" + encodeURIComponent(process.env.GEMINI_API_KEY), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: "Create a polished editorial poster image. Aspect ratio " + ratio + ". Brief: " + prompt }] }], generationConfig: { responseModalities: ["TEXT", "IMAGE"] } }),
      signal: AbortSignal.timeout(55000)
    });
    const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string; inlineData?: { mimeType?: string; data?: string } }> } }>; error?: { message?: string } };
    if (!response.ok) return NextResponse.json({ error: payload.error?.message ?? "Image model request failed." }, { status: 502 });
    const parts = payload.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find(part => part.inlineData?.data);
    if (!imagePart?.inlineData?.data) return NextResponse.json({ error: parts.find(part => part.text)?.text ?? "The image model returned no image. Check model availability for this API key." }, { status: 502 });
    return NextResponse.json({ image: "data:" + (imagePart.inlineData.mimeType ?? "image/png") + ";base64," + imagePart.inlineData.data, resolution, ratio });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message.slice(0, 240) : "Poster generation failed." }, { status: 502 });
  }
}
