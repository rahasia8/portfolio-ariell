import { createHash } from "node:crypto";
import type { Pool } from "pg";
import { vector } from "./db";
import { chunkText, type KnowledgeDocument } from "./knowledge";
import type { EmbeddingProvider } from "./types";
export type PreparedChunk = {
  document: KnowledgeDocument;
  content: string;
  embedding: string;
  index: number;
};
export async function prepareKnowledge(
  documents: KnowledgeDocument[],
  provider: EmbeddingProvider,
  allowEmpty = false,
): Promise<PreparedChunk[]> {
  const ids = documents.map((document) => document.id);
  if (new Set(ids).size !== ids.length)
    throw new Error("Duplicate source IDs. No changes made.");
  const publicDocuments = documents.filter(
    (document) => document.visibility === "public",
  );
  if (!publicDocuments.length && !allowEmpty)
    throw new Error(
      "No public documents. Use --allow-empty to explicitly clear the index.",
    );
  const rows: PreparedChunk[] = [];
  for (const document of publicDocuments) {
    const chunks = chunkText(document.content);
    const vectors = await provider.embed(chunks, "RETRIEVAL_DOCUMENT");
    if (vectors.length !== chunks.length)
      throw new Error("Embedding count does not match chunks");
    for (let index = 0; index < chunks.length; index++)
      rows.push({
        document,
        content: chunks[index],
        embedding: vector(vectors[index]),
        index,
      });
  }
  return rows;
}
export async function publishKnowledge(
  pool: Pick<Pool, "connect">,
  rows: PreparedChunk[],
  model: string,
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(8743291)");
    await client.query("DELETE FROM knowledge_chunks");
    for (const { document: d, content, embedding, index } of rows)
      await client.query(
        `INSERT INTO knowledge_chunks
   (id,source_id,content,embedding,embedding_model,title,category,visibility,source_url,version,updated_at,chunk_index)
   VALUES ($1,$2,$3,$4::vector,$5,$6,$7,'public',$8,$9,$10,$11)`,
        [
          createHash("sha256").update(`${d.id}:${d.version}:${index}`).digest("hex"),
          d.id,
          content,
          embedding,
          model,
          d.title,
          d.category,
          d.source_url || null,
          d.version,
          d.updated_at,
          index,
        ],
      );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
