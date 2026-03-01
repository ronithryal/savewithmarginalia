import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Zap, X, ChevronUp, ChevronDown, BookOpen } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import TagInput from "@/components/TagInput";
import TagSuggestions from "@/components/TagSuggestions";
import ArticleCard from "@/components/ArticleCard";
import AddQuoteForm from "@/components/AddQuoteForm";
import QuotesList from "@/components/QuotesList";
import ImageUpload from "@/components/ImageUpload";

const ArticleDetail = () => {
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [brief, setBrief] = useState<string | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [showBrief, setShowBrief] = useState(true);

  const { data: article } = useQuery({
    queryKey: ["article", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("articles")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;

      // Mark as opened
      supabase
        .from("articles")
        .update({ last_opened_at: new Date().toISOString() })
        .eq("id", id!)
        .then();

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

  const handleTitleEdit = useCallback(async (id: string, newTitle: string) => {
    await supabase.from("articles").update({ title: newTitle }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["article", id] });
    queryClient.invalidateQueries({ queryKey: ["articles"] });
  }, [queryClient]);

  const handleGenerateBrief = async () => {
    if (!id || !article) return;
    setBriefLoading(true);
    setBrief(null);
    setShowBrief(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("reasoning", {
        body: {
          query: article.title,
          articleIds: [article.id]
        },
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

  const handleArticleImageChange = useCallback(async (url: string | null) => {
    if (!id) return;
    await supabase.from("articles").update({ preview_image_url: url }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["article", id] });
    queryClient.invalidateQueries({ queryKey: ["articles"] });
  }, [id, queryClient]);

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

      <ArticleCard article={article} fullWidth onTitleEdit={handleTitleEdit} />

      <div className="mt-4 flex justify-end">
        <button
          onClick={handleGenerateBrief}
          disabled={briefLoading}
          className="flex items-center gap-1.5 text-xs text-accent hover:text-accent/80 transition-colors font-medium"
          title="Generate Strategic Brief"
        >
          <Zap className="h-3.5 w-3.5" />
          {briefLoading ? "Generating…" : "Create Brief"}
        </button>
      </div>

      {/* Strategic Brief Display */}
      {(brief || briefLoading) && (
        <div className="mt-8 border border-accent/20 rounded-xl overflow-hidden bg-accent/5 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center justify-between px-5 py-3 border-b border-accent/10 bg-accent/10">
            <h3 className="text-sm font-semibold text-accent flex items-center gap-2">
              <Zap className="h-4 w-4 fill-accent" /> Executive Summary
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

      {user && (
        <div className="mt-4">
          <p className="text-xs text-muted-foreground mb-1.5">Cover image</p>
          <ImageUpload
            currentUrl={article.preview_image_url}
            onImageChange={handleArticleImageChange}
            userId={user.id}
            folder="articles"
          />
        </div>
      )}

      <div className="mt-6 mb-6">
        <TagInput
          attachedTagIds={articleTagIds ?? []}
          onAttach={handleAttachArticleTag}
          onDetach={handleDetachArticleTag}
        />
        <TagSuggestions
          text={[article.title, article.content_text].filter(Boolean).join(" — ")}
          onAttachTag={handleAttachArticleTag}
          attachedTagIds={articleTagIds ?? []}
        />
      </div>

      <div className="border-t border-border mb-6" />

      {/* TODO: browser extension and mobile share sheet will populate quote text at save time */}
      <AddQuoteForm articleId={id!} userId={user?.id} />

      <QuotesList quotes={quotes} articleId={id!} />
    </div>
  );
};

export default ArticleDetail;
