import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import TagInput from "@/components/TagInput";
import { useQuery } from "@tanstack/react-query";

interface AddQuoteFormProps {
  articleId: string;
  userId?: string;
}

const AddQuoteForm = ({ articleId, userId }: AddQuoteFormProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [quoteText, setQuoteText] = useState("");
  const [savingQuote, setSavingQuote] = useState(false);
  const [lastSavedQuoteId, setLastSavedQuoteId] = useState<string | null>(null);

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
    if (!quoteText.trim() || !userId || !articleId) return;
    setSavingQuote(true);

    try {
      const { data, error } = await supabase.from("quotes").insert({
        user_id: userId,
        article_id: articleId,
        text: quoteText.trim(),
        start_offset: null,
        end_offset: null,
        is_image: false,
        image_url: null,
      }).select().single();
      if (error) throw error;
      setQuoteText("");
      setLastSavedQuoteId(data.id);
      queryClient.invalidateQueries({ queryKey: ["article-quotes", articleId] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }

    setSavingQuote(false);
  };

  return (
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
  );
};

export default AddQuoteForm;
