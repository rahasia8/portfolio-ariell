import { describe, it, expect, vi, afterEach } from "vitest";
import { readFile, readdir } from "node:fs/promises";
import catalog from "../locales/catalog.json";
import countries from "../locales/countries.json";
import { catalogLoaders } from "../locales/catalog";
import { getTranslation } from "../lib/translate";
import { translations, validateTranslation } from "../lib/translations";
import { countryLanguage, languageOptions } from "../lib/locale";
afterEach(() => vi.unstubAllGlobals());
describe("JSON translation catalogs", () => {
  it("does not contact AI for an unknown runtime catalog", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(getTranslation("eo")).rejects.toThrow("Local translation unavailable");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("has a complete local catalog for every selectable language without an AI request", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    for (const language of languageOptions) {
      expect(catalogLoaders[language], language).toBeTypeOf("function");
      const messages = await getTranslation(language);
      expect(validateTranslation(messages)).toBeTruthy();
      expect(messages.accessibility.remaining, language).toContain("{count}");
      expect(
        messages.suggestions.map((item) => item.icon),
        language,
      ).toEqual(["01", "02", "03"]);
      if (language !== "en")
        expect(messages.heading, language).not.toBe(translations.en.heading);
    }
    expect(fetch).not.toHaveBeenCalled();
  });
  it("registers every messages JSON file and loads its full shape", async () => {
    const files = (await readdir("locales/messages"))
      .filter((file) => file.endsWith(".json"))
      .sort();
    expect(files).toEqual(
      Object.values(catalog)
        .map((file) => file.replace("messages/", ""))
        .sort(),
    );
    expect(Object.keys(catalogLoaders).sort()).toEqual(Object.keys(catalog).sort());
    for (const [locale, load] of Object.entries(catalogLoaders)) {
      const messages = validateTranslation(await load());
      expect(messages).toEqual(
        JSON.parse(await readFile(`locales/messages/${locale}.json`, "utf8")),
      );
    }
  });
  it("loads saved French region variants without contacting Groq", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect((await getTranslation("fr-CA")).language).toBe("Langue");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("preserves intentional empty heading fragments in valid catalogs", () => {
    expect(validateTranslation(translations.id).headingLead).toBe("");
    expect(() => validateTranslation({ ...translations.en, placeholder: "" })).toThrow();
  });
  it("records multilingual alternatives and traditional Chinese countries", () => {
    expect(countries.CH.languages).toEqual(expect.arrayContaining(["de", "fr", "it"]));
    expect(countryLanguage("TW")).toBe("zh-Hant");
    expect(countryLanguage("HK")).toBe("zh-Hant");
    expect(countryLanguage("DE")).toBe("de");
    expect(countryLanguage("FR")).toBe("fr");
    expect(Object.keys(countries).length).toBeGreaterThan(240);
  });
});
