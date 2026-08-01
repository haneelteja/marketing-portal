# ADR-0001: One codebase, role-gated routing
**Status:** Accepted

Both consoles ship from one Next.js app (`/platform/*` vs `/app/{slug}/*`), gated in
middleware by JWT claims. Rejected: two apps (duplicated auth/theme/data layers, drift —
the "V1/V2/V3 folder" failure mode the spec warns about).
