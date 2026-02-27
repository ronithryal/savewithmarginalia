import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Generates an embedding for a piece of text using OpenAI text-embedding-3-small.
 * Called after article or quote is saved to populate content_embeddings table.
 *
 * Request body: { contentType: 'article' | 'quote', contentId: string, text: string }
 */
Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
        const authHeader = req.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            return errorResponse("Unauthorized", 401);
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const openaiKey = Deno.env.get("OPENAI_API_KEY");
        if (!openaiKey) return errorResponse("OPENAI_API_KEY not configured", 500);

        const client = createClient(supabaseUrl, serviceKey);

        // Verify user
        const token = authHeader.replace("Bearer ", "");
        const { data: claimsData, error: claimsErr } = await client.auth.getClaims(token);
        if (claimsErr || !claimsData?.claims) return errorResponse("Unauthorized", 401);
        const userId = claimsData.claims.sub as string;

        const { contentType, contentId, text } = await req.json();
        if (!contentType || !contentId || !text) {
            return errorResponse("contentType, contentId, and text are required");
        }

        // Generate embedding via OpenAI
        const embRes = await fetch("https://api.openai.com/v1/embeddings", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${openaiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "text-embedding-3-small",
                input: text.slice(0, 8000), // token safety limit
            }),
        });

        if (!embRes.ok) {
            const err = await embRes.text();
            console.error("OpenAI embedding error:", err);
            return errorResponse(`OpenAI error: ${embRes.status}`, 502);
        }

        const embData = await embRes.json();
        const embedding = embData.data?.[0]?.embedding;
        if (!embedding) return errorResponse("No embedding returned from OpenAI", 502);

        // Upsert into content_embeddings
        const { error: upsertErr } = await client
            .from("content_embeddings")
            .upsert({
                user_id: userId,
                content_type: contentType,
                content_id: contentId,
                embedding,
            }, { onConflict: "content_type,content_id" });

        if (upsertErr) {
            console.error("Upsert error:", upsertErr);
            return errorResponse(`DB error: ${upsertErr.message}`, 500);
        }

        return new Response(JSON.stringify({ ok: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (err) {
        console.error("generate-embedding error:", err);
        return errorResponse(String(err), 500);
    }
});

function errorResponse(msg: string, status = 400) {
    return new Response(JSON.stringify({ error: msg }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}
