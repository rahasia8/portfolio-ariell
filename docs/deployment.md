# Deployment: Netlify Free + PostgreSQL

[`netlify.toml`](../netlify.toml) configures Node 24 and the `.next` publish
directory. Netlify automatically installs its OpenNext adapter to run Next.js
pages and API routes. No static export or manual `npm start` server is needed.

## Account access

Deployment requires a Netlify login and a cloud PostgreSQL database with
pgvector. The deployed portfolio uses Netlify Database in the Free account;
Neon Free is an alternative. The local database cannot be reached by Netlify
using `localhost`. Never commit `.env.local` or paste credentials into chat.

## Current deployment

- Site: https://ariell-ariza-portfolio.netlify.app
- Dashboard: https://app.netlify.com/projects/ariell-ariza-portfolio
- Hosting: Netlify Free, deployed directly with the CLI.
- Access: public production site. Preview access remains controlled separately
  through the Netlify dashboard.
- Database: Netlify Database, provisioned in the same Free account.
- Production credentials are stored in Netlify environment variables. Local
  `.env.local` still points to the original local database.
- GitHub Actions deploys changes to `main` through `.github/workflows/tests.yml`
  after both test jobs pass. The `NETLIFY_AUTH_TOKEN` repository secret is
  configured. Netlify Git integration is not required.

For a CLI deployment from the original checkout, make sure `DATABASE_URL` is
set to the cloud database in the build environment. A local `.env.local` must
not override the deployment connection. The deployment uses a clean source copy outside this Git repository and without
local environment files. Do not put a staging checkout under another Git
repository: the CLI can resolve generated function artifacts from the outer
repository instead, uploading static files without the Next.js server handler
and producing HTTP 404. Build and deploy from the same project root, and verify
the upload summary includes the Next.js function.
Netlify provisions the deployment-specific `NETLIFY_DB_URL`; the application
reads it through the official `@netlify/database` SDK, which uses
request-specific `Netlify.env` credentials ahead of build-time `process.env`
values. This is necessary for writes such as chat rate-limit counters.

## Automatic deployment from main

The **Tests and Netlify Deploy** workflow runs on pushes and pull requests.
A push or merge to `main` deploys production only after both test jobs pass.
Other branches and pull requests run checks without deploying. You can also
run it manually from GitHub Actions with the `main` branch selected.

One repository secret is required:

- `NETLIFY_AUTH_TOKEN`: a Netlify token authorized for this project's team.

Set it at GitHub **Settings → Secrets and variables → Actions → New repository
secret**. Never commit the token. The existing site ID is explicitly configured
in the workflow; it is not a secret. Groq and database credentials remain in
Netlify and are loaded by its CLI during the production build.

The workflow uses Node 24, a pinned Netlify CLI, and the Next.js adapter. It builds
and uploads the complete application, including server functions and native
Netlify Database migrations. It does not upload `.next` as static files alone.
Production jobs run one at a time; an older commit that finishes testing after a
newer commit has reached `main` is skipped before deployment. An in-progress
production upload is allowed to finish rather than being interrupted.

Before committing changed knowledge, run `npm run knowledge:migration` locally
and include the new SQL migration. The Netlify build checks the snapshot first
and fails if it is stale, without calling an AI provider. Keep applied
migration files unchanged. After publishing, Actions checks the homepage and
`/api/health`; a missing server handler or unavailable knowledge fails the job.
These checks do not send questions to the LLM provider.

Push all deployment changes together, including the database SDK/configuration,
public knowledge migrations, and origin handling required by the live site.
Avoid also enabling Netlify's automatic Git builds for the same branch, which
would produce a second deployment for each push.

## Deploy from GitHub

1. Create a Neon Free project and copy the pooled connection string, preserving
   its SSL options.
2. Push this repository to GitHub, including `netlify.toml`, `knowledge/`,
   `locales/`, and `package-lock.json`.
3. In Netlify, select **Add new project → Import an existing project** and select
   this repository. Choose the Free plan.
