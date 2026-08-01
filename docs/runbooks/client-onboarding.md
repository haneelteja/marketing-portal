# Runbook: onboarding a new client

1. Platform Console → Clients → New: name, slug, edition. (Creates `clients` row,
   default `brand_profiles`, theme_versions v1 from agency defaults.)
2. Invite Brand Admin (email invite → auth signup → claims stamped with client_id/brand_admin).
3. Brand Admin completes brand intake: logo, guidelines doc, palette, tone, audience.
4. (Optional) Custom domain: client adds CNAME → platform edge; verify in Platform Console;
   middleware resolves it on next request. Confirm no flash-of-wrong-brand on first paint.
5. Brand Admin connects social accounts (needs `connect_social` permission).
6. Smoke test in staging tenant first: generate 1 concept → 1 image → approve → schedule a
   post 5 minutes out → verify visible on the real platform account → verify analytics pull.
