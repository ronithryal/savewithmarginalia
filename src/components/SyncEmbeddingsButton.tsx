import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  userId: string;
}

const SyncEmbeddingsButton = ({ userId }: Props) => {
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("");

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const run = async () => {
    setRunning(true);
    try {
      // Fetch existing embeddings
      const { data: existingEmbs } = await supabase
        .from("content_embeddings")
        .select("content_type, content_id")
        .eq("user_id", userId);

      const embeddedSet = new Set(
        (existingEmbs || []).map((e) => `${e.content_type}:${e.content_id}`)
      );

      // Fetch all articles
      const { data: articles } = await supabase
        .from("articles")
        .select("id, title, og_description, content_text, user_id")
        .eq("user_id", userId);

      const missingArticles = (articles || []).filter(
        (a) => !embeddedSet.has(`article:${a.id}`)
      );

      // Fetch all quotes
      const { data: quotes } = await supabase
        .from("quotes")
        .select("id, text, user_id")
        .eq("user_id", userId);

      const missingQuotes = (quotes || []).filter(
        (q) => !embeddedSet.has(`quote:${q.id}`)
      );

      const total = missingArticles.length + missingQuotes.length;
      if (total === 0) {
        toast.success("Everything is already synced!");
        setRunning(false);
        return;
      }

      setStatus(`Syncing 0/${total} items…`);

      let done = 0;

      // Process articles sequentially to avoid OpenAI rate limits
      for (const a of missingArticles) {
        await supabase.functions.invoke("generate-embedding", {
          body: {
            contentType: "article",
            contentId: a.id,
            text: [a.title, a.og_description, a.content_text]
              .filter(Boolean)
              .join("\n"),
          },
        });
        done++;
        setStatus(`Syncing ${done}/${total}…`);
        await sleep(300);
      }

      // Process quotes sequentially
      for (const q of missingQuotes) {
        await supabase.functions.invoke("generate-embedding", {
          body: {
            contentType: "quote",
            contentId: q.id,
            text: q.text,
          },
        });
        done++;
        setStatus(`Syncing ${done}/${total}…`);
        await sleep(300);
      }

      toast.success(`Synced ${total} items.`);
      setStatus("");
    } catch {
      toast.error("Sync failed.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex items-center justify-between rounded-md border border-border p-4">
      <div>
        <p className="text-sm font-medium text-foreground">Sync AI database</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {status || "Generate embeddings for articles and quotes that haven't been processed yet."}
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={run} disabled={running}>
        {running ? "Syncing…" : "Sync"}
      </Button>
    </div>
  );
};

export default SyncEmbeddingsButton;
