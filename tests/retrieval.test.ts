import { afterEach, it, expect, vi } from "vitest";
const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("../lib/db", () => ({ db: () => ({ query }) }));
import { retrieve } from "../lib/rag";
import { retrievalQuery, searchQuery } from "../lib/retrieval-query";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  query.mockReset();
});
it("retrieves only matching public chunks with a bounded keyword query", async () => {
  vi.stubEnv("GROQ_API_KEY", "");
  vi.stubEnv("TOP_K", "4");
  const candidate = {
    id: "chunk",
    source_id: "test",
    title: "Test",
    content: "Public facts",
    source_url: null,
    score: 0.9,
  };
  query.mockResolvedValue({ rows: [candidate] });
  expect(await retrieve("Which projects?")).toEqual([candidate]);
  const [sql, params] = query.mock.calls[0];
  expect(sql).toContain("visibility = 'public'");
  expect(sql).toContain("@@ websearch_to_tsquery");
  expect(params).toEqual(["which OR projects", 4]);
});
it("does not query the store for punctuation-only input", async () => {
  vi.stubEnv("GROQ_API_KEY", "");
  expect(await retrieve("???")).toEqual([]);
  expect(query).not.toHaveBeenCalled();
});
it("expands multilingual questions into searchable English terms", async () => {
  vi.stubEnv("GROQ_API_KEY", "test-only");
  const fetcher = vi.fn().mockResolvedValue(
    Response.json({
      choices: [
        {
          finish_reason: "stop",
          message: {
            content: JSON.stringify({
              searchTerms: ["experience", "backend", "pengalaman"],
            }),
          },
        },
      ],
    }),
  );
  vi.stubGlobal("fetch", fetcher);
  const result = await retrievalQuery("Apa pengalaman backendnya?");
  expect(result).toContain("experience");
  expect(result).toContain("pengalaman");
  const body = JSON.parse(fetcher.mock.calls[0][1].body);
  expect(body.messages[0].content).toContain("untrusted data");
  expect(JSON.parse(body.messages[1].content).question).toBe(
    "Apa pengalaman backendnya?",
  );
});
it("falls back to original keywords when expansion fails or is malformed", async () => {
  vi.stubEnv("GROQ_API_KEY", "test-only");
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(new Response("secret", { status: 401 }))
    .mockResolvedValueOnce(
      Response.json({ choices: [{ finish_reason: "stop", message: { content: "{}" } }] }),
    )
    .mockResolvedValueOnce(Response.json({ choices: [{ finish_reason: "length" }] }));
  vi.stubGlobal("fetch", fetcher);
  for (let i = 0; i < 3; i++)
    expect(await retrievalQuery("TypeScript projects")).toBe("typescript OR projects");
});
it("normalizes untrusted query syntax into bounded search terms", () => {
  expect(searchQuery('"TypeScript" | !secret: (projects)')).toBe(
    "typescript OR secret OR projects",
  );
  expect(searchQuery("word ".repeat(1000))).toBe("word");
});
