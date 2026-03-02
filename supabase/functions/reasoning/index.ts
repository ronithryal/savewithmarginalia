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

        const { query, tagName, articleIds: reqArticleIds, quoteIds: reqQuoteIds } = await req.json();

        // Debug Log: Check Key Format (DO NOT LOG FULL KEY)
        const keyPrefix = anthropicKey.slice(0, 7);
        console.log(`[Reasoning Debug] Anthropic Key Prefix: ${keyPrefix}... Length: ${anthropicKey.length}`);

        let finalArticleIds = Array.isArray(reqArticleIds) ? reqArticleIds : [];
        let finalQuoteIds = Array.isArray(reqQuoteIds) ? reqQuoteIds : [];

        // 1. Perform RAG ONLY if no explicit IDs were provided
        if (finalArticleIds.length === 0 && finalQuoteIds.length === 0) {
            const embRes = await fetch("https://api.openai.com/v1/embeddings", {
                method: "POST",
                headers: { "Authorization": `Bearer ${openaiKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({ model: "text-embedding-3-small", input: query || tagName || "latest research" }),
            });

            if (!embRes.ok) throw new Error("Failed to generate embedding");
            const embData = await embRes.json();
            const queryEmbedding = embData.data?.[0]?.embedding;

            const { data: matches } = await supabase.rpc("match_content_embeddings", {
                query_embedding: queryEmbedding,
                match_user_id: userId,
                match_count: 12,
            });

            finalArticleIds = matches?.filter((m: any) => m.content_type === "article" && m.similarity > 0.4).map((m: any) => m.content_id) || [];
            finalQuoteIds = matches?.filter((m: any) => m.content_type === "quote" && m.similarity > 0.4).map((m: any) => m.content_id) || [];
        }

        if (finalArticleIds.length === 0 && finalQuoteIds.length === 0) {
            return new Response(JSON.stringify({ result: "It looks like your library context came through empty — no exact items or relevant semantic matches were found for this query." }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const [{ data: articles }, { data: quotes }] = await Promise.all([
            finalArticleIds.length > 0
                ? supabase.from("articles").select("title, content_text, source_domain").in("id", finalArticleIds.slice(0, 15)).eq("user_id", userId)
                : Promise.resolve({ data: [] }),
            finalQuoteIds.length > 0
                ? supabase.from("quotes").select("text, article_id").in("id", finalQuoteIds.slice(0, 30)).eq("user_id", userId)
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

        // Update for March 2026: Prioritize Claude 4.6 and 4.5 series
        const modelVersions = [
            "claude-sonnet-4-6",             // Sonnet 4.6 (Latest)
            "claude-opus-4-6",               // Opus 4.6
            "claude-sonnet-4-5",             // Sonnet 4.5
            "claude-3-5-sonnet-latest",       // 3.5 Alias fallback
            "claude-3-5-sonnet-20241022",    // 3.5 v2
            "claude-3-5-haiku-latest"        // 3.5 Haiku
        ];

        let aiResponse;
        let lastError = "";

        for (const rawModelName of modelVersions) {
            const modelName = rawModelName.trim();
            console.log(`[Reasoning] Attempting fetch with model: ${modelName}`);

            const requestBody = {
                model: modelName,
                max_tokens: 2048,
                system: SYSTEM_PROMPT.trim(),
                messages: [
                    { role: "user", content: `Query: ${query || "Analyze my research regarding " + tagName}\n\n${contextStr}` },
                ],
                temperature: 0.1,
            };

            aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: {
                    "x-api-key": anthropicKey.trim(),
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                    "accept": "application/json",
                },
                body: JSON.stringify(requestBody),
            });

            if (aiResponse.ok) break;

            const errText = await aiResponse.text();
            lastError = `Model ${modelName} failed (${aiResponse.status}): ${errText}`;
            console.warn(lastError);

            // If it's not a 404 or 400 (model issue), don't bother retrying with other models
            if (aiResponse.status !== 404 && aiResponse.status !== 400) break;
        }

        if (!aiResponse || !aiResponse.ok) {
            throw new Error(`Anthropic Error: ${lastError || "All models failed"}`);
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
