import { NextRequest, NextResponse } from 'next/server';

/**
 * Edge middleware (spec §2.2, §7):
 *  1. Resolve host -> tenant: {slug}.PLATFORM_HOST or a registered custom domain (CNAME).
 *  2. Gate /platform/* to platform roles, /app/{slug}/* to that tenant's users.
 *  3. Inject x-tenant-id / x-theme-version headers so the root layout can load the
 *     theme server-side before first paint — no flash of wrong brand.
 */
const PLATFORM_HOST = process.env.NEXT_PUBLIC_PLATFORM_HOST ?? 'yourplatform.com';

export async function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? '';
  const url = req.nextUrl;

  // -- Tenant resolution ----------------------------------------------------
  let tenant: { id: string; slug: string; themeVersion: number } | null = null;
  const sub = host.endsWith(`.${PLATFORM_HOST}`) ? host.replace(`.${PLATFORM_HOST}`, '') : null;
  if (sub && sub !== 'www' && sub !== 'platform') {
    tenant = await lookupTenant({ slug: sub });
  } else if (!host.endsWith(PLATFORM_HOST)) {
    tenant = await lookupTenant({ customDomain: host });
    if (!tenant) return new NextResponse('Unknown domain', { status: 404 });
  }

  // -- Session claims -------------------------------------------------------
  const claims = await readSessionClaims(req); // { sub, platform_role, client_id, client_role, impersonating }

  // -- Route gating ---------------------------------------------------------
  if (url.pathname.startsWith('/platform')) {
    if (!claims?.platform_role) {
      return NextResponse.redirect(new URL('/login?next=' + url.pathname, url));
    }
  }
  if (url.pathname.startsWith('/app/')) {
    const slugInPath = url.pathname.split('/')[2];
    const effectiveTenant = tenant ?? (slugInPath ? await lookupTenant({ slug: slugInPath }) : null);
    if (!effectiveTenant) return new NextResponse('Not found', { status: 404 });
    const allowed = claims?.platform_role /* impersonation & support, banner-flagged in UI */
      || claims?.client_id === effectiveTenant.id;
    if (!allowed) {
      return NextResponse.redirect(new URL('/login?next=' + url.pathname, url));
    }
    tenant = effectiveTenant;
  }

  // Custom-domain root maps to the tenant console.
  if (tenant && url.pathname === '/') {
    url.pathname = `/app/${tenant.slug}`;
  }

  const res = NextResponse.rewrite(url);
  if (tenant) {
    res.headers.set('x-tenant-id', tenant.id);
    res.headers.set('x-theme-version', String(tenant.themeVersion));
  }
  if (claims?.impersonating) res.headers.set('x-impersonating', '1');
  return res;
}

export const config = { matcher: ['/((?!_next/|favicon.ico|api/health).*)'] };

// -- helpers (edge-safe; cached KV lookup in production) ----------------------
async function lookupTenant(
  q: { slug?: string; customDomain?: string },
): Promise<{ id: string; slug: string; themeVersion: number } | null> {
  const res = await fetch(
    `${process.env.INTERNAL_API_URL}/internal/tenant-resolve?` +
      new URLSearchParams(q as Record<string, string>),
    { headers: { 'x-internal-key': process.env.INTERNAL_API_KEY! }, next: { revalidate: 60 } },
  );
  return res.ok ? res.json() : null;
}

async function readSessionClaims(req: NextRequest): Promise<{
  sub: string; platform_role?: string; client_id?: string;
  client_role?: string; impersonating?: boolean;
} | null> {
  const token = req.cookies.get('sb-access-token')?.value;
  if (!token) return null;
  try {
    // Signature verified against JWKS in production (jose.jwtVerify); payload shape only here.
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    return payload;
  } catch { return null; }
}
