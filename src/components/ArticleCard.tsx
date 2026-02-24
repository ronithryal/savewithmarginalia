import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ExternalLink, Link2, Trash2, Pencil } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
interface ArticleCardProps {
  article: {
    id: string;
    title: string;
    url: string;
    source_domain: string;
    created_at: string;
    preview_image_url: string | null;
    content_text: string | null;
  };
  fullWidth?: boolean;
  onDelete?: (id: string) => void;
  onTitleEdit?: (id: string, newTitle: string) => void;
}

const XIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const LinkedInIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#0A66C2]" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);

const isTwitterUrl = (url: string) =>
  /^https?:\/\/(www\.)?(twitter\.com|x\.com)\//i.test(url);

const isLinkedInUrl = (url: string) =>
  /^https?:\/\/(www\.)?linkedin\.com\//i.test(url);

function inferLinkedInLabel(url: string): string {
  if (/\/posts\//i.test(url)) return "LinkedIn Post";
  if (/\/in\//i.test(url)) return "LinkedIn Profile";
  if (/\/company\//i.test(url)) return "LinkedIn Company Page";
  if (/\/articles?\//i.test(url)) return "LinkedIn Article";
  return "LinkedIn Post";
}

function parseTwitterTitle(title: string): { name: string; handle: string | null } {
  const match = title.match(/^(.+?)\s*\((@[^)]+)\)$/);
  if (match) return { name: match[1].trim(), handle: match[2] };
  if (title.startsWith("@")) return { name: "", handle: title };
  return { name: title, handle: null };
}

const DeleteButton = ({ onDelete, id }: { onDelete: (id: string) => void; id: string }) => (
  <button
    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(id); }}
    className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm text-muted-foreground hover:text-destructive transition-colors p-1.5 rounded-md opacity-0 group-hover:opacity-100"
    aria-label="Delete article"
  >
    <Trash2 className="h-3.5 w-3.5" />
  </button>
);

const AiExplainButton = ({ url }: { url: string }) => {
  const navigate = useNavigate();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            navigate("/chat", { state: { initialMessage: `Explain this: ${url}` } });
          }}
          className="absolute top-2 right-10 bg-background/80 backdrop-blur-sm text-muted-foreground hover:text-accent transition-colors p-1.5 rounded-md opacity-0 group-hover:opacity-100 text-[10px] font-bold leading-none"
          aria-label="Explain this article with AI"
        >
          AI
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">Explain this</TooltipContent>
    </Tooltip>
  );
};

function EditableTitle({
  title,
  articleId,
  onTitleEdit,
  className,
}: {
  title: string;
  articleId: string;
  onTitleEdit?: (id: string, newTitle: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    setValue(title);
  }, [title]);

  const commit = () => {
    setEditing(false);
    const trimmed = value.trim();
    if (trimmed && trimmed !== title && onTitleEdit) {
      onTitleEdit(articleId, trimmed);
    } else {
      setValue(title);
    }
  };

  if (!onTitleEdit) {
    return <span className={className}>{title}</span>;
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") { setValue(title); setEditing(false); }
        }}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
        className={`${className} bg-transparent border-b border-accent outline-none w-full`}
      />
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 group/title">
      <span className={className}>{title}</span>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditing(true); }}
        className="text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100 group-hover/title:opacity-100 flex-shrink-0"
        aria-label="Edit title"
      >
        <Pencil className="h-3 w-3" />
      </button>
    </span>
  );
}

