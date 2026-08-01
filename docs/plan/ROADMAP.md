# Delivery Roadmap & Master To-Do List

Status legend: `[ ]` not started · `[~]` in progress · `[x]` done (meets its acceptance criteria, not "compiles")

A task is only `[x]` when its acceptance criteria (§17 of the spec) pass. "Wired but the external
call is commented out" is `[ ]`, never `[x]`.

---

## Phase 0 — Foundation (weeks 1–2)

### 0.1 Repository & tooling

- [x] Monorepo layout (`apps/web`, `packages/core`, `services/orchestrator`, `services/publisher`)
- [x] Single `ARCHITECTURE.md`, single `CHANGELOG.md`, `/docs/runbooks/`, `/docs/adr/` — no root-level scratch files
- [x] CI pipeline: lint + typecheck + unit tests + RLS integration tests gate merges
- [x] Sentry (or equivalent) wired in web app and both services from first deploy

### 0.2 Data model + RLS

- [x] Migration 0001: full core schema (clients, editions, users, brand_profiles, campaigns,
      concepts, concept_assets, social_accounts, scheduled_posts, approvals,
      analytics_snapshots, notifications, audit_log, generation_jobs, quota_ledger, theme_versions)
- [x] Migration 0002: RLS on every tenant-scoped table — client-claim policies + explicit
      platform-role policies; **no blanket service-role dependence**
- [x] Migration 0004: `impersonation_sessions` table with platform-role RLS
- [x] RLS integration test harness (`supabase/tests/rls.test.sql`, 12 pgTAP assertions:
      tenant isolation, viewer read-only, append-only audit, token-column revocation,
      explicit platform access) — CI wiring tracked under 0.1

### 0.3 Auth & role routing

- [x] JWT custom-claims contract (`platform_role`, `client_id`, `client_role`) — `packages/core` types + web claim parser
- [x] Middleware: custom-domain / slug → `client_id` resolution + route gating (`/platform/*` vs `/app/{clientSlug}/*`)
- [x] Internal tenant-resolve API (`GET /api/internal/tenant-resolve`) — pre-auth slug/domain lookup for middleware
- [x] Supabase Auth custom-access-token hook stamps claims at mint (migration 0003)
- [x] Impersonation: sessions table (migration 0004) + audit-logged start/end API endpoints + persistent banner

### 0.4 Console shells + theme engine skeleton

- [x] Platform Console shell (nav for clients/pipeline/connections/quotas/editions/audit)
- [x] Client Console shell themed at runtime from `theme_versions` tokens
- [x] Theme resolution before first paint (middleware injects theme version header; server component fetches tokens)

## Phase 1 — Core agency workflow (weeks 3–5)

- [x] Client onboarding flow (create client, slug, edition — modal in Platform Console `/platform`) + runbook `docs/runbooks/client-onboarding.md`
- [x] Brand profile editor: brand voice, tone, audience, logo URL, color palette JSON, typography JSON; saved via `POST /api/brand`
- [x] Campaign / concept CRUD — campaigns list + create, campaign detail with concepts, manual concept add, `PATCH /api/concepts/:id` for status
- [x] Generic approvals engine — `POST /api/approvals` (request), `PATCH /api/approvals/:id` (decide: cascades to asset/concept status), ApproveButton component
- [x] Content calendar — 7-day week grid, prev/next nav via `?week=` search param, per-day post cards
- [x] Access groups: permission union evaluation (`checkAccess` utility), CRUD API, team management UI at `/team`, nav link added
- [x] Comment threads + @mentions on concepts/assets — `GET/POST /api/comments`, `DELETE /api/comments/:id`, `ConceptComments` client component with @-dropdown, threaded replies, mention notifications

## Phase 2 — AI generation (weeks 6–8)

