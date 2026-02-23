import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";

const Index = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: recentQuotes } = useQuery({
    queryKey: ["recent-quotes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("*, articles(title, source_domain)")
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
      const domain = new URL(url).hostname.replace("www.", "");
      // TODO: Fetch and parse article content from URL (title, text, preview image)
      const { data, error } = await supabase.from("articles").insert({
        user_id: user.id,
        url: url.trim(),
        title: "Untitled article",
        source_domain: domain,
        preview_image_url: null,
        content_text: "",
      }).select().single();
      if (error) throw error;
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

      {recentQuotes && recentQuotes.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-xl font-semibold text-foreground">Recent quotes</h2>
            <Link to="/quotes" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-4">
            {recentQuotes.map((quote) => (
              <blockquote
                key={quote.id}
                className="border-l-2 border-accent pl-4 py-1"
              >
                <p className="text-foreground text-sm leading-relaxed">
                  {quote.text}
                </p>
                <cite className="text-xs text-muted-foreground not-italic mt-1 block">
                  {(quote as any).articles?.title || "Unknown article"}
                </cite>
              </blockquote>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default Index;