4. Set the following environment variables through the Netlify UI, CLI, or API.
   Runtime settings must be available to Functions as well as Builds (use all
   scopes when scope selection is unavailable). Use production-context values
   for the production database and API key.

   | Variable                 | Value                                                             |
   | ------------------------ | ----------------------------------------------------------------- |
   | `DATABASE_URL`           | Neon pooled connection string                                     |
   | `APP_ORIGIN`             | `https://ariell-ariza-portfolio.netlify.app` (your public origin) |
   | `AWS_LAMBDA_JS_RUNTIME`  | `nodejs24.x`                                                      |
   | `GROQ_API_KEY`           | Groq Free API key from https://console.groq.com/keys              |
   | `GROQ_MODEL`             | `openai/gpt-oss-20b`                                              |
   | `TOP_K`                  | `5`                                                               |
   | `MAX_MESSAGE_LENGTH`     | `2000`                                                            |
   | `RATE_LIMIT_PER_MINUTE`  | `12`                                                              |
   | `TRUST_PROXY`            | `false`                                                           |
   | `LOCATION_PROVIDER`      | `none`                                                            |
   | `NEXT_PUBLIC_OWNER_NAME` | `Ariell Zaki Prabaswara Ariza`                                    |
   | `NEXT_PUBLIC_OWNER_ROLE` | `Software Engineer`                                               |

   Verify Groq model access and [Free plan quotas](https://console.groq.com/docs/rate-limits).
   Ingestion and migrations publish public text without an embedding API.
   Groq handles query expansion, answer generation, and development translations.
   Runtime
   variables belong in Netlify's environment settings: variables in
   `netlify.toml` are only available during the build. Set
   `AWS_LAMBDA_JS_RUNTIME` through the UI, CLI, or API, not in the TOML file.

5. For Netlify Database, keep `@netlify/database` installed. Run
   `npm run knowledge:migration` before deploying changed knowledge, and commit
   the generated files under `netlify/database/migrations/`. Netlify applies
   schema and knowledge migrations immediately before publication. For an
   external Neon database, use `npm run db:migrate` and `npm run ingest` with its
   writable connection instead.
6. Open the returned `.netlify.app` URL and `/api/health`. Expect `status: "ok"`
   and `knowledgeReady: true`, then check the chat's answers and sources.

Knowledge migrations contain only public source text and metadata, never
API keys or database credentials. `npm run knowledge:migration` generates a new
version only when public knowledge or the text index format changes. Netlify
applies it transactionally before publishing; keep all previously applied SQL
files unchanged. A failed migration blocks publication. Netlify's native preview
branches isolate preview migrations from production.

The CLI's production database connection can be read-only. Use the native
migration workflow rather than attempting direct schema or index writes with
that connection. Local PostgreSQL and external Neon installations can continue
using the original `db:migrate` and `ingest` commands.

## Deploy directly from this checkout

Netlify CLI can deploy without GitHub authentication:

```sh
nvm use 24
npx netlify-cli login
npx netlify-cli sites:create
```

After linking the new site and setting its environment variables as above:

```sh
npm run knowledge:migration
npm run knowledge:check
npx netlify-cli deploy --prod --context production
```

The CLI builds and packages Next.js through the Netlify adapter. Uploading only
the `.next` directory as static files does not deploy the API routes.

## Behavior and cost

- Country detection uses the visitor-side IP lookup and browser-language
  fallback (`LOCATION_PROVIDER=none`). Vercel headers are not used.
- `TRUST_PROXY=false` leaves unverified forwarded headers untrusted. The
  current application shares its rate limit between visitors in this mode.
- Netlify Free (including Database), Neon Free, and Groq Free quotas have usage limits. Select
  free plans and check model quotas; zero cost is not unlimited usage.
- `APP_ORIGIN` explicitly allows the public site origin when Netlify forwards
  an internal URL to Next.js. Update it if the public domain changes. Forwarded
  host headers are not trusted for this check.
- Changing Netlify environment variables requires a new deployment.

## Official references

- [Next.js on Netlify](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/)
- [Runtime environment variables](https://docs.netlify.com/build/functions/environment-variables/)
- [Node.js function runtime](https://docs.netlify.com/build/functions/configuration/#nodejs-version-for-runtime)
- [Native database migrations](https://docs.netlify.com/build/data-and-storage/netlify-database/migrations/)
- [Netlify plans](https://www.netlify.com/pricing/)
- [Neon plans](https://neon.com/pricing)
- [Neon pgvector](https://neon.com/docs/extensions/pgvector)
- [Groq Free rate limits](https://console.groq.com/docs/rate-limits)
