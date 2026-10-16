# Personal AI Portfolio

A responsive conversational portfolio built with Next.js, TypeScript, Gemini, PostgreSQL, and pgvector. It is intentionally empty of personal facts: add your approved sources when ready.

## Start the interface now

Requires Node **24** (`nvm use` if you use nvm).

```sh
npm install
npm run dev
```

Open http://localhost:3000. No database or API key is required for the UI and honest empty-data fallback. The assistant never substitutes fictional portfolio data. Customize the public owner name and role using `.env.local` (see `.env.example`). Restart after changing them.

## Enable RAG when you are ready

1. `cp .env.example .env.local`
2. Add your Gemini API key and check your current provider model availability/quotas. Secrets stay on the server. Use a dedicated database and restricted database credentials in production.
3. Start PostgreSQL with pgvector: `docker compose up -d` (requires Docker), or use your managed PostgreSQL connection string in `DATABASE_URL`.
4. `npm run db:migrate`
5. Copy the draft templates from `knowledge/templates/` into `knowledge/`. Fill them with real facts, use unique IDs, and set `visibility: public`. See [content guide](knowledge/README.md).
6. `npm run ingest`
7. `npm run dev` and ask a question supported by your sources.

Ingestion validates every source before writing anything, embeds public files only, and atomically replaces the complete public snapshot under a database lock. Deleting a file, setting it private/draft, or changing a version removes its old chunks on the next successful ingestion. An empty snapshot requires `npm run ingest -- --allow-empty`. Embedding failures leave the old index intact. Model changes require complete reingestion; retrieval filters by the configured embedding model. Embedding vectors have 768 dimensions and are normalized. Metadata includes source, category, version, and update date.

JSON sources support the same frontmatter fields plus a `content` property. Templates are never indexed. Optional source links should point to real public pages; this app does not create project detail pages automatically. Without a link, citation titles still appear.

## Architecture

- `components/portfolio.tsx`: responsive chat UI, source links, suggested questions, keyboard controls, session history, and privacy information.
- `app/api/chat/route.ts`: bounded JSON parsing, strict validation, origin checks, rate limiting, retrieval, generation, and safe errors.
- `lib/providers.ts`: separate embedding/generation interfaces with Gemini REST adapters, timeouts, bounded generation, and structured answers.
- `lib/rag.ts`: public-only cosine retrieval, relevance threshold, history-assisted follow-ups, and citation allowlisting. Uncited/unknown-source responses fall back.
- `scripts/ingest.ts`: validated Markdown/JSON ingestion and transactional publication.
- `db/001_initial.sql`: idempotent schema setup, pgvector chunks, and shared rate-limit counters.
- `/api/health`: database readiness and whether the matching public index is available. A missing configuration reports setup_required; database failures return 503.

Conversation text stays in browser session storage, bounded to 40 displayed messages and 6 recent messages per API call. The server does not persist or log conversation content. Provider requests include your question, selected public chunks, and recent history. Rate-limit identifiers are hashed and counters expire after two minutes. Application logs contain request IDs, timings, result counts, token counts, fallback state, and generic error events.

## Validation and evaluation

```sh
npm run typecheck
npm test
npm run build
npm run evaluate
```

Tests cover document validation/chunking, bounded requests, provider contracts, API errors/rate limits, source allowlisting, and fallback behavior. The evaluation runner uses `tests/evaluation/questions.json` and records fallback accuracy and source recall. It is initially an empty-data test set; replace expected source IDs and expected fallback values with your real content expectations before evaluating retrieval quality. See [evaluation guidance](tests/evaluation/README.md). `RELEVANCE_THRESHOLD=0.65` is an uncalibrated starting value, not a quality guarantee.

## Deployment

Use a Node 24 server or a Node-compatible Next.js host with external PostgreSQL/pgvector. Run `npm run build` then `npm start`. Apply the migration and run ingestion as controlled jobs before enabling public traffic. No public ingestion endpoint exists.

Use HTTPS. Set `TRUST_PROXY=true` **only** when your hosting proxy overwrites `X-Forwarded-For`; otherwise the safe default uses a shared visitor rate-limit bucket. PostgreSQL counters work across server instances. With no database, the UI-only mode uses a process-local limiter. Adjust the request budget for your provider quota.

Deploy the app with server-only `GEMINI_API_KEY`, `DATABASE_URL`, and model settings; never prefix secrets with `NEXT_PUBLIC_`. Take database backups and keep approved source files versioned. Reingest the previous source revision to roll back content. The simple exact cosine scan is suitable for a small portfolio; measure before adding approximate indexes. There is no analytics dashboard, admin UI, streaming, or permanent chat storage in this MVP.

Grounding instructions and valid source IDs reduce unsupported answers but cannot mathematically guarantee factual accuracy. Review generated claims and evaluate injection resistance with your own content before sharing publicly. Latency and live Gemini/database behavior require credentials and a running database to measure.

