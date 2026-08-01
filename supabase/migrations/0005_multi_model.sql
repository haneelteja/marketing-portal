-- 0005_multi_model.sql
-- Adds audio as a generation capability, extends concept_assets to store audio,
-- and introduces the model_preferences table for per-client provider/model selection.

-- ── 1. Extend generation_jobs.capability to include 'audio' ──────────────────
-- Postgres CHECK constraints can't be altered in-place; drop and recreate.
alter table generation_jobs
  drop constraint if exists generation_jobs_capability_check;

alter table generation_jobs
  add constraint generation_jobs_capability_check
  check (capability in ('text', 'image', 'video', 'audio'));

-- ── 2. Extend concept_assets.type to include 'audio' ─────────────────────────
alter table concept_assets
  drop constraint if exists concept_assets_type_check;

alter table concept_assets
  add constraint concept_assets_type_check
  check (type in ('image', 'video', 'copy', 'audio'));

-- ── 3. model_preferences — per-client provider/model selection ────────────────
-- One row per (client, capability). Upserted by the settings UI; read by the
-- orchestrator worker to resolve the correct provider for each generation job.
create table model_preferences (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references clients(id) on delete cascade,
  capability  text not null check (capability in ('text', 'image', 'video', 'audio')),
  vendor      text not null,   -- e.g. 'anthropic', 'openai', 'stability', 'elevenlabs'
  model       text not null,   -- e.g. 'claude-opus-4-7', 'gpt-image-1', 'eleven_multilingual_v2'
  options     jsonb not null default '{}',  -- provider-specific knobs (voice_id, style, etc.)
  updated_at  timestamptz not null default now(),
  unique (client_id, capability)
);

-- RLS: tenant-scoped reads/writes; platform can read all.
alter table model_preferences enable row level security;

create policy model_preferences_tenant_select on model_preferences
  for select using (client_id = (auth.jwt() ->> 'client_id')::uuid);

create policy model_preferences_tenant_write on model_preferences
  for all
  using (client_id = (auth.jwt() ->> 'client_id')::uuid)
  with check (
    client_id = (auth.jwt() ->> 'client_id')::uuid
    and (auth.jwt() ->> 'client_role') in ('brand_admin', 'brand_editor')
  );

create policy model_preferences_platform_all on model_preferences
  for all using ((auth.jwt() ->> 'platform_role') is not null);
