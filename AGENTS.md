# Marginalia — Agent Context

## Project Overview
Marginalia (repo: savewithmarginalia) is a personal article and quote keeper built with React + TypeScript + Vite + Tailwind + shadcn/ui, hosted on Lovable (readmargin.lovable.app) with Supabase for database, auth, and edge functions. It’s evolving into an executive intelligence engine — a quote‑centric knowledge graph and agent‑ready context layer for Claude, GPT, and other tools — designed to accelerate high‑leverage workflows like synthesizing product vision, conducting research, and drafting executive briefings and materials.

**Frozen backup:** `ronithryal/marginalia-stable` — do not touch.

## Tech Stack

### Currently in use (via Lovable)
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend:** Supabase (PostgreSQL + RLS + Auth + Edge Functions)
- **Hosting:** Lovable → auto-deploys from GitHub. Handles hosting, Supabase project,
  domain proxy, and 2-way git sync. **Stay on Lovable through Phase 8** — it removes
  significant operational overhead while building solo. **Migrate to Vercel in Phase 9**
  when you need CI/CD, PR previews, and full infra control.
- **AI:** Gemini Flash via Supabase edge functions (chat); OpenAI text-embedding-3-small (RAG), Claude 3.x (for reasoning and structured analysis), and a memory provider like Mem0 (planned)

### Introduced through the roadmap
| Tool | Phase | Role |
|---|---|---|
| **Cloudflare** | 4 | DNS + CDN + DDoS after buying domain |
| **PostHog** | 4 | Product analytics — track saves, searches, chat starts |
| **Sentry** | 4 | Error tracking, especially for import edge functions |
| **Upstash Redis** | 4–5 | Rate-limit import webhooks; cache Discover feed |
| **Resend** | 7 | Email delivery for weekly digest |
| **Pinecone** | 6 | Managed vector DB (alternative to pgvector if scale demands) |
| **Vercel** | 9 | Replace Lovable hosting — CI/CD, preview deploys, edge config |
| **Clerk** | 11 | Replace Supabase Auth only when teams/org SSO needed; Google OAuth via Supabase first |
| **Stripe** | 11 | Payments — subscriptions + usage-based billing |

## Repository Structure
```
src/
  pages/          # Route-level components (Home, Articles, Quotes, Tags, TagDetail,
  |               # Chat, Discover, Settings, Search, Future, ThreadDetail)
  components/     # Reusable UI components (ArticleCard, QuoteCard, ThreadCard, ...)
  hooks/          # Custom React hooks
  integrations/   # Supabase client and types
supabase/
  functions/      # Edge functions: parse-article, bookmarklet-save, suggest-tags,
  |               # chat, discover, fetch-metadata, linkedin-import (planned)
  migrations/     # SQL migration files — always add a new timestamped file, never
  |               # edit existing ones
scripts/          # Standalone helper scripts (e.g. linkedin_import.py, x_import.py)
public/           # Static assets
```

## Database Schema (Supabase)
Key tables:
- `articles` — id, user_id, url, title, source_domain, preview_image_url, content_text,
  created_at, last_opened_at, og_image, og_description, reading_time_minutes
- `quotes` — user-extracted quotes linked to articles
- `tags` — user-defined tags
- `article_tags` — many-to-many join between articles and tags
- `quote_tags` — many-to-many join between quotes and tags
- `chat_sessions` — AI chat sessions (id, user_id, title, updated_at)
- `chat_session_tags` — links chat sessions to tags (this IS what "Threads" means — see below)
- `chat_messages` — messages within chat sessions
- `user_feeds` — RSS feed sources added in Settings > Favorite Creators
- `user_preferences` — per-user feature toggles and stored credentials (encrypted)
- `threads` — currently unused placeholder, do not use
- `thread_items` — currently unused placeholder, do not use

All tables use Row Level Security (RLS) scoped to `auth.uid()`.

## "Threads" Definition (critical)
Threads are NOT a separate data type. A Thread = a `chat_session` that was
auto-created when the user pressed the AI/explain button on an article or quote card.

When AI button is pressed on a card:
1. Create a new `chat_sessions` row (title = article/quote title, user_id = current user)
2. For each tag on that article/quote, insert a row into `chat_session_tags`
3. Navigate to `/chat?session=<id>`

The Threads filter on `/tags/:slug` queries `chat_session_tags` → `chat_sessions` for
that tag. ThreadCards link back to `/chat?session=<id>`. No manual thread creation.

## Environment Variables
Required in `.env.local`:
```
VITE_SUPABASE_URL=<from Lovable Cloud > Overview>
VITE_SUPABASE_ANON_KEY=<from Lovable Cloud > Overview>
```

