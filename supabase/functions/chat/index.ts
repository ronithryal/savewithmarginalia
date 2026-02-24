import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a knowledgeable assistant helping the user explore their personal reading library.
Answer the user's question using ONLY the provided context from their saved articles and quotes.
If the context doesn't contain enough information to answer, say so honestly.
Keep answers concise (2-4 sentences) unless the user asks for detail.
Always reference which article or quote you drew from.`;

function extractKeywords(message: string): string[] {
  const stopWords = new Set([
    "a","an","the","is","are","was","were","be","been","being","have","has","had",
    "do","does","did","will","would","could","should","may","might","can","shall",
    "i","me","my","we","our","you","your","he","she","it","they","them","their",
    "what","which","who","whom","this","that","these","those","am","at","by","for",
    "from","in","into","of","on","to","with","and","but","or","nor","not","so",
    "if","then","about","how","when","where","why","all","any","some","most","much",
    "many","more","show","tell","find","get","give","make","know","think","see",
  ]);
  return message
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const { message, history } = await req.json();
    if (!message) {
      return new Response(JSON.stringify({ error: "message is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if chat is enabled
    const { data: prefs } = await client
      .from("user_preferences")
      .select("ai_chat_enabled")
      .eq("user_id", userId)
      .maybeSingle();

    if (prefs && prefs.ai_chat_enabled === false) {
      return new Response(JSON.stringify({ error: "Chat is disabled in settings" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract keywords and search
    const keywords = extractKeywords(message);
    const sources: any[] = [];
    let contextParts: string[] = [];

    if (keywords.length > 0) {
      // Search articles
      const articleOrClauses = keywords
        .flatMap((k) => [
          `title.ilike.%${k}%`,
          `content_text.ilike.%${k}%`,
        ])
        .join(",");

      const { data: articles } = await client
        .from("articles")
        .select("id, title, content_text, url, source_domain")
        .eq("user_id", userId)
        .or(articleOrClauses)
        .limit(6);

      for (const a of articles || []) {
        const snippet = (a.content_text || "").slice(0, 300);
        contextParts.push(
          `[Article] "${a.title}" (${a.source_domain})\nSummary: ${snippet}`
        );
        sources.push({
          type: "article",
          id: a.id,
          title: a.title,
          url: a.url,
          domain: a.source_domain,
        });
      }

      // Search quotes
      const quoteOrClauses = keywords.map((k) => `text.ilike.%${k}%`).join(",");
      const { data: quotes } = await client
        .from("quotes")
        .select("id, text, article_id")
        .eq("user_id", userId)
        .or(quoteOrClauses)
        .limit(6);

      if (quotes && quotes.length > 0) {
        const artIds = [...new Set(quotes.map((q: any) => q.article_id))];
        const { data: arts } = await client
          .from("articles")
          .select("id, title, url")
          .in("id", artIds);
        const artMap = Object.fromEntries(
          (arts || []).map((a: any) => [a.id, a])
        );

        for (const q of quotes) {
          const art = artMap[q.article_id] || {};
          contextParts.push(
            `[Quote] "${q.text}"\nFrom: ${art.title || "Unknown"} (${art.url || ""})`
          );
          sources.push({
            type: "quote",
            id: q.id,
            text: q.text,
            articleTitle: art.title || "Unknown",
            articleUrl: art.url || "",
            articleId: q.article_id,
          });
        }
      }
    }

    // If no results found, try a broader search with the full message
    if (contextParts.length === 0) {
      const { data: articles } = await client
        .from("articles")
        .select("id, title, content_text, url, source_domain")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5);

      for (const a of articles || []) {
        const snippet = (a.content_text || "").slice(0, 300);
        contextParts.push(
          `[Article] "${a.title}" (${a.source_domain})\nSummary: ${snippet}`
        );
        sources.push({
          type: "article",
          id: a.id,
          title: a.title,
          url: a.url,
          domain: a.source_domain,
        });
      }
    }

    const contextString =
      contextParts.length > 0
        ? `Here is relevant content from the user's library:\n\n${contextParts.join("\n\n")}`
        : "The user's library has no content matching this query.";

    // Build messages for Lovable AI
    const aiMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: contextString },
      ...(history || []),
      { role: "user", content: message },
    ];

    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: aiMessages,
          max_tokens: 500,
          temperature: 0.3,
        }),
      }
    );

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI usage limit reached. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const answer =
      aiData.choices?.[0]?.message?.content || "I couldn't generate a response.";

    return new Response(
      JSON.stringify({ answer, sources }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("chat error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
