# Marginalia (Archived)

**Status:** Deprecated  
**Successor:** The Dex Engine (`davekilleen/dex` fork) + standalone MCP repos

Marginalia began as a standalone web application built on React, Supabase, and Lovable, designed as an "AI-native knowledge management" tool. The goal was to store web-clipped articles, extract intelligence, and generate "Next Bets" or strategic briefings.

However, after building out the core infrastructure (pgvector RAG, edge functions, Lovable deployments), a critical product realization occurred: **the fundamental positioning was weak.** 

"AI knowledge management" is an incredibly crowded space (Notion AI, Obsidian, Mem, Reflect), and a standalone web app lacks a defensible ecosystem. More importantly, it was a tool in search of a problem — forcing the user to context-switch into a separate app just to save and read articles.

### The Pivot to Local-First AI (Dex)
The problem Marginalia tried to solve in the cloud is solved fundamentally better by integrating directly into an execution environment. 

The core job-to-be-done—parsing an article, extracting intelligence, and linking it to ongoing work—belongs inside an operating system that already knows your quarterly goals, meetings, and active projects. 

Instead of maintaining a massive cloud app, Marginalia's core functionality translates directly into a single `/save-article` automation skill inside **Dex** (a local Markdown-first AI engine).

The insight that **local-first AI execution layers > siloed cloud SaaS** proved out completely.

## Learnings & Postmortem

1. **Knowing When to Kill a Product is a Feature:** Sunk cost fallacy is dangerous. We built robust Supabase edge functions, complex RAG schemas, and beautiful React components. But realizing the architecture was duplicating an existing, better system (Dex) meant stopping work on a low-leverage surface to double down on a high-leverage one.
2. **Cohesive Systems over Polished Toys:** The best code isn't thrown away; it's relocated. The schema designs, UI component strategies, and AI parsing logic have all migrated to be utilized as either a `dex-web` sync layer or standalone Python MCP (Model Context Protocol) servers.
3. **Portfolio Signal:** A coherent, interlocking system of specialized MCP tools building on a centralized local engine demonstrates significantly stronger systems thinking and execution than a standalone, highly-polished-but-shallow CRUD application.

This repository remains as an archive of the original React/Supabase implementation. All active development on knowledge management workflows now takes place in the Dex repository and its satellite MCP services.

---

## Log

A running record of major architectural pivots and the reasoning behind them.

---

### 2026-02-24 — Firebase → Supabase

**What changed:** Replaced Firebase (Auth + Firestore + Cloud Functions) with Supabase (PostgreSQL + RLS + Edge Functions / Deno).

**Why:** Firebase's document model (Firestore) doesn't handle relational queries well — filtering articles by tag, joining tags to chat sessions, doing vector similarity search — all of these require SQL. The original Firebase plan would have required either denormalized duplicate data or client-side joining, both of which compound as the data model grows. Supabase is Postgres, so the schema can evolve properly.

**The other factor:** pgvector. The Phase 6 RAG stack requires a vector store. pgvector lives inside the same Postgres instance, which means the same RLS policies, same connection, same query interface. Firebase's equivalent would have been Pinecone or a separate managed service with its own auth and latency. One less integration is meaningful when building solo.

**What Firebase did well:** Real-time listeners with minimal setup. Supabase has real-time too, but Firebase's SDKs are more ergonomic for it. For a read-heavy personal app with no collaborative real-time requirements, this wasn't worth the relational tradeoffs.

---

### 2026-02-25 — AI coding tool: Antigravity over Claude Code or Codex

**What changed:** Decided to use Antigravity (Google DeepMind) as the primary AI coding assistant throughout this project instead of Claude Code or Codex.

**Why:** The decision came down to three things — context retention, codebase awareness, and planning behavior.

Antigravity maintains persistent context across the full repository via Knowledge Items, which means it doesn't re-read the same files on every session and doesn't give contradictory architectural advice between conversations. For a project this size (15 pages, 10 edge functions, multi-phase roadmap), drift between sessions is a real cost. Claude Code and Codex both require re-establishing context each session.

The second factor is planning fidelity. Antigravity produces an implementation plan and requests review before writing code. For a PM building a portfolio project, this creates a natural artifact — the plan itself documents product thinking. Every implementation plan is evidence of the reasoning behind a decision, not just the decision.

The third factor is task granularity. Antigravity breaks work into discrete, labeled tasks visible in the UI rather than producing a wall of code. That matches PM workflow: you want to see what changed, why, and be able to reject a step without losing the whole session.

**The honest tradeoff:** Claude Code has stronger raw code generation for greenfield work — fewer hallucinated APIs, faster first drafts. Codex integrates tightly with GitHub workflows. Antigravity's advantage is on ongoing, context-heavy development where architectural consistency matters more than speed-of-first-draft. That describes this project exactly.

---

### 2026-02-26 — Threads as a standalone feature → Threads as `chat_session_tags`

