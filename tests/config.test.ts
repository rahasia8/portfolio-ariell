import { afterEach, expect, it, vi } from "vitest";
import { config, requireSettings } from "../lib/config";
import { closeDb } from "../lib/db";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("reports all missing settings without exposing values", () => {
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("GEMINI_API_KEY", "");
  expect(() => requireSettings(["DATABASE_URL", "GEMINI_API_KEY"])).toThrow(
    "Missing DATABASE_URL, GEMINI_API_KEY. Set these in .env.local",
  );
});
it("migration settings do not require an AI key", () => {
  vi.stubEnv("DATABASE_URL", "postgresql://localhost/portfolio");
  vi.stubEnv("GEMINI_API_KEY", "");
  expect(requireSettings(["DATABASE_URL"]).DATABASE_URL).toBe(
    "postgresql://localhost/portfolio",
  );
});
it("uses Netlify's deployment-specific database instead of a local database", () => {
  vi.stubEnv("DATABASE_URL", "postgresql://localhost/portfolio");
  vi.stubEnv("NETLIFY_DB_URL", "postgresql://cloud.example/portfolio");
  expect(config().DATABASE_URL).toBe("postgresql://cloud.example/portfolio");
});
it("prefers Netlify runtime credentials over the CLI's read-only environment", () => {
  vi.stubEnv("NETLIFY_DB_URL", "postgresql://readonly.example/portfolio");
  vi.stubGlobal("Netlify", {
    env: {
      get: (key: string) =>
        key === "NETLIFY_DB_URL" ? "postgresql://runtime.example/portfolio" : undefined,
    },
  });
  expect(config().DATABASE_URL).toBe("postgresql://runtime.example/portfolio");
});
it("rejects whitespace-only settings", () => {
  vi.stubEnv("DATABASE_URL", "   ");
  expect(() => requireSettings(["DATABASE_URL"])).toThrow("Missing DATABASE_URL");
});
it("cleanup is safe before a database pool has been created", async () => {
  vi.stubEnv("DATABASE_URL", "");
  await expect(closeDb()).resolves.toBeUndefined();
});
