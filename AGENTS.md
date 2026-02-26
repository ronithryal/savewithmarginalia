# Marginalia — Agent Context

## Project Overview
Marginalia (repo: `savewithmarginalia`) is a personal article and quote keeper built with React + TypeScript + Vite + Tailwind + shadcn/ui. It is hosted on Lovable (readmargin.lovable.app) and uses Supabase for database, auth, and edge functions. The Lovable project syncs 2-way with this GitHub repo — any commits pushed to `main` here will be reflected in the Lovable hosted app automatically.

**Frozen backup:** `ronithryal/marginalia-stable` — do not touch.

## Tech Stack
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend:** Supabase (PostgreSQL + Row Level Security + Auth + Edge Functions)
- **Hosting:** Lovable (readmargin.lovable.app) — auto-deploys from this repo
- **AI features:** OpenAI via Supabase edge functions

## Repository Structure
```
src/
  pages/          # Route-level components (Home, Articles, Quotes, Tags, Chat, Discover, Settings, Future)
  components/     # Reusable UI components
  hooks/          # Custom React hooks
  integrations/   # Supabase client and types
supabase/
  functions/      # Edge functions: parse-article, bookmarklet-save, suggest-tags, chat, discover
public/           # Static assets
```

## Database Schema (Supabase)
Key tables:
- `articles` — saved articles with URL, title, content, summary, cover image
- `quotes` — user-extracted quotes linked to articles
- `tags` — user-defined tags
- `article_tags` — many-to-many join between articles and tags
- `chat_messages` + `chat_session_tags` — AI chat history scoped to tags

All tables use Row Level Security (RLS) scoped to `auth.uid()`.

## Environment Variables
Required in `.env.local`:
```
VITE_SUPABASE_URL=<from Lovable Cloud > Overview>
VITE_SUPABASE_ANON_KEY=<from Lovable Cloud > Overview>
```
These are safe to use client-side (anon key, protected by RLS).

## Development Rules
- **Do not break existing Supabase schema** without a migration file in `supabase/`
- **Do not change the Lovable-managed `.env` file** — use `.env.local` for local dev
- **Preserve existing routes and nav structure** unless explicitly asked to change them
- **Mobile-first:** all new UI must be responsive; test at 375px and 1280px
- **Design system:** use shadcn/ui components and existing Tailwind config — do not introduce new UI libraries
- **No new npm packages** without confirming they are compatible with the Vite + Bun setup
- Commit messages should be clear and imperative (e.g. "Add X OAuth login button")

## Current App Pages
| Route | Description |
|---|---|
| `/` | Home — URL input to save articles, recent saves |
| `/articles` | Article library with card grid |
| `/articles/:id` | Article reader view with quote extraction |
| `/quotes` | All saved quotes |
| `/tags` | Tag browser |
| `/chat` | AI chat scoped to saved content |
| `/discover` | AI-curated discovery feed (HN + Guardian + Reddit) |
| `/settings` | User settings |
| `/future` | Marketing/roadmap page with 7 feature sections + framer-motion scroll animations |

## Active Roadmap (implement in order)
### Phase 1 — Mobile Polish (current)
- Mobile hamburger sidebar menu
- Card hover element contrast improvements

### Phase 2 — AI Enrichment
- Auto-summarization on article save
- AI-suggested tags on save
- Quote highlighting in reader view

### Phase 3 — Social & Import
- X (Twitter) bookmarks import via OAuth
- Share article/quote to X

### Phase 4 — Discovery & Intelligence
- pgvector semantic search across saved content
- OpenRouter integration for multi-model AI chat
- Personal digest / Wrapped-style annual review

### Phase 5 — Growth
- Public profiles and shared collections
- Team/collaborative libraries

## Agent Instructions
- Before making changes, read the relevant page component and any hooks it uses
- Prefer editing existing components over creating new ones
- After making changes, verify the UI renders correctly at mobile (375px) and desktop (1280px)
- Do not modify `supabase/functions/` edge functions without understanding the existing request/response contract
- When adding new Supabase queries, always include `.eq('user_id', user.id)` or equivalent RLS-safe filter
