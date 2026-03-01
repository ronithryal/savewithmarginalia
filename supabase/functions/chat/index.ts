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
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had",
    "do", "does", "did", "will", "would", "could", "should", "may", "might", "can", "shall",
    "i", "me", "my", "we", "our", "you", "your", "he", "she", "it", "they", "them", "their",
    "what", "which", "who", "whom", "this", "that", "these", "those", "am", "at", "by", "for",
    "from", "in", "into", "of", "on", "to", "with", "and", "but", "or", "nor", "not", "so",
    "if", "then", "about", "how", "when", "where", "why", "all", "any", "some", "most", "much",
    "many", "more", "show", "tell", "find", "get", "give", "make", "know", "think", "see",
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

    const { message, history, messages: messagesArray } = await req.json();

    let conversationMessages: { role: string; content: string }[] = [];
    let lastUserMessage = "";

    if (messagesArray && Array.isArray(messagesArray)) {
      conversationMessages = messagesArray;
      const lastUser = [...messagesArray].reverse().find((m: any) => m.role === "user");
      lastUserMessage = lastUser?.content || "";
    } else if (message) {
      lastUserMessage = message;
      conversationMessages = [...(history || []), { role: "user", content: message }];
    }

    if (!lastUserMessage) {
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

    // ── RAG: semantic retrieval first, keyword fallback if needed ──
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    let contextParts: string[] = [];
    let usedRAG = false;

    if (openaiKey) {
      try {
        const embRes = await fetch("https://api.openai.com/v1/embeddings", {
          method: "POST",
          headers: { "Authorization": `Bearer ${openaiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "text-embedding-3-small", input: lastUserMessage.slice(0, 8000) }),
        });

        if (embRes.ok) {
          const embData = await embRes.json();
          const queryEmbedding = embData.data?.[0]?.embedding;

          if (queryEmbedding) {
            const { data: matches } = await client.rpc("match_content_embeddings", {
              query_embedding: queryEmbedding,
              match_user_id: userId,
              match_count: 15, // Increased count to allow for filtering
            });

            if (matches && matches.length > 0) {
              const highQualityMatches = matches.filter((m: any) => m.similarity > 0.5);

              if (highQualityMatches.length > 0) {
                usedRAG = true;
                const articleIds = highQualityMatches.filter((m: any) => m.content_type === "article").map((m: any) => m.content_id);
                const quoteIds = highQualityMatches.filter((m: any) => m.content_type === "quote").map((m: any) => m.content_id);

                const [{ data: articles }, { data: quotes }] = await Promise.all([
                  articleIds.length > 0
                    ? client.from("articles").select("id, title, content_text, url, source_domain").in("id", articleIds).eq("user_id", userId)
                    : Promise.resolve({ data: [] }),
                  quoteIds.length > 0
                    ? client.from("quotes").select("id, text, article_id").in("id", quoteIds).eq("user_id", userId)
                    : Promise.resolve({ data: [] }),
                ]);

                for (const a of articles || []) {
                  contextParts.push(`[Saved article] "${a.title}" from ${a.source_domain}\n${(a.content_text || "").slice(0, 500)}`);
                }
                if ((quotes || []).length > 0) {
                  const artIds = [...new Set((quotes as any[]).map((q) => q.article_id))];
                  const { data: arts } = await client.from("articles").select("id, title").in("id", artIds);
                  const artMap = Object.fromEntries((arts || []).map((a: any) => [a.id, a]));
                  for (const q of quotes as any[]) {
                    contextParts.push(`[Saved quote] "${q.text}" — from "${artMap[q.article_id]?.title || "Unknown"}"`);
                  }
                }
              }
            }
          }
        } catch (ragErr) {
          console.warn("RAG failed, falling back to keyword:", ragErr);
        }
      }

    // ── Keyword fallback ──
    if (!usedRAG) {
        const keywords = extractKeywords(lastUserMessage);
        if (keywords.length > 0) {
          const articleOrClauses = keywords.flatMap((k) => [`title.ilike.%${k}%`, `content_text.ilike.%${k}%`]).join(",");
          const { data: articles } = await client.from("articles").select("id, title, content_text, url, source_domain").eq("user_id", userId).or(articleOrClauses).limit(6);
          for (const a of articles || []) {
            contextParts.push(`[Saved article] "${a.title}" from ${a.source_domain}\n${(a.content_text || "").slice(0, 400)}`);
          }
          const quoteOrClauses = keywords.map((k) => `text.ilike.%${k}%`).join(",");
          const { data: quotes } = await client.from("quotes").select("id, text, article_id").eq("user_id", userId).or(quoteOrClauses).limit(6);
          if (quotes && quotes.length > 0) {
            const artIds = [...new Set(quotes.map((q: any) => q.article_id))];
            const { data: arts } = await client.from("articles").select("id, title, url").in("id", artIds);
            const artMap = Object.fromEntries((arts || []).map((a: any) => [a.id, a]));
            for (const q of quotes) {
              const art = artMap[q.article_id] || {};
              contextParts.push(`[Saved quote] "${q.text}" — from "${art.title || "Unknown"}"`);
            }
          }
        }
      }

      // ── Final fallback: Sonar Web Search if still nothing ──
      if (contextParts.length === 0) {
        const sonarKey = Deno.env.get("SONAR_API_KEY");
        if (sonarKey) {
          try {
            const sonarRes = await fetch("https://api.perplexity.ai/chat/completions", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${sonarKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "sonar-pro",
                messages: [
                  {
                    role: "system",
                    content: "You are a research assistant. Provide a concise, highly informative answer based on live web search. Focus on facts and insights.",
                  },
                  { role: "user", content: lastUserMessage },
                ],
                temperature: 0.2,
              }),
            });
            if (sonarRes.ok) {
              const sonarData = await sonarRes.json();
              const webAnswer = sonarData.choices?.[0]?.message?.content;
              if (webAnswer) {
                contextParts.push(`[Web Search Results (via Perplexity Sonar)]\n${webAnswer}\n\nNote to AI: Inform the user explicitly that you didn't find specific saved items in their library for this query, so you performed a live web search to answer their question using Sonar.`);
              }
            }
          } catch (sonarErr) {
            console.warn("Sonar fallback failed:", sonarErr);
          }
        }
      }

      const contextString =
        contextParts.length > 0
          ? `Here is relevant context to help answer the user. If it includes Web Search Results, inform the user you searched the web. Otherwise, it is from their personal library:\n\n${contextParts.join("\n\n")}`
          : "The user's library has no content matching this query, and web search was unavailable. Use your own knowledge to help them think, and let them know you didn't find relevant saved items.";

      const aiMessages = [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "system", content: contextString },
        ...conversationMessages,
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
      let rawAnswer = aiData.choices?.[0]?.message?.content || "I couldn't generate a response.";

      // Extract followups JSON from the end of the response
      let followups: string[] = [];
      const jsonMatch = rawAnswer.match(/\{"followups":\s*\[.*?\]\s*\}\s*$/s);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed.followups)) {
            followups = parsed.followups.slice(0, 2);
          }
        } catch (_e) { /* ignore parse errors */ }
        rawAnswer = rawAnswer.slice(0, jsonMatch.index).trim();
      }

      return new Response(
        JSON.stringify({ answer: rawAnswer, followups }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (err) {
      console.error("chat error:", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      return new Response(
        JSON.stringify({ error: message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  });
