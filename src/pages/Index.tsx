import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const NarrativeSection = ({ user }: { user: any }) => {
  const { data: stats } = useQuery({
    queryKey: ["home-stats"],
    queryFn: async () => {
      const [articles, quotes, tags] = await Promise.all([
        supabase.from("articles").select("id", { count: "exact", head: true }),
        supabase.from("quotes").select("id", { count: "exact", head: true }),
        supabase.from("tags").select("id", { count: "exact", head: true }),
      ]);
      return {
        articles: articles.count ?? 0,
        quotes: quotes.count ?? 0,
        tags: tags.count ?? 0,
      };
    },
    enabled: !!user,
  });

  return (
    <section className="py-16 animate-fade-in">
      <p className="text-xs tracking-widest uppercase text-muted-foreground mb-4">
        What is Marginalia
      </p>

      <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-foreground leading-tight mb-8">
        Your reading life, organized and alive.
      </h2>

      <div className="max-w-[600px] space-y-5 mb-16">
        <p className="text-base text-muted-foreground leading-relaxed">
          Most reading tools are graveyards. You save something, it disappears into a list
          you never return to. Marginalia is different — every article and quote you save
          becomes part of a living library that surfaces connections, sparks questions,
          and gets smarter about what you care about the more you use it.
        </p>
        <p className="text-base text-muted-foreground leading-relaxed">
          Save anything. Highlight what matters. Ask questions across everything
          you've ever read. Discover what to read next based on your actual taste —
          not an algorithm's guess.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-8">
        <div className="border-t border-border pt-4">
          <p className="font-display text-3xl font-bold text-foreground">
            {stats ? stats.articles + stats.quotes : "—"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">saved to your library</p>
        </div>
        <div className="border-t border-border pt-4">
          <p className="font-display text-3xl font-bold text-foreground">
            {stats ? stats.tags : "—"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">topics you're tracking</p>
        </div>
        <div className="border-t border-border pt-4">
          <p className="font-display text-3xl font-bold text-foreground">Chat</p>
          <p className="text-sm text-muted-foreground mt-1">your AI thinking partner</p>
        </div>
      </div>
    </section>
  );
};

const Index = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [url, setUrl] = useState(searchParams.get("url") || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const prefill = searchParams.get("url");
    if (prefill) {
      setUrl(prefill);
      setSearchParams({}, { replace: true });
    }
  }, []);

  const { data: recentQuotes } = useQuery({
    queryKey: ["recent-quotes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("*, articles(id, title, source_domain)")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const handleSaveArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !user) return;
    setSaving(true);

    try {
      const trimmedUrl = url.trim();

      // Check for duplicate
      const { data: existing } = await supabase
        .from("articles")
        .select("id")
        .eq("user_id", user.id)
        .eq("url", trimmedUrl)
        .maybeSingle();

      if (existing) {
        setUrl("");
        setSaving(false);
        toast({ title: "You already saved this — here it is." });
        navigate(`/articles/${existing.id}`);
        return;
      }

      const domain = new URL(trimmedUrl).hostname.replace("www.", "");
      const { data, error } = await supabase.from("articles").insert({
        user_id: user.id,
        url: trimmedUrl,
        title: "Untitled article",
        source_domain: domain,
        preview_image_url: null,
        content_text: "",
      }).select().single();
      if (error) throw error;

      const parsePromise = supabase.functions.invoke("parse-article", {
        body: { article_id: data.id },
      });
      const metaPromise = supabase.functions.invoke("fetch-metadata", {
        body: { article_id: data.id },
      });
      Promise.allSettled([parsePromise, metaPromise]).then(() => {
        queryClient.invalidateQueries({ queryKey: ["article", data.id] });
        queryClient.invalidateQueries({ queryKey: ["articles"] });
      }).catch(console.error);

      setUrl("");
      navigate(`/articles/${data.id}`);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }

    setSaving(false);
  };

  if (!user) return null;

  return (
    <div className="mx-auto max-w-2xl px-6 py-16 animate-fade-in">
      <h1 className="font-display text-3xl font-bold tracking-tight text-foreground mb-8">
        Save an article
      </h1>

      <form onSubmit={handleSaveArticle} className="flex gap-3 mb-16">
        <Input
          type="url"
          placeholder="Paste a link…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          className="h-11 flex-1"
        />
        <Button type="submit" disabled={saving} className="h-11 px-6">
          {saving ? "..." : "Save"}
        </Button>
      </form>

      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-xl font-semibold text-foreground">Recent quotes</h2>
          <Link to="/quotes" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {recentQuotes && recentQuotes.length === 0 && (
          <p className="text-muted-foreground text-sm">
            No quotes saved yet. Save an article and start highlighting.
          </p>
        )}

        {recentQuotes && recentQuotes.length > 0 && (
          <div className="space-y-4">
            {recentQuotes.map((quote) => {
              const article = (quote as any).articles;
              return (
                <blockquote key={quote.id} className="border-l-2 border-accent pl-4 py-1">
                  <p className="text-foreground text-sm leading-relaxed">
                    {quote.text.length > 150 ? quote.text.slice(0, 150) + "…" : quote.text}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Link
                      to={`/articles/${article?.id}`}
                      className="text-xs text-muted-foreground hover:text-accent transition-colors"
                    >
                      {article?.title || "Unknown article"}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      · {formatDistanceToNow(new Date(quote.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </blockquote>
              );
            })}
          </div>
        )}
      </section>

      <NarrativeSection user={user} />
    </div>
  );
};

export default Index;
