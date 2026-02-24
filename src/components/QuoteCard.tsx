import { Link } from "react-router-dom";
import { format } from "date-fns";
import { MessageSquareQuote } from "lucide-react";

interface QuoteCardProps {
  quote: {
    id: string;
    text: string;
    created_at: string;
  };
  article?: {
    id: string;
    title: string;
    source_domain?: string;
  } | null;
  fullWidth?: boolean;
}

const QuoteCard = ({ quote, article, fullWidth = false }: QuoteCardProps) => {
  const formattedDate = format(new Date(quote.created_at), "MMMM d, yyyy");

  return (
    <div
      className={`group relative bg-[hsl(var(--article-card))] border border-[hsl(var(--article-card-border))] rounded-lg overflow-hidden ${fullWidth ? "max-w-[680px] mx-auto" : ""}`}
    >
      <div className="p-4">
        <div className="flex items-start gap-2 mb-2">
          <MessageSquareQuote className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
          <p className="text-sm text-foreground leading-relaxed line-clamp-4">
            "{quote.text}"
          </p>
        </div>

        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
            <span className="text-xs truncate">
              {article?.title || "Unknown source"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{formattedDate}</span>
            {article?.id && (
              <Link
                to={`/articles/${article.id}`}
                className="text-xs font-medium text-accent hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                View in article →
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuoteCard;
