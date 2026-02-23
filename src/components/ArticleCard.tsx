import { format } from "date-fns";
import { ExternalLink, Link2, Trash2 } from "lucide-react";

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
}

const XIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const LinkedInIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);

const isTwitterUrl = (url: string) =>
  /^https?:\/\/(www\.)?(twitter\.com|x\.com)\//i.test(url);

const isLinkedInUrl = (url: string) =>
  /^https?:\/\/(www\.)?linkedin\.com\//i.test(url);

const ArticleCard = ({ article, fullWidth = false, onDelete }: ArticleCardProps) => {
  const isTwitter = isTwitterUrl(article.url);
  const isLinkedIn = isLinkedInUrl(article.url);
  const description = article.content_text || "";

  const displayTitle = () => {
    if (!article.title || article.title === article.url || article.title.trim() === "") {
      return "Untitled article";
    }
    return article.title;
  };

  // Twitter/X card — mimics WhatsApp's tweet preview
  if (isTwitter) {
    const handleMatch = article.url.match(/(?:twitter\.com|x\.com)\/([^/]+)/i);
    const handle = handleMatch ? `@${handleMatch[1]}` : "";

    return (
      <div className={`group relative bg-card border border-border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow ${fullWidth ? "max-w-[680px] mx-auto" : ""}`}>
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
          {(displayTitle() !== "Untitled article" || handle) && (
            <h3 className="font-display text-base font-bold text-foreground leading-snug line-clamp-2 mb-1">
              {displayTitle() !== "Untitled article" ? displayTitle() : handle}
            </h3>
          )}

          {description && (
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 mb-3">
              {description}
            </p>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Link2 className="h-3.5 w-3.5" />
              <span className="text-xs">x.com</span>
            </div>
            <XIcon />
          </div>
        </div>

        {onDelete && (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(article.id); }}
            className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm text-muted-foreground hover:text-destructive transition-colors p-1.5 rounded-md opacity-0 group-hover:opacity-100"
            aria-label="Delete article"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }

  // LinkedIn card
  if (isLinkedIn) {
    return (
      <div className={`group relative bg-card border border-border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow ${fullWidth ? "max-w-[680px] mx-auto" : ""}`}>
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
            {displayTitle()}
          </h3>

          {description ? (
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 mb-3">
              {description}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground italic mb-3">
              LinkedIn preview unavailable — LinkedIn blocks external content fetching.
            </p>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Link2 className="h-3.5 w-3.5" />
              <span className="text-xs">linkedin.com</span>
            </div>
            <LinkedInIcon />
          </div>
        </div>

        {onDelete && (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(article.id); }}
            className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm text-muted-foreground hover:text-destructive transition-colors p-1.5 rounded-md opacity-0 group-hover:opacity-100"
            aria-label="Delete article"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }

  // Standard article card — WhatsApp style: image → title → description → source
  return (
    <div className={`group relative bg-card border border-border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow ${fullWidth ? "max-w-[680px] mx-auto" : ""}`}>
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
          {displayTitle()}
        </h3>

        {description && (
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 mb-3">
            {description}
          </p>
        )}

        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Link2 className="h-3.5 w-3.5" />
          <span className="text-xs">{article.source_domain}</span>
        </div>
      </div>

      {onDelete && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(article.id); }}
          className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm text-muted-foreground hover:text-destructive transition-colors p-1.5 rounded-md opacity-0 group-hover:opacity-100"
          aria-label="Delete article"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
};

export default ArticleCard;
