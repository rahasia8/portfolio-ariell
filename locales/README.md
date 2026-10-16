# Country and language catalogs

- `countries.json`: country/territory code → default locale and alternative languages, based on Unicode CLDR 48 country-language information. The default is a product choice from Intl likely subtags; visitors can override it. Country is an approximate hint, not a language guarantee.
- `messages/<locale>.json`: complete UI translation dictionaries. English is the reference. Examples: `de.json` for Germany/Austria, `fr.json` for France and other French-speaking countries. Shared languages reuse one file; `zh-Hant.json` handles traditional Chinese in Taiwan/Hong Kong/Macao.
- `catalog.json`: manifest of saved locale files.
- `catalog.ts`: generated lazy import registry so additional catalogs do not all inflate the initial browser bundle. It contains no translation content.
- `schema.json`: JSON schema for editor validation. Runtime checks also enforce every key and array length.
- `sources.json`: data sources, provider provenance, and translation review status.
- `UNICODE-LICENSE.txt`: upstream country-data license.

Resolution: exact locale → language/script → base language → English UI with a visible notice. Saved files are served without an AI call. Run the generation command during development to add an editable, versioned JSON catalog.

## Add or edit a language

Edit an existing message JSON or generate another one:

```sh
npm run locales:generate -- fr es ja
npm run locales:check
```

The generator sends only the project's English UI strings to the configured Gemini model. It preserves existing files, validates new dictionaries, writes atomically, and regenerates both manifests. It does not upload resume documents, contact details, conversation history, or visitor-location data. The UI dictionary contains the owner’s display name. AI-generated catalogs require native-language review; structural validation cannot certify translation quality.

To replace an existing machine translation, edit it directly. To regenerate an existing file, move the old JSON outside `messages/` first, then run the generator. Generated dictionaries follow the source shape; add any new UI keys to all catalogs before shipping.

To change a country's default, edit its `defaultLocale` and ensure it appears in `languages`. Prefer an existing catalog. For multilingual countries, keep the alternatives and allow users to select their preferred language.

Research sources: [Unicode CLDR country-language data](https://github.com/unicode-org/cldr-json/blob/48.0.0/cldr-json/cldr-core/supplemental/territoryInfo.json), [Unicode language population definitions](https://cldr.unicode.org/index/cldr-spec/definitions), [Unicode license](https://www.unicode.org/license.txt). CLDR provides language metadata, not translations of this portfolio's custom UI. Additional message catalogs are translations of this project's own text, with provenance in `sources.json`.

## Current saved coverage

All 72 languages in `lib/locale.ts` have complete, editable JSON catalogs. `npm run locales:check` fails if a selectable language has no catalog. Browser language switching loads these files lazily and requires no Gemini request. The translation endpoint serves local dictionaries only, including regional fallback (for example `fr-CA` uses `fr`). Unknown automatic languages show the English UI with a notice; their UI text is never generated at request time.

New catalogs were machine-translated from the project's English UI during development. Structural validation does not certify linguistic accuracy: native-language review is recommended, especially for uncommon languages. See per-locale provenance in `sources.json`.
