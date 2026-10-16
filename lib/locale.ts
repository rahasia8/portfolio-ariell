import countries from "../locales/countries.json";
import catalog from "../locales/catalog.json";
export type Language = string;
export function normalizeLanguage(value: unknown): Language | null {
  if (typeof value !== "string" || !/^[a-z]{2,3}(?:-[a-zA-Z]{2,8}){0,2}$/.test(value))
    return null;
  try {
    const tag = new Intl.Locale(value).baseName;
    // Date formatting support varies by browser and does not determine whether
    // our own JSON translation is supported (for example Welsh in Chromium).
    if (Object.hasOwn(catalog, tag) || Object.hasOwn(catalog, tag.split("-")[0]))
      return tag;
    return Intl.DateTimeFormat.supportedLocalesOf([tag]).length ? tag : null;
  } catch {
    return null;
  }
}
export function countryLanguage(country: string): Language {
  const entry = (
    countries as Record<string, { defaultLocale: string; languages: string[] }>
  )[country.toUpperCase()];
  if (entry) return normalizeLanguage(entry.defaultLocale) || "en";
  try {
    return (
      normalizeLanguage(new Intl.Locale(`und-${country}`).maximize().language) || "en"
    );
  } catch {
    return "en";
  }
}
export function languageName(language: Language): string {
  return new Intl.DisplayNames(["en"], { type: "language" }).of(language) || language;
}
export function languageDirection(language: Language): "rtl" | "ltr" {
  try {
    return ["Arab", "Hebr", "Thaa", "Nkoo", "Adlm"].includes(
      new Intl.Locale(language).maximize().script || "",
    )
      ? "rtl"
      : "ltr";
  } catch {
    return "ltr";
  }
}
export function browserLanguage(
  languages: readonly string[],
  _timeZone?: string,
): Language {
  for (const tag of languages) {
    const language = normalizeLanguage(tag);
    if (language) return language;
  }
  return "en";
}
export function requestLanguage(
  headers: Headers,
  provider = process.env.LOCATION_PROVIDER ??
    (process.env.VERCEL === "1" ? "vercel" : undefined),
): { language: Language; country: string | null } {
  const raw =
    provider === "vercel"
      ? headers.get("x-vercel-ip-country")
      : provider === "cloudflare"
        ? headers.get("cf-ipcountry")
        : null;
  const country =
    raw && /^[A-Z]{2}$/.test(raw) && !["XX", "T1"].includes(raw) ? raw : null;
  if (country) return { language: countryLanguage(country), country };
  const languages = (headers.get("accept-language") || "")
    .split(",")
    .map((value, index) => {
      const [tag, ...parameters] = value.trim().split(";");
      const q = parameters.find((p) => p.trim().startsWith("q="));
      return { tag, weight: q ? Number(q.trim().slice(2)) : 1, index };
    })
    .filter((v) => Number.isFinite(v.weight) && v.weight > 0 && v.weight <= 1)
    .sort((a, b) => b.weight - a.weight || a.index - b.index)
    .map((v) => v.tag);
  return { language: browserLanguage(languages), country: null };
}
export const languageOptions = [
  "en",
  "id",
  "de",
  "fr",
  "es",
  "it",
  "pt",
  "nl",
  "pl",
  "uk",
  "ru",
  "tr",
  "ar",
  "he",
  "fa",
  "ur",
  "hi",
  "bn",
  "ta",
  "te",
  "mr",
  "gu",
  "pa",
  "ne",
  "si",
  "ja",
  "ko",
  "zh",
  "zh-Hant",
  "vi",
  "th",
  "ms",
  "fil",
  "my",
  "km",
  "lo",
  "sv",
  "da",
  "nb",
  "fi",
  "is",
  "el",
  "cs",
  "sk",
  "hu",
  "ro",
  "bg",
  "sr",
  "hr",
  "sl",
  "lt",
  "lv",
  "et",
  "sw",
  "af",
  "am",
  "az",
  "ka",
  "hy",
  "kk",
  "uz",
  "mn",
  "eu",
  "ca",
  "gl",
  "cy",
  "ga",
  "mt",
  "sq",
  "mk",
  "bs",
  "zu",
];
