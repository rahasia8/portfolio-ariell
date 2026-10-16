import { afterEach, beforeEach, it, expect, vi } from "vitest";
const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("../lib/db", () => ({ db: () => ({ query }) }));
beforeEach(() => {
  vi.resetModules();
  query.mockReset();
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("RATE_LIMIT_PER_MINUTE", "2");
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-16T00:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
it("enforces independent visitor budgets and resets at the next window", async () => {
  const { allowRequest } = await import("../lib/rate-limit");
  expect(await allowRequest("a")).toBe(true);
  expect(await allowRequest("a")).toBe(true);
  expect(await allowRequest("a")).toBe(false);
  expect(await allowRequest("b")).toBe(true);
  vi.advanceTimersByTime(60000);
  expect(await allowRequest("a")).toBe(true);
});
it("stores only hashed identifiers in the shared database counter", async () => {
  vi.stubEnv("DATABASE_URL", "postgresql://test");
  query.mockResolvedValue({ rows: [{ hits: 3 }] });
  const { allowRequest } = await import("../lib/rate-limit");
  expect(await allowRequest("192.0.2.1")).toBe(false);
  expect(query.mock.calls[0][1][0]).toMatch(/^[a-f0-9]{64}$/);
  expect(JSON.stringify(query.mock.calls)).not.toContain("192.0.2.1");
});
it("fails closed when the shared rate limiter is unavailable", async () => {
  vi.stubEnv("DATABASE_URL", "postgresql://test");
  query.mockRejectedValue(Error("database outage"));
  const { allowRequest } = await import("../lib/rate-limit");
  await expect(allowRequest("a")).rejects.toThrow("outage");
});
