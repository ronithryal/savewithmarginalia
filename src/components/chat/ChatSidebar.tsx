import { useState } from "react";
import { SquarePen, Trash2, Bookmark } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ChatSession } from "@/pages/Chat";

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

interface Props {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onNewChat: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onBookmarkSession: (id: string, bookmarked: boolean) => void;
}

function SessionRow({
  session,
  isActive,
  onSelect,
  onDelete,
  onBookmark,
}: {
  session: ChatSession;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onBookmark: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div
      className={`group flex items-center gap-2 px-4 py-2.5 cursor-pointer transition-colors ${
        isActive ? "bg-secondary" : "hover:bg-secondary/50"
      }`}
      onClick={onSelect}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {session.is_bookmarked && (
            <Bookmark className="h-3 w-3 text-accent fill-accent flex-shrink-0" />
          )}
          <p className="text-sm text-foreground truncate">
            {session.title || "Untitled"}
          </p>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {relativeTime(session.updated_at)}
        </p>
      </div>
      {confirmDelete ? (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
              setConfirmDelete(false);
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground"
            onClick={(e) => {
              e.stopPropagation();
              setConfirmDelete(false);
            }}
          >
            ✕
          </Button>
        </div>
      ) : (
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={`h-6 w-6 ${session.is_bookmarked ? "text-accent opacity-100" : "text-muted-foreground hover:text-accent"}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onBookmark();
                }}
              >
                <Bookmark className={`h-3 w-3 ${session.is_bookmarked ? "fill-current" : ""}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {session.is_bookmarked ? "Remove bookmark" : "Bookmark thread"}
            </TooltipContent>
          </Tooltip>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              setConfirmDelete(true);
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

export function ChatSidebar({
  sessions,
  activeSessionId,
  onNewChat,
  onSelectSession,
  onDeleteSession,
  onBookmarkSession,
}: Props) {
  const bookmarked = sessions.filter((s) => s.is_bookmarked);
  const regular = sessions.filter((s) => !s.is_bookmarked);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          History
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onNewChat}
          title="New chat"
        >
          <SquarePen className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground px-4 py-6 text-center">
            No past conversations yet.
          </p>
        ) : (
          <div className="py-1">
            {bookmarked.length > 0 && (
              <>
                <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Bookmarked
                </p>
                {bookmarked.map((s) => (
                  <SessionRow
                    key={s.id}
                    session={s}
                    isActive={s.id === activeSessionId}
                    onSelect={() => onSelectSession(s.id)}
                    onDelete={() => onDeleteSession(s.id)}
                    onBookmark={() => onBookmarkSession(s.id, false)}
                  />
                ))}
              </>
            )}
            {regular.length > 0 && (
              <>
                {bookmarked.length > 0 && (
                  <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Recent
                  </p>
                )}
                {regular.map((s) => (
                  <SessionRow
                    key={s.id}
                    session={s}
                    isActive={s.id === activeSessionId}
                    onSelect={() => onSelectSession(s.id)}
                    onDelete={() => onDeleteSession(s.id)}
                    onBookmark={() => onBookmarkSession(s.id, true)}
                  />
                ))}
              </>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
