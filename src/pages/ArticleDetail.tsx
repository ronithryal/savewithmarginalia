import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft } from "lucide-react";

const ArticleDetail = () => {
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();

  const { data: article } = useQuery({
    queryKey: ["article", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("articles")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!id,
  });

  const { data: quotes } = useQuery({
    queryKey: ["article-quotes", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("*")
        .eq("article_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!id,
  });

  if (!article) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-16 animate-fade-in">
      <Link to="/articles" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-8">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to articles
      </Link>

      <header className="mb-10">
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground mb-2">
          {article.title || article.url}
        </h1>
        <p className="text-sm text-muted-foreground">
          {article.source_domain} · {formatDistanceToNow(new Date(article.created_at), { addSuffix: true })}
        </p>
      </header>

      {/* TODO: Render article content here. Add highlight-to-quote interactions. */}
      <div className="border border-border rounded-md p-6 mb-10">
        <p className="text-sm text-muted-foreground italic">
          Article content will be rendered here once URL parsing is implemented.
        </p>
      </div>

      <section>
        <h2 className="font-display text-xl font-semibold text-foreground mb-4">
          Quotes ({quotes?.length || 0})
        </h2>
        {quotes && quotes.length === 0 && (
          <p className="text-sm text-muted-foreground">No quotes yet for this article.</p>
        )}
        <div className="space-y-4">
          {quotes?.map((quote) => (
            <blockquote key={quote.id} className="border-l-2 border-accent pl-4 py-1">
              <p className="text-foreground text-sm leading-relaxed">{quote.text}</p>
              <span className="text-xs text-muted-foreground mt-1 block">
                {formatDistanceToNow(new Date(quote.created_at), { addSuffix: true })}
              </span>
            </blockquote>
          ))}
        </div>
      </section>
    </div>
  );
};

export default ArticleDetail;
