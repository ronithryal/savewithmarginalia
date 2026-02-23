import { DOMParser } from "jsr:@b-fuze/deno-dom";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function domainFrom(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

function isTwitterUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?(twitter\.com|x\.com)\//i.test(url);
}

function isLinkedInUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?linkedin\.com\//i.test(url);
}

function inferLinkedInLabel(url: string): string {
  if (/\/posts\//i.test(url)) return "LinkedIn Post";
  if (/\/in\//i.test(url)) return "LinkedIn Profile";
  if (/\/company\//i.test(url)) return "LinkedIn Company Page";
  if (/\/articles?\//i.test(url)) return "LinkedIn Article";
  return "LinkedIn Post";
}

interface OgResult {
  title: string | null;
  description: string | null;
  image: string | null;
  source: string;
  url: string;
}

/** Clean t.co and pic.twitter.com shortlinks from tweet text */
function cleanTweetText(text: string): string {
  return text
    .replace(/https?:\/\/t\.co\/\S+/g, "")
    .replace(/pic\.twitter\.com\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extract tweet text from the oEmbed html field (text inside <p> tags) */
function extractTweetText(html: string): string | null {
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    if (!doc) return null;
    const p = doc.querySelector("p");
    const raw = p?.textContent?.trim() || null;
    return raw ? cleanTweetText(raw) : null;
  } catch {
    return null;
  }
}

/** Fetch tweet data via Twitter's free oEmbed API */
async function fetchTwitterOEmbed(tweetUrl: string): Promise<OgResult> {
  const fallbackHandle = tweetUrl.match(/(?:twitter\.com|x\.com)\/([^/?#]+)/i);
  const fallbackUsername = fallbackHandle ? `@${fallbackHandle[1]}` : null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(tweetUrl)}&omit_script=true&dnt=true`;
    const resp = await fetch(oembedUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (!resp.ok) throw new Error(`oEmbed HTTP ${resp.status}`);
    const data = await resp.json();

    const authorName = data.author_name || null;
    const authorUrl: string = data.author_url || "";
    const handleMatch = authorUrl.match(/\/([^/]+)\/?$/);
    const handle = handleMatch ? `@${handleMatch[1]}` : fallbackUsername;

    const title = authorName && handle
      ? `${authorName} (${handle})`
      : authorName || handle || "Tweet";

    const tweetText = data.html ? extractTweetText(data.html) : null;

    return {
      title,
      description: tweetText,
      image: null, // oEmbed doesn't return images; we'll try OG as fallback
      source: "x.com",
      url: tweetUrl,
    };
  } catch (err) {
    console.error("Twitter oEmbed failed:", err);
    return {
      title: fallbackUsername || "Tweet",
      description: null,
      image: null,
      source: "x.com",
      url: tweetUrl,
    };
  }
}

function extractOgFromHtml(html: string, originalUrl: string): OgResult {
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) {
    return { title: null, description: null, image: null, source: domainFrom(originalUrl), url: originalUrl };
  }

  const getMeta = (property: string): string | null =>
    doc.querySelector(`meta[property='${property}']`)?.getAttribute("content") ||
    doc.querySelector(`meta[name='${property}']`)?.getAttribute("content") ||
    null;

  const title = getMeta("og:title") ?? getMeta("twitter:title") ?? doc.querySelector("title")?.textContent ?? null;
  const description = getMeta("og:description") ?? getMeta("twitter:description") ?? getMeta("description") ?? null;
  const image = getMeta("og:image") ?? getMeta("twitter:image") ?? null;
  const siteName = getMeta("og:site_name") ?? null;
  const canonicalUrl = getMeta("og:url") ?? originalUrl;
  const source = siteName ?? domainFrom(originalUrl);

  return { title, description, image, source, url: canonicalUrl };
}

/** Try fetching OG image for a tweet URL (X does serve og:image) */
async function fetchTwitterOgImage(tweetUrl: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const resp = await fetch(tweetUrl, {
      headers: {
        "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!resp.ok) return null;
    const html = await resp.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    if (!doc) return null;
    return doc.querySelector(`meta[property='og:image']`)?.getAttribute("content") ||
           doc.querySelector(`meta[name='twitter:image']`)?.getAttribute("content") ||
           null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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

    const client = createClient(supabaseUrl, serviceKey, {
      global: { headers: { Authorization: authHeader! } },
    });

    const { data: { user } } = await client.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: article, error: fetchErr } = await client
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

    const articleUrl: string = article.url;

    // ─── LinkedIn: graceful fallback, no fetch ───
    if (isLinkedInUrl(articleUrl)) {
      const label = inferLinkedInLabel(articleUrl);
      await client.from("articles").update({
        title: label,
        source_domain: "linkedin.com",
      }).eq("id", article_id);

      return new Response(JSON.stringify({ success: true, title: label, description: null, image: null, source: "linkedin.com", url: articleUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Twitter/X: use oEmbed API + OG image ───
    if (isTwitterUrl(articleUrl)) {
      const [oembed, ogImage] = await Promise.all([
        fetchTwitterOEmbed(articleUrl),
        fetchTwitterOgImage(articleUrl),
      ]);

      const updates: Record<string, unknown> = {
        source_domain: "x.com",
      };
      if (oembed.title) updates.title = oembed.title;
      if (oembed.description) updates.content_text = oembed.description;
      if (ogImage) updates.preview_image_url = ogImage;

      await client.from("articles").update(updates).eq("id", article_id);

      return new Response(JSON.stringify({
        success: true,
        title: oembed.title,
        description: oembed.description,
        image: ogImage,
        source: "x.com",
        url: articleUrl,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Standard articles: OG fetch ───
    let og: OgResult = { title: null, description: null, image: null, source: domainFrom(articleUrl), url: articleUrl };

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const resp = await fetch(articleUrl, {
        headers: {
          "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const html = await resp.text();
      og = extractOgFromHtml(html, articleUrl);
    } catch (err) {
      console.error("Fetch failed for", articleUrl, err);
    }

    const updates: Record<string, unknown> = {};
    if (og.title) updates.title = og.title;
    if (og.image) updates.preview_image_url = og.image;
    if (og.description) updates.content_text = og.description;
    if (og.source && og.source !== article.source_domain) updates.source_domain = og.source;

    if (Object.keys(updates).length > 0) {
      const { error: updateErr } = await client.from("articles").update(updates).eq("id", article_id);
      if (updateErr) console.error("Update error:", updateErr);
    }

    return new Response(JSON.stringify({ success: true, ...og }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
