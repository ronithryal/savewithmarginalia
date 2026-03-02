import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    try {
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) return errorResponse("Unauthorized", 401);

        const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_ANON_KEY")!,
            { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return errorResponse("Unauthorized", 401);

        const { tagName, recentTitles = [] } = await req.json();
        if (!tagName) return errorResponse("tagName required");

        const SONAR_API_KEY = Deno.env.get("SONAR_API_KEY");
        if (!SONAR_API_KEY) return errorResponse("SONAR_API_KEY not configured");

        // Build a focused Sonar query from the tag + recent saves
        const titlesContext = recentTitles.length > 0
            ? `\n\nContext: the user has recently saved these articles about this topic:\n${recentTitles.slice(0, 5).map((t: string) => `- ${t}`).join("\n")}`
            : "";

        const query = `Find 10 high-quality, extremely recent articles, essays, breaking developments, or unique perspectives about "${tagName}". Focus exclusively on things happening right now or very recently. You MUST provide a highly diverse mix of sources: include traditional breaking news, unique non-traditional analysis (like Substack or independent blogs), AND high-quality industry macro-reports. Do not over-index on just one type of source. Return a JSON array with objects having: title, url, description (1-2 sentences), domain.${titlesContext}`;

        const sonarRes = await fetch("https://api.perplexity.ai/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${SONAR_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "sonar-pro",
                messages: [
                    {
                        role: "system",
                        content: "You are a real-time discovery engine. You MUST cast a wide net to provide a diverse mix of recent events, independent analysis (e.g., Substack), and high-quality industry reports. Always respond with valid JSON only, no markdown, no explanation. Return a JSON array of exactly 10 objects with fields: title (string), url (string), description (string), domain (string).",
                    },
                    { role: "user", content: query },
                ],
                temperature: 0.2,
            }),
        });

        if (!sonarRes.ok) {
            const err = await sonarRes.text();
            console.error("Sonar API error:", sonarRes.status, err);
            return errorResponse(`Sonar API error ${sonarRes.status}: ${err}`);
        }

        const sonarData = await sonarRes.json();
        const rawContent = sonarData.choices?.[0]?.message?.content ?? "[]";

        // Parse JSON safely
        let results: unknown[] = [];
        try {
            // Strip potential markdown code fences
            const cleaned = rawContent.replace(/```json?\n?/g, "").replace(/```\n?/g, "").trim();
            results = JSON.parse(cleaned);
        } catch {
            console.error("Failed to parse Sonar response:", rawContent);
            results = [];
        }

        return new Response(JSON.stringify({ results }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (err) {
        console.error("sonar-discover error:", err);
        return errorResponse(String(err), 500);
    }
});

function errorResponse(msg: string, status = 400) {
    return new Response(JSON.stringify({ error: msg }), {
        status,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
}
