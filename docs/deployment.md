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
- Database: Netlify Database, provisioned in the same Free account.
- Production credentials are stored in Netlify environment variables. Local
  `.env.local` still points to the original local database.
- GitHub continuous deployment is not connected. Use the CLI to publish further
  changes, or connect the repository through Netlify to enable deploys on push.

For a CLI deployment from the original checkout, make sure `DATABASE_URL` is
set to the cloud database in the build environment. A local `.env.local` must
not override the deployment connection. The initial deployment used a clean
source copy without local environment files and loaded production settings
from Netlify into the build process.

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

   | Variable                 | Value                          |
   | ------------------------ | ------------------------------ |
   | `DATABASE_URL`           | Neon pooled connection string  |
   | `GEMINI_API_KEY`         | Existing Gemini API key        |
   | `AWS_LAMBDA_JS_RUNTIME`  | `nodejs24.x`                   |
   | `EMBEDDING_MODEL`        | `gemini-embedding-001`         |
   | `GENERATION_MODEL`       | `gemini-3.1-flash-lite`        |
   | `RELEVANCE_THRESHOLD`    | `0.55`                         |
   | `TOP_K`                  | `5`                            |
   | `MAX_MESSAGE_LENGTH`     | `2000`                         |
   | `RATE_LIMIT_PER_MINUTE`  | `12`                           |
   | `TRUST_PROXY`            | `false`                        |
   | `LOCATION_PROVIDER`      | `none`                         |
   | `NEXT_PUBLIC_OWNER_NAME` | `Ariell Zaki Prabaswara Ariza` |
   | `NEXT_PUBLIC_OWNER_ROLE` | `Software Engineer`            |

   Verify that both models are available to the Gemini account. Runtime
   variables belong in Netlify's environment settings: variables in
   `netlify.toml` are only available during the build. Set
   `AWS_LAMBDA_JS_RUNTIME` through the UI, CLI, or API, not in the TOML file.

5. Deploy. Production builds compile Next.js, migrate the remote database, and
   ingest public knowledge. Each command must succeed before deployment.
6. Open the returned `.netlify.app` URL and `/api/health`. Expect `status: "ok"`
   and `knowledgeReady: true`, then check the chat's answers and sources.

Production deployments regenerate embeddings and replace the knowledge index
transactionally. Use a dedicated database for this project. Preview and branch
builds only compile the application; they never ingest into production. Give
previews their own database/key if they need working RAG.

## Deploy directly from this checkout

Netlify CLI can deploy without GitHub authentication:

```sh
nvm use 24
npx netlify-cli login
npx netlify-cli sites:create
```

After linking the new site and setting its environment variables as above:

```sh
npx netlify-cli deploy --prod --context production
```

The CLI builds and packages Next.js through the Netlify adapter. Uploading only
the `.next` directory as static files does not deploy the API routes.

## Behavior and cost

- Country detection uses the visitor-side IP lookup and browser-language
  fallback (`LOCATION_PROVIDER=none`). Vercel headers are not used.
- `TRUST_PROXY=false` leaves unverified forwarded headers untrusted. The
  current application shares its rate limit between visitors in this mode.
- Netlify Free (including Database), Neon Free, and Gemini free quotas have usage limits. Select
  free plans and check model quotas; zero cost is not unlimited usage.
- Changing Netlify environment variables requires a new deployment.

## Official references

- [Next.js on Netlify](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/)
- [Runtime environment variables](https://docs.netlify.com/build/functions/environment-variables/)
- [Node.js function runtime](https://docs.netlify.com/build/functions/configuration/#nodejs-version-for-runtime)
- [Netlify plans](https://www.netlify.com/pricing/)
- [Neon plans](https://neon.com/pricing)
- [Neon pgvector](https://neon.com/docs/extensions/pgvector)
- [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing)
