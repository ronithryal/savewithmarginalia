-- Threads table: curated reading lists scoped to a tag
CREATE TABLE public.threads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  description TEXT,
  tag_id UUID REFERENCES public.tags(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own threads"
  ON public.threads FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own threads"
  ON public.threads FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own threads"
  ON public.threads FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own threads"
  ON public.threads FOR DELETE USING (auth.uid() = user_id);

-- Thread items: ordered articles/quotes within a thread
CREATE TABLE public.thread_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID REFERENCES public.threads(id) ON DELETE CASCADE NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('article', 'quote')),
  article_id UUID REFERENCES public.articles(id) ON DELETE CASCADE,
  quote_id UUID REFERENCES public.quotes(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.thread_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own thread_items"
  ON public.thread_items FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.threads WHERE threads.id = thread_items.thread_id AND threads.user_id = auth.uid())
  );
CREATE POLICY "Users can insert own thread_items"
  ON public.thread_items FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.threads WHERE threads.id = thread_items.thread_id AND threads.user_id = auth.uid())
  );
CREATE POLICY "Users can update own thread_items"
  ON public.thread_items FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.threads WHERE threads.id = thread_items.thread_id AND threads.user_id = auth.uid())
  );
CREATE POLICY "Users can delete own thread_items"
  ON public.thread_items FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.threads WHERE threads.id = thread_items.thread_id AND threads.user_id = auth.uid())
  );

-- Auto-update updated_at on threads
CREATE OR REPLACE FUNCTION public.handle_thread_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER threads_updated_at
  BEFORE UPDATE ON public.threads
  FOR EACH ROW EXECUTE FUNCTION public.handle_thread_updated_at();
