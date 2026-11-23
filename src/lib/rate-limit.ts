import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

type RateLimitOptions = {
  /** Stable route identifier; do not include user-controlled input. */
  key: string;
  /** Maximum requests allowed per IP in the window. */
  limit: number;
  /** Fixed-window duration in milliseconds. */
  windowMs: number;
};

type Counter = { count: number; resetAt: number };
const localCounters = new Map<string, Counter>();

// INCR + PEXPIRE are executed atomically on Redis so concurrent serverless
// instances share one counter. The first request starts the fixed window.
const redisScript = [
  "local current = redis.call('INCR', KEYS[1])",
  "if current == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end",
  "local ttl = redis.call('PTTL', KEYS[1])",
  "return {current, ttl}",
].join("\n");

function getClientIp(request: NextRequest): string {
  // Prefer a single-IP proxy header; x-forwarded-for is a fallback for
  // platforms that provide the standard proxy chain.
  const direct =
    request.headers.get("x-real-ip") ??
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-nf-client-connection-ip");
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (direct || forwarded || "unknown").slice(0, 128);
}

function tooManyRequests(limit: number, retryAfterSeconds: number) {
  return NextResponse.json(
    { error: "Too many requests. Please wait before trying again." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
        "X-RateLimit-Limit": String(limit),
        "X-RateLimit-Remaining": "0",
      },
    },
  );
}

function serviceUnavailable() {
  return NextResponse.json(
    { error: "Request protection is temporarily unavailable. Please try again shortly." },
    { status: 503, headers: { "Retry-After": "30" } },
  );
}

/**
 * Returns a 429/503 response when the request must be rejected, otherwise null.
 * Production requires Upstash Redis so limits remain shared across serverless
 * instances. The in-memory fallback is deliberately development-only.
 */
export async function enforceRateLimit(
  request: NextRequest,
  options: RateLimitOptions,
): Promise<NextResponse | null> {
  const ipHash = createHash("sha256").update(getClientIp(request)).digest("hex");
  const key = `infocraft:ratelimit:${options.key}:${ipHash}`;
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, "");
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (redisUrl && redisToken) {
    try {
      const response = await fetch(redisUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${redisToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(["EVAL", redisScript, "1", key, String(options.windowMs)]),
        cache: "no-store",
        signal: AbortSignal.timeout(2500),
      });
      if (!response.ok) return serviceUnavailable();

      const payload = (await response.json()) as { result?: unknown; error?: string };
      if (payload.error || !Array.isArray(payload.result)) return serviceUnavailable();

      const count = Number(payload.result[0]);
      const ttl = Math.max(1, Number(payload.result[1]) || options.windowMs);
      if (!Number.isFinite(count)) return serviceUnavailable();

      if (count > options.limit) {
        return tooManyRequests(options.limit, Math.ceil(ttl / 1000));
      }
      return null;
    } catch {
      // Fail closed in production: silently bypassing the limiter during a
      // Redis outage would expose paid AI endpoints to unmetered abuse.
      return serviceUnavailable();
    }
  }

  if (process.env.NODE_ENV === "production") return serviceUnavailable();

  // Local-only fallback. This map is per-process and is not suitable for
  // production or multi-instance deployments.
  const now = Date.now();
  let counter = localCounters.get(key);
  if (!counter || counter.resetAt <= now) {
    counter = { count: 0, resetAt: now + options.windowMs };
    localCounters.set(key, counter);
  }
  counter.count += 1;

  if (localCounters.size > 5000) {
    for (const [storedKey, value] of localCounters) {
      if (value.resetAt <= now) localCounters.delete(storedKey);
    }
  }

  if (counter.count > options.limit) {
    return tooManyRequests(options.limit, Math.max(1, Math.ceil((counter.resetAt - now) / 1000)));
  }
  return null;
}
