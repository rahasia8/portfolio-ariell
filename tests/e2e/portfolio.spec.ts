import { test, expect } from "./fixtures";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
test("sends a question, displays citations, restores history, and clears it", async ({
  app,
}) => {
  const input = app.getByRole("textbox");
  await input.fill("What projects did you build?");
  await input.press("Enter");
  await expect(app.getByText("A test portfolio answer.")).toBeVisible();
  const citation = app.getByRole("link", { name: /Test project/ });
  await expect(citation).toHaveAttribute("href", "https://example.com/project");
  await expect(citation).toHaveAccessibleName(/opens in a new tab/);
  await app.reload();
  await expect(app.getByText("A test portfolio answer.")).toBeVisible();
  await app.getByRole("button", { name: "New conversation" }).click();
  await expect(app.getByText("A test portfolio answer.")).toHaveCount(0);
  await expect(input).toBeFocused();
});
test("supports multiline input and bounded history payloads", async ({ app }) => {
  const bodies: Record<string, unknown>[] = [];
  await app.route("**/api/chat", async (route) => {
    bodies.push(route.request().postDataJSON());
    await route.fulfill({
      json: {
        answer: "Another answer.",
        sources: [],
        conversationId: "6d10972c-dc6c-4ffa-a09d-6af675562b93",
      },
    });
  });
  const input = app.getByRole("textbox");
  await input.fill("Line one");
  await input.press("Shift+Enter");
  await input.pressSequentially("Line two");
  expect(bodies).toHaveLength(0);
  await input.press("Enter");
  await expect(app.getByText("Another answer.")).toBeVisible();
  expect(bodies[0].message).toBe("Line one\nLine two");
  expect(bodies[0].locale).toBe("en");
  await app.evaluate(() =>
    sessionStorage.setItem(
      "portfolio-chat",
      JSON.stringify({
        conversationId: "6d10972c-dc6c-4ffa-a09d-6af675562b93",
        messages: Array.from({ length: 10 }, (_, i) => ({
          id: String(i),
          role: i % 2 ? "assistant" : "user",
          content: `History ${i}`,
        })),
      }),
    ),
  );
  await app.reload();
  await input.fill("Follow-up");
  await input.press("Enter");
  await expect.poll(() => bodies.length).toBe(2);
  expect(bodies[1].history).toHaveLength(6);
  expect((bodies[1].history as { content: string }[])[0].content).toBe("History 4");
});
test("handles rate limits and permits retrying the question", async ({ app }) => {
  await app.route("**/api/chat", (route) =>
    route.fulfill({ status: 429, json: { error: "rate limit" } }),
  );
  const input = app.getByRole("textbox");
  await input.fill("My question");
  await input.press("Enter");
  await expect(app.getByRole("main").getByRole("alert")).toContainText(
    "Too many questions",
  );
  await expect(input).toHaveValue("My question");
  await expect(input).toBeEditable();
});
test("keeps input available while waiting and reports provider outages", async ({
  app,
}) => {
  let finish!: () => void;
  await app.route("**/api/chat", async (route) => {
    await new Promise<void>((resolve) => {
      finish = resolve;
    });
    await route.fulfill({ status: 503, json: { error: "outage" } });
  });
  const input = app.getByRole("textbox");
  await input.fill("Wait for answer");
  await input.press("Enter");
  await expect(app.locator(".thinking")).toBeVisible();
  await expect(input).toHaveAttribute("readonly", "");
  await expect(app.getByRole("button", { name: "Send question" })).toBeDisabled();
  finish();
  await expect(app.getByRole("main").getByRole("alert")).toContainText(
    "temporarily unavailable",
  );
});
test("preserves manual language choice and supports RTL", async ({ app }) => {
  await app.getByRole("combobox").selectOption("de");
  await expect(app.locator("html")).toHaveAttribute("lang", "de");
  await expect(app.getByRole("button", { name: "Neues Gespräch" })).toBeVisible();
  await app.reload();
  await expect(app.locator("html")).toHaveAttribute("lang", "de");
  await app.getByRole("combobox").selectOption("ar");
  await expect(app.locator("html")).toHaveAttribute("dir", "rtl");
});
test("privacy opens, closes with Escape, and restores trigger focus", async ({ app }) => {
  const trigger = app.locator('button[aria-controls="privacy-dialog"]:visible').first();
  await trigger.click();
  await expect(app.getByRole("dialog")).toBeVisible();
  await expect(
    app.getByRole("button", { name: "Close privacy information" }),
  ).toBeFocused();
  await app.keyboard.press("Escape");
  await expect(app.getByRole("dialog")).not.toBeVisible();
  await expect(trigger).toBeFocused();
});
test("skip links activate by keyboard and dark mode follows browser preference", async ({
  app,
}) => {
  const skip = app.getByRole("link", { name: "Skip to question input" });
  await skip.focus();
  await app.keyboard.press("Enter");
  await expect(app.getByRole("textbox")).toBeFocused();
  await app.emulateMedia({ colorScheme: "dark" });
  await expect
    .poll(() => app.evaluate(() => getComputedStyle(document.body).backgroundColor))
    .toBe("rgb(18, 18, 18)");
});
test("page and privacy dialog pass axe and fit the viewport", async ({ app }) => {
  await app.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
  async function audit() {
    const violations = await app.evaluate(async () => {
      const axe = (
        window as unknown as {
          axe: {
            run: (
              context: Document,
              options: unknown,
            ) => Promise<{ violations: unknown[] }>;
          };
        }
      ).axe;
      return (
        await axe.run(document, {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] },
        })
      ).violations;
    });
    expect(violations).toEqual([]);
  }
  await audit();
  expect(
    await app.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await app.locator('button[aria-controls="privacy-dialog"]:visible').first().click();
  await expect(app.getByRole("dialog")).toBeVisible();
  await audit();
});
