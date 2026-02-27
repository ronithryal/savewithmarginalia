import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

// Validate a user API key stored in user_preferences and return the user_id
async function resolveUserFromApiKey(
    supabase: ReturnType<typeof createClient>,
    apiKey: string
): Promise<string | null> {
    const { data } = await (supabase as any)
        .from("user_preferences")
        .select("user_id")
        .eq("mcp_api_key", apiKey)
        .maybeSingle();
    return data?.user_id ?? null;
}

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Auth via x-api-key header
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
        return new Response(JSON.stringify({ error: "Missing x-api-key header" }), {
            status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const userId = await resolveUserFromApiKey(supabase, apiKey);
    if (!userId) {
        return new Response(JSON.stringify({ error: "Invalid API key" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const url = new URL(req.url);
    const tool = url.searchParams.get("tool") || (await req.json().catch(() => ({}))).tool;

    // ── Tool: listTags ──
    if (tool === "listTags") {
        const { data, error } = await supabase
            .from("tags")
            .select("id, name")
            .eq("user_id", userId)
            .order("name");
        if (error) return errorResponse(error.message, corsHeaders);
        return jsonResponse({ tags: data }, corsHeaders);
    }

    // ── Tool: listArticlesByTag ──
    if (tool === "listArticlesByTag") {
        const body = await req.json().catch(() => ({}));
        const tagId = body.tagId || url.searchParams.get("tagId");
        if (!tagId) return errorResponse("tagId required", corsHeaders);

        const { data: links } = await supabase
            .from("article_tags")
            .select("article_id")
            .eq("tag_id", tagId);
        const ids = (links ?? []).map((r: any) => r.article_id);
        if (ids.length === 0) return jsonResponse({ articles: [] }, corsHeaders);

        const { data, error } = await supabase
            .from("articles")
            .select("id, title, url, source_domain, og_description, created_at")
            .in("id", ids)
            .eq("user_id", userId)
            .order("created_at", { ascending: false });
        if (error) return errorResponse(error.message, corsHeaders);
        return jsonResponse({ articles: data }, corsHeaders);
    }

    // ── Tool: listQuotesByTag ──
    if (tool === "listQuotesByTag") {
        const body = await req.json().catch(() => ({}));
        const tagId = body.tagId || url.searchParams.get("tagId");
        if (!tagId) return errorResponse("tagId required", corsHeaders);

        const { data: links } = await supabase
            .from("quote_tags")
            .select("quote_id")
            .eq("tag_id", tagId);
        const ids = (links ?? []).map((r: any) => r.quote_id);
        if (ids.length === 0) return jsonResponse({ quotes: [] }, corsHeaders);

        const { data, error } = await supabase
            .from("quotes")
            .select("id, text, created_at, articles(id, title, url)")
            .in("id", ids)
            .order("created_at", { ascending: false });
        if (error) return errorResponse(error.message, corsHeaders);
        return jsonResponse({ quotes: data }, corsHeaders);
    }

    // ── Tool: getThreadBySessionId ──
    if (tool === "getThreadBySessionId") {
        const body = await req.json().catch(() => ({}));
        const sessionId = body.sessionId || url.searchParams.get("sessionId");
        if (!sessionId) return errorResponse("sessionId required", corsHeaders);

        const { data: session, error: e1 } = await (supabase as any)
            .from("chat_sessions")
            .select("*")
            .eq("id", sessionId)
            .eq("user_id", userId)
            .maybeSingle();
        if (e1) return errorResponse(e1.message, corsHeaders);
        if (!session) return errorResponse("Session not found", corsHeaders, 404);

        const { data: messages } = await (supabase as any)
            .from("chat_messages")
            .select("role, content, created_at")
            .eq("session_id", sessionId)
            .order("created_at", { ascending: true });

        return jsonResponse({ session, messages: messages ?? [] }, corsHeaders);
    }

    return new Response(JSON.stringify({ error: `Unknown tool: ${tool}. Available: listTags, listArticlesByTag, listQuotesByTag, getThreadBySessionId` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
});

function jsonResponse(data: unknown, headers: Record<string, string>) {
    return new Response(JSON.stringify(data), {
        headers: { ...headers, "Content-Type": "application/json" },
    });
}

function errorResponse(msg: string, headers: Record<string, string>, status = 400) {
    return new Response(JSON.stringify({ error: msg }), {
        status, headers: { ...headers, "Content-Type": "application/json" },
    });
}
