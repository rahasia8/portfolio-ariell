# Validation record — 16 October 2026

Verified locally with Node 24.22.0:

- TypeScript type check: passed.
- Vitest: 25 tests passed across 2 files.
- Next.js optimized production build: passed.
- Empty-data evaluation: 30/30 cases passed; no provider calls made.
- Production HTTP smoke checks: page 200, health 200/setup_required, Indonesian question 200 with honest fallback and no sources, empty question 400.
- Dependency audit after updating the parser and test framework: zero reported vulnerabilities.

Not verified: real PostgreSQL/pgvector migrations and ingestion, live Gemini embedding/generation, measured retrieval quality or p95 latency, and browser visual/interaction checks. These require services, real approved content, or browser tooling not configured in this environment. Unit tests exercise provider adapters with mocked responses. The empty-data evaluation does not establish factual accuracy or injection resistance after real content is added.

## Live resume smoke checks — 16 October 2026

PostgreSQL 15.18 with pgvector 0.8.7; resume source `ariell-resume` indexed as two public chunks.

The original `gemini-2.5-flash` generation endpoint returned 404 for the configured key. `gemini-3.1-flash-lite` passed a minimal availability check and both resume answer-generation checks. The local relevance threshold is now 0.55: the education chunk scored approximately 0.5585, while the unrelated football query scored at most approximately 0.5270. These three cases are a smoke check, not broad calibration.

- Education: retrieved two chunks, answered Bachelor of Computer Science at Universitas Indonesia (2018–2022), cited `ariell-resume` — passed manual comparison with the source.
- Samsung experience: retrieved two chunks, described the documented projects and responsibilities, cited `ariell-resume` — passed manual comparison with the source.
- Latest football match: no chunks above threshold, fallback with no sources — passed.

Live tests were run with explicit user approval to send resume excerpts to Gemini. Browser interaction checks and broad factual/injection evaluation remain outstanding. The original 30-case dataset still describes the empty-data baseline and must be adapted before using it to score this populated index.

## Automatic language selection — 16 October 2026

- 44 tests passed across four files; TypeScript and the production build passed.
- Covered configured country headers, ignored untrusted/unknown country signals, Vercel environment detection, Indonesian timezone fallback, weighted Accept-Language, uncached locale responses, validated chat locale, localized fallback, and selected-language generation instructions with a mocked provider.
- English and Indonesian UI strings, suggested questions, privacy text, labels, and status messages share a translation dictionary. Server-rendered content uses request language; browser detection refines it and manual selection takes priority.
- No external geolocation or live AI requests were made for this feature verification. Browser interaction/persistence and real hosting country headers were not exercised end to end.

## Worldwide/VPN language correction — 16 October 2026

Supersedes the two-language restriction and browser-timezone behavior above.

- 78 automated tests passed; production build and TypeScript passed.
- Country-to-language cases include Germany/German, France/French, Spain/Spanish, Japan/Japanese, Saudi Arabia/Arabic, and 15 other countries.
- A mocked German exit-country lookup overrides Indonesian browser settings. Hosting country headers take priority; localhost falls back to a visitor-side ipapi.co country request. Lookup failure/rate limiting has a visible browser-language fallback.
- Complete English, Indonesian, and German dictionaries are built in. Other runtime-supported locale tags are validated and use cached, structurally validated UI-only translation. RTL direction is tested.
- A live French UI-only translation succeeded with the configured Gemini model; its dictionary shape and translated navigation were checked. The first live attempt failed transiently, and a subsequent attempt succeeded; unavailable translation has an explicit retry state.
- No resume or contact data was sent in these translation tests. Real browser/VPN switching and real visitor-side country lookup were not exercised end to end in this tool environment.

## JSON locale catalog migration — 16 October 2026

