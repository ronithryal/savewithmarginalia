import { format } from "date-fns";
import { ExternalLink } from "lucide-react";

interface ArticleCardProps {
  article: {
    id: string;
    title: string;
    url: string;
    source_domain: string;
    created_at: string;
    preview_image_url: string | null;
    content_text: string | null; // used as description/summary
  };
  fullWidth?: boolean;
}

const XIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const isTwitterUrl = (url: string) =>
  /^https?:\/\/(www\.)?(twitter\.com|x\.com)\//i.test(url);

const isLinkedInUrl = (url: string) =>
  /^https?:\/\/(www\.)?linkedin\.com\//i.test(url);

const ArticleCard = ({ article, fullWidth = false }: ArticleCardProps) => {
  const isTwitter = isTwitterUrl(article.url);
  const isLinkedIn = isLinkedInUrl(article.url);
  const description = article.content_text || "";
  const dateStr = format(new Date(article.created_at), "MMMM d, yyyy");

  const displayTitle = () => {
    if (!article.title || article.title === article.url || article.title.trim() === "") {
      return "Untitled article";
    }
    return article.title;
  };

  // Twitter/X card variant
  if (isTwitter) {
    // Extract @handle from URL if possible
    const handleMatch = article.url.match(/(?:twitter\.com|x\.com)\/([^/]+)/i);
    const handle = handleMatch ? `@${handleMatch[1]}` : "";

    return (
      <div
        className={`bg-article-card border border-article-card-border rounded-lg overflow-hidden ${
          fullWidth ? "max-w-[680px] mx-auto" : ""
        }`}
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-foreground">
              <XIcon />
            </div>
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              X (Twitter)
            </span>
          </div>

          {(displayTitle() !== "Untitled article" || handle) && (
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-sm font-semibold text-foreground">
                {displayTitle() !== "Untitled article" ? displayTitle() : handle}
              </span>
              {handle && displayTitle() !== "Untitled article" && (
                <span className="text-xs text-muted-foreground">{handle}</span>
              )}
            </div>
          )}

          {description && (
            <p className="text-sm text-foreground leading-relaxed line-clamp-6 mb-3">
              {description}
            </p>
          )}

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{dateStr}</span>
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-accent hover:underline inline-flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              x.com <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Standard / LinkedIn card
  return (
    <div
      className={`bg-article-card border border-article-card-border rounded-lg overflow-hidden ${
        fullWidth ? "max-w-[680px] mx-auto" : ""
      }`}
    >
      {article.preview_image_url && (
        <div className="w-full h-40 overflow-hidden">
          <img
            src={article.preview_image_url}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      )}

      <div className="p-4">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground block mb-1.5">
          {isLinkedIn ? "LINKEDIN" : article.source_domain.toUpperCase()}
        </span>

        <h3 className="font-display text-[15px] font-bold text-foreground leading-snug line-clamp-2 mb-1.5">
          {displayTitle()}
        </h3>

        {description && (
          <p className="text-[13px] text-muted-foreground leading-relaxed line-clamp-3 mb-3">
            {description}
          </p>
        )}

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{dateStr}</span>
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-accent hover:underline inline-flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            Read → 
          </a>
        </div>
      </div>
    </div>
  );
};

export default ArticleCard;
