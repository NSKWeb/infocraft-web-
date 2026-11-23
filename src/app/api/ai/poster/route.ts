import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "@cf/black-forest-labs/flux-1-schnell";
const RATIOS = new Set(["1:1", "4:5", "9:16", "16:9"]);

type CloudflareImageResponse = {
  result?: { image?: string };
  errors?: Array<{ message?: string }>;
  success?: boolean;
};

export async function POST(request: NextRequest) {
  const rateLimitResponse = await enforceRateLimit(request, {
    key: "ai-poster",
    limit: 3,
    windowMs: 60_000,
  });
  if (rateLimitResponse) return rateLimitResponse;

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (!accountId || !apiToken) {
    return NextResponse.json(
      { error: "Cloudflare poster generation is not configured. Add CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN on the server." },
      { status: 503 },
    );
  }

  try {
    const body = await request.json() as { prompt?: string; ratio?: string };
    const userPrompt = body.prompt?.trim();
    const ratio = body.ratio ?? "4:5";

    if (!userPrompt || userPrompt.length > 1500) {
      return NextResponse.json(
        { error: "Add a poster brief (up to 1,500 characters)." },
        { status: 400 },
      );
    }
    if (!RATIOS.has(ratio)) {
      return NextResponse.json({ error: "Choose a supported poster aspect ratio." }, { status: 400 });
    }

    // FLUX.1 Schnell accepts a prompt up to 2,048 characters. Keep text
    // inside the generated artwork minimal; InfoCraft's canvas owns typography.
    const prompt = [
      "Create a high-quality, visually striking poster background illustration.",
      "Aspect ratio/composition: " + ratio + ".",
      "Do not render words, letters, numbers, logos, watermarks, captions, or typography.",
      "Leave intentional clean negative space for editable text to be added later.",
      "Visual brief: " + userPrompt,
    ].join(" ");
    if (prompt.length > 2048) {
      return NextResponse.json({ error: "Shorten the poster brief and try again." }, { status: 400 });
    }

    const response = await fetch(
      "https://api.cloudflare.com/client/v4/accounts/" +
        encodeURIComponent(accountId) +
        "/ai/run/" + MODEL,
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + apiToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt, steps: 4 }),
        cache: "no-store",
        signal: AbortSignal.timeout(55_000),
      },
    );

    const payload = await response.json().catch(() => null) as CloudflareImageResponse | null;
    const image = payload?.result?.image;

    if (!response.ok || !image) {
      const providerMessage = payload?.errors?.map(item => item.message).filter(Boolean).join("; ") ?? "";
      const quotaFailure = response.status === 429 || /quota|neuron|daily limit|rate.?limit|exceed.{0,30}(free|daily|neuron)/i.test(providerMessage);
      if (quotaFailure) {
        return NextResponse.json(
          { error: "Cloudflare's free daily AI quota or rate limit has been reached. No paid provider was contacted. Please try again after the quota resets." },
          { status: 429, headers: { "Retry-After": "3600" } },
        );
      }
      return NextResponse.json(
        { error: "Cloudflare could not generate this poster right now. Please try again later." },
        { status: 502 },
      );
    }

    if (image.length > 24_000_000) {
      return NextResponse.json({ error: "The generated image was too large to return safely." }, { status: 502 });
    }

    return NextResponse.json({
      image: "data:image/jpeg;base64," + image,
      ratio,
      provider: "cloudflare",
      model: MODEL,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return NextResponse.json({ error: "Cloudflare image generation timed out. Please retry." }, { status: 504 });
    }
    return NextResponse.json(
      { error: "Poster generation failed. Please check your connection and try again." },
      { status: 502 },
    );
  }
}
