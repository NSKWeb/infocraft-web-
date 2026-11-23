import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 90;

const CLOUDFLARE_MODEL = "@cf/black-forest-labs/flux-1-schnell";
const GEMINI_MODEL = "gemini-3.1-flash-image";
const RATIOS = new Set(["1:1", "4:5", "9:16", "16:9"]);

type CloudflareImageResponse = {
  result?: { image?: string };
  errors?: Array<{ message?: string }>;
  success?: boolean;
};

type GeminiImageResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        inlineData?: { mimeType?: string; data?: string };
        inline_data?: { mime_type?: string; data?: string };
      }>;
    };
  }>;
  error?: { message?: string; status?: string };
};

function jsonError(message: string, status: number, retryAfter?: string) {
  return NextResponse.json(
    { error: message },
    { status, headers: retryAfter ? { "Retry-After": retryAfter } : undefined },
  );
}

async function generateWithGemini(prompt: string, ratio: string, apiKey: string) {
  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/" +
      encodeURIComponent(GEMINI_MODEL) +
      ":generateContent",
    {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
          imageConfig: { aspectRatio: ratio },
        },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(48_000),
    },
  );

  const payload = await response.json().catch(() => null) as GeminiImageResponse | null;
  if (!response.ok) {
    throw new Error("Gemini backup provider returned HTTP " + response.status);
  }

  const parts = payload?.candidates?.flatMap(candidate => candidate.content?.parts ?? []) ?? [];
  for (const part of parts) {
    const image = part.inlineData ?? (part.inline_data
      ? { mimeType: part.inline_data.mime_type, data: part.inline_data.data }
      : undefined);
    if (image?.data && image.mimeType?.startsWith("image/")) {
      if (image.data.length > 24_000_000) throw new Error("Gemini backup image exceeded the response size limit.");
      return { data: image.data, mimeType: image.mimeType };
    }
  }
  throw new Error(payload?.error?.message || "Gemini backup did not return an image.");
}

export async function POST(request: NextRequest) {
  const rateLimitResponse = await enforceRateLimit(request, {
    key: "ai-poster",
    limit: 3,
    windowMs: 60_000,
  });
  if (rateLimitResponse) return rateLimitResponse;

  let userPrompt: string;
  let ratio: string;
  try {
    const body = await request.json() as { prompt?: string; ratio?: string };
    userPrompt = body.prompt?.trim() ?? "";
    ratio = body.ratio ?? "4:5";
  } catch {
    return jsonError("Request body must be valid JSON.", 400);
  }

  if (!userPrompt || userPrompt.length > 1500) {
    return jsonError("Add a poster brief (up to 1,500 characters).", 400);
  }
  if (!RATIOS.has(ratio)) {
    return jsonError("Choose a supported poster aspect ratio.", 400);
  }

  const prompt = [
    "Create a high-quality, visually striking poster background illustration.",
    "Aspect ratio/composition: " + ratio + ".",
    "Do not render words, letters, numbers, logos, watermarks, captions, or typography.",
    "Leave intentional clean negative space for editable text to be added later.",
    "Visual brief: " + userPrompt,
  ].join(" ");

  if (prompt.length > 2048) {
    return jsonError("Shorten the poster brief and try again.", 400);
  }

  const fallbackEnabled = process.env.POSTER_GEMINI_FALLBACK_ENABLED === "true";
  const geminiApiKey = process.env.GEMINI_API_KEY?.trim();
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const cloudflareToken = process.env.CLOUDFLARE_API_TOKEN?.trim();

  const useGeminiBackup = async (reason: string, status: number) => {
    if (!fallbackEnabled || !geminiApiKey) {
      if (status === 429) {
        const message = !fallbackEnabled
          ? "Cloudflare's free daily AI quota or rate limit has been reached. Gemini paid fallback is disabled. Enable POSTER_GEMINI_FALLBACK_ENABLED only if you accept possible Gemini image-generation charges."
          : "Cloudflare's free daily AI quota or rate limit has been reached, but Gemini backup is missing GEMINI_API_KEY. Add the server-side key to use the configured backup.";
        return jsonError(message, 429, "3600");
      }
      return jsonError(
        fallbackEnabled
          ? "Cloudflare poster generation failed and Gemini backup is not configured. Add GEMINI_API_KEY on the server."
          : "Cloudflare poster generation failed. Gemini backup is disabled; enable POSTER_GEMINI_FALLBACK_ENABLED only if you accept possible paid usage.",
        status >= 500 ? 502 : status,
      );
    }

    try {
      const image = await generateWithGemini(prompt, ratio, geminiApiKey);
      return NextResponse.json({
        image: "data:" + image.mimeType + ";base64," + image.data,
        ratio,
        provider: "gemini",
        model: GEMINI_MODEL,
        fallback: true,
        fallbackReason: reason,
      });
    } catch (error) {
      console.error("Poster Gemini backup failed:", error instanceof Error ? error.message : "Unknown provider error");
      return jsonError("Cloudflare generation failed and the Gemini backup could not complete. Please try again later.", 502);
    }
  };

  if (!accountId || !cloudflareToken) {
    return useGeminiBackup("cloudflare_not_configured", 503);
  }

  try {
    const response = await fetch(
      "https://api.cloudflare.com/client/v4/accounts/" +
        encodeURIComponent(accountId) +
        "/ai/run/" + CLOUDFLARE_MODEL,
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + cloudflareToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt, steps: 4 }),
        cache: "no-store",
        signal: AbortSignal.timeout(35_000),
      },
    );

    const payload = await response.json().catch(() => null) as CloudflareImageResponse | null;
    const image = payload?.result?.image;

    if (!response.ok || !image) {
      const providerMessage = payload?.errors?.map(item => item.message).filter(Boolean).join("; ") ?? "";
      const quotaFailure = response.status === 429 || /quota|neuron|daily limit|rate.?limit|exceed.{0,30}(free|daily|neuron)/i.test(providerMessage);
      if (quotaFailure) return useGeminiBackup("cloudflare_quota", 429);
      if (response.status >= 500 || !response.ok) return useGeminiBackup("cloudflare_provider_error", 502);
      return jsonError("Cloudflare rejected the poster request. Please revise the brief and try again.", 502);
    }

    if (image.length > 24_000_000) {
      return useGeminiBackup("cloudflare_image_too_large", 502);
    }

    return NextResponse.json({
      image: "data:image/jpeg;base64," + image,
      ratio,
      provider: "cloudflare",
      model: CLOUDFLARE_MODEL,
      fallback: false,
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return useGeminiBackup(timedOut ? "cloudflare_timeout" : "cloudflare_network_error", timedOut ? 504 : 502);
  }
}
