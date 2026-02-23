import { formatDistanceToNow } from "date-fns";

interface Quote {
  id: string;
  text: string;
  created_at: string;
}

interface QuotesListProps {
  quotes?: Quote[];
  articleId: string;
}

const QuotesList = ({ quotes }: QuotesListProps) => {
  return (
    <section>
      <h2 className="font-display text-xl font-semibold text-foreground mb-4">
        Quotes ({quotes?.length || 0})
      </h2>
      {quotes && quotes.length === 0 && (
        <p className="text-sm text-muted-foreground">No quotes yet for this article.</p>
      )}
      <div className="space-y-4">
        {quotes?.map((quote) => (
          <blockquote key={quote.id} className="border-l-2 border-accent pl-4 py-2">
            <p className="text-foreground text-sm leading-relaxed line-clamp-6">{quote.text}</p>
            <span className="text-xs text-muted-foreground mt-1.5 block">
              {formatDistanceToNow(new Date(quote.created_at), { addSuffix: true })}
            </span>
          </blockquote>
        ))}
      </div>
    </section>
  );
};

export default QuotesList;
