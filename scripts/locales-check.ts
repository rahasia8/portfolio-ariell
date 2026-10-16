import { readFile, readdir } from "node:fs/promises";
import { validateTranslation } from "../lib/translations";
import { normalizeLanguage } from "../lib/locale";
import countries from "../locales/countries.json";
import catalog from "../locales/catalog.json";
const files = (await readdir("locales/messages")).filter((file) =>
  file.endsWith(".json"),
);
for (const file of files) {
  const language = file.slice(0, -5);
  if (!normalizeLanguage(language)) throw new Error(`Invalid locale filename: ${file}`);
  validateTranslation(JSON.parse(await readFile(`locales/messages/${file}`, "utf8")));
  if ((catalog as Record<string, string>)[language] !== `messages/${file}`)
    throw new Error(`Unregistered catalog: ${file}`);
}
for (const [country, entry] of Object.entries(countries)) {
  if (
    !/^[A-Z]{2}$/.test(country) ||
    !new Intl.Locale(entry.defaultLocale).language ||
    !entry.languages.includes(entry.defaultLocale)
  )
    throw new Error(`Invalid country configuration: ${country}`);
}
console.log(
  `Validated ${files.length} JSON catalogs and ${Object.keys(countries).length} country mappings.`,
);