**What changed:** Initial Threads implementation used a separate `threads` table with `thread_items`. Rewired to `chat_sessions` + `chat_session_tags` — Threads are now AI conversations scoped to a tag, not a separate data type.

**Why:** The original model treated Threads as a manual curation tool — users explicitly create threads and add articles to them. This created a second organizational system alongside Tags, which fragments the UI and the data model. The rewired model collapses this: every AI conversation is a Thread, and it inherits tags automatically from the source article or quote. No manual curation required.

**The downstream benefit:** Phase 8.5 (MCP server) can expose `getThreadBySessionId` and `listThreadsByTag` without any additional schema. External agents (Claude, GPT) can query a user's AI conversations organized by topic because the data is already structured that way. Building it right at Phase 3 means zero rework at Phase 8.5.

**What we lost:** The commit history shows three attempts before settling on this model (`feat: implement Threads` → `fix: wire threads to real threads table` → `refactor: simplify tag count query`). The initial implementation was technically functional but conceptually wrong. Shipping the wrong model early and refactoring costs less than getting it right before shipping at all — but only barely.

---

### 2026-02-26 — Slogmap and Ruthless Scope Reduction

**What changed:** Defined a rigid 4-5 hour solo sprint ("slogmap") that explicitly dropped all infrastructure, mobile apps, and social features to focus 100% on core intelligence (RAG, Sonar, NotebookLM export).

**Why:** A solo developer has limited weekend/night hours. The trap is spending 3 hours wrestling with DNS, Cloudflare, and Redis caching before the core product loop even works.

**The decision:** Defer *everything* that doesn't immediately unlock intelligence or distribution. Skip source badges in the UI, but ship Google OAuth right away because it removes onboarding friction for testing. Skip tag-weighted RSS ranking, but ship the pgvector embedded RAG upgrade even if tired, because "This is the one that makes everything else more valuable."

**What it cost:** The app currently runs without a custom domain, without Sentry error tracking, and without rate limiting on webhooks. This is technical debt, intentionally acquired.

---

### 2026-02-27 — The Grand Pivot: From Bookmarker to Executive Intelligence Engine

Marginalia started as a personal article and quote keeper — my "better Pocket/Readwise" for cleaning up a chaotic reading habit. Over time, I realized the real value wasn't storage, it was context.

As I built Threads, RAG search, and imports from X/LinkedIn, the product naturally shifted from "save everything" to "surface the few things that actually drive decisions" — especially for founders, PMs, and investors.

Talking through the roadmap forced a bigger reframing: Marginalia isn't just a bookmarking tool, it's an executive context layer. The core job is to capture high-signal inputs (social, docs, PDFs), learn how the user thinks about them, and feed that into agents like Claude as structured, trustworthy context.

That's when the vision clicked for me: this is essentially Cursor for product and strategy. Instead of only helping you write code, Marginalia helps you decide what to build, what to say, and how to explain it — then hands that intent to whatever coding or content agents you prefer.

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

### 2026-02-27 — Infrastructure Deferral (Platform-First Deployment)

**What changed:** Decided to stick with Lovable despite the edge function hurdle. Prompt-engineering the platform to "adopt" and deploy manually pushed code proved faster than a full Vercel migration, preserving development velocity.

**Why:** For a solo developer, time is the scarcest resource. Trading money (Lovable credits) for infra-management hours is an efficient trade at this stage. The realization that platforms can be manipulated into adopting external code allows for "open-infra" capabilities while staying in the "walled garden" of managed services.

---

### 2026-02-27 — Strategic Pivot: Enterprise Focus over Curation

**What changed:** Deprioritized NotebookLM integration, moving it from a core Phase 7 item to a secondary Phase 9 (Social/Sharing) feature. Realigned the immediate sprint focus to "Executive Intelligence" (Strategic Briefs, Claude 3.5 reasoning, and Mem0 memory).

**Why:** Marginalia's real power is as an executive intelligence engine, not just a curation tool. NotebookLM is an excellent synthesis destination, but building high-fidelity exports for it is "expensive" in terms of development time relative to its current value. By focusing on internal inference (Claude) and memory (Mem0), Marginalia provides more direct value to founders and PMs who need to decide "what to build next" rather than just "how to format research."

**The tradeoff:** We sacrifice immediate one-click compatibility with Google's NotebookLM in exchange for earlier access to a persistent, reasoning-capable context layer. This aligns the project more closely with the "Cursor for PMs" vision.

---

### 2026-02-27 — Agent Lessons & Corrections (from sprint)

**RAG "Hallucinated" Analogies & Precision Floor 🎯**
- **Mistake**: Deploying semantic search without a similarity threshold (`similarity > 0.5`). The system would pull the "least bad" matches (e.g., linking private equity to AI memory) and force the LLM to synthesize them, creating stupid analogies.
- **Lesson**: RAG needs a precision floor. Over-retrieval is often worse than no retrieval. If the user's library lacks relevant context, it's better to admit ignorance or fall back to an external source than to construct a hallucinated bridge between unrelated concepts.
- **Action**: Enforce a strict similarity filter on `match_content_embeddings` results and implement a fallback chain: RAG (if high match) → Keyword Search → Sonar Web Search (if library is empty on the topic).

