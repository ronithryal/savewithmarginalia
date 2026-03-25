# Marginalia Cockpit — Roadmap

**Vision:** Marginalia is the opinionated web cockpit for the **Dex OS**. While Dex (the local engine) handles ingestion, intelligence scanning, and markdown storage, Marginalia provides the cloud-synced UI for PMs and Executives to synthesize signals and trigger actions.

---

## Phase 1 — Local-First Intelligence (Dex Pivot) ✅
*Transitioning the backend from 'just another database' to a local-first OS engine.*
- [x] **LinkedIn Vault Ingest**: 3,477 saved posts processed into `00-Inbox/LinkedIn/` (via `parse_linkedin.py`).
- [x] **Drop Zone Architecture**: Universal landing pad for raw signals in the vault.
- [x] **Skill 001 (/ingest)**: Generalized intelligence ingest for LinkedIn, YouTube, and X.
- [x] **Intelligence Briefing (/daily-plan)**: Cross-signal synthesis logic established in the OS.

---

## Phase 2 — The Engineering Cockpit (UI/UX)
*Standardizing the React interface as a frontend for the Dex Vault.*
- [ ] **Vault-to-Cloud Sync**: Syncing the local `30-briefings/` folder to Supabase for mobile viewing.
- [ ] **Skill Triggers**: Adding UI buttons (e.g., "Synthesize Briefing") that invoke Dex Python skills via MCP.
- [ ] **Hybrid Search**: Combining Supabase `pgvector` (RAG) with local Markdown full-text search.
- [ ] **Source Badges**: Visual indicators (LinkedIn, X, RSS) on intelligence cards.

---

## Phase 3 — Executive Intelligence (Daily Discovery)
- [ ] **Sonar API (Perplexity) V2**: Results ranked by overlap with user's saved tag graph.
- [ ] **X Intelligence Bridge**: Support for X Bookmark imports via Drop Zone.
- [ ] **Newsletter Discovery**: Wiring `user_feeds` to automated discovery logic.
- [ ] **"From your Vault"**: A /discover section highlighting recently archived posts from social media that haven't been synthesized yet.

---

## Phase 4 — Developer Platform & MCP Graduation
- [ ] **Marginalia MCP server**: Exposing the cloud-synced tags and quotes to external agents (Claude Desktop).
- [ ] **Public API keys**: Scoped read/write access for personal automation (Zapier/Make).
- [ ] **Resend Integration**: Weekly intelligence digest (Executive Summary) via email.

---

## Phase 5 — Infrastructure & Scale
- [ ] **Vercel Migration**: Move from Lovable to Vercel for CI/CD, preview deploys, and edge config.
- [ ] **Clerk Integration**: Upgrade Auth for team-based workspaces and SSO.
- [ ] **Stripe Payments**: Subscription-based tiers for high-volume intelligence scanning.
- [ ] **Chromium Extension**: Beyond a bookmarklet—native sidebar for "Save & Tag" without leaving the tab.

---

## Status Mapping: Cockpit vs. Engine

| Concept | Owned By | Status |
|---|---|---|
| **Social Parsers** | Dex Engine | Core logic in `/System/ingest/` |
| **Markdown Storage** | Dex Engine | Single source of truth in the vault |
| **Authentication** | Marginalia | Supabase / Clerk |
| **Mobile Access** | Marginalia | Supabase Cloud Sync |
| **Daily Skills** | Dex Engine | Managed via `.claude/skills/` |

---
**Maintained by:** Antigravity Agent
**Last Sync:** 2026-03-25
