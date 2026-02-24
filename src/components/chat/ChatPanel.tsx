import { useState, useRef, useEffect } from "react";
import { Send, X, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ChatMessage } from "@/pages/Chat";

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

interface Props {
  messages: ChatMessage[];
  loading: boolean;
  starters: string[];
  hasActiveSession: boolean;
  onSend: (text: string) => void;
  onClearMessages: () => void;
  onOpenSidebar?: () => void;
}

export function ChatPanel({
  messages,
  loading,
  starters,
  hasActiveSession,
  onSend,
  onClearMessages,
  onOpenSidebar,
}: Props) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim()) {
        onSend(input.trim());
        setInput("");
      }
    }
  };

  const handleSendClick = () => {
    if (input.trim()) {
      onSend(input.trim());
      setInput("");
    }
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-full px-6 py-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          {onOpenSidebar && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={onOpenSidebar}
            >
              <Menu className="h-4 w-4" />
            </Button>
          )}
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
              Chat with your library
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Think through ideas using everything you've saved.
            </p>
          </div>
        </div>
        {hasMessages && (
          <button
            onClick={onClearMessages}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors mt-2 flex items-center gap-1"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0 mb-4">
        <div className="space-y-4 pb-2">
          {!hasMessages && !loading && (
            <div className="flex flex-col items-center justify-center pt-32 gap-8">
              <p className="text-muted-foreground text-lg italic">
                What are you thinking about?
              </p>
              <div className="flex flex-wrap justify-center gap-2 max-w-lg">
                {starters.map((s) => (
                  <button
                    key={s}
                    onClick={() => onSend(s)}
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
              <div
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`rounded-lg px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-accent text-accent-foreground max-w-[70%] text-sm"
                      : "bg-secondary text-foreground max-w-[85%]"
                  }`}
                  style={
                    msg.role === "assistant"
                      ? { fontSize: "16px", lineHeight: "1.75" }
                      : undefined
                  }
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
              {msg.role === "assistant" &&
                msg.followups &&
                msg.followups.length > 0 && (
                  <div className="flex gap-2 mt-2 ml-1">
                    {msg.followups.map((f, j) => (
                      <button
                        key={j}
                        onClick={() => onSend(f)}
                        className="text-xs border border-border/60 rounded-full px-3 py-1.5 text-muted-foreground hover:text-foreground hover:border-border transition-colors"
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                )}
            </div>
          ))}

          {loading && <ThinkingDots />}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input */}
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
          onClick={handleSendClick}
          disabled={!input.trim() || loading}
          size="icon"
          className="bg-accent text-accent-foreground hover:bg-accent/90 shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
