import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { article_id } = await req.json();
    if (!article_id) {
      return new Response(JSON.stringify({ error: "article_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate user auth
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: "Server config error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role client with user's auth header for getUser
    const adminClient = createClient(supabaseUrl, serviceKey, {
      global: { headers: { Authorization: authHeader! } },
    });
    const {
      data: { user },
    } = await adminClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: article, error: fetchErr } = await adminClient
      .from("articles")
      .select("*")
      .eq("id", article_id)
      .eq("user_id", user.id)
      .single();

    if (fetchErr || !article) {
      return new Response(JSON.stringify({ error: "Article not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the URL content
    const url = article.url;
    let title = article.title;
    let contentText = "";
    let previewImageUrl: string | null = null;

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; Lovable/1.0; +https://lovable.dev)",
          Accept: "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();

      // Extract title from HTML
      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const ogTitleMatch = html.match(
        /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i
      );
      const extractedTitle =
        ogTitleMatch?.[1] || titleMatch?.[1]?.trim() || null;
      if (extractedTitle) {
        // Decode HTML entities
        title = extractedTitle
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#039;/g, "'")
          .replace(/&#x27;/g, "'")
          .replace(/&#x2F;/g, "/");
      }

      // Extract og:image
      const ogImageMatch = html.match(
        /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i
      );
      if (ogImageMatch?.[1]) {
        previewImageUrl = ogImageMatch[1];
      }

      // Extract main content - strip scripts, styles, nav, header, footer, then get text
      let cleaned = html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<nav[\s\S]*?<\/nav>/gi, "")
        .replace(/<header[\s\S]*?<\/header>/gi, "")
        .replace(/<footer[\s\S]*?<\/footer>/gi, "")
        .replace(/<aside[\s\S]*?<\/aside>/gi, "");

      // Try to find <article> or <main> tag content
      const articleMatch = cleaned.match(
        /<article[^>]*>([\s\S]*?)<\/article>/i
      );
      const mainMatch = cleaned.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
      const bodyMatch = cleaned.match(/<body[^>]*>([\s\S]*?)<\/body>/i);

      let contentHtml = articleMatch?.[1] || mainMatch?.[1] || bodyMatch?.[1] || cleaned;

      // Convert paragraphs and headings to text with line breaks
      contentText = contentHtml
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n\n")
        .replace(/<\/h[1-6]>/gi, "\n\n")
        .replace(/<\/li>/gi, "\n")
        .replace(/<\/div>/gi, "\n")
        .replace(/<\/blockquote>/gi, "\n\n")
        .replace(/<[^>]+>/g, "") // strip remaining tags
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/\n{3,}/g, "\n\n") // collapse multiple newlines
        .trim();

      // Limit content length to avoid huge payloads
      if (contentText.length > 50000) {
        contentText = contentText.slice(0, 50000) + "\n\n[Content truncated]";
      }
    } catch (parseError) {
      console.error("Parse error:", parseError);
      // Content stays empty, article still saved with URL
    }

    // Update the article record
    const updates: Record<string, unknown> = {};
    if (title !== article.title) updates.title = title;
    if (contentText) updates.content_text = contentText;
    if (previewImageUrl) updates.preview_image_url = previewImageUrl;

    if (Object.keys(updates).length > 0) {
      const { error: updateErr } = await adminClient
        .from("articles")
        .update(updates)
        .eq("id", article_id);
      if (updateErr) {
        console.error("Update error:", updateErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        title: updates.title || article.title,
        has_content: !!contentText,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
