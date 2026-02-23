import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import TagInput from "@/components/TagInput";
import ArticleContent from "@/components/ArticleContent";
import AddQuoteForm from "@/components/AddQuoteForm";
import QuotesList from "@/components/QuotesList";

const ArticleDetail = () => {
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
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

      <div className="mb-6">
        <TagInput
          attachedTagIds={articleTagIds ?? []}
          onAttach={handleAttachArticleTag}
          onDetach={handleDetachArticleTag}
        />
      </div>

      {/* Divider between meta and content */}
      <div className="border-t border-border mb-6" />

      {/* Reader section */}
      {/* TODO: Add highlight-to-quote interactions when the user selects text */}
      <ArticleContent
        contentText={article.content_text}
        retrying={retrying}
        onRetry={handleRetryParse}
      />

      <AddQuoteForm articleId={id!} userId={user?.id} />

      <QuotesList quotes={quotes} articleId={id!} />
    </div>
  );
};

export default ArticleDetail;
