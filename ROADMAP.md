# Marginalia — Roadmap

## Project Overview
Marginalia (repo: savewithmarginalia) is a personal article and quote keeper built with React + TypeScript + Vite + Tailwind + shadcn/ui, hosted on Lovable (savewithmarginalia.lovable.app) with Supabase for database, auth, and edge functions. It’s evolving into an executive intelligence engine — a quote‑centric knowledge graph and agent‑ready context layer for Claude, GPT, and other tools — designed to accelerate high‑leverage workflows like synthesizing product vision, conducting research, and drafting executive briefings. It achieves this by ingesting diverse data sources: from articles and quotes to enterprise telemetry (PostHog, Datadog, Amplitude) and customer sentiment (Intercom).

## Phase 1 — Mobile Polish & Core UX ✅
- [x] Mobile hamburger sidebar menu
- [x] Card hover element contrast improvements
- [x] Threads — AI conversations organized by tag

## Phase 2 — AI Enrichment ✅
- [x] Auto-summarization on article save
- [x] AI-suggested tags on save
- [x] Quote highlighting in reader view

## Phase 3 — Threads Rewire ✅
*Threads are the backbone of Marginalia's AI-native context graph, not a standalone feature. Later phases (8.5, MCP) expose these threads to external agents (Claude, GPT).*
- [x] **ArticleCard.tsx**: AI button → create `chat_sessions` row → navigate to chat
- [x] **TagDetail.tsx**: Threads filter queries `chat_session_tags` → `chat_sessions`
- [x] **ThreadCard.tsx**: shows title, "N messages", last active date
- [x] **Tags.tsx**: thread count = `count(chat_session_tags)` grouped by tag_id

## Phase 4 — Sign-In Upgrade
- [x] **Google OAuth** — enable Google Sign-In via Supabase Auth dashboard
- [/] X import: `supabase/functions/x-import` (OAuth 2.0 PKCE) + Settings UI + cron
- [ ] Share quote/article to X via `navigator.share()` or intent/tweet deep link
- [ ] Wire `user_feeds` to /discover edge function (hourly RSS cron)
- [ ] Source badges on cards (LinkedIn, X, RSS, favicon)

## Phase 4.5 — Infrastructure & Ops
*Defer until imports are live and real users acquired. Lovable handles domain + analytics in the interim.*
- [ ] **Buy a domain** (e.g. readmarginalia.com)
- [ ] **Cloudflare** — point DNS, CDN + DDoS protection
- [ ] **PostHog** — product analytics (Lovable has built-in analytics until you need custom funnels)
- [ ] **Sentry** — error tracking for edge functions
- [ ] **Upstash Redis** — rate-limit import webhooks; cache Discover feed
- [ ] **LinkedIn import** — `scripts/linkedin_import.py` + `supabase/functions/linkedin-import`

## Phase 5 — Discover Personalization + Sonar API
- [ ] Tag-weighted RSS filtering: rank /discover feed items by overlap with user's saved tags
- [ ] "Trending by topic" section: group discover feed by user's tag vocabulary
- [x] **Sonar API (Perplexity) integration**: on-demand open-web discovery
- [x] Entrance: Refactored Discover tab to use Sonar by default
- [x] Results ranked by similarity to user context
- [ ] "From your LinkedIn/X saves" section in /discover: recently imported posts not yet tagged

## Phase 6 — Vector Embeddings + RAG Chat Upgrade ✅
*Upgrade /chat from keyword retrieval to true semantic search (RAG). Agent-ready retrieval layer.*
- [x] **New migration**: enable `pgvector` extension, add `content_embeddings` table
- [x] **On article/quote save**: generate embedding via OpenAI `text-embedding-3-small`
- [x] Rate-limit aware sequential background processing
- [x] Auto-trigger on all UI save flows
- [x] **Chat edge function upgrade**: embed user query → cosine similarity search
- [ ] Search upgrade: hybrid keyword (`tsvector`) + semantic (pgvector) search
- [ ] Agent-ready design: retrieval functions built as clean, reusable modules
- [/] **Memory-ready design**: this RAG layer is designed for Mem0 (Backend deployed)

