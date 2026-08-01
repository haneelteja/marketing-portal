-- Staging demo tenant (spec §14: seeded staging before any production onboarding).
-- Applied by `supabase db reset` locally and in the staging pipeline only.
insert into client_editions (id, name, feature_flags, seat_limit, social_account_limit, ai_generation_quota)
values
  ('11111111-0000-0000-0000-000000000001', 'Starter',    '{"video_generation": false, "audio_generation": false, "whitelabel_domain": false}', 5, 3, 100),
  ('11111111-0000-0000-0000-000000000002', 'Growth',     '{"video_generation": true,  "audio_generation": false, "whitelabel_domain": false}', 15, 8, 500),
  ('11111111-0000-0000-0000-000000000003', 'Enterprise', '{"video_generation": true,  "audio_generation": true,  "whitelabel_domain": true}',  100, 25, 5000)
on conflict (name) do nothing;

insert into clients (id, name, slug, edition_id)
values ('22222222-0000-0000-0000-000000000001', 'Demo Coffee Co.', 'demo-coffee',
        '11111111-0000-0000-0000-000000000002')
on conflict (slug) do nothing;

insert into brand_profiles (client_id, brand_voice_doc, color_palette, tone_guidelines, target_audience)
values ('22222222-0000-0000-0000-000000000001',
        'Independent roaster. Craft-first, never corporate. First person plural.',
        '{"primary":"#4A2C1A","secondary":"#B08252","accent":"#E4572E"}',
        'Warm, knowledgeable, a little irreverent',
        'Urban 25-40, quality-driven, values provenance')
on conflict (client_id) do nothing;

insert into theme_versions (client_id, version, tokens, is_active)
values ('22222222-0000-0000-0000-000000000001', 1,
        '{"clientName":"Demo Coffee Co.","colors":{"primary":"#4A2C1A","secondary":"#B08252","accent":"#E4572E","surface":"#FAF6F1","ink":"#241812"},"radius":"12px"}',
        true)
on conflict (client_id, version) do nothing;
