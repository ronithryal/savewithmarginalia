import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Bookmark, Trash2, MessageSquare } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ThreadCardProps {
  session: {
    id: string;
    title: string;
    created_at: string;
    updated_at: string;
    is_bookmarked: boolean;
  };
  fullWidth?: boolean;
  onDelete?: (id: string) => void;
  onUnbookmark?: (id: string) => void;
}

const ThreadCard = ({ session, fullWidth = false, onDelete, onUnbookmark }: ThreadCardProps) => {
  const navigate = useNavigate();
  const formattedDate = format(new Date(session.updated_at), "MMMM d, yyyy");

  return (
    <div
      onClick={() => navigate("/chat")}
      className={`group relative bg-[hsl(var(--article-card))] border border-[hsl(var(--article-card-border))] rounded-lg overflow-hidden cursor-pointer ${fullWidth ? "max-w-[680px] mx-auto" : ""}`}
    >
      <div className="p-4">
        <div className="flex items-start gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-base font-bold text-foreground leading-snug line-clamp-2">
              {session.title || "Untitled thread"}
            </h3>
          </div>
        </div>

        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Bookmark className="h-3 w-3 fill-current" />
            <span className="text-xs">Bookmarked thread</span>
          </div>
          <span className="text-xs text-muted-foreground">{formattedDate}</span>
        </div>
      </div>

      {onUnbookmark && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onUnbookmark(session.id); }}
              className="absolute top-2 right-10 bg-background/80 backdrop-blur-sm text-accent transition-colors p-1.5 rounded-md opacity-0 group-hover:opacity-100"
              aria-label="Remove bookmark"
            >
              <Bookmark className="h-3.5 w-3.5 fill-current" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Remove bookmark</TooltipContent>
        </Tooltip>
      )}
      {onDelete && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(session.id); }}
          className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm text-muted-foreground hover:text-destructive transition-colors p-1.5 rounded-md opacity-0 group-hover:opacity-100"
          aria-label="Delete thread"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
};

export default ThreadCard;
