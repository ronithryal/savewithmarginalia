import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a sharp intellectual thinking partner for the user. You have full access to everything they've saved — articles, quotes, tweets, and notes — as your shared context.

Your job is NOT to summarize their library. Your job is to help them THINK:

- Connect ideas across different saved items they may not have linked themselves
- Challenge assumptions surfaced in what they've saved
- Introduce tension: where do two saved sources disagree or complicate each other?
- Go beyond their library when useful — bring in real-world context, counterarguments, historical analogies, or adjacent ideas they haven't saved yet
- Ask one sharp follow-up question at the end of every response to push thinking further

Tone: Direct, intellectually confident, conversational. No filler phrases like "Great question!" or "Based on your saved articles...". Just think out loud with them.

Format your response as flowing prose — no bullet points, no bold headers, no markdown formatting. Write like a smart person talking, not a report generator.

When referencing something from their library, weave it in naturally:
e.g. "That Garry's List piece you saved makes exactly this point..."
NOT: "Source: Half the AI Agent Market Is One Category (Garry's List)"

End every response with a single italicized follow-up question.

The user's message is the ONLY question you answer. Do not answer a different question than what was asked, even if the context suggests another angle would be more interesting. If the user asks what to read next, recommend reading. If the user asks about tensions, discuss tensions. Stay strictly on-topic with the exact question asked.

After your main response, on a new line, output exactly this JSON block (and nothing else after it):
{"followups":["<suggestion 1>","<suggestion 2>"]}
The two suggestions should be short (under 8 words each), provocative follow-up directions the user might want to explore next. Do NOT include this JSON explanation in your prose.`;

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
    let contextParts: string[] = [];

    if (keywords.length > 0) {
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
        const snippet = (a.content_text || "").slice(0, 400);
        contextParts.push(
          `[Saved article] "${a.title}" from ${a.source_domain}\n${snippet}`
        );
      }

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
            `[Saved quote] "${q.text}" — from "${art.title || "Unknown"}"`
          );
        }
      }
    }

    // Fallback: recent articles
    if (contextParts.length === 0) {
      const { data: articles } = await client
        .from("articles")
        .select("id, title, content_text, url, source_domain")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5);

      for (const a of articles || []) {
        const snippet = (a.content_text || "").slice(0, 400);
        contextParts.push(
          `[Saved article] "${a.title}" from ${a.source_domain}\n${snippet}`
        );
      }
    }

    const contextString =
      contextParts.length > 0
        ? `Here is relevant content from the user's library:\n\n${contextParts.join("\n\n")}`
        : "The user's library has no content matching this query. Use your own knowledge to help them think, and let them know you didn't find relevant saved items.";

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
          max_tokens: 1000,
          temperature: 0.7,
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
    let rawAnswer =
      aiData.choices?.[0]?.message?.content || "I couldn't generate a response.";

    // Extract followups JSON from the end of the response
    let followups: string[] = [];
    const jsonMatch = rawAnswer.match(/\{"followups":\s*\[.*?\]\s*\}\s*$/s);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed.followups)) {
          followups = parsed.followups.slice(0, 2);
        }
      } catch { /* ignore parse errors */ }
      rawAnswer = rawAnswer.slice(0, jsonMatch.index).trim();
    }

    return new Response(
      JSON.stringify({ answer: rawAnswer, followups }),
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
