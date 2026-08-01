-- rls.test.sql — pgTAP tenant-isolation tests (spec §17: "RLS enforced" is not done
-- until an authenticated session, tested directly, cannot touch another tenant's rows).
-- Run in CI: `supabase test db`. Simulates PostgREST by setting role + request.jwt.claims,
-- which is exactly what the API gateway does — so these tests exercise the real policy path.

begin;
select plan(12);

-- ---- fixtures ---------------------------------------------------------------
insert into client_editions (id, name) values
  ('00000000-0000-0000-0000-00000000e001', 'Test Edition');
insert into clients (id, name, slug, edition_id) values
  ('00000000-0000-0000-0000-0000000000a1', 'Tenant A', 'tenant-a', '00000000-0000-0000-0000-00000000e001'),
  ('00000000-0000-0000-0000-0000000000b1', 'Tenant B', 'tenant-b', '00000000-0000-0000-0000-00000000e001');
insert into users (id, auth_id, email, client_id, client_role) values
  ('00000000-0000-0000-0000-0000000000u1', '00000000-0000-0000-0000-0000000000f1',
   'admin-a@test.dev', '00000000-0000-0000-0000-0000000000a1', 'brand_admin'),
  ('00000000-0000-0000-0000-0000000000u2', '00000000-0000-0000-0000-0000000000f2',
   'viewer-a@test.dev', '00000000-0000-0000-0000-0000000000a1', 'brand_viewer');
insert into users (id, auth_id, email, platform_role) values
  ('00000000-0000-0000-0000-0000000000u9', '00000000-0000-0000-0000-0000000000f9',
   'staff@agency.dev', 'platform_admin');
insert into campaigns (id, client_id, name) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', 'A campaign'),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000b1', 'B campaign');

-- ---- helper to assume an authenticated session ------------------------------
create or replace function test_login(p_sub uuid, p_claims jsonb) returns void
language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    (jsonb_build_object('sub', p_sub) || p_claims)::text, true);
end $$;

-- ---- 1–4: tenant A brand_admin ---------------------------------------------
select test_login('00000000-0000-0000-0000-0000000000f1',
  '{"client_id":"00000000-0000-0000-0000-0000000000a1","client_role":"brand_admin"}');

select is( (select count(*) from campaigns)::int, 1,
  'tenant A sees exactly its own campaign');
select is( (select name from campaigns limit 1), 'A campaign',
  'and it is the right one');
select lives_ok(
  $$ insert into campaigns (client_id, name)
     values ('00000000-0000-0000-0000-0000000000a1', 'A second') $$,
  'brand_admin can insert into own tenant');
select throws_ok(
  $$ insert into campaigns (client_id, name)
     values ('00000000-0000-0000-0000-0000000000b1', 'forged') $$,
  '42501', null,
  'cross-tenant insert is rejected by RLS');

-- ---- 5–6: cross-tenant writes are invisible no-ops or denied ---------------
select is(
  (select count(*) from campaigns where client_id = '00000000-0000-0000-0000-0000000000b1')::int, 0,
  'tenant B rows are invisible to tenant A even by direct predicate');
update campaigns set name = 'hijacked' where id = '00000000-0000-0000-0000-0000000000c2';
select is(
  (select name from campaigns where id = '00000000-0000-0000-0000-0000000000c2'), null,
  'cross-tenant update affects zero visible rows');

-- ---- 7–8: brand_viewer is read-only ----------------------------------------
select test_login('00000000-0000-0000-0000-0000000000f2',
  '{"client_id":"00000000-0000-0000-0000-0000000000a1","client_role":"brand_viewer"}');
select is( (select count(*) > 0 from campaigns), true, 'viewer can read own tenant');
select throws_ok(
  $$ insert into campaigns (client_id, name)
     values ('00000000-0000-0000-0000-0000000000a1', 'viewer write') $$,
  '42501', null, 'viewer cannot write');

-- ---- 9: audit log is append-only via function, not direct insert -----------
select test_login('00000000-0000-0000-0000-0000000000f1',
  '{"client_id":"00000000-0000-0000-0000-0000000000a1","client_role":"brand_admin"}');
select throws_ok(
  $$ insert into audit_log (action) values ('forged.entry') $$,
  '42501', null, 'direct audit_log insert denied');

-- ---- 10: token columns never readable by client roles ----------------------
select throws_ok(
  $$ select access_token_encrypted from social_accounts limit 1 $$,
  '42501', null, 'encrypted token column revoked from authenticated role');

-- ---- 11–12: platform role has explicit cross-tenant access ------------------
select test_login('00000000-0000-0000-0000-0000000000f9',
  '{"platform_role":"platform_admin"}');
select is( (select count(*) from campaigns)::int, 3,
  'platform_admin sees all tenants via explicit policy');
select lives_ok(
  $$ update campaigns set status='active'
     where id='00000000-0000-0000-0000-0000000000c2' $$,
  'platform_admin can write cross-tenant');

select * from finish();
rollback;
