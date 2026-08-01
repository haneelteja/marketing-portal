-- 0002_rls_policies.sql
-- Row Level Security is the tenant boundary (spec §1.2, §13).
-- Claims contract (stamped at token mint, see docs/adr/ADR-0004-claims.md):
--   platform_role : 'platform_admin' | 'account_manager' | 'creative_ops' | null
--   client_id     : uuid | null
--   client_role   : 'brand_admin' | 'brand_editor' | 'brand_viewer' | null
--
-- Helper functions read claims once; policies stay declarative and testable.

create schema if not exists auth_ext;

create or replace function auth_ext.jwt_client_id() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'client_id','')::uuid
$$;

create or replace function auth_ext.jwt_platform_role() returns text
language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'platform_role','')
$$;

create or replace function auth_ext.jwt_client_role() returns text
language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'client_role','')
$$;

create or replace function auth_ext.is_platform() returns boolean
language sql stable as $$ select auth_ext.jwt_platform_role() is not null $$;

create or replace function auth_ext.can_write_client() returns boolean
language sql stable as $$
  select auth_ext.jwt_client_role() in ('brand_admin','brand_editor')
$$;

-- ---------------------------------------------------------------------------
-- Macro-style policy application. For each tenant table:
--   * tenant_select : same-tenant read for any client role
--   * tenant_write  : same-tenant insert/update/delete for admin+editor
--   * platform_all  : explicit platform-role full access (NOT service-role)
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'brand_profiles','theme_versions','campaigns','concepts','concept_assets',
    'generation_jobs','quota_ledger','social_accounts','scheduled_posts',
    'approvals','comments','analytics_snapshots','audit_log'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);

    execute format($p$
      create policy tenant_select on %I for select
      using (client_id = auth_ext.jwt_client_id())
    $p$, t);

    execute format($p$
      create policy tenant_insert on %I for insert
      with check (client_id = auth_ext.jwt_client_id() and auth_ext.can_write_client())
    $p$, t);

    execute format($p$
      create policy tenant_update on %I for update
      using (client_id = auth_ext.jwt_client_id() and auth_ext.can_write_client())
      with check (client_id = auth_ext.jwt_client_id())
    $p$, t);

    execute format($p$
      create policy tenant_delete on %I for delete
      using (client_id = auth_ext.jwt_client_id() and auth_ext.jwt_client_role() = 'brand_admin')
    $p$, t);

    execute format($p$
      create policy platform_all on %I for all
      using (auth_ext.is_platform())
      with check (auth_ext.is_platform())
    $p$, t);
  end loop;
end $$;

-- Table-specific tightening --------------------------------------------------

-- audit_log: tenant users may read their own tenant's log but never write/alter it.
drop policy tenant_insert on audit_log;
drop policy tenant_update on audit_log;
drop policy tenant_delete on audit_log;
-- Writes to audit_log occur via SECURITY DEFINER function only.
create or replace function auth_ext.write_audit(
  p_action text, p_target_type text, p_target_id uuid, p_diff jsonb
) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into audit_log (actor_id, client_id, action, target_type, target_id, diff)
  select u.id, coalesce(u.client_id, auth_ext.jwt_client_id()), p_action, p_target_type, p_target_id, p_diff
  from users u
  where u.auth_id = nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub','')::uuid;
end $$;

-- quota_ledger: tenants read-only; only workers (service role, justified) and platform write.
drop policy tenant_insert on quota_ledger;
drop policy tenant_update on quota_ledger;
drop policy tenant_delete on quota_ledger;

-- social_accounts: encrypted token columns are additionally hidden from client roles via a view;
-- direct column grants revoked so tokens never reach the frontend even same-tenant.
revoke select (access_token_encrypted, refresh_token_encrypted) on social_accounts from authenticated;

-- clients / editions / users / access groups ---------------------------------
alter table clients enable row level security;
alter table clients force row level security;
create policy client_reads_self on clients for select using (id = auth_ext.jwt_client_id());
create policy platform_clients on clients for all
  using (auth_ext.is_platform()) with check (auth_ext.is_platform());

alter table client_editions enable row level security;
create policy edition_read on client_editions for select using (true); -- non-sensitive tier metadata
create policy platform_editions on client_editions for all
  using (auth_ext.jwt_platform_role() = 'platform_admin')
  with check (auth_ext.jwt_platform_role() = 'platform_admin');

alter table access_groups enable row level security;
create policy groups_same_tenant on access_groups for select
  using (client_id = auth_ext.jwt_client_id());
create policy groups_admin_write on access_groups for all
  using (client_id = auth_ext.jwt_client_id() and auth_ext.jwt_client_role() = 'brand_admin')
  with check (client_id = auth_ext.jwt_client_id());
create policy platform_groups on access_groups for all
  using (auth_ext.is_platform()) with check (auth_ext.is_platform());

alter table users enable row level security;
create policy user_reads_self on users for select
  using (auth_id = nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub','')::uuid);
create policy user_reads_same_tenant on users for select
  using (client_id is not null and client_id = auth_ext.jwt_client_id());
create policy platform_users on users for all
  using (auth_ext.is_platform()) with check (auth_ext.is_platform());

alter table notifications enable row level security;
create policy notif_own on notifications for select
  using (user_id = (select id from users where auth_id =
        nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub','')::uuid));
create policy notif_mark_read on notifications for update
  using (user_id = (select id from users where auth_id =
        nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub','')::uuid));

-- NOTE ON TESTING (§17): these policies are only "done" once
-- tests in /supabase/tests/rls.test.sql run in CI against a real Postgres:
--   1. mint tenant-A JWT, attempt select/insert on tenant-B rows -> must fail
--   2. mint brand_viewer JWT, attempt insert -> must fail
--   3. mint platform_admin JWT -> cross-tenant read succeeds and is audit-logged at app layer
