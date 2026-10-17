import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { groqRequest, GroqRequestError } from "../lib/groq-request";
import { setTimeout as sleep } from "node:timers/promises";
vi.mock("node:timers/promises", () => ({
  setTimeout: vi.fn().mockResolvedValue(undefined),
}));
beforeEach(() => {
  vi.stubEnv("GROQ_API_KEY", "test-only");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});
describe("Groq transient failures", () => {
  it("recovers from 503 and 502 with backoff under a shared timeout", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValueOnce(new Response("busy", { status: 502 }))
      .mockResolvedValueOnce(Response.json({ result: "ok" }));
    vi.stubGlobal("fetch", fetcher);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await groqRequest({ model: "test" })).toEqual({ result: "ok" });
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls[0][1].signal).toBe(fetcher.mock.calls[2][1].signal);
    const delays = vi.mocked(sleep).mock.calls.map(([delay]) => Number(delay));
    expect(delays[0]).toBeGreaterThanOrEqual(500);
    expect(delays[1]).toBeGreaterThanOrEqual(1000);
  });
  it("does not retry invalid credentials or include provider secrets in errors", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("secret", { status: 403 }));
    vi.stubGlobal("fetch", fetcher);
    await expect(groqRequest({ model: "test" })).rejects.toMatchObject({
      status: 403,
      attempts: 1,
      message: "AI provider unavailable",
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("honors Retry-After rather than retrying beyond the time budget", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response("quota", { status: 429, headers: { "Retry-After": "120" } }),
      );
    vi.stubGlobal("fetch", fetcher);
    await expect(groqRequest({ model: "test" })).rejects.toBeInstanceOf(GroqRequestError);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });
  it("caps repeated failures at three attempts", async () => {
    const fetcher = vi
      .fn()
      .mockImplementation(() => Promise.resolve(new Response("busy", { status: 503 })));
    vi.stubGlobal("fetch", fetcher);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(groqRequest({ model: "test" })).rejects.toMatchObject({
      status: 503,
      attempts: 3,
    });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it("retries network failures", async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetcher);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(groqRequest({ model: "test" })).resolves.toEqual({
      ok: true,
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("does not retry malformed successful responses", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("invalid json"));
    vi.stubGlobal("fetch", fetcher);
    await expect(groqRequest({ model: "test" })).rejects.toBeInstanceOf(GroqRequestError);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
