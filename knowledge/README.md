# Your public knowledge base

This directory intentionally contains no portfolio facts. Add your own approved information later.

1. Copy `templates/profile.md` or `templates/project.md` into this directory or a subdirectory.
2. Replace placeholders and set `visibility: public` only when ready. Templates are excluded from ingestion.
3. Set a unique stable `id`, ISO date, category, and positive integer version. Increment the version when editing.
4. Run `npm run ingest`. Every run atomically replaces the full public index; removed files and private/draft documents disappear from retrieval.

Markdown uses YAML frontmatter. JSON uses the same fields plus a `content` string. Categories: profile, skill, experience, project, education, achievement, working-style, faq.

Optional `source_url` must be a real public HTTP(S) link or a site-relative path that you actually serve. Without a URL, the source title is shown without a link. No project pages are generated automatically.

Private/draft files are not indexed or stored in the public database. Prefer keeping confidential information outside this repository entirely. A zero-public-document ingestion requires `npm run ingest -- --allow-empty` to avoid accidental index erasure.

Ingestion stores public text with null vectors and the `postgres-fulltext-v1` index identifier. No AI key is needed to ingest. Groq expands multilingual search keywords and generates cited answers at request time.
