import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Three database client classes (spec §13). Client-console code imports ONLY
 * rlsClient. serviceClient is exported from a separate entrypoint and each usage
 * requires an inline SERVICE-ROLE JUSTIFICATION comment (enforced by lint rule
 * `no-restricted-imports` + code review).
 */

/** Default client: user's own JWT -> RLS enforced by Postgres. */
export function rlsClient(accessToken: string): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false } },
  );
}

/**
 * Platform-console client: still the user's JWT — cross-tenant access is granted
 * by explicit `platform_all` RLS policies, not by bypassing RLS.
 */
export const platformClient = rlsClient;

/**
 * Service-role client. Allowed call sites (each documented inline where used):
 *   - queue workers (no user session exists)
 *   - inbound webhook handlers (platform-originated, no user session)
 *   - middleware tenant resolution (pre-auth, read-only, single internal endpoint)
 * NEVER the default for client-console CRUD (spec §15.2).
 */
export function serviceClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // server-only env, never NEXT_PUBLIC
    { auth: { persistSession: false } },
  );
}
