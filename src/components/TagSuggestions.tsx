import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";

interface TagSuggestionsProps {
  text: string;
  onAttachTag: (tagId: string) => void;
  attachedTagIds: string[];
}

const TagSuggestions = ({ text, onAttachTag, attachedTagIds }: TagSuggestionsProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dismissed, setDismissed] = useState<string[]>([]);

  const { data: allTags } = useQuery({
    queryKey: ["tags"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tags").select("*").order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: prefs } = useQuery({
    queryKey: ["user-preferences", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_preferences" as any)
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data as unknown as { ai_tags_enabled: boolean } | null;
    },
    enabled: !!user,
  });

  const aiEnabled = prefs === undefined || prefs === null || (prefs as any)?.ai_tags_enabled !== false;

  const { data: suggestions } = useQuery({
    queryKey: ["tag-suggestions", text],
    queryFn: async () => {
      const existingTags = allTags?.map((t) => t.name) || [];
      const { data, error } = await supabase.functions.invoke("suggest-tags", {
        body: { text, existing_user_tags: existingTags },
      });
      if (error) return [];
      return (data?.suggestions as string[]) || [];
    },
    enabled: !!user && !!text && aiEnabled && !!allTags,
    staleTime: Infinity,
  });

  if (!suggestions || suggestions.length === 0 || !aiEnabled) return null;

  const visibleSuggestions = suggestions.filter(
    (s) => !dismissed.includes(s) && !attachedTagIds.some((id) => allTags?.find((t) => t.id === id)?.name === s)
  );

  if (visibleSuggestions.length === 0) return null;

  const handleAdd = async (tagName: string) => {
    if (!user) return;
    // Find existing tag or create
    const existing = allTags?.find((t) => t.name === tagName);
    if (existing) {
      onAttachTag(existing.id);
    } else {
      const { data, error } = await supabase
        .from("tags")
        .insert({ user_id: user.id, name: tagName })
        .select()
        .single();
      if (!error && data) {
        queryClient.invalidateQueries({ queryKey: ["tags"] });
        onAttachTag(data.id);
      }
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-2">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        Suggested:
      </span>
      {visibleSuggestions.map((tag) => (
        <button
          key={tag}
          className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium transition-colors"
          style={{
            backgroundColor: "hsl(213 100% 97%)",
            border: "1px solid hsl(8 78% 57% / 0.3)",
            color: "hsl(0 0% 45%)",
          }}
          onClick={() => handleAdd(tag)}
        >
          {tag}
          <span
            role="button"
            onClick={(e) => {
              e.stopPropagation();
              setDismissed((d) => [...d, tag]);
            }}
            className="hover:text-destructive ml-0.5"
          >
            <X className="h-2.5 w-2.5" />
          </span>
        </button>
      ))}
    </div>
  );
};

export default TagSuggestions;
