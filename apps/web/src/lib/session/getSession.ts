import { cookies } from 'next/headers';
import { jwtVerify, createRemoteJWKSet } from 'jose';

export interface SessionClaims {
  sub: string;
  email?: string;
  platform_role?: 'platform_admin' | 'account_manager' | 'creative_ops';
  client_id?: string;
  client_role?: 'brand_admin' | 'brand_editor' | 'brand_viewer';
  impersonating?: boolean;
  impersonation_expires_at?: string;
}

const jwks = createRemoteJWKSet(
  new URL(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/.well-known/jwks.json`),
);

/** Verified session claims for server components / route handlers. Null if unauthenticated. */
export async function getSession(): Promise<{ claims: SessionClaims; accessToken: string } | null> {
  const token = (await cookies()).get('sb-access-token')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, jwks);
    return { claims: payload as unknown as SessionClaims, accessToken: token };
  } catch {
    return null;
  }
}
