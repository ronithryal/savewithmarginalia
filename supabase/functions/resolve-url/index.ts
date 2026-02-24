import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Decode a Google News article URL from its base64-encoded article ID.
 * Google News RSS links look like: https://news.google.com/rss/articles/CBMi...
 * The actual destination URL is embedded in the base64 payload.
 */
function decodeGoogleNewsArticleId(articleId: string): string | null {
  try {
    // Fix base64url encoding
    const b64 = articleId.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const raw = atob(padded);

    // The protobuf payload contains the URL as a string field.
    // We scan for "http" which marks the beginning of the embedded URL.
    // There may be multiple URLs; we want the one that is NOT news.google.com
    const urls: string[] = [];
    let idx = 0;
    while (idx < raw.length) {
      const httpIdx = raw.indexOf("http", idx);
      if (httpIdx === -1) break;

      let url = "";
      for (let i = httpIdx; i < raw.length; i++) {
        const code = raw.charCodeAt(i);
        // Valid URL characters (printable ASCII, excluding control chars and some delimiters)
        if (code >= 33 && code <= 126) {
          url += raw.charAt(i);
        } else {
          break;
        }
      }

      if (url.startsWith("http://") || url.startsWith("https://")) {
        // Clean trailing protobuf artifacts
        url = url.replace(/[\x00-\x1f]+.*$/, "");
        if (!url.includes("news.google.com") && !url.includes("googleusercontent.com")) {
          urls.push(url);
        }
      }
      idx = httpIdx + 1;
    }

    return urls.length > 0 ? urls[0] : null;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "Missing url" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Try to decode from the article ID directly
    const match = url.match(/\/articles\/([A-Za-z0-9_-]+)/);
    if (match) {
      const decoded = decodeGoogleNewsArticleId(match[1]);
      if (decoded) {
        return new Response(JSON.stringify({ resolved: decoded }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Fallback: try following redirects with a browser-like user agent
    let currentUrl = url;
    for (let i = 0; i < 10; i++) {
      const res = await fetch(currentUrl, {
        redirect: "manual",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });
      const location = res.headers.get("location");
      if (!location) {
        if (currentUrl.includes("news.google.com")) {
          const body = await res.text();
          const hrefMatch = body.match(/href="(https?:\/\/(?!news\.google\.com)[^"]+)"/);
          if (hrefMatch) {
            currentUrl = hrefMatch[1];
          }
        }
        break;
      }
      currentUrl = location.startsWith("http") ? location : new URL(location, currentUrl).href;
    }

    return new Response(JSON.stringify({ resolved: currentUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