const ArticleCard = ({ article, fullWidth = false, onDelete, onTitleEdit }: ArticleCardProps) => {
  const isTwitter = isTwitterUrl(article.url);
  const isLinkedIn = isLinkedInUrl(article.url);
  const description = article.content_text || "";
  const formattedDate = format(new Date(article.created_at), "MMMM d, yyyy");

  const displayTitle = () => {
    if (!article.title || article.title === article.url || article.title.trim() === "") {
      return "Untitled article";
    }
    return article.title;
  };

  // ─── X/Twitter card ───
  if (isTwitter) {
    const { name, handle } = parseTwitterTitle(displayTitle());

    return (
      <div className={`group relative bg-[hsl(var(--article-card))] border border-[hsl(var(--article-card-border))] rounded-lg overflow-hidden ${fullWidth ? "max-w-[680px] mx-auto" : ""}`}>
        <div className="flex items-start justify-between p-4 pb-0">
          <div className="min-w-0 flex-1">
            <EditableTitle
              title={name}
              articleId={article.id}
              onTitleEdit={onTitleEdit ? (id, newName) => {
                const newFull = handle ? `${newName} (${handle})` : newName;
                onTitleEdit(id, newFull);
              } : undefined}
              className="font-display text-sm font-bold text-foreground leading-tight"
            />
            {handle && (
              <p className="text-xs text-muted-foreground leading-tight mt-0.5">{handle}</p>
            )}
          </div>
          <div className="flex-shrink-0 ml-3 text-foreground">
            <XIcon />
          </div>
        </div>

        <div className="px-4 pt-2 pb-3">
          {description ? (
            <p className="text-sm text-foreground leading-relaxed">{description}</p>
          ) : (
            <p className="text-[13px] text-muted-foreground italic">This tweet may be unavailable, protected, or deleted.</p>
          )}
        </div>

        {article.preview_image_url ? (
          <div className="px-4 pb-3">
            <div className="w-full max-h-[200px] overflow-hidden rounded-md bg-muted">
              <img
                src={article.preview_image_url}
                alt=""
                className="w-full h-full object-cover max-h-[200px]"
                loading="lazy"
                onError={(e) => { (e.currentTarget as HTMLImageElement).parentElement!.style.display = "none"; }}
              />
            </div>
          </div>
        ) : (
          <div className="mx-4 mb-3 rounded-md flex items-center justify-center" style={{ backgroundColor: "#F3F4F6", height: 48 }}>
            <span style={{ fontSize: 11, color: "#9CA3AF" }}>Media not loaded · Save via extension for full preview</span>
          </div>
        )}

        <div className="flex items-center justify-between px-4 pb-3">
          <span className="text-xs text-muted-foreground">{formattedDate}</span>
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-accent hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            Open on X →
          </a>
        </div>

        <AiExplainButton url={article.url} />
        {onDelete && <DeleteButton onDelete={onDelete} id={article.id} />}
      </div>
    );
  }

  // ─── LinkedIn card ───
  if (isLinkedIn) {
    const label = inferLinkedInLabel(article.url);

    return (
      <div className={`group relative bg-[hsl(var(--article-card))] border border-[hsl(var(--article-card-border))] rounded-lg overflow-hidden ${fullWidth ? "max-w-[680px] mx-auto" : ""}`}>
        <div className="flex items-center justify-between p-4 pb-0">
          <EditableTitle
            title={label}
            articleId={article.id}
            onTitleEdit={onTitleEdit}
            className="font-display text-sm font-bold text-foreground"
          />
          <div className="flex-shrink-0 ml-3">
            <LinkedInIcon />
          </div>
        </div>

        <div className="px-4 pt-2 pb-3">
          <p className="text-sm text-muted-foreground">Preview not available for LinkedIn content.</p>
        </div>

        <div className="flex items-center justify-between px-4 pb-3">
          <span className="text-xs text-muted-foreground">{formattedDate} · linkedin.com</span>
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-accent hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            Open on LinkedIn →
          </a>
        </div>

        <AiExplainButton url={article.url} />
        {onDelete && <DeleteButton onDelete={onDelete} id={article.id} />}
      </div>
    );
  }

  // ─── Standard article card ───
  return (
    <div className={`group relative bg-[hsl(var(--article-card))] border border-[hsl(var(--article-card-border))] rounded-lg overflow-hidden ${fullWidth ? "max-w-[680px] mx-auto" : ""}`}>
      {article.preview_image_url && (
        <div className="w-full aspect-video overflow-hidden bg-muted">
          <img
            src={article.preview_image_url}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        </div>
      )}

      <div className="p-4">
        <h3 className="font-display text-base font-bold text-foreground leading-snug line-clamp-2 mb-1">
          <EditableTitle
            title={displayTitle()}
            articleId={article.id}
            onTitleEdit={onTitleEdit}
            className=""
          />
        </h3>

        {description && (
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 mb-3">
            {description}
          </p>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Link2 className="h-3.5 w-3.5" />
            <span className="text-xs">{article.source_domain}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{formattedDate}</span>
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-accent hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              Open →
            </a>
          </div>
        </div>
      </div>

      <AiExplainButton url={article.url} />
      {onDelete && <DeleteButton onDelete={onDelete} id={article.id} />}
    </div>
  );
};

export default ArticleCard;
