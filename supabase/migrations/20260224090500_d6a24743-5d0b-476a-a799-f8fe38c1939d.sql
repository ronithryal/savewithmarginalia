CREATE TABLE public.user_feeds (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  feed_url text NOT NULL,
  label text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_feeds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own feeds" ON public.user_feeds FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own feeds" ON public.user_feeds FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own feeds" ON public.user_feeds FOR DELETE USING (auth.uid() = user_id);