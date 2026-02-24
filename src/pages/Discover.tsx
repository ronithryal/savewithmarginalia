import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { RefreshCw, ExternalLink, BookmarkPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import ArticleCard from "@/components/ArticleCard";
import { format } from "date-fns";
import { toast } from "sonner";

interface ExternalItem {
  title: string;
  link: string;
  pubDate: string;
  thumbnail?: string;
  source?: string;
  matchedTag?: string;
  creatorLabel?: string;
  meta?: string;
}

interface RedditItem {
  title: string;
  link: string;
  score: number;
  subreddit: string;
  pubDate: string;
}

// --- Blocked domains for HN ---
const BLOCKED_DOMAINS = new Set([
  "github.com", "gitlab.com", "amazon.com", "goodreads.com",
  "amzn.to", "archive.org", "wikipedia.org", "youtube.com", "reddit.com",
]);

const BLOCKED_TITLE_PREFIXES = [
  "ask hn:", "show hn:", "tell hn:", "launch hn:", "hiring:",
];

function filterHNHit(h: any): boolean {
  if (!h.url) return false;
  if (h.url.toLowerCase().endsWith(".pdf")) return false;
  try {
    const host = new URL(h.url).hostname.replace("www.", "");
    if (BLOCKED_DOMAINS.has(host)) return false;
  } catch { return false; }
  const titleLower = (h.title || "").toLowerCase();
  if (BLOCKED_TITLE_PREFIXES.some(p => titleLower.startsWith(p))) return false;
  if (/\bbook\b/i.test(h.title) || /\brepo\b/i.test(h.title)) return false;
  return true;
}

// --- HN Algolia ---
async function fetchHNForTag(keyword: string): Promise<ExternalItem[]> {
  try {
    const q = encodeURIComponent(keyword);
    const res = await fetch(
      `https://hn.algolia.com/api/v1/search_by_date?tags=story&query=${q}&numericFilters=points>10&hitsPerPage=15`
    );
    if (!res.ok) return [];
    const json = await res.json();
    return (json.hits ?? [])
      .filter(filterHNHit)
      .slice(0, 3)
      .map((h: any) => ({
        title: h.title || "Untitled",
        link: h.url,
        pubDate: h.created_at || "",
        source: "Hacker News",
        meta: `${h.points ?? 0} points`,
        matchedTag: keyword,
      }));
  } catch {
    return [];
  }
}

// --- DEV.to ---
async function fetchDevToForTag(keyword: string): Promise<ExternalItem[]> {
  try {
    const tag = keyword.toLowerCase().replace(/\s+/g, "-");
    const res = await fetch(
      `https://dev.to/api/articles?tag=${encodeURIComponent(tag)}&per_page=5&top=7`
    );
    if (!res.ok) return [];
    const json = await res.json();
    return (json ?? []).map((a: any) => ({
      title: a.title || "Untitled",
      link: a.url,
      pubDate: a.published_at || a.created_at || "",
      thumbnail: a.cover_image || "",
      source: "DEV.to",
      meta: a.user?.name || "",
      matchedTag: keyword,
    }));
  } catch {
    return [];
  }
}

// --- Lobste.rs ---
async function fetchLobstersForTag(keyword: string): Promise<ExternalItem[]> {
  try {
    const tag = keyword.toLowerCase().replace(/\s+/g, "-");
    const res = await fetch(`https://lobste.rs/t/${encodeURIComponent(tag)}.json`);
    if (!res.ok) return [];
    const json = await res.json();
    return (json ?? [])
      .filter((p: any) => {
        if (!p.url) return false;
        try {
          const host = new URL(p.url).hostname.replace("www.", "");
          if (host === "github.com" || host === "gitlab.com") return false;
        } catch { return false; }
        return true;
      })
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 3)
      .map((p: any) => ({
        title: p.title || "Untitled",
        link: p.url,
        pubDate: p.created_at || "",
        source: "Lobsters",
        meta: `${p.score ?? 0} points`,
        matchedTag: keyword,
      }));
  } catch {
    return [];
  }
}

