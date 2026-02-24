
-- Add is_bookmarked to chat_sessions
ALTER TABLE public.chat_sessions ADD COLUMN is_bookmarked boolean NOT NULL DEFAULT false;

-- Create chat_session_tags join table
CREATE TABLE public.chat_session_tags (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  UNIQUE(session_id, tag_id)
);

ALTER TABLE public.chat_session_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chat_session_tags" ON public.chat_session_tags
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM chat_sessions WHERE chat_sessions.id = chat_session_tags.session_id AND chat_sessions.user_id = auth.uid())
  );

CREATE POLICY "Users can insert own chat_session_tags" ON public.chat_session_tags
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM chat_sessions WHERE chat_sessions.id = chat_session_tags.session_id AND chat_sessions.user_id = auth.uid())
  );

CREATE POLICY "Users can delete own chat_session_tags" ON public.chat_session_tags
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM chat_sessions WHERE chat_sessions.id = chat_session_tags.session_id AND chat_sessions.user_id = auth.uid())
  );
