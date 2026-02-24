import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface RedditPost {
  title: string;
  url: string;
  score: number;
  subreddit: string;
  created_utc: number;
  permalink: string;
  selftext: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { subreddits } = await req.json() as { subreddits: string[] };
    if (!subreddits || subreddits.length === 0) {
      return new Response(JSON.stringify([]), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const results: RedditPost[] = [];

    await Promise.all(
      subreddits.map(async (sub) => {
        try {
          const res = await fetch(
            `https://www.reddit.com/r/${encodeURIComponent(sub)}/top.json?limit=10&t=week`,
            { headers: { 'User-Agent': 'Marginalia/1.0' } }
          );
          if (!res.ok) { await res.text(); return; }
          const json = await res.json();
          const children = json?.data?.children ?? [];

          let count = 0;
          for (const child of children) {
            if (count >= 3) break;
            const d = child.data;
            if (!d) continue;

            let url = d.url || '';
            const isRedditSelf = url.includes('reddit.com/r/');
            const isSelfText = (d.selftext || '').length > 300;

            // Skip reddit self-links unless substantive text post
            if (isRedditSelf && !isSelfText) continue;
            if (isRedditSelf && isSelfText) {
              url = `https://reddit.com${d.permalink}`;
            }

            // Skip direct images
            const lower = url.toLowerCase();
            if (imageExts.some(ext => lower.endsWith(ext))) continue;

            // Skip youtube
            try {
              const host = new URL(url).hostname.replace('www.', '');
              if (host === 'youtube.com' || host === 'youtu.be') continue;
            } catch { continue; }

            results.push({
              title: d.title || 'Untitled',
              url,
              score: d.score || 0,
              subreddit: d.subreddit || sub,
              created_utc: d.created_utc || 0,
              permalink: d.permalink || '',
              selftext: '',
            });
            count++;
          }
        } catch {
          // skip failed subreddit
        }
      })
    );

    // Max 6 total
    const final = results.slice(0, 6);

    return new Response(JSON.stringify(final), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
