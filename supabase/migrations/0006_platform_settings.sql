-- 0006_platform_settings.sql
-- Platform-level settings: global API key configuration, task-based LLM routing,
-- and social OAuth placeholder credentials — all managed by platform_admin only.

create table platform_settings (
  id               text primary key default 'singleton'
                   check (id = 'singleton'),   -- enforce one-row design

  -- OpenRouter
  openrouter_api_key_hint  text,  -- last-4 chars only, never the full key

  -- Task → LLM routing. JSON object keyed by LlmTask.
  -- e.g. {"strategy": {"vendor": "openrouter", "model": "meta-llama/llama-3.3-70b-instruct:free"}, ...}
  llm_task_routing         jsonb not null default '{}'::jsonb,

  -- Social OAuth placeholder credentials (stored encrypted by the publisher worker)
  social_credentials       jsonb not null default '{}'::jsonb,

  updated_at               timestamptz not null default now(),
  updated_by               uuid references auth.users(id)
);

-- Seed the singleton row so there's always something to SELECT/UPDATE.
insert into platform_settings (id, llm_task_routing) values ('singleton', '{
  "strategy":   {"vendor": "openrouter", "model": "meta-llama/llama-3.3-70b-instruct:free"},
  "concept":    {"vendor": "openrouter", "model": "meta-llama/llama-3.3-70b-instruct:free"},
  "caption":    {"vendor": "openrouter", "model": "google/gemma-3-27b-it:free"},
  "audience":   {"vendor": "openrouter", "model": "qwen/qwen-2.5-72b-instruct:free"},
  "lead_scout": {"vendor": "openrouter", "model": "mistralai/mistral-7b-instruct:free"}
}'::jsonb)
on conflict (id) do nothing;

-- RLS: only platform admins can read or write this table.
alter table platform_settings enable row level security;

create policy platform_settings_platform_all on platform_settings
  for all using ((auth.jwt() ->> 'platform_role') is not null);

-- Auto-update updated_at on every write.
create or replace function set_platform_settings_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_platform_settings_updated_at
  before update on platform_settings
  for each row execute function set_platform_settings_updated_at();
