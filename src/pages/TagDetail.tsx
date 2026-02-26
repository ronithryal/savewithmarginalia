import { useState } from "react";
import { useParams, Link, useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
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

  // ── Threads: chat_session_tags → chat_sessions + message counts ──
  const { data: threads } = useQuery({
    queryKey: ["tag-threads", tag?.id],
    queryFn: async () => {
      // 1. Get session IDs linked to this tag
      const { data: sessionTags, error: e1 } = await supabase
        .from("chat_session_tags" as any)
        .select("session_id")
        .eq("tag_id", tag!.id);
      if (e1) throw e1;
      if (!sessionTags || (sessionTags as any[]).length === 0) return [];

      const sessionIds = (sessionTags as any[]).map((r) => r.session_id);

      // 2. Fetch those sessions
      const { data: sessions, error: e2 } = await supabase
        .from("chat_sessions" as any)
        .select("*")
        .in("id", sessionIds)
        .order("updated_at", { ascending: false });
      if (e2) throw e2;
      if (!sessions || (sessions as any[]).length === 0) return [];

      // 3. Fetch message counts for each session
      const messageCounts = await Promise.all(
        (sessions as any[]).map(async (s) => {
          const { count } = await supabase
            .from("chat_messages" as any)
            .select("id", { count: "exact", head: true })
            .eq("session_id", s.id);
          return { sessionId: s.id, count: count ?? 0 };
        })
      );
      const countMap = new Map(messageCounts.map((r) => [r.sessionId, r.count]));

      return (sessions as any[]).map((s) => ({
        ...s,
        message_count: countMap.get(s.id) ?? 0,
      }));
    },
    enabled: !!tag,
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
    (threads ?? []).forEach((t) => feed.push({ type: "thread", created_at: t.updated_at, data: t }));
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
    await supabase.from("chat_sessions" as any).delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["tag-threads", tag?.id] });
  };

  const pills: { label: string; value: Filter }[] = [
    { label: "All", value: "all" },
    { label: "Articles", value: "articles" },
    { label: "Quotes", value: "quotes" },
    { label: "Threads", value: "threads" },
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
        {tc > 0 && ` · ${tc} ${tc === 1 ? "thread" : "threads"}`}
      </p>

      {/* Filter pills */}
      <div className="flex gap-2 mb-8 flex-wrap">
        {pills.map((p) => (
          <button
            key={p.value}
            onClick={() => setFilter(p.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filter === p.value
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Empty states */}
      {filter === "threads" && tc === 0 && (
        <p className="text-muted-foreground text-sm py-12 text-center">
          No conversations yet for #{tagName}. Use the AI button on an article or quote tagged with #{tagName} to start one.
        </p>
      )}

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
                messageCount={t.message_count}
                updatedAt={t.updated_at}
                fullWidth
                onClick={() => navigate("/chat", { state: { openSessionId: t.id } })}
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
