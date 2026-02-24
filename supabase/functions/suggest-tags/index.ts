import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ suggestions: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const client = createClient(supabaseUrl, serviceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await client.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ suggestions: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { text, existing_user_tags } = await req.json();
    if (!text) {
      return new Response(JSON.stringify({ suggestions: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const existingTagsStr = (existing_user_tags || []).join(", ");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(JSON.stringify({ suggestions: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are a tagging assistant for a personal knowledge tool. 
Your job is to suggest short, reusable tags for a piece of content.

Rules:
- Prefer suggesting tags from the user's existing tags list if they are relevant
- Only suggest new tags if no existing tags are relevant enough
- Return between 3 and 6 tags maximum
- Tags should be lowercase, no spaces (use hyphens), no punctuation
- Tags should be specific enough to be useful (e.g. "defi" not "crypto", "vc-thesis" not "business")
- Return ONLY a JSON array of strings, no explanation, no markdown

User's existing tags: [${existingTagsStr}]
Content to tag: [${text.slice(0, 1000)}]`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: systemPrompt }],
        max_tokens: 100,
        temperature: 0.3,
      }),
    });

    if (!aiResp.ok) {
      const status = aiResp.status;
      console.error("AI gateway error:", status);
      if (status === 429 || status === 402) {
        return new Response(JSON.stringify({ suggestions: [], error: status === 429 ? "rate_limited" : "payment_required" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ suggestions: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResp.json();
    const content = aiData.choices?.[0]?.message?.content?.trim() || "[]";

    // Parse JSON array from response (strip markdown fences if present)
    let suggestions: string[] = [];
    try {
      const cleaned = content.replace(/^```json?\s*/i, "").replace(/```\s*$/i, "").trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        suggestions = parsed
          .filter((s: unknown) => typeof s === "string")
          .map((s: string) => s.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""))
          .slice(0, 6);
      }
    } catch {
      console.error("Failed to parse AI response:", content);
    }

    return new Response(JSON.stringify({ suggestions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("suggest-tags error:", err);
    return new Response(JSON.stringify({ suggestions: [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
