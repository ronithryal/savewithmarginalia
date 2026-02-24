import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { useIsMobile } from "@/hooks/use-mobile";

export interface ChatMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
  followups?: string[];
}

export interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  is_bookmarked: boolean;
}

const Chat = () => {
  const { user } = useAuth();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [chatEnabled, setChatEnabled] = useState<boolean | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [starters, setStarters] = useState<string[]>([]);
  const initialMessageHandled = useRef(false);

  // Check chat enabled
  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_preferences" as any)
      .select("ai_chat_enabled")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }: any) => {
        setChatEnabled(data ? data.ai_chat_enabled : true);
      });
  }, [user]);

  // Load sessions
  const loadSessions = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("chat_sessions" as any)
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    setSessions((data as any) || []);
  }, [user]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Load messages for active session
  useEffect(() => {
    if (!activeSessionId) {
      setMessages([]);
      return;
    }
    const load = async () => {
      const { data } = await supabase
        .from("chat_messages" as any)
        .select("*")
        .eq("session_id", activeSessionId)
        .order("created_at", { ascending: true });
      setMessages(
        ((data as any) || []).map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          followups: m.followups,
        }))
      );
    };
    load();
  }, [activeSessionId]);

  // Generate dynamic starters
  useEffect(() => {
    if (!user) return;
    const fetchStarters = async () => {
      const { data: tagLinks } = await supabase
        .from("article_tags")
        .select("tag_id")
        .limit(100);

      if (!tagLinks || tagLinks.length === 0) {
        setStarters([
          "What's the strongest idea across everything I've saved?",
          "What should I read next based on my library?",
          "What assumptions keep showing up in what I save?",
        ]);
        return;
      }

      const freq: Record<string, number> = {};
      for (const t of tagLinks) {
        freq[t.tag_id] = (freq[t.tag_id] || 0) + 1;
      }
      const topTagId = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
      const { data: tagData } = await supabase
        .from("tags")
        .select("name")
        .eq("id", topTagId)
        .single();

      const topTag = tagData?.name || "technology";
      setStarters([
        `What tensions exist in what I've saved about ${topTag}?`,
        "What's the strongest idea across everything I've saved?",
        "What should I read next based on my library?",
      ]);
    };
    fetchStarters();
  }, [user]);

  // Auto-apply tags from source article and/or quote to a chat session
  const applySourceTags = useCallback(
    async (sessionId: string, sourceArticleId?: string, sourceQuoteId?: string) => {
      const tagIds = new Set<string>();

      // Get tags from the source article
      if (sourceArticleId) {
        const { data: articleTags } = await supabase
          .from("article_tags")
          .select("tag_id")
          .eq("article_id", sourceArticleId);
        (articleTags ?? []).forEach((at) => tagIds.add(at.tag_id));
      }

      // Get tags directly on the quote
      if (sourceQuoteId) {
        const { data: quoteTags } = await supabase
          .from("quote_tags")
          .select("tag_id")
          .eq("quote_id", sourceQuoteId);
        (quoteTags ?? []).forEach((qt) => tagIds.add(qt.tag_id));
      }

      if (tagIds.size === 0) return;

      const inserts = Array.from(tagIds).map((tag_id) => ({
        session_id: sessionId,
        tag_id,
      }));
      await supabase.from("chat_session_tags" as any).insert(inserts);
    },
    []
  );

  const createSession = useCallback(
    async (firstMessage: string): Promise<string | null> => {
      if (!user) return null;
      const title =
        firstMessage.length > 50
          ? firstMessage.slice(0, 47) + "…"
          : firstMessage;
      const { data, error } = await supabase
        .from("chat_sessions" as any)
        .insert({ user_id: user.id, title })
        .select("id")
        .single();
      if (error || !data) {
        toast.error("Failed to create session");
        return null;
      }
      const newId = (data as any).id;
      await loadSessions();
      return newId;
    },
    [user, loadSessions]
  );

  const send = useCallback(
    async (text: string, sourceArticleId?: string, sourceQuoteId?: string) => {
      if (!text.trim() || loading || !user) return;
      const trimmed = text.trim();
      setLoading(true);

      let sessionId = activeSessionId;

      // Create session if needed
      if (!sessionId) {
        sessionId = await createSession(trimmed);
        if (!sessionId) {
          setLoading(false);
          return;
        }
        setActiveSessionId(sessionId);

        // Auto-apply tags from source article/quote
        if (sourceArticleId || sourceQuoteId) {
          applySourceTags(sessionId, sourceArticleId, sourceQuoteId);
        }
      }

      // Insert user message
      const { error: insertErr } = await supabase
        .from("chat_messages" as any)
        .insert({
          session_id: sessionId,
          role: "user",
          content: trimmed,
        });
      if (insertErr) {
        toast.error("Failed to save message");
        setLoading(false);
        return;
      }

      const userMsg: ChatMessage = { role: "user", content: trimmed };
      const currentMessages = [...messages, userMsg];
      setMessages(currentMessages);

      try {
        const { data, error } = await supabase.functions.invoke("chat", {
          body: {
            messages: currentMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          },
        });

        if (error) throw error;
        if (data?.error) {
          toast.error(data.error);
          setLoading(false);
          return;
        }

        const followups = data.followups || [];

        // Insert assistant message
        await supabase.from("chat_messages" as any).insert({
          session_id: sessionId,
          role: "assistant",
          content: data.answer,
          followups,
        });

        // Update session timestamp
        await supabase
          .from("chat_sessions" as any)
          .update({ updated_at: new Date().toISOString() })
          .eq("id", sessionId);

        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.answer, followups },
        ]);

        loadSessions();
      } catch (e: any) {
        toast.error(e.message || "Failed to get response");
      } finally {
        setLoading(false);
      }
    },
    [activeSessionId, messages, loading, user, createSession, loadSessions, applySourceTags]
  );

  // Handle opening a specific session from navigation state (e.g. clicking a ThreadCard)
  useEffect(() => {
    const state = location.state as { openSessionId?: string } | null;
    if (state?.openSessionId && chatEnabled === true && user) {
      setActiveSessionId(state.openSessionId);
      window.history.replaceState({}, document.title);
    }
  }, [chatEnabled, user, location.state]);

  // Handle initial message from navigation state (e.g. "Explain this" from article card)
  useEffect(() => {
    const state = location.state as { initialMessage?: string; sourceArticleId?: string; sourceQuoteId?: string } | null;
    if (state?.initialMessage && !initialMessageHandled.current && chatEnabled === true && user) {
      initialMessageHandled.current = true;
      const sourceArticleId = state.sourceArticleId;
      const sourceQuoteId = state.sourceQuoteId;
      // Clear navigation state to prevent re-send on refresh
      window.history.replaceState({}, document.title);
      send(state.initialMessage, sourceArticleId, sourceQuoteId);
    }
  }, [chatEnabled, user, location.state, send]);

  const handleNewChat = () => {
    setActiveSessionId(null);
    setMessages([]);
    if (isMobile) setSidebarOpen(false);
  };

  const handleSelectSession = (id: string) => {
    setActiveSessionId(id);
    if (isMobile) setSidebarOpen(false);
  };

  const handleDeleteSession = async (id: string) => {
    await supabase.from("chat_sessions" as any).delete().eq("id", id);
    if (activeSessionId === id) {
      setActiveSessionId(null);
      setMessages([]);
    }
    loadSessions();
  };

  const handleBookmarkSession = async (id: string, bookmarked: boolean) => {
    await supabase
      .from("chat_sessions" as any)
      .update({ is_bookmarked: bookmarked })
      .eq("id", id);
    loadSessions();
  };

  const handleClearMessages = async () => {
    if (!activeSessionId) return;
    await supabase
      .from("chat_messages" as any)
      .delete()
      .eq("session_id", activeSessionId);
    setMessages([]);
  };

  if (!user) return null;

  if (chatEnabled === false) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center animate-fade-in">
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground mb-4">
          Chat is disabled
        </h1>
        <p className="text-muted-foreground text-sm mb-6">
          Enable Library Chat in{" "}
          <Link to="/settings" className="text-accent underline">
            Settings
          </Link>{" "}
          to start chatting with your saved content.
        </p>
      </div>
    );
  }

  if (chatEnabled === null) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div
      className="flex animate-fade-in"
      style={{ height: "calc(100vh - 3.5rem)" }}
    >
      {isMobile ? (
        sidebarOpen && (
          <div className="fixed inset-0 z-50 flex">
            <div
              className="absolute inset-0 bg-background/60 backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
            />
            <div className="relative z-10 w-[280px] bg-background border-r border-border h-full animate-fade-in">
              <ChatSidebar
                sessions={sessions}
                activeSessionId={activeSessionId}
                onNewChat={handleNewChat}
                onSelectSession={handleSelectSession}
                onDeleteSession={handleDeleteSession}
                onBookmarkSession={handleBookmarkSession}
              />
            </div>
          </div>
        )
      ) : (
        <div className="w-[260px] shrink-0 border-r border-border">
          <ChatSidebar
            sessions={sessions}
            activeSessionId={activeSessionId}
            onNewChat={handleNewChat}
            onSelectSession={handleSelectSession}
            onDeleteSession={handleDeleteSession}
            onBookmarkSession={handleBookmarkSession}
          />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <ChatPanel
          messages={messages}
          loading={loading}
          starters={starters}
          hasActiveSession={!!activeSessionId}
          onSend={(text) => send(text)}
          onClearMessages={handleClearMessages}
          onOpenSidebar={isMobile ? () => setSidebarOpen(true) : undefined}
        />
      </div>
    </div>
  );
};

export default Chat;
