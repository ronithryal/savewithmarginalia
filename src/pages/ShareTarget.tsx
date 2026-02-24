import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const ShareTarget = () => {
  const [params] = useSearchParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"saving" | "success" | "error">("saving");
  const [articleId, setArticleId] = useState<string | null>(null);

  const url = params.get("url") || params.get("text") || "";
  const title = params.get("title") || "";

  useEffect(() => {
    if (loading) return;
    if (!user) {
      // Save params and redirect to login; after auth the user lands back here
      navigate(`/auth?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    if (!url) {
      setStatus("error");
      return;
    }

    supabase.functions
      .invoke("bookmarklet-save", {
        body: { type: "article", url, title },
      })
      .then(({ data, error }) => {
        if (error || (!data?.success && !data?.exists)) {
          setStatus("error");
          return;
        }
        setArticleId(data.article_id);
        setStatus("success");
        setTimeout(() => navigate(`/articles/${data.article_id}`), 3000);
      })
      .catch(() => setStatus("error"));
  }, [user, loading, url, title, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="text-center">
        {status === "saving" && (
          <p className="text-muted-foreground text-sm animate-pulse">Saving…</p>
        )}
        {status === "success" && articleId && (
          <a
            href={`/articles/${articleId}`}
            className="text-foreground font-medium hover:text-accent transition-colors"
          >
            Saved! Tap to view →
          </a>
        )}
        {status === "error" && (
          <p className="text-destructive text-sm">Something went wrong. Try again.</p>
        )}
      </div>
    </div>
  );
};

export default ShareTarget;
