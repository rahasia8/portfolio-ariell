import { groqRequest } from "./groq-request";
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
  const instruction = `Translate all string VALUES in the supplied UI dictionary into ${languageName(language)} (${language}). Preserve every JSON key, array length/order, and object structure exactly. Preserve numeric icons, URLs, product names, email addresses, keyboard symbols, placeholders such as {count}, and proper names. Return only the translated JSON object. Do not add commentary or new facts.`;
  const raw = await groqRequest(
    {
      model: c.GROQ_MODEL,
      messages: [
        { role: "system", content: instruction },
        { role: "user", content: JSON.stringify(translations.en) },
      ],
      temperature: 0,
      max_completion_tokens: 12000,
      response_format: { type: "json_object" },
    },
    30000,
  );
  if (raw.choices?.[0]?.finish_reason !== "stop")
    throw new Error("Incomplete provider translation");
  return validateTranslation(JSON.parse(raw.choices?.[0]?.message?.content || "null"));
}
