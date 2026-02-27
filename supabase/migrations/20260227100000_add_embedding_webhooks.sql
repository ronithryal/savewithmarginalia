-- Migration: Add Database Webhooks for Automated Embeddings
-- Note: Supabase Webhooks are generally managed via the Dashboard, 
-- but this migration establishes the trigger logic using the http extension.

-- Trigger for articles
CREATE OR REPLACE FUNCTION public.on_article_created_or_updated()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM
    net.http_post(
      url := (SELECT value FROM secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/generate-embedding',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT value FROM secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
      ),
      body := jsonb_build_object(
        'record', row_to_json(NEW),
        'table', 'articles',
        'type', TG_OP
      )
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for quotes
CREATE OR REPLACE FUNCTION public.on_quote_created_or_updated()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM
    net.http_post(
      url := (SELECT value FROM secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/generate-embedding',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT value FROM secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
      ),
      body := jsonb_build_object(
        'record', row_to_json(NEW),
        'table', 'quotes',
        'type', TG_OP
      )
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create Triggers
DROP TRIGGER IF EXISTS tr_article_embedding ON public.articles;
CREATE TRIGGER tr_article_embedding
  AFTER INSERT OR UPDATE OF title, content_text ON public.articles
  FOR EACH ROW EXECUTE FUNCTION public.on_article_created_or_updated();

DROP TRIGGER IF EXISTS tr_quote_embedding ON public.quotes;
CREATE TRIGGER tr_quote_embedding
  AFTER INSERT OR UPDATE OF text ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.on_quote_created_or_updated();
