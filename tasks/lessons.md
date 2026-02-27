# Agent Lessons & Corrections

A self-improvement loop for the AI assistant, updated after any user correction or failure to track persistent patterns and avoid repeated mistakes.

### 2026-02-27
#### Lovable Edge Function Deployments
- **Mistake:** Attempted to deploy edge functions directly to Supabase via the Supabase Management API and CLI, resulting in 403 errors.
- **Lesson:** Lovable owns the Supabase organization for auto-provisioned projects. Direct CLI access is inherently blocked. However, the platform can be coerced into "adopting" manual code if prompted to re-create or register specific files.
- **Action:** Defer infra migration if platform-side workarounds (prompt-engineering for infra) exist. Preserves velocity while sacrificing some control.

#### Avoiding "Infra-Heavy" Local Workflows ⚠️ HIGH PRIORITY
- **Mistake:** Repeatedly proposed local terminal `deno run` scripts and SQL triggers that depend on local environment variables like `SUPABASE_SERVICE_ROLE_KEY`.
- **Root Cause:** The user is fully on Lovable and does NOT have direct access to Supabase credentials or CLI tooling in their expected workflow.
- **Lesson:** **NEVER propose local `deno/node` scripts for a Lovable-managed project.** The only valid approaches are: (1) SQL queries in Lovable's SQL Editor, (2) Lovable prompts that build UI-native tools (buttons in Settings), or (3) edge function calls triggered from within the running app itself.
- **Action:** Any migration, backfill, or data operation must be delivered as a button in the Lovable UI or a SQL query.
