import { expect, it, vi } from "vitest";
import { answerCacheKey, cachedAnswer, cacheHistory } from "../lib/answer-cache";

const answer = { answer: "Public portfolio fact", sources: [], fallback: false };
it("reuses answers and omits old token usage on a hit", async () => {
  const generate = vi.fn(async () => ({
    ...answer,
    usage: { inputTokens: 10, outputTokens: 5 },
  }));
  expect((await cachedAnswer("reuse", generate)).cacheHit).toBe(false);
  expect(await cachedAnswer("reuse", generate)).toMatchObject({
    cacheHit: true,
    usage: undefined,
  });
  expect(generate).toHaveBeenCalledTimes(1);
});
it("shares simultaneous identical work", async () => {
  const generate = vi.fn(async () => answer);
  await Promise.all([
    cachedAnswer("parallel", generate),
    cachedAnswer("parallel", generate),
  ]);
  expect(generate).toHaveBeenCalledTimes(1);
});
it("does not cache fallbacks or failures", async () => {
  const fallback = vi.fn(async () => ({ ...answer, fallback: true }));
  await cachedAnswer("fallback", fallback);
  await cachedAnswer("fallback", fallback);
  expect(fallback).toHaveBeenCalledTimes(2);
  const fail = vi
    .fn()
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce(answer);
  await expect(cachedAnswer("retry", fail)).rejects.toThrow("offline");
  expect((await cachedAnswer("retry", fail)).cacheHit).toBe(false);
});
it("expires cached answers", async () => {
  vi.useFakeTimers();
  try {
    const generate = vi.fn(async () => answer);
    await cachedAnswer("expire", generate);
    vi.advanceTimersByTime(60 * 60 * 1000 + 1);
    await cachedAnswer("expire", generate);
    expect(generate).toHaveBeenCalledTimes(2);
  } finally {
    vi.useRealTimers();
  }
});
it("separates language, history, knowledge, model and prompt", () => {
  const input = {
    question: "Skills?",
    history: [],
    language: "en" as const,
    knowledgeVersion: "v1",
    model: "model",
    prompt: "prompt",
    topK: 5,
  };
  const key = answerCacheKey(input);
  for (const change of [
    { language: "id" as const },
    { history: [{ role: "user" as const, content: "Which project?" }] },
    { knowledgeVersion: "v2" },
    { model: "other" },
    { prompt: "updated" },
    { topK: 3 },
  ])
    expect(answerCacheKey({ ...input, ...change })).not.toBe(key);
});

it("hits the first answer when the same question is repeated in chat", async () => {
  const base = {
    question: "Repeat skills?",
    history: [],
    language: "en" as const,
    knowledgeVersion: "repeat-v1",
    model: "model",
    prompt: "prompt",
    topK: 5,
  };
  const generate = vi.fn(async () => answer);
  await cachedAnswer(answerCacheKey(base), generate);
  const history = [
    { role: "user" as const, content: base.question },
    { role: "assistant" as const, content: answer.answer },
  ];
  const repeated = await cachedAnswer(answerCacheKey({ ...base, history }), generate);
  expect(repeated.cacheHit).toBe(true);
  expect(generate).toHaveBeenCalledTimes(1);
  expect(cacheHistory(base.question, [...history, ...history])).toEqual([]);
});
it("keeps the context preceding a repeated follow-up", () => {
  const context = [
    { role: "user" as const, content: "Tell me about project A" },
    { role: "assistant" as const, content: "Project A details" },
  ];
  const history = [
    ...context,
    { role: "user" as const, content: "What technologies?" },
    { role: "assistant" as const, content: "TypeScript" },
  ];
  expect(cacheHistory("What technologies?", history)).toEqual(context);
  expect(cacheHistory("What technologies?", context)).toEqual(context);
  expect(cacheHistory("Different question", history)).toEqual(history);
});
