CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding vector(768) NOT NULL,
  embedding_model TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  visibility TEXT NOT NULL CHECK (visibility = 'public'),
  source_url TEXT,
  version INTEGER NOT NULL CHECK (version > 0),
  updated_at TIMESTAMPTZ NOT NULL,
  chunk_index INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS knowledge_source_idx ON knowledge_chunks(source_id);
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  hits INTEGER NOT NULL DEFAULT 1
);

-- Text search uses public content directly and does not need embedding vectors.
ALTER TABLE knowledge_chunks ALTER COLUMN embedding DROP NOT NULL;
CREATE INDEX IF NOT EXISTS knowledge_fulltext_idx ON knowledge_chunks
  USING GIN (to_tsvector('english', title || ' ' || content))
  WHERE visibility = 'public';
