import { answerCacheKey, cachedAnswer, cacheHistory } from "@/lib/answer-cache";
import { SYSTEM_PROMPT } from "@/lib/providers";
import { GroqRequestError } from "@/lib/groq-request";
import { requestLanguage } from "@/lib/locale";
import { randomUUID } from "node:crypto";
import { config, configured } from "@/lib/config";
import { chatSchema, readBoundedJson } from "@/lib/validation";
import { allowRequest } from "@/lib/rate-limit";
import { retrieve, answerFromChunks, localizedFallback } from "@/lib/rag";
import { db } from "@/lib/db";
import { allowedRequestOrigin } from "@/lib/request-origin";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  const requestId = randomUUID();
  const start = Date.now();
  const headers = { "Cache-Control": "no-store" };
  let phase = "rate_limit";
  const json = (body: unknown, status = 200, extra = {}) =>
    Response.json(body, { status, headers: { ...headers, ...extra } });
  try {
    if (!allowedRequestOrigin(request))
      return json({ error: "Request origin not allowed.", requestId }, 403);
    const ip =
      config().TRUST_PROXY === "true"
        ? request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "shared"
        : "shared";
    if (!(await allowRequest(ip)))
      return json(
        { error: "Too many questions. Please try again in a minute.", requestId },
        429,
        { "Retry-After": "60" },
      );
    let input;
    try {
      input = chatSchema(config().MAX_MESSAGE_LENGTH).parse(
        await readBoundedJson(request),
      );
    } catch {
      return json(
        {
          error: `Send a question between 1 and ${config().MAX_MESSAGE_LENGTH} characters, with up to 6 history messages.`,
          requestId,
        },
        400,
      );
    }
    const language = input.locale || requestLanguage(request.headers).language;
    const conversationId = input.conversationId || randomUUID();
    if (!configured())
      return json({
        answer: await localizedFallback(input.message, language),
        sources: [],
        conversationId,
        requestId,
        fallback: true,
      });
    const count = await db().query(
      `SELECT count(*)::int AS count,
        md5(COALESCE(string_agg(md5(json_build_array(id, source_id, title, content, source_url)::text), '' ORDER BY id), '')) AS version
       FROM knowledge_chunks WHERE visibility = 'public'`,
    );
    if (!count.rows[0]?.count)
      return json({
        answer: await localizedFallback(input.message, language),
        sources: [],
        conversationId,
        requestId,
        fallback: true,
      });
    const history = cacheHistory(input.message, input.history);
    const settings = config();
    const key = answerCacheKey({
      question: input.message,
      history,
      language,
      knowledgeVersion: count.rows[0].version,
      model: settings.GROQ_MODEL,
      prompt: SYSTEM_PROMPT,
      topK: settings.TOP_K,
    });
    let retrievalMs = 0;
    const answer = await cachedAnswer(key, async () => {
      phase = "retrieval";
      const retrievalStart = Date.now();
      const query = [
        ...history
          .filter((m) => m.role === "user")
          .slice(-2)
          .map((m) => m.content),
        input.message,
      ]
        .join("\n")
        .slice(-6000);
      const chunks = await retrieve(query);
      retrievalMs = Date.now() - retrievalStart;
      phase = "generation";
      return answerFromChunks(input.message, chunks, history, undefined, language);
    });
    console.info(
      JSON.stringify({
        event: "chat",
        requestId,
        retrievalMs,
        totalMs: Date.now() - start,
        cacheHit: answer.cacheHit,
        fallback: answer.fallback,
        usage: answer.usage,
      }),
    );
    return json({ ...answer, conversationId, requestId });
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error ? error.code : undefined;
    console.error(
      JSON.stringify({
        event: "chat_error",
        requestId,
        totalMs: Date.now() - start,
        phase,
        ...(error instanceof GroqRequestError
          ? {
              providerStatus: error.status,
              providerMethod: error.method,
              attempts: error.attempts,
            }
          : {}),
        code:
          typeof code === "string" && /^[A-Z0-9_]{1,40}$/.test(code) ? code : undefined,
      }),
    );
    return json(
      {
        error: "The assistant is temporarily unavailable. Please try again shortly.",
        requestId,
      },
      503,
    );
  }
}