- Extracted existing English, Indonesian, and German strings into `locales/messages/` JSON. Added 17 saved catalogs for 20 total.
- Researched and derived 258 country/territory mappings from Unicode CLDR 48. Included the source URL, definitions link, upstream license, and multilingual alternatives.
- 176 configured country defaults resolve to saved catalogs. Other supported languages retain on-demand fallback.
- Generated additional project UI translations with Gemini; traditional Chinese uses ICU script conversion with explicit provenance. Dictionaries are structurally validated, not certified for native-language quality.
- `npm run locales:check` passed for all 20 catalogs and 258 mappings. All 84 tests and the Next.js production build passed, including TypeScript.
- Tests cover complete catalog registration/shape, saved regional fallback without Gemini, traditional Chinese mapping, allowed empty heading fragments, and saved JSON delivery without database availability.
- Added commands to generate/persist additional locales and validate catalog consistency. No resume, contact details, conversation data, or visitor location was sent during catalog generation.

## Accessibility improvements — 16 October 2026

- Keyboard skip links, scrollable chat region focus, persistent labelled live log, labelled input with visible keyboard help/count/error descriptions, and decorative icon hiding were added.
- Privacy uses native `<dialog>` modality, Escape/click dismissal, and focus restoration. The trigger remains visible on mobile; modal content scrolls by keyboard. Focus is not stolen while the user interacts elsewhere during a reply.
- Auto-scroll respects reduced motion and does not interrupt reading older messages. Controls have larger targets, explicit focus styles, higher-contrast borders, and a persistent input label. 320px layouts, dark mode, RTL, and forced colors are covered.
- Accessibility labels were added to all 20 JSON catalogs and their schema. Existing messages retain their recorded language; untranslated UI fallback declares English.
- 84 automated unit/API/catalog tests, all locale checks, TypeScript, and production build passed.
- Chrome/axe browser audit passed with zero WCAG-tagged violations in ten states: desktop light, privacy dialog, answered chat, loading, provider error, desktop dark, mobile dark, mobile privacy dialog, Arabic RTL, forced colors.
- Browser checks covered skip-link focus/activation, dialog focus containment (including allowed browser chrome), Escape/trigger restoration, Shift+Enter vs Enter, external-link notices, and 320px horizontal overflow.
- macOS restricts native Tab traversal to text controls in this environment; first-Tab traversal across every control could not be established. Skip-link DOM order and explicit keyboard activation were verified. VoiceOver/NVDA manual testing and other browser engines remain unverified.
- Browser requests to third parties were blocked, and chat/location/translation API responses were local test fixtures. No portfolio data or visitor-location data was sent externally by the browser tests.

## Unit, integration, browser automation, and formatting — 16 October 2026

- Unit/mocked API suite: 100 tests passed across 11 files, including rate-limit windows/hashing/failure behavior, public-only ingestion, duplicate/empty index protection, failed embeddings, transactional rollback, retrieval filters, and health states.
- Core/API coverage with V8: 87.62% lines, 85.30% statements, 81.20% branches, 95.52% functions; configured minimum gates passed. UI components are covered separately by browser automation.
- Real database integration: four tests passed on a dedicated local `portfolio_automation_test` database using unique disposable schemas. Tested pgvector retrieval, private/draft exclusion, model filtering, version/deletion replacement, rollback preservation, and explicit empty index. Production knowledge tables were not used.
- Playwright: 20 checks passed across desktop/mobile Chromium, including real unconfigured HTTP endpoints, chat/citations/session history/reset, bounded history, multiline input, loading/errors, language persistence/RTL, privacy focus, dark mode, axe, and reflow.
- TypeScript and production build passed. Prettier applied across supported files; format check passed. VS Code recommends the formatter and enables format on save. Locale-generation outputs use the same formatting rules.
- Added GitHub Actions configuration for formatting, type checks, locale validation, unit coverage, pgvector integration, build, and browser tests. The workflow has not run on GitHub; it requires committing/pushing these files. Linux hosted CI/browser binaries were not exercised locally; local browser verification used installed Chrome on macOS.
- No live Gemini or visitor-location requests were used by automated tests. Integration credentials stay in git-ignored `.env.test.local`; test/example credentials in CI are disposable service credentials only.
