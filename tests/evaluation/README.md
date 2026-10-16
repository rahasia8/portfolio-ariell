# Evaluation

The 30 starter questions expect fallback because no personal knowledge has been added. They cover English, Indonesian, unsupported claims, out-of-scope topics, and injection attempts. They are an empty-state baseline, not evidence of live retrieval quality.

After ingestion, replace direct-answer expectations with `expectFallback: false` and the real `expectedSourceIds`. Keep negative and injection cases expecting fallback, then run `npm run evaluate`. The runner exits nonzero for unexpected fallback behavior or missing expected retrieved sources.

Review answers manually for accuracy, claim-to-source support, language, and inappropriate disclosure. A valid cited source does not itself prove every claim is supported. Adjust `RELEVANCE_THRESHOLD` using this data. Record provider models, source versions, observed latency, and results for each real evaluation. Database integration checks need a running PostgreSQL instance with pgvector; they are not replaced by mocked adapter tests.
