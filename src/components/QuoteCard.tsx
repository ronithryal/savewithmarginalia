import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Trash2, Pencil } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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
  onDelete?: (id: string) => void;
  onTextEdit?: (id: string, newText: string) => void;
}

const AiExplainButton = ({ text }: { text: string }) => {
  const navigate = useNavigate();
  const snippet = text.length > 120 ? text.slice(0, 120) + "…" : text;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            navigate("/chat", { state: { initialMessage: `Explain this quote: "${snippet}"` } });
          }}
          className="absolute top-2 right-10 bg-background/80 backdrop-blur-sm text-muted-foreground hover:text-accent transition-colors p-1.5 rounded-md opacity-0 group-hover:opacity-100 text-[10px] font-bold leading-none"
          aria-label="Explain this quote with AI"
        >
          AI
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">Explain this</TooltipContent>
    </Tooltip>
  );
};

function EditableText({
  text,
  quoteId,
  onTextEdit,
}: {
  text: string;
  quoteId: string;
  onTextEdit?: (id: string, newText: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(text);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  }, [editing]);

  useEffect(() => { setValue(text); }, [text]);

  const commit = () => {
    setEditing(false);
    const trimmed = value.trim();
    if (trimmed && trimmed !== text && onTextEdit) {
      onTextEdit(quoteId, trimmed);
    } else {
      setValue(text);
    }
  };

  if (!onTextEdit) {
    return (
      <p className="font-display text-base font-bold text-foreground leading-snug line-clamp-4">
        "{text}"
      </p>
    );
  }

  if (editing) {
    return (
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          e.target.style.height = "auto";
          e.target.style.height = e.target.scrollHeight + "px";
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Escape") { setValue(text); setEditing(false); }
        }}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
        className="font-display text-base font-bold text-foreground leading-snug bg-transparent border-b border-accent outline-none w-full resize-none"
      />
    );
  }

  return (
    <span className="inline-flex items-start gap-1.5 group/title">
      <p className="font-display text-base font-bold text-foreground leading-snug line-clamp-4">
        "{text}"
      </p>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditing(true); }}
        className="text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100 group-hover/title:opacity-100 flex-shrink-0 mt-1"
        aria-label="Edit quote text"
      >
        <Pencil className="h-3 w-3" />
      </button>
    </span>
  );
}

const QuoteCard = ({ quote, article, fullWidth = false, onDelete, onTextEdit }: QuoteCardProps) => {
  const formattedDate = format(new Date(quote.created_at), "MMMM d, yyyy");

  return (
    <div
      className={`group relative bg-[hsl(var(--article-card))] border border-[hsl(var(--article-card-border))] rounded-lg overflow-hidden ${fullWidth ? "max-w-[680px] mx-auto" : ""}`}
    >
      <div className="p-4">
        <EditableText text={quote.text} quoteId={quote.id} onTextEdit={onTextEdit} />

        <div className="flex items-center justify-between mt-3">
          <div className="min-w-0" />
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

      <AiExplainButton text={quote.text} />
      {onDelete && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(quote.id); }}
          className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm text-muted-foreground hover:text-destructive transition-colors p-1.5 rounded-md opacity-0 group-hover:opacity-100"
          aria-label="Delete quote"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
};

export default QuoteCard;
