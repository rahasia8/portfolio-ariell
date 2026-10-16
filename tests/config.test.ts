import { afterEach, expect, it, vi } from "vitest";
import { requireSettings } from "../lib/config";
import { closeDb } from "../lib/db";
afterEach(() => {
  vi.unstubAllEnvs();
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
it("rejects whitespace-only settings", () => {
  vi.stubEnv("DATABASE_URL", "   ");
  expect(() => requireSettings(["DATABASE_URL"])).toThrow("Missing DATABASE_URL");
});
it("cleanup is safe before a database pool has been created", async () => {
  vi.stubEnv("DATABASE_URL", "");
  await expect(closeDb()).resolves.toBeUndefined();
});
