import { useState } from "react";
import { useParams, Link, useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus } from "lucide-react";
import ArticleCard from "@/components/ArticleCard";
import QuoteCard from "@/components/QuoteCard";
import ThreadCard from "@/components/ThreadCard";

type Filter = "all" | "articles" | "quotes" | "threads";

const TagDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const tagName = decodeURIComponent(slug || "");
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialFilter = (searchParams.get("filter") as Filter) || "all";
  const [filter, setFilter] = useState<Filter>(initialFilter);

  // ── New Thread inline form state ──
  const [showNewThread, setShowNewThread] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  // ── Tag lookup ──
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

  // ── Articles ──
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

  // ── Quotes ──
  const { data: quotes } = useQuery({
    queryKey: ["tag-quotes", tag?.id],
    queryFn: async () => {
      const quoteIdSet = new Set<string>();

      const { data: quoteTags } = await supabase
        .from("quote_tags")
        .select("quote_id")
        .eq("tag_id", tag!.id);
      (quoteTags ?? []).forEach((r) => quoteIdSet.add(r.quote_id));

      const { data: articleTags } = await supabase
        .from("article_tags")
        .select("article_id")
        .eq("tag_id", tag!.id);
      const articleIds = (articleTags ?? []).map((r) => r.article_id);
      if (articleIds.length > 0) {
        const { data: articleQuotes } = await supabase
          .from("quotes")
          .select("id")
          .in("article_id", articleIds);
        (articleQuotes ?? []).forEach((r) => quoteIdSet.add(r.id));
      }

      if (quoteIdSet.size === 0) return [];
      const { data: qts } = await supabase
        .from("quotes")
        .select("*, articles(id, title, source_domain, url)")
        .in("id", Array.from(quoteIdSet))
        .order("created_at", { ascending: false });
      return qts ?? [];
    },
    enabled: !!tag,
  });

  // ── Threads (real threads table) ──
  const { data: threads } = useQuery({
    queryKey: ["tag-threads", tag?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("threads")
        .select("*, thread_items(id)")
        .eq("user_id", user!.id)
        .eq("tag_id", tag!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((t: any) => ({
        ...t,
        item_count: Array.isArray(t.thread_items) ? t.thread_items.length : 0,
      }));
    },
    enabled: !!tag && !!user,
  });

  const ac = articles?.length ?? 0;
  const qc = quotes?.length ?? 0;
  const tc = threads?.length ?? 0;

  type FeedItem =
    | { type: "article"; created_at: string; data: any }
    | { type: "quote"; created_at: string; data: any }
    | { type: "thread"; created_at: string; data: any };

  const feed: FeedItem[] = [];
  if (filter === "all" || filter === "articles") {
    (articles ?? []).forEach((a) => feed.push({ type: "article", created_at: a.created_at, data: a }));
  }
  if (filter === "all" || filter === "quotes") {
    (quotes ?? []).forEach((q) => feed.push({ type: "quote", created_at: q.created_at, data: q }));
  }
  if (filter === "all" || filter === "threads") {
    (threads ?? []).forEach((t) => feed.push({ type: "thread", created_at: t.created_at, data: t }));
  }
  feed.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // ── Handlers ──
  const handleDeleteArticle = async (id: string) => {
    await supabase.from("articles").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["tag-articles", tag?.id] });
  };

  const handleTitleEdit = async (id: string, newTitle: string) => {
    await supabase.from("articles").update({ title: newTitle }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["tag-articles", tag?.id] });
  };

  const handleDeleteQuote = async (id: string) => {
    await supabase.from("quotes").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["tag-quotes", tag?.id] });
  };

  const handleQuoteTextEdit = async (id: string, newText: string) => {
    await supabase.from("quotes").update({ text: newText }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["tag-quotes", tag?.id] });
  };

  const handleDeleteThread = async (id: string) => {
    await (supabase as any).from("threads").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["tag-threads", tag?.id] });
  };

  // ── Create new thread ──
  const handleCreateThread = async () => {
    if (!tag || !user || !newTitle.trim()) return;
    setCreating(true);
    const { data, error } = await (supabase as any)
      .from("threads")
      .insert({
        user_id: user.id,
        tag_id: tag.id,
        title: newTitle.trim(),
        description: "",
      })
      .select("id")
      .single();
    setCreating(false);
    if (!error && data?.id) {
      navigate(`/threads/${data.id}`);
    }
  };

  const pills: { label: string; value: Filter }[] = [
    { label: "All", value: "all" },
    { label: "Articles", value: "articles" },
    { label: "Quotes", value: "quotes" },
    { label: "Threads", value: "threads" },
  ];

  const showThreadUi = filter === "threads" || filter === "all";

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
        {tc > 0 && ` · ${tc} ${tc === 1 ? "thread" : "threads"}`}
      </p>

      {/* Filter pills + New Thread button */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {pills.map((p) => (
          <button
            key={p.value}
            onClick={() => { setFilter(p.value); setShowNewThread(false); }}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filter === p.value
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
          >
            {p.label}
          </button>
        ))}

        {showThreadUi && (
          <button
            onClick={() => setShowNewThread((v) => !v)}
            className="ml-auto inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-3 w-3" />
            New Thread
          </button>
        )}
      </div>

      {/* Inline new-thread form */}
      {showNewThread && (
        <div className="mb-6 p-4 bg-[hsl(var(--article-card))] border border-[hsl(var(--article-card-border))] rounded-lg flex items-center gap-3">
          <input
            type="text"
            placeholder="Thread title…"
            value={newTitle}
            autoFocus
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreateThread()}
            className="flex-1 px-3 py-2 text-sm bg-muted rounded-md border border-border outline-none focus:ring-1 focus:ring-accent"
          />
          <button
            onClick={handleCreateThread}
            disabled={!newTitle.trim() || creating}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex-shrink-0"
          >
            {creating ? "Creating…" : "Create"}
          </button>
        </div>
      )}

      {/* Empty state for threads-only view */}
      {filter === "threads" && tc === 0 && !showNewThread && (
        <p className="text-muted-foreground text-sm py-12 text-center">
          No threads yet for #{tagName}.{" "}
          <button
            onClick={() => setShowNewThread(true)}
            className="text-accent hover:underline"
          >
            Create one →
          </button>
        </p>
      )}

      {/* General empty state */}
      {feed.length === 0 && filter !== "threads" && (
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

          if (item.type === "thread") {
            const t = item.data;
            return (
              <ThreadCard
                key={`t-${t.id}`}
                id={t.id}
                title={t.title}
                description={t.description}
                itemCount={t.item_count}
                tagName={tagName}
                tagSlug={slug}
                createdAt={t.created_at}
                fullWidth
                onClick={() => navigate(`/threads/${t.id}`)}
                onDelete={handleDeleteThread}
              />
            );
          }

          const quote = item.data;
          const article = (quote as any).articles;
          return (
            <QuoteCard
              key={`q-${quote.id}`}
              quote={quote}
              article={article}
              fullWidth
              onDelete={handleDeleteQuote}
              onTextEdit={handleQuoteTextEdit}
            />
          );
        })}
      </div>
    </div>
  );
};

export default TagDetail;
