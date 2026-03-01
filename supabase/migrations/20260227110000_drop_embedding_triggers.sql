-- Drop the broken database triggers that tried to call generate-embedding
-- via pg_net using a 'secrets' table that doesn't exist in this setup.
-- Embeddings are now handled reliably via the frontend save flow.

DROP TRIGGER IF EXISTS articles_embedding_trigger ON articles;
DROP TRIGGER IF EXISTS quotes_embedding_trigger ON quotes;

DROP FUNCTION IF EXISTS trigger_generate_article_embedding();
DROP FUNCTION IF EXISTS trigger_generate_quote_embedding();
