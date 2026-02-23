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

interface OgResult {
  title: string | null;
  description: string | null;
  image: string | null;
  source: string;
  url: string;
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

  const isTwitter = isTwitterUrl(originalUrl);
  const source = isTwitter ? "x.com" : (siteName ?? domainFrom(originalUrl));

  return { title, description, image, source, url: canonicalUrl };
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
    const domain = domainFrom(articleUrl);

    // LinkedIn blocks all crawlers — skip fetch entirely
    // TODO: LinkedIn requires authenticated API access for rich previews
    if (isLinkedInUrl(articleUrl)) {
      const result = { title: "LinkedIn Post", description: null, image: null, source: "linkedin.com", url: articleUrl };
      await client.from("articles").update({ title: "LinkedIn Post", source_domain: "linkedin.com" }).eq("id", article_id);
      return new Response(JSON.stringify({ success: true, ...result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let og: OgResult = { title: null, description: null, image: null, source: domain, url: articleUrl };

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
      // og stays as the fallback with nulls + domain
    }

    // Update article record with extracted data
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
