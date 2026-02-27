# Marginalia

**A personal knowledge layer for the age of AI agents.**

Marginalia lets you save articles and quotes, organize them by tag, and then *use* that knowledge — via AI chat grounded in your actual reading, a Perplexity-powered discovery feed ranked by your tag graph, and an MCP server that lets Claude and GPT treat your library as first-class context.

> Migrating from Lovable → Vercel + Supabase. See [Log](#log) for context.

---

## The Problem

Knowledge workers save things everywhere and use them nowhere. Pocket fills up. Notion becomes a graveyard. Highlights in Kindle never leave Kindle. The problem isn't saving — it's that saved content is never *connected* back to thinking.

AI chat tools like Claude and ChatGPT are only as good as their context. But your context — the 300 articles and 800 quotes that shaped your view on AI agents, or market structure, or whatever you actually care about — lives in your browser history, not in any prompt.

Marginalia solves the retrieval problem. It's the ingestion and structuring layer that makes your reading library usable by both you and your AI tools.

---

## What It Does

### Core loop
1. **Save** — paste a URL, use the bookmarklet, or share from mobile. Marginalia fetches the article, extracts clean text, generates an AI summary and suggested tags, and stores an OG image preview.
2. **Highlight** — select text in the in-app reader to save a quote. Quotes are first-class objects: tagged, searchable, and separately embeddable.
3. **Organize** — tag everything. Tags are the spine of the system; they scope chat sessions, discovery, exports, and MCP queries.
4. **Think** — AI chat is scoped to your saved content. Ask "What tensions exist in what I've saved about #ai-agents?" and get answers with citations from your own library, not the open web.

### AI features (live)
| Feature | How it works |
|---|---|
| **Auto-summary on save** | Supabase Edge Function → Gemini Flash → stored in `articles.og_description` |
| **Tag suggestions on save** | Edge function reads article text, returns ranked tag suggestions |
| **Library chat** | Keyword retrieval from your articles/quotes → Gemini Flash with citations |
| **Sonar discovery** | Your tag graph → Perplexity Sonar API → results re-ranked by cosine similarity to your saves |
| **Threads** | Every AI chat session is scoped to the tags of the article/quote you started from — visible in `/tags/:slug` as Threads |

### AI features (in progress)
- **RAG chat upgrade** — OpenAI `text-embedding-3-small` → pgvector cosine similarity → replaces keyword retrieval. Schema and edge function scaffolded.
- **MCP server** — `listTags`, `listArticlesByTag`, `listQuotesByTag`, `getThreadBySessionId`. Edge function at `supabase/functions/mcp`. When live: "use my #ai-agents library as context" works in any MCP-compatible client.

---

## Architecture

```
Browser / PWA
  └── React 18 + TypeScript + Vite + shadcn/ui + Tailwind
        └── Supabase JS client (auth, DB queries, function invocations)

Supabase (BaaS)
  ├── PostgreSQL + pgvector (articles, quotes, tags, embeddings, chat sessions)
  ├── RLS — all tables scoped to auth.uid()
  └── Edge Functions (Deno)
        ├── parse-article        — extract clean text from URL
        ├── bookmarklet-save     — single-endpoint save from bookmarklet/mobile share
        ├── fetch-metadata       — OG image, description, reading time
        ├── suggest-tags         — Gemini Flash tag recommendations
        ├── chat                 — library-grounded chat (keyword retrieval + Gemini Flash)
        ├── sonar-discover       — Perplexity Sonar + tag-weighted re-ranking
        ├── generate-embedding   — OpenAI text-embedding-3-small → pgvector
        └── mcp                  — Model Context Protocol server (in progress)

External APIs
  ├── Gemini Flash    — chat & summarization
  ├── OpenAI          — text-embedding-3-small (embeddings)
  └── Perplexity Sonar — open-web discovery ranked by tag graph
```

### Key schema decisions

**`chat_sessions` as Threads** — Threads are not a separate data type. A Thread is a `chat_session` auto-created when a user hits the AI button on any card. The session inherits tags from the source article/quote via `chat_session_tags`. This means tag pages can show "Threads" as a filter with zero extra writes, and the MCP server can surface tagged conversations without a separate concept of "thread."

**`content_embeddings` separate from `articles`** — Embeddings are stored in a dedicated table (`content_id`, `content_type`, `embedding vector(1536)`) rather than adding a vector column to `articles`. This allows quoting *and* articles to be embedded independently, supports future multi-modal embeddings, and keeps the primary tables migration-safe.

**RLS-first design** — Every Supabase query includes `.eq('user_id', user.id)` or equivalent. The MCP server uses user-scoped API keys so agent queries respect the same row-level policies as the UI. No admin-scope queries anywhere.

---

## Tradeoffs & Decisions

**Lovable for hosting (vs. direct Vercel + Supabase)**

| | Lovable | Vercel + Supabase |  
|---|---|---|
| Setup time | ~0 (managed) | ~2 hrs (config, env wiring) |
| Edge function deploy | Only functions Lovable creates via its own UI | Full CLI control — `supabase functions deploy` |
| CI/CD | None | GitHub Actions, PR previews |
| Cost at early stage | Low | Low |
| Infra visibility | Opaque — Supabase project is in Lovable's org | Full ownership, own org |
| Escape velocity | Hard — Lovable owns your Supabase project | You own everything |

Lovable was the right call at day zero: zero-config hosting removed all setup friction for a solo build. The constraint that ended it: Lovable only deploys edge functions it creates through its own AI interface. Functions added via direct git push (sonar-discover, generate-embedding, mcp, fetch-metadata) were never registered with Supabase — they existed in the repo but were dead in production. Attempting to deploy via the Supabase Management API returned 403 because the project lives in Lovable's org, not the user's. This is a fundamental ownership problem, not a workaround-able one. Migrating to Vercel + own Supabase resolves it permanently.

**pgvector vs. Pinecone**
pgvector is the default because it lives inside the same Postgres instance — no extra latency, no separate auth, no additional SaaS cost. Pinecone is listed as a fallback in the roadmap for if/when pgvector query times degrade at scale (benchmark threshold: >200ms p95 on 1M vectors). No premature migration.

**Keyword retrieval before RAG**
The chat edge function launched with keyword (`tsvector`) retrieval rather than waiting for the full RAG stack. This shipped a working product months earlier, collected real usage signals, and validated that users actually want library-grounded chat before investing in the embedding pipeline. RAG is being layered in now that the use case is confirmed.

**Gemini Flash vs. GPT-4o**
Cost per token at expected volume, not capability ceiling. Marginalia's chat is retrieval-augmented — the model is mostly formatting and reasoning over a ~2K-token context window of your quotes and article summaries. Gemini Flash handles this comfortably and is 10x cheaper at scale than GPT-4o. Model selection is centralized in the edge function, so swapping is a one-line change.

**MCP before Social features**
Phase 8.5 (MCP) is prioritized over Phase 9 (social/sharing) because the MCP server has higher leverage: it turns Marginalia into infrastructure that makes every AI tool a user already has better, rather than requiring users to bring friends to a new social surface. One well-placed integration (a Claude plugin, a ChatGPT action) can drive more meaningful usage than a public profile page.

**Antigravity over Claude Code or Codex**
Choosing the right AI coding agent fundamentally changes the velocity of a solo project. Antigravity was chosen for its persistent, cross-session repository context (via Knowledge Items), planning fidelity (forcing implementation plans over immediate code dumping), and task granularity. Claude Code has stronger raw generation speed for greenfield apps but loses architectural context over long running projects. Antigravity acts more like a persistent engineering partner.

**Ruthless Scope Reduction (Feature Sequencing)**
For the core 4-hour sprint that built the AI features, a hard prioritization decision was made: *Core intelligence features first, platform + integrations after.* All infrastructure (custom domain, Cloudflare, Sentry, Redis) and social sharing were explicitly cut. Even minor UI polish was deferred to guarantee the pgvector RAG upgrade shipped. The tradeoff is acquiring technical debt on the operations side in exchange for immediate, demoable product value.

---

## Local Setup

```sh
git clone https://github.com/ronithryal/savewithmarginalia
cd savewithmarginalia
npm install
cp .env.example .env.local   # add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev
```

Requires Node 18+. Tested with Bun for package management.

For edge functions, install the [Supabase CLI](https://supabase.com/docs/guides/cli) and run:
```sh
supabase functions serve chat --env-file .env.local
```

---

## Roadmap

| Phase | Status | What |
|---|---|---|
| 1 — Mobile polish | ✅ Done | Hamburger nav, card contrast, Threads wiring |
| 2 — AI enrichment | ✅ Done | Auto-summary, tag suggestions, quote highlighting |
| 3 — Threads rewire | ✅ Done | chat_session_tags as the thread backbone |
| 4 — Import pipeline | 🔨 Building | X bookmark import, RSS → Discover, source badges |
| 5 — Sonar discovery | 🔨 Building | Perplexity Sonar + tag-weighted ranking (edge fn live) |
| 6 — RAG + pgvector | 🔨 Building | Embeddings pipeline scaffolded, chat upgrade next |
| 7 — NotebookLM export | Planned | Tag → structured markdown → Audio Overview |
| 8.5 — MCP server | Planned | Claude/GPT agents read your library via MCP |
| 9 — Vercel migration | Planned | CI/CD, preview deploys, full infra control |
| 11 — Monetization | Planned | Stripe subscriptions, usage billing, team workspaces |

Full roadmap: [ROADMAP.md](./ROADMAP.md)

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| Backend | Supabase (PostgreSQL, RLS, Auth, Edge Functions / Deno) |
| AI | Gemini Flash (chat), OpenAI text-embedding-3-small (RAG), Perplexity Sonar (discovery) |
| Hosting | Lovable (→ Vercel Phase 9) |
| Planned infra | Cloudflare (CDN/DNS), Upstash Redis (rate limiting), Resend (email), Stripe (billing) |

---

## Log

A running record of major architectural pivots and the reasoning behind them.

---

### 2026-02-25 — AI coding tool: Antigravity over Claude Code or Codex

**What changed:** Decided to use Antigravity (Google DeepMind) as the primary AI coding assistant throughout this project instead of Claude Code or Codex.

**Why:** The decision came down to three things — context retention, codebase awareness, and planning behavior.

Antigravity maintains persistent context across the full repository via Knowledge Items, which means it doesn't re-read the same files on every session and doesn't give contradictory architectural advice between conversations. For a project this size (15 pages, 10 edge functions, multi-phase roadmap), drift between sessions is a real cost. Claude Code and Codex both require re-establishing context each session.

The second factor is planning fidelity. Antigravity produces an implementation plan and requests review before writing code. For a PM building a portfolio project, this creates a natural artifact — the plan itself documents product thinking. Every implementation plan is evidence of the reasoning behind a decision, not just the decision.

The third factor is task granularity. Antigravity breaks work into discrete, labeled tasks visible in the UI rather than producing a wall of code. That matches PM workflow: you want to see what changed, why, and be able to reject a step without losing the whole session.

**The honest tradeoff:** Claude Code has stronger raw code generation for greenfield work — fewer hallucinated APIs, faster first drafts. Codex integrates tightly with GitHub workflows. Antigravity's advantage is on ongoing, context-heavy development where architectural consistency matters more than speed-of-first-draft. That describes this project exactly.

---

### 2026-02-27 — Adopting the "Claude Code OS" Workflow

**What changed:** Re-aligned the AI orchestration model to adopt best practices from Boris Cherny (creator of Claude Code) into the Marginalia development process.

**Why:** The gap between PMs who use AI as a fast research assistant versus an operating system is compounding. Marginalia's thesis is that context is everything. The development process should match that thesis: structural, context-aware, and built for automation, not just speed.

**The Workflow:**
1. **Plan Node Default & Verification:** Never mark a task complete without proving it works. Hard check against "Would a staff engineer approve this?" Write plans for anything 3+ steps.
2. **Subagent Offloading:** Spin up parallel subagents for isolated context gathering or scripting, keeping the main reasoning context clean.
3. **Self-Improvement Loop:** Maintain a `tasks/lessons.md` track record. After any correction from the user, write a rule to prevent the same mistake. Review lessons at session start.
4. **Demand Elegance:** For non-trivial changes, pause and look for the elegant solution (e.g., the Threads to `chat_session_tags` refactor) rather than accepting hacky first-pass code.

This meta-pivot treats the AI as a staff engineer partner rather than a junior dev dumping code.

---

### 2026-02-26 — Slogmap and Ruthless Scope Reduction

**What changed:** Defined a rigid 4-5 hour solo sprint ("slogmap") that explicitly dropped all infrastructure, mobile apps, and social features to focus 100% on core intelligence (RAG, Sonar, NotebookLM export).

**Why:** A solo developer has limited weekend/night hours. The trap is spending 3 hours wrestling with DNS, Cloudflare, and Redis caching before the core product loop even works.

**The decision:** Defer *everything* that doesn't immediately unlock intelligence or distribution. Skip source badges in the UI, but ship Google OAuth right away because it removes onboarding friction for testing. Skip tag-weighted RSS ranking, but ship the pgvector embedded RAG upgrade even if tired, because "This is the one that makes everything else more valuable."

**What it cost:** The app currently runs without a custom domain, without Sentry error tracking, and without rate limiting on webhooks. This is technical debt, intentionally acquired.

---

### 2026-02-24 — Firebase → Supabase

**What changed:** Replaced Firebase (Auth + Firestore + Cloud Functions) with Supabase (PostgreSQL + RLS + Edge Functions / Deno).

**Why:** Firebase's document model (Firestore) doesn't handle relational queries well — filtering articles by tag, joining tags to chat sessions, doing vector similarity search — all of these require SQL. The original Firebase plan would have required either denormalized duplicate data or client-side joining, both of which compound as the data model grows. Supabase is Postgres, so the schema can evolve properly.

**The other factor:** pgvector. The Phase 6 RAG stack requires a vector store. pgvector lives inside the same Postgres instance, which means the same RLS policies, same connection, same query interface. Firebase's equivalent would have been Pinecone or a separate managed service with its own auth and latency. One less integration is meaningful when building solo.

**What Firebase did well:** Real-time listeners with minimal setup. Supabase has real-time too, but Firebase's SDKs are more ergonomic for it. For a read-heavy personal app with no collaborative real-time requirements, this wasn't worth the relational tradeoffs.

---

### 2026-02-26 — Threads as a standalone feature → Threads as `chat_session_tags`

**What changed:** Initial Threads implementation used a separate `threads` table with `thread_items`. Rewired to `chat_sessions` + `chat_session_tags` — Threads are now AI conversations scoped to a tag, not a separate data type.

**Why:** The original model treated Threads as a manual curation tool — users explicitly create threads and add articles to them. This created a second organizational system alongside Tags, which fragments the UI and the data model. The rewired model collapses this: every AI conversation is a Thread, and it inherits tags automatically from the source article or quote. No manual curation required.

**The downstream benefit:** Phase 8.5 (MCP server) can expose `getThreadBySessionId` and `listThreadsByTag` without any additional schema. External agents (Claude, GPT) can query a user's AI conversations organized by topic because the data is already structured that way. Building it right at Phase 3 means zero rework at Phase 8.5.

**What we lost:** The commit history shows three attempts before settling on this model (`feat: implement Threads` → `fix: wire threads to real threads table` → `refactor: simplify tag count query`). The initial implementation was technically functional but conceptually wrong. Shipping the wrong model early and refactoring costs less than getting it right before shipping at all — but only barely.

---

### 2026-02-27 — Migrating from Lovable to Vercel + own Supabase

**What changed:** Accelerating Phase 9 (Vercel migration) from a future roadmap item to an immediate priority.

**Why:** Lovable's edge function deployment is gated behind its own AI interface — only functions it generates can be registered with Supabase. Functions added via direct git push (`sonar-discover`, `generate-embedding`, `mcp`, `fetch-metadata`) existed in the repo but were never deployed. Attempting to deploy them via the Supabase Management API or CLI returned 403 because the Supabase project lives in Lovable's organization, not under the project owner's account. This is not a configuration issue — it's a structural ownership constraint with no workaround short of recreating each function through Lovable's own prompt flow.

**The trigger:** Perplexity Sonar integration (`sonar-discover`) was complete and key was provisioned, but the function couldn't be deployed because of this constraint. The same constraint blocks `generate-embedding` (RAG) and `mcp` (developer platform) — both critical to Phases 6 and 8.5.

**What was good about Lovable:** Zero-config start. No Supabase setup, no hosting config, no domain proxy. For a solo build at day zero, it removed the right friction.

**What it cost:** Supabase project ownership sits in Lovable's org. No CLI access, no edge function control, no infra visibility. Acceptable early on; unacceptable when the product depends on custom server-side functions.

| | Lovable | Vercel + Supabase |
|---|---|---|
| Setup time | ~0 (managed) | ~2 hrs (config, env wiring) |
| Edge function deploy | Only functions Lovable creates via its own UI | Full CLI control — `supabase functions deploy` |
| CI/CD | None | GitHub Actions, PR previews |
| Cost at early stage | Low | Low |
| Infra visibility | Opaque — Supabase project is in Lovable's org | Full ownership, own org |
| Escape velocity | Hard — Lovable owns your Supabase project | You own everything |

