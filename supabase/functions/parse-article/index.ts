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

    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: "Server config error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const url = article.url;
    let title = article.title;
    let previewImageUrl: string | null = null;
    let description: string | null = null;
    let siteName: string | null = null;

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; Lovable/1.0; +https://lovable.dev)",
          Accept: "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const html = await response.text();

      // Extract title: og:title > <title>
      const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const extractedTitle = ogTitleMatch?.[1] || titleMatch?.[1]?.trim() || null;
      if (extractedTitle) {
        title = extractedTitle
          .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&#x27;/g, "'").replace(/&#x2F;/g, "/");
      }

      // Extract og:image
      const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
      if (ogImageMatch?.[1]) previewImageUrl = ogImageMatch[1];

      // Extract og:site_name
      const siteNameMatch = html.match(/<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i);
      if (siteNameMatch?.[1]) siteName = siteNameMatch[1].trim();

      // --- Summary extraction: prefer in-body TL;DR/Summary sections over og:description ---

      // Strip scripts/styles for body text extraction
      const bodyText = html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "");

      // Look for TL;DR or Summary sections in the page body
      // Match patterns like: "TL;DR" or "TLDR" or "Summary" followed by content
      const tldrPatterns = [
        // TL;DR as a heading followed by paragraph(s)
        /<(?:h[1-6]|strong|b)[^>]*>\s*(?:TL;?\s*DR|TLDR)\s*:?\s*<\/(?:h[1-6]|strong|b)>\s*(?:<[^>]*>)*\s*([\s\S]*?)(?=<(?:h[1-6]|hr|section|div\s+class))/i,
        // TL;DR inline with colon: "TL;DR: some text" or "TL;DR\nsome text"
        /(?:TL;?\s*DR|TLDR)\s*:?\s*(?:<\/[^>]+>\s*)?(?:<[^>]*>\s*)*([\s\S]*?)(?=<(?:h[1-6]|hr|section)|$)/i,
      ];

      let tldrText: string | null = null;
      for (const pattern of tldrPatterns) {
        const match = bodyText.match(pattern);
        if (match?.[1]) {
          // Strip HTML tags and clean up
          const cleaned = match[1]
            .replace(/<[^>]+>/g, " ")
            .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&#x27;/g, "'")
            .replace(/\s+/g, " ")
            .trim();
          // Only use if it's a meaningful length
          if (cleaned.length > 30 && cleaned.length < 2000) {
            tldrText = cleaned;
            break;
          }
        }
      }

      // Priority: TL;DR from body > og:description > meta description
      if (tldrText) {
        description = tldrText;
      } else {
        const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i)
          || html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
        if (ogDescMatch?.[1]) {
          description = ogDescMatch[1]
            .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#039;/g, "'").trim();
        }
    } catch (parseError) {
      console.error("Parse error:", parseError);
    }

    // Update the article record — store description in content_text for now
    const updates: Record<string, unknown> = {};
    if (title !== article.title) updates.title = title;
    if (previewImageUrl) updates.preview_image_url = previewImageUrl;
    if (description) updates.content_text = description;
    if (siteName && siteName !== article.source_domain) updates.source_domain = siteName;

    if (Object.keys(updates).length > 0) {
      const { error: updateErr } = await adminClient
        .from("articles")
        .update(updates)
        .eq("id", article_id);
      if (updateErr) console.error("Update error:", updateErr);
    }

    return new Response(
      JSON.stringify({ success: true, title: updates.title || article.title }),
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
