import { retrievalQuery } from "./retrieval-query";
import { builtInTranslation } from "./translations";
import type { Language } from "./locale";
import { db } from "./db";
import { config } from "./config";
import { createLLM } from "./providers";
import { safeUrl } from "./knowledge";
import type { RetrievedChunk, HistoryMessage, LLMProvider, Source } from "./types";
export function fallback(question: string, language?: Language) {
  const detected =
    language ||
    (/\b(apa|siapa|bagaimana|ceritakan|pengalaman|proyek|keahlian|pendidikan|pemilik|saya|teknologi|dan|yang|relevan|informasi)\b/i.test(
      question,
    )
      ? "id"
      : "en");
  return (builtInTranslation(detected) || builtInTranslation("en")!).fallback;
}
export async function localizedFallback(question: string, language?: Language) {
  if (!language || builtInTranslation(language)) return fallback(question, language);
  try {
    const { getTranslation } = await import("./translate");
    return (await getTranslation(language)).fallback;
  } catch {
    return fallback(question, language);
  }
}
export async function retrieve(question: string): Promise<RetrievedChunk[]> {
  const c = config();
  const query = await retrievalQuery(question);
  if (!query) return [];
  const result = await db().query<RetrievedChunk>(
    `SELECT id, source_id, title, content, source_url,
      ts_rank_cd(to_tsvector('english', title || ' ' || content),
        websearch_to_tsquery('english', $1)) AS score
     FROM knowledge_chunks WHERE visibility = 'public'
       AND to_tsvector('english', title || ' ' || content) @@ websearch_to_tsquery('english', $1)
     ORDER BY score DESC, source_id, chunk_index LIMIT $2`,
    [query, c.TOP_K],
  );
  return result.rows;
}
export function selectSources(ids: string[], chunks: RetrievedChunk[]): Source[] {
  return [...new Set(ids)].flatMap((id) => {
    const c = chunks.find((c) => c.source_id === id);
    return c
      ? [
          {
            sourceId: id,
            title: c.title,
            ...(c.source_url && safeUrl(c.source_url) ? { url: c.source_url } : {}),
          },
        ]
      : [];
  });
}
export async function answerFromChunks(
  question: string,
  chunks: RetrievedChunk[],
  history: HistoryMessage[],
  llm: LLMProvider = createLLM(),
  language?: Language,
) {
  if (!chunks.length)
    return {
      answer: await localizedFallback(question, language),
      sources: [],
      fallback: true,
    };
  const generated = await llm.generate(question, chunks, history, language);
  const sources = selectSources(generated.sourceIds, chunks);
  // An uncited model response is never presented as a factual portfolio answer.
  if (
    !sources.length ||
    generated.sourceIds.some((id) => !chunks.some((c) => c.source_id === id))
  )
    return {
      answer: await localizedFallback(question, language),
      sources: [],
      fallback: true,
      usage: generated.usage,
    };
  return {
    answer: generated.answer,
    sources,
    fallback: false,
    usage: generated.usage,
  };
}
