import { afterEach, it, expect, vi } from "vitest";
const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("../lib/db", () => ({ db: () => ({ query }) }));
import { GET } from "../app/api/health/route";
afterEach(() => {
  vi.unstubAllEnvs();
  query.mockReset();
});
it("reports setup required without connecting to an unconfigured database", async () => {
  vi.stubEnv("DATABASE_URL", "");
  const res = await GET();
  expect(await res.json()).toEqual({
    status: "setup_required",
    knowledgeReady: false,
  });
  expect(query).not.toHaveBeenCalled();
});
it("reports a configured populated public index as ready", async () => {
  vi.stubEnv("DATABASE_URL", "postgresql://test");
  vi.stubEnv("GEMINI_API_KEY", "test-only");
  query.mockResolvedValue({ rows: [{ count: 2 }] });
  const res = await GET();
  expect(await res.json()).toEqual({ status: "ok", knowledgeReady: true });
  expect(res.headers.get("cache-control")).toBe("no-store");
});
it("handles a configured but empty index", async () => {
  vi.stubEnv("DATABASE_URL", "postgresql://test");
  vi.stubEnv("GEMINI_API_KEY", "test-only");
  query.mockResolvedValue({ rows: [{ count: 0 }] });
  expect((await (await GET()).json()).knowledgeReady).toBe(false);
});
it("does not leak database failure details", async () => {
  vi.stubEnv("DATABASE_URL", "postgresql://test");
  query.mockRejectedValue(Error("secret credentials"));
  const res = await GET();
  expect(res.status).toBe(503);
  expect(await res.json()).toEqual({
    status: "unavailable",
    knowledgeReady: false,
  });
});
