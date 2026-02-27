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
Format: Use valid Markdown with clear headings.`;

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
        const authHeader = req.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
        const openaiKey = Deno.env.get("OPENAI_API_KEY");

        if (!lovableApiKey || !openaiKey) {
            return new Response(JSON.stringify({ error: "Required API keys (LOVABLE, OPENAI) not configured" }), {
                status: 500,
                headers: corsHeaders,
            });
        }

        const supabase = createClient(supabaseUrl, serviceKey);
        const token = authHeader.replace("Bearer ", "");
        const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
        if (claimsErr || !claimsData?.claims) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
        const userId = claimsData.claims.sub as string;

        const { query, tagName } = await req.json();

        // 1. Get query embedding
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
            match_count: 10,
        });

        const articleIds = matches?.filter((m: any) => m.content_type === "article").map((m: any) => m.content_id) || [];
        const quoteIds = matches?.filter((m: any) => m.content_type === "quote").map((m: any) => m.content_id) || [];

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
            contextStr += `### Article: ${a.title} (${a.source_domain})\n${(a.content_text || "").slice(0, 800)}\n\n`;
        }
        for (const q of quotes || []) {
            contextStr += `> Quote: ${q.text}\n\n`;
        }

        // 4. Call Claude 3.5 Sonnet via Lovable AI Gateway
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${lovableApiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "anthropic/claude-3-5-sonnet-20240620",
                messages: [
                    { role: "system", content: SYSTEM_PROMPT },
                    { role: "user", content: `Query: ${query || "Analyze my research regarding " + tagName}\n\n${contextStr}` },
                ],
                temperature: 0.3,
            }),
        });

        if (!aiResponse.ok) {
            const err = await aiResponse.text();
            console.error("Claude call failed:", err);
            throw new Error(`AI service error: ${aiResponse.status}`);
        }

        const aiData = await aiResponse.json();
        const result = aiData.choices?.[0]?.message?.content;

        return new Response(JSON.stringify({ result }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err) {
        console.error("reasoning error:", err);
        return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
    }
});
