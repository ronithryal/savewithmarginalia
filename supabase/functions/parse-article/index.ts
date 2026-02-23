import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Decode common HTML entities */
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/").replace(/&nbsp;/g, " ");
}

/** Strip HTML tags and collapse whitespace */
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** Try to extract a TL;DR or Summary section from the page body */
function extractTldr(bodyHtml: string): string | null {
  // Remove scripts/styles first
  const cleaned = bodyHtml
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");

  // Patterns: heading or bold containing TL;DR / TLDR / Summary, followed by content
  const patterns = [
    // <h2>TL;DR</h2> ... content until next heading/section
    /(?:<(?:h[1-6]|strong|b)[^>]*>)\s*(?:TL;?\s*DR|TLDR|Summary|Key\s*Takeaway[s]?)\s*:?\s*(?:<\/(?:h[1-6]|strong|b)>)\s*([\s\S]*?)(?=<(?:h[1-6])\b|<hr|$)/i,
    // **TL;DR:** or TL;DR: inline, then content until next heading
    /(?:TL;?\s*DR|TLDR)\s*:?\s*<\/[^>]+>\s*([\s\S]*?)(?=<(?:h[1-6])\b|<hr|$)/i,
    // Plain text TL;DR: ... (catches rendered markdown)
    /(?:TL;?\s*DR|TLDR)\s*:\s*([\s\S]*?)(?=<(?:h[1-6])\b|<hr|<\/(?:article|main|section)>|$)/i,
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match?.[1]) {
      const text = stripHtml(decodeEntities(match[1]));
      if (text.length > 30 && text.length < 2000) {
        return text;
      }
    }
  }
  return null;
}

/** Extract readable body text (first ~4000 chars) for AI summarization */
function extractBodyText(html: string): string {
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<aside[\s\S]*?<\/aside>/gi, "");

  // Prefer <article> or <main>
  const articleMatch = cleaned.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  const mainMatch = cleaned.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  const content = articleMatch?.[1] || mainMatch?.[1] || cleaned;

  const text = stripHtml(decodeEntities(content));
  return text.slice(0, 4000);
}

/** Use Lovable AI to generate a summary from article text */
async function aiSummarize(articleText: string, title: string): Promise<string | null> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    console.error("LOVABLE_API_KEY not configured");
    return null;
  }

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content:
              "You are a concise summarizer. Given an article's title and body text, produce a 1-3 sentence summary that captures the key insight or takeaway. Return ONLY the summary text, no labels or prefixes.",
          },
          {
            role: "user",
            content: `Title: ${title}\n\nArticle text:\n${articleText}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error("AI gateway error:", response.status, await response.text());
      return null;
    }

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content?.trim();
    return summary && summary.length > 10 ? summary : null;
  } catch (err) {
    console.error("AI summarize error:", err);
    return null;
  }
}

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
        title = decodeEntities(extractedTitle);
      }

      // Extract og:image
      const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
      if (ogImageMatch?.[1]) previewImageUrl = ogImageMatch[1];

      // Extract og:site_name
      const siteNameMatch = html.match(/<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i);
      if (siteNameMatch?.[1]) siteName = siteNameMatch[1].trim();

      // --- Summary extraction priority ---
      // 1. In-page TL;DR / Summary section
      const tldr = extractTldr(html);
      if (tldr) {
        description = tldr;
        console.log("Summary source: TL;DR section found in page");
      }

      // 2. If no TL;DR, try AI summarization from body text
      if (!description) {
        const bodyText = extractBodyText(html);
        if (bodyText.length > 100) {
          const aiSummary = await aiSummarize(bodyText, title);
          if (aiSummary) {
            description = aiSummary;
            console.log("Summary source: AI-generated");
          }
        }
      }

      // 3. Last resort: og:description / meta description
      if (!description) {
        const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i)
          || html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
        if (ogDescMatch?.[1]) {
          description = decodeEntities(ogDescMatch[1]).trim();
          console.log("Summary source: og:description fallback");
        }
      }
    } catch (parseError) {
      console.error("Parse error:", parseError);
    }

    // Update the article record
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
