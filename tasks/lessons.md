# Agent Lessons & Corrections

A self-improvement loop for the AI assistant, updated after any user correction or failure to track persistent patterns and avoid repeated mistakes.

## 2026-02-27

### Lovable Edge Function Deployments
- **Mistake:** Attempted to deploy edge functions directly to Supabase via the Supabase Management API and CLI, resulting in 403 errors.
- **Lesson:** Lovable owns the Supabase organization for auto-provisioned projects. Direct CLI access is inherently blocked. However, the platform can be coerced into "adopting" manual code if prompted to re-create or register specific files.
- **Action:** Defer infra migration if platform-side workarounds (prompt-engineering for infra) exist. Preserves velocity while sacrificing some control.

### Lovable Git Sync Delays
- **Mistake:** Assumed commits pushed to GitHub were automatically active in the Lovable preview environment.
- **Lesson:** Lovable requires explicitly hitting the "Publish" button to ingest and deploy pending GitHub commits. 
- **Action:** Always check Lovable's 'Unpublished' queue when changes don't visibly reflect in the app.
