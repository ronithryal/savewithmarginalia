import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { Send } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

interface Source {
  type: "article" | "quote";
  id: string;
  title?: string;
  url?: string;
  domain?: string;
  text?: string;
  articleTitle?: string;
  articleUrl?: string;
  articleId?: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
}

const STARTERS = [
  "What have I saved about AI agents?",
  "Show me my most interesting quotes",
  "What topics do I read about most?",
];

const Chat = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatEnabled, setChatEnabled] = useState<boolean | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text: string) => {
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
        { role: "assistant", content: data.answer, sources: data.sources },
      ]);
    } catch (e: any) {
      toast.error(e.message || "Failed to get response");
    } finally {
      setLoading(false);
    }
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

  return (
    <div className="mx-auto max-w-3xl px-6 py-6 animate-fade-in flex flex-col" style={{ height: "calc(100vh - 3.5rem)" }}>
      <div className="mb-4">
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
          Chat with your library
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ask anything about your saved articles and quotes.
        </p>
      </div>

      {/* Messages area */}
      <ScrollArea className="flex-1 min-h-0 mb-4">
        <div className="space-y-4 pb-2">
          {messages.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center pt-20 gap-4">
              <p className="text-muted-foreground text-sm">Try asking:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {STARTERS.map((s) => (
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
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`rounded-lg px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-accent text-accent-foreground max-w-[70%]"
                    : "bg-secondary text-foreground max-w-[85%]"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-border/50">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                      Sources
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.sources.map((src, j) =>
                        src.type === "article" ? (
                          <Link key={j} to={`/articles/${src.id}`}>
                            <Badge
                              variant="secondary"
                              className="text-[11px] cursor-pointer hover:bg-muted"
                            >
                              {(src.title || "").slice(0, 30)}
                              {(src.title || "").length > 30 ? "…" : ""}
                            </Badge>
                          </Link>
                        ) : (
                          <Link key={j} to={`/articles/${src.articleId}`}>
                            <Badge
                              variant="outline"
                              className="text-[11px] cursor-pointer border-accent/40 hover:bg-accent/10"
                            >
                              "{(src.text || "").slice(0, 40)}
                              {(src.text || "").length > 40 ? "…" : ""}"
                            </Badge>
                          </Link>
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-secondary rounded-lg px-4 py-3 max-w-[85%]">
                <div className="flex gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}

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
