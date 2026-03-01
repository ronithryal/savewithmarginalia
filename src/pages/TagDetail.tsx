import { useState } from "react";
import { useParams, Link, useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, Sparkles, X, Zap, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import ArticleCard from "@/components/ArticleCard";
import QuoteCard from "@/components/QuoteCard";
import ThreadCard from "@/components/ThreadCard";
import { formatNotebookLMExport, copyAndOpenNotebookLM } from "@/lib/exportNotebookLM";

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
  const [exporting, setExporting] = useState(false);
  const [sonarResults, setSonarResults] = useState<{ title: string; url: string; description: string; domain: string }[]>([]);
  const [sonarLoading, setSonarLoading] = useState(false);
  const [brief, setBrief] = useState<string | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [showBrief, setShowBrief] = useState(true);

  const handleFindMore = async () => {
    if (!tag) return;
    setSonarLoading(true);
    try {
      const recentTitles = (articles ?? []).slice(0, 5).map((a: any) => a.title);
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("sonar-discover", {
        body: { tagName, recentTitles },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.error) throw new Error(res.data?.error ?? res.error.message ?? String(res.error));
      setSonarResults(res.data?.results ?? []);
      if ((res.data?.results ?? []).length === 0) toast.info("No new suggestions found");
    } catch (err: any) {
      toast.error(err?.message ?? "Sonar search failed");
    } finally {
      setSonarLoading(false);
    }
  };

  const handleSaveFromSonar = async (url: string) => {
    try {
      await supabase.functions.invoke("bookmarklet-save", { body: { url } });
      toast.success("Saved to your library");
    } catch {
      toast.error("Failed to save");
    }
  };

  const handleGenerateBrief = async () => {
    if (!tag) return;
    setBriefLoading(true);
    setBrief(null);
    setShowBrief(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("reasoning", {
        body: { tagName },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.error) throw new Error(res.data?.error ?? res.error.message ?? String(res.error));
      setBrief(res.data?.result ?? "No brief generated");
      toast.success("Strategic brief generated");
    } catch (err: any) {
      toast.error(err?.message ?? "Brief generation failed");
    } finally {
      setBriefLoading(false);
    }
  };

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

      <div className="flex items-start justify-between mb-1">
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
          #{tagName}
        </h1>
        <div className="flex items-center gap-3 mt-1">
          <button
            onClick={handleFindMore}
            disabled={sonarLoading}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
            title="Find more with Sonar"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {sonarLoading ? "Searching…" : "Find more"}
          </button>
          <button
            onClick={handleGenerateBrief}
            disabled={briefLoading || !articles?.length}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
            title="Generate Strategic Brief"
          >
            <Zap className="h-3.5 w-3.5" />
            {briefLoading ? "Generating…" : "Brief"}
          </button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground mb-8">
        {ac} {ac === 1 ? "article" : "articles"} · {qc} {qc === 1 ? "quote" : "quotes"}
        {tc > 0 && ` · ${tc} ${tc === 1 ? "thread" : "threads"}`}
      </p>

      {/* Strategic Brief Display */}
      {(brief || briefLoading) && (
        <div className="mb-8 border border-accent/20 rounded-xl overflow-hidden bg-accent/5 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex items-center justify-between px-5 py-3 border-b border-accent/10 bg-accent/10">
            <h3 className="text-sm font-semibold text-accent flex items-center gap-2">
              <Zap className="h-4 w-4 fill-accent" /> Strategic Brief
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  if (brief) {
                    await navigator.clipboard.writeText(brief);
                    toast.success("Brief copied to clipboard");
                  }
                }}
                className="p-1 hover:bg-black/5 rounded-md transition-colors"
                title="Copy markdown to clipboard"
              >
                <BookOpen className="h-4 w-4" />
              </button>
              <button
                onClick={() => setShowBrief(!showBrief)}
                className="p-1 hover:bg-black/5 rounded-md transition-colors"
              >
                {showBrief ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              <button
                onClick={() => setBrief(null)}
                className="p-1 hover:bg-black/5 rounded-md transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {showBrief && (
            <div className="p-6">
              {briefLoading ? (
                <div className="space-y-3 animate-pulse">
                  <div className="h-4 bg-accent/10 rounded w-3/4" />
                  <div className="h-4 bg-accent/10 rounded w-full" />
                  <div className="h-4 bg-accent/10 rounded w-5/6" />
                </div>
              ) : (
                <div className="prose prose-sm prose-accent dark:prose-invert max-w-none">
                  {/* Since we don't have react-markdown, we'll use a simple formatter for now */}
                  <div
                    className="whitespace-pre-wrap leading-relaxed text-foreground/90 font-sans"
                    dangerouslySetInnerHTML={{
                      __html: (brief || "")
                        .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mb-4 mt-2">$1</h1>')
                        .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mb-3 mt-6 border-b border-border pb-1">$1</h2>')
                        .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mb-2 mt-4">$1</h3>')
                        .replace(/^\> (.*$)/gim, '<blockquote class="border-l-4 border-accent pl-4 italic my-4">$1</blockquote>')
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sonar results */}
      {sonarResults.length > 0 && (
        <div className="mb-6 border border-border rounded-lg p-4 bg-muted/30">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" /> Suggested by Sonar
            </p>
            <button onClick={() => setSonarResults([])} className="text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="space-y-3">
            {sonarResults.map((r, i) => (
              <div key={i} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{r.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{r.description}</p>
                  <p className="text-xs text-accent mt-0.5">{r.domain}</p>
                </div>
                <button
                  onClick={() => handleSaveFromSonar(r.url)}
                  className="flex-shrink-0 text-xs bg-primary text-primary-foreground px-2 py-1 rounded hover:opacity-90 transition-opacity"
                >Save</button>
              </div>
            ))}
          </div>
        </div>
      )}

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
