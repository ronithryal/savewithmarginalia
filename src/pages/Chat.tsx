import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Send, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  followups?: string[];
}

const STORAGE_KEY = "library-chat-history";

function loadHistory(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(messages: ChatMessage[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
}

const ThinkingDots = () => (
  <div className="flex justify-start">
    <div className="bg-secondary rounded-lg px-4 py-3 max-w-[85%]">
      <div className="flex items-center gap-1">
        <span className="text-sm text-muted-foreground mr-1">Thinking</span>
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  </div>
);

const FollowupButtons = ({ followups, onSend }: { followups: string[]; onSend: (text: string) => void }) => {
  if (!followups || followups.length === 0) return null;
  return (
    <div className="flex gap-2 mt-2 ml-1">
      {followups.map((f, i) => (
        <button
          key={i}
          onClick={() => onSend(f)}
          className="text-xs border border-border/60 rounded-full px-3 py-1.5 text-muted-foreground hover:text-foreground hover:border-border transition-colors"
        >
          {f}
        </button>
      ))}
    </div>
  );
};

const Chat = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>(loadHistory);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatEnabled, setChatEnabled] = useState<boolean | null>(null);
  const [starters, setStarters] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Persist to localStorage
  useEffect(() => {
    saveHistory(messages);
  }, [messages]);

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

  // Generate dynamic starters from user's top tag
  useEffect(() => {
    if (!user) return;
    const fetchStarters = async () => {
      // Get most-used tag
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

      // Count tag frequency
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: ChatMessage = { role: "user", content: text.trim() };
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("chat", {
        body: { message: text.trim(), history },
      });

      if (error) throw error;

      if (data?.error) {
        toast.error(data.error);
        setLoading(false);
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer,
          followups: data.followups,
        },
      ]);
    } catch (e: any) {
      toast.error(e.message || "Failed to get response");
    } finally {
      setLoading(false);
    }
  }, [messages, loading]);

  const clearConversation = () => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
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

  const hasMessages = messages.length > 0;

  return (
    <div className="mx-auto max-w-3xl px-6 py-6 animate-fade-in flex flex-col" style={{ height: "calc(100vh - 3.5rem)" }}>
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
            Chat with your library
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Think through ideas using everything you've saved.
          </p>
        </div>
        {hasMessages && (
          <button
            onClick={clearConversation}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors mt-2 flex items-center gap-1"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        )}
      </div>

      {/* Messages area */}
      <ScrollArea className="flex-1 min-h-0 mb-4">
        <div className="space-y-4 pb-2">
          {/* Empty state */}
          {!hasMessages && !loading && (
            <div className="flex flex-col items-center justify-center pt-32 gap-8">
              <p className="text-muted-foreground text-lg italic">
                What are you thinking about?
              </p>
              <div className="flex flex-wrap justify-center gap-2 max-w-lg">
                {starters.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-full border border-border px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i}>
              <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`rounded-lg px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-accent text-accent-foreground max-w-[70%] text-sm"
                      : "bg-secondary text-foreground max-w-[85%]"
                  }`}
                  style={msg.role === "assistant" ? { fontSize: "16px", lineHeight: "1.75" } : undefined}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
              {/* Follow-up buttons after assistant messages */}
              {msg.role === "assistant" && (
                <FollowupButtons followups={msg.followups || []} onSend={send} />
              )}
            </div>
          ))}

          {loading && <ThinkingDots />}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input row */}
      <div className="flex gap-2 items-end border-t border-border pt-3">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your library…"
          className="min-h-[44px] max-h-[100px] resize-none flex-1"
          rows={1}
        />
        <Button
          onClick={() => send(input)}
          disabled={!input.trim() || loading}
          size="icon"
          className="bg-accent text-accent-foreground hover:bg-accent/90 shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default Chat;
