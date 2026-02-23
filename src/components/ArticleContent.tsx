import DOMPurify from "dompurify";
import { Button } from "@/components/ui/button";

interface ArticleContentProps {
  contentText: string | null;
  retrying: boolean;
  onRetry: () => void;
}

const ArticleContent = ({ contentText, retrying, onRetry }: ArticleContentProps) => {
  if (!contentText) {
    return (
      <section className="mb-12">
        <div className="border border-border rounded-md p-6 space-y-3">
          <p className="text-sm text-muted-foreground">
            We couldn't load content for this article. You can still add quotes manually.
          </p>
          <Button variant="outline" size="sm" onClick={onRetry} disabled={retrying}>
            {retrying ? "Retrying…" : "Retry"}
          </Button>
        </div>
      </section>
    );
  }

  const sanitized = DOMPurify.sanitize(contentText, {
    ALLOWED_TAGS: [
      "p", "h1", "h2", "h3", "h4", "br", "strong", "b", "em", "i",
      "ul", "ol", "li", "a", "img", "blockquote", "figure", "figcaption",
      "div", "span",
    ],
    ALLOWED_ATTR: ["href", "src", "alt", "target", "rel", "class", "style"],
  });

  return (
    <section className="mb-12 py-6">
      <div
        className="article-reader prose prose-sm max-w-none text-foreground leading-relaxed"
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
    </section>
  );
};

export default ArticleContent;
