import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import QuoteCard from "@/components/QuoteCard";

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

      <div className="space-y-5">
        {quotes?.map((quote) => {
          const article = (quote as any).articles;
          return (
            <QuoteCard
              key={quote.id}
              quote={quote}
              article={article}
            />
          );
        })}
      </div>
    </div>
  );
};

export default Quotes;
