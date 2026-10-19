import { readFile } from "node:fs/promises";
import { test, expect } from "./fixtures";

test("switches all welcome content and preserves the chosen language", async ({
  app,
}) => {
  for (const locale of ["id", "de", "fr", "ar"]) {
    const messages = JSON.parse(
      await readFile(`locales/messages/${locale}.json`, "utf8"),
    );
    await app.getByRole("combobox").fill(locale);
    await app.locator(`[role="option"][data-value="${locale}"]`).click();
    await expect(app.locator("html")).toHaveAttribute("lang", locale);
    await expect(app.getByRole("heading", { level: 1 })).toHaveText(messages.heading);
    await expect(app.locator(".intro-copy")).toHaveText(messages.intro);
    await expect(app.locator("#suggestions-title")).toHaveText(messages.explore);
    await expect(app.getByRole("textbox")).toHaveAttribute(
      "placeholder",
      messages.placeholder,
    );
    await expect(app.locator(".suggestion-label")).toHaveText(messages.nav);
  }
  await app.reload();
  await expect(app.locator("html")).toHaveAttribute("lang", "ar");
  await expect(app.locator("html")).toHaveAttribute("dir", "rtl");
  const arabic = JSON.parse(await readFile("locales/messages/ar.json", "utf8"));
  await expect(app.getByRole("heading", { level: 1 })).toHaveText(arabic.heading);
});

test("saved languages work even when the translation endpoint is unavailable", async ({
  app,
}) => {
  test.setTimeout(180000);
  const languageOptions = Object.keys(
    JSON.parse(await readFile("locales/catalog.json", "utf8")),
  );
  let requests = 0;
  await app.route("**/api/translations?**", (route) => {
    requests++;
    return route.fulfill({ status: 503, json: { error: "Translation unavailable" } });
  });
  for (const locale of languageOptions) {
    const messages = JSON.parse(
      await readFile(`locales/messages/${locale}.json`, "utf8"),
    );
    await app.getByRole("combobox").fill(locale);
    await app.locator(`[role="option"][data-value="${locale}"]`).click();
    await expect(app.getByRole("heading", { level: 1 })).toHaveText(messages.heading);
  }
  expect(requests).toBe(0);
  await app.getByRole("combobox").fill("");
  const options = await app
    .getByRole("option")
    .evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("data-value")),
    );
  expect(options).toEqual(expect.arrayContaining(languageOptions));
});
