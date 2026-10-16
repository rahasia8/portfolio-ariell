import { geminiRequest } from "./gemini-request";
import { loadSavedTranslation } from "./saved-translation";
export { loadSavedTranslation } from "./saved-translation";
import { config } from "./config";
import { languageName, normalizeLanguage } from "./locale";
import { translations, validateTranslation, type Translation } from "./translations";
// Runtime callers only read versioned catalogs. AI generation is development tooling.
export async function getTranslation(raw: string): Promise<Translation> {
  const language = normalizeLanguage(raw);
  if (!language) throw new Error("Unsupported language");
  const local = await loadSavedTranslation(language);
  if (!local) throw new Error("Local translation unavailable");
  return local;
}

// Content tooling must request a fresh translation rather than copying a base locale.
export async function generateTranslation(rawLocale: string): Promise<Translation> {
  const language = normalizeLanguage(rawLocale);
  if (!language) throw new Error("Unsupported language");
  const c = config();
  if (!c.GEMINI_API_KEY) throw new Error("Translation service unavailable");
  const raw = await geminiRequest(
    c.GENERATION_MODEL,
    "generateContent",
    {
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
    },
    30000,
  );
  const text = raw.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p.text || "")
    .join("");
  const result = validateTranslation(JSON.parse(text || "null"));
  return result;
}
