-- 0007_fixes.sql
-- Batch of correctness fixes identified by code audit.

-- ── 1. public.write_audit wrapper ────────────────────────────────────────────
-- PostgREST resolves db.rpc('write_audit') in the public schema.
-- The actual SECURITY DEFINER function lives in auth_ext.
-- This public wrapper delegates to it so app-layer audit() calls work.
create or replace function public.write_audit(
  p_action      text,
  p_target_type text default null,
  p_target_id   text default null,
  p_diff        jsonb default null
)
returns void
language sql
security definer
set search_path = public, auth_ext
as $$
  insert into public.audit_log (actor_id, action, target_type, target_id, diff)
  values (
    (select id from public.users where auth_id = auth.uid()),
    p_action,
    p_target_type,
    p_target_id,
    p_diff
  );
$$;

-- ── 2. Fix impersonation_sessions schema conflict ─────────────────────────────
-- Migration 0003 created the table with `reason text not null`.
-- Migration 0004 is a no-op (IF NOT EXISTS). Make reason nullable so the
-- impersonation/start route can omit it.
alter table impersonation_sessions
  alter column reason drop not null;

-- actor_id in 0003 references public.users(id). Confirm it also accepts
-- a lookup-by-auth_id approach (no schema change needed — the app code
-- will query users.id by auth_id before inserting).

-- ── 3. Analytics snapshot deduplication constraint ────────────────────────────
-- Prevent duplicate rows from repeated analytics pulls on the same post/metric/day.
create unique index if not exists analytics_snapshots_dedup
  on analytics_snapshots (scheduled_post_id, metric_type, (created_at::date));

-- ── 4. Supabase Storage bucket DDL note ───────────────────────────────────────
-- The 'generated-assets' bucket must be created via Supabase Dashboard:
--   Storage → New bucket → Name: generated-assets → Public: true
-- This migration cannot create buckets (Storage API, not SQL).
