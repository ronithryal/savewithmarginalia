import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const Index = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);

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

      supabase.functions.invoke("parse-article", {
        body: { article_id: data.id },
      }).then(() => {
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
    </div>
  );
};

export default Index;
