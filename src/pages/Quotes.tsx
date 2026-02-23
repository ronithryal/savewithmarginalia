import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

const Quotes = () => {
  const { user } = useAuth();

  const { data: quotes, isLoading } = useQuery({
    queryKey: ["all-quotes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("*, articles(id, title, source_domain)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  return (
    <div className="mx-auto max-w-2xl px-6 py-16 animate-fade-in">
      <h1 className="font-display text-3xl font-bold tracking-tight text-foreground mb-8">
        Quotes
      </h1>

      {isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}

      {quotes && quotes.length === 0 && (
        <p className="text-muted-foreground text-sm">
          No quotes yet. Highlight text in an article to save a quote.
        </p>
      )}

      <div className="space-y-6">
        {quotes?.map((quote) => (
          <blockquote key={quote.id} className="border-l-2 border-accent pl-4 py-1">
            <p className="text-foreground text-sm leading-relaxed">
              {quote.text.length > 200 ? quote.text.slice(0, 200) + "…" : quote.text}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <Link
                to={`/articles/${(quote as any).articles?.id}`}
                className="text-xs text-muted-foreground hover:text-accent transition-colors"
              >
                {(quote as any).articles?.title || "Unknown"}
              </Link>
              <span className="text-xs text-muted-foreground">
                · {formatDistanceToNow(new Date(quote.created_at), { addSuffix: true })}
              </span>
            </div>
          </blockquote>
        ))}
      </div>
    </div>
  );
};

export default Quotes;
