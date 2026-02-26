-- Add dedicated OG metadata columns to articles table
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS og_image TEXT,
  ADD COLUMN IF NOT EXISTS og_description TEXT,
  ADD COLUMN IF NOT EXISTS reading_time_minutes INTEGER;
