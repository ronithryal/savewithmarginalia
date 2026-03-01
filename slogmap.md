# Slogmap — 4–5 Hour Sprint
*Current time: [Day 2]. Focus: AI, Inference, and Executive Context.*
*AGENTS.md and ROADMAP.md unchanged — this file drives the immediate sprint.*

---

## What we're skipping entirely tonight
- All Phase 4.5 infra (domain, Cloudflare, Sentry, PostHog, Redis) — zero product value for a solo sprint
- LinkedIn import — deferred by design
- Weekly email digest (needs Resend account setup, not code-bound)
- Phase 8 UX polish — nice-to-have, not tonight
- Phase 9 social/sharing — needs users first
- Phase 9.5 ambient capture — roadmap only
- Phase 10 mobile / 10.5 PDF / 11 monetization — weeks away

---

## The Sprint (in order)

### ① Google OAuth — *15 min* ✅ easy
> Supabase Dashboard → Auth → Providers → Google → paste client ID + secret.
> Zero code. Ship it first, unlocks cleaner onboarding for every feature after.

---

### ② X Bookmarks Import — *~1 hr*
**What to build:**
- `supabase/functions/x-import/index.ts` — OAuth 2.0 PKCE, calls `GET /2/users/:id/bookmarks`, runs through existing `fetch-metadata → suggest-tags → insert article` pipeline
- Settings UI card: "Connect X" button, stored access token in `user_preferences`
- Supabase cron every 15 min

**Skip:** source badges for now — adds noise without adding articles. Come back to badges in 1 pass after all imports work.

---

### ③ Sonar Discovery Engine — *~1 hr* ✅
**What we've done:**
- Perplexity Sonar API call in edge function `supabase/functions/sonar-discover` ✅
- **Discover Tab Expansion**: Refactor the "Trending" section in `Discover.tsx` to use the `sonar-discover` function ✅

**Remaining work:**
- **AI Insight Audit**: Review inputs/methodologies of the Sonar discovery engine.
- Surface as a "Find more →" button on `/tags/:slug` tag pages as a direct trigger.
- Modal to display results with "Why suggested" label.

**Skip:** tag-weighted RSS ranking and "Trending by topic" for now.

---

### ④ pgvector RAG Upgrade — *~1 hr* ✅
- [x] Enable `pgvector` in Supabase.
- [x] Create `content_embeddings` table and `match_content_embeddings` RPC.
- [x] Deploy `generate-embedding` (support for Webhooks and explicit UI calls) ✅
- [x] Resolution of 429 errors (OpenAI billing vs rate limits) ✅
- [x] Implementation of sequential, rate-limited Sync Button in UI ✅
- [x] Backfill of historical library into Vector DB ✅
- [x] Implementation of RAG similarity threshold (>0.5) to prevent hallucinated analogies ✅
- [x] Sonar Web Search fallback for unanswerable queries ✅

**Remaining work:**
- [ ] Move background backfill to "On Login" silent process as planned.

---

### ⑤ Strategic Brief Generator — *~1 hr*
**What to build:**
- **Brief Logic**: Create a mode in `/chat` or a new edge function that synthesizes saved content (from RAG) into a high-level "Strategic Brief".
- **Synthesis**: Uses Claude 3.5 to group items by "Insight", "Risk", and "Action Item".
- **Clipboard Export**: Copy formatted MD to clipboard (reusing the logic intended for NotebookLM, but for general executive use).

**High-leverage output**: This provides immediate value for founders and PMs regardless of their target tool.

---

### ⑥ MCP & Reasoning (Claude 3.5) — *~1.5 hr* 🏃
**What we've done:**
- **Reasoning Function**: `supabase/functions/reasoning` using Claude 3.5 Sonnet ✅ (Deployed)
- **Inference Layer**: Unified RAG spine used by both Chat and Reasoning functions.
- **MCP Server**: Added `search` (semantic) tool to `supabase/functions/mcp/index.ts` ✅

**Remaining work:**
- [ ] UI Trigger: Add "Generate Strategic Brief" button to Tags detail view (Prompt Prepared).
- [ ] **X Integration**: Implement X Bookmark Sync & Sonar-X Search augmentation.
- [ ] Mem0 Integration: Deploy memory persisting user facts (Backend Ready).

---

---

### ⑦ Phase 8 — Core UX Polish — *~1 hr*
- Inline quote highlighting in `/articles/:id` — select text → "Save Quote" toolbar
- AI auto-suggested quotes on article open (dismissible strip)
- Share-native output via `navigator.share()` on QuoteCard/ArticleCard
- Full sanitized HTML reader view with highlighted saved quotes

---

### ⑧ Phase 8.5 — Developer Platform & MCP — *~1 hr*
- Scoped per-user API keys (read/write `articles`, `quotes`, `tags`, `chat_sessions`)
- Event webhooks: on new article / quote / tag
- Marginalia MCP server: `listTags`, `listArticlesByTag`, `listQuotesByTag`, `getThreadBySessionId`
- Minimal API docs + Node/Python example scripts

---

### ⑨ Weekly "What I Learned" Digest (from Phase 9.5) — *~45 min*
- Supabase cron (Monday 8am) — collects past week's saves grouped by tag
- Generates tag-organized summary via AI
- **Resend** for email delivery (Marginalia-styled HTML template)
- Output format compatible with NotebookLM export

---

### ⑩ Phase 10.5 — PDF + Google Workspace — *~1.5 hr*
- `supabase/functions/process-pdf` — layout-aware text extraction, page coordinates
- Reader view: PDF viewer + inline quote selection
- Google Drive folder sync — OAuth, auto-process PDFs dropped in "Marginalia" folder
- Gmail / Google Chat bridge *(stretch goal only)*

---

## Priority order if time runs out
① Google OAuth → ③ Sonar → ④ RAG → ⑤ Strategic Brief → ⑥ MCP/Reasoning → ⑦ Mem0 → ② X Import → ⑨ Digest → ⑩ PDF

*(Core intelligence features first, platform + integrations after)*

---

## Agent Guidelines

Rules for all sprint work tonight. Every task must follow these.

- **Threads = `chat_sessions` + `chat_session_tags` only.** Do NOT touch the `threads` or `thread_items` tables — they are unused placeholders.
- **All Supabase queries must be RLS-safe.** Always include `.eq('user_id', user.id)` or equivalent. No unscoped queries.
- **Never edit existing migrations.** Schema changes go in a new file: `supabase/migrations/<timestamp>_<name>.sql`.
- **Preserve existing routes and nav.** Do not add new routes unless the task explicitly requires it.
- **Do not introduce new npm/bun packages** without confirming compatibility with the Vite + Bun setup.
- **Respect design system.** Use existing shadcn/ui components and Tailwind tokens — no new UI libraries.
- **Sprint priority order:** ③ Sonar → ④ RAG → ⑤ Strategic Brief → ⑥ MCP/Reasoning → ⑦ Mem0 → ② X Import → ⑨ Digest → ⑩ PDF. Do not start a lower-priority item if a higher-priority one is incomplete.
- **Skip entirely tonight:** domain purchase, Cloudflare, PostHog, Sentry, Upstash, LinkedIn import, Phase 9 social/sharing, Phase 9.5 ambient capture (except weekly digest), Phase 10 mobile, Phase 11 monetization.

