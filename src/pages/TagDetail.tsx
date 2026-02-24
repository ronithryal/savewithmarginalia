import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import ArticleCard from "@/components/ArticleCard";

type Filter = "all" | "articles" | "quotes";

const TagDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const tagName = decodeURIComponent(slug || "");
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");

  const { data: tag } = useQuery({
    queryKey: ["tag-by-name", tagName],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tags")
        .select("*")
        .eq("name", tagName)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!tagName,
  });

  const { data: articles } = useQuery({
    queryKey: ["tag-articles", tag?.id],
    queryFn: async () => {
      const { data: articleTags, error } = await supabase
        .from("article_tags")
        .select("article_id")
        .eq("tag_id", tag!.id);
      if (error) throw error;
      if (articleTags.length === 0) return [];
      const ids = articleTags.map((r) => r.article_id);
      const { data: arts } = await supabase
        .from("articles")
        .select("*")
        .in("id", ids)
        .order("created_at", { ascending: false });
      return arts ?? [];
    },
    enabled: !!tag,
  });

  const { data: quotes } = useQuery({
    queryKey: ["tag-quotes", tag?.id],
    queryFn: async () => {
      const { data: quoteTags, error } = await supabase
        .from("quote_tags")
        .select("quote_id")
        .eq("tag_id", tag!.id);
      if (error) throw error;
      if (quoteTags.length === 0) return [];
      const ids = quoteTags.map((r) => r.quote_id);
      const { data: qts } = await supabase
        .from("quotes")
        .select("*, articles(id, title, source_domain)")
        .in("id", ids)
        .order("created_at", { ascending: false });
      return qts ?? [];
    },
    enabled: !!tag,
  });

  const ac = articles?.length ?? 0;
  const qc = quotes?.length ?? 0;

  // Build mixed feed sorted by created_at desc
  type FeedItem =
    | { type: "article"; created_at: string; data: any }
    | { type: "quote"; created_at: string; data: any };

  const feed: FeedItem[] = [];
  if (filter !== "quotes") {
    (articles ?? []).forEach((a) => feed.push({ type: "article", created_at: a.created_at, data: a }));
  }
  if (filter !== "articles") {
    (quotes ?? []).forEach((q) => feed.push({ type: "quote", created_at: q.created_at, data: q }));
  }
  feed.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const handleDeleteArticle = async (id: string) => {
    await supabase.from("articles").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["tag-articles", tag?.id] });
  };

  const handleTitleEdit = async (id: string, newTitle: string) => {
    await supabase.from("articles").update({ title: newTitle }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["tag-articles", tag?.id] });
  };

  const pills: { label: string; value: Filter }[] = [
    { label: "All", value: "all" },
    { label: "Articles", value: "articles" },
    { label: "Quotes", value: "quotes" },
  ];

  return (
    <div className="mx-auto max-w-3xl px-6 py-16 animate-fade-in">
      <Link
        to="/tags"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-8"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to tags
      </Link>

      <h1 className="font-display text-3xl font-bold tracking-tight text-foreground mb-1">
        #{tagName}
      </h1>
      <p className="text-sm text-muted-foreground mb-8">
        {ac} {ac === 1 ? "article" : "articles"} · {qc} {qc === 1 ? "quote" : "quotes"}
      </p>

      <div className="flex gap-2 mb-8">
        {pills.map((p) => (
          <button
            key={p.value}
            onClick={() => setFilter(p.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filter === p.value
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {feed.length === 0 && (
        <p className="text-muted-foreground text-sm py-12 text-center">
          Nothing saved under #{tagName} yet.
        </p>
      )}

      <div className="space-y-5">
        {feed.map((item) => {
          if (item.type === "article") {
            return (
              <Link key={`a-${item.data.id}`} to={`/articles/${item.data.id}`} className="block">
                <ArticleCard
                  article={item.data}
                  fullWidth
                  onDelete={handleDeleteArticle}
                  onTitleEdit={handleTitleEdit}
                />
              </Link>
            );
          }
          const quote = item.data;
          const article = (quote as any).articles;
          return (
            <blockquote key={`q-${quote.id}`} className="border-l-2 border-accent pl-4 py-1">
              <p className="text-foreground text-sm leading-relaxed">
                {quote.text.length > 200 ? quote.text.slice(0, 200) + "…" : quote.text}
              </p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-xs text-muted-foreground">
                  {article?.title || "Unknown"} ·{" "}
                  {formatDistanceToNow(new Date(quote.created_at), { addSuffix: true })}
                </span>
                {article?.id && (
                  <Link
                    to={`/articles/${article.id}`}
                    className="text-xs text-accent hover:underline"
                  >
                    View in article →
                  </Link>
                )}
              </div>
            </blockquote>
          );
        })}
      </div>
    </div>
  );
};

export default TagDetail;
