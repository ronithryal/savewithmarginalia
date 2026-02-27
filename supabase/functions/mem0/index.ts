import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Mem0 Active Memory Function
 * 
 * Provides long-term memory for user preferences, judgments, and heuristics.
 * Integrates with Mem0 AI API (api.mem0.ai).
 * 
 * Request body:
 * - action: 'add' | 'search' | 'get'
 * - text?: string (for 'add')
 * - query?: string (for 'search')
 * - metadata?: object
 */
Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
        const authHeader = req.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
        }

        const mem0ApiKey = Deno.env.get("MEM0_API_KEY");
        if (!mem0ApiKey) {
            return new Response(JSON.stringify({ error: "MEM0_API_KEY not configured" }), {
                status: 500,
                headers: corsHeaders,
            });
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, serviceKey);
        const token = authHeader.replace("Bearer ", "");
        const { data: claimsData } = await supabase.auth.getClaims(token);
        const userId = claimsData?.claims?.sub as string;

        const { action, text, query, metadata } = await req.json();

        if (action === "add") {
            if (!text) return new Response(JSON.stringify({ error: "text required" }), { status: 400, headers: corsHeaders });

            const res = await fetch("https://api.mem0.ai/v1/memories/", {
                method: "POST",
                headers: {
                    "Authorization": `Token ${mem0ApiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    messages: [{ role: "user", content: text }],
                    user_id: userId,
                    metadata: metadata || {},
                }),
            });

            if (!res.ok) throw new Error(`Mem0 error: ${res.status} ${await res.text()}`);
            return new Response(await res.text(), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        if (action === "search") {
            if (!query) return new Response(JSON.stringify({ error: "query required" }), { status: 400, headers: corsHeaders });

            const res = await fetch("https://api.mem0.ai/v1/memories/search/", {
                method: "POST",
                headers: {
                    "Authorization": `Token ${mem0ApiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    query,
                    user_id: userId,
                }),
            });

            if (!res.ok) throw new Error(`Mem0 error: ${res.status}`);
            return new Response(await res.text(), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        if (action === "get") {
            const res = await fetch(`https://api.mem0.ai/v1/memories/?user_id=${userId}`, {
                headers: {
                    "Authorization": `Token ${mem0ApiKey}`,
                    "Content-Type": "application/json",
                },
            });

            if (!res.ok) throw new Error(`Mem0 error: ${res.status}`);
            return new Response(await res.text(), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: corsHeaders });

    } catch (err) {
        console.error("Mem0 error:", err);
        return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
    }
});
