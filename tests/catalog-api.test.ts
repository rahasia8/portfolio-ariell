import { it, expect, vi } from "vitest";
vi.mock("../lib/rate-limit", () => ({
  allowRequest: vi.fn(() => {
    throw new Error("Database unavailable");
  }),
}));
import { GET } from "../app/api/translations/route";
import { allowRequest } from "../lib/rate-limit";
it("serves saved translation JSON without database or AI availability", async () => {
  const response = await GET(
    new Request("http://localhost/api/translations?locale=fr-CA"),
  );
  expect(response.status).toBe(200);
  expect((await response.json()).messages.language).toBe("Langue");
  expect(allowRequest).not.toHaveBeenCalled();
});
it("rejects unsupported locale paths", async () => {
  const response = await GET(
    new Request("http://localhost/api/translations?locale=../../secret"),
  );
  expect(response.status).toBe(400);
});

it("does not generate unsupported catalogs at request time", async () => {
  const response = await GET(new Request("http://localhost/api/translations?locale=eo"));
  expect(response.status).toBe(404);
  expect(allowRequest).not.toHaveBeenCalled();
});