// --- Reddit subreddit mapping ---
const REDDIT_TAG_MAP: Record<string, string[]> = {
  "politics": ["politics", "geopolitics"],
  "history": ["history", "AskHistorians"],
  "ai": ["MachineLearning", "artificial"],
  "ai agents": ["MachineLearning", "artificial"],
  "founders": ["startups", "Entrepreneur"],
  "software-engineering": ["programming", "ExperiencedDevs"],
  "crypto": ["CryptoCurrency", "ethereum"],
  "web3": ["CryptoCurrency", "ethereum"],
};

function getSubredditsForTags(tags: { id: string; name: string }[]): string[] {
  const subs = new Set<string>();
  for (const tag of tags) {
    const key = tag.name.toLowerCase();
    const mapped = REDDIT_TAG_MAP[key];
    if (mapped) {
      mapped.forEach(s => subs.add(s));
    } else {
      subs.add("worldnews");
    }
  }
  return Array.from(subs);
}

function formatScore(score: number): string {
  if (score >= 1000) return `${(score / 1000).toFixed(1).replace(/\.0$/, "")}k points`;
  return `${score} points`;
}

const Discover = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [refreshKey, setRefreshKey] = useState(0);
  const [savingUrl, setSavingUrl] = useState<string | null>(null);

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

  // Get top 3 most-used tags
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
        .slice(0, 3)
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

  // Get all saved article URLs to exclude
  const { data: savedUrls } = useQuery({
    queryKey: ["discover-saved-urls", refreshKey],
    queryFn: async () => {
      const { data } = await supabase.from("articles").select("url");
      return new Set((data ?? []).map((a) => a.url));
    },
    enabled: !!user,
  });

  // Trending: HN + Lobsters + DEV.to per tag
  const { data: trendingItems, isLoading: loadingTrending } = useQuery({
    queryKey: ["discover-trending", topTags, savedUrls, refreshKey],
    queryFn: async () => {
      if (!topTags || topTags.length === 0 || !savedUrls) return [];

      const allItems: ExternalItem[] = [];
      const seenUrls = new Set<string>();

      await Promise.all(
        topTags.map(async (tag) => {
          const [hnItems, lobsterItems, devItems] = await Promise.all([
            fetchHNForTag(tag.name),
            fetchLobstersForTag(tag.name),
            fetchDevToForTag(tag.name),
          ]);

          const merged = [...hnItems, ...lobsterItems, ...devItems]
            .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

          let count = 0;
          for (const item of merged) {
            if (count >= 3) break;
            if (!item.link || seenUrls.has(item.link) || savedUrls.has(item.link)) continue;
            seenUrls.add(item.link);
            allItems.push(item);
            count++;
          }
        })
      );

      return allItems.sort(
        (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
      );
    },
    enabled: !!user && !!topTags && topTags.length > 0 && !!savedUrls,
  });

  // Reddit discussions via edge function
  const { data: redditItems, isLoading: loadingReddit } = useQuery({
    queryKey: ["discover-reddit", topTags, savedUrls, refreshKey],
    queryFn: async () => {
      if (!topTags || topTags.length === 0 || !savedUrls) return [];
      const subreddits = getSubredditsForTags(topTags);

      const { data, error } = await supabase.functions.invoke("fetch-reddit", {
        body: { subreddits },
      });

      if (error || !Array.isArray(data)) return [];

      const items: RedditItem[] = [];
      const seenUrls = new Set<string>();

      for (const post of data) {
        if (!post.url || seenUrls.has(post.url) || savedUrls.has(post.url)) continue;
        seenUrls.add(post.url);
        items.push({
          title: post.title,
          link: post.url,
          score: post.score,
          subreddit: post.subreddit,
          pubDate: new Date(post.created_utc * 1000).toISOString(),
        });
      }

      return items;
    },
    enabled: !!user && !!topTags && topTags.length > 0 && !!savedUrls,
  });

  // Get user feeds
  const { data: userFeeds } = useQuery({
    queryKey: ["user-feeds"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("user_feeds")
        .select("*")
        .eq("user_id", user!.id);
      return data ?? [];
    },
    enabled: !!user,
  });

  // From your favorite creators
  const { data: creatorItems, isLoading: loadingCreators } = useQuery({
    queryKey: ["discover-creators", userFeeds, savedUrls, refreshKey],
    queryFn: async () => {
      if (!userFeeds || userFeeds.length === 0 || !savedUrls) return [];

      const allItems: ExternalItem[] = [];
      const seenUrls = new Set<string>();

      await Promise.all(
        userFeeds.map(async (feed: any) => {
          try {
            const res = await fetch(
              `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.feed_url)}`
            );
            if (!res.ok) return;
            const json = await res.json();
            if (json.status !== "ok" || !json.items) return;
            let count = 0;
            for (const item of json.items) {
              if (count >= 3) break;
              const link = item.link || "";
              if (!link || seenUrls.has(link) || savedUrls.has(link)) continue;
              seenUrls.add(link);
              allItems.push({
                title: item.title || "Untitled",
                link,
                pubDate: item.pubDate || "",
                thumbnail: item.thumbnail || item.enclosure?.link || "",
                source: json.feed?.title || "",
                creatorLabel: feed.label,
              });
              count++;
            }
          } catch {
            // skip failed feeds
          }
        })
      );

      return allItems
        .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
        .slice(0, 8);
    },
    enabled: !!user && !!userFeeds && userFeeds.length > 0 && !!savedUrls,
  });

  // Unread articles
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
    queryClient.invalidateQueries({ queryKey: ["discover-saved-urls"] });
    queryClient.invalidateQueries({ queryKey: ["discover-trending"] });
    queryClient.invalidateQueries({ queryKey: ["discover-reddit"] });
    queryClient.invalidateQueries({ queryKey: ["discover-creators"] });
    queryClient.invalidateQueries({ queryKey: ["discover-unread"] });
  };

  const handleSaveExternal = async (item: { link: string; title: string; thumbnail?: string }) => {
    if (!user || savingUrl) return;
    setSavingUrl(item.link);
    try {
      const domain = (() => {
        try { return new URL(item.link).hostname.replace("www.", ""); }
        catch { return ""; }
      })();

      const { data: existing } = await supabase
        .from("articles")
        .select("id")
        .eq("user_id", user.id)
        .eq("url", item.link)
        .maybeSingle();

      if (existing) {
        toast.info("Already in your library.");
        setSavingUrl(null);
        return;
      }

      const { data, error } = await supabase.from("articles").insert({
        user_id: user.id,
        url: item.link,
        title: item.title || "Untitled article",
        source_domain: domain,
        preview_image_url: item.thumbnail || null,
        content_text: "",
      }).select().single();

      if (error) throw error;

      supabase.functions.invoke("parse-article", {
        body: { article_id: data.id },
      }).catch(console.error);

      toast.success("Saved to library!");
      queryClient.invalidateQueries({ queryKey: ["discover-saved-urls"] });
    } catch {
      toast.error("Failed to save.");
    }
    setSavingUrl(null);
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
          {/* Section 1: Trending in your interests (HN + Lobsters + DEV.to) */}
          <section className="mb-12">
            <h2 className="font-display text-xl font-semibold text-foreground mb-4">
              Trending in your interests
            </h2>
            {loadingTrending ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="rounded-lg border border-border overflow-hidden">
                    <Skeleton className="w-full h-32" />
                    <div className="p-4 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : trendingItems && trendingItems.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {trendingItems.map((item) => (
                  <ExternalCard
                    key={item.link}
                    item={item}
                    badge={item.matchedTag}
                    onSave={() => handleSaveExternal(item)}
                    saving={savingUrl === item.link}
                  />
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm py-6">
                Nothing new right now — check back later.
              </p>
            )}
          </section>

          {/* Section 2: Discussions (Reddit) */}
          <section className="mb-12">
            <h2 className="font-display text-xl font-semibold text-foreground mb-4">
              Discussions
            </h2>
            {loadingReddit ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="rounded-lg border border-border overflow-hidden">
                    <div className="p-4 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : redditItems && redditItems.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {redditItems.map((item) => (
                  <RedditCard
                    key={item.link}
                    item={item}
                    onSave={() => handleSaveExternal(item)}
                    saving={savingUrl === item.link}
                  />
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm py-6">
                Nothing new right now — check back later.
              </p>
            )}
          </section>

          {/* Section 3: From your favorite creators */}
          {userFeeds && userFeeds.length > 0 && (
            <section className="mb-12">
              <h2 className="font-display text-xl font-semibold text-foreground mb-4">
                From your favorite creators
              </h2>
              {loadingCreators ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="rounded-lg border border-border overflow-hidden">
                      <Skeleton className="w-full h-32" />
                      <div className="p-4 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : creatorItems && creatorItems.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {creatorItems.map((item) => (
                    <ExternalCard
                      key={item.link}
                      item={item}
                      badge={item.creatorLabel}
                      onSave={() => handleSaveExternal(item)}
                      saving={savingUrl === item.link}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm py-6">
                  Nothing new right now — check back later.
                </p>
              )}
            </section>
          )}

          {/* Section 4: From your reading list */}
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

          {(!trendingItems || trendingItems.length === 0) &&
            (!redditItems || redditItems.length === 0) &&
            (!userFeeds || userFeeds.length === 0) &&
            (!unreadArticles || unreadArticles.length === 0) &&
            !loadingTrending &&
            !loadingReddit &&
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

// --- ExternalCard (for HN / Lobsters / DEV.to / Creator feeds) ---
function ExternalCard({
  item,
  badge,
  onSave,
  saving,
}: {
  item: ExternalItem;
  badge?: string;
  onSave: () => void;
  saving: boolean;
}) {
  const formattedDate = (() => {
    try { return format(new Date(item.pubDate), "MMM d, yyyy"); }
    catch { return ""; }
  })();

  return (
    <div className="group bg-[hsl(var(--article-card))] border border-[hsl(var(--article-card-border))] rounded-lg overflow-hidden flex flex-col">
      {item.thumbnail && (
        <div className="w-full h-32 overflow-hidden bg-muted">
          <img
            src={item.thumbnail}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      )}

      <div className="p-4 flex-1 flex flex-col">
        {badge && (
          <Badge variant="secondary" className="text-[10px] font-medium w-fit mb-2">
            {badge}
          </Badge>
        )}

        <h3 className="font-display text-sm font-bold text-foreground leading-snug line-clamp-2 mb-2">
          {item.title || "Untitled"}
        </h3>

        <div className="mt-auto flex items-center gap-1.5 text-muted-foreground min-w-0">
          {item.meta && (
            <span className="text-[11px]">{item.meta}</span>
          )}
          {item.meta && formattedDate && (
            <span className="text-[11px]">·</span>
          )}
          {formattedDate && (
            <span className="text-[11px]">{formattedDate}</span>
          )}
        </div>

        <div className="flex items-center gap-2 mt-3">
          <Button
            variant="outline"
            size="sm"
            className="text-xs gap-1.5 h-7"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSave();
            }}
            disabled={saving}
          >
            <BookmarkPlus className="h-3 w-3" />
            {saving ? "Saving…" : "Save"}
          </Button>
          <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-accent hover:underline flex items-center gap-1"
          >
            Open <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}