## Development Rules
- **Do not break existing Supabase schema** without a migration file in `supabase/migrations/`
- **Do not change the Lovable-managed `.env` file** — use `.env.local` for local dev
- **Preserve existing routes and nav structure** unless explicitly asked to change
- **Mobile-first:** all new UI must be responsive; test at 375px and 1280px
- **Design system:** shadcn/ui + existing Tailwind config only — no new UI libraries
- **No new npm packages** without confirming compatibility with Vite + Bun
- Commit messages must be clear and imperative ("Add LinkedIn import edge function")
- All Supabase queries must include `.eq('user_id', user.id)` or RLS-safe equivalent

## Current App Pages
| Route | Description |
|---|---|
| `/` | Home — URL input, recent saves, "What is Marginalia" copy |
| `/articles` | Article library — og:image, og:description, reading time badge |
| `/articles/:id` | Article reader view |
| `/quotes` | All saved quotes — edit, AI explain, delete, "View in article →" |
| `/tags` | Tag browser with article + quote + thread counts |
| `/tags/:slug` | Tag detail — filter pills: All / Articles / Quotes / Threads |
| `/chat` | AI chat scoped to saved content (Gemini Flash, keyword retrieval, citations) |
| `/discover` | RSS-powered discovery feed with "Add" button |
| `/settings` | AI toggles, Favorite Creators (RSS/X handles), Bookmarklet, PWA instructions |
| `/search` | Full-text search across articles and quotes |
| `/threads/:id` | Thread detail (placeholder — to be refactored or removed) |
| `/future` | Marketing/roadmap page with framer-motion scroll animations |

---

## Active Roadmap (implement in order)

### Phase 1 — Mobile Polish & Core UX ✅
- Mobile hamburger sidebar menu
- Card hover element contrast improvements
- Threads — AI conversations organized by tag

### Phase 2 — AI Enrichment ✅
- Auto-summarization on article save
- AI-suggested tags on save
- Quote highlighting in reader view

### Phase 3 — Threads Rewire ✅
Threads are the backbone of Marginalia's AI-native context graph, not a standalone feature.
Every Thread = a `chat_session` scoped to a tag, auto-created when the AI button is used on
a card. Later phases (8.5, MCP) expose these threads to external agents (Claude, GPT) so
users can say: "Use my #ai-agents threads as context." Build the data model right now.

- **ArticleCard.tsx**: AI button → create `chat_sessions` row → insert `chat_session_tags`
  for each of the article's tags → navigate to `/chat?session=<id>`
- **QuoteCard.tsx**: same, join through `quotes.article_id → article_tags` for tags
- **TagDetail.tsx**: Threads filter queries `chat_session_tags → chat_sessions` for
  that tag (no `is_bookmarked` filter). Render as ThreadCards. Remove "New Thread" button.
- **ThreadCard.tsx**: props = `{ id, title, messageCount, updatedAt, onClick }`.
  Shows title, "N messages", last active date. Same card style as ArticleCard.
- **Tags.tsx**: thread count = `count(chat_session_tags)` grouped by tag_id

---

### Phase 4 — Import Pipeline

All imports converge at the same edge function pipeline: `fetch-metadata → suggest-tags → insert article`.

- **Google OAuth** — enable Google Sign-In via Supabase Auth dashboard (zero code changes)
- X import: `supabase/functions/x-import` (OAuth 2.0 PKCE) + Settings UI + cron every 15 min
- Share quote/article to X via `navigator.share()` or intent/tweet deep link
- Wire `user_feeds` to /discover edge function (hourly RSS cron)
- Source badges on cards (LinkedIn, X, RSS, favicon)

---

### Phase 4.5 — Infrastructure & Ops

*Defer until imports are live and you have real users. Lovable handles domain + analytics in the interim.*

- **Buy a domain** (e.g. readmarginalia.com) — Lovable's `readmargin.lovable.app` is fine until then
- **Cloudflare** — point DNS, CDN + DDoS protection
- **PostHog** — product analytics (Lovable has built-in analytics until you need custom funnels)
- **Sentry** — error tracking for edge functions
- **Upstash Redis** — rate-limit import webhooks; cache Discover feed
- **LinkedIn import** — `scripts/linkedin_import.py` + `supabase/functions/linkedin-import`
  (deferred: cookie-based scraping risk; revisit when X import is stable)
  → See **`linkedinstrat.md`** for architecture

---

### Phase 5 — Discover Personalization + Sonar API

- **Tag-weighted RSS filtering**: rank /discover feed items by overlap with user's
  saved tags — items matching frequent tags bubble up
- **"Trending by topic"** section: group discover feed by user's tag vocabulary
- **Sonar API (Perplexity) integration**: on-demand open-web discovery.
  Entry point: "Find more like this" button on /discover items and on tag pages.
  Flow: user's tag + recent saves → Sonar API search → results re-ranked by
  cosine similarity to user's saved content → show 3-5 with "why suggested" label
  (e.g. "matches your #ai-agents saves"). Store Sonar API key in Supabase secrets.
