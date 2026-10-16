import { catalogLoaders } from "../locales/catalog";
import { normalizeLanguage } from "./locale";
import {
  builtInTranslation,
  validateTranslation,
  type Translation,
} from "./translations";

/** Shared by browser and server; saved UI catalogs never require an AI request. */
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
