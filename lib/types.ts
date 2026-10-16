import type { Language } from "./locale";
export type HistoryMessage = { role: "user" | "assistant"; content: string };
export type Source = { sourceId: string; title: string; url?: string };
export type RetrievedChunk = {
  id: string;
  source_id: string;
  title: string;
  content: string;
  source_url: string | null;
  score: number;
};
export type GeneratedAnswer = {
  answer: string;
  sourceIds: string[];
  usage?: { inputTokens: number; outputTokens: number };
};
export interface EmbeddingProvider {
  embed(
    texts: string[],
    task: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY",
  ): Promise<number[][]>;
}
export interface LLMProvider {
  generate(
    question: string,
    chunks: RetrievedChunk[],
    history: HistoryMessage[],
    language?: Language,
  ): Promise<GeneratedAnswer>;
}
