import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
const blockedHost = (host: string) => {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  return h === "localhost" || h.endsWith(".localhost") || h === "0.0.0.0" || h === "::1" || h.startsWith("127.") || h.startsWith("10.") || h.startsWith("192.168.") || /^172\.(1[6-9]|2\d|3[01])\./.test(h) || h.endsWith(".internal") || h.endsWith(".local");
};

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json() as { url?: string };
    if (!url || url.length > 2048) return NextResponse.json({ error: "Enter a valid public webpage URL." }, { status: 400 });
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol) || blockedHost(parsed.hostname) || parsed.username || parsed.password) return NextResponse.json({ error: "Only public HTTP(S) webpages can be imported." }, { status: 400 });
    const response = await fetch(parsed.toString(), { redirect: "error", signal: AbortSignal.timeout(10000), headers: { "User-Agent": "InfoCraft-Web/1.0 (+source importer)", Accept: "text/html,text/plain" } });
    if (!response.ok) return NextResponse.json({ error: "The webpage returned HTTP " + response.status + "." }, { status: 422 });
    const type = response.headers.get("content-type") ?? "";
    if (!type.includes("text/html") && !type.includes("text/plain")) return NextResponse.json({ error: "This URL does not return readable HTML or plain text." }, { status: 415 });
    const html = (await response.text()).slice(0, 1_000_000);
    const text = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ").replace(/<(br|\/p|\/div|\/h[1-6]|\/li|\/article|\/section)\b[^>]*>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/[ \t]+/g, " ").replace(/\n\s+/g, "\n").trim().slice(0, 15000);
    if (text.length < 80) return NextResponse.json({ error: "Not enough readable page text was found." }, { status: 422 });
    return NextResponse.json({ text, title: parsed.hostname, sourceUrl: parsed.toString() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message.slice(0, 200) : "Could not import this URL." }, { status: 400 });
  }
}
