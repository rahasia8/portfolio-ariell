import { afterEach, expect, it, vi } from "vitest";
import { allowedRequestOrigin } from "../lib/request-origin";

afterEach(() => vi.unstubAllEnvs());
it("accepts the configured public origin behind an internal proxy URL", () => {
  vi.stubEnv("APP_ORIGIN", "https://portfolio.netlify.app");
  const request = new Request("http://internal:3000/api/chat", {
    headers: { origin: "https://portfolio.netlify.app" },
  });
  expect(allowedRequestOrigin(request)).toBe(true);
});
it("rejects a foreign origin even with spoofed forwarded headers", () => {
  vi.stubEnv("APP_ORIGIN", "https://portfolio.netlify.app");
  const request = new Request("http://internal:3000/api/chat", {
    headers: {
      origin: "https://evil.example",
      "x-forwarded-host": "evil.example",
      "x-forwarded-proto": "https",
    },
  });
  expect(allowedRequestOrigin(request)).toBe(false);
});
it("preserves same-origin requests without hosting configuration", () => {
  vi.stubEnv("APP_ORIGIN", "");
  expect(
    allowedRequestOrigin(
      new Request("http://localhost:3000/api/chat", {
        headers: { origin: "http://localhost:3000" },
      }),
    ),
  ).toBe(true);
});
it("rejects invalid configuration and null origins", () => {
  vi.stubEnv("APP_ORIGIN", "not a URL");
  expect(
    allowedRequestOrigin(
      new Request("https://portfolio.example/api/chat", {
        headers: { origin: "null" },
      }),
    ),
  ).toBe(false);
});
