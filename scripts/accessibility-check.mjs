import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { chromium } from "playwright-core";
const require = createRequire(import.meta.url);
const base = process.env.A11Y_BASE_URL || "http://127.0.0.1:3000";
const origin = new URL(base).origin;
const executablePath =
  process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const browser = await chromium.launch({ executablePath, headless: true });
const context = await browser.newContext({
  locale: "en-US",
  colorScheme: "light",
  viewport: { width: 1280, height: 900 },
  reducedMotion: "reduce",
});
let submitted = [];
let releaseBusy;
await context.route("**/*", async (route) => {
  const request = route.request(),
    url = new URL(request.url());
  // Keep all test data local; never send portfolio content or visitor metadata externally.
  if (url.origin === "https://ipapi.co" && url.pathname === "/country/")
    return route.fulfill({ body: "US", contentType: "text/plain" });
  if (url.origin !== origin) return route.abort();
  if (url.pathname === "/api/locale")
    return route.fulfill({ json: { country: "US", language: "en" } });
  if (url.pathname === "/api/health")
    return route.fulfill({ json: { status: "ok", knowledgeReady: true } });
  if (url.pathname === "/api/chat") {
    const payload = request.postDataJSON();
    submitted.push(payload);
    if (payload.message === "Trigger error")
      return route.fulfill({ status: 503, json: { error: "Test outage" } });
    if (payload.message === "Busy test")
      await new Promise((resolve) => {
        releaseBusy = resolve;
      });
    await new Promise((resolve) => setTimeout(resolve, 150));
    return route.fulfill({
      json: {
        answer:
          "A source-backed test answer. LinkedIn: https://www.linkedin.com/in/ariell-test",
        sources: [
          { sourceId: "test", title: "Test source", url: "https://example.com/source" },
        ],
        conversationId: "6d10972c-dc6c-4ffa-a09d-6af675562b93",
      },
    });
  }
  return route.continue();
});
const page = await context.newPage();
page.on("pageerror", (error) => console.error("Browser runtime:", error.message));
async function audit(label) {
  if (!(await page.evaluate(() => Boolean(window.axe))))
    await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
  const result = await page.evaluate(async () =>
    window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] },
    }),
  );
  assert.deepEqual(
    result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
    [],
    label,
  );
  console.log(`${label}: axe passed`);
}
async function visiblePrivacy() {
  return page.locator('button[aria-controls="privacy-dialog"]:visible').first();
}
try {
  await page.goto(base);
  await page.locator("#question").waitFor();
  await page.waitForFunction(() =>
    Object.keys(document.querySelector("#question")).some((key) =>
      key.startsWith("__reactProps"),
    ),
  );
  await page.waitForFunction(() => document.documentElement.lang === "en");
  await page.keyboard.press("Tab");
  const tabReachesSkip = await page
    .locator(".skip-links a")
    .first()
    .evaluate((el) => el === document.activeElement);
  if (!tabReachesSkip)
    console.log(
      "Platform limits native Tab navigation; checking skip-link focus and activation explicitly. Enable full keyboard navigation on macOS for the first-Tab check.",
    );
  assert.equal(
    await page.locator("a,button,select,textarea").first().getAttribute("href"),
    "#main",
    "Skip link is first in DOM focus order",
  );
  await page.locator(".skip-links a").first().focus();
  assert.equal(
    await page
      .locator(".skip-links a")
      .first()
      .evaluate((el) => el.getBoundingClientRect().top >= 0),
    true,
    "Focused skip link is visible",
  );
  await page.keyboard.press("Enter");
  assert.equal(
    await page.locator("main").evaluate((el) => el === document.activeElement),
    true,
    "Skip link focuses main",
  );
  await page.locator(".skip-links a").nth(1).focus();
  await page.keyboard.press("Enter");
  assert.equal(
    await page.locator("#question").evaluate((el) => el === document.activeElement),
    true,
    "Skip to input focuses field",
  );
  await audit("Desktop light");
  const trigger = await visiblePrivacy();
  await trigger.click();
  await page.waitForFunction(() => document.querySelector("dialog")?.open === true);
  assert.equal(await page.locator("dialog").evaluate((el) => el.open), true);
  for (const key of ["Tab", "Tab", "Shift+Tab", "Shift+Tab"]) {
    await page.keyboard.press(key);
    assert.equal(
      await page
        .locator("dialog")
        .evaluate(
          (el) =>
            el.contains(document.activeElement) ||
            document.activeElement === document.body,
        ),
      true,
      "Dialog retains keyboard focus",
    );
  }
  await audit("Privacy dialog");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.querySelector("dialog")?.open === false);
  assert.equal(await page.locator("dialog").evaluate((el) => el.open), false);
  assert.equal(
    await trigger.evaluate((el) => el === document.activeElement),
    true,
    "Focus returns to trigger",
  );
  const input = page.locator("#question");
  await input.fill("First line");
  await input.press("Shift+Enter");
  assert.equal(submitted.length, 0, "Shift+Enter does not submit");
  assert.match(await input.inputValue(), /\n/);
  await input.fill("Test question");
  await input.press("Enter");
  await page.getByText("A source-backed test answer.", { exact: false }).waitFor();
  assert.equal(submitted.length, 1);
  assert.match(
    (await page.locator(".message-text a").getAttribute("aria-label")) ||
      (await page.locator(".message-text a").textContent()),
    /opens in a new tab/,
  );
  await audit("Answered conversation");
  await input.fill("Busy test");
  await input.press("Enter");
  await page.locator(".thinking").waitFor();
  assert.equal(
    await input.getAttribute("readonly"),
    "",
    "Input remains focusable and read-only while sending",
  );
  await audit("Loading state");
  releaseBusy();
  await page.locator(".thinking").waitFor({ state: "hidden" });
  await input.fill("Trigger error");
  await input.press("Enter");
  await page.locator("#question-error").waitFor();
  assert.match(await input.getAttribute("aria-describedby"), /question-error/);
  await audit("Provider error state");
  await page.emulateMedia({ colorScheme: "dark" });
  await audit("Desktop dark");
  await page.setViewportSize({ width: 320, height: 720 });
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    true,
    "Mobile has no horizontal overflow",
  );
  assert.equal(
    await (await visiblePrivacy()).isVisible(),
    true,
    "Privacy remains available on mobile",
  );
  await audit("Mobile dark");
  await (await visiblePrivacy()).click();
  await page.waitForFunction(() => document.querySelector("dialog")?.open === true);
  await audit("Mobile privacy dialog");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.querySelector("dialog")?.open === false);
  await page.getByRole("combobox").fill("ar");
  await page.locator(`[role="option"][data-value="${"ar"}"]`).click();
  await page.waitForFunction(
    () =>
      document.documentElement.dir === "rtl" && document.documentElement.lang === "ar",
  );
  await audit("Arabic RTL");
  await page.getByRole("combobox").fill("en");
  await page.locator(`[role="option"][data-value="${"en"}"]`).click();
  await page.waitForFunction(() => document.documentElement.dir === "ltr");
  await page.emulateMedia({ forcedColors: "active" });
  await audit("Forced colors");
  console.log(
    "Keyboard, modal focus/Escape/restore, multiline input, contact-link notice, mobile reflow, dark mode, RTL, and forced-colors checks passed.",
  );
} finally {
  await browser.close();
}
