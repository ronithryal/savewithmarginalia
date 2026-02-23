import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import TagInput from "@/components/TagInput";

const ArticleDetail = () => {
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [quoteText, setQuoteText] = useState("");
  const [savingQuote, setSavingQuote] = useState(false);
  const [lastSavedQuoteId, setLastSavedQuoteId] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const handleRetryParse = async () => {
    if (!id) return;
    setRetrying(true);
    try {
      const { error } = await supabase.functions.invoke("parse-article", {
        body: { article_id: id },
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["article", id] });
      toast({ title: "Content refreshed" });
    } catch (err: any) {
      toast({ title: "Parse failed", description: err.message, variant: "destructive" });
    }
    setRetrying(false);
  };

  const { data: article } = useQuery({
    queryKey: ["article", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("articles")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!id,
  });

  const { data: quotes } = useQuery({
    queryKey: ["article-quotes", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("*")
        .eq("article_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!id,
  });

  // Article tags
  const { data: articleTagIds } = useQuery({
    queryKey: ["article-tags", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("article_tags")
        .select("tag_id")
        .eq("article_id", id!);
      if (error) throw error;
      return data.map((r) => r.tag_id);
    },
    enabled: !!user && !!id,
  });

  // Quote tags for last saved quote
  const { data: quoteTagIds } = useQuery({
    queryKey: ["quote-tags", lastSavedQuoteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quote_tags")
        .select("tag_id")
        .eq("quote_id", lastSavedQuoteId!);
      if (error) throw error;
      return data.map((r) => r.tag_id);
    },
    enabled: !!lastSavedQuoteId,
  });

  const handleAttachArticleTag = async (tagId: string) => {
    if (!id) return;
    await supabase.from("article_tags").insert({ article_id: id, tag_id: tagId });
    queryClient.invalidateQueries({ queryKey: ["article-tags", id] });
  };

  const handleDetachArticleTag = async (tagId: string) => {
    if (!id) return;
    await supabase.from("article_tags").delete().eq("article_id", id).eq("tag_id", tagId);
    queryClient.invalidateQueries({ queryKey: ["article-tags", id] });
  };

  const handleAttachQuoteTag = async (tagId: string) => {
    if (!lastSavedQuoteId) return;
    await supabase.from("quote_tags").insert({ quote_id: lastSavedQuoteId, tag_id: tagId });
    queryClient.invalidateQueries({ queryKey: ["quote-tags", lastSavedQuoteId] });
  };

  const handleDetachQuoteTag = async (tagId: string) => {
    if (!lastSavedQuoteId) return;
    await supabase.from("quote_tags").delete().eq("quote_id", lastSavedQuoteId).eq("tag_id", tagId);
    queryClient.invalidateQueries({ queryKey: ["quote-tags", lastSavedQuoteId] });
  };

  const handleSaveQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quoteText.trim() || !user || !id) return;
    setSavingQuote(true);

    try {
      // TODO: Later populate start_offset and end_offset from text selection
      // TODO: Support image-based quotes (is_image = true, image_url)
      const { data, error } = await supabase.from("quotes").insert({
        user_id: user.id,
        article_id: id,
        text: quoteText.trim(),
        start_offset: null,
        end_offset: null,
        is_image: false,
        image_url: null,
      }).select().single();
      if (error) throw error;
      setQuoteText("");
      setLastSavedQuoteId(data.id);
      queryClient.invalidateQueries({ queryKey: ["article-quotes", id] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }

    setSavingQuote(false);
  };

  if (!article) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[700px] px-6 py-16 animate-fade-in">
      <Link to="/articles" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-8">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to articles
      </Link>

      <header className="mb-4">
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground mb-2">
          {article.title || "Untitled article"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {article.source_domain} · {formatDistanceToNow(new Date(article.created_at), { addSuffix: true })}
        </p>
      </header>

      {/* Tags row */}
      <div className="mb-10">
        <TagInput
          attachedTagIds={articleTagIds ?? []}
          onAttach={handleAttachArticleTag}
          onDetach={handleDetachArticleTag}
        />
      </div>

      {/* Reader section */}
      {/* TODO: Add highlight-to-quote interactions when the user selects text */}
      <section className="mb-12">
        {article.content_text ? (
          <div className="prose prose-sm max-w-none text-foreground leading-relaxed whitespace-pre-wrap">
            {article.content_text}
          </div>
        ) : (
          <div className="border border-border rounded-md p-6 space-y-3">
            <p className="text-sm text-muted-foreground">
              We couldn't load content for this article. You can still add quotes manually.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetryParse}
              disabled={retrying}
            >
              {retrying ? "Retrying…" : "Retry"}
            </Button>
          </div>
        )}
      </section>

      {/* Add Quote form */}
      <section className="border border-border rounded-md p-6 mb-10">
        <h3 className="font-display text-base font-semibold text-foreground mb-4">Add Quote</h3>
        <form onSubmit={handleSaveQuote} className="space-y-4">
          <div>
            <label htmlFor="quote-text" className="text-sm text-muted-foreground mb-1.5 block">
              Quote text
            </label>
            <Textarea
              id="quote-text"
              placeholder="Paste or type a quote…"
              value={quoteText}
              onChange={(e) => setQuoteText(e.target.value)}
              required
              className="min-h-[100px]"
            />
          </div>
          <Button type="submit" disabled={savingQuote || !quoteText.trim()} className="px-6">
            {savingQuote ? "…" : "Save quote"}
          </Button>
        </form>

        {/* Tag the last saved quote */}
        {lastSavedQuoteId && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2">Tag this quote:</p>
            <TagInput
              attachedTagIds={quoteTagIds ?? []}
              onAttach={handleAttachQuoteTag}
              onDetach={handleDetachQuoteTag}
            />
            <button
              onClick={() => setLastSavedQuoteId(null)}
              className="mt-2 text-xs text-muted-foreground hover:text-foreground"
            >
              Done
            </button>
          </div>
        )}
      </section>

      {/* Quotes list */}
      <section>
        <h2 className="font-display text-xl font-semibold text-foreground mb-4">
          Quotes ({quotes?.length || 0})
        </h2>
        {quotes && quotes.length === 0 && (
          <p className="text-sm text-muted-foreground">No quotes yet for this article.</p>
        )}
        <div className="space-y-4">
          {quotes?.map((quote) => (
            <blockquote key={quote.id} className="border-l-2 border-accent pl-4 py-2">
              <p className="text-foreground text-sm leading-relaxed line-clamp-6">{quote.text}</p>
              <span className="text-xs text-muted-foreground mt-1.5 block">
                {formatDistanceToNow(new Date(quote.created_at), { addSuffix: true })}
              </span>
            </blockquote>
          ))}
        </div>
      </section>
    </div>
  );
};

export default ArticleDetail;
