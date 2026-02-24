import { useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { RefreshCw, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ArticleCard from "@/components/ArticleCard";

const Discover = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [refreshKey, setRefreshKey] = useState(0);

  // Count total saved items
  const { data: totalItems } = useQuery({
    queryKey: ["discover-total"],
    queryFn: async () => {
      const [{ count: ac }, { count: qc }] = await Promise.all([
        supabase.from("articles").select("*", { count: "exact", head: true }),
        supabase.from("quotes").select("*", { count: "exact", head: true }),
      ]);
      return (ac ?? 0) + (qc ?? 0);
    },
    enabled: !!user,
  });

  // Get top 5 most-used tags
  const { data: topTags } = useQuery({
    queryKey: ["discover-top-tags", refreshKey],
    queryFn: async () => {
      const [{ data: articleTags }, { data: quoteTags }] = await Promise.all([
        supabase.from("article_tags").select("tag_id"),
        supabase.from("quote_tags").select("tag_id"),
      ]);

      const counts: Record<string, number> = {};
      [...(articleTags ?? []), ...(quoteTags ?? [])].forEach((r) => {
        counts[r.tag_id] = (counts[r.tag_id] || 0) + 1;
      });

      const sorted = Object.entries(counts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([id]) => id);

      if (sorted.length === 0) return [];

      const { data: tags } = await supabase
        .from("tags")
        .select("id, name")
        .in("id", sorted);

      return tags ?? [];
    },
    enabled: !!user,
  });

  // Articles matching top tags, ranked by recency
  const { data: tagArticles, isLoading: loadingTagArticles } = useQuery({
    queryKey: ["discover-tag-articles", topTags, refreshKey],
    queryFn: async () => {
      if (!topTags || topTags.length === 0) return [];

      const tagIds = topTags.map((t) => t.id);
      const { data: articleTagRows } = await supabase
        .from("article_tags")
        .select("article_id")
        .in("tag_id", tagIds);

      if (!articleTagRows || articleTagRows.length === 0) return [];

      const articleIds = [...new Set(articleTagRows.map((r) => r.article_id))];

      const { data: articles } = await supabase
        .from("articles")
        .select("*")
        .in("id", articleIds)
        .order("created_at", { ascending: false })
        .limit(4);

      // Fetch tags for each article
      if (!articles || articles.length === 0) return [];

      const { data: allArticleTags } = await supabase
        .from("article_tags")
        .select("article_id, tag_id")
        .in("article_id", articles.map((a) => a.id));

      const { data: allTags } = await supabase.from("tags").select("id, name");
      const tagMap = Object.fromEntries((allTags ?? []).map((t) => [t.id, t.name]));

      return articles.map((a) => ({
        ...a,
        tags: (allArticleTags ?? [])
          .filter((at) => at.article_id === a.id)
          .map((at) => tagMap[at.tag_id])
          .filter(Boolean),
      }));
    },
    enabled: !!user && !!topTags && topTags.length > 0,
  });

  // Unread articles (last_opened_at is null)
  const { data: unreadArticles, isLoading: loadingUnread } = useQuery({
    queryKey: ["discover-unread", refreshKey],
    queryFn: async () => {
      const { data } = await supabase
        .from("articles")
        .select("*")
        .is("last_opened_at", null)
        .order("created_at", { ascending: false })
        .limit(4);
      return data ?? [];
    },
    enabled: !!user,
  });

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
    queryClient.invalidateQueries({ queryKey: ["discover-top-tags"] });
    queryClient.invalidateQueries({ queryKey: ["discover-tag-articles"] });
    queryClient.invalidateQueries({ queryKey: ["discover-unread"] });
  };

  const tooFewItems = totalItems !== undefined && totalItems < 3;

  return (
    <div className="mx-auto max-w-4xl px-6 py-16 animate-fade-in">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
            Discover
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Recommended based on your library
          </p>
        </div>
        {!tooFewItems && (
          <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-2">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        )}
      </div>

      {tooFewItems ? (
        <div className="text-center py-20">
          <p className="text-muted-foreground text-sm mb-4">
            Save a few articles or quotes first — we'll recommend more based on your taste.
          </p>
          <Link to="/">
            <Button variant="outline">Save your first article →</Button>
          </Link>
        </div>
      ) : (
        <>
          {/* Section 1: Based on your tags */}
          {tagArticles && tagArticles.length > 0 && (
            <section className="mb-12">
              <h2 className="font-display text-xl font-semibold text-foreground mb-4">
                Based on your tags
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {tagArticles.map((article) => (
                  <Link key={article.id} to={`/articles/${article.id}`} className="block">
                    <div className="relative">
                      <ArticleCard article={article} />
                      {article.tags && article.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 px-4 pb-3">
                          {article.tags.slice(0, 3).map((tag) => (
                            <Badge
                              key={tag}
                              variant="secondary"
                              className="text-[11px] font-medium"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Section 2: Unread / From your reading list */}
          {unreadArticles && unreadArticles.length > 0 && (
            <section>
              <h2 className="font-display text-xl font-semibold text-foreground mb-4">
                From your reading list
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {unreadArticles.map((article) => (
                  <Link key={article.id} to={`/articles/${article.id}`} className="block">
                    <div className="relative">
                      <ArticleCard article={article} />
                      <Badge
                        variant="outline"
                        className="absolute top-3 left-3 text-[10px] font-semibold bg-background/80 backdrop-blur-sm"
                      >
                        Unread
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {(!tagArticles || tagArticles.length === 0) &&
            (!unreadArticles || unreadArticles.length === 0) &&
            !loadingTagArticles &&
            !loadingUnread && (
              <p className="text-muted-foreground text-sm text-center py-12">
                No recommendations yet. Try tagging some articles to get personalized suggestions.
              </p>
            )}
        </>
      )}
    </div>
  );
};

export default Discover;
