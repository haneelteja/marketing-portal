-- 0004_impersonation_sessions.sql
-- Time-boxed support impersonation sessions (spec §5.1).
-- Audit trail is already handled by the write_audit SECURITY DEFINER function;
-- this table just tracks the session state so the UI banner knows when it expires.

create table if not exists impersonation_sessions (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references users(id) on delete set null,  -- platform user performing support
  client_id   uuid not null references clients(id) on delete cascade,
  expires_at  timestamptz not null,
  ended_at    timestamptz,
  created_at  timestamptz not null default now()
);

create index impersonation_active on impersonation_sessions (actor_id)
  where ended_at is null;

-- RLS: only platform roles can insert/select; no client-role access.
alter table impersonation_sessions enable row level security;

create policy impersonation_platform_all on impersonation_sessions
  for all
  using (
    (auth.jwt() ->> 'platform_role') is not null
  )
  with check (
    (auth.jwt() ->> 'platform_role') is not null
  );