- **"From your LinkedIn/X saves"** section in /discover: recently imported posts
  not yet deeply read/tagged, surfaced for re-engagement

---

### Phase 6 — Vector Embeddings + RAG Chat Upgrade

Upgrade `/chat` from keyword retrieval to true semantic search (RAG). This layer is
designed to be agent-ready: once embeddings exist, external agents (Claude, GPT) can
query a user's Marginalia library via MCP (Phase 8.5) with proper citations and retrieval.

- **New migration**: enable `pgvector` extension, add `content_embeddings` table:
  `(id, user_id, content_type ['article'|'quote'], content_id, embedding vector(1536))`
  — or use **Pinecone** as a managed alternative if pgvector hits scale limits
- **On article/quote save**: generate embedding via OpenAI `text-embedding-3-small`
  → store in `content_embeddings`
- **Chat edge function upgrade**: embed user query → cosine similarity search
  → retrieve top-N quotes/articles as RAG context → Gemini Flash with citations
- **Search upgrade**: hybrid keyword (`tsvector`) + semantic (pgvector) search.
  Results grouped by type — Quotes first, then Articles.
- **Agent-ready design**: retrieval functions built as clean, reusable modules so
  Phase 8.5 MCP server can call them directly without duplicating logic.
- **Memory-ready design**: this RAG layer is designed so an external memory service like Mem0 can sit on top of the same embeddings/retrieval functions, providing persistent user facts and judgment across sessions.

---

### Phase 7 — NotebookLM Integration + Email Digest

NotebookLM is a bridge, not a competitor: Marginalia is the ingestion and structuring
layer; NotebookLM is one of the destinations where users do deep synthesis. The export
format established here also feeds the weekly digest and future MCP tool outputs.

- "Export to NotebookLM" button on /tags/:slug — structured markdown formatter
- Audio Overview callout after export
- Weekly digest Supabase cron (Monday 8am user timezone)
- **Resend** — transactional email for weekly digest (Marginalia-styled HTML template)
- Digest format compatible with NotebookLM export and MCP tool responses

---

### Phase 8 — Core UX Polish

- **Inline quote highlighting**: in `/articles/:id` reader, select text →
  inline toolbar appears → "Save Quote" — no copy-paste required
- **AI auto-suggested quotes**: on first open of article, call AI: "Identify 3-5
  key quotes from this article" → show as dismissible suggestion strip the user
  can accept with one click
- **Share-native quote output**: `navigator.share()` on QuoteCard and ArticleCard
  with WhatsApp/SMS/X-formatted text: `"[quote]" — [title] [url]`
- **Article reader view**: full reading mode in `/articles/:id` with sanitized
  HTML rendering and highlighted saved quotes shown inline

---

### Phase 8.5 — Developer Platform & MCP

Marginalia becomes a first-class tool for AI agents. Users can say:
"Use my Marginalia #ai-agents library as context" in Claude or any MCP-compatible client.

- **Public API keys (per user)**
  - Scoped API keys allowing programmatic read/write of `articles`, `quotes`, `tags`,
    `chat_sessions` (RLS-safe, user_id-scoped). Basic rate limiting via Upstash Redis.

- **Webhooks for automation**
  - Event webhooks: "on new article", "on new quote", "on new tag".
  - Users point these at Zapier/n8n/custom servers to sync into Notion, Obsidian, etc.

- **Marginalia MCP server**
  - Model Context Protocol server exposing:
    `listTags`, `listArticlesByTag`, `listQuotesByTag`, `getThreadBySessionId`.
  - Goal: Claude/GPT-style agents can use Marginalia as a first-class knowledge tool.
  - Calls the same retrieval modules built in Phase 6 — no duplicated logic.

- **API docs & examples**
  - Minimal docs + example scripts (Node/Python):
    - "Save a new article via API"
    - "Query my top quotes for a tag and pass them to an AI agent"

---

### Phase 9 — Social / Sharing + Infrastructure Graduation

- Public profile page `/u/:username` — shared articles and threads (opt-in)
- Share chat threads as read-only public links (`/threads/share/:token`)
- Export tag to Markdown or Notion (extend the NotebookLM exporter)
- Browser extension (beyond bookmarklet) — one-click save with tag suggestions in popup
- **Migrate from Lovable → Vercel**: hosting, CI/CD, PR previews, edge config.
  Supabase stays as DB. Cloudflare stays in front for DNS/CDN.
  Move when: real user SLAs needed, Lovable cost > value, need full infra control.

---

### Phase 9.5 — Ambient Capture & Private Inference

*Roadmap intent only — no immediate implementation. Establishes direction and constraints.*

