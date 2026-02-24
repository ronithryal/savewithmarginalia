import { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import { Search as SearchIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, subDays, subMonths } from "date-fns";

type TypeFilter = "all" | "articles" | "quotes";
type DateFilter = "any" | "7d" | "30d" | "3m";

interface ArticleResult {
  kind: "article";
  id: string;
  title: string;
  source_domain: string;
  content_text: string | null;
  created_at: string;
  tags: string[];
}

interface QuoteResult {
  kind: "quote";
  id: string;
  text: string;
  article_id: string;
  article_title: string;
  created_at: string;
  tags: string[];
}

type SearchResult = ArticleResult | QuoteResult;

function getDateThreshold(df: DateFilter): string | null {
  if (df === "any") return null;
  const now = new Date();
  if (df === "7d") return subDays(now, 7).toISOString();
  if (df === "30d") return subDays(now, 30).toISOString();
  return subMonths(now, 3).toISOString();
}

function highlightMatch(text: string, query: string, maxLen: number) {
  if (!query) return text.slice(0, maxLen);
  const lower = text.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  let start = 0;
  let end = maxLen;
  if (idx > -1) {
    start = Math.max(0, idx - 40);
    end = Math.min(text.length, start + maxLen);
  }
  const slice = (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
  if (!query) return slice;
  const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = slice.split(re);
  return parts.map((p, i) =>
    re.test(p) ? <strong key={i} className="text-foreground font-semibold">{p}</strong> : p
  );
}

const Search = () => {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [dateFilter, setDateFilter] = useState<DateFilter>("any");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [userTags, setUserTags] = useState<{ id: string; name: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load user tags
  useEffect(() => {
    if (!user) return;
    supabase.from("tags").select("id, name").eq("user_id", user.id).order("name").then(({ data }) => {
      if (data) setUserTags(data);
    });
  }, [user]);

  // Auto-focus
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Debounced search
  useEffect(() => {
    const isActive = query.trim() !== "" || selectedTags.length > 0 || dateFilter !== "any";
    if (!isActive) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    const timer = setTimeout(() => {
      runSearch();
    }, 300);
    return () => clearTimeout(timer);
  }, [query, typeFilter, selectedTags, dateFilter]);

  const runSearch = async () => {
    if (!user) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setHasSearched(true);

    try {
      const dateThreshold = getDateThreshold(dateFilter);
      const q = query.trim();
      const promises: Promise<SearchResult[]>[] = [];

      // TODO: replace with full-text search index (tsvector) for larger libraries

      if (typeFilter === "all" || typeFilter === "articles") {
        promises.push(searchArticles(user.id, q, selectedTags, dateThreshold));
      }
      if (typeFilter === "all" || typeFilter === "quotes") {
        promises.push(searchQuotes(user.id, q, selectedTags, dateThreshold));
      }

      const arrays = await Promise.all(promises);
      if (controller.signal.aborted) return;
      const merged = arrays.flat().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setResults(merged);
    } catch {
      if (!controller.signal.aborted) setResults([]);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  const searchArticles = async (
    userId: string, q: string, tagIds: string[], dateThreshold: string | null
  ): Promise<ArticleResult[]> => {
    let query$ = supabase
      .from("articles")
      .select("id, title, source_domain, content_text, created_at")
      .eq("user_id", userId);

    if (q) {
      query$ = query$.or(`title.ilike.%${q}%,content_text.ilike.%${q}%,source_domain.ilike.%${q}%`);
    }
    if (dateThreshold) {
      query$ = query$.gte("created_at", dateThreshold);
    }

    const { data: articles } = await query$.order("created_at", { ascending: false }).limit(100);
    if (!articles) return [];

    // Fetch tags for these articles
    const articleIds = articles.map(a => a.id);
    let articleTagMap: Record<string, string[]> = {};
    if (articleIds.length > 0) {
      const { data: atRows } = await supabase
        .from("article_tags")
        .select("article_id, tag_id")
        .in("article_id", articleIds);
      const { data: allTags } = await supabase.from("tags").select("id, name").eq("user_id", userId);
      const tagNameMap = Object.fromEntries((allTags || []).map(t => [t.id, t.name]));
      for (const row of atRows || []) {
        if (!articleTagMap[row.article_id]) articleTagMap[row.article_id] = [];
        articleTagMap[row.article_id].push(tagNameMap[row.tag_id] || row.tag_id);
      }

      // Filter by selected tags
      if (tagIds.length > 0) {
        const articleIdsWithTag = new Set(
          (atRows || []).filter(r => tagIds.includes(r.tag_id)).map(r => r.article_id)
        );
        return articles
          .filter(a => articleIdsWithTag.has(a.id))
          .map(a => ({ kind: "article" as const, ...a, tags: articleTagMap[a.id] || [] }));
      }
    }

    return articles.map(a => ({ kind: "article" as const, ...a, tags: articleTagMap[a.id] || [] }));
  };

  const searchQuotes = async (
    userId: string, q: string, tagIds: string[], dateThreshold: string | null
  ): Promise<QuoteResult[]> => {
    let query$ = supabase
      .from("quotes")
      .select("id, text, article_id, created_at")
      .eq("user_id", userId);

    if (q) {
      query$ = query$.ilike("text", `%${q}%`);
    }
    if (dateThreshold) {
      query$ = query$.gte("created_at", dateThreshold);
    }

    const { data: quotes } = await query$.order("created_at", { ascending: false }).limit(100);
    if (!quotes) return [];

    // Get article titles
    const artIds = [...new Set(quotes.map(q => q.article_id))];
    let artTitleMap: Record<string, string> = {};
    if (artIds.length > 0) {
      const { data: arts } = await supabase.from("articles").select("id, title").in("id", artIds);
      artTitleMap = Object.fromEntries((arts || []).map(a => [a.id, a.title]));
    }

    // Fetch tags
    const quoteIds = quotes.map(q => q.id);
    let quoteTagMap: Record<string, string[]> = {};
    if (quoteIds.length > 0) {
      const { data: qtRows } = await supabase
        .from("quote_tags")
        .select("quote_id, tag_id")
        .in("quote_id", quoteIds);
      const { data: allTags } = await supabase.from("tags").select("id, name").eq("user_id", userId);
      const tagNameMap = Object.fromEntries((allTags || []).map(t => [t.id, t.name]));
      for (const row of qtRows || []) {
        if (!quoteTagMap[row.quote_id]) quoteTagMap[row.quote_id] = [];
        quoteTagMap[row.quote_id].push(tagNameMap[row.tag_id] || row.tag_id);
      }

      if (tagIds.length > 0) {
        const quoteIdsWithTag = new Set(
          (qtRows || []).filter(r => tagIds.includes(r.tag_id)).map(r => r.quote_id)
        );
        return quotes
          .filter(q => quoteIdsWithTag.has(q.id))
          .map(q => ({
            kind: "quote" as const, ...q,
            article_title: artTitleMap[q.article_id] || "Untitled",
            tags: quoteTagMap[q.id] || [],
          }));
      }
    }

    return quotes.map(q => ({
      kind: "quote" as const, ...q,
      article_title: artTitleMap[q.article_id] || "Untitled",
      tags: quoteTagMap[q.id] || [],
    }));
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev =>
      prev.includes(tagId) ? prev.filter(t => t !== tagId) : [...prev, tagId]
    );
  };

  const typePills: { value: TypeFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "articles", label: "Articles" },
    { value: "quotes", label: "Quotes" },
  ];

  return (
    <main className="mx-auto max-w-4xl px-6 py-10 animate-fade-in">
      <h1 className="font-display text-3xl font-bold tracking-tight text-foreground mb-6">
        Search
      </h1>

      {/* Search input */}
      <div className="relative mb-5">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search articles, quotes, and tags…"
          className="flex w-full rounded-md border border-input bg-background pl-10 pr-4 py-3 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3 mb-8">
        {/* Type pills */}
        <div className="flex items-center gap-1">
          {typePills.map(p => (
            <button
              key={p.value}
              onClick={() => setTypeFilter(p.value)}
              className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
                typeFilter === p.value
                  ? "bg-accent text-accent-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Tags multi-select */}
        {userTags.length > 0 && (
          <div className="relative">
            <Select
              value={selectedTags.length > 0 ? "__tags__" : "none"}
              onValueChange={(val) => {
                if (val === "none") {
                  setSelectedTags([]);
                } else if (val !== "__tags__") {
                  toggleTag(val);
                }
              }}
            >
              <SelectTrigger className="h-8 text-xs min-w-[120px]">
                <SelectValue placeholder="Tags">
                  {selectedTags.length > 0 ? `${selectedTags.length} tag${selectedTags.length > 1 ? "s" : ""}` : "Tags"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">All tags</SelectItem>
                {userTags.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    <span className="flex items-center gap-2">
                      <span className={`inline-block w-2 h-2 rounded-full ${selectedTags.includes(t.id) ? "bg-accent" : "bg-muted"}`} />
                      {t.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Date filter */}
        <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
          <SelectTrigger className="h-8 text-xs min-w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any time</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="3m">Last 3 months</SelectItem>
          </SelectContent>
        </Select>

        {/* Active tag chips */}
        {selectedTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {selectedTags.map(tid => {
              const tag = userTags.find(t => t.id === tid);
              return tag ? (
                <Badge
                  key={tid}
                  variant="secondary"
                  className="bg-accent/15 text-accent text-xs cursor-pointer"
                  onClick={() => toggleTag(tid)}
                >
                  {tag.name} ×
                </Badge>
              ) : null;
            })}
          </div>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="py-4 border-b border-border">
              <Skeleton className="h-4 w-1/4 mb-2" />
              <Skeleton className="h-5 w-3/4 mb-2" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : !hasSearched ? (
        <p className="text-center text-muted-foreground text-sm mt-16">
          Start typing to search your library.
        </p>
      ) : results.length === 0 ? (
        <div className="text-center mt-16">
          <p className="text-muted-foreground text-sm">
            No results for "<span className="text-foreground font-medium">{query}</span>"
          </p>
          <p className="text-muted-foreground text-xs mt-1">
            Try a different keyword or adjust your filters.
          </p>
        </div>
      ) : (
        <div>
          {results.map(r =>
            r.kind === "article" ? (
              <Link
                key={`a-${r.id}`}
                to={`/articles/${r.id}`}
                className="block py-4 border-b border-border hover:bg-secondary/50 transition-colors -mx-2 px-2 rounded-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      {r.source_domain}
                    </span>
                    <h3 className="font-display text-sm font-bold text-foreground mt-0.5 line-clamp-2">
                      {r.title || "Untitled"}
                    </h3>
                    {r.content_text && (
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {highlightMatch(r.content_text, query, 120)}
                      </p>
                    )}
                    {r.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {r.tags.map(t => (
                          <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap mt-1">
                    {format(new Date(r.created_at), "MMM d, yyyy")}
                  </span>
                </div>
              </Link>
            ) : (
              <Link
                key={`q-${r.id}`}
                to={`/articles/${r.article_id}`}
                className="block py-4 border-b border-border hover:bg-secondary/50 transition-colors -mx-2 px-2 rounded-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="w-0.5 flex-shrink-0 self-stretch rounded-full bg-accent" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground leading-relaxed">
                      {highlightMatch(r.text, query, 150)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {r.article_title} →
                    </p>
                    {r.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {r.tags.map(t => (
                          <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap mt-1">
                    {format(new Date(r.created_at), "MMM d, yyyy")}
                  </span>
                </div>
              </Link>
            )
          )}
        </div>
      )}
    </main>
  );
};

export default Search;
