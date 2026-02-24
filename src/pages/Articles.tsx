import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import ArticleCard from "@/components/ArticleCard";

const FeaturedCard = ({
  article,
  onDelete,
  onTitleEdit,
}: {
  article: any;
  onDelete: (id: string) => void;
  onTitleEdit: (id: string, t: string) => void;
}) => {
  const hasImage = !!article.preview_image_url;

  if (hasImage) {
    return (
      <Link to={`/articles/${article.id}`} className="block col-span-full">
        <div className="group relative w-full aspect-video rounded-lg overflow-hidden bg-muted">
          <img
            src={article.preview_image_url}
            alt=""
            className="w-full h-full object-cover"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-white leading-snug line-clamp-2">
              {article.title || "Untitled article"}
            </h2>
            <p className="text-sm text-white/70 mt-1">{article.source_domain}</p>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link to={`/articles/${article.id}`} className="block col-span-full">
      <div className="group relative py-8">
        <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground leading-snug line-clamp-2 mb-2">
          {article.title || "Untitled article"}
        </h2>
        <p className="text-sm text-muted-foreground">{article.source_domain}</p>
      </div>
    </Link>
  );
};

const Articles = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

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

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("articles").delete().eq("id", id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      queryClient.invalidateQueries({ queryKey: ["articles"] });
      toast({ title: "Article deleted" });
    }
  };

  const handleTitleEdit = async (id: string, newTitle: string) => {
    await supabase.from("articles").update({ title: newTitle }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["articles"] });
  };

  const featured = articles?.[0];
  const rest = articles?.slice(1);

  return (
    <div className="mx-auto max-w-5xl px-6 py-16 animate-fade-in">
      <p className="text-xs tracking-widest uppercase text-muted-foreground mb-2">
        Your Library
      </p>
      <div className="flex items-baseline gap-3 mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
          Articles
        </h1>
        {articles && (
          <span className="text-sm text-muted-foreground">{articles.length}</span>
        )}
      </div>

      {isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}

      {articles && articles.length === 0 && (
        <p className="text-muted-foreground text-sm">
          No articles yet. <Link to="/" className="text-accent hover:underline">Save your first one.</Link>
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {featured && (
          <FeaturedCard
            article={featured}
            onDelete={handleDelete}
            onTitleEdit={handleTitleEdit}
          />
        )}
        {rest?.map((article) => (
          <Link key={article.id} to={`/articles/${article.id}`}>
            <ArticleCard article={article} onDelete={handleDelete} onTitleEdit={handleTitleEdit} />
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Articles;
