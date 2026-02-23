
-- Articles table
CREATE TABLE public.articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  source_domain TEXT NOT NULL DEFAULT '',
  preview_image_url TEXT,
  content_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Quotes table
CREATE TABLE public.quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  article_id UUID REFERENCES public.articles(id) ON DELETE CASCADE NOT NULL,
  text TEXT NOT NULL DEFAULT '',
  start_offset INTEGER,
  end_offset INTEGER,
  is_image BOOLEAN NOT NULL DEFAULT false,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tags table
CREATE TABLE public.tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

-- ArticleTag join table
CREATE TABLE public.article_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id UUID REFERENCES public.articles(id) ON DELETE CASCADE NOT NULL,
  tag_id UUID REFERENCES public.tags(id) ON DELETE CASCADE NOT NULL,
  UNIQUE(article_id, tag_id)
);

-- QuoteTag join table
CREATE TABLE public.quote_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID REFERENCES public.quotes(id) ON DELETE CASCADE NOT NULL,
  tag_id UUID REFERENCES public.tags(id) ON DELETE CASCADE NOT NULL,
  UNIQUE(quote_id, tag_id)
);

-- RLS
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_tags ENABLE ROW LEVEL SECURITY;

-- Articles policies
CREATE POLICY "Users can view own articles" ON public.articles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own articles" ON public.articles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own articles" ON public.articles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own articles" ON public.articles FOR DELETE USING (auth.uid() = user_id);

-- Quotes policies
CREATE POLICY "Users can view own quotes" ON public.quotes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own quotes" ON public.quotes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own quotes" ON public.quotes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own quotes" ON public.quotes FOR DELETE USING (auth.uid() = user_id);

-- Tags policies
CREATE POLICY "Users can view own tags" ON public.tags FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tags" ON public.tags FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tags" ON public.tags FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tags" ON public.tags FOR DELETE USING (auth.uid() = user_id);

-- ArticleTag policies (user owns the article)
CREATE POLICY "Users can view own article_tags" ON public.article_tags FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.articles WHERE articles.id = article_tags.article_id AND articles.user_id = auth.uid())
);
CREATE POLICY "Users can insert own article_tags" ON public.article_tags FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.articles WHERE articles.id = article_tags.article_id AND articles.user_id = auth.uid())
);
CREATE POLICY "Users can delete own article_tags" ON public.article_tags FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.articles WHERE articles.id = article_tags.article_id AND articles.user_id = auth.uid())
);

-- QuoteTag policies (user owns the quote)
CREATE POLICY "Users can view own quote_tags" ON public.quote_tags FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.quotes WHERE quotes.id = quote_tags.quote_id AND quotes.user_id = auth.uid())
);
CREATE POLICY "Users can insert own quote_tags" ON public.quote_tags FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.quotes WHERE quotes.id = quote_tags.quote_id AND quotes.user_id = auth.uid())
);
CREATE POLICY "Users can delete own quote_tags" ON public.quote_tags FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.quotes WHERE quotes.id = quote_tags.quote_id AND quotes.user_id = auth.uid())
);
