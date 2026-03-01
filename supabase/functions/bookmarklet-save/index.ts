import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function domainFrom(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const client = createClient(supabaseUrl, serviceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await client.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const body = await req.json();
    const { type, url, title, text, image } = body;

    if (!type || !url) {
      return new Response(JSON.stringify({ error: "type and url are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Helper: find or create article for this user+url
    async function findOrCreateArticle(): Promise<{ id: string; existed: boolean }> {
      const { data: existing } = await client
        .from("articles")
        .select("id")
        .eq("user_id", userId)
        .eq("url", url)
        .maybeSingle();

      if (existing) {
        return { id: existing.id, existed: true };
      }

      const domain = domainFrom(url);
      const { data: newArticle, error } = await client
        .from("articles")
        .insert({
          user_id: userId,
          url,
          title: title || "Untitled article",
          source_domain: domain,
          content_text: "",
          preview_image_url: image || null,
        })
        .select("id")
        .single();

      if (error) throw error;

      // Fire-and-forget parse
      fetch(`${supabaseUrl}/functions/v1/parse-article`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: anonKey,
        },
        body: JSON.stringify({ article_id: newArticle.id }),
      }).catch(console.error);

      return { id: newArticle.id, existed: false };
    }

    if (type === "article") {
      const { id, existed } = await findOrCreateArticle();
      return new Response(
        JSON.stringify(existed ? { exists: true, article_id: id } : { success: true, article_id: id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (type === "quote") {
      const { id: articleId } = await findOrCreateArticle();

      const { data: quote, error: qErr } = await client
        .from("quotes")
        .insert({
          user_id: userId,
          article_id: articleId,
          text: text || "",
          is_image: false,
        })
        .select("id")
        .single();

      if (qErr) throw qErr;

      return new Response(
        JSON.stringify({ success: true, quote_id: quote.id, article_id: articleId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Invalid type. Use 'article' or 'quote'." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("bookmarklet-save error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