## Phase 7 — Executive Email Digest
- [ ] Weekly digest Supabase cron (Monday 8am user timezone) of saved items from prior week
- [ ] **Resend** — transactional email for weekly digest (Marginalia-styled HTML template)
- [ ] Digest format compatible with Strategic Briefs and MCP tool responses

## Phase 8 — Core UX Polish
- [ ] **Inline quote highlighting**: in reader, select text → inline toolbar appears → "Save Quote"
- [ ] **AI auto-suggested quotes**: call AI to identify 3-5 key quotes on article open
- [ ] **Share-native quote output**: `navigator.share()` with WhatsApp/SMS/X-formatted text
- [ ] **Article reader view**: full reading mode with sanitized HTML and highlighted quotes

## Phase 8.5 — Developer Platform & MCP
*Marginalia as a first-class tool for AI agents. "Use my #ai-agents library as context" in Claude.*
- [ ] **Public API keys (per user)**: scoped API keys allowing programmatic read/write
- [ ] **Webhooks for automation**: events for new article, quote, or tag
- [ ] **Marginalia MCP server**: `listTags`, `listArticlesByTag`, `listQuotesByTag`, `getThreadBySessionId`
- [ ] **API docs & examples**: minimal docs + example scripts (Node/Python)

## Phase 9 — Social / Sharing + Infrastructure Graduation
- [ ] Public profile page `/u/:username` — shared articles and threads (opt-in)
- [ ] Share chat threads as read-only public links (`/threads/share/:token`)
- [ ] Browser extension (beyond bookmarklet) — one-click save with tag suggestions in popup
- [ ] **Migrate from Lovable → Vercel**: hosting, CI/CD, PR previews, edge config

## Phase 9.5 — Ambient Capture & Private Inference
*Roadmap intent only — no immediate implementation.*
- [ ] **Chromium extension (Marginalia Sentinel)**: optional tab listening + auto-save rules
- [ ] **Privacy-first processing**: design so raw browsing history doesn't leave the device
- [ ] **Weekly "What I learned" digest**: ambiently captured articles + quotes from the past week

## Phase 10 — Mobile App
- [ ] iOS/Android PWA with `manifest.json` and service worker
- [ ] Share sheet integration — save from any app on mobile via Web Share Target API
- [ ] Push notifications for weekly digest delivery

## Phase 10.5 — Institutional Ingestion (PDF + Google Workspace)
*Enterprise-friendly ingestion. V1 scope: Drive folder sync + PDF pipeline only.*
- [ ] **PDF ingestion pipeline**: `supabase/functions/process-pdf` for layout-aware extraction
- [ ] **Reader view**: PDF viewer with inline quote selection tied to page coordinates
- [ ] **Google Drive folder sync**: automatic processing of PDFs in a "Marginalia" folder
- [ ] **SaaS Data Ingestion**: Connect PostHog, Datadog, Amplitude, and Intercom as context sources for PM/Exec synthesis
- [ ] **NotebookLM Export**: "Export to NotebookLM" button on /tags/:slug — structured markdown formatter
- [ ] **Audio Overview**: Callout after export for NotebookLM's audio synthesis
- [ ] Gmail / Google Chat bridge (future, not v1)

## Phase 11 — Monetization & Scale
- [ ] **Stripe Integration**: subscriptions + usage-based billing
- [ ] Paid plans: storage limits, AI quota per month, Sonar API calls per month
- [ ] **Clerk**: replace Supabase Auth when org/team SSO or org-switching is needed
- [ ] API access for power users
- [ ] Referral / invite system

### Enterprise & Teams
- [ ] Teams & shared workspaces — organizations, members, shared tag libraries
- [ ] **Cursor for PMs**: Ingests interviews, community feedback, product telemetry (PostHog, Amplitude), and service logs (Intercom) to synthesize "what to build next" into agent-ready specs
- [ ] Enterprise controls — SSO/SAML, audit logs, data residency, no-training policy

## Phase 12 — Active Memory & Executive Intelligence
- [ ] **Weekly AI review sessions** to extract tacit knowledge and heuristics
- [ ] **Persistent Memory Integration**: store preferences and judgments via Mem0
- [ ] **Strategic Brief generator**: combines quotes, sentiment (X), and analytics for a tag
- [ ] **"What would I do?" proxy**: Marginalia acting as a trusted proxy for decision making
