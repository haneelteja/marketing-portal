# Deployment Runbook

Step-by-step guide from a fresh clone to a running production environment.

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | 22 | `nvm install 22` |
| pnpm | 9 | `npm i -g pnpm@9` |
| Supabase CLI | latest | `brew install supabase/tap/supabase` |
| k6 (load tests only) | latest | `brew install k6` |
| Vercel CLI (optional) | latest | `pnpm i -g vercel` |

---

## 1. Clone and install

```bash
git clone <repo-url> agency-platform
cd agency-platform
pnpm install
```

---

## 2. Supabase project

### 2a. Create a project
1. Go to [supabase.com](https://supabase.com) → New project.
2. Note: Project URL, anon key, service role key, database password.

### 2b. Run migrations
```bash
# Against remote project
supabase db push --db-url "postgresql://postgres:<password>@<host>:5432/postgres"

# Or link + push
supabase link --project-ref <ref>
supabase db push
```

### 2c. Run seed (staging only)
```bash
supabase db reset --db-url "..." --file supabase/seed.sql
```

### 2d. Enable Realtime on generation_jobs
In the Supabase dashboard → Database → Replication → enable `generation_jobs` table.

### 2e. Deploy the auth hook
The custom access token hook in `supabase/migrations/0003_auth_claims_hook.sql` adds
JWT claims at mint time. After running migrations, enable it in:
Dashboard → Auth → Hooks → Custom Access Token → select the `public.custom_access_token` function.

---

## 3. Environment variables

Copy `.env.example` to `apps/web/.env.local` and fill in every value:

```bash
cp .env.example apps/web/.env.local
```

Key groups:

| Group | Required for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` + `ANON_KEY` | All client-side Supabase calls |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side admin queries |
| `DATABASE_URL_SERVICE` | pg-boss workers (`postgresql://...`) |
| `TOKEN_VAULT_KEY` | AES-256-GCM token encryption |
| `INTERNAL_API_KEY` | Middleware → tenant-resolve route |
| `ANTHROPIC_API_KEY` | Text generation (minimum viable) |
| `RESEND_API_KEY` + `EMAIL_FROM` | Email notifications |
| `NEXT_PUBLIC_SENTRY_DSN` + `SENTRY_DSN` | Error tracking |
| `META_APP_ID/SECRET` | Instagram/Facebook OAuth |
| `GOOGLE_OAUTH_CLIENT_ID/SECRET` | YouTube OAuth |
| `LINKEDIN_CLIENT_ID/SECRET` | LinkedIn OAuth |

The AI provider keys are optional — missing keys show "Coming soon" or "Needs API key" in the UI; the app never fakes success.

---

## 4. Deploy to Vercel

### 4a. Import project
1. `vercel link` (or import via dashboard)
2. Set **Root Directory** to `apps/web`
3. Framework: Next.js (auto-detected)

### 4b. Configure build (automatic via `apps/web/vercel.json`)
The `vercel.json` sets:
- `installCommand`: installs from repo root so workspace packages resolve
- `buildCommand`: runs `turbo build --filter=@platform/web`
- Function timeouts per route

### 4c. Add env vars
```bash
# Pull current vars (if re-deploying)
vercel env pull apps/web/.env.local

# Or add individually
vercel env add ANTHROPIC_API_KEY production
```

Push all vars from `.env.local`:
```bash
# One-liner for all vars in .env.local
while IFS='=' read -r key val; do
  [[ "$key" =~ ^#|^$ ]] && continue
  echo "$val" | vercel env add "$key" production --force 2>/dev/null || true
done < apps/web/.env.local
```

### 4d. Deploy
```bash
vercel --prod
# or
pnpm turbo build --filter=@platform/web && vercel deploy --prebuilt
```

---

## 5. Deploy workers

The orchestrator and publisher workers are long-running Node.js processes, not serverless.
Deploy them to a VPS, Railway, Fly.io, or any persistent compute:

```bash
# Build
pnpm turbo build --filter=@platform/orchestrator --filter=@platform/publisher

# Run (each needs DATABASE_URL_SERVICE + provider API keys)
node services/orchestrator/dist/worker.js &
node services/publisher/dist/worker.js &
```

Workers read all env vars from the process environment. Use a `.env` file or your
platform's secret manager — they never read from `.env.local`.

### Required worker env vars
```
DATABASE_URL_SERVICE=postgresql://...
ANTHROPIC_API_KEY=...   # (and any other AI provider keys you've configured)
RESEND_API_KEY=...
EMAIL_FROM=...
SENTRY_DSN=...
```

---

## 6. Verify deployment

1. Visit `https://<your-domain>/login` — should load the login page.
2. Sign in as a platform admin — should redirect to `/platform`.
3. Create a test client via `/platform` → "New client".
4. Open the client workspace → `/app/<slug>` → Run a text generation job.
5. Watch `supabase logs` or Sentry for any errors.

---

## 7. Local development

```bash
# Start Supabase locally
supabase start

# Start the web app
pnpm --filter @platform/web dev

# Start workers (separate terminals)
pnpm --filter @platform/orchestrator dev
pnpm --filter @platform/publisher dev
```

Local Supabase URL: `http://127.0.0.1:54321`
Studio: `http://127.0.0.1:54323`

---

## 8. Run load tests (staging)

```bash
# Install k6: https://grafana.com/docs/k6/latest/get-started/installation/

# Browse scenario (50 concurrent users, 5 min)
BASE_URL=https://staging.yourplatform.com JWT=<token> k6 run tests/load/browse.js

# Generation submission (10 VUs, text only — quota aware)
BASE_URL=... JWT=... CAMPAIGN_ID=<uuid> k6 run tests/load/generation.js
```

Results should meet the p95 targets in `docs/plan/SLOS.md`.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| 401 on all API routes | JWT not minting custom claims | Check auth hook is enabled in Supabase dashboard |
| "Provider not configured" | Missing API key | Add the relevant env var and redeploy |
| Worker not processing jobs | `DATABASE_URL_SERVICE` missing or pg-boss schema not initialised | Ensure migrations ran; check worker logs |
| Realtime not updating UI | `generation_jobs` table not in Replication | Enable in Supabase dashboard → Replication |
| Email not sending | `RESEND_API_KEY` unset | Set the key or ignore (graceful degradation) |
| Billing webhook 501 | `STRIPE_WEBHOOK_SECRET` unset | Set via `vercel env add STRIPE_WEBHOOK_SECRET` |
