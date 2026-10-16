import { catalogLoaders } from "../locales/catalog";
import { config } from "./config";
import { languageName, normalizeLanguage } from "./locale";
import {
  builtInTranslation,
  translations,
  validateTranslation,
  type Translation,
} from "./translations";
const cache = new Map<string, { expires: number; value: Translation }>();
const pending = new Map<string, Promise<Translation>>();
export async function getTranslation(raw: string): Promise<Translation> {
  const language = normalizeLanguage(raw);
  if (!language) throw new Error("Unsupported language");
  const local = await loadSavedTranslation(language);
  if (local) return local;
  const saved = cache.get(language);
  if (saved && saved.expires > Date.now()) return saved.value;
  const inFlight = pending.get(language);
  if (inFlight) return inFlight;
  if (pending.size >= 8) throw new Error("Translation service busy");
  const task = (async () => {
    const result = await generateTranslation(language);
    if (cache.size >= 128) cache.delete(cache.keys().next().value!);
    cache.set(language, { value: result, expires: Date.now() + 86400000 });
    return result;
  })();
  pending.set(language, task);
  try {
    return await task;
  } finally {
    pending.delete(language);
  }
}

// Content tooling must request a fresh translation rather than copying a base locale.
export async function generateTranslation(rawLocale: string): Promise<Translation> {
  const language = normalizeLanguage(rawLocale);
  if (!language) throw new Error("Unsupported language");
  const c = config();
  if (!c.GEMINI_API_KEY) throw new Error("Translation service unavailable");
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${c.GENERATION_MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": c.GEMINI_API_KEY,
      },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: `Translate all string VALUES in the supplied UI dictionary into ${languageName(language)} (${language}). Preserve every JSON key, array length/order, and object structure exactly. Preserve numeric icons, URLs, product names, email addresses, keyboard symbols, placeholders such as {count}, and proper names. Return only the translated JSON object. Do not add commentary or new facts.`,
            },
          ],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: JSON.stringify(translations.en) }],
          },
        ],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 12000,
          responseMimeType: "application/json",
        },
      }),
    },
  );
  if (!response.ok)
    throw new Error(`Translation service unavailable (HTTP ${response.status})`);
  const raw = await response.json();
  const text = raw.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p.text || "")
    .join("");
  const result = validateTranslation(JSON.parse(text || "null"));
  return result;
}

export async function loadSavedTranslation(
  raw: string,
): Promise<Translation | undefined> {
  const language = normalizeLanguage(raw);
  if (!language) return undefined;
  const parts = language.split("-");
  const candidates = [
    language,
    ...(parts.length > 2 ? [parts.slice(0, 2).join("-")] : []),
    parts[0],
  ];
  for (const candidate of [...new Set(candidates)]) {
    const load = catalogLoaders[candidate];
    if (load) return validateTranslation(await load());
  }
  return builtInTranslation(language);
}