Provider implementation references: [Gemini embeddings](https://ai.google.dev/gemini-api/docs/embeddings), [Gemini content generation](https://ai.google.dev/api/generate-content), [Next.js installation](https://nextjs.org/docs/app/getting-started/installation).

## Automatic visitor language

The app now supports validated BCP 47 languages recognized by the runtime, including German, French, Spanish, Japanese, Arabic, and more. A country is mapped to its likely primary language using Unicode/Intl locale data; countries with multiple languages use this default until the visitor chooses another language. The selector offers common languages plus the automatically detected language. Manual choices are saved in localStorage and always override automatic detection. Choose **Auto** to follow the VPN/location again. Existing messages retain their original language.

Detection order:

1. Trusted hosting country header: `LOCATION_PROVIDER=vercel` or `cloudflare`. Vercel is automatically recognized when the setting is omitted and the Vercel environment is present. Only configure a provider when its proxy overwrites its country header.
2. Without a country header (including localhost), the **visitor's browser** requests `https://ipapi.co/country/`. This identifies the visitor/VPN exit IP rather than the application server IP. The service receives the visitor's IP; no credentials, portfolio content, or location coordinates are sent. Its rate limits, VPN blocking, CORS availability, and network failures can prevent detection.
3. Browser language, then English if unsupported. Browser timezone is no longer treated as location, because it does not follow VPN changes. A visible notice appears when country detection fails.

Detection runs on load and again when the window regains focus (at most once every 15 seconds). After switching VPN, reload the page with **Auto** selected. No GPS permission is requested and country is not stored or sent to Gemini. `/api/locale` responses are private and uncached.

Translation files live in `locales/messages/`, with country mappings in `locales/countries.json` and provenance in `locales/sources.json`. English, Indonesian, and German load synchronously; additional saved JSON dictionaries load lazily before any provider call. Other locales use `/api/translations?locale=...` to translate **static interface text only** with the configured Gemini model. Successful dictionaries are structurally validated, cached per locale for a day in the server process, and deduplicated across simultaneous requests. Translation requests are rate limited; the endpoint returns an explicit error and the UI shows English with a retry button if translation is unavailable. Quality/coverage for uncommon languages depends on the model and must be reviewed; this is not a professionally reviewed translation catalog for every world language.

Chat carries the validated selected language to the generator, while keeping public-source grounding rules. Localized empty-data responses reuse the UI dictionary. Arabic/Hebrew and other RTL scripts set document direction automatically. Public owner names and source titles remain as authored. No knowledge reingestion is required for language changes.

References: [Vercel country headers](https://vercel.com/docs/headers/request-headers), [Cloudflare country headers](https://developers.cloudflare.com/fundamentals/reference/http-headers/), [ipapi country lookup](https://ipapi.co/faq/), [Intl locale likely subtags](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Locale/maximize).

## Deployment

See [Netlify Free deployment](docs/deployment.md) for the included
`netlify.toml` configuration, cloud database setup, required secrets, and free-tier
limits.

## Appearance

The light theme uses a white background with neutral gray/black accents. Dark mode follows the browser/system `prefers-color-scheme` setting automatically, including live changes while the page is open. Native form controls use the matching color scheme. No theme preference or location permission is required.

## Hot reload during development

Run `npm run dev` for the Turbopack development server at http://localhost:3000. Saving React components, styles, or route handlers automatically rebuilds the affected code; React Fast Refresh preserves component state where possible. Some changes require a full browser reload. Development CSP permits the HMR WebSocket and React debugging; production does not receive these extra permissions. `npm start` serves a production build and does not watch files. Knowledge Markdown changes still require `npm run ingest` to update the RAG index.

The development launcher (`scripts/dev.sh`) uses the active Node 24 runtime, or activates an installed Node 24 via nvm when the terminal still uses an older system Node. It does not install or change your global Node default.

## Manage translation JSON files

See [locales/README.md](locales/README.md) for the country mapping, message schema, provenance, and editing workflow.

```sh
npm run locales:check
npm run locales:generate -- ja ko ar
```

Generation preserves existing catalogs, validates generated dictionaries, and updates the lazy import registry. Only static English UI text is sent to Gemini. Saved files need no provider call when served and can be edited directly. Country alternatives come from Unicode CLDR; defaults are configurable and visitors retain their manual override.

## Accessibility

The interface includes keyboard skip links, visible focus indicators, a labelled chat input with multiline instructions and character limits, a persistent screen-reader chat log, status/error announcements, and external-link notices. Privacy uses a native modal dialog with Escape dismissal, modal focus handling, and focus restoration; its trigger remains available on mobile. Auto-scroll follows new messages only while the reader is near the bottom and respects reduced motion. Light/dark themes, RTL, forced colors, 320px reflow, readable text, and larger control targets are supported. Accessibility labels live in all 20 JSON catalogs.

Browser checks use installed Chrome and axe-core, with fake chat/location responses and all external requests blocked:

```sh
# First serve a production build, for example on a separate port:
npm run build
npm start -- --hostname 127.0.0.1 --port 3101
# In another terminal:
A11Y_BASE_URL=http://127.0.0.1:3101 npm run test:a11y
```

Set `CHROME_PATH` if Chrome lives elsewhere. The browser test opens a temporary headless profile. Enable full keyboard navigation on macOS to exercise first-Tab traversal; when the OS restricts Tab to text controls, the test reports that limitation and checks skip-link focus/activation directly. Automated checks do not establish complete WCAG conformance; VoiceOver/NVDA and additional browser/device testing remain valuable.

Implementation references: [W3C native modal technique](https://www.w3.org/WAI/WCAG22/Techniques/html/H102), [modal keyboard interaction](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/), and [WCAG 2.2](https://www.w3.org/TR/wcag/).

## Unit tests, browser automation, and formatting

See [tests/README.md](tests/README.md) for test commands, the dedicated pgvector test database, browser setup, reports, and CI.

```sh
npm run format
npm run format:check
npm run test:coverage
npm run test:integration
npm run build
npm run test:e2e
```

GitHub Actions runs the checks on pushes and pull requests. VS Code is configured to use Prettier on save for supported files. Secrets, dependencies, generated builds, and reports are excluded from formatting.