// --- RedditCard ---
function RedditCard({
  item,
  onSave,
  saving,
}: {
  item: RedditItem;
  onSave: () => void;
  saving: boolean;
}) {
  const formattedDate = (() => {
    try { return format(new Date(item.pubDate), "MMM d, yyyy"); }
    catch { return ""; }
  })();

  return (
    <div className="group bg-[hsl(var(--article-card))] border border-[hsl(var(--article-card-border))] rounded-lg overflow-hidden flex flex-col">
      <div className="p-4 flex-1 flex flex-col">
        <Badge variant="outline" className="text-[10px] font-medium w-fit mb-2 text-muted-foreground">
          r/{item.subreddit}
        </Badge>

        <h3 className="font-display text-sm font-bold text-foreground leading-snug line-clamp-2 mb-2">
          {item.title || "Untitled"}
        </h3>

        <div className="mt-auto flex items-center gap-1.5 text-muted-foreground min-w-0">
          <span className="text-[11px]">{formatScore(item.score)}</span>
          {formattedDate && (
            <>
              <span className="text-[11px]">·</span>
              <span className="text-[11px]">{formattedDate}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 mt-3">
          <Button
            variant="outline"
            size="sm"
            className="text-xs gap-1.5 h-7"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSave();
            }}
            disabled={saving}
          >
            <BookmarkPlus className="h-3 w-3" />
            {saving ? "Saving…" : "Save"}
          </Button>
          <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-accent hover:underline flex items-center gap-1"
          >
            Open <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}

export default Discover;
