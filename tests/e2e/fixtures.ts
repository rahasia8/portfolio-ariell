import { test as base, expect } from "@playwright/test";
export const test = base.extend<{ app: import("@playwright/test").Page }>({
  app: async ({ page, baseURL }, use) => {
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.origin === "https://ipapi.co" && url.pathname === "/country/")
        return route.fulfill({ body: "US", contentType: "text/plain" });
      if (url.origin !== new URL(baseURL!).origin) return route.abort();
      if (url.pathname === "/api/locale")
        return route.fulfill({ json: { country: "US", language: "en" } });
      if (url.pathname === "/api/health")
        return route.fulfill({ json: { status: "ok", knowledgeReady: true } });
      if (url.pathname === "/api/chat")
        return route.fulfill({
          json: {
            answer:
              "A test portfolio answer. Email: ariell@example.com. LinkedIn: https://www.linkedin.com/in/ariell-test.",
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
