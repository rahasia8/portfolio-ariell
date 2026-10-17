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
describe("ingestion preparation", () => {
  it("prepares public chunks without an API key or embedding request", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    try {
      const rows = await prepareKnowledge([
        doc,
        { ...doc, id: "private", visibility: "private" },
        { ...doc, id: "draft", visibility: "draft" },
      ]);
      expect(rows.map((row) => row.document.id)).toEqual(["test"]);
      expect(rows[0].embedding).toBeNull();
      expect(fetcher).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("rejects duplicate source IDs before publication", async () => {
    await expect(prepareKnowledge([doc, doc])).rejects.toThrow("Duplicate");
  });
  it("requires explicit permission for an empty replacement", async () => {
    await expect(prepareKnowledge([])).rejects.toThrow("No public");
    expect(await prepareKnowledge([], true)).toEqual([]);
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
    const rows = await prepareKnowledge([doc]);
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
    const rows = await prepareKnowledge([doc]);
    await expect(publishKnowledge(pool, rows, "test-model")).rejects.toThrow(
      "insert failed",
    );
    expect(query).toHaveBeenCalledWith("ROLLBACK");
    expect(query).not.toHaveBeenCalledWith("COMMIT");
    expect(release).toHaveBeenCalledOnce();
  });
});
