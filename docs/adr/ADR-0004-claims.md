# ADR-0004: JWT claims contract
**Status:** Accepted

Claims stamped at token mint (Supabase auth hook): `platform_role`, `client_id`,
`client_role`, plus `impersonating` + `impersonation_expires_at` for support sessions.
RLS reads these via `auth_ext.*` helper functions (migration 0002). A user is either
platform-side or client-side; impersonation grants a time-boxed client context without
changing the actor identity, and both mint and expiry are audit-logged.
