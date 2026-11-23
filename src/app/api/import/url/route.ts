import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export const runtime = "nodejs";
const blockedAddress = (address: string) => {
  const version = isIP(address);
  if (version === 4) {
    const [a,b] = address.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 0 || b === 168)) || (a === 198 && (b === 18 || b === 19));
  }
  if (version === 6) {
    const normalized = address.toLowerCase();
    return normalized === "::" || normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb") || normalized.startsWith("::ffff:") || !(normalized.startsWith("2") || normalized.startsWith("3"));
  }
  return true;
};
const blockedHost = (host: string) => {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  return h === "localhost" || h.endsWith(".localhost") || h === "0.0.0.0" || h === "::1" || h.startsWith("127.") || h.startsWith("10.") || h.startsWith("192.168.") || /^172\.(1[6-9]|2\d|3[01])\./.test(h) || h.endsWith(".internal") || h.endsWith(".local");
};

export async function POST(request: NextRequest) {
  const rateLimitResponse = await enforceRateLimit(request, { key: "import-url", limit: 10, windowMs: 60_000 });
  if (rateLimitResponse) return rateLimitResponse;
  try {
    const { url } = await request.json() as { url?: string };
    if (!url || url.length > 2048) return NextResponse.json({ error: "Enter a valid public webpage URL." }, { status: 400 });
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol) || blockedHost(parsed.hostname) || parsed.username || parsed.password) return NextResponse.json({ error: "Only public HTTP(S) webpages can be imported." }, { status: 400 });
    const resolved = await lookup(parsed.hostname, { all: true, verbatim: true });
    if (!resolved.length || resolved.some(item => blockedAddress(item.address))) return NextResponse.json({ error: "This hostname does not resolve exclusively to public IP addresses." }, { status: 400 });
    const response = await fetch(parsed.toString(), { redirect: "error", signal: AbortSignal.timeout(10000), headers: { "User-Agent": "InfoCraft-Web/1.0 (+source importer)", Accept: "text/html,text/plain" } });
    if (!response.ok) return NextResponse.json({ error: "The webpage returned HTTP " + response.status + "." }, { status: 422 });
    const type = response.headers.get("content-type") ?? "";
    if (!type.includes("text/html") && !type.includes("text/plain")) return NextResponse.json({ error: "This URL does not return readable HTML or plain text." }, { status: 415 });
    const declaredLength = Number(response.headers.get("content-length") ?? 0);
    if (declaredLength > 1_000_000) return NextResponse.json({ error: "Webpage response is too large to import." }, { status: 413 });
    const reader = response.body?.getReader();
    if (!reader) return NextResponse.json({ error: "The webpage returned an empty response." }, { status: 422 });
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > 1_000_000) { await reader.cancel(); return NextResponse.json({ error: "Webpage response is too large to import." }, { status: 413 }); }
      chunks.push(value);
    }
    const html = new TextDecoder().decode(Buffer.concat(chunks));
    const text = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ").replace(/<(br|\/p|\/div|\/h[1-6]|\/li|\/article|\/section)\b[^>]*>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/[ \t]+/g, " ").replace(/\n\s+/g, "\n").trim().slice(0, 15000);
    if (text.length < 80) return NextResponse.json({ error: "Not enough readable page text was found." }, { status: 422 });
    return NextResponse.json({ text, title: parsed.hostname, sourceUrl: parsed.toString() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message.slice(0, 200) : "Could not import this URL." }, { status: 400 });
  }
}
