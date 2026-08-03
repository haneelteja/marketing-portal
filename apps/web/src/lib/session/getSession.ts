import { cookies } from 'next/headers';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import { createServerClient } from '@supabase/ssr';

export interface SessionClaims {
  sub: string;
  email?: string;
  platform_role?: 'platform_admin' | 'account_manager' | 'creative_ops';
  client_id?: string;
  client_role?: 'brand_admin' | 'brand_editor' | 'brand_viewer';
  impersonating?: boolean;
  impersonation_expires_at?: string;
}

let _jwks: ReturnType<typeof createRemoteJWKSet> | undefined;
function getJwks() {
  if (!_jwks) {
    _jwks = createRemoteJWKSet(
      new URL(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/.well-known/jwks.json`),
    );
  }
  return _jwks;
}

/** Verified session claims for server components / route handlers. Null if unauthenticated. */
export async function getSession(): Promise<{ claims: SessionClaims; accessToken: string } | null> {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() {},
        },
      },
    );
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return null;
    const { payload } = await jwtVerify(session.access_token, getJwks());
    return { claims: payload as unknown as SessionClaims, accessToken: session.access_token };
  } catch {
    return null;
  }
}
