# Changelog

## Unreleased — All phases complete (pending security review + production sign-off)

### Added (Phases 1–5 completion pass)

- **Access groups**: `GET/POST /api/access-groups`, `GET/PATCH/DELETE /api/access-groups/[id]`, `POST/DELETE /api/access-groups/[id]/members`; `checkAccess()` server utility (permission union across groups, brand_admin bypass); Team page at `/app/[clientSlug]/team` with group CRUD and member management.
- **Comments + @mentions**: `GET/POST /api/comments`, `DELETE /api/comments/[id]`; `ConceptComments` client component with threaded replies, @-trigger dropdown, mention notifications; collapsible per-concept on campaign detail page.
- **Supabase Realtime**: GenerateClient replaced 3-second polling with `postgres_changes` subscriptions per job ID; one-shot fetch catches already-complete jobs; per-stage channel refs cleaned up on unmount.
- **Per-stage regenerate**: `POST /api/generation/[jobId]/retry` — re-runs one stage without clearing others; Regenerate buttons on image/video/audio stages in GenerateClient.
- **Email notifications** (Resend): `packages/core/src/email/sender.ts` + `templates.ts`; approval-decided, publish-success, publish-failed, token-expiring events; graceful degradation when `RESEND_API_KEY` unset.
- **Analytics CSV export**: `GET /api/analytics/export` — campaign-level rollup + per-post detail in one CSV; Export CSV button on analytics page.
- **Mobile responsiveness**: `MobileSidebar` client component (hamburger overlay < md, inline ≥ md); both consoles updated; responsive grids on dashboard/analytics/campaigns/platform pages.
- **CI pipeline**: `.github/workflows/ci.yml` — typecheck (all 4 packages), lint, pgTAP RLS tests via Supabase CLI.
- **Sentry**: `@sentry/nextjs` wired in web app (client/server/edge configs, `withSentryConfig` in `next.config.ts`); `@sentry/node` in orchestrator and publisher workers.
- **Billing webhook skeleton**: `POST /api/billing/webhook` — Stripe HMAC-SHA256 verification; handles invoice.paid (quota renewal), invoice.payment_failed + subscription.deleted (client suspend), subscription.updated (plan change); 501 when unconfigured.
- **Load tests**: `tests/load/browse.js`, `tests/load/generation.js`, `tests/load/publish.js` (k6 scripts with thresholds matching `docs/plan/SLOS.md`).
- **SLOs documented**: `docs/plan/SLOS.md` — p95 targets per endpoint class (A/B/C/D) and worker job targets.
- `.env.example` updated: `RESEND_API_KEY`, `EMAIL_FROM`, `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_EDITION_MAP`.

## Unreleased — Phases 1–3 + multi-model generation complete

### Added (multi-model / Phase 2 extension)

- 9 generation providers: Anthropic (text), OpenAI (text + image), Gemini (text), Stability (image), Ideogram (image), Runway (video), Luma (video), ElevenLabs (audio), OpenAI TTS (audio).
- Dynamic provider registry: `getProviderCatalog()` returns 23 `ModelDescriptor` entries; `resolveProvider(capability, vendor?, model?)` resolves at job-dispatch time.
- Audio as 4th generation capability: `AudioResult` type, `generateAudio()` on provider interface, `buildAudioPrompt` in `PromptContextBuilder`, audio branch in orchestrator worker.
- Migration 0005: extends `generation_jobs.capability` and `concept_assets.type` check constraints to include 'audio'; adds `model_preferences` table with per-client per-capability RLS.
- API: `GET /api/providers/catalog` (model catalog with configured flags); `GET/POST /api/model-preferences` (upsert on conflict client+capability).
- Generation API updated: reads model preference from DB when not in request body; passes `model` through `GenerateJobPayload`.
- GenerateClient rewritten: 4-stage UI (concepts → images → video → audio), per-stage model selector dropdown backed by catalog API, optimistic model-preference save.
- Model settings page at `/app/[clientSlug]/settings/models`: provider cards with Ready/Needs key badges and one-click Select.
- `audio_generation` feature flag added to seed editions (Enterprise only); `.env.example` updated with all new provider key names.

