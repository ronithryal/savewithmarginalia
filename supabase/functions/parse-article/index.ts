import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Convert a Twitter/X embed blockquote into a styled fallback card HTML */
function tweetToCard(tweetHtml: string): string {
  // Extract tweet URL
  const urlMatch = tweetHtml.match(/href=["'](https?:\/\/(?:twitter\.com|x\.com)\/[^"']+)["']/i);
  const tweetUrl = urlMatch?.[1] || "#";

  // Extract author: usually the first <a> text is "— Author (@handle)"
  const authorLine = tweetHtml.match(/&mdash;\s*(.+?)\s*\((@\w+)\)/i)
    || tweetHtml.match(/—\s*(.+?)\s*\((@\w+)\)/i);
  const authorName = authorLine?.[1]?.trim() || "";
  const authorHandle = authorLine?.[2]?.trim() || "";

  // Extract date
  const dateMatch = tweetHtml.match(/<a[^>]*>([A-Z][a-z]+ \d{1,2}, \d{4})<\/a>/i);
  const dateStr = dateMatch?.[1] || "";

  // Extract tweet text: get all <p> content
  const pMatches = [...tweetHtml.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)];
  const tweetText = pMatches
    .map((m) => m[1].replace(/<[^>]+>/g, "").trim())
    .filter((t) => !t.startsWith("&mdash;") && !t.startsWith("—"))
    .join("<br/>");

  return `<div class="tweet-card" style="border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:12px 0;background:#f8fafc;">
    ${authorName ? `<p style="margin:0 0 4px;"><strong>${authorName}</strong> <span style="color:#6b7280;">${authorHandle}</span></p>` : ""}
    <p style="margin:0 0 8px;">${tweetText || "(Tweet content unavailable)"}</p>
    ${dateStr ? `<p style="margin:0 0 8px;color:#6b7280;font-size:0.85em;">${dateStr}</p>` : ""}
    <a href="${tweetUrl}" target="_blank" rel="noopener noreferrer" style="color:#1d9bf0;font-size:0.85em;">View on X →</a>
  </div>`;
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
    let contentHtml = "";
    let previewImageUrl: string | null = null;
    let ogDescription = "";

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

      // Extract title
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

      // Extract og:description to deduplicate later
      const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i)
        || html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
      if (ogDescMatch?.[1]) {
        ogDescription = ogDescMatch[1].replace(/&amp;/g, "&").replace(/&quot;/g, '"').trim();
      }

      // --- Strip non-content elements ---
      let cleaned = html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<nav[\s\S]*?<\/nav>/gi, "")
        .replace(/<header[\s\S]*?<\/header>/gi, "")
        .replace(/<footer[\s\S]*?<\/footer>/gi, "")
        .replace(/<aside[\s\S]*?<\/aside>/gi, "")
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
        .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
        .replace(/<form[\s\S]*?<\/form>/gi, "");

      // --- Convert Twitter/X embed blockquotes to fallback cards ---
      cleaned = cleaned.replace(
        /<blockquote[^>]*class=["'][^"']*twitter-tweet[^"']*["'][^>]*>[\s\S]*?<\/blockquote>/gi,
        (match) => tweetToCard(match)
      );

      // Find main content container
      const articleMatch = cleaned.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
      const mainMatch = cleaned.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
      const bodyMatch = cleaned.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      let rawContent = articleMatch?.[1] || mainMatch?.[1] || bodyMatch?.[1] || cleaned;

      // --- Strip small decorative images (width/height < 100) ---
      rawContent = rawContent.replace(/<img[^>]*>/gi, (imgTag) => {
        const wMatch = imgTag.match(/width=["']?(\d+)/i);
        const hMatch = imgTag.match(/height=["']?(\d+)/i);
        if ((wMatch && parseInt(wMatch[1]) < 100) || (hMatch && parseInt(hMatch[1]) < 100)) {
          return "";
        }
        return imgTag;
      });

      // --- Allowlist-based HTML sanitization ---
      const allowedTags = new Set([
        "p", "h1", "h2", "h3", "h4", "br", "strong", "b", "em", "i",
        "ul", "ol", "li", "a", "img", "blockquote", "figure", "figcaption",
        "div", "span",
      ]);
      const allowedAttrs = new Set(["href", "src", "alt", "target", "rel", "class", "style"]);

      // Replace tags: keep allowed ones with filtered attrs, strip the rest
      contentHtml = rawContent.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)?\/?>/gi, (fullMatch, tagName, attrsStr) => {
        const lowerTag = tagName.toLowerCase();
        if (!allowedTags.has(lowerTag)) return "";

        const isClosing = fullMatch.startsWith("</");
        if (isClosing) return `</${lowerTag}>`;

        // Filter attributes
        let filteredAttrs = "";
        if (attrsStr) {
          const attrMatches = [...attrsStr.matchAll(/([a-zA-Z-]+)=["']([^"']*?)["']/g)];
          for (const [, attrName, attrVal] of attrMatches) {
            if (allowedAttrs.has(attrName.toLowerCase())) {
              // Only allow style on tweet-card divs
              if (attrName.toLowerCase() === "style" && lowerTag !== "div" && lowerTag !== "p" && lowerTag !== "a" && lowerTag !== "span") continue;
              // Only allow class on tweet-card divs
              if (attrName.toLowerCase() === "class" && !attrVal.includes("tweet-card")) continue;
              filteredAttrs += ` ${attrName}="${attrVal}"`;
            }
          }
        }

        const selfClosing = lowerTag === "br" || lowerTag === "img";
        return `<${lowerTag}${filteredAttrs}${selfClosing ? " /" : ""}>`;
      });

      // Strip CSS class artifacts and junk text nodes (e.g. "p]:m-0">)
      contentHtml = contentHtml
        .replace(/[a-zA-Z\]]*\]:[\w-]+["']?>/g, "") // Tailwind class artifacts
        .replace(/class=["'][^"']*["']/g, (m) => m.includes("tweet-card") ? m : "") // strip non-tweet classes
        .replace(/\n{3,}/g, "\n\n")
        .trim();

      // --- Deduplicate og:description from content ---
      if (ogDescription && ogDescription.length > 20) {
        const normalizedDesc = ogDescription.slice(0, 100).replace(/[^\w\s]/g, "").toLowerCase();
        // Check if the first 500 chars contain a very similar string
        const contentStart = contentHtml.slice(0, 800).replace(/<[^>]+>/g, "").replace(/[^\w\s]/g, "").toLowerCase();
        // The og:description often appears verbatim as the first paragraph - we don't need to do anything
        // since we're extracting from <article>/<main> body, not from meta tags
      }

      // Limit size
      if (contentHtml.length > 80000) {
        contentHtml = contentHtml.slice(0, 80000) + "\n<p><em>[Content truncated]</em></p>";
      }
    } catch (parseError) {
      console.error("Parse error:", parseError);
    }

    // Update the article record
    const updates: Record<string, unknown> = {};
    if (title !== article.title) updates.title = title;
    if (contentHtml) updates.content_text = contentHtml;
    if (previewImageUrl) updates.preview_image_url = previewImageUrl;

    if (Object.keys(updates).length > 0) {
      const { error: updateErr } = await adminClient
        .from("articles")
        .update(updates)
        .eq("id", article_id);
      if (updateErr) console.error("Update error:", updateErr);
    }

    return new Response(
      JSON.stringify({ success: true, title: updates.title || article.title, has_content: !!contentHtml }),
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