- **Chromium extension (Marginalia Sentinel)**
  - Chrome/Edge/Brave extension that listens to tab updates (explicit user opt-in).
  - Detects article-like pages (blogs, research, long-form) and offers one-click save
    or auto-save rules (e.g., "auto-save pages I spend >2 min on").
  - Local heuristics / lightweight on-device embeddings to filter junk pages.

- **Privacy-first processing**
  - Design assumes some users won't want raw browsing history leaving their device.
  - Long-term: private inference stack (e.g., TEE-based) so sensitive data can be
    analyzed in secure enclaves without Marginalia seeing plaintext.

- **Weekly "What I learned" digest (from ambient capture)**
  - Ambiently captured articles + quotes from the past week.
  - Tag-organized summary of what the user actually read and thought about.
  - Output format compatible with NotebookLM export.

### Phase 10 — Mobile App

- iOS/Android PWA with `manifest.json` and service worker (already partially set up)
- Share sheet integration — save from any app on mobile using the Web Share Target API
- Push notifications for weekly digest delivery

---

### Phase 10.5 — Institutional Ingestion (PDF + Google Workspace)

Enterprise-friendly ingestion: pitch decks, research PDFs, audit documents. V1 scope
is intentionally minimal — Drive folder sync + PDF pipeline only.

- **PDF ingestion pipeline** — `supabase/functions/process-pdf`:
  - Accepts PDF URL or uploaded file reference.
  - Extracts text layout-aware (headings, paragraphs, tables).
  - Stores in `articles.content_text` + JSON metadata (page numbers, table structure).
  - Reader view uses PDF viewer with inline quote selection tied to page coordinates.

- **Google Drive folder sync** (OAuth-based):
  - User connects Google account in Settings.
  - Marginalia watches a designated "Marginalia" Drive folder.
  - New PDFs auto-processed via `process-pdf`, inserted as articles with
    `source_domain = 'drive.google.com'`.

- **Gmail / Google Chat bridge** *(future, not v1)*:
  - Optional: connect Gmail to pull starred/labeled links into Marginalia.
  - Long-term: "Marginalia" Google Chat bot that lets users query their library
    from inside Google Workspace.
  - All OAuth, encrypted tokens, explicit user consent model.

---

### Phase 11 — Monetization & Scale

- **Choose and integrate payments processor** (Stripe recommended — recurring
  subscriptions + usage-based billing via metered add-ons)
- Paid plans: storage limits, AI quota per month, Sonar API calls per month
- **Clerk** — replace Supabase Auth only when org/team SSO and org-switching are needed
  (Google OAuth via Supabase covers everything before that)
- API access for power users (build on existing edge function contracts)
- Referral / invite system

#### Enterprise & Teams
- **Teams & shared workspaces**: organizations, members, shared tag libraries.
  Shared Threads and tags for investment/research teams.
- **Cursor for PMs**: Ingests interviews, community feedback (Discord/X), and analytics (PostHog) to synthesize "what to build next" into agent-ready specs for coding agents.
- **Enterprise controls**: SSO/SAML, audit logs, data residency options, explicit
  policy of not training models on customer data.
- **Positioning**: Marginalia as a **context layer** for agents and knowledge workers —
  personal libraries, team libraries, and external agents (MCP) all built on the same
  Supabase/Postgres + pgvector spine.

---

### Phase 12 — Active Memory & Executive Intelligence

- **Weekly AI review sessions** to extract tacit knowledge and unwritten heuristics from the user.
- **Persistent Memory Integration** with a provider like Mem0 to store preferences, judgments, and recurring conclusions across sessions.
- **Strategic Brief generator**: Combines quotes, external sentiment (X/Discord), and analytics for any given tag.
- **"What would I do?" proxy**: Long-term goal of Marginalia acting as a trusted proxy for the user's executive decision making.

---

## Key External APIs
| API | Use case | Auth |
|---|---|---|
| Perplexity Sonar | Open-web discovery ranked by tag graph | API key → Supabase secrets |
| OpenAI Embeddings | `text-embedding-3-small` for pgvector RAG | API key → Supabase secrets |
| Gemini Flash | Chat (already live) | API key → Supabase secrets |
| X API v2 | Bookmark import, X feed in Discover, thread import | OAuth 2.0 PKCE |

## Agent Instructions
- Before making changes, read the relevant page component and any hooks it uses
- Prefer editing existing components over creating new ones
- After making changes, verify the UI renders correctly at mobile (375px) and desktop (1280px)
- Do not modify `supabase/functions/` edge functions without understanding the existing request/response contract
- When adding new Supabase queries, always include `.eq('user_id', user.id)` or equivalent RLS-safe filter
- New features should be designed so they can also be exposed as tools to external agents (via MCP/public API), with logic factored into reusable functions
- Reusable insights (like recurring conclusions and preferences) should be stored in a memory-friendly structure linked to tags/IDs so they can be synced to a dedicated memory service later
