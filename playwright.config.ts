import { defineConfig, devices } from "@playwright/test";
const port = Number(process.env.E2E_PORT || 3102);
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 2,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    locale: "en-US",
    colorScheme: "light",
    reducedMotion: "reduce",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      ...(process.env.CHROME_PATH
        ? { executablePath: process.env.CHROME_PATH }
        : process.platform === "darwin"
          ? {
              executablePath:
                "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            }
          : {}),
    },
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: {
    command: `npm run start -- --hostname 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 60000,
    env: {
      DATABASE_URL: "",
      GROQ_API_KEY: "",
      LOCATION_PROVIDER: "none",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
