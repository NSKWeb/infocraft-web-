import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const rateLimitResponse = await enforceRateLimit(request, { key: "import-pdf", limit: 10, windowMs: 60_000 });
  if (rateLimitResponse) return rateLimitResponse;
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.type !== "application/pdf" || file.size > 12 * 1024 * 1024) return NextResponse.json({ error: "Choose a PDF smaller than 12 MB." }, { status: 400 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const pdf = await getDocument({ data: bytes, useSystemFonts: true, disableFontFace: true }).promise;
    if (pdf.numPages > 80) return NextResponse.json({ error: "PDF is limited to 80 pages per import." }, { status: 413 });
    const pages: string[] = [];
    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
      const page = await pdf.getPage(pageNo);
      const content = await page.getTextContent();
      pages.push(content.items.map(item => "str" in item ? item.str : "").join(" "));
    }
    const text = pages.join("\n\n").replace(/\s+/g, " ").trim().slice(0, 15000);
    if (text.length < 30) return NextResponse.json({ error: "No selectable text found. Scanned PDFs need OCR before import." }, { status: 422 });
    return NextResponse.json({ text, pages: pdf.numPages, fileName: file.name });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message.slice(0, 220) : "Could not extract PDF text." }, { status: 422 });
  }
}
