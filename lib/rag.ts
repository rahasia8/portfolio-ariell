import { builtInTranslation } from "./translations";
import type { Language } from "./locale";
import { db, vector } from "./db";
import { config } from "./config";
import { GeminiEmbedding, GeminiLLM } from "./providers";
import { safeUrl } from "./knowledge";
import type {
  RetrievedChunk,
  HistoryMessage,
  EmbeddingProvider,
  LLMProvider,
  Source,
} from "./types";
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
export async function retrieve(
  question: string,
  embedding: EmbeddingProvider = new GeminiEmbedding(),
): Promise<RetrievedChunk[]> {
  const c = config();
  const [values] = await embedding.embed([question], "RETRIEVAL_QUERY");
  const result = await db().query<RetrievedChunk>(
    `SELECT id, source_id, title, content, source_url, 1 - (embedding <=> $1::vector) AS score
    FROM knowledge_chunks WHERE visibility = 'public' AND embedding_model = $2
    AND 1 - (embedding <=> $1::vector) >= $3 ORDER BY embedding <=> $1::vector LIMIT $4`,
    [vector(values), c.EMBEDDING_MODEL, c.RELEVANCE_THRESHOLD, c.TOP_K],
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
  llm: LLMProvider = new GeminiLLM(),
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
