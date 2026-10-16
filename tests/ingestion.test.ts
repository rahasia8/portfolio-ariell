import { describe, it, expect, vi } from "vitest";
import { prepareKnowledge, publishKnowledge } from "../lib/ingestion";
import type { KnowledgeDocument } from "../lib/knowledge";
import type { Pool } from "pg";
const doc: KnowledgeDocument = {
  id: "test",
  title: "Test",
  category: "profile",
  visibility: "public",
  updated_at: "2026-10-16",
  version: 1,
  content: "Approved test knowledge.",
};
const embedding = () => [1, ...Array(767).fill(0)];
describe("ingestion preparation", () => {
  it("never embeds private or draft documents", async () => {
    const embed = vi.fn(async (texts: string[]) => texts.map(embedding));
    const rows = await prepareKnowledge(
      [
        doc,
        { ...doc, id: "private", visibility: "private", content: "Secret" },
        { ...doc, id: "draft", visibility: "draft" },
      ],
      { embed },
    );
    expect(embed).toHaveBeenCalledWith([doc.content], "RETRIEVAL_DOCUMENT");
    expect(rows.map((row) => row.document.id)).toEqual(["test"]);
  });
  it("rejects duplicate source IDs before requesting embeddings", async () => {
    const embed = vi.fn();
    await expect(prepareKnowledge([doc, doc], { embed })).rejects.toThrow("Duplicate");
    expect(embed).not.toHaveBeenCalled();
  });
  it("requires explicit permission for an empty replacement", async () => {
    const embed = vi.fn();
    await expect(prepareKnowledge([], { embed })).rejects.toThrow("No public");
    expect(await prepareKnowledge([], { embed }, true)).toEqual([]);
    expect(embed).not.toHaveBeenCalled();
  });
  it("propagates embedding failures before publication", async () => {
    await expect(
      prepareKnowledge([doc], {
        embed: async () => {
          throw Error("outage");
        },
      }),
    ).rejects.toThrow("outage");
  });
  it("rejects missing or malformed embeddings", async () => {
    await expect(prepareKnowledge([doc], { embed: async () => [] })).rejects.toThrow(
      "count",
    );
    await expect(prepareKnowledge([doc], { embed: async () => [[NaN]] })).rejects.toThrow(
      "Invalid embedding",
    );
  });
});
describe("snapshot publication", () => {
  it("commits only after all chunks are inserted and releases the connection", async () => {
    const query = vi.fn(async (_sql: string, _params?: unknown[]) => ({
      rows: [],
    }));
    const release = vi.fn();
    const pool = {
      connect: vi.fn(async () => ({ query, release })),
    } as unknown as Pool;
    const rows = await prepareKnowledge([doc], {
      embed: async () => [embedding()],
    });
    await publishKnowledge(pool, rows, "test-model");
    const sql = query.mock.calls.map((call) => call[0] as unknown as string);
    expect(sql[0]).toBe("BEGIN");
    expect(sql.indexOf("DELETE FROM knowledge_chunks")).toBeLessThan(
      sql.findIndex((s) => s.startsWith("INSERT")),
    );
    expect(sql.at(-1)).toBe("COMMIT");
    expect(release).toHaveBeenCalledOnce();
  });
  it("rolls back a failed replacement instead of committing partial data", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.startsWith("INSERT")) throw Error("insert failed");
      return { rows: [] };
    });
    const release = vi.fn();
    const pool = {
      connect: vi.fn(async () => ({ query, release })),
    } as unknown as Pool;
    const rows = await prepareKnowledge([doc], {
      embed: async () => [embedding()],
    });
    await expect(publishKnowledge(pool, rows, "test-model")).rejects.toThrow(
      "insert failed",
    );
    expect(query).toHaveBeenCalledWith("ROLLBACK");
    expect(query).not.toHaveBeenCalledWith("COMMIT");
    expect(release).toHaveBeenCalledOnce();
  });
});
