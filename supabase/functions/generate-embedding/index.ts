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

        const body = await req.json();

        // --- Flexible Payload Normalisation ---
        // Accepts any of these shapes from Lovable-generated code:
        // 1. { contentType, contentId, text } — explicit
        // 2. { record, table }               — webhook-style
        // 3. { article }                     — Lovable may pass the DB row directly
        // 4. { quote }

        let finalContentType: string | undefined = body.contentType;
        let finalContentId: string | undefined = body.contentId;
        let finalText: string | undefined = body.text;
        let finalUserId: string = userId;

        const record = body.record || body.article || body.quote || null;
        const table = body.table
            || (body.article ? "articles" : null)
            || (body.quote ? "quotes" : null);

        if (record && table) {
            finalContentType = table === "articles" ? "article" : "quote";
            finalContentId = record.id;
            if (record.user_id) finalUserId = record.user_id;

            if (table === "articles") {
                const title = record.title || "";
                const desc = record.og_description || record.description || "";
                const content = record.content_text || "";
                finalText = `${title}\n${desc}\n${content}`.trim();
            } else {
                finalText = record.text || "";
            }
        }

        // Last resort: if text still missing but we have a record, use JSON
        if (!finalText && record) {
            finalText = JSON.stringify(record).slice(0, 2000);
        }

        if (!finalContentType || !finalContentId || !finalText) {
            console.error("Missing fields — body was:", JSON.stringify(body));
            return errorResponse(
                `contentType (${finalContentType}), contentId (${finalContentId}), and text are required`,
                400
            );
        }


        // Generate embedding via OpenAI with retry for rate limits
        let embRes: Response | null = null;
        for (let attempt = 0; attempt < 3; attempt++) {
            embRes = await fetch("https://api.openai.com/v1/embeddings", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${openaiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: "text-embedding-3-small",
                    input: finalText.slice(0, 8000),
                }),
            });

            if (embRes.status === 429) {
                const wait = Math.pow(2, attempt + 1) * 1000; // 2s, 4s, 8s
                console.warn(`OpenAI 429 — retrying in ${wait}ms (attempt ${attempt + 1}/3)`);
                await new Promise((r) => setTimeout(r, wait));
                continue;
            }
            break;
        }

        if (!embRes || !embRes.ok) {
            const err = embRes ? await embRes.text() : "No response";
            console.error("OpenAI embedding error:", err);
            return errorResponse(`OpenAI error: ${embRes?.status || "unknown"}`, 502);
        }

        const embData = await embRes.json();
        const embedding = embData.data?.[0]?.embedding;
        if (!embedding) return errorResponse("No embedding returned from OpenAI", 502);

        // Upsert into content_embeddings
        const { error: upsertErr } = await client
            .from("content_embeddings")
            .upsert({
                user_id: finalUserId,
                content_type: finalContentType,
                content_id: finalContentId,
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
