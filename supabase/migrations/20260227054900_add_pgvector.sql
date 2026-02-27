-- Enable pgvector extension for semantic embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Table to store content embeddings for articles and quotes
CREATE TABLE IF NOT EXISTS content_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('article', 'quote')),
  content_id UUID NOT NULL,
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (content_type, content_id)
);

-- Index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS content_embeddings_embedding_idx
  ON content_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Index for user-scoped lookups
CREATE INDEX IF NOT EXISTS content_embeddings_user_idx
  ON content_embeddings (user_id);

-- RLS
ALTER TABLE content_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own embeddings"
  ON content_embeddings
  FOR ALL
  USING (auth.uid() = user_id);

-- RPC function used by the chat edge function for semantic retrieval
CREATE OR REPLACE FUNCTION match_content_embeddings(
  query_embedding vector(1536),
  match_user_id UUID,
  match_count INT DEFAULT 8
)
RETURNS TABLE (
  content_type TEXT,
  content_id UUID,
  similarity FLOAT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    content_type,
    content_id,
    1 - (embedding <=> query_embedding) AS similarity
  FROM content_embeddings
  WHERE user_id = match_user_id
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;

