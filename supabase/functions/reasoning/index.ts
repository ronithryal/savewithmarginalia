import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a high-level strategic advisor and executive thinking partner.
Your goal is to synthesize the user's saved reading and research into structured, actionable insights.

When provided with context from their library, you should perform:
1. **The Core Synthesis**: What is the most important recurring theme or tension in these items?
2. **Actionable Insights**: Based on this, what specific decisions or actions should the user consider?
3. **Strategic Risks**: What are the gaps or contradictions in this current line of thinking?

Tone: Professional, direct, and intellectually rigorous. Avoid fluff.
Format: Use valid Markdown with clear headings. Do not use bold for headers, use proper # and ## markdown.`;

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
        const authHeader = req.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const openaiKey = Deno.env.get("OPENAI_API_KEY");
        const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

        if (!anthropicKey) {
            return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured. Please add it to Supabase secrets." }), {
                status: 500,
                headers: corsHeaders,
            });
        }

        if (!openaiKey) {
            return new Response(JSON.stringify({ error: "OPENAI_API_KEY not configured (required for RAG embeddings)" }), {
                status: 500,
                headers: corsHeaders,
            });
        }

        const supabase = createClient(supabaseUrl, serviceKey);
        const token = authHeader.replace("Bearer ", "");
        const { data: { user: authUser }, error: userErr } = await supabase.auth.getUser(token);
        if (userErr || !authUser) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
        const userId = authUser.id;

        const { query, tagName } = await req.json();

        // Debug Log: Check Key Format (DO NOT LOG FULL KEY)
        const keyPrefix = anthropicKey.slice(0, 7);
        console.log(`[Reasoning Debug] Anthropic Key Prefix: ${keyPrefix}... Length: ${anthropicKey.length}`);

        // 1. Get query embedding using OpenAI (standard across Marginalia for pgvector compatibility)
        const embRes = await fetch("https://api.openai.com/v1/embeddings", {
            method: "POST",
            headers: { "Authorization": `Bearer ${openaiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model: "text-embedding-3-small", input: query || tagName || "latest research" }),
        });

        if (!embRes.ok) throw new Error("Failed to generate embedding");
        const embData = await embRes.json();
        const queryEmbedding = embData.data?.[0]?.embedding;

        // 2. Perform RAG
        const { data: matches } = await supabase.rpc("match_content_embeddings", {
            query_embedding: queryEmbedding,
            match_user_id: userId,
            match_count: 12,
        });

        const articleIds = matches?.filter((m: any) => m.content_type === "article" && m.similarity > 0.4).map((m: any) => m.content_id) || [];
        const quoteIds = matches?.filter((m: any) => m.content_type === "quote" && m.similarity > 0.4).map((m: any) => m.content_id) || [];

        const [{ data: articles }, { data: quotes }] = await Promise.all([
            articleIds.length > 0
                ? supabase.from("articles").select("title, content_text, source_domain").in("id", articleIds)
                : Promise.resolve({ data: [] }),
            quoteIds.length > 0
                ? supabase.from("quotes").select("text, article_id").in("id", quoteIds)
                : Promise.resolve({ data: [] }),
        ]);

        // 3. Build Context
        let contextStr = "Context from User's Library:\n\n";
        for (const a of articles || []) {
            contextStr += `### Article: ${a.title} (${a.source_domain})\n${(a.content_text || "").slice(0, 1000)}\n\n`;
        }
        for (const q of quotes || []) {
            contextStr += `> Quote: ${q.text}\n\n`;
        }

        const modelName = "claude-3-5-sonnet-20241022";
        const endpoint = "https://api.anthropic.com/v1/messages";

        console.log(`[Reasoning Debug] Fetching from ${endpoint} using model ${modelName}`);

        // 4. Call Claude 3.5 Sonnet directly via Anthropic API
        const aiResponse = await fetch(endpoint, {
            method: "POST",
            headers: {
                "x-api-key": anthropicKey.trim(),
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
                "accept": "application/json",
            },
            body: JSON.stringify({
                model: modelName,
                max_tokens: 2048,
                system: SYSTEM_PROMPT,
                messages: [
                    { role: "user", content: `Query: ${query || "Analyze my research regarding " + tagName}\n\n${contextStr}` },
                ],
                temperature: 0.1,
            }),
        });

        if (!aiResponse.ok) {
            const errText = await aiResponse.text();
            console.error(`[Reasoning Error] Status: ${aiResponse.status} Body: ${errText}`);

            // If it's a 404 and we're using the versioned name, maybe try the latest?
            let errorMessage = `Anthropic service error: ${aiResponse.status}`;
            if (errText) {
                try {
                    const errJson = JSON.parse(errText);
                    errorMessage += ` - ${errJson.error?.message || errText}`;
                } catch {
                    errorMessage += ` - ${errText.slice(0, 200)}`;
                }
            } else {
                errorMessage += " - No response body returned from Anthropic.";
            }

            // Fallback hint for 404
            if (aiResponse.status === 404) {
                errorMessage += " (Clue: This usually means the endpoint URL or Model Name is invalid for this key.)";
            }

            throw new Error(errorMessage);
        }

        const aiData = await aiResponse.json();
        const result = aiData.content?.[0]?.text;

        return new Response(JSON.stringify({ result }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err) {
        console.error("reasoning error:", err);
        return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
    }
});
