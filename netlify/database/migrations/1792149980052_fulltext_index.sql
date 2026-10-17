-- Support text-only public snapshots while preserving existing vector data.
ALTER TABLE knowledge_chunks ALTER COLUMN embedding DROP NOT NULL;
CREATE INDEX IF NOT EXISTS knowledge_fulltext_idx ON knowledge_chunks
  USING GIN (to_tsvector('english', title || ' ' || content))
  WHERE visibility = 'public';
