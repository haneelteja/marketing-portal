# AI-Native Marketing Agency Platform

Multi-tenant platform: Platform Console (agency) + Client Console (brands), AI content
generation (ideas → images → video), approval workflow, and direct publishing to
Instagram / Facebook / YouTube / LinkedIn with unified analytics.

- Read `ARCHITECTURE.md` first.
- Roadmap & live to-do: `docs/plan/ROADMAP.md`.
- Decisions: `docs/adr/`. Runbooks: `docs/runbooks/`.

## Workspaces
| Path | Purpose |
|---|---|
| `apps/web` | Next.js — both consoles, role-gated routing |
| `packages/core` | Provider abstractions, prompt builder, quota, crypto, queue contracts |
| `services/orchestrator` | Async AI generation workers |
| `services/publisher` | Publish / token refresh / analytics workers |
| `supabase/migrations` | Schema + RLS (the tenant boundary) |

## Local setup
```bash
pnpm install
supabase start && supabase db reset      # applies migrations incl. RLS
cp .env.example .env                     # fill ANTHROPIC_API_KEY, TOKEN_VAULT_KEY, ...
pnpm dev                                 # web + workers
```

## Non-negotiables (short form of spec §1/§15)
No faked external calls. No default service-role client. RLS tested against real traffic.
Async generation only. One CHANGELOG, docs in /docs.
