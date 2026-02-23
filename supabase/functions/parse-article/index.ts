import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/").replace(/&nbsp;/g, " ");
}

interface OgData {
  title: string;
  summary: string | null;
  image: string | null;
  source: string;
  url: string;
}

function extractMeta(head: string, property: string): string | null {
  // Match both property="..." and name="..." variants, content before or after
  const patterns = [
    new RegExp(`<meta[^>]*(?:property|name)=["']${property}["'][^>]*content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']${property}["']`, "i"),
  ];
  for (const p of patterns) {
    const m = head.match(p);
    if (m?.[1]) return decodeEntities(m[1]).trim();
  }
  return null;
}

function extractTitle(head: string): string | null {
  const m = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m?.[1] ? decodeEntities(m[1]).trim() : null;
}

function isTwitterUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?(twitter\.com|x\.com)\//i.test(url);
}

function isLinkedInUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?linkedin\.com\//i.test(url);
}

function domainFrom(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "unknown"; }
}

async function fetchOgData(articleUrl: string): Promise<OgData> {
  const domain = domainFrom(articleUrl);

  // LinkedIn blocks crawlers — skip fetch entirely
  // TODO: LinkedIn requires authenticated API access for rich previews
  if (isLinkedInUrl(articleUrl)) {
    return { title: "LinkedIn Post", summary: null, image: null, source: "linkedin.com", url: articleUrl };
  }

  let head = "";
  try {
    const resp = await fetch(articleUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Marginalia/1.0; +https://marginalia.app)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const html = await resp.text();
    // Only parse <head> for performance
    const headEnd = html.indexOf("</head>");
    head = headEnd > -1 ? html.slice(0, headEnd) : html.slice(0, 8000);
  } catch (err) {
    console.error("Fetch failed for", articleUrl, err);
    return { title: domain, summary: null, image: null, source: domain, url: articleUrl };
  }

  const isTwitter = isTwitterUrl(articleUrl);

  // Title: og:title → twitter:title → <title>
  const title = extractMeta(head, "og:title")
    || extractMeta(head, "twitter:title")
    || extractTitle(head)
    || domain;

  // Description: og:description → twitter:description → meta description
  const summary = extractMeta(head, "og:description")
    || extractMeta(head, "twitter:description")
    || extractMeta(head, "description")
    || null;

  // Image: og:image → twitter:image
  const image = extractMeta(head, "og:image")
    || extractMeta(head, "twitter:image")
    || null;

  // Source: og:site_name → domain (force x.com for twitter)
  const source = isTwitter ? "x.com" : (extractMeta(head, "og:site_name") || domain);

  // Canonical URL: og:url → original
  const canonicalUrl = extractMeta(head, "og:url") || articleUrl;

  return { title, summary, image, source, url: canonicalUrl };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { article_id } = await req.json();
    if (!article_id) {
      return new Response(JSON.stringify({ error: "article_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: article, error: fetchErr } = await client
      .from("articles").select("*").eq("id", article_id).eq("user_id", user.id).single();
    if (fetchErr || !article) {
      return new Response(JSON.stringify({ error: "Article not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const og = await fetchOgData(article.url);

    const updates: Record<string, unknown> = {};
    if (og.title && og.title !== article.title) updates.title = og.title;
    if (og.image) updates.preview_image_url = og.image;
    if (og.summary) updates.content_text = og.summary;
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
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
