-- 0003_auth_claims_hook.sql
-- Supabase Custom Access Token Hook: stamps platform_role / client_id / client_role
-- (and impersonation context) into every JWT at mint time (ADR-0004).
-- Registered in supabase/config.toml: [auth.hook.custom_access_token] enabled, uri =
-- "pg-functions://postgres/auth_ext/custom_access_token_hook".

create table impersonation_sessions (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid not null references users(id),      -- platform staff member
  client_id   uuid not null references clients(id),
  expires_at  timestamptz not null,
  ended_at    timestamptz,
  reason      text not null,
  created_at  timestamptz not null default now()
);
alter table impersonation_sessions enable row level security;
create policy platform_impersonation on impersonation_sessions for all
  using (auth_ext.is_platform()) with check (auth_ext.is_platform());

create or replace function auth_ext.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  claims jsonb := event -> 'claims';
  u record;
  imp record;
begin
  select id, platform_role, client_id, client_role
    into u
    from users
   where auth_id = (event ->> 'user_id')::uuid;

  if not found then
    return event;  -- pre-provisioned auth user; app finishes provisioning on first login
  end if;

  claims := claims
    || jsonb_build_object('platform_role', u.platform_role)
    || jsonb_build_object('client_id',     u.client_id)
    || jsonb_build_object('client_role',   u.client_role);

  -- Active impersonation grants a time-boxed client context WITHOUT changing the
  -- actor identity. Mint is audit-logged here; UI banner keys off `impersonating`.
  if u.platform_role is not null then
    select * into imp
      from impersonation_sessions
     where actor_id = u.id and ended_at is null and expires_at > now()
     order by created_at desc limit 1;
    if found then
      claims := claims
        || jsonb_build_object('client_id', imp.client_id)
        || jsonb_build_object('client_role', 'brand_admin')
        || jsonb_build_object('impersonating', true)
        || jsonb_build_object('impersonation_expires_at', imp.expires_at);
      insert into audit_log (actor_id, client_id, action, target_type, target_id)
      values (u.id, imp.client_id, 'impersonation.token_minted', 'impersonation_session', imp.id);
    end if;
  end if;

  return jsonb_set(event, '{claims}', claims);
end $$;

grant execute on function auth_ext.custom_access_token_hook to supabase_auth_admin;
revoke execute on function auth_ext.custom_access_token_hook from authenticated, anon, public;
