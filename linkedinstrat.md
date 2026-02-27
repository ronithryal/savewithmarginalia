# LinkedIn Import Strategy

Here's the full retrofit of the LinkedIn Comment Manager pattern for Marginalia's use cases.

## The core insight

Their pattern: poll LinkedIn's internal API with `li_at` session cookie → deduplicate with SQLite → webhook → AI action.

Your adaptation: poll LinkedIn's **saved posts** endpoint (same cookie, different endpoint) → deduplicate → POST to a new Supabase edge function → article lands in Marginalia with metadata fetched + tags auto-suggested.

***

## Architecture

### Python polling script (`scripts/linkedin_import.py`)

```python
import requests, sqlite3, time, os
from dotenv import load_dotenv

load_dotenv()
LI_AT = os.getenv("LI_AT")
WEBHOOK_URL = os.getenv("MARGINALIA_WEBHOOK_URL")

headers = {
    "Cookie": f"li_at={LI_AT}",
    "User-Agent": "Mozilla/5.0...",
    "Csrf-Token": "ajax:...",
}

def fetch_saved_posts():
    r = requests.get(
        "https://www.linkedin.com/voyager/api/feed/savedArticles",
        headers=headers,
        params={"count": 20, "start": 0}
    )
    return r.json().get("elements", [])

def run():
    db = sqlite3.connect("seen.db")
    db.execute("CREATE TABLE IF NOT EXISTS seen (url TEXT PRIMARY KEY)")
    while True:
        for post in fetch_saved_posts():
            url = extract_url(post)
            if url and not already_imported(url, db):
                requests.post(WEBHOOK_URL, json={"url": url, "title": post.get("title", ""), "source": "linkedin"})
                mark_imported(url, db)
        time.sleep(120)

run()
```

The `li_at` cookie auth, SQLite deduplication, and polling loop are nearly identical to the Comment Manager — you're just changing the endpoint and payload shape.

### Supabase edge function (`linkedin-import`)

Reuses your existing pipeline — `fetch-metadata` + `suggest-tags` are already built:

```typescript
Deno.serve(async (req) => {
  const { url, title } = await req.json();
  const metadata = await fetchMetadata(url);       // already exists
  const tags = await suggestTags(metadata.content); // already exists
  const article = await supabase.from("articles").insert({
    url, title: metadata.title || title,
    og_image: metadata.og_image,
    source_domain: "linkedin.com",
    ...
  }).select().single();
  await applyTags(article.id, tags);
  return new Response(JSON.stringify({ ok: true }));
});
```

### Settings UI addition

Add a "LinkedIn Import" card to `/settings`:
- Instructions: Chrome DevTools → Application → Cookies → `li_at`
- Store `li_at` in `user_preferences` (encrypted)
- Show generated webhook URL with user-specific token
- "Download import script (.py)" button — serves the Python script from the repo
- "Test connection" button — validates the cookie is still alive

***

## Discover page upgrade

Once LI posts flow in:
1. **"From your LinkedIn saves"** section in `/discover` — recently imported posts not yet read
2. **Source badges** on article cards — `in` icon for LinkedIn, `𝕏` for X, feed icon for RSS
3. **Cross-pollinate with Sonar**: "You saved 3 posts about #ai-agents from LinkedIn this week — here's what else is being written about it"

***

## All import paths unified

| Source | Method | Auth | Polling |
|---|---|---|---|
| Any URL | Paste / bookmarklet | None | On-demand |
| LinkedIn saved posts | Session cookie polling | `li_at` cookie | Local Python, every 2 min |
| X bookmarks | OAuth 2.0 PKCE | X API v2 | Supabase cron, every 15 min |
| RSS feeds | Favorite Creators in Settings | None | Supabase cron, every hour |

All four converge at the same edge function pipeline: `fetch-metadata → suggest-tags → insert article`.

***

## Build order (all ~1 hour of Antigravity work)

1. **Edge function** — `supabase/functions/linkedin-import/index.ts` accepting `{ url, title }` with user token, running through existing pipeline
2. **Python script** — `scripts/linkedin_import.py` committed to repo so users can download it from Settings
3. **Settings UI** — LinkedIn Import section with webhook URL, download link, DevTools instructions

This is the most direct port of the LinkedIn Comment Manager pattern to Marginalia.
