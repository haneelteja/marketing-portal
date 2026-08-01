-- 0001_core_schema.sql
-- Full core data model (spec §4, extended with generation_jobs, quota_ledger, theme_versions).
-- Conventions: uuid PKs, timestamptz, every tenant-scoped table carries client_id.

create extension if not exists pgcrypto;

-- ---------- Platform-owned ----------
create table client_editions (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null unique,           -- Starter / Growth / Enterprise
  feature_flags       jsonb not null default '{}',    -- {"video_generation":true,"whitelabel_domain":true,...}
  seat_limit          int  not null default 5,
  social_account_limit int not null default 3,
  ai_generation_quota int  not null default 100,      -- units per month; unit costs defined per capability
  created_at          timestamptz not null default now()
);

create table clients (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$'),
  custom_domain text unique,
  edition_id    uuid not null references client_editions(id),
  status        text not null default 'active' check (status in ('active','suspended','archived')),
  created_at    timestamptz not null default now()
);

create table access_groups (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references clients(id) on delete cascade,
  name        text not null,
  permissions jsonb not null default '{}',  -- {"create_concepts":true,"approve":false,"connect_social":false,"view_analytics":true}
  unique (client_id, name)
);

create table users (
  id            uuid primary key default gen_random_uuid(),
  auth_id       uuid not null unique,        -- auth provider subject
  email         text not null unique,
  platform_role text check (platform_role in ('platform_admin','account_manager','creative_ops')),
  client_id     uuid references clients(id) on delete set null,
  client_role   text check (client_role in ('brand_admin','brand_editor','brand_viewer')),
  created_at    timestamptz not null default now(),
  check (platform_role is not null or client_id is not null)  -- must belong to one side
);

create table user_access_groups (
  user_id         uuid not null references users(id) on delete cascade,
  access_group_id uuid not null references access_groups(id) on delete cascade,
  primary key (user_id, access_group_id)
);

-- ---------- Brand & theme ----------
create table brand_profiles (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null unique references clients(id) on delete cascade,
  brand_voice_doc text,
  color_palette   jsonb not null default '{}',     -- {"primary":"#0F4C5C","secondary":...}
  logo_url        text,
  typography      jsonb not null default '{}',
  tone_guidelines text,
  target_audience text,
  updated_at      timestamptz not null default now()
);

create table theme_versions (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references clients(id) on delete cascade,
  version    int  not null,
  tokens     jsonb not null,                       -- resolved runtime theme tokens
  is_active  boolean not null default false,
  created_at timestamptz not null default now(),
  unique (client_id, version)
);
create unique index one_active_theme_per_client on theme_versions (client_id) where is_active;

-- ---------- Content pipeline ----------
create table campaigns (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references clients(id) on delete cascade,
  name       text not null,
  objective  text,
  start_date date,
  end_date   date,
  status     text not null default 'draft' check (status in ('draft','active','completed','archived')),
  created_at timestamptz not null default now()
);

create table concepts (
  id                    uuid primary key default gen_random_uuid(),
  campaign_id           uuid not null references campaigns(id) on delete cascade,
  client_id             uuid not null references clients(id) on delete cascade,
  title                 text not null,
  core_message          text,
  suggested_format      text,
  generated_from_prompt text,          -- full assembled prompt, inspectable (§1.3)
  llm_provider          text,
  llm_model             text,
  raw_llm_output        jsonb,
  status                text not null default 'draft' check (status in ('draft','locked','archived')),
  created_by            uuid references users(id),
  created_at            timestamptz not null default now()
);

create table concept_assets (
  id          uuid primary key default gen_random_uuid(),
  concept_id  uuid not null references concepts(id) on delete cascade,
  client_id   uuid not null references clients(id) on delete cascade,
  type        text not null check (type in ('image','video','copy')),
  provider    text,
  prompt_used text,
  source_url  text,
  raw_output  jsonb,
  status      text not null default 'draft' check (status in ('draft','pending_approval','approved','rejected')),
  version     int  not null default 1,
  created_by  uuid references users(id),
  created_at  timestamptz not null default now(),
  unique (concept_id, type, version)
);