### Added (Phases 1–3)

- Web app config: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.js`.
- Auth pages: login + signup (Supabase SSR `signInWithPassword`/`signUp`, redirects by role).
- Internal API: `GET /api/internal/tenant-resolve` — pre-auth tenant slug/domain lookup for Edge middleware.
- Migration 0004: `impersonation_sessions` table with RLS (platform-role only).
- Platform Console pages: clients list + create modal, pipeline overview, editions table, audit log (paginated), quota usage with progress bars, connection health for all social accounts.
- Client API routes: `GET/POST/PATCH/DELETE /api/clients`, `GET /api/editions`.
- Impersonation API: `POST /api/impersonation/start`, `POST /api/impersonation/end`.
- Client Console pages: workspace overview/dashboard, campaigns list + create, campaign detail with concepts, brand profile editor, content calendar (week view, prev/next nav), analytics dashboard (rollup + per-post breakdown).
- Client API routes: campaigns CRUD, concepts CRUD, brand profile upsert, approvals request + decide (cascades to asset/concept status), scheduled posts create/reschedule/cancel, notifications list + mark-read.
- 3-stage generation UI: concept brief → image variants → video reel — all async with job polling, concept locking, approval request flow.
- Social connections page: per-platform status, connect/reconnect links, Coming-soon badges for TikTok/X.
- Social OAuth: `GET /api/social/connect/[platform]` (state cookie + redirect), `GET /api/social/callback/[platform]` (token exchange, AES-256-GCM encrypt, upsert social_accounts).
- `GET /api/social/accounts` — lists accounts without exposing encrypted tokens.
- `GET /api/assets/[id]` — single concept asset for generation result polling.
- YouTube provider (`YouTubeProvider`): resumable upload API, statistics metrics, refresh token flow.
- LinkedIn provider (`LinkedInProvider`): register upload → binary PUT → `ugcPosts` publish, `organizationalEntityShareStatistics` metrics, refresh token flow.
- Publishing index (`getPublishingProvider` factory) — publisher worker updated to use it.
- Service package.json files for orchestrator + publisher.

## Phase 0 foundation

- Monorepo scaffold: web app, core package, orchestrator + publisher services.
- Migration 0001: full core schema (16 tables incl. generation_jobs, quota_ledger, theme_versions).
- Migration 0002: RLS on all tenant tables — claim helpers, tenant policies, explicit platform
  policies, SECURITY DEFINER audit writer, token columns revoked from client selects.
- GenerationProvider abstraction + Anthropic (text), Stability (image), Runway (video) providers.
- SocialPublishingProvider abstraction + Instagram/Facebook Graph API providers; TikTok/X honest stubs.
- PromptContextBuilder, QuotaService (reserve/settle/release ledger), AES-256-GCM token vault.
- pg-boss generation worker; tenant/domain-resolving middleware with pre-paint theme headers.
- Migration 0003: auth custom-access-token hook (claims at mint), impersonation_sessions
  with time-boxed audit-logged minting.
- pgTAP RLS test suite (12 assertions) simulating real authenticated sessions.
- Async generation API: POST /api/generation (RLS job insert, edition gate, quota reserve,
  enqueue, 202 + jobId) and GET /api/jobs/:id status poll. Core package typechecks strict.
- Theme engine: server-side pre-paint resolution, versioned tokens as CSS variables;
  root layout, Client Console shell (tenant-branded), Platform Console shell,
  uncloseable impersonation banner.
- Publisher worker: publish path with approval/connection guardrails and verbatim
  publish_response; hourly proactive token refresh; cadenced analytics pull.
- Staging seed: 3 editions + demo tenant with themed workspace.
