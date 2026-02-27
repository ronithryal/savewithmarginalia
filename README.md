# Marginalia

**A personal knowledge layer for the age of AI agents.**

Marginalia lets you save articles and quotes, organize them by tag, and then *use* that knowledge — via AI chat grounded in your actual reading, a Perplexity-powered discovery feed ranked by your tag graph, and an MCP server that lets Claude and GPT treat your library as first-class context.

> Live at [readmargin.lovable.app](https://readmargin.lovable.app)

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

**Lovable for hosting (vs. direct Vercel)**
Lovable provides 2-way git sync, hosted Supabase project, and domain proxy with zero DevOps. The tradeoff is limited CI/CD and no PR preview environments. For a solo early-stage product, the velocity gain outweighs the control loss. Planned migration to Vercel in Phase 9 when SLAs and preview deploys become necessary.

**pgvector vs. Pinecone**
pgvector is the default because it lives inside the same Postgres instance — no extra latency, no separate auth, no additional SaaS cost. Pinecone is listed as a fallback in the roadmap for if/when pgvector query times degrade at scale (benchmark threshold: >200ms p95 on 1M vectors). No premature migration.

**Keyword retrieval before RAG**
The chat edge function launched with keyword (`tsvector`) retrieval rather than waiting for the full RAG stack. This shipped a working product months earlier, collected real usage signals, and validated that users actually want library-grounded chat before investing in the embedding pipeline. RAG is being layered in now that the use case is confirmed.

**Gemini Flash vs. GPT-4o**
Cost per token at expected volume, not capability ceiling. Marginalia's chat is retrieval-augmented — the model is mostly formatting and reasoning over a ~2K-token context window of your quotes and article summaries. Gemini Flash handles this comfortably and is 10x cheaper at scale than GPT-4o. Model selection is centralized in the edge function, so swapping is a one-line change.

**MCP before Social features**
Phase 8.5 (MCP) is prioritized over Phase 9 (social/sharing) because the MCP server has higher leverage: it turns Marginalia into infrastructure that makes every AI tool a user already has better, rather than requiring users to bring friends to a new social surface. One well-placed integration (a Claude plugin, a ChatGPT action) can drive more meaningful usage than a public profile page.

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
