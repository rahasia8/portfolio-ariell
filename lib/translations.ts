import catalog from "../locales/catalog.json";
import en from "../locales/messages/en.json";
import id from "../locales/messages/id.json";
import de from "../locales/messages/de.json";

export const translations = { en, id, de };
export type Translation = typeof en;
// The initial-render dictionaries stay synchronous; other JSON catalogs load lazily.
export function builtInTranslation(language: string): Translation | undefined {
  const base = language.split("-")[0] as keyof typeof translations;
  if (language !== base && Object.hasOwn(catalog, language)) return undefined;
  return Object.hasOwn(translations, base) ? translations[base] : undefined;
}

export function validateTranslation(
  value: unknown,
  template: unknown = translations.en,
): Translation {
  function check(candidate: unknown, source: unknown, key = ""): boolean {
    if (typeof source === "string")
      return (
        typeof candidate === "string" &&
        (candidate.length > 0 || key === "headingLead") &&
        candidate.length <= 10000
      );
    if (Array.isArray(source))
      return (
        Array.isArray(candidate) &&
        candidate.length === source.length &&
        source.every((item, i) => check(candidate[i], item))
      );
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate))
      return false;
    const expected = source as Record<string, unknown>,
      actual = candidate as Record<string, unknown>;
    return (
      Object.keys(actual).length === Object.keys(expected).length &&
      Object.keys(expected).every(
        (key) => Object.hasOwn(actual, key) && check(actual[key], expected[key], key),
      )
    );
  }
  if (!check(value, template)) throw new Error("Invalid translation response");
  return value as Translation;
}
