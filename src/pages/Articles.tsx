import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ExternalLink } from "lucide-react";

const Articles = () => {
  const { user } = useAuth();

  const { data: articles, isLoading } = useQuery({
    queryKey: ["articles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("articles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  return (
    <div className="mx-auto max-w-2xl px-6 py-16 animate-fade-in">
      <h1 className="font-display text-3xl font-bold tracking-tight text-foreground mb-8">
        Articles
      </h1>

      {isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}

      {articles && articles.length === 0 && (
        <p className="text-muted-foreground text-sm">
          No articles yet. <Link to="/" className="text-accent hover:underline">Save your first one.</Link>
        </p>
      )}

      <div className="divide-y divide-border">
        {articles?.map((article) => (
          <Link
            key={article.id}
            to={`/articles/${article.id}`}
            className="flex items-start justify-between py-4 group"
          >
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-medium text-foreground group-hover:text-accent transition-colors truncate">
                {article.title || article.url}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {article.source_domain} · {formatDistanceToNow(new Date(article.created_at), { addSuffix: true })}
              </p>
            </div>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-3 mt-0.5 flex-shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Articles;
