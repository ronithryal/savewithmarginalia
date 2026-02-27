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

        // Verify user via official getUser method
        const token = authHeader.replace("Bearer ", "");
        const { data: { user }, error: userErr } = await client.auth.getUser(token);
        if (userErr || !user) {
            console.error("Auth error:", userErr);
            return errorResponse("Unauthorized", 401);
        }
        const userId = user.id;

        const body = await req.json();
        console.log("Processing embedding request for user:", userId);

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
            console.error("Missing fields! ContentType:", finalContentType, "ContentId:", finalContentId, "HasText:", !!finalText);
            return errorResponse(
                `contentType (${finalContentType}), contentId (${finalContentId}), and text are required`,
                400
            );
        }

        console.log(`Generating embedding for ${finalContentType}:${finalContentId} (length: ${finalText.length})`);

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
                const errBody = await embRes.text();
                // If it's 3 RPM limit, we need to wait significantly longer.
                // Free tier is 3 RPM, so 20s per request.
                const wait = attempt === 0 ? 20000 : 40000;
                console.warn(`OpenAI 429 (Attempt ${attempt + 1}): ${errBody}. Waiting ${wait}ms...`);
                await new Promise((r) => setTimeout(r, wait));
                continue;
            }
            break;
        }

        if (!embRes || !embRes.ok) {
            const err = embRes ? await embRes.text() : "No response";
            console.error("OpenAI error:", err);
            // Help the user identify if it's a credit issue
            if (err.includes("insufficient_quota")) {
                return errorResponse("OpenAI Insufficient Quota: Please check your OpenAI balance/billing.", 502);
            }
            return errorResponse(`OpenAI error: ${embRes?.status || "unknown"} - ${err.slice(0, 100)}`, 502);
        }


        const embData = await embRes.json();
        const embedding = embData.data?.[0]?.embedding;
        if (!embedding) return errorResponse("No embedding returned", 502);

        console.log(`Upserting embedding for user: ${finalUserId}`);

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
            console.error("Database upsert failure:", upsertErr);
            return errorResponse(`DB error: ${upsertErr.message}`, 500);
        }

        console.log("Successfully persisted embedding.");
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
