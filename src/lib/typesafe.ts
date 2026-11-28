import { TypeSafeClient } from "@typesafe-ai/sdk";

/**
 * TypeSafe / Jev client.
 *
 * Jev is a System One model: it answers typed questions about a state and returns
 * probabilities instead of generated prose, so the app can act on a calibrated decision
 * rather than parsing free text out of a chat completion.
 *
 * Every judgment in this app is opt-in. Without TYPESAFE_API_KEY the pipeline behaves exactly
 * as it did before, so the app never depends on the service to work.
 */

/** Model used for judgments. `jev-latest` tracks the current stable release. */
export const TYPESAFE_MODEL = "jev-latest";

/**
 * Per-request timeout in milliseconds. Judgments are small and are expected to answer
 * quickly, so a slow answer is not worth waiting for — the pipeline falls back instead.
 */
const JUDGMENT_TIMEOUT_MS = 3000;

/**
 * One retry after a transient failure. Judgments sit inside a request that also makes a
 * slower generation call, so the retry budget is deliberately small.
 */
const JUDGMENT_MAX_RETRIES = 1;

let cachedClient: TypeSafeClient | null = null;

/** True when a TypeSafe API key is present, so judgments can be requested. */
export function isTypesafeConfigured(): boolean {
  return Boolean(process.env.TYPESAFE_API_KEY?.trim());
}

/**
 * Shared client for the process. The SDK reads TYPESAFE_API_KEY itself, so the key stays
 * server-side and is never exposed to the browser.
 */
export function getTypesafeClient(): TypeSafeClient {
  if (!cachedClient) {
    cachedClient = new TypeSafeClient({
      defaultModel: TYPESAFE_MODEL,
      timeout: JUDGMENT_TIMEOUT_MS,
      retry: { maxRetries: JUDGMENT_MAX_RETRIES }
    });
  }
  return cachedClient;
}
