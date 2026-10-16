import { test, expect } from "@playwright/test";
test("real HTTP chat rejects invalid payloads and returns an honest unconfigured fallback", async ({
  request,
}) => {
  const invalid = await request.post("/api/chat", {
    data: { message: "", locale: "en" },
  });
  expect(invalid.status()).toBe(400);
  const valid = await request.post("/api/chat", {
    data: { message: "What projects?", locale: "id" },
  });
  expect(valid.status()).toBe(200);
  expect(await valid.json()).toMatchObject({ fallback: true, sources: [] });
  expect((await valid.json()).answer).toContain("belum tersedia");
});
test("real health and locale endpoints return uncached safe metadata", async ({
  request,
}) => {
  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect(await health.json()).toMatchObject({
    status: "setup_required",
    knowledgeReady: false,
  });
  expect(health.headers()["cache-control"]).toBe("no-store");
  const locale = await request.get("/api/locale", {
    headers: { "accept-language": "de-DE" },
  });
  expect(await locale.json()).toMatchObject({ language: "de-DE", country: null });
  expect(locale.headers()["cache-control"]).toContain("no-store");
});
