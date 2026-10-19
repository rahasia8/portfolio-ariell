import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test, expect } from "./fixtures";

const require = createRequire(import.meta.url);

test("searches native names and selects a language with the keyboard", async ({
  app,
}) => {
  const picker = app.getByRole("combobox");
  await picker.fill("Deutsch");
  await expect(app.getByRole("option")).toHaveCount(1);
  await expect(app.getByRole("option")).toHaveAttribute("data-value", "de");
  await picker.press("Enter");
  await expect(app.locator("html")).toHaveAttribute("lang", "de");
  await expect(picker).toHaveValue("Deutsch");
  await expect(picker).toHaveAttribute("aria-expanded", "false");
  await expect(picker).toBeFocused();

  await picker.fill("Japanese");
  await expect(app.getByRole("option")).toHaveAttribute("data-value", "ja");
  await picker.press("Escape");
  await expect(picker).toHaveValue("Deutsch");
  await expect(app.locator("html")).toHaveAttribute("lang", "de");

  await picker.fill("id");
  await picker.press("ArrowDown");
  const active = await picker.getAttribute("aria-activedescendant");
  expect(active).toBeTruthy();
  const option = app.locator(`[id="${active}"]`);
  const language = await option.getAttribute("data-value");
  await picker.press("Enter");
  await expect(app.locator("html")).toHaveAttribute("lang", language!);
});

test("shows localized empty results and recovers without changing language", async ({
  app,
}) => {
  const picker = app.getByRole("combobox");
  for (const locale of ["id", "ar"]) {
    const messages = JSON.parse(
      await readFile(`locales/messages/${locale}.json`, "utf8"),
    );
    await picker.fill(locale);
    await app.locator(`[role="option"][data-value="${locale}"]`).click();
    await expect(app.locator("html")).toHaveAttribute("lang", locale);
    await expect(picker).toHaveAccessibleName(messages.language);
    await picker.fill("zzzz-no-such-language");
    await expect(app.getByRole("option")).toHaveCount(0);
    await expect(app.locator(".language-empty")).toHaveText(messages.languageNotFound);
    await picker.press("Enter");
    await expect(app.locator("html")).toHaveAttribute("lang", locale);
    await picker.fill("");
    await expect(app.locator('[role="option"][data-value="auto"]')).toBeVisible();
    await expect(app.locator('[role="option"][data-value="id"]')).toHaveCount(1);
    await app.getByRole("heading", { level: 1 }).click();
    await expect(picker).toHaveAttribute("aria-expanded", "false");
  }
});

test("open language options match the field width and pass axe at 320px", async ({
  app,
}) => {
  await app.setViewportSize({ width: 320, height: 740 });
  await app.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
  const picker = app.getByRole("combobox");
  await picker.click();
  const field = await picker.boundingBox();
  const options = await app.locator(".language-options").boundingBox();
  expect(field).toBeTruthy();
  expect(options).toBeTruthy();
  expect(options!.width).toBeCloseTo(field!.width, 0);
  expect(options!.x).toBeGreaterThanOrEqual(0);
  expect(options!.x + options!.width).toBeLessThanOrEqual(320);
  for (const query of ["", "zzzz-no-such-language"]) {
    await picker.fill(query);
    const violations = await app.evaluate(async () => {
      const { axe } = window as unknown as {
        axe: {
          run: (
            context: Document,
            options: unknown,
          ) => Promise<{ violations: unknown[] }>;
        };
      };
      return (
        await axe.run(document, {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] },
        })
      ).violations;
    });
    expect(violations).toEqual([]);
  }
});
