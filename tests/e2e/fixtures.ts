import { test as base, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
export const test = base.extend<{ app: import("@playwright/test").Page }>({
  app: async ({ page, baseURL }, use) => {
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== new URL(baseURL!).origin) return route.abort();
      if (url.pathname === "/api/locale")
        return route.fulfill({ json: { country: "US", language: "en" } });
      if (url.pathname === "/api/health")
        return route.fulfill({ json: { status: "ok", knowledgeReady: true } });
      if (url.pathname === "/api/translations") {
        const locale = url.searchParams.get("locale") || "en";
        if (!/^[a-z]{2,3}(?:-[A-Za-z]{2,8}){0,2}$/.test(locale))
          return route.fulfill({ status: 400 });
        const messages = JSON.parse(
          await readFile(`locales/messages/${locale.split("-")[0]}.json`, "utf8"),
        );
        return route.fulfill({ json: { locale, messages } });
      }
      if (url.pathname === "/api/chat")
        return route.fulfill({
          json: {
            answer: "A test portfolio answer.",
            sources: [
              {
                sourceId: "test-project",
                title: "Test project",
                url: "https://example.com/project",
              },
            ],
            conversationId: "6d10972c-dc6c-4ffa-a09d-6af675562b93",
          },
        });
      return route.continue();
    });
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await use(page);
  },
});
export { expect };
