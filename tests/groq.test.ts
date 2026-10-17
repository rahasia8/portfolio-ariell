import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GroqLLM, createLLM } from "../lib/providers";
import { config, configured } from "../lib/config";
import { groqRequest } from "../lib/groq-request";
import { generateTranslation } from "../lib/translate";
import { translations } from "../lib/translations";
import { answerFromChunks, retrieve } from "../lib/rag";
import { GET } from "../app/api/health/route";

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("../lib/db", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  db: () => ({ query }),
}));
const chunk = {
  id: "chunk",
  source_id: "resume",
  title: "Resume",
  content: "Builds TypeScript applications.",
  source_url: null,
  score: 0,
};
const completion = (value: unknown, finish_reason = "stop") =>
  Response.json({
    choices: [{ message: { content: JSON.stringify(value) }, finish_reason }],
    usage: { prompt_tokens: 120, completion_tokens: 30 },
  });
beforeEach(() => {
  vi.stubEnv("GROQ_API_KEY", "test-server-key");
  vi.stubEnv("DATABASE_URL", "postgresql://test");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  query.mockReset();
});
it("configures Groq using its server-side key and model", () => {
  expect(config().GROQ_MODEL).toBe("openai/gpt-oss-20b");
  expect(configured()).toBe(true);
  expect(createLLM()).toBeInstanceOf(GroqLLM);
  vi.stubEnv("GROQ_API_KEY", " ");
  expect(configured()).toBe(false);
});
it("returns grounded localized answers using only the Groq endpoint", async () => {
  query.mockResolvedValue({ rows: [chunk] });
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(completion({ searchTerms: ["TypeScript", "skills"] }))
    .mockResolvedValueOnce(
      completion({
        answer: "Membangun aplikasi TypeScript.",
        sourceIds: ["resume"],
      }),
    );
  vi.stubGlobal("fetch", fetcher);
  const chunks = await retrieve("Apa keahliannya?");
  const answer = await answerFromChunks("Apa keahliannya?", chunks, [], undefined, "id");
  expect(answer.fallback).toBe(false);
  expect(answer.sources[0].sourceId).toBe("resume");
  expect(answer.usage).toEqual({ inputTokens: 120, outputTokens: 30 });
  expect(fetcher).toHaveBeenCalledTimes(2);
  const [url, request] = fetcher.mock.calls[1];
  expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
  expect(request.headers.Authorization).toBe("Bearer test-server-key");
  const payload = JSON.parse(request.body);
  expect(payload.model).toBe("openai/gpt-oss-20b");
  expect(payload.messages[0].content).toContain("Respond in Indonesian (id)");
  expect(payload.messages[0].content).toContain("untrusted data");
  expect(JSON.parse(payload.messages[1].content).publicSources[0].content).toBe(
    chunk.content,
  );
  expect(query.mock.calls[0][0]).toContain("visibility = 'public'");
  expect(query.mock.calls[0][0]).not.toContain("embedding_model =");
});
it("continues rejecting invented citations from the replacement model", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      completion({
        answer: "Invented facts",
        sourceIds: ["private-source"],
      }),
    ),
  );
  expect((await answerFromChunks("Skills?", [chunk], [])).fallback).toBe(true);
});
it("rejects truncated and invalid generated answers", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(completion({ answer: "Partial", sourceIds: [] }, "length"))
    .mockResolvedValueOnce(completion({ answer: "", sourceIds: "invalid" }));
  vi.stubGlobal("fetch", fetcher);
  await expect(new GroqLLM().generate("Hello", [], [])).rejects.toThrow("Incomplete");
  await expect(new GroqLLM().generate("Hello", [], [])).rejects.toThrow();
});
it("does not send a request when the Groq key is missing", async () => {
  vi.stubEnv("GROQ_API_KEY", "");
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  await expect(groqRequest({})).rejects.toThrow("AI provider unavailable");
  expect(fetcher).not.toHaveBeenCalled();
});
it("generates validated UI translations through Groq", async () => {
  const fetcher = vi.fn().mockResolvedValue(completion(translations.en));
  vi.stubGlobal("fetch", fetcher);
  expect(await generateTranslation("eo")).toEqual(translations.en);
  const payload = JSON.parse(fetcher.mock.calls[0][1].body);
  expect(payload.messages[0].content).toContain("Esperanto");
  expect(JSON.parse(payload.messages[1].content)).toEqual(translations.en);
});
it("reports readiness for the existing public index without an embedding service", async () => {
  query.mockResolvedValue({ rows: [{ count: 3 }] });
  expect(await (await GET()).json()).toEqual({ status: "ok", knowledgeReady: true });
  expect(query.mock.calls[0][0]).not.toContain("embedding_model =");
});
