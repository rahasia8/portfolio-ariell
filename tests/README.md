# Tests

Requires Node 24 and `npm ci`. No real Groq key is required for automated tests.

| Command                          | Scope                                                         |
| -------------------------------- | ------------------------------------------------------------- |
| `npm test` / `npm run test:unit` | Unit and mocked API tests                                     |
| `npm run test:watch`             | Watch tests during development                                |
| `npm run test:coverage`          | V8 coverage, thresholds, HTML and LCOV reports                |
| `npm run test:integration`       | Real PostgreSQL/pgvector with synthetic data                  |
| `npm run test:e2e`               | Playwright desktop and mobile automation                      |
| `npm run test:e2e:ui`            | Playwright interactive test runner                            |
| `npm run test:a11y`              | Existing detailed standalone Chrome/axe audit                 |
| `npm run test:all`               | Formatting, types, locales, coverage, integration, build, E2E |

Unit coverage measures `lib/` and API route logic. Thresholds: 75% lines/statements/functions and 65% branches. Reports are under `coverage/`; component behavior is covered by browser tests rather than counted as unit coverage.

## Integration database

Copy `.env.test.example` to `.env.test.local` and configure `TEST_DATABASE_URL` with a dedicated disposable test database whose name contains `test` or `automation`. The runner never falls back to the app's `DATABASE_URL`. Install pgvector in that database first with an administrative database account:

```sql
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;
```

Tests create a unique temporary schema, apply the real migration, test publication, version replacement, private/draft exclusion, embedding-model filtering, rollback, and explicit clearing, then drop their schema. They do not send embeddings to Groq. An interrupted run may leave a schema with the `automation_` prefix in the test database; production data is never used. CI provides an ephemeral pgvector/PostgreSQL service automatically.

## Browser automation

```sh
npm run build
npm run test:e2e
```

Playwright owns a separate production server on port 3102 and stops it after the run. It will not reuse or stop your development server. Override `E2E_PORT` if needed.

On macOS, installed Google Chrome is used by default. Set `CHROME_PATH` for another location. On Linux/CI, install the browser once:

```sh
npx playwright install --with-deps chromium
```

Browser tests block third-party network requests and mock browser AI/location responses. They verify messages, citations, session restoration/reset, multiline keyboard input, rate limits/provider errors/loading, persisted manual locale, RTL, privacy focus/Escape, skip links, automatic dark mode, reflow, and axe results. Separate HTTP tests hit the real unconfigured API endpoints. The test server explicitly clears AI/database settings so it cannot contact your services.

Reports: `playwright-report/index.html`. Screenshots/traces are retained only on failure in `test-results/`. Use `npx playwright show-report` to inspect results. macOS Full Keyboard Access settings can limit Tab traversal; skip-link focus/Enter behavior is tested independently of that OS setting.

## CI

`.github/workflows/tests.yml` runs format checks, types, locale validation, unit coverage, real database integration, production build, and Playwright on pushes/pull requests. Reports are uploaded as workflow artifacts even on failure. Tests require no production secrets. After both test jobs pass, pushes to `main` also deploy to Netlify using the `NETLIFY_AUTH_TOKEN` repository secret. Pull requests and other branches never deploy production. See [deployment setup](../docs/deployment.md#automatic-deployment-from-main).

## Formatting

```sh
npm run format
npm run format:check
```

Prettier covers supported source, JSON, CSS, Markdown, and YAML files. Generated builds, reports, dependencies, lockfile, environment files, and the upstream license are excluded. VS Code recommends the Prettier extension and formats on save. Catalog generation also formats its JSON/TypeScript output so it passes the same CI check.
