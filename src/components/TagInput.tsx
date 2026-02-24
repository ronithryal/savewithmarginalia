import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { Link } from "react-router-dom";

interface TagInputProps {
  attachedTagIds: string[];
  onAttach: (tagId: string) => void;
  onDetach: (tagId: string) => void;
}

const TagInput = ({ attachedTagIds, onAttach, onDetach }: TagInputProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: allTags } = useQuery({
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

  const attachedTags = allTags?.filter((t) => attachedTagIds.includes(t.id)) ?? [];
  const suggestions = allTags?.filter(
    (t) => !attachedTagIds.includes(t.id) && t.name.includes(input.toLowerCase())
  ) ?? [];
  const exactMatch = allTags?.some((t) => t.name === input.toLowerCase());

  const handleSelect = (tagId: string) => {
    onAttach(tagId);
    setInput("");
    setOpen(false);
  };

  const handleCreateAndAttach = async () => {
    if (!user || !input.trim()) return;
    const name = input.trim().toLowerCase();
    const { data, error } = await supabase
      .from("tags")
      .insert({ user_id: user.id, name })
      .select()
      .single();
    if (error) return;
    queryClient.invalidateQueries({ queryKey: ["tags"] });
    onAttach(data.id);
    setInput("");
    setOpen(false);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.parentElement?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {attachedTags.map((tag) => (
        <Badge key={tag.id} variant="secondary" className="gap-1 text-xs hover:bg-secondary/80 transition-colors">
          <Link
            to={`/tags/${encodeURIComponent(tag.name)}`}
            onClick={(e) => e.stopPropagation()}
            className="hover:underline"
          >
            {tag.name}
          </Link>
          <button onClick={(e) => { e.stopPropagation(); onDetach(tag.id); }} className="hover:text-destructive">
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <div className="relative">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => { setInput(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Add tag…"
          className="h-7 w-28 rounded-md border border-input bg-background px-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        {open && input.length > 0 && (suggestions.length > 0 || !exactMatch) && (
          <div className="absolute top-full left-0 z-50 mt-1 w-48 rounded-md border border-border bg-popover shadow-md">
            {suggestions.slice(0, 5).map((tag) => (
              <button
                key={tag.id}
                onClick={() => handleSelect(tag.id)}
                className="block w-full px-3 py-1.5 text-left text-xs text-foreground hover:bg-secondary"
              >
                {tag.name}
              </button>
            ))}
            {!exactMatch && input.trim() && (
              <button
                onClick={handleCreateAndAttach}
                className="block w-full px-3 py-1.5 text-left text-xs text-accent hover:bg-secondary"
              >
                Create "{input.trim().toLowerCase()}"
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TagInput;
