import { setTimeout as sleep } from "node:timers/promises";
import { config } from "./config";

export class GroqRequestError extends Error {
  readonly code = "AI_PROVIDER_UNAVAILABLE";
  constructor(
    readonly status: number | undefined,
    readonly method: string,
    readonly attempts: number,
  ) {
    super("AI provider unavailable");
    this.name = "GroqRequestError";
  }
}

/** Retry transient failures within one timeout budget, including response bodies. */
export async function groqRequest(body: Record<string, unknown>, timeoutMs = 35000) {
  const key = config().GROQ_API_KEY;
  if (!key) throw new GroqRequestError(undefined, "chat/completions", 0);
  const method = "chat/completions";
  const signal = AbortSignal.timeout(timeoutMs);
  const deadline = Date.now() + timeoutMs;
  const payload = JSON.stringify(body);
  let status: number | undefined;
  for (let attempt = 1; attempt <= 3; attempt++) {
    let retryAfter: string | null = null;
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: payload,
        signal,
      });
      status = response.status;
      if (response.ok) return await response.json();
      retryAfter = response.headers.get("retry-after");
      await response.body?.cancel();
      if (![408, 429, 500, 502, 503, 504].includes(status))
        throw new GroqRequestError(status, method, attempt);
    } catch (error) {
      if (error instanceof GroqRequestError) throw error;
      // Retry transport failures, but not malformed JSON or exhausted timeouts.
      if (signal.aborted || !(error instanceof TypeError))
        throw new GroqRequestError(status, method, attempt);
      status = undefined;
    }
    if (attempt === 3) throw new GroqRequestError(status, method, attempt);
    const seconds = retryAfter === null ? NaN : Number(retryAfter);
    const requestedDelay = Number.isFinite(seconds)
      ? Math.max(0, seconds * 1000)
      : retryAfter
        ? Math.max(0, Date.parse(retryAfter) - Date.now())
        : 0;
    const delay = Math.max(
      500 * 2 ** (attempt - 1) + Math.floor(Math.random() * 250),
      Number.isFinite(requestedDelay) ? requestedDelay : 0,
    );
    // Do not ignore Retry-After or start a retry with almost no time left.
    if (Date.now() + delay + 1000 >= deadline)
      throw new GroqRequestError(status, method, attempt);
    console.warn(
      JSON.stringify({
        event: "groq_retry",
        model: body.model,
        method,
        status,
        attempt,
        delayMs: delay,
      }),
    );
    try {
      await sleep(delay, undefined, { signal });
    } catch {
      throw new GroqRequestError(status, method, attempt);
    }
  }
  throw new GroqRequestError(status, method, 3);
}
