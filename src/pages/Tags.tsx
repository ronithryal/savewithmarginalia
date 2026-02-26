import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { Hash, Trash2, MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";

const Tags = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newTag, setNewTag] = useState("");

  const { data: tags, isLoading } = useQuery({
    queryKey: ["tags"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tags")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: articleTagCounts } = useQuery({
    queryKey: ["article-tag-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("article_tags").select("tag_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      data.forEach((row) => { counts[row.tag_id] = (counts[row.tag_id] || 0) + 1; });
      return counts;
    },
    enabled: !!user,
  });

  const { data: quoteTagCounts } = useQuery({
    queryKey: ["quote-tag-counts"],
    queryFn: async () => {
      // Direct quote tags
      const { data: directTags, error: e1 } = await supabase.from("quote_tags").select("tag_id");
      if (e1) throw e1;

      // Indirect: quotes whose article has a tag
      const { data: quotes, error: e2 } = await supabase.from("quotes").select("id, article_id");
      if (e2) throw e2;
      const { data: articleTags, error: e3 } = await supabase.from("article_tags").select("article_id, tag_id");
      if (e3) throw e3;

      const counts: Record<string, Set<string>> = {};
      // Direct
      directTags.forEach((row) => {
        // We don't have quote_id here easily, just count occurrences
        if (!counts[row.tag_id]) counts[row.tag_id] = new Set();
      });

      // Build article->tags map
      const articleTagMap: Record<string, string[]> = {};
      articleTags.forEach((r) => {
        if (!articleTagMap[r.article_id]) articleTagMap[r.article_id] = [];
        articleTagMap[r.article_id].push(r.tag_id);
      });

      // For each quote, add it to the count of each tag its article has
      quotes.forEach((q) => {
        const tags = articleTagMap[q.article_id] || [];
        tags.forEach((tagId) => {
          if (!counts[tagId]) counts[tagId] = new Set();
          counts[tagId].add(q.id);
        });
      });

      // Also add direct quote_tags quote counts
      // We need quote_id for direct tags too
      const { data: directWithQuote } = await supabase.from("quote_tags").select("tag_id, quote_id");
      (directWithQuote ?? []).forEach((row) => {
        if (!counts[row.tag_id]) counts[row.tag_id] = new Set();
        counts[row.tag_id].add(row.quote_id);
      });

      const result: Record<string, number> = {};
      Object.entries(counts).forEach(([tagId, set]) => { result[tagId] = set.size; });
      return result;
    },
    enabled: !!user,
  });

  const { data: threadTagCounts } = useQuery({
    queryKey: ["thread-tag-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_session_tags" as any)
        .select("tag_id, session_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data as any[]).forEach((row) => {
        counts[row.tag_id] = (counts[row.tag_id] || 0) + 1;
      });
      return counts;
    },
    enabled: !!user,
  });

  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTag.trim() || !user) return;

    const { error } = await supabase.from("tags").insert({
      user_id: user.id,
      name: newTag.trim().toLowerCase(),
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setNewTag("");
      queryClient.invalidateQueries({ queryKey: ["tags"] });
    }
  };

  const handleDeleteTag = async (id: string) => {
    const { error } = await supabase.from("tags").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-16 animate-fade-in">
      <h1 className="font-display text-3xl font-bold tracking-tight text-foreground mb-8">
        Tags
      </h1>

      <form onSubmit={handleAddTag} className="flex gap-3 mb-10">
        <Input
          placeholder="New tag name…"
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          className="h-11 flex-1"
        />
        <Button type="submit" className="h-11 px-6">Add</Button>
      </form>

      {isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}

      {tags && tags.length === 0 && (
        <p className="text-muted-foreground text-sm">No tags yet.</p>
      )}

      {/* TODO: Add AI tag suggestions */}
      <div className="divide-y divide-border">
        {tags?.map((tag) => {
          const ac = articleTagCounts?.[tag.id] || 0;
          const qc = quoteTagCounts?.[tag.id] || 0;
          const tc = threadTagCounts?.[tag.id] || 0;
          return (
            <div key={tag.id} className="flex items-center justify-between py-3 group">
              <Link to={`/tags/${encodeURIComponent(tag.name)}`} className="flex items-center gap-2 hover:underline min-w-0">
                <Hash className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="text-sm font-medium text-foreground">{tag.name}</span>
                <span className="text-xs text-muted-foreground">
                  — {ac} {ac === 1 ? "article" : "articles"} · {qc} {qc === 1 ? "quote" : "quotes"}
                  {tc > 0 && (
                    <> · {tc} {tc === 1 ? "thread" : "threads"}</>
                  )}
                </span>
              </Link>
              <div className="flex items-center gap-2">
                {tc > 0 && (
                  <Link
                    to={`/tags/${encodeURIComponent(tag.name)}?filter=threads`}
                    className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-all"
                    title="View threads"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                  </Link>
                )}
                <button
                  onClick={() => handleDeleteTag(tag.id)}
                  className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Tags;
