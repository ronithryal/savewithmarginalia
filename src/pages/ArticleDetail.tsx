import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import TagInput from "@/components/TagInput";
import TagSuggestions from "@/components/TagSuggestions";
import ArticleCard from "@/components/ArticleCard";
import AddQuoteForm from "@/components/AddQuoteForm";
import QuotesList from "@/components/QuotesList";

const ArticleDetail = () => {
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

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
