# Architecture

One deployable web app, two route-gated consoles, two internal services, one shared core package.

```
apps/web                  Next.js (App Router). Both consoles in one codebase:
                            /platform/*            Platform Console (agency/operator)
                            /app/[clientSlug]/*    Client Console (tenant-scoped)
packages/core             Shared domain code: provider abstractions, prompt builder,
                          quota service, token crypto, queue contracts, claim types.
services/orchestrator     Async AI generation workers (pg-boss consumers). Owns all
                          calls to LLM / image / video providers.
services/publisher        Scheduled publishing + token refresh + analytics pull workers.
supabase/migrations       Schema + RLS. RLS is the tenant boundary, not app code.
```

## Request flow

```
[Client Console UI] ─┐
                     ├─> [Next.js API / Server Actions] ─> [Postgres + RLS]
[Platform Console UI]┘            │
                                  ├─ enqueue ─> [pg-boss queue] ─> orchestrator ─> LLM / image / video providers
                                  │                              └> publisher    ─> Meta / YouTube / LinkedIn
                                  └─> [Supabase Realtime] <── job status updates ──┘
```

## Tenancy & security model

* Every tenant-scoped table carries `client_id` with RLS policies keyed off JWT claims
  (`request.jwt.claims ->> 'client_id'`). Platform roles get **explicit** policies, not a
  shared service-role escape hatch.
* Three database client classes in `apps/web/src/lib/db/clients.ts`:
  1. `rlsClient(session)` — default for all client-console operations.
  2. `platformClient(session)` — still RLS-governed; platform policies grant cross-tenant read/write.
  3. `serviceClient()` — service-role key. Allowed only in queue workers and webhook handlers;
     each call site carries a `// SERVICE-ROLE JUSTIFICATION:` comment (lint rule planned).
* Social tokens: AES-256-GCM encrypted (`packages/core/src/crypto/tokenVault.ts`), key from
  KMS/env, plaintext never logged and never crosses the API boundary to the browser.
* Impersonation: short-lived claim `impersonating: true` + `impersonation_expires_at`; every
  mint and expiry written to `audit_log`; UI renders a fixed banner whenever the claim is present.

## Provider abstraction (the seam)

`GenerationProvider` and `SocialPublishingProvider` interfaces live in `packages/core`.
Vendor SDK/HTTP code exists **only** inside a concrete provider file. The orchestrator selects
providers via a registry keyed by `(capability, vendor)` from edition/feature flags. Swapping the
video vendor is a one-file change plus a registry entry.

Unconfigured provider ⇒ `ProviderNotConfiguredError` ⇒ job `failed` with a user-visible reason and
a "Coming soon" UI state. Providers never fabricate success.

## Async generation model

Generation request ⇒ quota `checkAndReserve` ⇒ insert `generation_jobs` row ⇒ enqueue ⇒ return
`job_id` immediately. Workers update job status; UI subscribes via realtime or polls
`GET /api/jobs/:id`. Costs are settled against `quota_ledger` on completion (reserve/settle/release
ledger semantics, so a crashed job can't leak quota).

Every stage (idea → image → video) persists `prompt_used`, raw provider output, and a version on
`concept_assets`. Any stage is re-runnable in isolation.

## Theming

Middleware resolves host (custom domain or `{slug}.platform.com`) → `client_id` + active
`theme_versions` row, injected as request headers. The root layout server component fetches theme
tokens before first paint (no flash of wrong brand). Theme configs are versioned; exports reference
the version they were rendered with.

## Decision records

See `/docs/adr/`. Notable: ADR-0001 single codebase / role-gated routing; ADR-0002 pg-boss over
Redis (one fewer stateful dependency until volume demands otherwise); ADR-0003 LinkedIn org-page
posting scope.