**Lovable Edge Function Deployments**
- **Mistake**: Attempted to deploy edge functions directly to Supabase via the Supabase Management API and CLI, resulting in 403 errors.
- **Lesson**: Lovable owns the Supabase organization for auto-provisioned projects. Direct CLI access is inherently blocked. However, the platform can be coerced into "adopting" manual code if prompted to re-create or register specific files.
- **Action**: Defer infra migration if platform-side workarounds (prompt-engineering for infra) exist. Preserves velocity while sacrificing some control.

**Avoiding "Infra-Heavy" Local Workflows ⚠️**
- **Mistake**: Repeatedly proposed local terminal `deno run` scripts and SQL triggers that depend on local environment variables like `SUPABASE_SERVICE_ROLE_KEY`.
- **Lesson**: **NEVER propose local `deno/node` scripts for a Lovable-managed project.** The only valid approaches are: (1) SQL queries in Lovable's SQL Editor, (2) Lovable prompts that build UI-native tools (buttons in Settings), or (3) edge function calls triggered from within the running app itself.

**OpenAI 429 Errors from Zero Balance ⚠️**
- **Mistake**: Spent significant time debugging 429 rate-limit errors and adding aggressive backoff logic when the real issue was a $0 OpenAI account balance.
- **Lesson**: A 429 from OpenAI can mean **rate limit** (too many requests) OR **insufficient quota** (zero balance). If the OpenAI dashboard shows **0 API activity**, it's always a billing issue, not a rate issue. The error body will contain `"insufficient_quota"`.

**Strategic Brief / Claude via Lovable API Gateway 🔑**
- **Dependency**: The `reasoning` edge function calls Claude 3.5 Sonnet via `https://ai.gateway.lovable.dev` using `LOVABLE_API_KEY`, not a direct Anthropic key.
- **Migration Risk**: This key is Lovable-managed and will be invalid after migrating off Lovable. When migrating, replace the gateway URL and auth header with a direct Anthropic API key.

---

### 2026-03-01 — Parallel Retrieval & Solving "Forced Analogies"

**What changed:** Rewrote `chat/index.ts` to fetch internal pgvector RAG matches and live Perplexity Sonar web searches *concurrently* (`Promise.allSettled`). Completely overhauled the AI `SYSTEM_PROMPT` to enforce strict boundaries between these two context streams.

**Why:** The AI was suffering from two core issues:
1. **Blindness to live events:** Sonar was implemented as a fallback (only firing if the internal library had 0 matches). If the user asked for a live update alongside an internal topic, the AI was completely blind because the fallback was skipped. Concurrent fetching solves this.
2. **"Forced Analogies" Hallucinations:** The original prompt instructed the AI to "Connect ideas across different saved items." When asked a direct, simple question about one article, the AI would compulsively try to drag in unrelated database hits (like Ethereum or Private Equity) just to fulfill the "connect ideas" behavioral prompt.

**The Fix:** Segmented the data pipeline so the AI receives clearly labeled `[USER'S PRIVATE LIBRARY]` and `[LIVE GLOBAL WEB SEARCH]` blocks. The prompt now explicitly commands the AI to **IGNORE** the private library if the retrieved items don't factually answer the question, eliminating the hallucinated conceptual bridges between unrelated saved items.

---

---

### 2026-03-25 — The Dex Engine Integration Pivot

**What changed:** Reoriented the entire Marginalia architecture from a standalone Supabase-heavy application into a thin web client sitting on top of the **Dex Engine** (a Markdown-first personal OS).

**Why:** The realization was that Marginalia was duplicating the storage and execution layer of a true "system of record" (like Dex). The user already maintains a heavily structured Markdown vault (`10-workspaces/`, `20-decisions/`, `30-briefings/`) alongside Python MCP servers that handle powerful local syncs and intelligence routines. Building identical features purely in the cloud created friction and duplicate sources of truth. 

**The Execution:**
1. **Source of Truth:** The local Dex Markdown vault replaces independent Marginalia database models for things like "Tags".
2. **"Workspaces" Map:** Tags are now modeled as "Workspaces" that directly map to the native Area and Project vault directories.
3. **Cockpit UI vs. Engine:** Marginalia now acts as a high-fidelity "Cockpit" UI for PMs and Execs, rendering those markdown briefs beautifully on the web. Instead of executing complex RAG directly, it fires "Skill Triggers" to the Dex python bridge, and then Dex processes the request and writes a new Markdown file back to the vault, which the web app simply reads.

This aligns Marginalia deeply with agent-first infrastructure—removing cloud vendor lock-in and turning it into a beautiful surface over entirely owned local execution layers.
