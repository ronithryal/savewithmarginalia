import { format } from "date-fns";
import { MessageSquare, Trash2 } from "lucide-react";

export interface ThreadCardProps {
  id: string;
  title: string;
  messageCount: number;
  updatedAt: string;
  fullWidth?: boolean;
  onClick: () => void;
  onDelete?: (id: string) => void;
}

const ThreadCard = ({
  id,
  title,
  messageCount,
  updatedAt,
  fullWidth = false,
  onClick,
  onDelete,
}: ThreadCardProps) => {
  const formattedDate = format(new Date(updatedAt), "MMMM d, yyyy");

  return (
    <div
      onClick={onClick}
      className={`group relative bg-[hsl(var(--article-card))] border border-[hsl(var(--article-card-border))] rounded-lg overflow-hidden cursor-pointer ${fullWidth ? "max-w-[680px] mx-auto" : ""
        }`}
    >
      <div className="p-4">
        <div className="flex items-start gap-2 mb-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <h3 className="font-display text-base font-bold text-foreground leading-snug line-clamp-2">
            {title || "Untitled conversation"}
          </h3>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {messageCount} {messageCount === 1 ? "message" : "messages"}
          </span>
          <span className="text-xs text-muted-foreground">{formattedDate}</span>
        </div>
      </div>

      {onDelete && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete(id);
          }}
          className="absolute top-2 right-2 bg-foreground/80 backdrop-blur-sm text-background hover:text-destructive transition-colors p-1.5 rounded-md sm:opacity-0 sm:group-hover:opacity-100"
          aria-label="Delete conversation"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
};

export default ThreadCard;
