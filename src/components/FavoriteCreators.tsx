import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";
import { toast } from "sonner";

const FavoriteCreators = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [feedInput, setFeedInput] = useState("");
  const [adding, setAdding] = useState(false);

  const { data: feeds } = useQuery({
    queryKey: ["user-feeds"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("user_feeds")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const handleAdd = async () => {
    if (!feedInput.trim() || !user) return;
    setAdding(true);

    let feedUrl = feedInput.trim();
    let label = feedUrl;

    // If it looks like a Twitter/X handle, convert to nitter RSS
    if (feedUrl.startsWith("@")) feedUrl = feedUrl.slice(1);
    if (/^[a-zA-Z0-9_]{1,15}$/.test(feedUrl)) {
      label = `@${feedUrl}`;
      feedUrl = `https://nitter.net/${feedUrl}/rss`;
    } else {
      try {
        label = new URL(feedUrl).hostname.replace("www.", "");
      } catch {
        label = feedUrl.slice(0, 40);
      }
    }

    await (supabase as any).from("user_feeds").insert({
      user_id: user.id,
      feed_url: feedUrl,
      label,
    });

    setFeedInput("");
    setAdding(false);
    queryClient.invalidateQueries({ queryKey: ["user-feeds"] });
    toast.success("Creator feed added.");
  };

  const handleRemove = async (id: string) => {
    await (supabase as any).from("user_feeds").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["user-feeds"] });
  };

  return (
    <section className="mb-12">
      <h2 className="font-display text-xl font-semibold text-foreground mb-6">
        Favorite Creators
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        Add RSS feed URLs or Twitter/X handles to follow creators on the Discover page.
      </p>

      <div className="flex gap-2 mb-4">
        <Input
          placeholder="RSS URL or @handle"
          value={feedInput}
          onChange={(e) => setFeedInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAdd())}
          className="flex-1"
        />
        <Button variant="outline" size="sm" onClick={handleAdd} disabled={adding || !feedInput.trim()}>
          Add
        </Button>
      </div>

      {feeds && feeds.length > 0 && (
        <div className="space-y-2">
          {feeds.map((feed: any) => (
            <div
              key={feed.id}
              className="flex items-center justify-between rounded-md border border-border px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{feed.label}</p>
                <p className="text-xs text-muted-foreground truncate">{feed.feed_url}</p>
              </div>
              <button
                onClick={() => handleRemove(feed.id)}
                className="ml-2 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {feeds && feeds.length === 0 && (
        <p className="text-xs text-muted-foreground">No creator feeds added yet.</p>
      )}
    </section>
  );
};

export default FavoriteCreators;
