import { format } from "date-fns";
import { AlignLeft, Tag, Hash, Trash2 } from "lucide-react";

export interface ThreadCardProps {
  id: string;
  title: string;
  description?: string | null;
  itemCount?: number;
  tagName?: string | null;
  tagSlug?: string | null;
  createdAt: string;
  fullWidth?: boolean;
  onClick?: () => void;
  onDelete?: (id: string) => void;
}

const ThreadCard = ({
  id,
  title,
  description,
  itemCount,
  tagName,
  createdAt,
  fullWidth = false,
  onClick,
  onDelete,
}: ThreadCardProps) => {
  const formattedDate = format(new Date(createdAt), "MMMM d, yyyy");

  return (
    <div
      onClick={onClick}
      className={`group relative bg-[hsl(var(--article-card))] border border-[hsl(var(--article-card-border))] rounded-lg overflow-hidden ${onClick ? "cursor-pointer" : ""
        } ${fullWidth ? "max-w-[680px] mx-auto" : ""}`}
    >
      <div className="p-4">
        {/* Title row */}
        <div className="flex items-start gap-2 mb-2">
          <AlignLeft className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-base font-bold text-foreground leading-snug line-clamp-2">
              {title || "Untitled thread"}
            </h3>
            {description && (
              <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 mt-0.5">
                {description}
              </p>
            )}
          </div>
        </div>

        {/* Footer row */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2 text-muted-foreground flex-wrap">
            {tagName && (
              <span className="inline-flex items-center gap-1 text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
                <Hash className="h-3 w-3" />
                {tagName}
              </span>
            )}
            {itemCount != null && (
              <span className="text-xs">
                {itemCount} {itemCount === 1 ? "item" : "items"}
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground flex-shrink-0">{formattedDate}</span>
        </div>
      </div>

      {/* Delete button */}
      {onDelete && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete(id);
          }}
          className="absolute top-2 right-2 bg-foreground/80 backdrop-blur-sm text-background hover:text-destructive transition-colors p-1.5 rounded-md sm:opacity-0 sm:group-hover:opacity-100"
          aria-label="Delete thread"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
};

export default ThreadCard;
