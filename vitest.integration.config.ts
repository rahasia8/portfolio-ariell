import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
if (!process.env.TEST_DATABASE_URL)
  throw new Error(
    "Set TEST_DATABASE_URL in .env.test.local or the shell to a dedicated test database.",
  );
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 15000,
    hookTimeout: 15000,
    fileParallelism: false,
  },
});
