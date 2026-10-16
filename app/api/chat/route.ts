import { requestLanguage } from "@/lib/locale";
import { randomUUID } from "node:crypto";
import { config, configured } from "@/lib/config";
import { chatSchema, readBoundedJson } from "@/lib/validation";
import { allowRequest } from "@/lib/rate-limit";
import { retrieve, answerFromChunks, localizedFallback } from "@/lib/rag";
import { db } from "@/lib/db";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  const requestId = randomUUID();
  const start = Date.now();
  const headers = { "Cache-Control": "no-store" };
  const json = (body: unknown, status = 200, extra = {}) =>
    Response.json(body, { status, headers: { ...headers, ...extra } });
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin)
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
      "SELECT 1 FROM knowledge_chunks WHERE visibility = 'public' LIMIT 1",
    );
    if (!count.rowCount)
      return json({
        answer: await localizedFallback(input.message, language),
        sources: [],
        conversationId,
        requestId,
        fallback: true,
      });
    const retrievalStart = Date.now();
    const query = [
      ...input.history
        .filter((m) => m.role === "user")
        .slice(-2)
        .map((m) => m.content),
      input.message,
    ]
      .join("\n")
      .slice(-6000);
    const chunks = await retrieve(query);
    const retrievalMs = Date.now() - retrievalStart;
    const answer = await answerFromChunks(
      input.message,
      chunks,
      input.history,
      undefined,
      language,
    );
    console.info(
      JSON.stringify({
        event: "chat",
        requestId,
        retrievalMs,
        totalMs: Date.now() - start,
        resultCount: chunks.length,
        fallback: answer.fallback,
        usage: answer.usage,
      }),
    );
    return json({ ...answer, conversationId, requestId });
  } catch {
    console.error(
      JSON.stringify({ event: "chat_error", requestId, totalMs: Date.now() - start }),
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
