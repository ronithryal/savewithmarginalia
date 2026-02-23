import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import ArticleCard from "@/components/ArticleCard";

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
    <div className="mx-auto max-w-5xl px-6 py-16 animate-fade-in">
      <h1 className="font-display text-3xl font-bold tracking-tight text-foreground mb-8">
        Articles
      </h1>

      {isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}

      {articles && articles.length === 0 && (
        <p className="text-muted-foreground text-sm">
          No articles yet. <Link to="/" className="text-accent hover:underline">Save your first one.</Link>
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {articles?.map((article) => (
          <Link key={article.id} to={`/articles/${article.id}`}>
            <ArticleCard article={article} />
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Articles;
