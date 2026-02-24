import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // Follow redirects manually to get the final URL
    let currentUrl = url;
    for (let i = 0; i < 10; i++) {
      const res = await fetch(currentUrl, { redirect: "manual" });
      const location = res.headers.get("location");
      if (!location) {
        // No more redirects — if this is still a google news URL, try parsing the body
        if (currentUrl.includes("news.google.com")) {
          const body = await res.text();
          // Look for a meta refresh or JS redirect in the HTML
          const match = body.match(/href="(https?:\/\/(?!news\.google\.com)[^"]+)"/);
          if (match) {
            currentUrl = match[1];
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