-- ---------- Async jobs & quota ----------
create table generation_jobs (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references clients(id) on delete cascade,
  concept_id     uuid references concepts(id) on delete set null,
  capability     text not null check (capability in ('text','image','video')),
  provider       text not null,
  request_input  jsonb not null,           -- brief + assembled context reference
  status         text not null default 'queued'
                 check (status in ('queued','running','succeeded','failed','cancelled')),
  error_message  text,                     -- surfaced to user on failure, never swallowed
  result_asset_id uuid references concept_assets(id),
  requested_by   uuid references users(id),
  created_at     timestamptz not null default now(),
  started_at     timestamptz,
  finished_at    timestamptz
);

create table quota_ledger (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references clients(id) on delete cascade,
  job_id     uuid references generation_jobs(id),
  entry_type text not null check (entry_type in ('reserve','settle','release')),
  units      int  not null,                -- reserve positive, release negative
  period     text not null,               -- 'YYYY-MM'
  created_at timestamptz not null default now()
);
create index quota_ledger_period on quota_ledger (client_id, period);

-- ---------- Social ----------
create table social_accounts (
  id                       uuid primary key default gen_random_uuid(),
  client_id                uuid not null references clients(id) on delete cascade,
  platform                 text not null check (platform in ('instagram','facebook','youtube','linkedin','tiktok','x')),
  external_account_id      text not null,
  access_token_encrypted   text not null,   -- AES-256-GCM, see packages/core/src/crypto
  refresh_token_encrypted  text,
  token_expires_at         timestamptz,
  scopes_granted           text[],
  connected_by             uuid references users(id),
  status                   text not null default 'connected'
                           check (status in ('connected','expired','revoked','error')),
  last_successful_publish  timestamptz,
  created_at               timestamptz not null default now(),
  unique (client_id, platform, external_account_id)
);

create table scheduled_posts (
  id                uuid primary key default gen_random_uuid(),
  concept_asset_id  uuid not null references concept_assets(id),
  client_id         uuid not null references clients(id) on delete cascade,
  platform          text not null,
  social_account_id uuid not null references social_accounts(id),
  caption           text,
  content_at_approval jsonb,               -- frozen snapshot at approval time (§1.4)
  scheduled_at      timestamptz not null,
  published_at      timestamptz,
  platform_post_id  text,
  publish_response  jsonb,                 -- verbatim platform API response
  status            text not null default 'scheduled'
                    check (status in ('scheduled','publishing','published','failed','cancelled')),
  error_message     text,
  created_at        timestamptz not null default now()
);

-- ---------- Workflow & telemetry ----------
create table approvals (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references clients(id) on delete cascade,
  target_type  text not null check (target_type in ('concept','concept_asset','campaign')),
  target_id    uuid not null,
  requested_by uuid not null references users(id),
  approved_by  uuid references users(id),
  status       text not null default 'pending' check (status in ('pending','approved','rejected')),
  comment      text,
  decided_at   timestamptz,
  created_at   timestamptz not null default now()
);

create table comments (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references clients(id) on delete cascade,
  target_type text not null,
  target_id   uuid not null,
  author_id   uuid not null references users(id),
  parent_id   uuid references comments(id),
  body        text not null,
  mentions    uuid[] not null default '{}',
  created_at  timestamptz not null default now()
);

create table analytics_snapshots (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references clients(id) on delete cascade,
  scheduled_post_id uuid not null references scheduled_posts(id) on delete cascade,
  platform          text not null,
  metric_type       text not null,          -- reach / impressions / likes / clicks / ...
  value             numeric not null,
  captured_at       timestamptz not null default now()
);
create index analytics_by_post on analytics_snapshots (scheduled_post_id, metric_type, captured_at);

create table notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  client_id  uuid references clients(id) on delete cascade,
  type       text not null,
  payload    jsonb not null default '{}',
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create table audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references users(id),
  client_id   uuid references clients(id),
  action      text not null,               -- e.g. 'approval.approved', 'impersonation.start'
  target_type text,
  target_id   uuid,
  diff        jsonb,
  created_at  timestamptz not null default now()
);
create index audit_by_client_time on audit_log (client_id, created_at desc);
