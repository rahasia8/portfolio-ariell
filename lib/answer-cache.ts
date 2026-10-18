import { createHash } from "node:crypto";
import type { HistoryMessage } from "./types";
import type { Language } from "./locale";
import type { answerFromChunks } from "./rag";

type Answer = Awaited<ReturnType<typeof answerFromChunks>>;
const TTL_MS = 60 * 60 * 1000;
const MAX_ENTRIES = 200;
const entries = new Map<string, { expires: number; answer: Answer }>();
const pending = new Map<string, Promise<Answer>>();

/** Remove only consecutive completed repetitions, retaining earlier context. */
export function cacheHistory(question: string, history: HistoryMessage[]) {
  let end = history.length;
  while (
    end >= 2 &&
    history[end - 1].role === "assistant" &&
    history[end - 2].role === "user" &&
    history[end - 2].content.trim() === question.trim()
  ) {
    end -= 2;
  }
  return history.slice(0, end);
}

export function answerCacheKey(input: {
  question: string;
  history: HistoryMessage[];
  language: Language;
  knowledgeVersion: string;
  model: string;
  prompt: string;
  topK: number;
}) {
  // Preserve case and punctuation: these can change names or technical questions.
  return createHash("sha256")
    .update(
      JSON.stringify({
        ...input,
        question: input.question.trim(),
        history: cacheHistory(input.question, input.history),
      }),
    )
    .digest("hex");
}

/** Process-local only: no conversation text is persisted to disk or a database. */
export async function cachedAnswer(key: string, generate: () => Promise<Answer>) {
  const now = Date.now();
  for (const [id, entry] of entries) {
    if (entry.expires <= now) entries.delete(id);
  }
  const hit = entries.get(key);
  if (hit) return { ...hit.answer, usage: undefined, cacheHit: true };
  const running = pending.get(key);
  if (running) return { ...(await running), usage: undefined, cacheHit: true };
  // Bound both stored answers and distinct in-flight keys under high traffic.
  if (pending.size >= MAX_ENTRIES) return { ...(await generate()), cacheHit: false };
  const task = Promise.resolve().then(generate);
  pending.set(key, task);
  try {
    const answer = await task;
    // Outages and unsupported questions must be retried, never cached as facts.
    if (!answer.fallback) {
      if (entries.size >= MAX_ENTRIES) entries.delete(entries.keys().next().value!);
      entries.set(key, { answer, expires: Date.now() + TTL_MS });
    }
    return { ...answer, cacheHit: false };
  } finally {
    pending.delete(key);
  }
}
