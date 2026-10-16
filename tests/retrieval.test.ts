import { afterEach, it, expect, vi } from "vitest";
const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("../lib/db", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  db: () => ({ query }),
}));
import { retrieve } from "../lib/rag";
afterEach(() => {
  vi.unstubAllEnvs();
  query.mockReset();
});
it("retrieves only public chunks with matching embedding model and relevance threshold", async () => {
  vi.stubEnv("EMBEDDING_MODEL", "test-embedding");
  vi.stubEnv("TOP_K", "4");
  vi.stubEnv("RELEVANCE_THRESHOLD", "0.55");
  const candidate = {
    id: "chunk",
    source_id: "test",
    title: "Test",
    content: "Public facts",
    source_url: null,
    score: 0.9,
  };
  query.mockResolvedValue({ rows: [candidate] });
  const embed = vi.fn(async () => [[1, ...Array(767).fill(0)]]);
  expect(await retrieve("Which projects?", { embed })).toEqual([candidate]);
  expect(embed).toHaveBeenCalledWith(["Which projects?"], "RETRIEVAL_QUERY");
  const [sql, params] = query.mock.calls[0];
  expect(sql).toContain("visibility = 'public'");
  expect(sql).toContain("embedding_model = $2");
  expect(params.slice(1)).toEqual(["test-embedding", 0.55, 4]);
});
it("does not query the store when embedding generation fails", async () => {
  await expect(
    retrieve("question", {
      embed: async () => {
        throw Error("provider offline");
      },
    }),
  ).rejects.toThrow("offline");
  expect(query).not.toHaveBeenCalled();
});