- [x] `GenerationProvider` abstraction (`packages/core/src/providers/generation/types.ts`)
- [x] Anthropic text provider — real `/v1/messages` call, structured concept output
- [x] Image provider (Stability) — real API path; if unconfigured, throws visible `ProviderNotConfiguredError`
- [x] Video provider (Runway) — task-based polling with backoff; same abstraction
- [x] `PromptContextBuilder` — single place brand voice/palette/audience/platform constraints are assembled
- [x] Quota enforcement point (`QuotaService.checkAndReserve`) called **before** every generation; actual cost settled after
- [x] Async job model: `generation_jobs` table + pg-boss queue; UI polls/subscribes, never blocks an HTTP request
- [x] 3-stage generation UI: concept brief → poll → lock concept → image variants → poll → video reel → poll
- [x] Job status polling (`GET /api/jobs/:id`) with 3-second client-side interval + cleanup on unmount
- [x] Multi-provider model selection: 9 providers (Anthropic, OpenAI, Gemini, Stability, Ideogram, Runway, Luma, ElevenLabs, OpenAI TTS); dynamic registry with `getProviderCatalog()` + `resolveProvider()`
- [x] Audio generation (4th capability): ElevenLabs + OpenAI TTS providers; `buildAudioPrompt`; 4-stage GenerateClient UI; audio concept_asset type
- [x] Migration 0005: extends `generation_jobs.capability` + `concept_assets.type` to include 'audio'; `model_preferences` table with RLS
- [x] Per-client model preferences: `GET/POST /api/model-preferences`; model settings page at `/settings/models` with per-capability provider cards
- [x] `GET /api/providers/catalog` — returns full `ModelDescriptor[]` including configured status based on env vars
- [x] Supabase Realtime channel per job — `createBrowserClient` subscription on `generation_jobs` filtered by id; one-shot fetch catches already-complete jobs; channel refs cleaned up on unmount
- [x] Regenerate-single-variant — `POST /api/generation/[jobId]/retry`; Regenerate buttons per stage in GenerateClient; appends results without clearing other stages

## Phase 3 — Social publishing (weeks 9–11)

Order: Instagram+Facebook (shared Graph API) → YouTube → LinkedIn. One platform must pass its
acceptance test (post visible on the real account) before the next begins.

- [x] `SocialPublishingProvider` abstraction + per-platform capability descriptors
- [x] Meta (IG/FB) provider — real Graph API publish path (container → publish for IG)
- [x] Token vault: AES-256-GCM at rest, never logged, never serialized to the frontend
- [x] OAuth connect flows: `GET /api/social/connect/[platform]` + `GET /api/social/callback/[platform]` for instagram, facebook, youtube, linkedin
- [x] Proactive token refresh job (hourly, 48h lookahead); refresh failure marks `expired` immediately + notifies user
- [x] `publish_response` jsonb recorded verbatim, including platform post ID
- [x] YouTube resumable upload provider (`YouTubeProvider`) — two-step initiate + PUT stream
- [x] LinkedIn org-page provider (`LinkedInProvider`) — register upload → binary PUT → `ugcPosts`; ADR-0003 scope
- [x] TikTok / X: `NotImplementedProvider` stubs — UI shows "Coming soon", backend throws `PublishError`
- [x] Social connections page — per-platform status, connect/reconnect buttons, token expiry display
- [x] `GET /api/social/accounts` — platform/status/expiry only; encrypted tokens never leave the server

## Phase 4 — Video generation + polish (weeks 12–14)

- [x] Analytics pull job (1h post-publish, daily 7 days, weekly after) — publisher worker
- [x] Analytics dashboard — rollup stat cards + per-post breakdown with metrics
- [x] In-app notifications — `notifications` table + `GET /api/notifications` + mark-read
- [x] Email notifications — Resend via `packages/core/src/email/`; approval decided, publish success/fail, token expiry events; graceful degradation when `RESEND_API_KEY` unset
- [x] Cross-platform analytics CSV export — `GET /api/analytics/export` (campaign rollup + post detail sections); Export CSV button on analytics page
- [x] Mobile responsiveness — `MobileSidebar` client component (hamburger overlay on < md, inline on ≥ md); wired into both Client and Platform Console layouts; responsive grid breakpoints on dashboard/analytics/campaigns
- [ ] Security review: RLS policies replayed against real traffic logs

## Phase 5 — Hardening (weeks 15–16)

- [x] Load test scripts — `tests/load/browse.js`, `tests/load/generation.js`, `tests/load/publish.js` (k6); p95 targets documented in `docs/plan/SLOS.md`
- [x] Billing hook skeleton — `POST /api/billing/webhook` (Stripe HMAC-SHA256 signature verification, handles `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`, `customer.subscription.updated`); returns 501 when `STRIPE_WEBHOOK_SECRET` unset
- [~] Staging tenant seed (`supabase/seed.sql`: 3 editions + Demo Coffee Co. with themed workspace) done; production runbook sign-off pending

---

## Standing rules (from §15 Anti-Patterns — enforced in code review)

1. No feature route whose core external call is faked. Unready = visible "Coming soon" + `ProviderNotConfiguredError` server-side.
2. Client-console requests always use the RLS-scoped client. Every service-role usage carries an inline `// SERVICE-ROLE JUSTIFICATION:` comment.
3. Debug notes never become permanent root markdown. One line in `CHANGELOG.md`, delete scratch.
4. No empty V2/V3 folders. Versioning lives in git.
5. No synchronous image/video generation. Ever.
