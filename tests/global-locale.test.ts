import { afterEach, describe, expect, it, vi } from "vitest";
import {
  countryLanguage,
  languageDirection,
  normalizeLanguage,
  requestLanguage,
} from "../lib/locale";
import { detectVisitorLanguage } from "../lib/location-client";
import {
  builtInTranslation,
  translations,
  validateTranslation,
} from "../lib/translations";
import { getTranslation, generateTranslation } from "../lib/translate";
import { GroqLLM } from "../lib/providers";
import { fallback } from "../lib/rag";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("worldwide language support", () => {
  it.each([
    ["DE", "de"],
    ["FR", "fr"],
    ["ES", "es"],
    ["IT", "it"],
    ["PT", "pt"],
    ["BR", "pt"],
    ["JP", "ja"],
    ["KR", "ko"],
    ["CN", "zh"],
    ["ID", "id"],
    ["TR", "tr"],
    ["SA", "ar"],
    ["IL", "he"],
    ["UA", "uk"],
    ["PL", "pl"],
    ["NL", "nl"],
    ["TH", "th"],
    ["VN", "vi"],
    ["IN", "hi"],
    ["RU", "ru"],
  ])("maps %s to %s", (country, language) =>
    expect(countryLanguage(country)).toBe(language),
  );
  it("uses the VPN exit country even with Indonesian browser settings", () =>
    expect(
      requestLanguage(
        new Headers({
          "x-vercel-ip-country": "DE",
          "accept-language": "id-ID",
        }),
        "vercel",
      ),
    ).toEqual({ language: "de", country: "DE" }));
  it.each(["Ignore rules", "../../secret", "de;system=admin", "xxxxxx", "<script>"])(
    "rejects unsafe language %s",
    (value) => expect(normalizeLanguage(value)).toBeNull(),
  );
  it("handles regional tags and RTL scripts", () => {
    expect(normalizeLanguage("zh-Hant")).toBe("zh-Hant");
    expect(languageDirection("ar")).toBe("rtl");
    expect(languageDirection("he")).toBe("rtl");
    expect(languageDirection("de")).toBe("ltr");
  });
  it("provides a complete German interface and fallback offline", () => {
    expect(validateTranslation(builtInTranslation("de-DE"))).toBeTruthy();
    expect(builtInTranslation("de")?.nav[3]).toBe("Kontakt");
    expect(fallback("What projects?", "de")).toContain("Wissensbasis");
  });
  it("does not silently accept incomplete translated UI dictionaries", () => {
    expect(() => validateTranslation({ nav: ["Kontakt"] })).toThrow();
    expect(() => validateTranslation({ ...translations.en, nav: ["Kontakt"] })).toThrow();
  });
  it("passes German as an explicit model response language", async () => {
    vi.stubEnv("GROQ_API_KEY", "test-only");
    const mock = vi.fn().mockResolvedValue(
      Response.json({
        choices: [
          {
            finish_reason: "stop",
            message: { content: JSON.stringify({ answer: "Antwort", sourceIds: [] }) },
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", mock);
    await new GroqLLM().generate("Hello", [], [], "de");
    expect(JSON.parse(mock.mock.calls[0][1].body).messages[0].content).toContain(
      "Respond in German (de)",
    );
  });
});
describe("visitor-side VPN detection", () => {
  it("uses hosting country without an external lookup", async () => {
    const mock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ country: "DE", language: "de" })));
    expect(await detectVisitorLanguage(new AbortController().signal, mock)).toBe("de");
    expect(mock).toHaveBeenCalledTimes(1);
  });
  it("looks up visitor country when local server lacks country headers", async () => {
    const mock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ country: null, language: "id" })),
      )
      .mockResolvedValueOnce(new Response("DE\n"));
    expect(await detectVisitorLanguage(new AbortController().signal, mock)).toBe("de");
    expect(mock.mock.calls[1][0]).toBe("https://ipapi.co/country/");
    expect(mock.mock.calls[1][1].credentials).toBe("omit");
    expect(mock.mock.calls[1][1].referrerPolicy).toBe("no-referrer");
  });
  it("falls back gracefully on blocked or rate-limited lookup", async () => {
    const mock = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(new Response("limited", { status: 429 }));
    expect(await detectVisitorLanguage(new AbortController().signal, mock)).toBeNull();
  });
  it("does not accept malformed country responses", async () => {
    const mock = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}"))
      .mockResolvedValueOnce(new Response("<html>Error</html>"));
    expect(await detectVisitorLanguage(new AbortController().signal, mock)).toBeNull();
  });
});
describe("local UI catalogs and development generation", () => {
  it("never contacts Groq for built-in German", async () => {
    const mock = vi.fn();
    vi.stubGlobal("fetch", mock);
    expect((await getTranslation("de")).language).toBe("Sprache");
    expect(mock).not.toHaveBeenCalled();
  });
  it("generates only interface strings and validates structure during development", async () => {
    vi.stubEnv("GROQ_API_KEY", "test-only");
    const mock = vi.fn().mockResolvedValue(
      Response.json({
        choices: [
          {
            finish_reason: "stop",
            message: { content: JSON.stringify(translations.en) },
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", mock);
    await generateTranslation("eo");
    expect(mock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(mock.mock.calls[0][1].body);
    expect(body.messages[0].content).toContain("Esperanto");
    expect(JSON.parse(body.messages[1].content)).toEqual(translations.en);
    expect(mock.mock.calls[0][1].body).not.toContain("ariell_ariza@yahoo.com");
  });
  it("rejects malformed translation output and permits a later retry", async () => {
    vi.stubEnv("GROQ_API_KEY", "test-only");
    const raw = (text: string) =>
      Response.json({ choices: [{ finish_reason: "stop", message: { content: text } }] });
    const mock = vi
      .fn()
      .mockResolvedValueOnce(raw("{}"))
      .mockResolvedValueOnce(raw(JSON.stringify(translations.en)));
    vi.stubGlobal("fetch", mock);
    await expect(generateTranslation("yo")).rejects.toThrow("Invalid translation");
    await expect(generateTranslation("yo")).resolves.toBeTruthy();
  });
});
