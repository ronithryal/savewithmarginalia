# Technical Debt Tracker

A running record of debt intentionally acquired to preserve development velocity. 

> [!CAUTION]
> **Alert Threshold**: If we hit **3+ deployment failures** caused by Lovable's black-box structure, or if **Sonar/RAG latency exceeds 2s** due to lack of custom edge configuration, we must migrate to Vercel immediately.

## Debt Log

### Infrastructure & Operations
| Debt Item | Risk | Mitigation | Date |
|---|---|---|---|
| **Walled Garden Ownership** | No direct ownership of Supabase project. No CLI access. | Prompt-engineering Lovable to "adopt" manual code. | 2026-02-27 |
| **No CI/CD** | Manual "Publish" deployments. No PR previews. | Use GitHub for version control; Lovable for prod only. | 2026-02-27 |
| **Opaque Edge Config** | Limited control over Deno version or worker specs. | Keep edge functions minimal and modular. | 2026-02-27 |

### Backend & Data
| Debt Item | Risk | Mitigation | Date |
|---|---|---|---|
| **Manual Embeddings Backfill** | New articles don't auto-embed without client-side trigger. | Hook `generate-embedding` to DB trigger later. | 2026-02-27 |
| **Claude via LOVABLE_API_KEY** | `reasoning` function uses Lovable's AI Gateway, not a direct Anthropic key. Will break on migration. | Replace with `ANTHROPIC_API_KEY` + `api.anthropic.com` endpoint when migrating off Lovable. | 2026-02-27 |
| **Missing Domain/CDN** | Standard Lovable URL. No custom caching headers. | Defer until distribution phase. | 2026-02-27 |

### Observability
| Debt Item | Risk | Mitigation | Date |
|---|---|---|---|
| **No Error Tracking** | Silent failures in Edge Functions/Backend. | Use Perplexity/Gemini for advanced local debugging. | 2026-02-27 |
| **No PostHog/Analytics** | flying blind on feature usage. | Manual audit of DB article growth. | 2026-02-27 |
