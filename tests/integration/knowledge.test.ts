import { beforeAll, beforeEach, afterAll, describe, it, expect, vi } from "vitest";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { prepareKnowledge, publishKnowledge } from "../../lib/ingestion";
import { retrieve } from "../../lib/rag";
import { closeDb } from "../../lib/db";
import type { KnowledgeDocument } from "../../lib/knowledge";
const schema = `automation_${randomUUID().replaceAll("-", "")}`;
const url = process.env.TEST_DATABASE_URL;
const embedding = {
  embed: async (texts: string[]) => texts.map(() => [1, ...Array(767).fill(0)]),
};
const document: KnowledgeDocument = {
  id: "public-test",
  title: "Public test",
  category: "project",
  visibility: "public",
  version: 1,
  updated_at: "2026-10-16",
  content: "Synthetic automation knowledge. No personal data.",
};
describe("PostgreSQL/pgvector integration in an isolated test schema", () => {
  let pool: Pool;
  beforeAll(async () => {
    const connection = new URL(url!);
    // A dedicated test database is mandatory; never default to DATABASE_URL.
    if (!/test|automation/i.test(connection.pathname))
      throw new Error("TEST_DATABASE_URL must identify a dedicated test database");
    const admin = new Pool({ connectionString: url });
    try {
      await admin.query("CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public");
      await admin.query(`CREATE SCHEMA "${schema}"`);
    } finally {
      await admin.end();
    }
    connection.searchParams.set("options", `-c search_path=${schema},public`);
    pool = new Pool({ connectionString: connection.toString() });
    vi.stubEnv("DATABASE_URL", connection.toString());
    vi.stubEnv("EMBEDDING_MODEL", "automation-embedding");
    vi.stubEnv("RELEVANCE_THRESHOLD", "0.75");
    await pool.query(await readFile("db/001_initial.sql", "utf8"));
  });
  beforeEach(async () => {
    await pool.query("DELETE FROM knowledge_chunks");
  });
  afterAll(async () => {
    await closeDb();
    if (pool) {
      await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await pool.end();
    }
    vi.unstubAllEnvs();
  });
  it("publishes public documents and retrieves only the configured embedding model", async () => {
    const rows = await prepareKnowledge(
      [
        document,
        { ...document, id: "private", visibility: "private" },
        { ...document, id: "draft", visibility: "draft" },
      ],
      embedding,
    );
    await publishKnowledge(pool, rows, "automation-embedding");
    expect((await pool.query("SELECT source_id FROM knowledge_chunks")).rows).toEqual([
      { source_id: "public-test" },
    ]);
    expect(
      (await retrieve("Synthetic project", embedding)).map((row) => row.source_id),
    ).toEqual(["public-test"]);
    vi.stubEnv("EMBEDDING_MODEL", "other-model");
    expect(await retrieve("Synthetic project", embedding)).toEqual([]);
    vi.stubEnv("EMBEDDING_MODEL", "automation-embedding");
  });
  it("replaces old versions and removes deleted/private documents atomically", async () => {
    await publishKnowledge(
      pool,
      await prepareKnowledge([document, { ...document, id: "deleted" }], embedding),
      "automation-embedding",
    );
    await publishKnowledge(
      pool,
      await prepareKnowledge(
        [{ ...document, version: 2, content: "Updated synthetic facts." }],
        embedding,
      ),
      "automation-embedding",
    );
    expect(
      (await pool.query("SELECT source_id,version,content FROM knowledge_chunks")).rows,
    ).toEqual([
      {
        source_id: "public-test",
        version: 2,
        content: "Updated synthetic facts.",
      },
    ]);
  });
  it("rolls back a constraint failure and preserves the previous published snapshot", async () => {
    await publishKnowledge(
      pool,
      await prepareKnowledge([document], embedding),
      "automation-embedding",
    );
    const invalid = await prepareKnowledge([{ ...document, version: 0 }], embedding);
    await expect(
      publishKnowledge(pool, invalid, "automation-embedding"),
    ).rejects.toThrow();
    expect((await pool.query("SELECT version FROM knowledge_chunks")).rows).toEqual([
      { version: 1 },
    ]);
  });
  it("clears the index only when an empty snapshot was explicitly prepared", async () => {
    await publishKnowledge(
      pool,
      await prepareKnowledge([document], embedding),
      "automation-embedding",
    );
    await expect(prepareKnowledge([], embedding)).rejects.toThrow("No public");
    expect(
      (await pool.query("SELECT count(*)::int AS count FROM knowledge_chunks")).rows[0]
        .count,
    ).toBe(1);
    await publishKnowledge(
      pool,
      await prepareKnowledge([], embedding, true),
      "automation-embedding",
    );
    expect(
      (await pool.query("SELECT count(*)::int AS count FROM knowledge_chunks")).rows[0]
        .count,
    ).toBe(0);
  });
});
