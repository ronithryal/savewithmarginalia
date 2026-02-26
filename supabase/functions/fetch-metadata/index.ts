import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function isTwitterUrl(url: string): boolean {
    return /^https?:\/\/(www\.)?(twitter\.com|x\.com)\//i.test(url);
}

function isLinkedInUrl(url: string): boolean {
    return /^https?:\/\/(www\.)?linkedin\.com\//i.test(url);
}

/** Extract og:image and og:description using regex — fast, no DOM parser needed */
function extractOgMeta(html: string): { image: string | null; description: string | null } {
    const imgMatch =
        html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
        html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);

    const descMatch =
        html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i) ||
        html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);

    return {
        image: imgMatch?.[1]?.trim() ?? null,
        description: descMatch?.[1]
            ? descMatch[1].trim().replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
            : null,
    };
}

function estimateReadingTime(text: string | null): number | null {
    if (!text || text.trim().length === 0) return null;
    const words = text.trim().split(/\s+/).length;
    return Math.max(1, Math.ceil(words / 200));
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { article_id } = await req.json();
        if (!article_id) {
            return new Response(JSON.stringify({ error: "article_id required" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const authHeader = req.headers.get("Authorization");
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

        const client = createClient(supabaseUrl, serviceKey, {
            global: { headers: { Authorization: authHeader! } },
        });

        const { data: { user } } = await client.auth.getUser();
        if (!user) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const { data: article, error: fetchErr } = await client
            .from("articles")
            .select("id, url, content_text")
            .eq("id", article_id)
            .eq("user_id", user.id)
            .single();

        if (fetchErr || !article) {
            return new Response(JSON.stringify({ error: "Article not found" }), {
                status: 404,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const articleUrl: string = article.url;

        // ─── Twitter/X and LinkedIn: skip image fetch entirely ───
        if (isTwitterUrl(articleUrl) || isLinkedInUrl(articleUrl)) {
            return new Response(JSON.stringify({ success: true, skipped: true }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // ─── Standard articles: fetch OG tags with a 2s timeout ───
        let ogImage: string | null = null;
        let ogDescription: string | null = null;

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 2000);

            const resp = await fetch(articleUrl, {
                headers: {
                    "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.5",
                },
                signal: controller.signal,
            });
            clearTimeout(timeout);

            if (resp.ok) {
                // Only read up to first 50KB — enough to contain <head> with OG tags
                const reader = resp.body?.getReader();
                let html = "";
                let totalBytes = 0;
                const maxBytes = 50 * 1024;

                if (reader) {
                    const decoder = new TextDecoder();
                    while (totalBytes < maxBytes) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        html += decoder.decode(value, { stream: true });
                        totalBytes += value.byteLength;
                    }
                    reader.cancel();
                }

                const extracted = extractOgMeta(html);
                ogImage = extracted.image;
                ogDescription = extracted.description;
            }
        } catch (_err) {
            // Timeout or network error — gracefully fall back to null values
            console.error("fetch-metadata: fetch failed for", articleUrl, _err);
        }

        // ─── Estimate reading time ───
        // Prefer content_text from DB (set by parse-article); fall back to ogDescription
        const readingTime = estimateReadingTime(article.content_text) ?? estimateReadingTime(ogDescription);

        // ─── Persist to DB ───
        const updates: Record<string, unknown> = {
            og_image: ogImage,
            og_description: ogDescription,
            reading_time_minutes: readingTime,
        };

        const { error: updateErr } = await client
            .from("articles")
            .update(updates)
            .eq("id", article_id)
            .eq("user_id", user.id);

        if (updateErr) {
            console.error("fetch-metadata: update error", updateErr);
        }

        return new Response(
            JSON.stringify({ success: true, og_image: ogImage, og_description: ogDescription, reading_time_minutes: readingTime }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    } catch (err) {
        console.error("fetch-metadata: unhandled error", err);
        return new Response(JSON.stringify({ error: (err as Error).message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
