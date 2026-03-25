# Marginalia — Agent Context

## Project Overview
Marginalia (repo: savewithmarginalia) is evolving into a **web client on top of the Dex Engine** (a Markdown-first personal OS running locally/via MCP). Previously a standalone React/Supabase app on Lovable, the architecture is pivoting so that the Dex Vault (`10-workspaces/`, `20-decisions/`, `30-briefings/`) acts as the single source of truth for intelligence. The Marginalia frontend will read this vault and provide an opinionated UI for PMs/execs to trigger Dex/Claude skills (like "morning intel" or "propose next bets").

**Frozen backup:** `ronithryal/marginalia-stable` — do not touch.

## Tech Stack

### Currently in use (via Lovable)
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend:** Supabase (PostgreSQL + RLS + Auth + Edge Functions)
- **Hosting:** Lovable → auto-deploys from GitHub. Handles hosting, Supabase project,
  domain proxy, and 2-way git sync. **Stay on Lovable through Phase 8** — it removes
  significant operational overhead while building solo. **Migrate to Vercel in Phase 9**
  when you need CI/CD, PR previews, and full infra control.
- **AI:** Gemini Flash via Supabase edge functions (chat)

### Introduced through the roadmap
| Tool | Phase | Role |
|---|---|---|
| **Dex Engine / MCP** | 13 | The core automation engine, intelligence scanner, and single source of truth (`davekilleen/dex` fork). |
| **Perplexity Sonar** | 4.5 | Open-web discovery and search ranked by tag graph |
| **OpenAI** | 6 | `text-embedding-3-small` for pgvector RAG embeddings |
| **Claude 3.x** | 8.5+ | Reasoning, structured analysis, and agentic workflows via Dex Skills |
| **Mem0** | 12 | Persistent memory provider for long-term user context |
| **Cloudflare** | 4 | DNS + CDN + DDoS after buying domain |
| **PostHog / Amplitude** | 4 / 10.5 | Product analytics — track saves, searches, and feature telemetry |
| **Datadog** | 10.5 | Infrastructure monitoring and service log ingestion |
| **Intercom** | 10.5 | Customer service logs and feedback ingestion |
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

## Active Roadmap
See [ROADMAP.md](file:///Users/ronith/Marginalia/savewithmarginalia/ROADMAP.md) for engineering roadmap.


---

## Key External APIs
| API | Use case | Auth |
|---|---|---|
| Perplexity Sonar | Open-web discovery ranked by tag graph | API key → Supabase secrets |
| OpenAI Embeddings | `text-embedding-3-small` for pgvector RAG | API key → Supabase secrets |
| Gemini Flash | Chat (already live) | API key → Supabase secrets |
| X API v2 | Bookmark import, X feed in Discover, thread import | OAuth 2.0 PKCE |
| SaaS APIs | PostHog, Datadog, Amplitude, Intercom (Ingestion) | API keys / OAuth |

## Agent Instructions
- Before making changes, read the relevant page component and any hooks it uses
- Prefer editing existing components over creating new ones
- After making changes, verify the UI renders correctly at mobile (375px) and desktop (1280px)
- Do not modify `supabase/functions/` edge functions without understanding the existing request/response contract
- When adding new Supabase queries, always include `.eq('user_id', user.id)` or equivalent RLS-safe filter
- New features should be designed so they can also be exposed as tools to external agents (via MCP/public API), with logic factored into reusable functions
- Reusable insights (like recurring conclusions and preferences) should be stored in a memory-friendly structure linked to tags/IDs so they can be synced to a dedicated memory service later
