-- 0008_phase2.sql
-- Phase 2: product catalog, media library, creation method tagging, per-platform config

-- ---------- Creation method tagging on concept_assets ----------
alter table concept_assets
  add column if not exists creation_method text
    check (creation_method in ('web', 'ai_generated', 'autopost'))
    default 'web';

-- ---------- Product catalog ----------
create table if not exists product_catalog (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references clients(id) on delete cascade,
  name        text not null,
  description text,
  price       numeric(12,2),
  currency    text not null default 'USD',
  image_url   text,
  category    text,
  tags        text[] not null default '{}',
  active      boolean not null default true,
  created_by  uuid references users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index product_catalog_client on product_catalog (client_id, active, created_at desc);

-- ---------- Media library ----------
create table if not exists media_library (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references clients(id) on delete cascade,
  name        text not null,
  url         text not null,
  mime_type   text not null,
  size_bytes  bigint,
  tags        text[] not null default '{}',
  source      text not null default 'upload'
              check (source in ('upload', 'ai_generated', 'brand_kit')),
  created_by  uuid references users(id),
  created_at  timestamptz not null default now()
);
create index media_library_client on media_library (client_id, source, created_at desc);
create index media_library_tags on media_library using gin (tags);

-- ---------- RLS policies ----------

-- product_catalog: client members can read; brand_admin/editor can write
alter table product_catalog enable row level security;

create policy "product_catalog: client members read"
  on product_catalog for select
  using ((auth.jwt() ->> 'client_id')::uuid = client_id);

create policy "product_catalog: brand_admin/editor write"
  on product_catalog for all
  using (
    (auth.jwt() ->> 'client_id')::uuid = client_id
    and (auth.jwt() ->> 'client_role') in ('brand_admin', 'brand_editor')
  );

-- media_library: client members can read; brand_admin/editor can write
alter table media_library enable row level security;

create policy "media_library: client members read"
  on media_library for select
  using ((auth.jwt() ->> 'client_id')::uuid = client_id);

create policy "media_library: brand_admin/editor write"
  on media_library for all
  using (
    (auth.jwt() ->> 'client_id')::uuid = client_id
    and (auth.jwt() ->> 'client_role') in ('brand_admin', 'brand_editor')
  );

-- Platform admin can see all (for support / auditing)
create policy "product_catalog: platform_all read"
  on product_catalog for select
  using ((auth.jwt() ->> 'platform_role') is not null);

create policy "media_library: platform_all read"
  on media_library for select
  using ((auth.jwt() ->> 'platform_role') is not null);

-- ---------- updated_at trigger for product_catalog ----------
create or replace function update_product_catalog_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger trg_product_catalog_updated_at
  before update on product_catalog
  for each row execute function update_product_catalog_updated_at();
