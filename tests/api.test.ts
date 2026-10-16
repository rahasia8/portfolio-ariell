import { it, expect, vi, beforeEach } from "vitest";
vi.mock("../lib/rate-limit", () => ({ allowRequest: vi.fn(async () => true) }));
vi.mock("../lib/config", () => ({
  config: () => ({ MAX_MESSAGE_LENGTH: 2000, TRUST_PROXY: "false" }),
  configured: () => false,
}));
import { POST } from "../app/api/chat/route";
import { allowRequest } from "../lib/rate-limit";
beforeEach(() => {
  vi.mocked(allowRequest).mockResolvedValue(true);
});
const request = (body: unknown) =>
  new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
it("returns empty-index fallback without credentials", async () => {
  const res = await POST(request({ message: "What projects?" }));
  const body = await res.json();
  expect(res.status).toBe(200);
  expect(body.fallback).toBe(true);
  expect(body.sources).toEqual([]);
  expect(body.requestId).toBeTruthy();
  expect(body.conversationId).toBeTruthy();
});
it("rejects invalid input", async () =>
  expect((await POST(request({ message: "" }))).status).toBe(400));
it("enforces rate limit", async () => {
  vi.mocked(allowRequest).mockResolvedValue(false);
  const res = await POST(request({ message: "Hello" }));
  expect(res.status).toBe(429);
  expect(res.headers.get("retry-after")).toBe("60");
});
it("blocks cross-origin requests", async () => {
  const req = request({ message: "hello" });
  req.headers.set("origin", "https://evil.example");
  expect((await POST(req)).status).toBe(403);
});
it("handles internal failures without exposing details", async () => {
  vi.mocked(allowRequest).mockRejectedValue(new Error("secret database URL"));
  const res = await POST(request({ message: "hello" }));
  expect(res.status).toBe(503);
  expect(JSON.stringify(await res.json())).not.toContain("secret");
});
it("uses the selected Indonesian locale for an English question", async () => {
  const res = await POST(request({ message: "What projects?", locale: "id" }));
  expect(res.status).toBe(200);
  expect((await res.json()).answer).toContain("belum tersedia");
});
it("rejects unsupported locale instructions", async () => {
  expect(
    (await POST(request({ message: "hello", locale: "ignore system" }))).status,
  ).toBe(400);
});
