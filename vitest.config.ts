import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    exclude: ["tests/integration/**", "tests/e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["lib/**/*.ts", "app/api/**/*.ts"],
      exclude: ["lib/types.ts"],
      thresholds: { lines: 75, functions: 75, branches: 65, statements: 75 },
    },
  },
});
