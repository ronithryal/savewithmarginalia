# Marginalia — Roadmap

## Phase 1 — Mobile Polish & Core UX ✅
- [x] Mobile hamburger sidebar menu
- [x] Card hover element contrast improvements
- [x] Threads — AI conversations organized by tag

## Phase 2 — AI Enrichment ✅
- [x] Auto-summarization on article save
- [x] AI-suggested tags on save
- [x] Quote highlighting in reader view

## Phase 3 — Threads Rewire ✅
*Threads = backbone of Marginalia's AI-native context graph. Later exposed to external agents via MCP (Phase 8.5).*
- [x] ThreadCard updated to chat_session props (title, messageCount, updatedAt)
- [x] TagDetail threads query → chat_session_tags → chat_sessions
- [x] Clicking ThreadCard navigates to /chat with openSessionId
- [x] Tags.tsx thread count from chat_session_tags
- [x] Removed "New Thread" button — threads created automatically via AI button

## Phase 4 — Import Pipeline
- [ ] **Google OAuth** — enable Google Sign-In via Supabase Auth dashboard
- [ ] X import: `supabase/functions/x-import` (OAuth 2.0 PKCE) + Settings UI + cron
- [ ] Share quote/article to X (navigator.share + intent/tweet deep link)
- [ ] Wire user_feeds to /discover edge function (RSS cron, hourly)
- [ ] Source badges on cards (LinkedIn, X, RSS, favicon)

## Phase 4.5 — Infrastructure & Ops
*Defer until imports are live and you have real users. Lovable handles domain + analytics in the interim.*
- [ ] **Buy a domain** (readmarginalia.com or similar)
- [ ] **Cloudflare** — DNS, CDN, DDoS protection
- [ ] **PostHog** — product analytics (Lovable's built-in covers early days)
- [ ] **Sentry** — error tracking for edge functions
- [ ] **Upstash Redis** — rate-limit import webhooks, cache Discover feed
- [ ] **LinkedIn import** — deferred; cookie-based scraping risk (see `linkedinstrat.md` when ready)

## Phase 5 — Discover Personalization + Sonar API
- [ ] Tag-weighted RSS feed ranking in /discover
- [ ] "Trending by topic" section grouped by user tag vocabulary
- [ ] Sonar API (Perplexity) — "Find more like this" on /discover and tag pages
- [ ] "From your LinkedIn/X saves" re-engagement section in /discover

## Phase 6 — Vector Embeddings + RAG Chat Upgrade
*Agent-ready design: retrieval modules built to be called directly by Phase 8.5 MCP server.*
- [ ] Enable pgvector extension + content_embeddings migration (or **Pinecone** as managed alternative)
- [ ] Generate embeddings on article/quote save (OpenAI text-embedding-3-small)
- [ ] Upgrade chat edge function to cosine similarity RAG with citations
- [ ] Hybrid keyword + semantic search in /search

## Phase 7 — NotebookLM Integration + Email Digest
*NotebookLM is an export target, not a competitor. Marginalia = ingestion + structuring layer.*
- [ ] "Export to NotebookLM" button on /tags/:slug (structured markdown formatter)
- [ ] Audio Overview callout after export
- [ ] Weekly digest Supabase cron (Monday 8am)
- [ ] **Resend** — email delivery for weekly digest (Marginalia-styled HTML template)

## Phase 8 — Core UX Polish
- [ ] Inline quote highlighting — select text in article reader → "Save Quote" toolbar
- [ ] AI auto-suggested quotes on article open
- [ ] Share-native quote output via navigator.share()
- [ ] Full article reader view with sanitized HTML + highlighted quotes

## Phase 8.5 — Developer Platform & MCP
*Marginalia as a first-class tool for AI agents. "Use my #ai-agents library as context" in Claude.*
- [ ] Public API keys (per user) — scoped read/write, RLS-safe, rate-limited via Upstash
- [ ] Event webhooks — on new article / quote / tag → Zapier/n8n/Notion/Obsidian
- [ ] Marginalia MCP server — `listTags`, `listArticlesByTag`, `listQuotesByTag`, `getThreadBySessionId`
- [ ] API docs + example scripts (Node/Python)

## Phase 9 — Social / Sharing + Infrastructure Graduation
- [ ] Public profile page /u/:username (opt-in)
- [ ] Share chat threads as read-only public links
- [ ] Export tag to Markdown or Notion
- [ ] Browser extension with tag suggestions in popup
- [ ] **Migrate from Lovable → Vercel** (when SLAs needed, Lovable cost > value)

## Phase 9.5 — Ambient Capture & Private Inference
*Roadmap intent only — no immediate implementation.*
- [ ] Chromium extension (Marginalia Sentinel) — opt-in tab listening, auto-save rules
- [ ] Privacy-first pipeline design (no raw browsing data leaving device)
- [ ] Long-term: TEE-based private inference for sensitive browsing data
- [ ] Weekly "What I learned" digest from ambiently captured content

## Phase 10 — Mobile App
- [ ] iOS/Android PWA (manifest.json + service worker)
- [ ] Share sheet integration via Web Share Target API
- [ ] Push notifications for weekly digest

## Phase 10.5 — Institutional Ingestion (PDF + Google Workspace)
*V1 scope: Drive folder sync + PDF pipeline only.*
- [ ] `supabase/functions/process-pdf` — layout-aware text extraction, page coordinates
- [ ] Reader view: PDF viewer + inline quote selection tied to page coordinates
- [ ] Google Drive folder sync — OAuth, auto-process new PDFs dropped in "Marginalia" folder
- [ ] Gmail / Google Chat bridge *(future, not v1)*

## Phase 11 — Monetization & Scale
- [ ] **Choose and integrate payments processor** (Stripe — subscriptions + usage billing)
- [ ] Paid plans (storage limits, AI quota, Sonar API calls per month)
- [ ] **Clerk** — replace Supabase Auth only when org/team SSO needed (Google OAuth covers everything before)
- [ ] API access for power users
- [ ] Referral / invite system

### Enterprise & Teams
- [ ] Teams & shared workspaces — orgs, members, shared tag libraries, shared Threads
- [ ] Enterprise controls — SSO/SAML, audit logs, data residency, no-training policy
- [ ] **Positioning**: Marginalia as a context layer for agents and knowledge workers — personal libraries, team libraries, and external agents (MCP) on the same Postgres + pgvector spine
